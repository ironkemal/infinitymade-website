/**
 * rechnung-zahlung.js — „Wurde bereits bezahlt?" nur noch EINMAL fragen.
 *
 * Das Problem (Nausad, 12.08.2026)
 * ────────────────────────────────
 *     „bei der Rechnung wird gefragt: bezahlt oder nicht bezahlt — das ist
 *      alles doppelt … wenn bezahlt ist, dann braucht er gar nicht ins
 *      Mahnwesen reinzugehen."
 *
 * Es gab zwei Wege, dieselbe Zahlung zu erfassen, die nichts voneinander
 * wussten:
 *
 *   1. Kassieren (Termin-Panel / Patientenakte) → `kassiereZuzahlung`.
 *      Fragt die Zahlart, bucht einen Kassenbuch-Beleg, setzt
 *      `prescriptions.zuzahlung_kassiert_am`. Nur DAS sieht das Mahnwesen
 *      (api-backend/billing/zuzahlung/bezahlt.js).
 *
 *   2. Rechnung speichern → dieser Dialog. Schrieb ausschliesslich
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
 * Ergebnis. Der eigene Dialog bleibt für alles ohne Rezept — Privatrechnungen,
 * Selbstzahler — wo es keine Zuzahlung und kein Mahnwesen gibt.
 *
 * Bewusst NICHT hier: eine zweite Definition von „bezahlt". Ob kassiert wurde,
 * wird am selben Feld abgelesen, das auch der Rest der Oberfläche liest
 * (`zuzahlung_kassiert_am`); gebucht wird ausschliesslich über den
 * übergebenen `kassiere`-Ablauf. Diese Datei bucht nichts selbst.
 */

// prescriptions.zuzahlung_zahlart (bar|ec|ueberweisung|sonstiges) →
// invoices.payment_method (bar|karte|lastschrift|ueberweisung|sonstiges).
// Zwei Tabellen, zwei alte CHECK-Constraints — „ec" und „karte" meinen dasselbe.
const ZAHLART_ZU_PAYMENT_METHOD = {
  bar: 'bar',
  ec: 'karte',
  ueberweisung: 'ueberweisung',
  sonstiges: 'sonstiges',
};

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
    await markiereRechnungBezahlt(supabase, invoiceId, ZAHLART_ZU_PAYMENT_METHOD[rx.zuzahlung_zahlart]);
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
      await markiereRechnungBezahlt(supabase, invoiceId, ZAHLART_ZU_PAYMENT_METHOD[nach?.zuzahlung_zahlart]);
    } else {
      // Abgebrochen oder fehlgeschlagen: die Rechnung bleibt offen. Kein
      // stiller „bezahlt"-Vermerk ohne Beleg — genau daraus entstand das
      // Auseinanderlaufen von Rechnung und Mahnwesen.
      await supabase.from('invoices').update({ payment_status: 'pending' }).eq('id', invoiceId);
    }
    return;
  }

  // Fall 3: kein Rezept im Spiel (Privat / Selbstzahler) → eigener Dialog.
  return dialog(invoiceId, { supabase, toast });
}

function dialog(invoiceId, { supabase, toast }) {
  return new Promise(resolve => {
    document.getElementById('_paymentStatusModal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = '_paymentStatusModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';

    overlay.innerHTML = `
      <div style="background:var(--bg-card-solid,#1f2937);border:1px solid var(--border,#374151);border-radius:12px;padding:24px;width:100%;max-width:400px;">
        <h3 style="margin:0 0 6px;font-size:16px;font-weight:700;color:var(--text-main,#f9fafb);">Wurde bereits bezahlt?</h3>
        <p style="margin:0 0 18px;font-size:13px;color:var(--text-muted,#9ca3af);">Bitte wählen Sie den Zahlungsstatus für diese Rechnung.</p>
        <div id="_psMethodWrap" style="display:none;margin-bottom:16px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:var(--text-muted,#9ca3af);">Zahlungsart:</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-main,#f9fafb);"><input type="radio" name="_psMethod" value="bar" checked style="accent-color:var(--accent,#b1891b);"> Bar</label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-main,#f9fafb);"><input type="radio" name="_psMethod" value="karte" style="accent-color:var(--accent,#b1891b);"> Karte</label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-main,#f9fafb);"><input type="radio" name="_psMethod" value="ueberweisung" style="accent-color:var(--accent,#b1891b);"> Überweisung</label>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button id="_psYes" style="padding:10px;background:var(--accent,#b1891b);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600;">Ja — sofort bezahlt</button>
          <button id="_psLater" style="padding:10px;background:none;border:1px solid var(--border,#374151);border-radius:8px;color:var(--text-muted,#9ca3af);cursor:pointer;font-size:13px;">Nein — Zahlung ausstehend</button>
          <button id="_psIban" style="padding:10px;background:none;border:1px solid var(--border,#374151);border-radius:8px;color:var(--text-muted,#9ca3af);cursor:pointer;font-size:13px;">Lastschrift (IBAN)</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const psYes = overlay.querySelector('#_psYes');
    const methodWrap = overlay.querySelector('#_psMethodWrap');
    let bestaetigt = false;

    // Erster Klick öffnet die Zahlart, zweiter Klick bucht. Vorher wurde dafür
    // ein zweiter Knopf ins DOM geschoben — dieselbe Frage, zwei Schaltflächen.
    psYes.addEventListener('click', async () => {
      if (!bestaetigt) {
        bestaetigt = true;
        methodWrap.style.display = 'block';
        psYes.textContent = '✓ Zahlung speichern';
        psYes.style.background = '#16a34a';
        return;
      }
      const method = overlay.querySelector('input[name="_psMethod"]:checked')?.value || 'bar';
      overlay.remove();
      await markiereRechnungBezahlt(supabase, invoiceId, method);
      toast('Zahlung gespeichert ✓');
      resolve();
    });

    overlay.querySelector('#_psLater').addEventListener('click', async () => {
      overlay.remove();
      await supabase.from('invoices').update({ payment_status: 'pending' }).eq('id', invoiceId);
      toast('Rechnung als ausstehend markiert.');
      resolve();
    });

    overlay.querySelector('#_psIban').addEventListener('click', async () => {
      overlay.remove();
      await supabase.from('invoices').update({ payment_status: 'pending', payment_method: 'lastschrift' }).eq('id', invoiceId);
      toast('Lastschrift vorgemerkt.');
      resolve();
    });
  });
}
