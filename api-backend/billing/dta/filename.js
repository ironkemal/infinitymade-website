// § 302 DTA filename builder.
//
// Format per ITSG (Nutzdatendateien):
//   E<Verfahrenskennung><Anwendungskennung><AbsenderIK-Suffix><laufende-Nr>
//
// Verfahrenskennung-Anwendungskennung for §302 Heilmittel:
//   HK = Heilmittel Krankenkasse (Echtdaten)
//   HM = Heilmittel Muster / Test
//
// Beispiel: 'EHK1234500000023'
//   E    = Echtdaten/Test indikator letter
//   HK   = Anwendung (§302 Heilmittel)
//   12345 = letzten 5 Stellen Absender-IK
//   00000023 = 8-stellige laufende Nummer
//
// References:
//   GKV-DA Anlage 17 (Nutzdatendateien)
//   https://www.gkv-datenaustausch.de

const ANWENDUNG_BY_KIND = {
  echt: 'HK',
  test: 'HM',
};

/**
 * @param {object} opts
 * @param {string} opts.absenderIk      9-digit IK
 * @param {number} opts.laufendeNummer  monotonically increasing per sender
 * @param {'echt'|'test'} [opts.kind]   default 'echt'
 */
export function buildDtaFilename({ absenderIk, laufendeNummer, kind = 'echt' }) {
  if (!/^\d{9}$/.test(String(absenderIk || ''))) {
    throw new Error('absenderIk must be a 9-digit Institutionskennzeichen');
  }
  if (!Number.isInteger(laufendeNummer) || laufendeNummer < 0 || laufendeNummer > 99_999_999) {
    throw new Error('laufendeNummer must be an integer in [0, 99_999_999]');
  }
  const anwendung = ANWENDUNG_BY_KIND[kind];
  if (!anwendung) throw new Error(`unknown DTA kind: ${kind}`);

  const ikSuffix = String(absenderIk).slice(-5);
  const seq = String(laufendeNummer).padStart(8, '0');
  return `E${anwendung}${ikSuffix}${seq}`;
}

// Encrypted/signed variant: same basename + .p7m
export function buildEncryptedFilename(base) {
  return `${base}.dta.p7m`;
}
