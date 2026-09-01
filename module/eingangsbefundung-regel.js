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
