/**
 * sitzung-abgleich.js — die Sitzungszeilen einer Verordnung auf die verordnete
 * Zahl der Einheiten nachziehen.
 *
 * Warum es das gibt
 * ─────────────────
 * `prescription_sessions` hält je verordneter Einheit eine Zeile. Angelegt
 * werden diese Zeilen aber an ZWEI Stellen, mit zwei verschiedenen Regeln:
 *
 *   • `saveRezept()`          — eine Zeile je `anzahl_einheiten`, nur beim
 *                               Anlegen der Verordnung.
 *   • `linkBookingsToPrescriptionSessions()` — eine Zeile je *Termin*, wenn
 *                               eine Serie gebucht wird.
 *
 * Läuft die zweite zuerst (oder die erste gar nicht, weil die Verordnung über
 * einen anderen Weg entstanden ist), bekommt die Verordnung genau so viele
 * Zeilen, wie zufällig Termine gebucht wurden — und niemand gleicht das je
 * wieder ab.
 *
 * Am 16.08.2026 in den Echtdaten gefunden: eine Verordnung über **18**
 * Einheiten mit **13** Sitzungszeilen, alle 13 in einem Rutsch fünf Minuten
 * nach dem Anlegen der Verordnung entstanden — die Handschrift des
 * Serien-Buchungspfads.
 *
 * Der sichtbare Schaden war der harmlose Teil: im Seitenbereich fehlten fünf
 * Einheiten, die man nicht auf den Kalender ziehen konnte. Der teure Teil ist
 * unsichtbar — nach der Regel in `sitzungsfortschritt.js` gilt eine Verordnung
 * erst als fertig, wenn die verordneten Einheiten auch erbracht sind. Fehlen
 * die Zeilen, wird sie nie `completed`, nie `abrechnung_status = 'bereit'`,
 * taucht nie in der §302-Liste auf und wird **nie abgerechnet — ohne
 * Fehlermeldung.** Dasselbe Muster wie am 12.08.2026 (siehe dort).
 *
 * Die Regel hier
 * ──────────────
 *     Sollzahl = `prescriptions.anzahl_einheiten`
 *     Fehlende Nummern aus 1…Soll werden ergänzt.
 *     Es wird NIE etwas gelöscht.
 *     Abgeschlossene Verordnungen werden NICHT angefasst.
 *
 * Die letzte Zeile ist keine Vorsicht, sondern Notwehr: im Bestand steckt eine
 * bereits abgerechnete Verordnung ohne Sitzungszeilen. Würde der Abgleich ihr
 * offene Sitzungen nachlegen, stünde eine abgeschlossene Abrechnung plötzlich
 * wieder als „in Behandlung" da. Die Ausschlussliste ist dieselbe, mit der die
 * App überall aktive Verordnungen abgrenzt (`completed`, `billed`,
 * `cancelled`).
 *
 * Nicht löschen ist Absicht. Eine Zeile oberhalb der Sollzahl kann ein echter,
 * bereits stattgefundener Termin sein (Nachbehandlung, Korrektur der
 * Einheitenzahl nach unten). Eine zu viel gezeigte Sitzung kostet einen Blick;
 * eine gelöschte Sitzung mit Termin kostet die Abrechnung.
 *
 * Das Ergänzen läuft über `upsert` auf den vorhandenen Eindeutigkeitsschlüssel
 * `(prescription_id, session_number)` — öffnen zwei Mitarbeiter dieselbe
 * Verordnung gleichzeitig, gewinnt der erste und der zweite läuft ins Leere,
 * statt dass ein Duplikat entsteht oder ein Fehler hochblubbert.
 */

/**
 * Welche Sitzungsnummern fehlen? Rein rechnerisch, ohne Datenbank — damit
 * prüfbar.
 *
 * @param {Array<{session_number:number}>} vorhandene
 * @param {number} anzahlEinheiten
 * @returns {number[]} fehlende Nummern, aufsteigend
 */
export function fehlendeSitzungsnummern(vorhandene, anzahlEinheiten) {
  const soll = Number(anzahlEinheiten);
  if (!Number.isFinite(soll) || soll < 1) return [];
  const da = new Set((vorhandene || []).map(s => Number(s.session_number)));
  const fehlt = [];
  for (let n = 1; n <= soll; n++) if (!da.has(n)) fehlt.push(n);
  return fehlt;
}

/**
 * Gleicht die Sitzungszeilen einer Verordnung an `anzahl_einheiten` an.
 *
 * Bewusst fehlertolerant: schlägt das Lesen oder Schreiben fehl, wird das
 * gemeldet, aber nichts geworfen. Der Abgleich hängt an einer Anzeige — er
 * darf den Seitenbereich niemals verhindern.
 *
 * @returns {Promise<{ergaenzt:number, fehler:string|null}>}
 */
export const ABGESCHLOSSEN = ['completed', 'billed', 'cancelled'];

export async function gleicheSitzungenAb({ supabase, prescriptionId, anzahlEinheiten, status = null, heilmittelIndex = 0 }) {
  if (!supabase || !prescriptionId) return { ergaenzt: 0, fehler: null };
  if (status && ABGESCHLOSSEN.includes(status)) return { ergaenzt: 0, fehler: null };

  const { data: vorhandene, error: leseFehler } = await supabase
    .from('prescription_sessions')
    .select('session_number')
    .eq('prescription_id', prescriptionId);
  if (leseFehler) return { ergaenzt: 0, fehler: leseFehler.message };

  const fehlt = fehlendeSitzungsnummern(vorhandene, anzahlEinheiten);
  if (!fehlt.length) return { ergaenzt: 0, fehler: null };

  const zeilen = fehlt.map(n => ({
    prescription_id: prescriptionId,
    session_number: n,
    status: 'planned',
    heilmittel_index: heilmittelIndex,
  }));

  const { error: schreibFehler } = await supabase
    .from('prescription_sessions')
    .upsert(zeilen, { onConflict: 'prescription_id,session_number', ignoreDuplicates: true });
  if (schreibFehler) return { ergaenzt: 0, fehler: schreibFehler.message };

  return { ergaenzt: fehlt.length, fehler: null };
}
