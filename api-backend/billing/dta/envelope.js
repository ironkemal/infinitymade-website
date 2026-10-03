// UNB/UNH/UNT/UNZ envelope per §302 Anlage 1 V21 §5.4 (p.19-23).
// Charset UNOC:3 (Latin-1), mandatory for §302.

import { buildSegment } from './encoding.js';
import { berlinHeute, istStichtag } from '../../lib/berlin-tag.js';

const BERLIN_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin',
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

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
  let datumStr;
  let zeitStr;

  if (!erstellungsdatum) {
    throw new Error(`invalid erstellungsdatum: "${erstellungsdatum}"`);
  }

  if (typeof erstellungsdatum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(erstellungsdatum)) {
    if (!istStichtag(erstellungsdatum)) {
      throw new Error(`invalid erstellungsdatum: "${erstellungsdatum}"`);
    }
    datumStr = erstellungsdatum.replace(/-/g, '');
    zeitStr = '0000';
  } else {
    const dt = erstellungsdatum instanceof Date ? erstellungsdatum : new Date(erstellungsdatum);
    if (Number.isNaN(dt.getTime())) {
      throw new Error(`invalid erstellungsdatum: "${erstellungsdatum}"`);
    }
    datumStr = berlinHeute(dt).replace(/-/g, '');
    const parts = Object.fromEntries(
      BERLIN_TIME_FORMAT.formatToParts(dt).map(p => [p.type, p.value])
    );
    zeitStr = `${parts.hour}${parts.minute}`;
  }

  return buildSegment('UNB', [
    ['UNOC', '3'],
    absenderIk,
    empfaengerIk,
    [datumStr, zeitStr],
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
//
// Der Zaehler ist n6 mit fuehrenden Nullen (Anlage 1 TP5 V21, Kap. 5.4):
// "UNT+000015+00002'", nicht "UNT+15+00002'". Bis zum 19.09.2026 stand hier
// die ungepolsterte Zahl — ein Formfehler in Pruefstufe 2, der nicht die
// einzelne Nachricht, sondern die ganze Datei zurueckgibt.
export function buildUNT({ segmentCount, nachrichtenreferenz }) {
  return buildSegment('UNT', [
    String(segmentCount).padStart(6, '0'),
    String(nachrichtenreferenz).padStart(5, '0'),
  ]);
}

// UNZ — interchange trailer. Nachrichtenzaehler ebenfalls n6 (Kap. 5.4).
export function buildUNZ({ messageCount, datennummer }) {
  return buildSegment('UNZ', [
    String(messageCount).padStart(6, '0'),
    String(datennummer).padStart(5, '0'),
  ]);
}
