/**
 * eingangsbefundung-regel.js — wann darf die Eingangsbefundung (78040) auf den
 * Behandlungstag?
 *
 * Warum eine eigene Datei: `podologie-abrechnung.js` laesst sich in node nicht
 * importieren, der Modulrumpf ruft `document.addEventListener`. Eine Regel, an
 * der Geld haengt, will aber geprueft werden — also liegt sie hier, neben ihrem
 * Test, genau wie `standort-zuschnitt.js`. Die Abfrage selbst (Supabase) bleibt
 * in `podologie-abrechnung.js`; hier steht nur die Entscheidung.
 *
 * Die Regel (gkv-302, 31.08.2026 — Beleg in `Handbücher/SPEC-RULES.md`):
 * Anlage 1a Leistungsbeschreibung i.d.F. 17.06.2024 zum Vertrag nach § 125
 * Abs. 1 SGB V Podologie, Teil 1 Nr. 2 und Teil 2 Ziffer 4.1:
 *
 *   „Bei Patienten die ab dem 01.11.2023 erstmalig eine podologische Leistung
 *    bei einem zugelassenen Leistungserbringer in Anspruch nehmen, ist ohne
 *    gesonderte Verordnung … EINMALIG eine podologische Eingangsbefundung …
 *    durchzuführen. Die podologische Eingangsbefundung erfolgt VOR DER ERSTEN
 *    ABGABE einer podologischen Leistung und KANN AM GLEICHEN TAG WIE DIE
 *    podologische Leistung durchgeführt werden."
 *
 * Daraus die drei Saetze, die dieses Modul umsetzt:
 *  1. 78040 ist einmalig — nicht je Verordnung, nicht je Serie, nicht je Jahr.
 *  2. 78040 gehoert VOR die erste Behandlung. Steht schon eine Behandlung an
 *     einem FRUEHEREN Tag, ist der Anspruch verbraucht; nachholen geht nicht.
 *  3. Am SELBEN Tag ist sie neben 78010/78020 ausdruecklich erlaubt — deshalb
 *     wird streng frueher verglichen, nicht `<=`.
 *
 * Bis zum 31.08.2026 pruefte der Code nur Satz 1. Satz 2 fehlte: wer im dritten
 * Termin einer laufenden Serie dachte „die haben wir ja noch nie abgerechnet",
 * bekam die 78040 durch — und von der Kasse als Absetzung zurueck.
 *
 * ⚠️ Zwei Dinge kann dieses Modul NICHT wissen, beide in SPEC-RULES vermerkt:
 *  • Patienten, die schon VOR dem 01.11.2023 podologisch behandelt wurden,
 *    erwerben den Anspruch nie. Bei einer frisch migrierten Praxis steht diese
 *    Historie in keiner Datenbank — das braucht eine quittierte Anamneseangabe.
 *  • Ob der Vertrag „einmal je Praxis" oder „einmal im Leben" meint, ist aus
 *    dem Wortlaut nicht entscheidbar. Der Aufrufer fragt praxisweit ab, die
 *    vorsichtigere der beiden Lesarten.
 */

/** HPNR der podologischen Eingangsbefundung. */
export const POD_EINGANGSBEFUNDUNG = '78040';

/** HPNR der podologischen Befundung — an jedem ANDEREN Behandlungstag. */
export const POD_BEFUNDPAUSCHALE = '78030';

/**
 * Darf am `datum` noch 78040 abgerechnet werden?
 *
 * @param {Array<{behandlungsdatum:string, hpnr_codes:?Array<string>}>} behandlungen
 *        alle `podologie_behandlungen` des Patienten — ueber ALLE seine
 *        Verordnungen hinweg, auch abgeschlossene. Reihenfolge egal, es wird
 *        hier sortiert.
 * @param {string} datum  geplanter Behandlungstag, `YYYY-MM-DD`
 * @returns {{erlaubt:boolean, grund:string, schonAm:?string, ersteAm:?string}}
 *   `grund`: `''` wenn erlaubt, sonst `'schon_abgerechnet'` oder
 *   `'nicht_erste_behandlung'`. `schonAm` = Tag der bereits abgerechneten
 *   78040, `ersteAm` = erster Behandlungstag des Patienten (beide fuer die
 *   Meldung, damit sie sagt WAS der Fall ist statt nur „geht nicht").
 */
export function darf78040(behandlungen, datum) {
  const behs = (behandlungen || [])
    .filter(b => b && b.behandlungsdatum)
    .slice()
    .sort((a, b) => String(a.behandlungsdatum).localeCompare(String(b.behandlungsdatum)));

  if (!behs.length) return { erlaubt: true, grund: '', schonAm: null, ersteAm: null };

  const ersteAm = behs[0].behandlungsdatum;

  const schon = behs.find(b => (b.hpnr_codes || []).includes(POD_EINGANGSBEFUNDUNG));
  if (schon) {
    return { erlaubt: false, grund: 'schon_abgerechnet', schonAm: schon.behandlungsdatum, ersteAm };
  }

  // Streng frueher — am selben Tag ist 78040 neben der Behandlung erlaubt.
  if (behs.some(b => String(b.behandlungsdatum) < String(datum))) {
    return { erlaubt: false, grund: 'nicht_erste_behandlung', schonAm: null, ersteAm };
  }

  return { erlaubt: true, grund: '', schonAm: null, ersteAm };
}

// ─────────────────────────────────────────────────────────────────────────────
// Welche Befundung gehoert zu einer Leistung? (Termin anlegen, 03.09.2026)
//
// Anlass: Beta-1 beschreibt den Ablauf am Telefon so — Patient ruft an, es
// werden Vor-, Nachname und Telefonnummer aufgenommen, dann die Leistung
// gewaehlt; bei einem NEUEN Patienten soll die Befundung von selbst als zweite
// Zeile darunter erscheinen. „Aber beim Nagel gibt es das nicht."
//
// Er hat recht, und der Grund steht im Vertrag: die Eingangsbefundung 78040
// existiert NUR in den Diagnosegruppen DF/NF/QF. Im Nagelzweig (UI1/UI2) gibt
// es sie nicht — dort laeuft eine voellig andere Leistung mit einer anderen
// Bezugsgroesse (78110 klein / 78100 gross). Wer die beiden verwechselt,
// bekommt eine Absetzung.
//
// Die drei Bezugsgroessen, die hier nicht vermischt werden duerfen
// (Herleitung mit Fundstellen in `Handbücher/SPEC-RULES.md`):
//
//   78040 Eingangsbefundung   — einmalig bei ERSTINANSPRUCHNAHME von Podologie
//                               (ab 01.11.2023). Nicht je Verordnung, nicht je
//                               Jahr. Nur DF/NF/QF.
//   78030 Befundung           — im Vorfeld JEDER Behandlung. Nur DF/NF/QF, und
//                               nie am selben Tag wie 78040.
//   78110/78100 Erstbefundung — einmalig zu Beginn einer NAGELSPANGEN-SERIE,
//                               und eine Serie gehoert zu EINEM Nagel und kann
//                               mehrere Verordnungen umfassen. 78100 „gross"
//                               zusaetzlich max. 1x je Patient und Kalenderjahr.
//                               Nur UI1/UI2.
//
// Deshalb schlaegt dieses Modul im Nagelzweig BEWUSST nichts automatisch vor.
// „Neuer Patient" ist dort schlicht das falsche Merkmal: massgeblich sind Nagel
// und Serie, und beides weiss die Terminmaske am Telefon nicht. Statt einer
// falschen Automatik gibt es einen Hinweis — der Podologe entscheidet.
// ─────────────────────────────────────────────────────────────────────────────

/** Erstbefundung Nagelspange, kleine Form — der Regelfall im Nagelzweig. */
export const POD_ERSTBEFUNDUNG_KLEIN = '78110';

/** Erstbefundung Nagelspange, grosse Form — max. 1x je Patient im Kalenderjahr. */
export const POD_ERSTBEFUNDUNG_GROSS = '78100';

/** Behandlungspositionen der Diagnosegruppen DF/NF/QF. */
const DFNFQF_BEHANDLUNG = new Set(['78010', '78020']);

/** Alles, was zum Nagelzweig UI1/UI2 gehoert — auch die abgeloesten Spangen. */
const NAGEL_POSITIONEN = new Set([
  '78100', '78110',                             // Erstbefundung gross/klein
  '78610', '78620',                             // Nagelspangenbehandlung + Aufschlag
  '78510', '78520', '78530',                    // Kontrolle · Abschluss · Bericht UI2
  '78210', '78220', '78230', '78300', '78400',  // vor dem 01.10.2025 verordnet
]);

/** Positionen, die selbst schon eine Befundung SIND — die bekommen keine zweite. */
const IST_BEFUNDUNG = new Set(['78030', '78040', '78100', '78110']);

/** Zuschlaege ohne eigenen Zweig — ein Hausbesuch allein ist keine Behandlung. */
const ZUSCHLAEGE = new Set(['79933', '79934']);

/**
 * Positionsnummern aus der Zeit vor den echten HPNR. In `services` einer Beta-
 * Praxis stehen sie teils heute noch; `migratePodologieLegacyServices()` in
 * dashboard.js zieht sie nach, aber nur wenn der Sektor podologie ist UND der
 * Cache geladen war. Wer hier durchrutscht, bekaeme sonst wortlos keinen
 * Vorschlag — und niemand wuesste warum. Spiegel von GKV_PODO_LEGACY_MAP und
 * GKV_PODO_LEGACY_PRIVAT (dashboard.js).
 */
const LEGACY_POSITIONEN = new Set([
  'P01', 'P02', 'P-HB',                    // -> 78020 / 78010 / 79933
  'P03a', 'P03b', 'P03c', 'P04',           // waren privat, kein GKV-Gegenstueck
]);

/**
 * Welche Befundung gehoert unter die gewaehlte Leistung?
 *
 * Reine Entscheidung, kein DOM und keine Abfrage — die Historie wird
 * hereingereicht, damit die Regel testbar bleibt (wie `darf78040`).
 *
 * @param {object}   opt
 * @param {string}   opt.hpnr           HPNR der gewaehlten Leistung
 * @param {Array}    [opt.behandlungen] alle `podologie_behandlungen` des
 *        Patienten, ueber ALLE Verordnungen; leer = neuer Patient
 * @param {string}   opt.datum          geplanter Behandlungstag `YYYY-MM-DD`
 * @param {boolean}  [opt.selbstzahler] Privat/ohne Verordnung → keine GKV-Position
 * @param {?boolean} [opt.podologieVor2023] war der Patient schon VOR dem
 *        01.11.2023 in podologischer Behandlung? `true` = ja (kein Anspruch),
 *        `false` = nein, `null`/undefined = nicht beantwortet
 * @param {?Array<string>} [opt.diagnosegruppen] Diagnosegruppen der Katalog-
 *        zeile (`heilmittel_katalog.diagnosegruppen`), falls der Aufrufer sie
 *        ohnehin geladen hat. Sie kann nur BREMSEN, nie oeffnen: enthaelt sie
 *        UI1/UI2, gilt der Nagelzweig auch fuer eine Position, die die feste
 *        Liste unten noch nicht kennt. Einen Vorschlag ausloesen kann sie
 *        nicht — dafuer bleibt die Positivliste massgeblich, weil ein zu
 *        Unrecht vorgeschlagener Code Geld kostet.
 * @returns {{code:?string, automatisch:boolean, grund:string, hinweis:string,
 *           rueckfrage:?string}}
 *   `code` = vorzuschlagende HPNR oder `null`. `automatisch` = darf ohne
 *   Rueckfrage gesetzt werden. `rueckfrage` benennt die offene Frage, die vor
 *   dem Abrechnen beantwortet sein muss.
 */
export function befundungFuerLeistung({
  hpnr,
  behandlungen = [],
  datum,
  selbstzahler = false,
  podologieVor2023 = null,
  diagnosegruppen = null,
} = {}) {
  const nichts = (grund, hinweis = '') => ({
    code: null, automatisch: false, grund, hinweis, rueckfrage: null,
  });

  const code = String(hpnr || '').trim();
  if (!code) return nichts('keine_leistung');

  // Ohne Kasse gibt es keine Position — Selbstzahler rechnen frei ab.
  if (selbstzahler) return nichts('selbstzahler');

  // Die Leistung ist selbst eine Befundung: nicht noch eine daruntersetzen.
  if (IST_BEFUNDUNG.has(code)) return nichts('ist_schon_befundung');

  // Ein Hausbesuch traegt keinen Zweig; die Befundung haengt an der Behandlung,
  // die mitgebucht wird, nicht am Wegegeld.
  if (ZUSCHLAEGE.has(code)) return nichts('zuschlag_ohne_zweig');

  // Alte Positionsnummer im `services`-Satz: nicht schweigen, sondern sagen,
  // dass die Leistung noch keine gueltige HPNR traegt.
  if (LEGACY_POSITIONEN.has(code)) {
    return nichts(
      'legacy_positionsnummer',
      `Die Leistung traegt noch die alte Positionsnummer „${code}" statt einer `
      + 'Heilmittelpositionsnummer. Solange das so ist, kann keine Befundung '
      + 'vorgeschlagen werden — bitte die Leistung in den Einstellungen auf die '
      + 'GKV-Position umstellen.',
    );
  }

  // ── Nagelzweig UI1/UI2 — hier gibt es die Eingangsbefundung nicht ─────────
  // Die Katalogzeile hat Vorrang vor der festen Liste: kommt eine neue
  // UI1/UI2-Position dazu, schweigt die Regel sofort richtig, statt sie fuer
  // unbekannt zu halten.
  const dgs = (diagnosegruppen || []).map(d => String(d || '').trim().toUpperCase());
  const istNagel = dgs.includes('UI1') || dgs.includes('UI2') || NAGEL_POSITIONEN.has(code);
  if (istNagel) {
    return nichts(
      'nagelzweig',
      'Im Nagelzweig (UI1/UI2) gibt es keine Eingangsbefundung (78040). '
      + 'Die Erstbefundung (78110 klein, 78100 gross) gehoert einmalig an den '
      + 'Anfang einer Nagelspangen-Serie — je behandeltem Nagel, ueber mehrere '
      + 'Verordnungen hinweg. Ob diese Serie hier beginnt, entscheidet die '
      + 'Praxis; 78100 zusaetzlich hoechstens einmal je Patient im Kalenderjahr.',
    );
  }

  // ── DF/NF/QF — Behandlung 78010/78020 ────────────────────────────────────
  if (!DFNFQF_BEHANDLUNG.has(code)) return nichts('kein_podologie_zweig');

  // Wer vor dem 01.11.2023 schon podologisch behandelt wurde, erwirbt den
  // Anspruch auf 78040 nie — dann bleibt es bei der Befundung 78030.
  if (podologieVor2023 === true) {
    return {
      code: POD_BEFUNDPAUSCHALE, automatisch: true, grund: 'kein_anspruch_altbestand',
      hinweis: 'Befundung (78030) — die Eingangsbefundung entfaellt, weil der '
             + 'Patient bereits vor dem 01.11.2023 podologisch behandelt wurde.',
      rueckfrage: null,
    };
  }

  const lage = darf78040(behandlungen, datum);

  if (!lage.erlaubt) {
    return {
      code: POD_BEFUNDPAUSCHALE, automatisch: true,
      grund: lage.grund === 'schon_abgerechnet' ? 'eingangsbefundung_verbraucht'
                                                : 'nicht_erste_behandlung',
      hinweis: lage.grund === 'schon_abgerechnet'
        ? `Befundung (78030) — die Eingangsbefundung wurde am ${lage.schonAm} bereits abgerechnet.`
        : `Befundung (78030) — die erste Behandlung war am ${lage.ersteAm}, die `
          + 'Eingangsbefundung gehoert davor und kann nicht nachgeholt werden.',
      rueckfrage: null,
    };
  }

  // 78040 steht zu. Ob der Patient VOR dem 01.11.2023 schon einmal beim
  // Podologen war, steht in keiner Datenbank — bei einer frisch migrierten
  // Praxis erst recht nicht. Also vorschlagen, aber die Frage sichtbar
  // mitgeben, statt sie stillschweigend mit „nein" zu beantworten.
  const offen = podologieVor2023 == null;
  return {
    code: POD_EINGANGSBEFUNDUNG,
    automatisch: !offen,
    grund: 'erstinanspruchnahme',
    hinweis: 'Eingangsbefundung (78040) — einmalig bei Erstinanspruchnahme, am '
           + 'selben Tag neben der Behandlung erlaubt. Die Befundung (78030) '
           + 'entfaellt an diesem Tag.',
    rueckfrage: offen
      ? 'War der Patient schon vor dem 01.11.2023 in podologischer Behandlung? '
        + 'Dann entfaellt die Eingangsbefundung.'
      : null,
  };
}

/**
 * Darf am `datum` noch die „Erstbefundung gross" (78100) abgerechnet werden?
 *
 * Eigene Regel, nicht mit 78040 verwandt — nur die Verwechslungsgefahr ist
 * gross. 78040 haengt an der Erstinanspruchnahme, 78100 am Kalenderjahr:
 *
 *   Anlage 1c Leistungsbeschreibung i.d.F. 01.07.2025, Teil 1 Nr. 5 I.1:
 *   „Die Erbringung der ‚Erstbefundung gross' ist auf eine EINMALIGE ABGABE
 *    JE PATIENT IM KALENDERJAHR beschraenkt."
 *
 * Bis zum 03.09.2026 stand dieser Satz an drei Stellen als Hinweistext und an
 * keiner als Pruefung — der Podologe konnte 78100 im selben Jahr ein zweites
 * Mal ankreuzen, und die Kasse setzte es ab.
 *
 * ⚠️ Die zweite Grenze aus § 3b lit. a — Erstbefundung einmalig zu Beginn
 * einer Nagelspangen-Serie, je Nagel und ueber Verordnungen hinweg — steht
 * NICHT hier, sondern in `darfErstbefundungNagel()` weiter unten. Sie war bis
 * zum 04.09.2026 offen, weil die Behandlung nicht wusste, zu welcher Serie sie
 * gehoert; seither traegt die Verordnung den Nagel (`prescriptions.nagel`).
 * Beide Grenzen gelten nebeneinander und werden getrennt geprueft: diese hier
 * nur fuer 78100, jene fuer 78100 und 78110.
 *
 * @param {Array<{behandlungsdatum:string, hpnr_codes:?Array<string>}>} behandlungen
 *        alle `podologie_behandlungen` des Patienten, ueber alle Verordnungen
 * @param {string} datum  geplanter Behandlungstag, `YYYY-MM-DD`
 * @returns {{erlaubt:boolean, grund:string, schonAm:?string}}
 *   `grund`: `''` wenn erlaubt, sonst `'kalenderjahr_verbraucht'`.
 */
export function darf78100(behandlungen, datum) {
  const jahr = String(datum || '').slice(0, 4);
  if (!/^\d{4}$/.test(jahr)) return { erlaubt: true, grund: '', schonAm: null };

  const schon = (behandlungen || [])
    .filter(b => b && b.behandlungsdatum)
    .filter(b => String(b.behandlungsdatum).slice(0, 4) === jahr)
    .filter(b => (b.hpnr_codes || []).includes(POD_ERSTBEFUNDUNG_GROSS))
    .sort((a, b) => String(a.behandlungsdatum).localeCompare(String(b.behandlungsdatum)))[0];

  return schon
    ? { erlaubt: false, grund: 'kalenderjahr_verbraucht', schonAm: schon.behandlungsdatum }
    : { erlaubt: true, grund: '', schonAm: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Die Nagelspangen-Serie (Ops-Aufgabe 245, 04.09.2026)
//
// § 3b lit. a) der Aenderungsvereinbarung vom 16.06.2025 (gilt fuer ab dem
// 01.10.2025 verordnete Nagelspangenbehandlungen):
//
//   „Die Leistung nach Anlage 1c Teil 2 Ziffer I.1 (Erstbefundung) kann
//    EINMALIG ZU BEGINN EINER NAGELSPANGENBEHANDLUNGSSERIE erfolgen. Eine
//    Behandlungsserie bezieht sich stets auf EINEN zu behandelnden Nagel und
//    KANN MEHRERE VERORDNUNGEN UMFASSEN."
//
// Zwei Saetze, zwei Folgen:
//  1. Die Sperre laeuft NICHT je Verordnung. Eine Folgeverordnung fuer
//     denselben Nagel setzt die Erstbefundung nicht zurueck.
//  2. Zusammengehalten wird die Serie allein vom NAGEL. Deshalb steht der
//     Nagel seit dem 04.09.2026 als `prescriptions.nagel` an der Verordnung
//     und nicht mehr als Freitext an der einzelnen Behandlung — § 3b Satz 3-4
//     sagt ausdruecklich, dass ein Zehennagel ein eigener Verordnungsfall ist
//     und eine Verordnung sich auf EINEN Nagel bezieht.
//
// Wo die Serie endet, sagt der Vertrag nicht als Datum, sondern als Leistung:
// 78520 „Behandlungsabschluss / Entfernung der Nagelkorrekturspange". Danach
// beginnt am selben Nagel eine neue Serie und damit eine neue Erstbefundung.
// Solange kein 78520 steht, laeuft die Serie weiter — auch ueber Jahre.
//
// ⚠️ Nicht verwechseln mit `darf78100`: das ist die ZWEITE, unabhaengige
// Grenze (78100 „gross" hoechstens einmal je Patient und Kalenderjahr). Beide
// gelten nebeneinander; die Serie sperrt auch die kleine 78110, das
// Kalenderjahr sperrt nur die grosse 78100.
// ─────────────────────────────────────────────────────────────────────────────

/** HPNR des Behandlungsabschlusses — sie beendet die Serie an diesem Nagel. */
export const POD_NAGEL_ABSCHLUSS = '78520';

/** Beide Formen der Erstbefundung. Die Serienregel kennt keinen Unterschied. */
export const POD_ERSTBEFUNDUNGEN = [POD_ERSTBEFUNDUNG_GROSS, POD_ERSTBEFUNDUNG_KLEIN];

/**
 * Die zehn zulaessigen Nagelwerte, Schreibweise aus § 3b Satz 5:
 * „unter Verwendung des Kuerzels ‚U' fuer Unguis, der Ziffern 1 bis 5 und der
 * Seite … (z. B. U1 links, U2 rechts)".
 *
 * ⚠️ SPIEGEL des CHECK `prescriptions_nagel_check`. Wer hier etwas hinzufuegt,
 * ohne die Datenbank zu aendern, bekommt beim Speichern einen 400er.
 */
export const NAGEL_WERTE = Object.freeze([
  'U1 links', 'U2 links', 'U3 links', 'U4 links', 'U5 links',
  'U1 rechts', 'U2 rechts', 'U3 rechts', 'U4 rechts', 'U5 rechts',
]);

/** Klartext fuer die Oberflaeche — „U1 links" → „Grosszehe links (U1)". */
const ZEHENNAMEN = ['', 'Großzehe', '2. Zehe', '3. Zehe', '4. Zehe', 'Kleinzehe'];

/**
 * Lesbare Form eines Nagelwerts. Unbekannte Eingabe kommt unveraendert
 * zurueck — im Zweifel lieber der Rohwert als ein leeres Feld.
 *
 * @param {?string} nagel  z. B. `'U1 links'`
 * @returns {string}       z. B. `'Großzehe links (U1)'`
 */
export function nagelLabel(nagel) {
  const roh = String(nagel || '').trim();
  const m = roh.match(/^U([1-5])\s+(links|rechts)$/);
  if (!m) return roh;
  return `${ZEHENNAMEN[Number(m[1])]} ${m[2]} (U${m[1]})`;
}

/**
 * Darf am `datum` fuer diesen Nagel eine Erstbefundung (78110/78100) auf die
 * Rechnung?
 *
 * Reine Entscheidung, keine Abfrage: der Aufrufer reicht die Behandlungen
 * DIESES Nagels herein — also alle Zeilen aus `podologie_behandlungen`, deren
 * Verordnung denselben `prescriptions.nagel` traegt, ueber alle Verordnungen
 * des Patienten hinweg.
 *
 * Die laufende Serie wird von hinten aufgezaeumt: der letzte Abschluss (78520)
 * VOR dem geplanten Tag ist die untere Grenze, der naechste Abschluss ab dem
 * geplanten Tag die obere. Steht in diesem Fenster schon eine Erstbefundung,
 * ist sie verbraucht — egal an welcher Verordnung sie haengt.
 *
 * Das Fenster hat eine obere Grenze, damit ein NACHTRAG nicht faelschlich
 * durchgeht: wer eine Behandlung vom letzten Monat nachtraegt, deren Serie
 * inzwischen abgeschlossen ist, gehoert trotzdem in die alte Serie.
 *
 * Ohne bekannten Nagel wird NICHT gesperrt. Eine Sperre, die raet, kostet eine
 * zu Recht erbrachte Leistung; die Luecke faellt spaeter als Absetzung auf.
 * Beides ist teuer — aber nur die falsche Sperre trifft den Podologen sofort
 * und ohne dass er etwas dagegen tun koennte.
 *
 * @param {Array<{behandlungsdatum:string, hpnr_codes:?Array<string>}>} behandlungen
 *        Behandlungen DIESES Nagels, Reihenfolge egal
 * @param {?string} nagel  Nagel der Verordnung (`'U1 links'` …) oder leer
 * @param {string}  datum  geplanter Behandlungstag, `YYYY-MM-DD`
 * @returns {{erlaubt:boolean, grund:string, schonAm:?string, schonCode:?string,
 *           serieSeit:?string}}
 *   `grund`: `''` erlaubt · `'nagel_unbekannt'` erlaubt, aber ungeprueft ·
 *   `'serie_hat_erstbefundung'` gesperrt. `serieSeit` = Tag des Abschlusses,
 *   mit dem die laufende Serie beginnt (`null` = erste Serie an diesem Nagel).
 */
export function darfErstbefundungNagel(behandlungen, nagel, datum) {
  const frei = (grund = '') => ({
    erlaubt: true, grund, schonAm: null, schonCode: null, serieSeit: null,
  });

  if (!String(nagel || '').trim()) return frei('nagel_unbekannt');
  const tag = String(datum || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tag)) return frei('kein_datum');

  const behs = (behandlungen || [])
    .filter(b => b && b.behandlungsdatum)
    .map(b => ({ am: String(b.behandlungsdatum), codes: b.hpnr_codes || [] }))
    .sort((a, b) => a.am.localeCompare(b.am));
  if (!behs.length) return frei();

  const abschluesse = behs.filter(b => b.codes.includes(POD_NAGEL_ABSCHLUSS));

  // Untere Grenze: der letzte Abschluss VOR dem geplanten Tag. Ein Abschluss
  // am selben Tag beendet die Serie erst nach der Behandlung dieses Tages —
  // deshalb streng frueher.
  const davor = abschluesse.filter(b => b.am < tag);
  const serieSeit = davor.length ? davor[davor.length - 1].am : null;

  // Obere Grenze: der erste Abschluss AB dem geplanten Tag.
  const danach = abschluesse.find(b => b.am >= tag);
  const serieBis = danach ? danach.am : null;

  const schon = behs.find(b =>
    (serieSeit === null || b.am > serieSeit)
    && (serieBis === null || b.am <= serieBis)
    && b.codes.some(c => POD_ERSTBEFUNDUNGEN.includes(c)));

  if (!schon) return { ...frei(), serieSeit };

  return {
    erlaubt: false,
    grund: 'serie_hat_erstbefundung',
    schonAm: schon.am,
    schonCode: schon.codes.find(c => POD_ERSTBEFUNDUNGEN.includes(c)) || null,
    serieSeit,
  };
}
