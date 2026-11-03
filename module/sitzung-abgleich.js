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

/**
 * Wie viele Termine braucht eine Verordnung? Bei Doppelbehandlung zählt ein
 * Termin zwei verordnete Einheiten (HeilM-RL §12 Abs. 8 S. 6, gkv-302 27.10.2026):
 * 6 Einheiten = 3 Termine. Ungerade Menge → der letzte Termin ist einfach.
 */
export function terminZiel(anzahlEinheiten, doppelbehandlung = false) {
  const n = Number.parseInt(anzahlEinheiten, 10);
  if (!Number.isFinite(n) || n <= 0) return anzahlEinheiten;
  return doppelbehandlung ? Math.ceil(n / 2) : n;
}

/**
 * Nur die neue Form { code, einheiten, … } meint mehrere Heilmittel. Altbestand
 * (Strings oder Objekte ohne `einheiten`) läuft über anzahl_einheiten — sonst
 * entstünden null Sitzungen und eine Kapazität von null.
 */
export function istMehrfachItems(items) {
  return Array.isArray(items) && items.some(it => it && typeof it === 'object' && it.einheiten != null);
}

/**
 * Gesamt-Terminziel einer Verordnung (bei mehreren Heilmittel-Items: Summe
 * der Terminziele je Item; sonst: terminZiel(anzahl_einheiten, doppelbehandlung)).
 *
 * @param {object} rx
 * @returns {number}
 */
export function terminZielToplam(rx) {
  if (!rx) return 0;
  if (istMehrfachItems(rx.heilmittel_items)) {
    let sum = 0;
    for (const it of rx.heilmittel_items) {
      const z = terminZiel(it?.einheiten, Boolean(it?.doppelbehandlung));
      const n = Number.parseInt(z, 10);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
    return sum;
  }
  const z = terminZiel(rx.anzahl_einheiten, Boolean(rx.doppelbehandlung));
  const n = Number.parseInt(z, 10);
  return (Number.isFinite(n) && n > 0) ? n : (Number.parseInt(rx.anzahl_einheiten, 10) || 0);
}

export async function gleicheSitzungenAb({ supabase, prescriptionId, anzahlEinheiten, status = null, heilmittelIndex = 0, doppelbehandlung = false, items = null }) {
  if (!supabase || !prescriptionId) return { ergaenzt: 0, fehler: null };
  if (status && ABGESCHLOSSEN.includes(status)) return { ergaenzt: 0, fehler: null };

  const { data: vorhandene, error: leseFehler } = await supabase
    .from('prescription_sessions')
    .select('session_number, status, heilmittel_index')
    .eq('prescription_id', prescriptionId);
  if (leseFehler) return { ergaenzt: 0, fehler: leseFehler.message };

  const benutzte = new Set((vorhandene || []).map(s => Number(s.session_number)).filter(n => Number.isFinite(n) && n > 0));
  let naechsteNummer = 1;
  function naechsteFreieNummer() {
    while (benutzte.has(naechsteNummer)) {
      naechsteNummer++;
    }
    benutzte.add(naechsteNummer);
    return naechsteNummer;
  }

  const zeilen = [];

  if (istMehrfachItems(items)) {
    const itemSlots = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const count = terminZiel(it?.einheiten, Boolean(it?.doppelbehandlung));
      if (Number.isFinite(count) && count > 0) {
        itemSlots.push({ index: i, count });
      }
    }

    function getSessionIndex(s) {
      if (s.heilmittel_index !== undefined && s.heilmittel_index !== null) return s.heilmittel_index;
      if (itemSlots.length > 0) {
        let offset = 0;
        for (const slot of itemSlots) {
          if (s.session_number <= offset + slot.count) return slot.index;
          offset += slot.count;
        }
        return itemSlots[itemSlots.length - 1].index;
      }
      return 0;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const ziel = terminZiel(it?.einheiten, Boolean(it?.doppelbehandlung));
      if (!Number.isFinite(ziel) || ziel <= 0) continue;

      const vorhandenFuerItem = (vorhandene || []).filter(s =>
        s.status !== 'cancelled' && getSessionIndex(s) === i
      ).length;

      const bedarf = Math.max(0, ziel - vorhandenFuerItem);
      for (let k = 0; k < bedarf; k++) {
        zeilen.push({
          prescription_id: prescriptionId,
          session_number: naechsteFreieNummer(),
          status: 'planned',
          heilmittel_index: i,
        });
      }
    }
  } else {
    const soll = terminZiel(anzahlEinheiten, doppelbehandlung);
    const fehlt = fehlendeSitzungsnummern(vorhandene, soll);
    for (const n of fehlt) {
      zeilen.push({
        prescription_id: prescriptionId,
        session_number: n,
        status: 'planned',
        heilmittel_index: heilmittelIndex,
      });
    }
  }

  if (!zeilen.length) return { ergaenzt: 0, fehler: null };

  const { error: schreibFehler } = await supabase
    .from('prescription_sessions')
    .upsert(zeilen, { onConflict: 'prescription_id,session_number', ignoreDuplicates: true });
  if (schreibFehler) return { ergaenzt: 0, fehler: schreibFehler.message };

  return { ergaenzt: zeilen.length, fehler: null };
}
