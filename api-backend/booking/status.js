import crypto from 'node:crypto';

// Statusabfrage fuer das einbettbare Termin-Anfrage-Widget (widget/).
// Der Token ist derselbe HMAC wie im Patientenlink (cancel / accept-offer), damit
// es nur EINEN Mechanismus gibt, der Anfragen einem Patienten zuordnet.
export function requestToken(secret, requestId, patientId) {
  return crypto.createHmac('sha256', secret)
    .update(`${requestId}:${patientId}`).digest('hex').substring(0, 32);
}

export function tokenMatches(expected, given) {
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

// UTC-Zeitpunkt -> Berliner Ortszeit "YYYY-MM-DDTHH:mm" (DST-sicher ueber Intl).
export function berlinLocal(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Bewusst knapp: nur Status, Termin und ein Satz. Keine Namen, kein Geburtsdatum,
// keine Anliegen (legal-de 11.10.2026, Art. 5 Abs. 1 lit. c / Art. 32).
export function toPublicStatus(row, firstBookingStart = null) {
  switch (row.status) {
    case 'approved': {
      const slot = firstBookingStart
        ? berlinLocal(firstBookingStart)
        : (row.preferred_date && row.preferred_time
          ? `${row.preferred_date}T${String(row.preferred_time).slice(0, 5)}` : null);
      return {
        status: 'accepted',
        ...(slot ? { confirmedSlot: slot } : {}),
        message: 'Ihr Termin wurde bestätigt.',
      };
    }
    case 'declined':
    case 'cancelled':
      return {
        status: 'rejected',
        message: 'Die Praxis kann Ihre Anfrage leider nicht erfüllen. Bitte nehmen Sie Kontakt auf.',
      };
    default:
      return {
        status: 'pending',
        message: row.alternativ_angeboten_at
          ? 'Die Praxis hat Ihnen einen anderen Termin vorgeschlagen. Bitte prüfen Sie Ihre Nachrichten.'
          : 'Ihre Anfrage ist eingegangen. Die Praxis meldet sich bei Ihnen.',
      };
  }
}
