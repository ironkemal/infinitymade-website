const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KONFLIKT = 'Der Termin oder seine Sitzungen wurden geändert. Bitte neu öffnen und prüfen.';

/**
 * Dokumentsitzung und Terminstatus in Reihenfolge speichern. Wiederholungen behalten die Erstbuchung.
 * @param {{ clientFuerToken: (token: string) => any, jetzt?: () => number }} deps
 * @returns {import('express').RequestHandler}
 */
export function createSitzungsabschluss({ clientFuerToken, jetzt = Date.now }) {
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
      const sb = clientFuerToken(token);
      /** @param {any} query */
      const terminScope = query => query.eq('id', id)
        .or(`owner_id.eq.${tenantId},and(owner_id.is.null,user_id.eq.${userId})`);
      const { data: termin, error: leseFehler } = await terminScope(sb.from('bookings')
        .select('id,start_time,status,no_show,hausbesuch,fahrt_status,is_group,group_parent_id,verordnung_id')).maybeSingle();
      if (leseFehler) throw leseFehler;
      if (!termin) return res.status(404).json({ error: 'Termin nicht gefunden oder keine Berechtigung.' });
      const start = Date.parse(termin.start_time);
      if (start !== erwarteterStart) return res.status(409).json({ error: KONFLIKT });
      if (start > jetzt()) return res.status(409).json({ error: 'Dieser Termin liegt in der Zukunft. Eine Sitzung kann erst ab Terminbeginn abgeschlossen werden.' });
      if (!['confirmed', 'completed'].includes(termin.status) || termin.no_show) {
        return res.status(409).json({ error: 'Dieser Termin kann aufgrund seines aktuellen Status nicht abgeschlossen werden.' });
      }
      if (termin.is_group && !termin.group_parent_id) {
        return res.status(409).json({ error: 'Bitte die Sitzung am Termin des jeweiligen Gruppenteilnehmers abschließen.' });
      }
      if (termin.verordnung_id) return res.status(409).json({ error: 'Bitte diese Behandlung in der Podologie-Tagesdokumentation erfassen.' });
      if (termin.hausbesuch && !['fahrt_arrived', 'fahrt_return_pending', 'fahrt_completed'].includes(termin.fahrt_status)) {
        return res.status(409).json({ error: 'Bitte zuerst „Fahrt starten“ und „Ich bin angekommen“ auswählen.' });
      }

      const { data: sitzungenRoh, error: sitzungsFehler } = await sb.from('prescription_sessions')
        .select('id,prescription_id,status,done_at,notes,prescriptions(owner_id,status,therapie_bereich)').eq('booking_id', id);
      if (sitzungsFehler) throw sitzungsFehler;
      /** @type {any[]} */
      const sitzungen = sitzungenRoh || [];
      if (sitzungen.some(s => s.prescriptions?.owner_id !== tenantId)) {
        return res.status(409).json({ error: 'Die verknüpfte Verordnung konnte nicht geprüft werden.' });
      }
      if (sitzungen.some(s => s.prescriptions.status === 'parsed')) {
        return res.status(409).json({ error: 'Die verknüpfte Verordnung ist ein Entwurf. Bitte zuerst die Verordnung bestätigen.' });
      }
      if (sitzungen.some(s => s.prescriptions.therapie_bereich === 'podo' || !['planned', 'done'].includes(s.status)
        || (s.status === 'planned' && ['billed', 'cancelled'].includes(s.prescriptions.status)))) {
        return res.status(409).json({ error: 'Die verknüpften Sitzungen können aufgrund ihres aktuellen Status nicht abgeschlossen werden.' });
      }

      const geplant = sitzungen.filter(s => s.status === 'planned').map(s => s.id);
      const geschrieben = new Set();
      const zuruecksetzen = async () => {
        // Ein paralleles Verschieben, Absagen oder Nicht-Erscheinen darf kein Leistungsdatum hinterlassen.
        // Ausschließlich die Zeilen aus diesem Schreibversuch mit unverändertem Wert zurücksetzen.
        for (const alt of sitzungen.filter(s => geschrieben.has(s.id))) {
          let herstel = sb.from('prescription_sessions').update({ status: 'planned', done_at: alt.done_at, notes: alt.notes })
            .eq('id', alt.id).eq('booking_id', id).eq('status', 'done').eq('done_at', termin.start_time);
          const aktuelleNotiz = notiz || alt.notes;
          herstel = aktuelleNotiz == null ? herstel.is('notes', null) : herstel.eq('notes', aktuelleNotiz);
          const { error } = await herstel;
          if (error) throw error;
        }
      };

      if (geplant.length) {
        /** @type {{ status: string, done_at: string, notes?: string }} */
        const patch = { status: 'done', done_at: termin.start_time };
        if (notiz) patch.notes = notiz;
        const { data: gespeichert, error } = await sb.from('prescription_sessions').update(patch)
          .eq('booking_id', id).in('id', geplant).eq('status', 'planned').select('id');
        if (error) throw error;
        for (const zeile of gespeichert || []) geschrieben.add(zeile.id);
        if ((gespeichert || []).length !== geplant.length) {
          const { data: aktuell, error: abgleichFehler } = await sb.from('prescription_sessions')
            .select('id').eq('booking_id', id).in('id', geplant).eq('status', 'done');
          if (abgleichFehler) throw abgleichFehler;
          if ((aktuell || []).length !== geplant.length) {
            await zuruecksetzen();
            return res.status(409).json({ error: KONFLIKT });
          }
        }
      }

      /** @type {{ status: string, fahrt_status?: string }} */
      const patch = { status: 'completed' };
      const fahrt = termin.hausbesuch && termin.fahrt_status === 'fahrt_arrived';
      if (fahrt) patch.fahrt_status = 'fahrt_return_pending';
      if (termin.status !== 'completed' || fahrt) {
        let update = terminScope(sb.from('bookings').update(patch))
          .eq('start_time', termin.start_time).eq('status', termin.status).eq('no_show', false);
        if (fahrt) update = update.eq('fahrt_status', 'fahrt_arrived');
        const { data: abgeschlossen, error } = await update.select('id').maybeSingle();
        if (error) throw error;
        if (abgeschlossen) return res.json({ prescriptionIds: idsFuerFortschritt(sitzungen) });
      }

      const { data: aktuell, error: abgleichFehler } = await terminScope(sb.from('bookings')
        .select('start_time,status,no_show,fahrt_status')).maybeSingle();
      if (abgleichFehler) throw abgleichFehler;
      const gueltigAbgeschlossen = Boolean(
        aktuell
        && !aktuell.no_show
        && aktuell.status === 'completed'
        && Date.parse(aktuell.start_time) === start
        && (!fahrt || ['fahrt_return_pending', 'fahrt_completed'].includes(aktuell.fahrt_status))
      );
      if (!gueltigAbgeschlossen) {
        await zuruecksetzen();
        return res.status(409).json({ error: KONFLIKT });
      }
      return res.json({ prescriptionIds: idsFuerFortschritt(sitzungen) });
    } catch (error) {
      const err = /** @type {any} */ (error);
      console.warn('[sitzungsabschluss]', err?.code || err?.name || 'FEHLER');
      return res.status(503).json({ error: 'Der Sitzungsabschluss konnte nicht bestätigt werden. Bitte erneut versuchen.' });
    }
  };
}

/** @param {any[]} sitzungen */
function idsFuerFortschritt(sitzungen) {
  return [...new Set(sitzungen.filter(s => !['billed', 'cancelled'].includes(s.prescriptions.status)).map(s => s.prescription_id))];
}
