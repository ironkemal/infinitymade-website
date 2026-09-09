// Absagen gehen über den bestehenden Backend-Endpunkt. Die Migration erledigt
// Sitzungsfreigabe und Gruppenabsage in derselben Transaktion wie den Status.
export async function storniereTermin({ apiBase, token, bookingId, reason = '', fetchImpl = fetch }) {
  if (!token) throw new Error('Bitte erneut anmelden.');
  if (!bookingId) throw new Error('Termin fehlt.');
  const response = await fetchImpl(`${apiBase}/booking/${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled', cancellation_reason: reason.trim() || null }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Termin konnte nicht abgesagt werden.');
  if (result.booking?.id !== bookingId || result.booking?.status !== 'cancelled') {
    throw new Error('Die Absage wurde nicht bestätigt. Bitte den Termin neu laden.');
  }
  return result.booking;
}
