import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sperreBannerText,
  aktualisiereArztSperreBanner,
  installiereArztSperreBanner,
  BANNER_ID,
} from './arztangaben-banner.js';
import { SPEICHERN_HINWEIS } from './podo-arztangaben.js';

test('podo + leer -> Text', () => {
  assert.equal(sperreBannerText({ bereich: 'podo', lanr: '', unterschrift: false }), SPEICHERN_HINWEIS);
  assert.equal(sperreBannerText({ bereich: 'podo' }), SPEICHERN_HINWEIS);
  assert.equal(sperreBannerText({ bereich: 'podo', lanr: null, unterschrift: null }), SPEICHERN_HINWEIS);
});

test('podo + LANR 9-stellig + Unterschrift -> leer', () => {
  assert.equal(sperreBannerText({ bereich: 'podo', lanr: '123456789', unterschrift: true }), '');
  assert.equal(sperreBannerText({ bereich: 'podo', lanr: '  123456789  ', unterschrift: true }), '');
});

test('physio -> leer', () => {
  assert.equal(sperreBannerText({ bereich: 'physio', lanr: '', unterschrift: false }), '');
  assert.equal(sperreBannerText({ bereich: 'physio', lanr: '999999999', unterschrift: false }), '');
  assert.equal(sperreBannerText({ bereich: 'ergo', lanr: '', unterschrift: false }), '');
  assert.equal(sperreBannerText({ bereich: 'logo', lanr: '', unterschrift: false }), '');
});

test('LANR 999999999 -> Text', () => {
  assert.equal(sperreBannerText({ bereich: 'podo', lanr: '999999999', unterschrift: true }), SPEICHERN_HINWEIS);
  assert.equal(sperreBannerText({ bereich: 'podo', lanr: ' 999999999 ', unterschrift: true }), SPEICHERN_HINWEIS);
});

test('Unterschrift fehlt -> Text', () => {
  for (const u of [false, null, undefined]) {
    assert.equal(sperreBannerText({ bereich: 'podo', lanr: '123456789', unterschrift: u }), SPEICHERN_HINWEIS);
  }
});

test('Bereich leer -> leer', () => {
  for (const b of ['', ' ', null, undefined]) {
    assert.equal(sperreBannerText({ bereich: b, lanr: '', unterschrift: false }), '');
    assert.equal(sperreBannerText({ bereich: b, lanr: '999999999', unterschrift: false }), '');
  }
  assert.equal(sperreBannerText({}), '');
  assert.equal(sperreBannerText(), '');
});

test('aktualisiere ohne document wirft nicht', () => {
  const orig = globalThis.document;
  try {
    delete globalThis.document;
    assert.doesNotThrow(() => aktualisiereArztSperreBanner());
  } finally {
    if (orig !== undefined) globalThis.document = orig;
    else delete globalThis.document;
  }
});

test('installiere ohne document wirft nicht', () => {
  const orig = globalThis.document;
  try {
    delete globalThis.document;
    assert.doesNotThrow(() => installiereArztSperreBanner());
  } finally {
    if (orig !== undefined) globalThis.document = orig;
    else delete globalThis.document;
  }
});

test('aktualisiere mit unvollstaendigen DOM-Feldern tut nichts und wirft nicht', () => {
  const orig = globalThis.document;
  try {
    globalThis.document = { getElementById: () => null };
    assert.doesNotThrow(() => aktualisiereArztSperreBanner());
  } finally {
    if (orig !== undefined) globalThis.document = orig;
    else delete globalThis.document;
  }
});

test('BANNER_ID Konstante ist rzSperreBanner', () => {
  assert.equal(BANNER_ID, 'rzSperreBanner');
});
