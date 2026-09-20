/**
 * "Abgerechnet"-Karte einer §302-eingereichten Verordnung: wie viele der
 * dokumentierten Behandlungen standen schon auf der eingereichten Datei,
 * wie viele sind seither dazugekommen.
 *
 * Bewusst NICHT `podologie_behandlungen.invoice_id`: diese Spalte fuellt sich
 * nur bei der privaten Einzel-Rechnung, hat mit dem §302-Sammellauf nichts zu
 * tun. Canli-Befund: zwei komplett eingereichte Verordnungen zeigten „0
 * abgerechnet". Wahre Quelle ist `abrechnung_zeile.created_at` — der Moment
 * der Einreichung dieser Verordnung.
 *
 * @param {Array<{storniert_am:?string, created_at:string}>} dokumentiert  aelteste zuerst oder unsortiert, egal
 * @param {?string} cutoffCreatedAt  `abrechnung_zeile.created_at` der eingereichten Zeile, oder null wenn (noch) nicht eingereicht
 * @returns {{behFaturali:number, behBekliyor:number}}
 */
export function podAbrechnetZaehler(dokumentiert, cutoffCreatedAt) {
  const aktive = (dokumentiert || []).filter(b => !b.storniert_am);
  if (!cutoffCreatedAt) {
    return { behFaturali: 0, behBekliyor: aktive.length };
  }
  const behFaturali = aktive.filter(b => b.created_at && b.created_at <= cutoffCreatedAt).length;
  const behBekliyor = aktive.length - behFaturali;
  return { behFaturali, behBekliyor };
}
