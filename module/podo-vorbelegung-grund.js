/**
 * podo-vorbelegung-grund.js — WARUM ist diese Position angekreuzt / vorgeschlagen?
 *
 * Konsey 30.09.2026 (Podologie-Reform S0, Beschluss 2b): Die Vorbelegung ist
 * bewusst auf zwei Bildschirmen zwei Regeln (Planung: nur die verordnete
 * Position ist angekreuzt, 78030/78040 nur vorgeschlagen; Behandlungstag: die
 * Regel darf ankreuzen, weil S1.6 und die 30.09-Bloecke im selben Datensatz
 * haengen). Was fehlte: der Grund. Wer eine Position angekreuzt findet, die er
 * nicht selbst gesetzt hat, muss sehen, woher sie kommt — und wer eine falsch
 * erkannte Position auf der Verordnung hat (OCR), muss sie neben der
 * Vorbelegung lesen koennen.
 *
 * Nur Texte, kein DOM, keine neue Regel: jede Bedingung unten steht schon in
 * `podologie-abrechnung.js` (Tagesbehandlung) bzw. `eingangsbefundung-regel.js`
 * (Termin/Serie). Geprueft in podo-vorbelegung-grund.test.js.
 */

import { datumDe } from './datum.js?v=20260930f';

/**
 * Grund fuer den Befundungsvorschlag der Termin-/Serienmaske. `grund` ist der
 * Schluessel aus `befundungFuerLeistung()`.
 * @returns {string} Kurztext ohne Satzzeichen am Ende; leer, wenn kein Grund bekannt
 */
export function befundGrundText(grund) {
  switch (grund) {
    case 'erstinanspruchnahme':
      return 'erste Behandlung dieses Patienten — Eingangsbefundung einmalig';
    case 'nicht_erste_behandlung':
      return 'nicht die erste Behandlung dieses Patienten — Befundung vor jeder Behandlung';
    case 'eingangsbefundung_verbraucht':
      return 'Eingangsbefundung ist schon erfasst — Befundung vor jeder weiteren Behandlung';
    case 'kein_anspruch_altbestand':
      return 'Patient war schon vor dem 01.11.2023 in podologischer Behandlung';
    default:
      return '';
  }
}

/**
 * Grund fuer ein bereits angekreuztes Haekchen im Formular „Tagesbehandlung".
 * Dieselben Bedingungen wie beim Ankreuzen selbst — die Reihenfolge der Zweige
 * entspricht der dort.
 *
 * @param {object} p
 * @param {string}  p.code
 * @param {boolean} p.isUI              Nagelzweig UI1/UI2 (keine 78030/78040)
 * @param {{erlaubt:boolean, grund?:string, schonAm?:?string, ersteAm?:?string}} p.eingang  Lage der Eingangsbefundung
 * @param {boolean} p.hausbesuch        Verordnung sieht Hausbesuch vor
 * @param {boolean} p.geplant           im Termin dieses Tages geplant
 * @param {string}  p.rezeptPosition    vorbelegte Behandlungsposition (78010/78020)
 * @param {string} [p.POD_EINGANG='78040']
 * @param {string} [p.POD_BEFUND='78030']
 * @returns {string} leer, wenn die Position nicht vorbelegt ist oder kein Grund bekannt
 */
export function tagesVorbelegungGrund({
  code, isUI, eingang, hausbesuch, geplant, rezeptPosition,
  POD_EINGANG = '78040', POD_BEFUND = '78030',
}) {
  if (!isUI && code === POD_EINGANG && eingang?.erlaubt) {
    return 'erste Behandlung dieses Patienten — Eingangsbefundung einmalig';
  }
  if (!isUI && code === POD_BEFUND && !eingang?.erlaubt) {
    if (eingang?.grund === 'schon_abgerechnet' && eingang.schonAm) {
      return `Eingangsbefundung am ${datumDe(eingang.schonAm)} schon erfasst — Befundung vor jeder weiteren Behandlung`;
    }
    if (eingang?.ersteAm) {
      return `erste Behandlung war am ${datumDe(eingang.ersteAm)} — Befundung vor jeder weiteren Behandlung`;
    }
    return 'nicht die erste Behandlung dieses Patienten — Befundung vor jeder Behandlung';
  }
  if (hausbesuch && code === '79933') return 'Hausbesuch laut Verordnung';
  if (code && code === rezeptPosition) return 'Behandlungsposition laut Verordnung';
  if (geplant) return 'im Termin dieses Tages geplant';
  return '';
}

/**
 * Die Zeile „Verordnet: 78xxx" ueber dem Formular: was AUF DER VERORDNUNG steht
 * (Rohwert, so wie erfasst oder per OCR gelesen) — neben dem, was daraus
 * vorbelegt wurde. Weicht beides ab, faellt ein Lesefehler auf, bevor er auf der
 * Rechnung steht.
 *
 * @param {?string} roh          `heilmittel_position` bzw. erste Position aus `heilmittel_items`
 * @param {?string} vorbelegt    Ergebnis von `behandlungspositionVorschlag()`
 */
export function verordnetZeile(roh, vorbelegt) {
  const r = String(roh || '').trim();
  const v = String(vorbelegt || '').trim();
  if (!r) return 'Verordnet: keine Position auf der Verordnung erfasst' + (v ? ` — vorbelegt: ${v}` : '');
  return v && v !== r ? `Verordnet: ${r} — vorbelegt: ${v}` : `Verordnet: ${r}`;
}
