// TP5 V21 §5.4, §5.5.2, §5.5.3.1/.3: structural checks on emitted bytes.
// Input is already tokenised by the shared release-aware EDIFACT reader.
// Contract entitlement and payer acceptance are deliberately not inferred here.
import { istStichtag } from '../../lib/berlin-tag.js';
import { ZUZAHLUNGSKENNZEICHEN, VERORDNUNGSART_HEILMITTEL, VERORDNUNGSBESONDERHEITEN, UNFALLKENNZEICHEN } from '../codes/anlage3_v22.js';

const datum = s => /^\d{8}$/.test(s || '') && istStichtag(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
const geld = s => /^\d{1,10},\d{2}$/.test(s || '');
const cent = s => Math.round(Number(String(s || '0').replace(',', '.')) * 100);
const pflicht = (f, indices) => indices.every(i => f[i] !== undefined && f[i] !== '');

/** Additional output errors; no state mutation and no input-model dependency. */
export function pruefeAusgabeStruktur(content, fields) {
  const errors = [];
  const fail = s => errors.push(s);
  if (/[^\x20-\x7e\xa0-\xff]/.test(content)) fail('Datenstrom enthält unzulässige Steuerzeichen oder Zeichen außerhalb ISO-8859-1');
  if (!content.endsWith("'") || /(?:^|[^?])(?:\?\?)*\?'$/.test(content)) fail('Datenstrom endet nicht mit einem unentwerteten Segmentabschluss');
  const unb = fields[0] || [];
  if (unb[0] !== 'UNB' || unb.length !== 9 || unb[1] !== 'UNOC:3'
      || !/^\d{9}$/.test(unb[2] || '') || !/^\d{9}$/.test(unb[3] || '')
      || !/^\d{8}:[0-2]\d[0-5]\d$/.test(unb[4] || '') || !datum((unb[4] || '').slice(0, 8))
      || Number((unb[4] || '').slice(9, 11)) > 23
      || !/^\d{5}$/.test(unb[5] || '') || Number(unb[5]) < 1
      || unb[6] !== 'B' || !/^[A-Z0-9]{11}$/.test(unb[7] || '') || !/^[012]$/.test(unb[8] || '')) fail('UNB-Pflichtfelder, Syntax, Datum oder Referenz ungültig');
  const last = fields.at(-1) || [];
  if (last[0] !== 'UNZ' || last.length !== 3 || last[2] !== unb[5]) fail('UNZ fehlt am Dateiende oder Datenaustauschreferenz passt nicht zum UNB');
  if (fields.filter(f => f[0] === 'UNB').length !== 1 || fields.filter(f => f[0] === 'UNZ').length !== 1) fail('UNB/UNZ müssen jeweils genau einmal vorkommen');
  let message = null;
  const messages = [];
  let ordinal = 0;
  for (let i = 1; i < fields.length - 1; i++) {
    const f = fields[i];
    if (f[0] === 'UNH') {
      ordinal++;
      if (message) fail('Verschachtelte Nachricht');
      if (f.length !== 3 || f[1] !== String(ordinal).padStart(5, '0') || !/^(SLGA|SLLA):21:0:0$/.test(f[2] || '')) fail('UNH-Nachrichtenkennung, Version oder laufende Referenz ungültig');
      message = { type: (f[2] || '').split(':')[0], rows: [] };
    } else if (f[0] === 'UNT') {
      if (message) { pruefeNachricht(message, unb, fail); messages.push(message); }
      message = null;
    } else if (message) message.rows.push(f);
    else fail(`${f[0]} außerhalb einer Nachricht`);
  }
  if (!ordinal) fail('Mindestens eine SLGA/SLLA-Nachricht erforderlich');
  pruefeRechnungsgruppen(messages, fail);
  return errors;
}

function pruefeNachricht({ type, rows }, unb, fail) {
  const tags = rows.map(f => f[0]).join(' ');
  const grammar = type === 'SLGA'
    ? /^FKT REC (?:UST )?(?:SKO ){0,9}(?:GES ){2,9}NAM$/
    : /^FKT REC (?:INV (?:URI )?NAD (?:IMG )?(?:EVO )?(?:EHE (?:TXT )?(?:MWS )?)+ZHE (?:DIA )+(?:SKZ )?(?:BES|GZF)(?: |$))+$/;
  if (!grammar.test(tags)) fail(`${type}: Pflichtsegmente, Segmentfolge oder Wiederholungszahl ungültig`);
  const fkt = rows[0] || [];
  if (!['01', '02', '03', '04', '10'].includes(fkt[1]) || fkt[3] !== unb[2]
      || !/^\d{9}$/.test(fkt[4] || '') || (fkt[2] !== 'J' && !/^\d{9}$/.test(fkt[5] || ''))) fail(`${type}.FKT: Pflichtfelder oder Absenderbezug ungültig`);
  const maxFields = { FKT: type === 'SLGA' ? 7 : 6, REC: 4, INV: 6, URI: 5, NAD: 8, IMG: 4, EVO: 2, EHE: 8, TXT: 2, MWS: 3, ZHE: 18, DIA: 3, SKZ: 4, BES: 6, GZF: 4, UST: 3, SKO: 3, GES: 5, NAM: 5 };
  let gross = 0, copay = 0, tax = 0;
  const statuses = new Set();
  const ges = [];
  let uri = false;
  for (const f of rows) {
    const tag = f[0];
    if (maxFields[tag] === undefined || f.length > maxFields[tag]) fail(`${type}.${tag}: unbekanntes Segment oder zu viele Felder`);
    if (tag === 'REC' && (!pflicht(f, [1, 2, 3]) || !/^[A-Za-z0-9/-]{1,14}:[A-Za-z0-9]{1,6}$/.test(f[1]) || !datum(f[2]) || !/^[123]$/.test(f[3]))) fail('REC-Pflichtfelder oder Datum ungültig');
    if (tag === 'INV') {
      gross = 0; copay = 0; tax = 0; uri = false;
      // The supported praxis pipeline requires insured identity/status; checksum
      // validation remains in input preflight (not repeated on historical fixtures).
      if (!/^[A-Z]\d{9}$/.test(f[1] || '') || !/^[1359]\d{4}$/.test(f[2] || '') || !/^.{1,20}$/.test(f[4] || '')) fail('INV-Versichertenidentität, Status oder Belegnummer ungültig');
    }
    if (tag === 'URI') { uri = true; if (!/^\d{9}$/.test(f[1] || '') || !f[2] || !datum(f[3]) || !f[4]) fail('URI-Pflichtfelder ungültig'); }
    if (tag === 'NAD' && (!pflicht(f, [1, 2, 3]) || !datum(f[3]))) fail('NAD-Pflichtfelder oder Geburtsdatum ungültig');
    if (tag === 'EHE') {
      if (!/^\d{2}:[A-Z0-9]{5}$/.test(f[1] || '') || !/^\d{5}$/.test(f[2] || '') || !/^\d{1,4},\d{2}$/.test(f[3] || '') || cent(f[3]) <= 0 || !geld(f[4]) || !datum(f[5]) || (f[6] && (!geld(f[6]) || cent(f[6]) > cent(f[4])))) fail('EHE-Pflichtfelder, Menge, Betrag oder Leistungsdatum ungültig');
      gross += Math.round(cent(f[4]) * cent(f[3]) / 100);
      copay += Math.round(cent(f[6]) * cent(f[3]) / 100);
    }
    if (tag === 'MWS') { if (!geld(f[2])) fail('MWS-Betrag ungültig'); tax += cent(f[2]); }
    if (tag === 'ZHE') {
      if (!pflicht(f, [1, 2, 3, 4, 5, 6, 13, 15, 17]) || !datum(f[3])
          || !/^\d{9}$/.test(f[1] || '') || !/^\d{9}$/.test(f[2] || '')
          || !ZUZAHLUNGSKENNZEICHEN[f[4]] || !/^[A-Za-z0-9]{1,4}$/.test(f[5] || '')
          || (!VERORDNUNGSART_HEILMITTEL[f[6]] && f[6] !== '99')
          || (f[7] && !VERORDNUNGSBESONDERHEITEN[f[7]]) || (f[8] && !UNFALLKENNZEICHEN[f[8]])
          || (f[9] && f[9] !== '6') || f[10] || (f[11] && f[11] !== '1') || (f[12] && f[12] !== '1')
          || !/^(?:[01]{4}|9999)$/.test(f[13] || '') || !/^[01]$/.test(f[15] || '')
          || (f[16] && !/^[1-5]$/.test(f[16])) || !/^\d$/.test(f[17] || '')
          || ((f[13] === '0000' || f[13]?.[3] === '1') && !f[14])) fail('ZHE-Pflichtfelder, Schlüssel oder Ausstellungsdatum ungültig');
    }
    if (tag === 'DIA' && !f[1] && !f[2]) fail('DIA ohne Diagnose');
    if (tag === 'NAM' && !f[1]) fail('NAM-Rechnungssteller fehlt');
    if (tag === 'GES') {
      if (statuses.has(f[1]) || !geld(f[2]) || !geld(f[3]) || (f[4] && !geld(f[4]))) fail('GES-Status doppelt oder Betrag ungültig');
      if (!statuses.size && f[1] !== '00') fail('GES-Gesamtsumme 00 muss zuerst stehen');
      statuses.add(f[1]);
      ges.push(f);
    }
    if (tag === 'BES' || tag === 'GZF') {
      if (fkt[1] !== '01' && !uri) fail('URI-Ursprungsbezug fehlt im Korrekturverfahren');
      if ((tag === 'GZF') !== (fkt[1] === '03')) fail('BES/GZF passt nicht zum Verarbeitungskennzeichen');
      if (f.slice(1).some(s => s && !geld(s)) || !geld(f[1])) fail(`${tag}-Betrag ungültig`);
      if (tag === 'BES' && cent(f[1]) !== gross + tax) fail('BES-Brutto stimmt nicht mit EHE/MWS überein');
      if (tag === 'BES' && cent(f[2]) > cent(f[1])) fail('BES-Zuzahlung überschreitet Brutto');
      if (tag === 'BES' && f[3] && cent(f[3]) !== copay) fail('BES-Prozentzuzahlung stimmt nicht mit EHE überein');
      if (tag === 'GZF' && f[2] && cent(f[2]) !== copay) fail('GZF-Prozentzuzahlung stimmt nicht mit EHE überein');
      const total = tag === 'BES' ? f[2] : f[1];
      const percent = tag === 'BES' ? f[3] : f[2];
      const fixed = tag === 'BES' ? f[4] : f[3];
      if (total && cent(total) !== cent(percent) + cent(fixed)) fail(`${tag}-Zuzahlung stimmt nicht mit Teilbeträgen überein`);
    }
  }
  if (ges.length >= 2) {
    for (const column of [2, 3, 4]) {
      if (cent(ges[0][column]) !== ges.slice(1).reduce((sum, f) => sum + cent(f[column]), 0)) fail('GES-Gesamtsumme stimmt nicht mit Statussummen überein');
    }
  }
}

// Anlage 1 §5.3.2, §5.5.2: each regular SLGA covers its following SLLA
// messages. A Sammel-SLGA (J) aggregates the matching regular SLGA groups.
function pruefeRechnungsgruppen(messages, fail) {
  const groups = [];
  let current = null;
  const add = (map, status, values) => {
    const previous = map.get(status) || [0, 0, 0];
    map.set(status, previous.map((v, i) => v + values[i]));
  };
  for (const message of messages) {
    const fkt = message.rows.find(f => f[0] === 'FKT') || [];
    const rec = message.rows.find(f => f[0] === 'REC') || [];
    if (message.type === 'SLGA') {
      const group = { fkt, rec, rows: message.rows, totals: new Map(), count: 0 };
      groups.push(group);
      current = fkt[2] === 'J' ? null : group;
      continue;
    }
    if (!current) { fail('SLLA ohne vorangehende zugehörige Gesamtrechnungs-SLGA'); continue; }
    if ([1, 3, 4, 5].some(i => fkt[i] !== current.fkt[i]) || [1, 2, 3].some(i => rec[i] !== current.rec[i])) fail('SLLA-FKT/REC passt nicht zur Gesamtrechnungs-SLGA');
    let status = '99';
    for (const row of message.rows) {
      if (row[0] === 'INV') status = ({ '1': '11', '3': '31', '5': '51' })[row[2]?.[0]] || '99';
      if (row[0] === 'BES' || row[0] === 'GZF') {
        const gross = row[0] === 'BES' ? cent(row[1]) : 0;
        const copay = cent(row[row[0] === 'BES' ? 2 : 1]);
        const values = [row[0] === 'BES' ? gross - copay : copay, gross, copay];
        add(current.totals, '00', values); add(current.totals, status, values); current.count++;
      }
    }
  }
  for (const group of groups) {
    if (group.fkt[2] === 'J') {
      const children = groups.filter(g => g.fkt[2] !== 'J' && [1, 3, 4].every(i => g.fkt[i] === group.fkt[i]) && g.rec[1]?.split(':')[0] === group.rec[1]?.split(':')[0] && g.rec[2] === group.rec[2]);
      for (const child of children) for (const [status, values] of child.totals) add(group.totals, status, values);
      group.count = children.length;
    }
    if (!group.count) fail('SLGA ohne zugehörige Abrechnungsfälle');
    const ges = group.rows.filter(f => f[0] === 'GES');
    for (const row of ges) {
      const expected = group.totals.get(row[1]);
      if (!expected || expected.some((value, i) => value !== cent(row[i + 2]))) fail('SLGA-GES stimmt nicht mit zugehörigen SLLA-BES/GZF überein');
    }
    if ([...group.totals.keys()].some(status => !ges.some(f => f[1] === status))) fail('SLGA-GES-Statusaufschlüsselung ist unvollständig');
  }
}
