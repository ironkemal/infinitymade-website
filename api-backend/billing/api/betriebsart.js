// § 302-Echtbetrieb, Schritt 1.7 — welche Betriebsart gilt fuer DIESE Datei?
//
// ── Warum das eine eigene Datei ist ────────────────────────────────────────
//
// Die Aufloesung braucht keinen Router, keine Umgebungsvariablen und keinen
// Supabase-Client im Modulrumpf — nur eine Datenbankverbindung als Argument.
// Sie hier zu fuehren hat einen handfesten Grund: `abrechnung.routes.js` baut
// beim Laden des Moduls den service-role-Client, und wenn `SUPABASE_URL` oder
// `SUPABASE_SERVICE_ROLE_KEY` fehlen, soll der Prozess **laut sterben**
// (server.js:166 `process.exit(1)`). Wuerde ein Test diese Route importieren,
// muesste dieser Riegel aufgeweicht werden — und ein Riegel, der fuer einen
// Test aufgeweicht wird, ist in der Nacht, in der er zaehlt, nicht mehr da.
//
// ── Der fachliche Grund (gkv-302, 20.09.2026) ─────────────────────────────
//
// Anlage 1 TP5 V21 Kap. 2 (1)(2), Kap. 3 (1) + Kap. 8, Anhang 2 zur Anlage 1
// Kap. 9 § 1/§ 5/§ 6: Erprobung und Zulassung zum Echtverfahren laufen
// zwischen ABSENDER und EMPFAENGER. Ein einheitliches Flag je Praxis ist in
// beide Richtungen still falsch:
//   • zu frueh `echt` → Echtdatei an eine Datenannahmestelle OHNE Zulassung
//   • zu spaet `echt` → Testdatei an eine Datenannahmestelle MIT Zulassung;
//     die "loest keine Zahlungen aus". Das Geld bleibt aus, und es kommt
//     keine Fehlermeldung — der teuerste Fehler ist hier der leise.
//
// Deshalb: die Ausnahme in `betriebsart_empfaenger` (Migration 0031) hat
// Vorrang vor dem Vorgabewert in `terapeut_zertifikat.betriebsart` (0028).
// Die Betriebsart kommt aus der Datenbank und NICHT aus einer
// Umgebungsvariablen (onprem O-117): im SaaS wuerde eine Variable alle
// Mandanten gleichzeitig umstellen, und in der Kundenbox koennte sie niemand
// aendern.

export const BETRIEBSARTEN = new Set(['test', 'erprobung', 'echt']);

/** Vorgabewert aus `terapeut_zertifikat` (Migration 0028). Im Zweifel 'test'. */
export function betriebsartAus(cert) {
  const b = String(cert?.betriebsart || '').trim();
  return BETRIEBSARTEN.has(b) ? b : 'test';
}

/**
 * Betriebsart fuer das Paar (Inhaber × Datenannahmestelle).
 *
 * @param {object}  opts
 * @param {string}  opts.ownerId       Mandant
 * @param {string}  opts.empfaengerIk  IK der Datenannahmestelle DIESER Datei
 * @param {object}  opts.cert          Zeile aus `terapeut_zertifikat` (Vorgabewert)
 * @param {object}  opts.db            Supabase-Client — Pflicht, bewusst kein
 *                                     Vorgabewert: ein stillschweigend fehlender
 *                                     Client wuerde die Ausnahme ueberspringen.
 * @returns {Promise<'test'|'erprobung'|'echt'>}
 * @throws  {Error} `status` 422 (Echtbetrieb ohne nachgewiesene Zulassung)
 *                  oder 500 (Datenbankfehler)
 */
export async function ladeBetriebsart({ ownerId, empfaengerIk, cert, db }) {
  // Kein stilles Ueberspringen bei unvollstaendigen Argumenten. Faehrt die
  // Funktion hier einfach mit dem Vorgabewert weiter, entsteht genau der
  // Fehler, gegen den sie gebaut ist: eine Praxis hat fuer DIESE
  // Annahmestelle `echt` eingestellt, ein Aufrufer vergisst `empfaengerIk`,
  // und es geht eine Testdatei raus, die keine Zahlung ausloest — ohne
  // Fehlermeldung, von aussen nicht zu sehen. Lieber laut abbrechen.
  // (Alle drei Erzeugungswege koennen hier nicht leer sein: `vergebeNummern()`
  //  lief vorher mit derselben IK und wirft bereits in der Datenbank.)
  if (!db || !ownerId || !empfaengerIk) {
    const e = new Error(
      'ladeBetriebsart: db, ownerId und empfaengerIk sind Pflicht — '
      + 'ohne sie liesse sich die Betriebsart nur raten, und ein Fehlgriff '
      + 'erzeugt entweder eine Echtdatei ohne Zulassung oder eine Testdatei, '
      + 'die keine Zahlung ausloest.'
    );
    e.status = 500;
    throw e;
  }

  let zeile = null;

  {
    const { data, error } = await db
      .from('betriebsart_empfaenger')
      .select('betriebsart, zulassung_referenz, zulassung_datum')
      .eq('owner_id', ownerId)
      .eq('empfaenger_ik', empfaengerIk)
      .maybeSingle();

    if (error) {
      const codeOrMsg = String(error.code || error.message || '');
      // Migration 0031 ist eventuell noch nicht ueberall eingespielt
      // (42P01 = undefined_table, 42703 = undefined_column). Dann gilt der
      // bisherige Vorgabewert — das ist genau das Verhalten von vorher.
      if (/relation|column|does not exist|42P01|42703/i.test(codeOrMsg)) {
        console.warn(
          `[abrechnung/ladeBetriebsart] Tabelle betriebsart_empfaenger fehlt noch (Migration 0031 ausstehend) — `
          + `Rückfall auf Vorgabewert aus Zertifikat für Datenannahmestelle ${empfaengerIk}`
        );
      } else {
        // Jeder andere Datenbankfehler ist ein harter Abbruch. Ein stiller
        // Rueckfall auf 'test' erzeugte eine Datei, die keine Zahlung
        // ausloest — und niemand bemerkt es, weil auch keine Ablehnung kommt.
        const e = new Error(
          `Fehler beim Lesen der Betriebsart für Datenannahmestelle ${empfaengerIk}: ${error.message}`
        );
        e.status = 500;
        throw e;
      }
    } else {
      zeile = data;
    }
  }

  let gewaehlt;
  let zulassungReferenz;
  let zulassungDatum;

  if (zeile && BETRIEBSARTEN.has(String(zeile.betriebsart || '').trim())) {
    gewaehlt = String(zeile.betriebsart).trim();
    zulassungReferenz = zeile.zulassung_referenz;
    zulassungDatum = zeile.zulassung_datum;
  } else {
    gewaehlt = betriebsartAus(cert);
    zulassungReferenz = cert?.zulassung_referenz;
    zulassungDatum = cert?.zulassung_datum;
  }

  // Derselbe Riegel wie der CHECK in 0028/0031 — hier aber an der Stelle, an
  // der ihn ein Mensch liest. Erteilt wird die Zulassung von der KRANKENKASSE,
  // nicht von der Datenannahmestelle.
  if (gewaehlt === 'echt') {
    const refOk = Boolean(zulassungReferenz && String(zulassungReferenz).trim().length > 0);
    const datOk = Boolean(zulassungDatum && String(zulassungDatum).trim().length > 0);
    if (!refOk || !datOk) {
      const dasLabel = empfaengerIk ? `(IK ${empfaengerIk}) ` : '';
      const e = new Error(
        `Für die Datenannahmestelle ${dasLabel}ist der Echtbetrieb gewählt, `
        + `es fehlt jedoch das Aktenzeichen und/oder das Datum der schriftlichen Zulassung zum Echtverfahren. `
        + `Die Zulassung zum Echtverfahren wird von der Krankenkasse erteilt (nicht von der Datenannahmestelle). `
        + `Bitte unter Einstellungen → Abrechnung die erforderlichen Zulassungsdaten hinterlegen.`
      );
      e.status = 422;
      throw e;
    }
  }

  return gewaehlt;
}
