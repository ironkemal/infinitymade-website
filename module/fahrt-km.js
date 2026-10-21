/**
 * fahrt-km.js — Kilometerstand beim Fahrtbeginn (Hausbesuch).
 *
 * Warum (canli-test 20.10.2026): Start-KM war nie vorbelegt, und ein Wert
 * unter dem letzten End-KM desselben Fahrzeugs wurde ohne Warnung gespeichert.
 * Ein Tacho läuft nicht rückwärts; im Fahrtenbuch (Finanzamt) wäre das ein
 * Bruch der lückenlosen Kette. Vorbelegt wird mit dem höchsten bekannten
 * End-KM des Fahrzeugs — aus Terminfahrten (`bookings`) und freien Fahrten
 * (`fahrten`); privat gefahrene Kilometer dazwischen trägt man darüber ein.
 */

/** Höchster bekannter End-KM eines Fahrzeugs, oder null. */
export async function letzterKmStand(sb, vehicleId) {
  if (!sb || !vehicleId) return null;
  const hole = (tabelle) => sb.from(tabelle).select('end_km')
    .eq('vehicle_id', vehicleId).not('end_km', 'is', null)
    .order('end_km', { ascending: false }).limit(1);
  const [a, b] = await Promise.all([hole('bookings'), hole('fahrten')]);
  const werte = [a?.data?.[0]?.end_km, b?.data?.[0]?.end_km].map(Number).filter(Number.isFinite);
  return werte.length ? Math.max(...werte) : null;
}

/** Fehlertext oder '' — reine Regel. */
export function startKmFehler(startKm, letzter) {
  if (letzter == null || !Number.isFinite(startKm)) return '';
  return startKm < letzter
    ? `Start-KM liegt unter dem letzten Kilometerstand dieses Fahrzeugs (${letzter.toLocaleString('de-DE')} km).`
    : '';
}

/**
 * Feld `#fsStartKm` vorbelegen und bei Fahrzeugwechsel nachziehen. Ein schon
 * getippter Wert bleibt stehen.
 * @param {object} sb
 * @param {HTMLSelectElement} sel  `#fsVehicleSelect`
 */
export function vorbelegeStartKm(sb, sel, doc = globalThis.document) {
  const feld = doc?.getElementById('fsStartKm');
  if (!feld || !sel) return;
  const fuelle = async () => {
    const vorher = feld.value;
    const km = await letzterKmStand(sb, sel.value).catch(() => null);
    if (km != null && (!vorher || feld.dataset.vorbelegt === '1') && feld.value === vorher) {
      feld.value = String(km);
      feld.dataset.vorbelegt = '1';
    }
  };
  feld.dataset.vorbelegt = '1';
  if (!sel.dataset.kmVerdrahtet) {
    sel.dataset.kmVerdrahtet = '1';
    sel.addEventListener('change', fuelle);
    feld.addEventListener('input', () => { feld.dataset.vorbelegt = ''; });
  }
  fuelle();
}
