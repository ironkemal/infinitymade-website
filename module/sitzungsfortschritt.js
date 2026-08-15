/**
 * sitzungsfortschritt.js — Wann ist eine Verordnung fertig behandelt?
 *
 * Warum es das gibt
 * ─────────────────
 * Beim Speichern einer Verordnung legt `saveRezept` sofort so viele Zeilen in
 * `prescription_sessions` an, wie Einheiten verordnet sind — zunächst alle ohne
 * `booking_id`. Das sind Platzhalter: „diese Sitzung ist noch nicht geplant".
 * Termine füllen sie später auf.
 *
 * Die alte Prüfung in `markPrescriptionSession` fragte:
 *
 *     „Gibt es in dieser Verordnung noch eine Zeile, die nicht `done` ist?"
 *
 * Ein nie verplanter Platzhalter beantwortet diese Frage für immer mit „ja".
 * Folge (in den Daten am 12.08.2026 nachgewiesen, `gkv-302`):
 *
 *     Rezept wird nie `completed`
 *       → `abrechnung_status` wird nie `bereit`
 *         → die §302-Liste (dashboard.js, .eq('abrechnung_status','bereit'))
 *           zeigt das Rezept nie an
 *           → es wird nie abgerechnet. Ohne Fehlermeldung.
 *
 * Das ist der teurere Zwilling der Doppelabrechnung: eine Doppelposition setzt
 * die Kasse ab, das fällt auf. Hier fällt gar nichts auf — das Geld wird nur
 * nie gefordert.
 *
 * Die Regel hier
 * ──────────────
 *     offen    = Sitzungen MIT Termin im Status `planned`
 *     erbracht = Sitzungen im Status `done`
 *     fertig   = offen === 0  UND  erbracht >= verordnete Einheiten
 *
 * `cancelled` und `no_show` sind erledigt, nicht offen — der Termin ist vorbei.
 * Die Einheit ist damit aber auch nicht erbracht, und genau das fängt die
 * zweite Hälfte der Regel ab: das Rezept bleibt in Behandlung, bis die Einheit
 * nachgeholt ist. Zählte man sie als „offen", hinge das Rezept wieder ewig.
 *
 * Beide Hälften sind nötig:
 *
 * • Platzhalter zählen nicht als „offen" — sonst der Fehler oben.
 * • Die Einheiten müssen trotzdem erbracht sein — sonst wäre ein Rezept über
 *   6 Einheiten schon nach dem ersten abgehakten Termin „abrechnungsbereit",
 *   nur weil die übrigen fünf noch nicht gebucht sind.
 *
 * Bricht der Patient nach 5 von 6 Einheiten ab, bleibt die Verordnung bewusst
 * in Behandlung. Eine Teilabrechnung ist nach §302 zulässig, aber sie ist eine
 * Entscheidung des Menschen — dafür gibt es in der Rezeptliste den Knopf
 * „Als bereit markieren". Automatisch abrechnen, was nie zu Ende behandelt
 * wurde, wäre schlimmer als der Fehler, den diese Datei behebt.
 *
 * `erbracht` zählt bewusst OHNE Termin-Bedingung: die §302-Positionen entstehen
 * in `abrechnung.routes.js` direkt aus den `done`-Zeilen. Was dort Geld wird,
 * muss hier auch als erbracht gelten — sonst laufen die beiden Sichten
 * auseinander.
 */

/**
 * Die Regel allein — ohne Datenbank, damit sie prüfbar bleibt.
 *
 * @param {{offen:number, erbracht:number, einheiten:number|null}} stand
 */
export function istFertigBehandelt({ offen, erbracht, einheiten }) {
  if ((offen || 0) > 0) return false;
  // Ohne verordnete Einheitenzahl (Altbestand, Blanko) bleibt nur „nichts mehr offen".
  if (!einheiten) return true;
  return (erbracht || 0) >= einheiten;
}

/**
 * Prüft den Fortschritt einer Verordnung und hebt ihren Status, wenn fällig.
 *
 * Schreibt nur nach oben und nur, wenn kein Mensch bereits eingegriffen hat:
 * `status` wird ausschliesslich aus `parsed|confirmed|in_therapy` gehoben, und
 * `abrechnung_status` nur gesetzt, solange er `null` ist (manuelle Wahl
 * gewinnt) und die Kasse überhaupt bekannt ist.
 *
 * @param supabase         aktiver Supabase-Client
 * @param {string} prescriptionId
 * @returns {Promise<{offen:number, erbracht:number, einheiten:number|null, fertig:boolean}|null>}
 */
export async function pruefeVerordnungsfortschritt(supabase, prescriptionId) {
  if (!prescriptionId) return null;

  const zaehler = () => supabase
    .from('prescription_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('prescription_id', prescriptionId);

  const [offenRes, erbrachtRes, rxRes] = await Promise.all([
    zaehler().not('booking_id', 'is', null).eq('status', 'planned'),
    zaehler().eq('status', 'done'),
    supabase.from('prescriptions').select('anzahl_einheiten').eq('id', prescriptionId).maybeSingle(),
  ]);

  const offen     = offenRes.count || 0;
  const erbracht  = erbrachtRes.count || 0;
  const einheiten = rxRes.data?.anzahl_einheiten ?? null;
  const fertig    = istFertigBehandelt({ offen, erbracht, einheiten });

  if (fertig) {
    await supabase.from('prescriptions')
      .update({ status: 'completed' }).eq('id', prescriptionId)
      .in('status', ['parsed', 'confirmed', 'in_therapy']);
    // §302-Weiche: erst hier taucht das Rezept in der Kassenabrechnung auf.
    await supabase.from('prescriptions')
      .update({ abrechnung_status: 'bereit' }).eq('id', prescriptionId)
      .is('abrechnung_status', null)
      .not('kostentraeger_ik', 'is', null);
  } else {
    await supabase.from('prescriptions')
      .update({ status: 'in_therapy' }).eq('id', prescriptionId)
      .in('status', ['parsed', 'confirmed']);
  }

  return { offen, erbracht, einheiten, fertig };
}
