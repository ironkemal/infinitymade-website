// Welche Preflight-Regel ist HART und welche nur eine WARNUNG?
//
// ── Warum diese Datei existiert (onprem O-113, 20.09.2026) ──────────────────
//
// `preflight()` und `pruefeDatenstrom()` werfen hart: schlägt eine Regel an,
// entsteht gar keine Datei. Das ist die richtige Bauart — eine Datei mit
// falschen Zählern darf nicht einmal hochgeladen werden können.
//
// Der Preis daran ist die Verteilung. Das Regelwerk reist im Container-Image:
//   • Im SaaS ist ein Fehler in 60 Sekunden wieder weg (Watchtower).
//   • In einer Kundenbox frühestens in der nächsten Nacht, im Kanal `:stable`
//     Tage später — und in einer Box, die GHCR nicht erreicht, nie.
//   • Wir sehen es nicht: es gibt keine Telemetrie aus den Boxen (O-46).
// EINE falsche harte Regel hält also die Abrechnung JEDES betroffenen Kunden
// an, und der Kunde kann nichts tun.
//
// Das ist keine Sorge, sondern ein Vorfall: `c4332d5` war genau diese Sorte —
// eine einzige Behandlung mit einem Datum in der Zukunft ließ die komplette
// Datei scheitern.
//
// ── Was diese Datei TUT und was nicht ──────────────────────────────────────
//
// Sie ändert KEIN Verhalten. Sie schreibt nur auf, was heute schon gilt, und
// macht daraus ein Tor: `regel-schwere.test.js` vergleicht diese Liste mit den
// Regelcodes in `preflight.js`. Wer eine neue Regel einbaut, muss sie hier
// eintragen — und wer eine neue HARTE Regel einbaut, sieht beim Eintragen den
// Satz, dass das die Zustimmung von `gkv-302` braucht.
//
// Das ist der springende Punkt: die Zustimmungspflicht stand vorher nur in
// einem Plan. Jetzt steht sie im Testlauf.
//
// ── Die drei Felder ────────────────────────────────────────────────────────
//
//   schwere  'hart'    → E(), die Datei entsteht nicht
//            'warnung' → W(), die Datei entsteht und der Hinweis erscheint
//            'beides'  → derselbe Code wird an zwei Stellen verwendet, einmal
//                        als Fehler und einmal als Warnung (s. D:01001)
//
//   kasse    Was die Annahmestelle täte, wenn es DOCH durchginge:
//            'datei'     → sie weist die ganze Datei zurück (Prüfstufe 1/2)
//            'zeile'     → sie setzt nur diesen Abrechnungsfall ab
//            'unbekannt' → nicht belegt. KEIN Ratewert; wer es belegen kann,
//                          trägt die Fundstelle ein.
//
//   quelle   Fundstelle oder — wenn es unsere eigene Sorgfaltsregel ist und
//            nicht die der Spezifikation — ausdrücklich 'hausregel'.
//
// ⚠️ 'unbekannt' ist häufig, und das ist ehrlicher als eine erfundene Angabe.
//    Die Spezifikation nennt die Prüfstufe nicht bei jedem einzelnen Feld.

export const REGEL_SCHWERE = Object.freeze({
  // ── Dateikopf: IK, Rechnungsnummer, Datennummer ──────────────────────────
  'F:01001': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.4 (UNB)',  hinweis: 'Absender-IK fehlt' },
  'F:01002': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.4 (UNB)',  hinweis: 'Absender-IK nicht 9-stellig' },
  'F:01003': { schwere: 'hart', kasse: 'datei', quelle: 'ARGE-IK, Modulo-10',                hinweis: 'Absender-IK Prüfziffer' },
  'F:01004': { schwere: 'warnung', kasse: 'unbekannt', quelle: 'ARGE-IK Klassifikation',     hinweis: 'IK-Präfix nicht 80-99 — bewusst nur Warnung, die Klassifikation ist kein Ablehnungsgrund' },
  'F:02001': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.4 (UNB)',  hinweis: 'Empfänger-IK fehlt' },
  'F:02002': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.4 (UNB)',  hinweis: 'Empfänger-IK nicht 9-stellig' },
  'F:02003': { schwere: 'hart', kasse: 'datei', quelle: 'ARGE-IK, Modulo-10',                hinweis: 'Empfänger-IK Prüfziffer' },
  'F:03001': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.2 (REC)', hinweis: 'Sammelrechnungsnummer fehlt (Muss-Feld)' },
  'F:03002': { schwere: 'hart', kasse: 'unbekannt', quelle: 'unbelegt',                       hinweis: '⚠️ Die 14-Zeichen-Grenze ist im Text nicht auffindbar — Frage an gkv-302, s. REGELN.md' },
  'F:03003': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.4 (UNB 0020)', hinweis: 'Datenaustauschreferenz fehlt' },
  'F:03004': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.4 (UNB 0020)', hinweis: 'Datenaustauschreferenz > 99999 (Feld ist 5-stellig)' },
  'F:03005': { schwere: 'hart', kasse: 'datei', quelle: 'hausregel',                         hinweis: 'Rechnungsdatum nicht parsebar — ohne Datum kein REC' },
  'F:03010': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.2 (NAM Name 1, ..30 AN M)', hinweis: 'Praxisname > 30 Zeichen (Schritt 1.9 d)' },
  'F:04001': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 3 TP5, Schlüssel 8.1.x (VKZ)', hinweis: 'Verarbeitungskennzeichen unbekannt' },
  'F:05001': { schwere: 'hart', kasse: 'datei', quelle: 'hausregel',                         hinweis: 'Leere Datei — es gibt nichts zu übermitteln' },

  // ── Versicherter (SLLA.INV / SLLA.NAD) ───────────────────────────────────
  'P:01001': { schwere: 'hart', kasse: 'zeile', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (INV)', hinweis: 'KVNR-Format' },
  'P:01002': { schwere: 'hart', kasse: 'zeile', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (INV)', hinweis: 'Versichertenstatus-Format' },
  'P:01003': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (NAD, AN M)', hinweis: 'Nachname fehlt — leeres Muss-Feld' },
  'P:01004': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (NAD, AN M)', hinweis: 'Vorname fehlt — leeres Muss-Feld' },
  'P:01005': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (NAD, NM)',  hinweis: 'Geburtsdatum fehlt/ungültig' },
  'P:01006': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (INV Feld 4, AN M)', hinweis: 'Belegnummer fehlt' },
  'P:01007': { schwere: 'hart', kasse: 'unbekannt', quelle: 'Anlage 1 TP5 V21, Kap. 7.3', hinweis: 'Belegnummer doppelt — ohne Eindeutigkeit lässt sich eine Rückmeldung nicht zuordnen' },
  'P:01008': { schwere: 'warnung', kasse: 'unbekannt', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (NAD, AN K)', hinweis: 'PLZ nicht 5-stellig — Kann-Feld, im Ausland zulässig' },
  'P:01009': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (INV Feld 4, ..10)', hinweis: 'Belegnummer zu lang/ungültige Zeichen' },
  'P:01010': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (NAD, ..47)', hinweis: 'Nachname > 47 Zeichen (Schritt 1.9 d)' },
  'P:01011': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (NAD, ..30)', hinweis: 'Vorname > 30 Zeichen (Schritt 1.9 d)' },
  'P:01012': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (NAD, ..30)', hinweis: 'Straße > 30 Zeichen (Schritt 1.9 d)' },
  'P:01013': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (NAD, ..7)',  hinweis: 'PLZ > 7 Zeichen (Schritt 1.9 d)' },
  'P:01014': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.1 (NAD, ..25)', hinweis: 'Wohnort > 25 Zeichen (Schritt 1.9 d)' },

  // ── Arzt (SLLA.ZHE) ──────────────────────────────────────────────────────
  // ⚠️ D:01001 wird an ZWEI Stellen verwendet: einmal als Fehler (LANR nicht
  //    9-stellig) und einmal als Warnung (Prüfziffer stimmt nicht). Derselbe
  //    Code mit zwei Bedeutungen ist für den Anwender nicht auflösbar —
  //    aufgenommen als Befund, NICHT hier repariert (das wäre eine
  //    Verhaltensänderung). Siehe REGELN.md, offene Fragen.
  'D:01001': { schwere: 'beides', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3 (ZHE)', hinweis: '⚠️ Doppelt belegt: hart bei Formatfehler, Warnung bei Prüfziffer' },
  'D:01002': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3 (ZHE)', hinweis: 'BSNR nicht 9-stellig' },
  'D:01003': { schwere: 'warnung', kasse: 'zeile', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3 (ZHE, Ersatzwert 999999999)', hinweis: 'LANR fehlt → Ersatzwert; führt bei vorhandener Arztnummer zur Bemängelung (VKZ 04)' },
  'D:01004': { schwere: 'warnung', kasse: 'zeile', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3 (ZHE, Ersatzwert 999999999)', hinweis: 'BSNR fehlt → Ersatzwert' },

  // ── Verordnung (SLLA.ZHE / SLLA.DIA) ─────────────────────────────────────
  'V:01001': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3 (ZHE, NM M)', hinweis: 'Ausstellungsdatum ungültig' },
  'V:01002': { schwere: 'hart', kasse: 'zeile', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3 (DIA)', hinweis: 'ICD-10-Format — nur geprüft, WENN ein Kode dasteht (Schritt 1.8)' },
  'V:01003': { schwere: 'hart', kasse: 'zeile', quelle: 'Heilmittelkatalog / Anlage 1 TP5 V21, Kap. 5.5.3.3', hinweis: 'Diagnosegruppe ungültig' },
  'V:01004': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 3 TP5, Schlüssel Verordnungsart',   hinweis: 'Verordnungsart nicht 03/04/05' },
  'V:01005': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 3 TP5 §8.1.3 (Zuzahlungskennzeichen)', hinweis: 'Zuzahlungskennzeichen ungültig' },
  'V:01006': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3 (ZHE, M)', hinweis: 'Leitsymptomatik fehlt — leeres Muss-Feld' },
  'V:01007': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3 (ZHE, M)', hinweis: 'Therapiefrequenz fehlt' },
  'V:01008': { schwere: 'hart', kasse: 'zeile', quelle: 'ARGE-IK, Modulo-10',                       hinweis: 'Kostenträger-IK Prüfziffer' },
  'V:01009': { schwere: 'hart', kasse: 'zeile', quelle: 'hausregel (HeilM-RL § 16 Abs. 7)',         hinweis: 'Therapiebericht angefordert, aber offen — im create-Weg übersteuerbar und protokolliert' },
  'V:01010': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3 (ZHE, an4)', hinweis: 'Leitsymptomatik nicht vier Stellen 0/1 — belegter Fall („DF-c")' },
  'V:01011': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3, S. 71',    hinweis: 'Patientenindividuelle Leitsymptomatik zwingend, wenn kein Katalog-Kreuz' },
  'V:01012': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3, S. 71',    hinweis: 'Freitext der Leitsymptomatik zu lang' },
  'V:01013': { schwere: 'warnung', kasse: 'unbekannt', quelle: 'hausregel',                          hinweis: 'Nur Freitext, kein Katalog-Kreuz — gegen den Urbeleg prüfen' },
  'V:01014': { schwere: 'hart', kasse: 'zeile', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3, S. 72 (je Diagnose ein DIA)', hinweis: 'Weiterer ICD-10-Kode ungültig' },
  'V:01015': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.3, S. 72',    hinweis: 'Weder ICD noch Diagnosetext — leeres DIA-Muss-Segment (Schritt 1.8)' },

  // ── Leistungen (SLLA.EHE / SLLA.BES) ─────────────────────────────────────
  'S:01001': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.2 (EHE, 1..n)', hinweis: 'Abrechnungsfall ohne Leistung' },
  'S:01002': { schwere: 'hart', kasse: 'zeile', quelle: 'Anlage 3 TP5 §8.2.1 (Positionsnummer)',      hinweis: 'Positionsnummer nicht 5-stellig' },
  'S:01003': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.2 (EHE, NM M)', hinweis: 'Leistungsdatum ungültig' },
  'S:01004': { schwere: 'hart', kasse: 'zeile', quelle: 'HeilM-RL',                                   hinweis: 'Leistung vor Ausstellung der Verordnung' },
  'S:01005': { schwere: 'hart', kasse: 'zeile', quelle: 'hausregel',                                  hinweis: 'Leistungsdatum in der Zukunft — Auslöser von c4332d5, s. REGELN.md' },
  'S:01006': { schwere: 'hart', kasse: 'zeile', quelle: 'hausregel',                                  hinweis: 'Leistungsdatum nach Rechnungsdatum' },
  'S:01007': { schwere: 'hart', kasse: 'zeile', quelle: 'Anlage 1 TP5 V21, Kap. 5.5.3.2 (EHE, NK M)', hinweis: 'Einzelbetrag <= 0' },
  'S:01008': { schwere: 'warnung', kasse: 'unbekannt', quelle: 'hausregel',                            hinweis: 'Einzelbetrag auffällig hoch — Tippfehlerbremse, kein Verstoß' },
  'S:01009': { schwere: 'warnung', kasse: 'unbekannt', quelle: 'hausregel (§ 61 SGB V, 10 %)',         hinweis: 'Zuzahlungssumme weicht von 10 % ab' },
  'S:01010': { schwere: 'hart', kasse: 'zeile', quelle: 'HeilM-RL (Behandlungsunterbrechung)',        hinweis: 'Unterbrechung > 14 Tage' },
  'S:01011': { schwere: 'hart', kasse: 'zeile', quelle: '§ 125 SGB V Verträge (MT/MLD/KGG)',          hinweis: 'Therapeut ohne erforderliche Qualifikation' },
  'S:01012': { schwere: 'hart', kasse: 'zeile', quelle: 'HeilM-RL (Gültigkeit 84 Tage)',              hinweis: 'Verordnung abgelaufen' },

  // ── Tarif (SLLA.EHE, LEGS) ───────────────────────────────────────────────
  'T:01001': { schwere: 'hart', kasse: 'datei', quelle: 'Anhang 3 Anlage 1 TP5 § 8.14 (Abrechnungscode)', hinweis: 'Abrechnungscode unbekannt' },
  'T:01002': { schwere: 'hart', kasse: 'datei', quelle: 'Anhang 3 Anlage 1 TP5 § 8.14',                   hinweis: 'Abrechnungscode nicht Leistungsbereich B' },
  'T:01003': { schwere: 'hart', kasse: 'datei', quelle: 'Anlage 3 TP5 (Tarifbereich)',                    hinweis: 'Tarifkennzeichen ungültig' },
  'T:01004': { schwere: 'hart', kasse: 'zeile', quelle: '§ 125 SGB V Verträge (gültige LEGS)',            hinweis: 'LEGS steht in keinem Vertrag' },
});

/**
 * Codes, die heute als HART gelten. Das ist die Liste, die `gkv-302` prüfen
 * muss, wenn sie wächst — nicht die Datei als Ganzes.
 */
export function harteRegeln() {
  return Object.entries(REGEL_SCHWERE)
    .filter(([, v]) => v.schwere === 'hart' || v.schwere === 'beides')
    .map(([k]) => k)
    .sort();
}
