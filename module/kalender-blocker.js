/**
 * kalender-blocker.js — Zeit blocken, ohne Patient.
 *
 * Warum es das gibt
 * ─────────────────
 * Es gab keinen Weg, im Kalender einfach Zeit zu belegen. „Pause" existierte
 * nur in den Arbeitszeiten (also für jede Woche gleich), Abwesenheit nur über
 * `time_offs` — und das ist tageweise. Eine Stunde am Dienstag für etwas
 * Privates freizuhalten ging schlicht nicht. Rückmeldung aus der Beta:
 * „Schnelloptionen für Blocker (z. B. Privat, Pause)".
 *
 * Warum interne Leistungen und keine neue Tabelle
 * ──────────────────────────────────────────────
 * Ein Blocker ist ein Termin ohne Patient. Legt man ihn als normale Zeile in
 * `bookings` an, bekommt man zwei Dinge geschenkt:
 *
 *   • Die Doppelbuchungssperre der Datenbank greift automatisch
 *     (`no_overlapping_bookings`, EXCLUDE-GIST über user_id + Zeitraum). Über
 *     eine Pause lässt sich kein Patient buchen, ohne dass wir eine Zeile
 *     Prüfcode schreiben.
 *   • Alle drei Ansichten zeichnen ihn ohne Zutun.
 *
 * `services.is_internal` markiert die zugehörige Leistung, damit sie nicht in
 * den Auswahllisten für Patiententermine auftaucht. Das Muster stammt aus
 * `ensureBlankoBonusServices()` in `dashboard.js` — dort werden die
 * Blanko-Zuschläge genauso je Inhaber bei Bedarf angelegt.
 *
 * ⚠️ OFFEN, BEVOR DAS SCHARF GESCHALTET WIRD
 * ──────────────────────────────────────────
 * Die Therapeuten-Statistik im Backend zählt Termine aus `bookings` **ohne**
 * `is_internal`-Filter (`api-backend/billing/api/statistik.routes.js`, Abfrage
 * 8). Eine Pause würde dort als geleistete Sitzung mitzählen.
 *
 * Aktuell fällt das nicht auf, weil dieselbe Abfrage `employee_id` selektiert —
 * eine Spalte, die `bookings` gar nicht hat (es ist `user_id`). Die Abfrage
 * läuft ins Leere, die Therapeutenliste ist dauerhaft leer. Wer diesen Fehler
 * behebt, muss im selben Zug den `is_internal`-Filter setzen, sonst erscheinen
 * Pausen als erbrachte Leistungen.
 */

/**
 * Die Blocker. Grautöne, damit ein zugeklebter Tag nicht nach Umsatz aussieht.
 */
export const BLOCKER_DEFS = [
  { schluessel: 'pause', titel: 'Pause', code: 'BLOCK_PAUSE', farbe: '#94a3b8', symbol: '⏸' },
  { schluessel: 'privat', titel: 'Privat', code: 'BLOCK_PRIV', farbe: '#64748b', symbol: '🔒' },
  { schluessel: 'fortbildung', titel: 'Fortbildung', code: 'BLOCK_FORTB', farbe: '#78716c', symbol: '🎓' },
];

/**
 * Urlaub steht bewusst NICHT in dieser Liste. Dafür gibt es „Abwesenheit
 * eintragen" (`time_offs`) — das ist tageweise und blockt den ganzen Kalender,
 * nicht einzelne Stunden. Zwei Wege für dieselbe Sache wären der nächste
 * Fehlerbericht: einer davon wäre immer der falsche, und niemand wüsste, welcher.
 */

/** Erkennt einen Blocker an der Leistung — für Anzeige und Prüfungen. */
export function istBlockerLeistung(leistung) {
  if (!leistung) return false;
  return !!leistung.is_internal && BLOCKER_DEFS.some(d => d.code === leistung.code);
}

/**
 * Legt die internen Leistungen bei Bedarf an und gibt sie zurück.
 *
 * Gesucht wird über `code`, nicht über den Titel: der Titel ist Anzeige und
 * könnte umbenannt werden, der Code ist der Schlüssel.
 *
 * @returns {Promise<Map<string, object>>} schluessel -> service
 */
export async function ensureBlockerServices(supabase, ownerId, userId) {
  const gefunden = new Map();
  if (!supabase || !ownerId) return gefunden;

  const codes = BLOCKER_DEFS.map(d => d.code);
  const { data: vorhanden } = await supabase
    .from('services')
    .select('id,title,code,color,is_internal,duration_minutes')
    .eq('owner_id', ownerId)
    .in('code', codes);

  const nachCode = new Map((vorhanden || []).map(s => [s.code, s]));

  for (const def of BLOCKER_DEFS) {
    const treffer = nachCode.get(def.code);
    if (treffer) {
      // Einmal geradeziehen, falls die Zeile von Hand angefasst wurde: eine
      // Blocker-Leistung ohne is_internal stünde in der Patientenauswahl.
      if (!treffer.is_internal) {
        await supabase.from('services').update({ is_internal: true }).eq('id', treffer.id);
        treffer.is_internal = true;
      }
      gefunden.set(def.schluessel, treffer);
      continue;
    }
    const { data: neu, error } = await supabase.from('services').insert({
      owner_id: ownerId,
      user_id: userId || ownerId,
      title: def.titel,
      code: def.code,
      color: def.farbe,
      duration_minutes: 30,
      price: '0',
      is_internal: true,
      description: 'Automatisch angelegt: blockt Zeit im Kalender, keine Leistung am Patienten.',
    }).select('id,title,code,color,is_internal,duration_minutes').maybeSingle();
    if (error) { console.warn('[blocker] anlegen fehlgeschlagen', error); continue; }
    if (neu) gefunden.set(def.schluessel, neu);
  }

  return gefunden;
}
