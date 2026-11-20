const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MELDUNGEN = new Map([
  ['ANMELDUNG', 'Bitte erneut anmelden.'],
  ['TERMIN_FEHLT', 'Termin nicht gefunden oder keine Berechtigung.'],
  ['TERMIN_GEAENDERT', 'Der Termin wurde geändert. Bitte neu öffnen und prüfen.'],
  ['ZUKUNFT', 'Dieser Termin liegt in der Zukunft. Die Sitzung kann erst ab Terminbeginn abgeschlossen werden.'],
  ['STATUS', 'Termin oder Sitzung können aufgrund des aktuellen Status nicht abgeschlossen werden.'],
  ['GRUPPE', 'Bitte die Sitzung am Termin des jeweiligen Gruppenteilnehmers abschließen.'],
  ['PODO', 'Bitte diese Behandlung in der Podologie-Tagesdokumentation erfassen.'],
  ['FAHRT', 'Bitte zuerst „Fahrt starten“ und „Ich bin angekommen“ auswählen.'],
  ['KEINE_SITZUNG', 'Diesem Termin ist keine Sitzung zugeordnet. Bitte den Termin bearbeiten und eine offene Einheit der bestätigten Verordnung auswählen.'],
  ['VERORDNUNG_FEHLT', 'Die verknüpfte Verordnung konnte nicht geprüft werden.'],
  ['ENTWURF', 'Die verknüpfte Verordnung ist ein Entwurf. Bitte zuerst die Verordnung bestätigen.'],
]);

/**
 * Ein RPC schreibt Termin, Einheiten und Verordnungsfortschritt in derselben Transaktion.
 * @param {{ clientFuerToken: (token: string) => any }} deps
 * @returns {import('express').RequestHandler}
 */
export function createSitzungsabschluss({ clientFuerToken }) {
  return async (req, res) => {
    const id = req.params.id;
    const { startzeit, notiz } = req.body || {};
    const erwarteterStart = typeof startzeit === 'string' ? Date.parse(startzeit) : NaN;
    if (!UUID.test(id) || !Number.isFinite(erwarteterStart) || (notiz != null && typeof notiz !== 'string')) {
      return res.status(400).json({ error: 'Ungültige Angaben zum Sitzungsabschluss.' });
    }
    const { tenantId, userId } = req.auth || {};
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!tenantId || !userId || !token) return res.status(401).json({ error: 'Bitte erneut anmelden.' });

    try {
      const { data, error } = await clientFuerToken(token).rpc('sitzung_abschliessen', {
        p_booking_id: id, p_startzeit: startzeit, p_notiz: notiz || null,
      });
      if (error) {
        if (['PT401', 'PT404', 'PT409'].includes(error.code) && MELDUNGEN.has(error.message)) {
          return res.status(Number(error.code.slice(2))).json({ error: MELDUNGEN.get(error.message) });
        }
        throw error;
      }
      if (!Array.isArray(data)) throw new Error('ABSCHLUSS_UNBESTAETIGT');
      return res.json({ prescriptionIds: data });
    } catch (error) {
      const err = /** @type {any} */ (error);
      console.warn('[sitzungsabschluss]', err?.code || err?.name || 'FEHLER');
      return res.status(503).json({ error: 'Der Sitzungsabschluss konnte nicht bestätigt werden. Bitte erneut versuchen.' });
    }
  };
}
