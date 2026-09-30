// Standortprüfung beim Check-in (Anwesenheit) — rein, ohne DB-Zugriff.
//
// Drei Ergebnisse (attendance.check_in_valid, seit 0047 nullable):
//   true  = Mitarbeiter im Umkreis der Praxis
//   false = außerhalb
//   null  = nicht geprüft: Owner-Schalter aus (profiles.gps_checkin_pruefen, Standard),
//           kein Standort übermittelt/verweigert, oder keine Praxiskoordinate.
// Vorher wurde "nicht geprüft" als false gespeichert und stand im Bericht als
// ungültig (legal-de + guvenlik A-19, 30.09.2026).

function zahl(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} o
 * @param {boolean} o.pruefen      Owner-Schalter
 * @param {*} o.lat  @param {*} o.lng            Gerätestandort (darf fehlen)
 * @param {*} o.praxisLat @param {*} o.praxisLng Praxiskoordinate (darf fehlen)
 * @param {number} o.radiusM
 * @param {(a:number,b:number,c:number,d:number)=>number} o.distanz  Meter
 * @returns {true|false|null}
 */
export function gpsCheckinErgebnisRein({ pruefen, lat, lng, praxisLat, praxisLng, radiusM, distanz }) {
  if (!pruefen) return null;
  const la = zahl(lat), ln = zahl(lng), pla = zahl(praxisLat), pln = zahl(praxisLng);
  if (la === null || ln === null || pla === null || pln === null) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  return distanz(la, ln, pla, pln) <= radiusM;
}
