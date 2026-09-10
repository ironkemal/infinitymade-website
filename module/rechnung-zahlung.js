/**
 * rechnung-zahlung.js — „Wurde bereits bezahlt?" nur noch EINMAL fragen.
 *
 * Das Problem (Beta-2, 12.08.2026)
 * ────────────────────────────────
 *     „bei der Rechnung wird gefragt: bezahlt oder nicht bezahlt — das ist
 *      alles doppelt … wenn bezahlt ist, dann braucht er gar nicht ins
 *      Mahnwesen reinzugehen."
 *
 * Es gab zwei Wege, dieselbe Zahlung zu erfassen, die nichts voneinander
 * wussten:
 *
 *   1. Kassieren (Termin-Panel / Patientenakte) → `kassiereZuzahlung`.
 *      Fragt die Zahlart, bucht einen Beleg, setzt
 *      `prescriptions.zuzahlung_kassiert_am`. Nur DAS sieht das Mahnwesen
 *      (api-backend/billing/zuzahlung/bezahlt.js).
 *
 *   2. Rechnung speichern → ein eigener Dialog hier. Schrieb ausschliesslich
 *      `invoices.payment_status`. Kein Beleg, kein Vermerk am Rezept.
 *
 * Wer also Weg 2 ging, hatte die Frage beantwortet — und wurde trotzdem
 * gemahnt, weil das Mahnwesen die Antwort nirgends finden konnte. Danach
 * fragte ihn die Oberfläche beim Kassieren ein zweites Mal.
 *
 * Die Auflösung
 * ─────────────
 * Hängt an der Rechnung ein Rezept mit offener Zuzahlung, wird hier gar nichts
 * mehr gefragt: der vorhandene Kassieren-Ablauf übernimmt (eine Frage, ein
 * Beleg, ein Vermerk), und die Rechnung übernimmt anschliessend nur noch das
 * Ergebnis.
 *
 * ⚠️ Seit Ops #271 (08.09.2026): der eigene Dialog für „alles ohne Rezept"
 * (Fall 3, Privatrechnungen/Selbstzahler) ist HIER entfernt. Der Aufrufer
 * (`dashboard.js`) öffnet für diesen Fall direkt den Ledger-Dialog aus
 * `module/rechnung-zahlungseingang.js` — mit Gegenkonto
 * (Bar/Karte/Überweisung/PayPal) statt der alten Bezahlt/Nicht-bezahlt-Frage.
 * Grund: der alte Weg schrieb `payment_status='paid'` OHNE Ledger-Zeile;
 * `rechnung_zahlung_buchen()` lehnt eine so markierte Rechnung danach
 * dauerhaft ab („hat aber keinen Zahlungsbeleg"). Diese Funktion bleibt für
 * Fall 1/2 (Rezept) unverändert zuständig.
 *
 * Bewusst NICHT hier: eine zweite Definition von „bezahlt". Ob kassiert wurde,
 * wird am selben Feld abgelesen, das auch der Rest der Oberfläche liest
 * (`zuzahlung_kassiert_am`); gebucht wird ausschliesslich über den
 * übergebenen `kassiere`-Ablauf. Diese Datei bucht nichts selbst.
 */

// prescriptions.zuzahlung_zahlart (bar|ec|ueberweisung|paypal|sonstiges) →
// invoices.payment_method (bar|karte|lastschrift|ueberweisung|sonstiges).
// Zwei Tabellen, zwei alte CHECK-Constraints — „ec" und „karte" meinen dasselbe;
// invoices.payment_method hat keinen eigenen Platz für „paypal" (Ops #271,
// 08.09.2026 nur in prescriptions/belegliste ergänzt), fällt deshalb auf
// „sonstiges" — sonst stand hier `undefined`, und die Rechnung verlor ihren
// Zahlungsweg lautlos (payment_method || null -> null).
const ZAHLART_ZU_PAYMENT_METHOD = {
  bar: 'bar',
  ec: 'karte',
  ueberweisung: 'ueberweisung',
  paypal: 'sonstiges',
  sonstiges: 'sonstiges',
};

/** Exportiert für den Regressionstest — der stille Fall (unbekannte Zahlart -> null) ist der Fehler, der hier passiert war. */
export function paymentMethodFuerZahlart(zahlart) {
  return ZAHLART_ZU_PAYMENT_METHOD[zahlart] || null;
}

async function markiereRechnungBezahlt(supabase, invoiceId, method) {
  await supabase.from('invoices').update({
    payment_status: 'paid',
    payment_method: method || null,
    paid_at: new Date().toISOString(),
    status: 'paid',
  }).eq('id', invoiceId);
}

/**
 * @param {string} invoiceId
 * @param {object} opts
 * @param {object} opts.supabase
 * @param {string|null} [opts.prescriptionId]  invoices.prescription_id
 * @param {string|null} [opts.patientId]
 * @param {string} [opts.patientName]
 * @param {Function} [opts.kassiere]  ({rxId, patientId, patientName, betragEur}) => Promise<boolean>
 * @param {Function} [opts.toast]
 */
export async function frageZahlungsstatus(invoiceId, {
  supabase,
  prescriptionId = null,
  patientId = null,
  patientName = '',
  kassiere = null,
  toast = () => {},
} = {}) {
  if (!invoiceId) return;

  let rx = null;
  if (prescriptionId) {
    const { data } = await supabase
      .from('prescriptions')
      .select('id, zuzahlung_eur, zuzahlung_befreit, zuzahlung_kassiert_am, zuzahlung_zahlart')
      .eq('id', prescriptionId)
      .maybeSingle();
    rx = data || null;
  }

  // Fall 1: schon kassiert. Die Frage wäre die zweite zur selben Zahlung.
  if (rx?.zuzahlung_kassiert_am) {
    await markiereRechnungBezahlt(supabase, invoiceId, paymentMethodFuerZahlart(rx.zuzahlung_zahlart));
    toast('Zuzahlung war bereits kassiert — Rechnung als bezahlt übernommen ✓');
    return;
  }

  // Fall 2: offene Zuzahlung am Rezept → der Kassieren-Ablauf ist zuständig.
  // Nur dort entsteht der Kassenbuch-Beleg, den das Mahnwesen sehen muss.
  const offeneZuzahlung = rx
    && !rx.zuzahlung_befreit
    && Number(rx.zuzahlung_eur) > 0;

  if (offeneZuzahlung && typeof kassiere === 'function') {
    const gebucht = await kassiere({
      rxId: rx.id,
      patientId,
      patientName,
      betragEur: Number(rx.zuzahlung_eur),
    });
    if (gebucht) {
      // Zahlart frisch lesen: sie wurde gerade im Kassieren-Dialog gewählt.
      const { data: nach } = await supabase
        .from('prescriptions')
        .select('zuzahlung_zahlart')
        .eq('id', rx.id)
        .maybeSingle();
      await markiereRechnungBezahlt(supabase, invoiceId, paymentMethodFuerZahlart(nach?.zuzahlung_zahlart));
    } else {
      // Abgebrochen oder fehlgeschlagen: die Rechnung bleibt offen. Kein
      // stiller „bezahlt"-Vermerk ohne Beleg — genau daraus entstand das
      // Auseinanderlaufen von Rechnung und Mahnwesen.
      await supabase.from('invoices').update({ payment_status: 'pending' }).eq('id', invoiceId);
    }
    return;
  }

  // Fall 3 (kein Rezept — Privat/Selbstzahler) ist hier absichtlich NICHT
  // mehr behandelt: der Aufrufer (dashboard.js) erreicht diesen Zweig gar
  // nicht mehr, er öffnet stattdessen direkt den Ledger-Dialog aus
  // module/rechnung-zahlungseingang.js (Ops #271, 08.09.2026 — Begründung
  // im Dateikopf). Defensiv belassen für den Fall, dass diese Funktion doch
  // einmal ohne die Verzweigung im Aufrufer erreicht wird.
}
