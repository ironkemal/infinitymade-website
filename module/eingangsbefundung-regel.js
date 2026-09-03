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

  // ── Nagelzweig UI1/UI2 — hier gibt es die Eingangsbefundung nicht ─────────
  if (NAGEL_POSITIONEN.has(code)) {
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
