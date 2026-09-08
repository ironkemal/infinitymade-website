// Abgesagte Sitzungen/Termine belegen keinen Platz in den aktiven Listen.
// no_show bleibt unverändert; dessen Vergabe-Verhalten hat eine eigene Karte.
export function aktiveSitzungszeilen(sitzungen = []) {
  return sitzungen.filter(s => s.status !== 'cancelled' && s.bookings?.status !== 'cancelled');
}
