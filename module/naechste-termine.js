/**
 * naechste-termine.js — nächster kommender Termin je Patient für eine ganze Liste.
 *
 * V9.14 (physio-Bildabnahme 17.11.2026, Empfang): die Patientenliste im neuen Design zeigt der
 * Inhaberin „Nächster Termin …“. Ein Abruf je 100 Patienten statt einer Abfrage pro Zeile.
 * Regel wie `ladeKommendeTermineDesPatienten` (termin-patient-bezug.js): ab jetzt − 1 h, nur
 * `confirmed`/`pending`, nur `owner_id`. Altbestand ohne `lead_id` fehlt bewusst (fonksiyon-ustasi).
 * Eigene Datei statt Ergänzung in termin-patient-bezug.js, weil jene von fünf Modulen mit fester
 * `?v=` geladen wird — eine Änderung hätte die Datei unter zwei URLs in die Seite gebracht.
 */

/**
 * @param {any} sb
 * @param {{ ownerId: string, leadIds: Array<string|null|undefined> }} p
 * @returns {Promise<{naechste: Map<string, string>, error: object|null}>}
 */
export async function ladeNaechsteTermineJePatient(sb, { ownerId, leadIds }) {
  /** @type {Map<string, string>} */
  const naechste = new Map();
  const ids = [...new Set((leadIds || []).filter(Boolean))];
  if (!ownerId || !ids.length) return { naechste, error: null };
  const abISO = new Date(Date.now() - 3600000).toISOString();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await sb.from('bookings')
      .select('lead_id,start_time')
      .eq('owner_id', ownerId)
      .gte('start_time', abISO)
      .in('status', ['confirmed', 'pending'])
      .in('lead_id', ids.slice(i, i + 100))
      .order('start_time', { ascending: true })
      .limit(1000);
    if (error) return { naechste, error };
    for (const b of data || []) if (b.lead_id && !naechste.has(b.lead_id)) naechste.set(b.lead_id, b.start_time);
  }
  return { naechste, error: null };
}
