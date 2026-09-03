/**
 * kostentraeger-spalte.js — weiss die Anwendung schon, ob es die Spalte
 * `services.kostentraeger_typ` gibt?
 *
 * Warum es das gibt
 * ─────────────────
 * Die Spalte kommt per Migration
 * (`supabase/migrations/20260902090000_services_kostentraeger_typ.sql`).
 * Solange sie fehlt, darf das Auswahlfeld "Abrechnungsart" nicht erscheinen
 * und `kostentraeger_typ` nicht mitgeschickt werden — PostgREST wiese sonst
 * das ganze INSERT/UPDATE ab, und das Speichern einer Leistung waere kaputt.
 *
 * Vorher stand die Pruefung als Einzeiler in `dashboard.js`:
 *
 *     servicesCache.some(s => Object.prototype.hasOwnProperty.call(s, 'kostentraeger_typ'))
 *
 * Das war falsch fuer den einen Fall, in dem es zaehlt: eine Praxis mit **null**
 * Leistungen. `[].some()` ist `false`, also blieb das Feld verborgen — auch nach
 * der Migration. Ausgerechnet beim Anlegen der allerersten Leistung liess sich
 * die Abrechnungsart nicht setzen.
 *
 * Deshalb zwei Quellen statt einer:
 *   1. Die geladenen Zeilen. Kostet nichts, `select('*')` liefert jede Spalte
 *      mit — auch wenn ihr Wert NULL ist. Gibt es Zeilen, sind sie der Beweis.
 *   2. Nur wenn es gar keine Zeile gibt: eine einzige gezielte Abfrage.
 *      Fehlt die Spalte, antwortet PostgREST mit 42703.
 *
 * ⚠️ DREI FALLEN, alle drei schon einmal hineingetappt
 * ────────────────────────────────────────────────────
 * (a) **Nicht jeder Fehler heisst "Spalte fehlt".** supabase-js wirft bei
 *     Netzfehlern nicht, sondern liefert ebenfalls `{ error }` — im vendorten
 *     Client steht `FetchError` dreimal, `42703` kein einziges Mal. Ein
 *     Offline-Moment waehrend genau dieser Sonde wuerde bei `bekannt = !error`
 *     fuer die ganze Sitzung "Spalte fehlt" einbrennen, und `loadServices()`
 *     laeuft danach zwar oft, fragt aber nie wieder nach. Deshalb wird nur eine
 *     EINDEUTIGE Antwort gemerkt; alles andere bleibt offen und wird beim
 *     naechsten Mal neu versucht.
 *
 * (b) **Zwei Ladevorgaenge koennen sich ueberholen.** `loadServices()` wird an
 *     zwei Stellen ohne `await` gestartet (`dashboard.js:1154`, `:17369`). Ohne
 *     Absicherung feuern beide eine Sonde, und die spaeter zurueckkehrende
 *     ueberschreibt bedingungslos — auch ein bereits aus Zeilen abgeleitetes
 *     `true`. Deshalb: eine gemeinsame laufende Promise, die ihr Ergebnis noch
 *     im selben synchronen Block auswertet und freigibt. Ein `.finally()` haette
 *     dafuer nicht gereicht — sein Rueckruf laeuft VOR den Awaitern, und in
 *     diesem Spalt kann ein dritter Aufruf eine zweite Sonde starten.
 *
 * (c) **`services` ist oeffentlich lesbar** (Policy "Public read services", fuer
 *     die Buchungsseite). Eine Sonde ohne Mandantenfilter bekaeme die Zeile
 *     einer fremden Praxis zurueck. Uns interessiert nur, ob die Abfrage
 *     ueberhaupt zulaessig ist — deshalb `.limit(0)`: PostgREST prueft die
 *     Spaltenliste und antwortet mit einer leeren Liste.
 *
 *     ⛔ NICHT `{ head: true }` benutzen, so naheliegend es aussieht. Gegen ein
 *        echtes PostgREST gemessen (03.09.2026, Docker):
 *
 *          HEAD     + fehlende Spalte -> 400, error = { message: '' }  KEIN code
 *          GET      + fehlende Spalte -> 400, error.code = '42703'     ✓
 *          limit(0) + Spalte da       -> 200, 0 Zeilen                 ✓
 *
 *        HEAD-Antworten haben keinen Rumpf, also kann der Client den Fehlercode
 *        nicht lesen — er steht nur in einem `Proxy-Status`-Header, den
 *        supabase-js nicht auswertet. Mit `head: true` liefe jede Sonde in
 *        "unklar", nichts wuerde je gemerkt, und das Feld bliebe bei einer
 *        leeren Praxis fuer immer verborgen: genau der Fehler, den diese Datei
 *        beheben soll. Zwei Tests halten die Aufrufform jetzt fest.
 *
 * BEFRISTET. Diese Datei darf verschwinden, sobald die Migration gelaufen ist —
 * es gibt nur eine Produktionsdatenbank, also unmittelbar danach. Dann wird
 * `kostentraegerSpalteDa()` durch `true` ersetzt und der Rest geloescht.
 *
 * ⚠️ Nicht verwechseln mit dem Rueckfall in `leistungen-liste.js`
 * (`kostentraegerTyp()`). Der bleibt dauerhaft: `NULL` ist auch nach der
 * Migration ein gueltiger Zustand — interne Leistungen bleiben NULL, das
 * Onboarding legt Leistungen ohne Kostentraegertyp an, und wer das Feld nie
 * anfasst, behaelt NULL. Wer den Rueckfall loescht, laesst all diese
 * Leistungen aus der Uebersicht verschwinden.
 */

// null = noch nicht festgestellt. Bewusst modulweit und nicht pro Aufruf:
// die Antwort aendert sich innerhalb einer Sitzung nicht.
let bekannt = null;

// Die gerade laufende Sonde, damit zwei gleichzeitige Ladevorgaenge sich eine
// teilen statt zwei zu feuern (Falle b).
let laufendeSonde = null;

/**
 * Was die geladenen Zeilen ueber die Spalte verraten.
 * @returns {boolean|null} null, wenn es keine Zeile gibt — dann sagen sie nichts.
 */
export function spalteAusZeilen(zeilen) {
  if (!Array.isArray(zeilen) || !zeilen.length) return null;
  return zeilen.some(z => z && Object.prototype.hasOwnProperty.call(z, 'kostentraeger_typ'));
}

/**
 * Eine gezielte Abfrage gegen das Schema.
 * @returns {Promise<boolean|null>} null heisst "keine Aussage moeglich" —
 *   NICHT "Spalte fehlt". Der Unterschied ist der ganze Punkt (Falle a).
 */
async function sondiere(client) {
  const { data, error, status } = await client.from('services')
    .select('kostentraeger_typ')
    .limit(0);

  // `!error` allein reicht NICHT als Beweis. Am vendorten Client gemessen
  // (03.09.2026): eine 404-Antwort mit leerem Rumpf — wie sie ein Proxy oder
  // eine Fehlerseite liefert — kommt als `error: null, status: 204` an. Das
  // hiesse faelschlich "Spalte da", wuerde gemerkt, und ab da schickte jedes
  // Speichern `kostentraeger_typ` mit. PostgREST wiese es ab: genau der
  // Schaden, den diese Datei verhindern soll, nur andersherum.
  // Ein echter Erfolg ist 200 MIT Liste (bei limit(0) eine leere).
  if (!error) return (status === 200 && Array.isArray(data)) ? true : null;
  if (error.code === '42703') return false;
  return null;
}

/**
 * Stellt einmal je Sitzung fest, ob es die Spalte gibt, und merkt sich das.
 *
 * @param {Array}  zeilen  die gerade geladenen Leistungen (servicesCache)
 * @param {object} client  Supabase-Client — nur noetig, wenn `zeilen` leer ist
 * @returns {Promise<boolean>}
 */
export async function ermittleKostentraegerSpalte(zeilen, client) {
  if (bekannt !== null) return bekannt;

  const ausZeilen = spalteAusZeilen(zeilen);
  if (ausZeilen !== null) {
    bekannt = ausZeilen;
    return bekannt;
  }

  // Keine einzige Leistung angelegt. Nur hier kostet die Feststellung eine
  // Abfrage — und nur ein einziges Mal, auch bei gleichzeitigen Aufrufen.
  if (!client) return false;
  if (!laufendeSonde) {
    laufendeSonde = (async () => {
      let antwort = null;
      try { antwort = await sondiere(client); } catch (_) { /* Netzfehler: unklar */ }

      // Waehrend die Sonde lief, kann ein anderer Ladevorgang die Antwort schon
      // aus echten Zeilen gehabt haben. Die ist besser als unsere.
      if (bekannt === null && antwort !== null) bekannt = antwort;

      // Synchron im selben Block wie das Ergebnis freigeben. Stuende das in
      // einem `.finally()`, liefe der Rueckruf VOR den Awaitern — dann koennte
      // ein dritter Aufruf in genau diesem Spalt eine zweite Sonde starten.
      laufendeSonde = null;
      return bekannt === true;
    })();
  }
  return laufendeSonde;
}

/**
 * Die Antwort, synchron — fuer Stellen, die kein `await` vertragen
 * (Formular aufbauen, Speichern-Payload schnueren).
 * Vor der ersten Feststellung und bei unklarer Lage ist sie `false`, also die
 * sichere Seite: schlimmstenfalls fehlt eine Auswahl, statt dass das Speichern
 * abgewiesen wird.
 */
export function kostentraegerSpalteDa() {
  return bekannt === true;
}

/** Nur fuer Tests — setzt das Gemerkte zurueck. */
export function _spaltenwissenZuruecksetzen() {
  bekannt = null;
  laufendeSonde = null;
}
