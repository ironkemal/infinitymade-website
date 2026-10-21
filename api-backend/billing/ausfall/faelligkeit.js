// Ausfallrechnungen haben ab Ausstellung ein unveränderliches Zahlungsziel.
const berlinDatum = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function ausfallFaelligAm(createdAt, zahlungszielTage = 14) {
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) throw new Error('Ungültiges Rechnungsdatum');
  const parts = Object.fromEntries(berlinDatum.formatToParts(created).map(p => [p.type, p.value]));
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00.000Z`);
  const input = Number(zahlungszielTage);
  const days = Number.isSafeInteger(input) && input > 0 ? input : 14;
  const target = new Date(start);
  target.setUTCDate(target.getUTCDate() + days);
  if (!Number.isFinite(target.getTime()) || target.getUTCFullYear() > 9999) {
    start.setUTCDate(start.getUTCDate() + 14);
    return start.toISOString().slice(0, 10);
  }
  return target.toISOString().slice(0, 10);
}

export function gespeicherteAusfallFaelligkeit(row) {
  const value = row?.faellig_am;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T12:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function ausfallIstFaellig(row, now = new Date()) {
  const date = gespeicherteAusfallFaelligkeit(row);
  if (!date) return false; // Altbelege: ursprüngliches Zahlungsziel nicht nachgewiesen.
  const parts = Object.fromEntries(berlinDatum.formatToParts(now).map(p => [p.type, p.value]));
  // Mahnung erst nach Ablauf des gesamten Fälligkeitstages (Berliner Kalender).
  return row.faellig_am < `${parts.year}-${parts.month}-${parts.day}`;
}
