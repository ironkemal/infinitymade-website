// Bewusste Deploymentgrenze: api-backend/ wird nicht an Vercel hochgeladen;
// dessen Docker-Image enthält umgekehrt api/ nicht. Semantische Parität zum
// Backend-Helfer wird in tools/mail-endpunkte.test.js geprüft.
export function escHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, char => entities[char]);
}
