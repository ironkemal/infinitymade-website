// § 302-Abrechnung — Verworfene Nummern sichtbar machen (GoBD-Erklärbarkeit).
//
// ── Warum das eine eigene Datei ist ────────────────────────────────────────
//
// Die Funktion braucht keinen Router, keine Express-Middleware und keinen
// Supabase-Client im Modulrumpf — nur eine Datenbankverbindung als Argument.
// Sie hier auszulagern folgt demselben Prinzip wie `betriebsart.js`:
// `abrechnung.routes.js` instanziiert beim Modulimport den service-role-Client,
// der ohne gesetzte Umgebungsvariablen den Prozess hart beendet
// (`api-backend/server.js:166`). Ein Unit-Test darf diesen Riegel nicht aufweichen.
//
// ── Der fachliche Grund (gkv-302, 20.09.2026) ─────────────────────────────
//
// In allen drei Erzeugungswegen (`/abrechnung/create`, `/abrechnung/create-podologie`,
// `/abrechnung/korrektur`) zieht `vergebeNummern()` zuerst atomar die nächste
// Datenaustauschreferenz und Transfernummer aus `datenaustausch_zaehler` (0029).
// Schlägt danach `buildDtaFile()` fehl — z. B. weil der DMRZ-Preflight
// unvollständige oder widersprüchliche Angaben ablehnt —, ist die Nummer
// verbraucht und es entsteht eine Lücke.
//
// 1) Die Lücke selbst ist ERLAUBT: GKV-302 verlangt „fortlaufend", nicht
//    „lückenlos", und keine der drei Prüfstufen der Annahmestellen sucht nach
//    Lücken.
// 2) Die Reihenfolge Nummer-dann-Preflight bleibt ABSICHTLICH genau so:
//    Würde die Reihenfolge umgedreht, wären die Prüfregeln F:03001–F:03004
//    geblendet, da sie die vergebene `datennummer` selbst auf Gültigkeit testen.
// 3) GoBD fordert jedoch ERKLÄRBARKEIT: Lücken müssen im Nachhinein belegbar
//    sein („Wo ist die 94 geblieben?", dieselbe Begründung wie in `db/REGISTER.md`
//    bei `nummernkreise`).
// 4) Nicht-Blockierend: Schlägt das Schreiben dieser Protokollzeile fehl
//    (etwa weil Migration 0033 noch aussteht), darf das Antwortverhalten der
//    Route NICHT verändert werden. Ein Protokollversuch darf niemals einen
//    Fehler in einen anderen verwandeln.
// 5) PHI-Schutz (DSGVO): In `verwerfungsgrund` dürfen KEINE Patientendaten
//    (weder Namen noch Versichertennummern) abgelegt werden. Bei Preflight-
//    Fehlern werden ausschließlich die Regelcodes (`errors[].code`) und
//    die Fehleranzahl erfasst.

/**
 * Bereitet den Verwerfungsgrund PHI-frei auf.
 *
 * Preflight-Meldungen enthalten oft Pfade und Klartextdaten zu Patienten
 * (Name, KVNR). Diese dürfen unter keinen Umständen in der Abrechnungstabelle
 * protokolliert werden. Daher werden gezielt nur Regelcodes (z. B. F:03001,
 * PFLICHT_IK) extrahiert und Freitexte bereinigt.
 *
 * @param {Error|object|string} err
 * @returns {string}
 */
export function formatiereVerwerfungsgrund(err) {
  if (!err) return 'Unbekannter Fehler';

  // 1. Strukturierter Preflight-Fehler: Ausschließlich Regelcodes extrahieren
  if (err.preflight && Array.isArray(err.preflight.errors)) {
    const codes = [...new Set(err.preflight.errors.map(e => e?.code).filter(Boolean))];
    const count = err.preflight.errors.length;
    if (codes.length > 0) {
      return `Preflight [${codes.join(', ')}] (${count} Fehler)`.slice(0, 500);
    }
    return `Preflight-Fehler (${count})`.slice(0, 500);
  }

  // 2. Preflight-Fehlermeldung als zusammengesetzter String aus builder.js
  // (Format: "Preflight failed (N errors): [CODE] where: message; ...")
  //
  // ⚠️ Nur wenn die Meldung WIRKLICH von dort stammt. Ohne diese Bedingung
  // griff der Ausdruck unten auch auf gewoehnliche Builder-Fehler wie
  // `prescription[0].verordnung.verordnungsart required` zu, fand dort `[0]`
  // und schrieb „Preflight [0]" in die Datenbank — eine Zeile, die in sechs
  // Monaten eine Luecke FALSCH erklaert. In einem GoBD-Feld ist eine
  // irrefuehrende Begruendung schlimmer als gar keine.
  // Die Regelcodes haben immer die Form BUCHSTABE:FUENF_ZIFFERN (F:03001).
  const rawMsg = typeof err === 'string' ? err : (err.message || '');
  if (/^Preflight failed/.test(rawMsg)) {
    const codeMatches = rawMsg.match(/\[([A-Za-z]:\d{5})\]/g);
    if (codeMatches && codeMatches.length > 0) {
      const extractedCodes = [...new Set(codeMatches.map(c => c.slice(1, -1)))];
      return `Preflight [${extractedCodes.join(', ')}]`.slice(0, 500);
    }
    return 'Preflight-Fehler (Codes nicht lesbar)';
  }

  // 3. Fehlercode vorhanden (z. B. Postgres / Node.js-Fehlercode)
  const code = err.code ? String(err.code).trim() : '';

  // 4. Sonstiger Fehlertext. Hier bleibt ein Restrisiko, und es gehoert benannt:
  // eine unerwartete Laufzeitmeldung KANN einen Klartextnamen enthalten. Voll
  // maskieren laesst sich das nicht (ein Name sieht aus wie jedes andere Wort);
  // eine reine Typangabe waere zwar sicher, aber fuer die Frage „warum ist die
  // 94 verbrannt?" wertlos. Deshalb: bekannte Muster maskieren, hart kuerzen,
  // und die Begruendung hier stehen lassen statt sie zu verschweigen.
  // ⚠️ Wer kuenftig eine neue Fehlerquelle anschliesst, deren Meldung
  //    Patientendaten fuehren kann, maskiert sie VOR dem Aufruf.
  let bereinigt = rawMsg
    .replace(/\b[A-Z]\d{9}\b/gi, '[KVNR]')
    .replace(/\b\d{2}\.\d{2}\.\d{4}\b/g, '[DATUM]')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[DATUM]')
    .trim();

  if (code && bereinigt) {
    return `[${code}] ${bereinigt}`.slice(0, 200);
  }
  if (code) return `[${code}]`.slice(0, 200);
  if (bereinigt) return bereinigt.slice(0, 200);

  return 'Unbekannter Fehler';
}

/**
 * Hält einen verworfenen Abrechnungsversuch in `abrechnung` fest.
 *
 * @param {object} opts
 * @param {object} opts.db                    Supabase-Client
 * @param {string} opts.ownerId               Mandanten-ID (auth.users)
 * @param {string} opts.kostentraegerIk       IK des Kostenträgers
 * @param {string} [opts.sammelRechnungsnummer]
 * @param {number} [opts.datennummer]         UNB-Datenaustauschreferenz
 * @param {number} [opts.transfernummer]      Transfernummer (0..999)
 * @param {string} [opts.empfaengerIk]        IK der Datenannahmestelle
 * @param {Error|object|string} [opts.error]  Aufgetretener Fehler beim DTA-Bau
 * @returns {Promise<object|null>}
 */
// ⚠️ `= {}` ist kein Stil, sondern Teil der Zusage: ohne den Vorgabewert
// stuerzt schon das Destructuring eines parameterlosen Aufrufs ab — und zwar
// VOR dem try/catch unten, also genau an der Zusage „wirft nie" vorbei.
export async function verworfeneNummerFesthalten({
  db,
  ownerId,
  kostentraegerIk,
  sammelRechnungsnummer,
  datennummer,
  transfernummer,
  empfaengerIk,
  error,
} = {}) {
  try {
    if (!db || !ownerId || !kostentraegerIk) {
      console.warn(
        '[abrechnung/verworfen] Pflichtfelder fehlen (db, ownerId oder kostentraegerIk) — '
        + 'verworfene Nummer wird nicht protokolliert'
      );
      return null;
    }

    const verwerfungsgrund = formatiereVerwerfungsgrund(error);

    const zeile = {
      status: 'verworfen',
      owner_id: ownerId,
      kostentraeger_ik: kostentraegerIk,
      rechnungsnummer: sammelRechnungsnummer || null,
      datenaustauschreferenz: datennummer != null ? Number(datennummer) : null,
      transfernummer: transfernummer != null ? Number(transfernummer) : null,
      empfaenger_ik: empfaengerIk || null,
      verwerfungsgrund,
    };

    const res = await db.from('abrechnung').insert(zeile);
    if (res?.error) {
      console.warn(
        '[abrechnung/verworfen] Speichern der verworfenen Abrechnung in DB fehlgeschlagen '
        + '(Migration 0033 möglicherweise noch ausstehend):',
        res.error.message || res.error
      );
      return null;
    }

    return res?.data ?? true;
  } catch (err) {
    // Bewusst kein Re-Throw: Ein Fehler beim Protokollieren darf den eigentlichen
    // Fehler niemals überlagern oder die Route abbrechen.
    console.warn(
      '[abrechnung/verworfen] Unerwarteter Fehler beim Protokollieren der verworfenen Abrechnung:',
      err?.message || err
    );
    return null;
  }
}
