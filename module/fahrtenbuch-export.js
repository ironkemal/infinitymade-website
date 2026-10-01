/**
 * fahrtenbuch-export.js — Fahrtenbuch-Exporte für das Finanzamt.
 *
 * Seit 01.10.2026 (legal-de, BMF 18.11.2009): nachträgliche Änderungen an
 * abgeschlossenen Fahrten und jede Löschung müssen in der Finanzamt-Ausgabe
 * sichtbar sein. Das Fahrtenbuch-CSV bekommt deshalb die Spalte „geändert",
 * die Einzelheiten liefert das Änderungsprotokoll aus `fahrten_aenderungen`
 * (append-only, nur per Trigger beschrieben, Migration 0052).
 *
 * Die CSV-Bildung selbst ist rein und steht in fahrtenbuch-regeln.js; hier nur
 * das Laden aus Supabase und der Download. Aus dashboard.js ausgelagert, damit
 * die Datei nicht wächst (Konsey 2026-08-13).
 */
import {
  fahrtenbuchCsv, aenderungsprotokollCsv, patientenverzeichnisCsv,
  csvHerunterladen, PATIENTENVERZEICHNIS_HINWEIS
} from './fahrtenbuch-regeln.js?v=20261001e';

const SEITE = 1000; // PostgREST liefert höchstens 1000 Zeilen je Anfrage

/** Anzeigename eines profiles-Datensatzes (gleiche Regel wie die Fahrtenbuch-Liste). */
export function nutzerName(u) {
  if (!u) return '';
  return [u.owner_first_name, u.owner_last_name].filter(Boolean).join(' ') || u.email || String(u.id || '').slice(0, 8);
}

/** Lädt userId → Anzeigename für die angegebenen IDs. Fehlende IDs fehlen in der Map. */
export async function ladeNutzerMap(supabase, ids) {
  const liste = Array.from(new Set((ids || []).filter(Boolean)));
  const map = {};
  if (!liste.length) return map;
  const { data, error } = await supabase.from('profiles')
    .select('id,owner_first_name,owner_last_name,email').in('id', liste);
  if (error) throw error;
  (data || []).forEach(u => { map[u.id] = nutzerName(u); });
  return map;
}

/**
 * Alle sichtbaren Protokollzeilen des Inhabers (RLS: Inhaber sieht alle,
 * Fahrer nur die eigenen). Wirft bei Fehler — ein still leeres Protokoll
 * würde „nicht geändert" behaupten.
 */
export async function ladeFahrtenAenderungen(supabase, ownerId) {
  const alle = [];
  for (let von = 0; ; von += SEITE) {
    const { data, error } = await supabase.from('fahrten_aenderungen')
      .select('id,fahrt_id,fahrer_id,op,alt,neu,geaendert_von,geaendert_am')
      .eq('owner_id', ownerId)
      .order('id', { ascending: true })
      .range(von, von + SEITE - 1);
    if (error) throw error;
    alle.push(...(data || []));
    if (!data || data.length < SEITE) return alle;
  }
}

/** Filter der Fahrtenliste (gleiche Grenzen wie loadFbFahrten). */
function imFilter(a, { von, bis, fahrer }) {
  const start = a.alt?.fahrt_started_at ? new Date(a.alt.fahrt_started_at).getTime() : null;
  if (von && (start === null || start < new Date(von + 'T00:00:00Z').getTime())) return false;
  if (bis && (start === null || start > new Date(bis + 'T23:59:59Z').getTime())) return false;
  if (fahrer && a.fahrer_id !== fahrer) return false;
  return true;
}

function heute() {
  return new Date().toISOString().substring(0, 10);
}

export async function exportFahrtenbuchCsv({ supabase, ownerId, rows, toast }) {
  if (!rows?.length) { toast('Keine Daten zum Exportieren.', 'error'); return; }
  const aenderungen = await ladeFahrtenAenderungen(supabase, ownerId);
  csvHerunterladen(fahrtenbuchCsv(rows, aenderungen), `fahrtenbuch_${heute()}.csv`);
}

export async function exportAenderungsprotokollCsv({ supabase, ownerId, rows, filter, toast }) {
  const aenderungen = (await ladeFahrtenAenderungen(supabase, ownerId)).filter(a => imFilter(a, filter || {}));
  const namen = {};
  const referenzen = {};
  (rows || []).forEach(r => {
    if (r.user_id && r._therapist) namen[r.user_id] = r._therapist;
    if (r.id && r.booking_id) referenzen[r.id] = r.booking_id;
  });
  const fehlend = aenderungen
    .flatMap(a => [a.geaendert_von, a.fahrer_id, a.alt?.user_id, a.neu?.user_id])
    .filter(id => id && !namen[id]);
  Object.assign(namen, await ladeNutzerMap(supabase, fehlend));
  csvHerunterladen(aenderungsprotokollCsv(aenderungen, { namen, referenzen }), `fahrtenbuch_aenderungsprotokoll_${heute()}.csv`);
  if (!aenderungen.length) toast('Im gewählten Zeitraum wurden keine Fahrten nachträglich geändert oder gelöscht.');
}

export function exportPatientenverzeichnisCsv({ rows, toast }) {
  if (!rows?.length) { toast('Keine Daten zum Exportieren.', 'error'); return; }
  csvHerunterladen(patientenverzeichnisCsv(rows), `patientenverzeichnis_${heute()}.csv`);
  toast(PATIENTENVERZEICHNIS_HINWEIS);
}
