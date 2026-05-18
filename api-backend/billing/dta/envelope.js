// UNB/UNH/UNT/UNZ envelope per §302 Anlage 1 V21 §5.4 (p.19-23).
// Charset UNOC:3 (Latin-1), mandatory for §302.

import { buildSegment } from './encoding.js';

// UNB — interchange header.
//   S001 = ['UNOC', '3']
//   S002 = absender IK (an..35; first 9 used)
//   S003 = empfänger IK
//   S004 = ['JJJJMMTT', 'HHMM']
//   0020 = Datenaustauschreferenz (an..14, first 5 used; 00001..99999)
//   S005 = Leistungsbereich (Anlage 3 §8.1.14; 'B' = Heilmittel)
//   0026 = Anwendungsreferenz (logical filename, an..14, first 11 used)
//   0035 = Testindikator (n1: '0'=Test, '1'=Erprobung, '2'=Echt)
export function buildUNB({
  absenderIk,
  empfaengerIk,
  erstellungsdatum,
  datennummer,
  leistungsbereich = 'B',
  anwendungsreferenz,
  testIndikator = '2',
}) {
  const dt = erstellungsdatum instanceof Date ? erstellungsdatum : new Date(erstellungsdatum);
  const yyyy = String(dt.getUTCFullYear());
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mi = String(dt.getUTCMinutes()).padStart(2, '0');

  return buildSegment('UNB', [
    ['UNOC', '3'],
    absenderIk,
    empfaengerIk,
    [`${yyyy}${mm}${dd}`, `${hh}${mi}`],
    String(datennummer).padStart(5, '0'),
    leistungsbereich,
    anwendungsreferenz || '',
    String(testIndikator),
  ]);
}

// UNH — message header.
//   0062 = Nachrichtenreferenznummer (an..14, first 5 used)
//   S009 = ['SLGA'|'SLLA', '21', '0', '0']
export function buildUNH({ nachrichtenreferenz, nachrichtenart, versionsnummer = '21' }) {
  return buildSegment('UNH', [
    String(nachrichtenreferenz).padStart(5, '0'),
    [nachrichtenart, versionsnummer, '0', '0'],
  ]);
}

// UNT — message trailer. Segment count INCLUDES UNH and UNT.
export function buildUNT({ segmentCount, nachrichtenreferenz }) {
  return buildSegment('UNT', [
    String(segmentCount),
    String(nachrichtenreferenz).padStart(5, '0'),
  ]);
}

// UNZ — interchange trailer.
export function buildUNZ({ messageCount, datennummer }) {
  return buildSegment('UNZ', [
    String(messageCount),
    String(datennummer).padStart(5, '0'),
  ]);
}
