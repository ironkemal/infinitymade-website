// Antwort, wenn die Praxis kein eigenes IK hinterlegt hat.
//
// Vorher: 400 { error: 'Kein IK-Nummer hinterlegt.' } — falsches Deutsch und
// ohne Hinweis, wo man das IK einträgt. Der Code `IK_FEHLT` lässt die
// Oberfläche einen Knopf zu Einstellungen › Abrechnung anbieten.
// Status bleibt 400 (Clients unterscheiden nicht nach 412 — Physio-Zweig
// nutzt 412 mit eigenem Text und bleibt unberührt).
// Quelle: Anlage 1 TP5 V21 §5.4 (IK des Leistungserbringers im Absender).
export const IK_FEHLT_CODE = 'IK_FEHLT';

export const IK_FEHLT_TEXT =
  'Institutionskennzeichen (IK) der Praxis fehlt. Ohne IK kann keine Abrechnungsdatei nach § 302 SGB V erstellt werden. ' +
  'Bitte unter Einstellungen › Abrechnung das 9-stellige IK eintragen.';

export function ikFehltAntwort() {
  return { status: 400, body: { error: IK_FEHLT_TEXT, code: IK_FEHLT_CODE } };
}
