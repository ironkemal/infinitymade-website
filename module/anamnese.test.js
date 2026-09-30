import test from 'node:test';
import assert from 'node:assert/strict';
import { formHtml, rohAusRow } from './anamnese.js';
import { FORMULARE, ENTWURF_HINWEIS } from './anamnese-formulare.js';

test('Podo-Formular: alle Felder im Markup, Infektion im Kiosk NICHT', () => {
  const praxis = formHtml(FORMULARE.podo, { kiosk: false });
  const kiosk = formHtml(FORMULARE.podo, { kiosk: true });
  assert.match(praxis, /data-anf-feld="infektion"/);
  assert.doesNotMatch(kiosk, /data-anf-feld="infektion"/);
  assert.doesNotMatch(kiosk, /multiresistenter/);
  for (const id of ['diabetes', 'gerinnung', 'allergien', 'hausarzt', 'bemerkungen']) assert.match(kiosk, new RegExp(`data-anf-feld="${id}"`));
});

test('Kiosk: „weiß nicht" statt „unbekannt" und Hinweis bei Podologin-Feldern; Praxis nicht', () => {
  const kiosk = formHtml(FORMULARE.podo, { kiosk: true });
  const praxis = formHtml(FORMULARE.podo, { kiosk: false });
  assert.match(kiosk, /weiß nicht/);
  assert.match(kiosk, /Wenn Sie unsicher sind/);
  assert.doesNotMatch(praxis, /Wenn Sie unsicher sind/);
  assert.match(praxis, /value="unbekannt" \/> unbekannt/);
});

test('Exklusive Optionen tragen data-exklusiv; Freitext zu Allergien vorhanden', () => {
  const h = formHtml(FORMULARE.podo, { kiosk: false });
  assert.match(h, /name="anf_allergien" value="keine" data-exklusiv="keine"/);
  assert.match(h, /id="anf_allergien_text"/);
});

test('Entwurfsnotiz nur bei Ergo/Logo', () => {
  assert.match(formHtml(FORMULARE.ergo), new RegExp(ENTWURF_HINWEIS));
  assert.match(formHtml(FORMULARE.logo), new RegExp(ENTWURF_HINWEIS));
  assert.doesNotMatch(formHtml(FORMULARE.podo), /Entwurf/);
});

test('Zahlenfeld HbA1c trägt Grenzen; keine Roh-Entities im Markup', () => {
  const h = formHtml(FORMULARE.podo);
  assert.match(h, /min="3" max="20" step="0.1"/);
  assert.doesNotMatch(h, /&quot;M11/);
});

test('rohAusRow: felder + feste Spalten (Hausarzt) → Formularwerte', () => {
  const roh = rohAusRow(FORMULARE.podo, { felder: { diabetes: 'typ2', allergien: ['latex'], allergien_text: 'Jod', diabetes_seit: 2015 }, arzt_name: 'Dr. A', arzt_nummer: '1' });
  assert.equal(roh.diabetes, 'typ2');
  assert.deepEqual(roh.allergien, ['latex']);
  assert.equal(roh.allergien_text, 'Jod');
  assert.equal(roh.diabetes_seit, 2015);
  assert.deepEqual(roh.hausarzt, { name: 'Dr. A', telefon: '1' });
  assert.deepEqual(roh.gerinnung, []);
  assert.equal(roh.ulkus, null);
});
