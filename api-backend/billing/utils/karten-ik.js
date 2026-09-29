// Karten-IK der Verordnung — Pflicht für jede GKV-Abrechnung.
//
// `prescriptions.krankenkasse_ik` = „IK der Krankenkasse von der KV-Karte bzw.
// der ärztlichen Verordnung" (Anlage 1 TP5 V21 §5.5.2 SLGA-FKT, §5.5.3.1
// SLLA-FKT, Mussfeld). `kostentraeger_ik` ist ein ANDERES Feld (IK des
// Kostenträgers laut Kostenträgerdatei). Bis 30.09.2026 fiel der DTA-Bau bei
// leerer Karten-IK still auf die Kostenträger-IK zurück und schrieb sie in
// beide Felder (gkv-302). Jetzt kommt eine Verordnung ohne Karten-IK gar nicht
// erst in die Datei; der Fehler nennt Verordnung und Patient wie bei der
// fehlenden Praxis-IK (S2.7).

export const KARTEN_IK_FEHLT_CODE = 'KARTEN_IK_FEHLT';

/** 9 Ziffern? (CHECK der Spalte `prescriptions.krankenkasse_ik`) */
export function istKartenIk(ik) {
  return /^\d{9}$/.test(String(ik ?? ''));
}

/**
 * @param {{id?: string, krankenkasse_ik?: ?string}} rx  Verordnungszeile
 * @param {{vorname?: string, nachname?: string}} np    Name aus der Patientenakte
 * @returns {?Error}  Fehler mit `status` 422 und `code`, oder `null` wenn in Ordnung
 */
export function kartenIkFehler(rx, np = {}) {
  if (istKartenIk(rx?.krankenkasse_ik)) return null;
  const kurz = String(rx?.id ?? '').slice(0, 8);
  const patient = [np.vorname, np.nachname].filter(Boolean).join(' ');
  const e = new Error(
    `Verordnung ${kurz}${patient ? ` (${patient})` : ''}: IK der Krankenkasse von der ` +
    'Versichertenkarte fehlt — in der Verordnung eintragen.'
  );
  e.status = 422;
  e.code = KARTEN_IK_FEHLT_CODE;
  return e;
}
