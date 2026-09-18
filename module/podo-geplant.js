/**
 * podo-geplant.js — geplante Termine als Behandlungshistorie für die
 * Befundungsregel.
 *
 * Eigene Datei, damit `module/termin-leistungen.js` sie laden kann, ohne die
 * Panel-Zeichnung von `module/podo-einheiten.js` (DOM, Umschalter) mitzuziehen.
 * Reine Rechnung, keine Abfrage.
 */

import { istVergeben } from './verordnung-termine.js?v=20260908';

/**
 * Welche HPNR trägt eine Leistung? `gkv_position_nr`, sonst `code`.
 *
 * Dieselbe Regel wie `hpnrVonDienst()` (`module/termin-leistungen.js`), aus
 * demselben Grund: die Beta-Praxen führen beides, der GKV-Katalog schreibt
 * `gkv_position_nr`, ältere Handanlagen nur `code`. Vorher las diese Funktion nur
 * `gkv_position_nr` — in einer Praxis mit der HPNR nur im `code` fiel der
 * geplante Termin aus der Historie, und der zweite Termin einer Serie bekam
 * wieder 78040 (fonksiyon-ustasi, 18.09.2026): genau der Fehler, den dieses Modul
 * beheben soll, nur lautlos in der Hälfte der Praxen. Beide Stellen innerhalb
 * EINES Befundungsvorschlags müssen dieselbe Frage gleich beantworten.
 *
 * Dass `code` auch Freitext sein kann („MASSAGE"), schadet nicht:
 * `geplanteAlsBehandlungen()` lässt nur `78xxx` durch, `befundDienstId()` vergleicht
 * auf Gleichheit.
 */
export function positionVon(dienst) {
  return String(dienst?.gkv_position_nr || dienst?.code || '').trim();
}

/**
 * Geplante, noch nicht dokumentierte Termine als „Behandlungen" für die
 * Befundungsregel.
 *
 * Der Vorschlag der Terminmaske (`module/termin-leistungen.js`,
 * `patientenBehandlungen()`) las bisher nur `podologie_behandlungen` — also nur,
 * was NACH dem Termin dokumentiert wurde. Wer eine Serie im Voraus bucht, bekam
 * deshalb für jeden Termin dieselbe Antwort: „noch keine Behandlung, also
 * 78040". Zwei geplante Termine derselben Verordnung trugen beide die
 * Eingangsbefundung, und 78040 neben 78030 am selben Tag ist ohnehin gesperrt.
 * (Befund fonksiyon-ustasi, 18.09.2026.)
 *
 * Hier werden die geplanten Termine in dieselbe Form gebracht, die
 * `befundungFuerLeistung()` erwartet: ein Tag und die Positionen, die an ihm
 * laufen. NUR Termine mit einer podologischen Position (78xxx) zählen — ein
 * früherer Physio-Termin desselben Patienten ist keine „frühere Behandlung" im
 * Sinne von Anlage 1a und würde 78040 zu Unrecht sperren.
 *
 * @param {Array} termine   `bookings` mit `booking_leistungen(services(gkv_position_nr))`
 *        und/oder `services(gkv_position_nr)` (Rückfall, wie `podGeplanteHpnr()`)
 * @param {{ohneId?:string}} [opt]  der Termin, der gerade bearbeitet wird —
 *        seine eigene Befundzeile darf sich nicht selbst sperren
 * @returns {Array<{behandlungsdatum:string, hpnr_codes:string[], geplant:true}>}
 */
export function geplanteAlsBehandlungen(termine, { ohneId = '' } = {}) {
  const tag = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const heraus = [];
  for (const b of termine || []) {
    if (!b || !b.start_time || !istVergeben(b)) continue;
    if (ohneId && b.id === ohneId) continue;
    const quellen = b.booking_leistungen?.length ? b.booking_leistungen : [{ services: b.services }];
    const codes = quellen
      .map(z => positionVon(z?.services))
      .filter(c => /^78\d{3}$/.test(c));
    if (!codes.length) continue;
    heraus.push({ behandlungsdatum: tag(b.start_time), hpnr_codes: [...new Set(codes)], geplant: true });
  }
  return heraus;
}
