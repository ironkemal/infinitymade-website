// Spiegel von api-backend/lib/passwort-regel.js (Frontend-Image enthält api-backend nicht).
// K-19 g (Kemal 05.10.2026), Gleichheit per tools/passwort-regel.test.js;
// GoTrue in der Box hat GOTRUE_PASSWORD_MIN_LENGTH = MIN_MITARBEITER als
// serverseitiges Minimum für jeden Weg (auch direktes updateUser) — die 12 für
// Inhaber wird von unserem Backend/Frontend erzwungen (Restrisiko S-49: Inhaber
// kann sich per direktem updateUser 8–11 setzen, betrifft nur das eigene Konto).

export const MIN_INHABER = 12;
export const MIN_MITARBEITER = 8;

/**
 * Mindestlänge für eine Rolle aus profiles.role ('owner' | 'employee'); unbekannt → strenger.
 * @param {string} [rolle]
 * @returns {number}
 */
export function minPasswortLaenge(rolle) {
  return rolle === 'employee' ? MIN_MITARBEITER : MIN_INHABER;
}

/**
 * Fehlermeldung (de) oder null.
 * @param {string} [rolle]
 * @param {unknown} pw
 * @returns {string|null}
 */
export function pruefePasswort(rolle, pw) {
  const min = minPasswortLaenge(rolle);
  if (typeof pw !== 'string' || pw.length < min) {
    return `Das Passwort muss mindestens ${min} Zeichen lang sein.`;
  }
  return null;
}
