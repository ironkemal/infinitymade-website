// Abgesagte Sitzungen/Termine belegen keinen Platz in den aktiven Listen.
//
// Zum no_show stand hier bis zum 14.09.2026: „bleibt unveraendert; dessen
// Vergabe-Verhalten hat eine eigene Karte." Das war die Karte (Ops a8186cb8),
// und sie ist beantwortet: seitdem gibt „Patient nicht erschienen" die Einheit
// frei (`booking_id` = NULL, Status zurueck auf 'planned'). Die Zeile bleibt
// also in der aktiven Liste — richtig so, die Einheit ist offen und will
// nachgeholt werden — und faellt dort ueber das fehlende `booking_id` von
// selbst auf die unvergebene Seite. Hier ist deshalb nichts zu tun.
//
// Kein Filter auf `bookings.status === 'no_show'`: nach der Freigabe haengt gar
// kein Termin mehr an der Zeile. Ein solcher Filter traefe nur den Altbestand —
// und wuerde ihn faelschlich ganz aus der Liste werfen, statt ihn als offen zu
// zeigen. Weniger waere hier falscher als nichts.
export function aktiveSitzungszeilen(sitzungen = []) {
  return sitzungen.filter(s => s.status !== 'cancelled' && s.bookings?.status !== 'cancelled');
}
