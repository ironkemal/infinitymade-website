// Software-Hersteller-IK (ARGE·IK Klassifikation 68) — NUR für das
// zertifikatsbasierte Testverfahren nach Anhang 2 zur Anlage 1 (TP5).
//
// Hintergrund (2026-09-21, `legal-de` Auflage 1 zur Zustimmung der
// Beantragung — vgl. `compliance/LEGAL_DECISIONS.md`,
// `ABRECHNUNG_ECHTBETRIEB_PLAN.md` Adım 2.0): Praxura beantragt bei der
// ARGE·IK ein Institutionskennzeichen der Klassifikation 68
// ("Softwarehersteller im Sozialversicherungswesen für zertifikatsbasierte
// Testverfahren"), um am Softwarehersteller-Test (Anhang 2 Kap. 9, Schritt
// 2.2 im Plan) selbst teilnehmen zu können, ohne dafür eine Praxis-IK zu
// benötigen.
//
// Diese IK darf NIEMALS als Absender-IK in einer echten
// (Echtbetrieb-)Abrechnungsdatei auftauchen — die Abrechnung nach § 302
// SGB V erfolgt durch die Praxis unter ihrem eigenen IK, nicht durch
// Praxura. Würde diese IK in einer `kind==='echt'`-Datei als Absender
// erscheinen, wäre das genau der Übergang von "Tool" zu
// "Abrechnungsdienstleister/Rechenzentrum", den die Konumlandırma-Entscheidung
// (`compliance/LEGAL_DECISIONS.md`, "Tool, kein Abrechnungsdienstleister")
// und K4 in `ABRECHNUNG_ECHTBETRIEB_PLAN.md` ausdrücklich ausschließen.
//
// Bis die IK von der ARGE·IK erteilt ist, bleibt der Wert `null` — die
// Sperre unten ist dann ein No-Op (kein Absender-IK ist `null`). Sobald die
// IK vergeben wird, wird sie HIER eingetragen (ein Wertetausch, kein neuer
// Code) und die Sperre greift ab dem nächsten Deploy automatisch.
export const SOFTWARE_HERSTELLER_IK = null;

/**
 * Reine Prüfung, unabhängig von der Modul-Konstante — testbar, ohne die
 * Konstante temporär umzuschreiben.
 *
 * @param {{kind: string, absenderIk: string, softwareHerstellerIk?: string|null}} args
 * @returns {boolean}
 */
export function istVerbotenerAbsender({ kind, absenderIk, softwareHerstellerIk = SOFTWARE_HERSTELLER_IK }) {
  return kind === 'echt' && !!softwareHerstellerIk && absenderIk === softwareHerstellerIk;
}

/**
 * Wirft, wenn eine Echtbetrieb-Datei (`kind==='echt'`) die
 * Software-Hersteller-IK als Absender trägt. No-Op solange
 * `SOFTWARE_HERSTELLER_IK` noch nicht gesetzt ist (Antrag läuft).
 *
 * `softwareHerstellerIk` ist zu Testzwecken überschreibbar — die
 * Aufrufstelle in `builder.js` übergibt sie nie, damit dort immer die
 * echte Modul-Konstante gilt.
 *
 * Aufrufstelle: `builder.js` → `buildDtaFile()`, direkt nach der
 * Absender/Empfänger-Pflichtprüfung.
 */
export function assertNichtSoftwareHerstellerIkAlsAbsender({ kind, absenderIk, softwareHerstellerIk = SOFTWARE_HERSTELLER_IK }) {
  if (istVerbotenerAbsender({ kind, absenderIk, softwareHerstellerIk })) {
    throw new Error(
      `Absender-IK "${absenderIk}" ist die Software-Hersteller-IK (ARGE·IK Klassifikation 68) ` +
      'und darf niemals als Absender einer Echtbetrieb-Datei auftauchen — sie ist ausschließlich ' +
      'für das zertifikatsbasierte Testverfahren (Anhang 2 Kap. 9) bestimmt. Die Abrechnung nach ' +
      '§ 302 SGB V erfolgt durch die Praxis unter ihrem eigenen IK, nicht durch Praxura ' +
      '(compliance/LEGAL_DECISIONS.md, 2026-09-21).'
    );
  }
}
