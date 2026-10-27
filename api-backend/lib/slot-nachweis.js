/**
 * B08a: Nachweis aus genau den Reads des beobachteten Slot-Aufrufs.
 * Keine Kontrollabfragen, keine Logs/Token/Datensätze im Ergebnis, kein globaler Zustand.
 * Erstverwendung: optionaler achter Parameter von getAvailableSlots in server.js.
 * Dies ist kein Auslastungsnenner: vergangene Tage bleiben ohne Rohbasis Unknown.
 */
export function createSlotNachweis() {
  const gruende = new Set();
  let abgeschlossen = false;
  let reads = 0;
  return {
    unbekannt(grund) { gruende.add(grund); },
    async lese(quelle, query, { liste = false, optional = false } = {}) {
      reads++;
      try {
        const ergebnis = await query;
        if (!ergebnis || ergebnis.error) gruende.add(`DB_${quelle}`);
        else if (liste) {
          if (!Array.isArray(ergebnis.data) || !Number.isSafeInteger(ergebnis.count)
            || ergebnis.count < 0 || ergebnis.count !== ergebnis.data.length) {
            gruende.add(`UNVOLLSTAENDIG_${quelle}`);
          }
        } else if ((!optional && !ergebnis.data) || (ergebnis.data !== null
          && (typeof ergebnis.data !== 'object' || Array.isArray(ergebnis.data)))) {
          gruende.add(`DB_${quelle}`);
        }
        return ergebnis;
      } catch (err) {
        gruende.add(`DB_${quelle}`);
        throw err;
      }
    },
    googleAntwort(antwort) {
      const kalender = antwort?.data?.calendars?.primary;
      if ((antwort?.data?.errors != null && (!Array.isArray(antwort.data.errors) || antwort.data.errors.length > 0))
        || !kalender || (kalender.errors != null && (!Array.isArray(kalender.errors) || kalender.errors.length > 0))
        || !Array.isArray(kalender.busy) || kalender.busy.some(b =>
          !Number.isFinite(Date.parse(b?.start)) || !Number.isFinite(Date.parse(b?.end))
          || Date.parse(b.end) <= Date.parse(b.start))) {
        gruende.add('GOOGLE_ANTWORT_UNBEKANNT');
      }
    },
    abschluss() { abgeschlossen = true; },
    ergebnis() {
      if (!abgeschlossen || reads === 0) gruende.add('ENGINE_NICHT_NACHGEWIESEN');
      return { vollstaendig: abgeschlossen && reads > 0 && gruende.size === 0, gruende: [...gruende] };
    }
  };
}

/** Injizierbarer B08-Adapter. Nur dieses Ergebnis darf als Vollständigkeitsbeleg dienen. */
export async function beobachteSlots(engine, argumente) {
  const nachweis = createSlotNachweis();
  let antwort;
  try {
    antwort = await engine(...argumente.slice(0, 7), ...Array(Math.max(0, 7 - argumente.length)).fill(undefined), nachweis);
    if (!antwort || !Array.isArray(antwort.slots)) nachweis.unbekannt('ENGINE_ANTWORT_UNBEKANNT');
  } catch {
    nachweis.unbekannt('ENGINE_FEHLER');
  }
  const beleg = nachweis.ergebnis();
  return { slots: beleg.vollstaendig ? antwort.slots : [],
    ...(antwort?.reason ? { reason: antwort.reason } : {}), ...beleg };
}
