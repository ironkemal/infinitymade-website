/**
 * behandlungsbeginn.js — `prescriptions.behandlungsbeginn` aus den dokumentierten Behandlungen ableiten.
 *
 * Warum es das gibt (19.09.2026, E2E-Lauf)
 * ───────────────────────────────────────
 * Wer in der Podologie eine Behandlung dokumentierte, schrieb nur eine Zeile in
 * `podologie_behandlungen` — `prescriptions.behandlungsbeginn` blieb NULL. Zwei
 * Folgen, beide falsch:
 *
 *   • Die Behandlungen-Liste zeigte „Behandlungsfrist abgelaufen (28-Tage-Regel)"
 *     an einer Verordnung, deren erste Behandlung längst im Zeitfenster lag.
 *   • Jede weitere Behandlung nach dem 28. Tag löste den Dialog „Datum nach
 *     Beginn spätestens" aus — obwohl die Frist nur für den BEGINN gilt
 *     (HeilM-RL § 15), und der war gemacht.
 *
 * Der Beginn ist das Datum der ERSTEN dokumentierten Behandlung, nicht der
 * zuletzt gespeicherten — wer nachträglich eine frühere erfasst, verschiebt ihn
 * nach vorn. Deshalb wird nach jedem Speichern das Minimum gelesen statt das
 * gerade gespeicherte Datum zu setzen.
 */

/**
 * @param {object} sb            Supabase-Client
 * @param {string} verordnungId  prescriptions.id
 * @param {string|null} aktuell  bisher bekannter Beginn (YYYY-MM-DD) oder null
 * @param {string} [tabelle]     Standard `prescriptions`
 * @returns {Promise<{ok:boolean, geaendert:boolean, beginn:string|null, fehler?:string}>}
 */
export async function leiteBehandlungsbeginnAb(sb, verordnungId, aktuell = null, tabelle = 'prescriptions') {
  if (!sb || !verordnungId) return { ok: true, geaendert: false, beginn: aktuell };

  const { data, error } = await sb.from('podologie_behandlungen')
    .select('behandlungsdatum')
    .eq('verordnung_id', verordnungId)
    .order('behandlungsdatum', { ascending: true })
    .limit(1);
  if (error) return { ok: false, geaendert: false, beginn: aktuell, fehler: error.message };

  const erste = data?.[0]?.behandlungsdatum || null;
  if (!erste || erste === aktuell) return { ok: true, geaendert: false, beginn: aktuell || erste };

  const { error: e2 } = await sb.from(tabelle).update({ behandlungsbeginn: erste }).eq('id', verordnungId);
  // Ein gesperrter Datensatz (eingereicht/abgerechnet) darf die Dokumentation
  // nicht scheitern lassen — die Behandlung ist da schon gespeichert.
  if (e2) return { ok: false, geaendert: false, beginn: aktuell, fehler: e2.message };
  return { ok: true, geaendert: true, beginn: erste };
}
