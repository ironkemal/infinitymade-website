// DATEV-Export (EXTF Buchungsstapel) für den Steuerberater — Datenteil.
//
// Herkunft: Kemal 22.10.2026 (Interessenten-Anfrage „Schnittstellen, insbesondere
// DATEV"). Exportziel DATEV EXTF, nicht Elster (compliance/LEGAL_DECISIONS.md
// 2026-09-17). onprem O-215: nur Datei, keine Außenverbindung.
//
// Welche Geldbewegungen — und warum genau diese zwei Quellen (db-ustasi 22.10.2026):
//   - `belegliste` ist seit Ops #271 das Belegjournal JEDER Patientenzahlung
//     (bar, Karte, Überweisung …): Zuzahlung, Privat-/Selbstzahlerrechnung,
//     Ausfallhonorar, Verkauf, Storno (negativ). `rechnung_zahlungen` enthält die
//     Rechnungszahlungen NOCHMAL — wer beide liest, zählt doppelt. Deshalb nur
//     `belegliste`.
//   - `abrechnung_zahlung` = Geldeingänge der Krankenkassen (§ 302). Beträge
//     vorzeichenbehaftet wie in geldstand() (Rücklastschrift/Korrektur negativ).
//     `abschreibung` ist kein Geldfluss → nicht exportiert.
// Rechnungsausgang (Forderungen) wird bewusst NICHT gebucht: Heilmittelpraxen
// ermitteln ihren Gewinn ganz überwiegend per EÜR (Zufluss). Wer bilanziert,
// klärt das mit dem Steuerberater — Hinweis in der Oberfläche.
//
// Keine Patientennamen im Buchungstext (§ 203 StGB, db-ustasi 22.10.2026):
// Beleg-/Rechnungsnummer und Art reichen dem Steuerberater zur Zuordnung.

export const KONTENRAHMEN = Object.freeze({
  // VORSCHLÄGE, keine Steuerberatung (§ 5 StBerG): steuerfreie Heilbehandlung
  // (§ 4 Nr. 14 UStG) und die Standard-Geldkonten. Der Steuerberater legt fest.
  SKR03: { geldkonten: { kasse: '1000', bank: '1200' },
           erloeskonten: { gkv: '8100', zuzahlung: '8100', privat: '8100', selbstzahler: '8100', bg: '8100', ausfall: '8100', verkauf: '8100' } },
  SKR04: { geldkonten: { kasse: '1600', bank: '1800' },
           erloeskonten: { gkv: '4100', zuzahlung: '4100', privat: '4100', selbstzahler: '4100', bg: '4100', ausfall: '4100', verkauf: '4100' } },
});

const ziffern = (w, max) => { const s = String(w ?? '').replace(/\D/g, ''); return s.length && s.length <= max ? s : ''; };

/** profiles.datev_einstellungen → vollständiges Objekt mit Vorschlagswerten. */
export function normalisiereEinstellungen(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const kontenrahmen = r.kontenrahmen === 'SKR04' ? 'SKR04' : 'SKR03';
  const basis = KONTENRAHMEN[kontenrahmen];
  const sachkontenlaenge = [4, 5, 6, 7, 8].includes(Number(r.sachkontenlaenge)) ? Number(r.sachkontenlaenge) : 4;
  const konto = (w, standard) => ziffern(w, sachkontenlaenge) || standard;
  const e = r.erloeskonten || {};
  const g = r.geldkonten || {};
  const wj = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(r.wj_beginn || '')) ? r.wj_beginn : '01-01';
  return {
    beraternummer: ziffern(r.beraternummer, 7),
    mandantennummer: ziffern(r.mandantennummer, 5),
    wj_beginn: wj,
    sachkontenlaenge,
    kontenrahmen,
    geldkonten: { kasse: konto(g.kasse, basis.geldkonten.kasse), bank: konto(g.bank, basis.geldkonten.bank) },
    erloeskonten: Object.fromEntries(Object.entries(basis.erloeskonten).map(([k, v]) => [k, konto(e[k], v)])),
  };
}

/** Was fehlt, damit DATEV die Datei annimmt? Leeres Array = exportfähig. */
export function fehlendeAngaben(e) {
  const f = [];
  if (!e.beraternummer || Number(e.beraternummer) < 1001) f.push('Beraternummer (vom Steuerberater, 4–7 Ziffern)');
  if (!e.mandantennummer || Number(e.mandantennummer) < 1) f.push('Mandantennummer (vom Steuerberater, 1–5 Ziffern)');
  return f;
}

const BELEG_ART = { zuzahlung: 'Zuzahlung', rechnung: 'Rechnung', ausfall: 'Ausfallhonorar', barverkauf: 'Verkauf', storno: 'Storno' };

/** Belegliste-Typ (+ Rechnungsart) → Erlöskonto-Schlüssel. */
export function erloesSchluessel(type, invoiceType) {
  if (type === 'zuzahlung') return 'zuzahlung';
  if (type === 'ausfall') return 'ausfall';
  if (type === 'barverkauf') return 'verkauf';
  if (type === 'rechnung') return ['privat', 'selbstzahler', 'bg'].includes(invoiceType) ? invoiceType : 'privat';
  return 'privat';
}

const datumBerlin = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

/**
 * Rohzeilen → neutrale Buchungen {betrag (>0), sh ('S'|'H'), konto, gegenkonto, datum (YYYY-MM-DD), belegfeld1, text}.
 * Konto = Geldkonto, Gegenkonto = Erlöskonto. Geldeingang = Soll auf dem Geldkonto;
 * ein negativer Betrag (Storno, Rücklastschrift) wird zur Haben-Buchung.
 *
 * @param {object} q
 * @param {Array} q.belege        belegliste-Zeilen (id, beleg_nr, type, zahlart, amount_eur, created_at, invoice_id, storno_von)
 * @param {Map}   q.invoiceTypen  invoice_id → invoice_type
 * @param {Map}   q.invoiceNr     invoice_id → invoice_number
 * @param {Map}   q.originale     belegliste.id → {type, invoice_id} (für Storno-Zeilen)
 * @param {Array} q.gkv           abrechnung_zahlung-Zeilen (art, betrag_eur, datum, einzel_rechnungsnummer)
 * @param {object} e              normalisierte Einstellungen
 */
export function buchungenAus({ belege = [], invoiceTypen = new Map(), invoiceNr = new Map(), originale = new Map(), gkv = [] }, e) {
  const out = [];
  const push = (betrag, konto, gegenkonto, datum, belegfeld1, text) => {
    const cent = Math.round(Number(betrag) * 100);
    if (!cent) return;
    out.push({ betrag: Math.abs(cent) / 100, sh: cent > 0 ? 'S' : 'H', konto, gegenkonto, datum, belegfeld1, text });
  };

  for (const b of belege) {
    const geld = b.zahlart === 'bar' || !b.zahlart ? e.geldkonten.kasse : e.geldkonten.bank;
    let type = b.type;
    let invoiceId = b.invoice_id;
    if (type === 'storno') {
      const o = b.storno_von ? originale.get(b.storno_von) : null;
      // Rezept-Saldo-Storno ohne Verweis (storno_von NULL) betrifft die Zuzahlung.
      type = o?.type || (b.prescription_id ? 'zuzahlung' : 'rechnung');
      invoiceId = invoiceId || o?.invoice_id || null;
    }
    const schluessel = erloesSchluessel(type, invoiceId ? invoiceTypen.get(invoiceId) : null);
    const nr = invoiceId && invoiceNr.get(invoiceId);
    const text = `${BELEG_ART[b.type] || b.type}${b.type === 'storno' ? ' ' + (BELEG_ART[type] || type) : ''} Beleg ${b.beleg_nr}${nr ? ' ' + nr : ''}`;
    push(b.amount_eur, geld, e.erloeskonten[schluessel], datumBerlin(b.created_at), String(b.beleg_nr), text);
  }

  for (const z of gkv) {
    if (z.art === 'abschreibung') continue;
    const label = { zahlung: 'GKV-Zahlung', ruecklastschrift: 'GKV-Rücklastschrift', korrektur: 'GKV-Korrektur' }[z.art] || 'GKV';
    push(z.betrag_eur, e.geldkonten.bank, e.erloeskonten.gkv, String(z.datum).slice(0, 10),
      String(z.einzel_rechnungsnummer || ''), `${label}${z.einzel_rechnungsnummer ? ' RE ' + z.einzel_rechnungsnummer : ''}`);
  }

  return out.sort((a, b) => a.datum.localeCompare(b.datum) || a.belegfeld1.localeCompare(b.belegfeld1));
}

// ── Datei (EXTF, Formatversion 13) ─────────────────────────────────────────
// Quelle: DATEV-Format, Developer Portal, abgerufen 22.10.2026 (wissensbank W-13,
// wissensbank/gemeinsam/datev-format/). Die 125 Spaltenüberschriften sind
// MASCHINELL aus Zeile 2 der offiziellen Musterdatei EXTF_Buchungsstapel.csv
// kopiert, nicht abgetippt (CLAUDE.md: Tabellen mit Schlüsseln nicht per KI).
// Tuepfel: „Zusatzinformation- Inhalt N" hat vor dem Bindestrich KEIN Leerzeichen.
export const EXTF_SPALTEN = Object.freeze([
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
  "Postensperre",
  "Diverse Adressnummer",
  "Geschäftspartnerbank",
  "Sachverhalt",
  "Zinssperre",
  "Beleglink",
  "Beleginfo - Art 1",
  "Beleginfo - Inhalt 1",
  "Beleginfo - Art 2",
  "Beleginfo - Inhalt 2",
  "Beleginfo - Art 3",
  "Beleginfo - Inhalt 3",
  "Beleginfo - Art 4",
  "Beleginfo - Inhalt 4",
  "Beleginfo - Art 5",
  "Beleginfo - Inhalt 5",
  "Beleginfo - Art 6",
  "Beleginfo - Inhalt 6",
  "Beleginfo - Art 7",
  "Beleginfo - Inhalt 7",
  "Beleginfo - Art 8",
  "Beleginfo - Inhalt 8",
  "KOST1 - Kostenstelle",
  "KOST2 - Kostenstelle",
  "Kost-Menge",
  "EU-Land u. UStID (Bestimmung)",
  "EU-Steuersatz (Bestimmung)",
  "Abw. Versteuerungsart",
  "Sachverhalt L+L",
  "Funktionsergänzung L+L",
  "BU 49 Hauptfunktionstyp",
  "BU 49 Hauptfunktionsnummer",
  "BU 49 Funktionsergänzung",
  "Zusatzinformation - Art 1",
  "Zusatzinformation- Inhalt 1",
  "Zusatzinformation - Art 2",
  "Zusatzinformation- Inhalt 2",
  "Zusatzinformation - Art 3",
  "Zusatzinformation- Inhalt 3",
  "Zusatzinformation - Art 4",
  "Zusatzinformation- Inhalt 4",
  "Zusatzinformation - Art 5",
  "Zusatzinformation- Inhalt 5",
  "Zusatzinformation - Art 6",
  "Zusatzinformation- Inhalt 6",
  "Zusatzinformation - Art 7",
  "Zusatzinformation- Inhalt 7",
  "Zusatzinformation - Art 8",
  "Zusatzinformation- Inhalt 8",
  "Zusatzinformation - Art 9",
  "Zusatzinformation- Inhalt 9",
  "Zusatzinformation - Art 10",
  "Zusatzinformation- Inhalt 10",
  "Zusatzinformation - Art 11",
  "Zusatzinformation- Inhalt 11",
  "Zusatzinformation - Art 12",
  "Zusatzinformation- Inhalt 12",
  "Zusatzinformation - Art 13",
  "Zusatzinformation- Inhalt 13",
  "Zusatzinformation - Art 14",
  "Zusatzinformation- Inhalt 14",
  "Zusatzinformation - Art 15",
  "Zusatzinformation- Inhalt 15",
  "Zusatzinformation - Art 16",
  "Zusatzinformation- Inhalt 16",
  "Zusatzinformation - Art 17",
  "Zusatzinformation- Inhalt 17",
  "Zusatzinformation - Art 18",
  "Zusatzinformation- Inhalt 18",
  "Zusatzinformation - Art 19",
  "Zusatzinformation- Inhalt 19",
  "Zusatzinformation - Art 20",
  "Zusatzinformation- Inhalt 20",
  "Stück",
  "Gewicht",
  "Zahlweise",
  "Forderungsart",
  "Veranlagungsjahr",
  "Zugeordnete Fälligkeit",
  "Skontotyp",
  "Auftragsnummer",
  "Buchungstyp",
  "USt-Schlüssel (Anzahlungen)",
  "EU-Land (Anzahlungen)",
  "Sachverhalt L+L (Anzahlungen)",
  "EU-Steuersatz (Anzahlungen)",
  "Erlöskonto (Anzahlungen)",
  "Herkunft-Kz",
  "Buchungs GUID",
  "KOST-Datum",
  "SEPA-Mandatsreferenz",
  "Skontosperre",
  "Gesellschaftername",
  "Beteiligtennummer",
  "Identifikationsnummer",
  "Zeichnernummer",
  "Postensperre bis",
  "Bezeichnung SoBil-Sachverhalt",
  "Kennzeichen SoBil-Buchung",
  "Festschreibung",
  "Leistungsdatum",
  "Datum Zuord. Steuerperiode",
  "Fälligkeit",
  "Generalumkehr (GU)",
  "Steuersatz",
  "Land",
  "Abrechnungsreferenz",
  "BVV-Position",
  "EU-Land u. UStID (Ursprung)",
  "EU-Steuersatz (Ursprung)",
  "Abw. Skontokonto"
]);


const q = (s) => `"${String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/"/g, '""')}"`;
const yyyymmdd = (iso) => String(iso).slice(0, 10).replace(/-/g, '');

/** Wirtschaftsjahr, in dem `tag` liegt: {beginn, naechster} als YYYY-MM-DD. */
export function wirtschaftsjahr(tag, wjBeginn = '01-01') {
  const jahr = Number(String(tag).slice(0, 4));
  let beginn = `${jahr}-${wjBeginn}`;
  if (String(tag) < beginn) beginn = `${jahr - 1}-${wjBeginn}`;
  const naechster = `${Number(beginn.slice(0, 4)) + 1}-${wjBeginn}`;
  return { beginn, naechster };
}

/** Belegfeld 1 erlaubt nur [A-Za-z0-9_$&%*+-/], max. 36 (Formatbeschreibung #11). */
export function belegfeld(s) {
  return String(s ?? '').replace(/[^A-Za-z0-9_$&%*+\-/]/g, '-').slice(0, 36);
}

/** Text auf ISO-8859-1 (DATEV-Standardzeichensatz) bringen: Zeichen darüber werden '?'. */
export function alsLatin1(text) {
  return Buffer.from(String(text).replace(/[^\u0000-ÿ]/g, '?'), 'latin1');
}

const zahl = (n) => n.toFixed(2).replace('.', ',');

/**
 * Buchungen → EXTF-Datei (Buffer, ISO-8859-1, CRLF). Wirft {status:400} bei einem
 * Zeitraum über die WJ-Grenze (Belegdatum ist TTMM, das Jahr kommt aus dem
 * WJ-Beginn im Kopf, Feld #13) oder mehr als 99.999 Buchungen je Datei.
 */
export function erzeugeExtfCsv(buchungen, { einstellungen: e, von, bis, erzeugtAm = new Date() }) {
  const wj = wirtschaftsjahr(von, e.wj_beginn);
  if (String(bis) >= wj.naechster) {
    const err = new Error(`Der Zeitraum überschreitet das Wirtschaftsjahr — ab ${wj.naechster.split('-').reverse().join('.')} bitte einen eigenen Export.`);
    err.status = 400; throw err;
  }
  if (buchungen.length > 99999) {
    const err = new Error('Mehr als 99.999 Buchungen — bitte einen kürzeren Zeitraum wählen.');
    err.status = 400; throw err;
  }
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(erzeugtAm).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const stempel = `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}${String(erzeugtAm.getMilliseconds()).padStart(3, '0')}`;

  // Kopf, 31 Felder — Reihenfolge und Regeln aus der Formatbeschreibung „Satzaufbau".
  // Festschreibung 0: der Steuerberater soll korrigieren können, bevor er festschreibt.
  const kopf = [
    q('EXTF'), '700', '21', q('Buchungsstapel'), '13', stempel, '', q(''), q(''), q(''),
    e.beraternummer, e.mandantennummer, yyyymmdd(wj.beginn), String(e.sachkontenlaenge),
    yyyymmdd(von), yyyymmdd(bis), q('Praxura Geldeingaenge'), q(''), '1', '0', '0', q('EUR'),
    '', q(''), '', '', q(e.kontenrahmen === 'SKR04' ? '04' : '03'), '', '', q(''), q(''),
  ];
  const zeilen = [kopf.join(';'), EXTF_SPALTEN.join(';')];
  for (const b of buchungen) {
    const f = new Array(EXTF_SPALTEN.length).fill('');
    f[0] = zahl(b.betrag);                         // #1 Umsatz, positiv, Komma
    f[1] = q(b.sh);                                // #2 Soll/Haben
    f[2] = q('EUR');                               // #3 WKZ Umsatz
    f[6] = b.konto;                                // #7 Konto (Geldkonto)
    f[7] = b.gegenkonto;                           // #8 Gegenkonto (Erlöskonto)
    f[9] = b.datum.slice(8, 10) + b.datum.slice(5, 7);  // #10 Belegdatum TTMM
    f[10] = q(belegfeld(b.belegfeld1));            // #11 Belegfeld 1
    f[13] = q(String(b.text || '').slice(0, 60));  // #14 Buchungstext
    zeilen.push(f.join(';'));
  }
  return alsLatin1(zeilen.join('\r\n') + '\r\n');
}
