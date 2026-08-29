// Bauart-Test für `cookie-consent.js` (liegt im Wurzelverzeichnis, wird aber von
// `npm test` nur unter `module/**/*.test.js` gefunden — deshalb liegt der Test hier).
//
// Warum es diesen Test gibt: das Skript ist die Einwilligungsschranke vor der
// Reichweitenmessung und läuft auf 30 öffentlichen Seiten. Es ist kein Feature,
// sondern eine Rechtspflicht — § 25 Abs. 1 TDDDG für das Laden, Art. 7 Abs. 3 S. 4
// DSGVO für den Widerruf. Bricht es still, misst die Seite entweder ohne
// Einwilligung oder gar nicht, und beides fällt niemandem auf.
//
// Die geprüften Eigenschaften sind bewusst die rechtlich relevanten, nicht die
// kosmetischen: lädt nichts ohne Zustimmung · Widerruf erreichbar · abgelaufene
// und alte Zustimmungen werden neu erfragt · beide Knöpfe gleich prominent.
// Vorgeschichte und Fundstellen: `compliance/LEGAL_DECISIONS.md`, 29.08.2026.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = fs.readFileSync(path.join(WURZEL, 'cookie-consent.js'), 'utf8');

/** Minimales DOM — nur das, was das Skript wirklich anfasst. */
function lauf(gespeichert = {}, hash = '') {
  const speicher = { ...gespeichert };
  const geladeneSkripte = [];

  const machElement = (tag) => {
    const el = {
      tagName: tag, style: { cssText: '' }, children: [], attrs: {}, id: '',
      parentNode: null, _click: null, textContent: '', href: '', type: '',
      appendChild(k) { k.parentNode = el; el.children.push(k); return k; },
      removeChild(k) { el.children = el.children.filter((c) => c !== k); k.parentNode = null; },
      setAttribute(n, v) { el.attrs[n] = v; if (n === 'src') el.src = v; },
      addEventListener(t, f) { if (t === 'click') el._click = f; },
      focus() {},
      closest() { return null; },
    };
    Object.defineProperty(el, 'src', {
      get() { return el.attrs.src; },
      set(v) { el.attrs.src = v; if (tag === 'script') geladeneSkripte.push(v); },
      configurable: true,
    });
    return el;
  };

  const body = machElement('body');
  globalThis.localStorage = {
    getItem: (k) => (k in speicher ? speicher[k] : null),
    setItem: (k, v) => { speicher[k] = v; },
  };
  globalThis.document = {
    readyState: 'complete', body, head: machElement('head'),
    createElement: machElement,
    createTextNode: (t) => ({ nodeValue: t, textContent: t }),
    getElementById: (id) => body.children.find((c) => c.id === id) || null,
    addEventListener: () => {},
  };
  globalThis.window = { addEventListener: () => {} };
  globalThis.location = { hash };

  new Function(QUELLE)();

  const banner = () => body.children.find((c) => c.id === 'cookie-banner') || null;
  return {
    speicher, geladeneSkripte, banner,
    knopf: (name) => {
      const b = banner();
      return b && b.children.find((c) => c.tagName === 'button' && c.textContent === name);
    },
    bannerText: () => {
      const b = banner();
      if (!b) return '';
      return b.children[0].children.map((c) => c.textContent || c.nodeValue || '').join('');
    },
  };
}

test('ohne Entscheidung wird nichts geladen, der Banner erscheint', () => {
  const u = lauf({});
  assert.ok(u.banner(), 'kein Banner');
  assert.equal(u.geladeneSkripte.length, 0, 'Messskript ohne Einwilligung geladen');
});

test('der Banner behauptet nicht mehr, es gebe keine personenbezogenen Daten', () => {
  // Die Aussage war mit hoher Wahrscheinlichkeit falsch (täglicher Pseudonym-Hash
  // aus IP + User-Agent) und machte die darauf gestützte Einwilligung angreifbar.
  const t = lauf({}).bannerText();
  assert.ok(!/[Kk]eine personenbezogenen Daten/.test(t), 'alte Falschaussage wieder da');
  assert.ok(/widerrufbar/.test(t), 'Hinweis auf den Widerruf fehlt');
});

test('der Banner verlinkt die Datenschutzerklärung', () => {
  const b = lauf({}).banner();
  const a = b.children[0].children.find((c) => c.tagName === 'a');
  assert.ok(a && /datenschutz/.test(a.href), 'kein Link zur Datenschutzerklärung');
});

test('beide Knöpfe sind gleich breit — kein optisches Übergewicht', () => {
  const u = lauf({});
  const breite = (b) => (b.style.cssText.match(/min-width:(\d+)px/) || [])[1];
  assert.equal(breite(u.knopf('Ablehnen')), breite(u.knopf('Akzeptieren')));
});

test('Akzeptieren speichert mit Zeitstempel und lädt genau einmal', () => {
  const u = lauf({});
  u.knopf('Akzeptieren')._click();
  assert.equal(u.speicher.cookie_consent, 'accepted');
  assert.ok(Number(u.speicher.cookie_consent_zeitpunkt) > 0, 'kein Zeitstempel gespeichert');
  assert.equal(u.geladeneSkripte.length, 1);
  assert.equal(u.banner(), null, 'Banner blieb stehen');
});

test('Ablehnen lädt nichts und fragt nicht erneut', () => {
  const u = lauf({});
  u.knopf('Ablehnen')._click();
  assert.equal(u.speicher.cookie_consent, 'declined');
  assert.equal(u.geladeneSkripte.length, 0);

  const spaeter = lauf({ cookie_consent: 'declined', cookie_consent_zeitpunkt: String(Date.now()) });
  assert.equal(spaeter.banner(), null, 'fragt trotz Ablehnung erneut');
  assert.equal(spaeter.geladeneSkripte.length, 0);
});

test('eine frische Zustimmung lädt sofort, ohne erneut zu fragen', () => {
  const u = lauf({ cookie_consent: 'accepted', cookie_consent_zeitpunkt: String(Date.now()) });
  assert.equal(u.geladeneSkripte.length, 1);
  assert.equal(u.banner(), null);
});

test('Zustimmung ohne Zeitstempel gilt nicht weiter', () => {
  // Altbestand: erteilt unter dem irreführenden Bannertext von vor dem 29.08.2026.
  const u = lauf({ cookie_consent: 'accepted' });
  assert.ok(u.banner(), 'alte Zustimmung stillschweigend übernommen');
  assert.equal(u.geladeneSkripte.length, 0, 'lädt, bevor neu gefragt wurde');
});

test('nach dreizehn Monaten wird erneut gefragt', () => {
  const u = lauf({
    cookie_consent: 'accepted',
    cookie_consent_zeitpunkt: String(Date.now() - 400 * 86400000),
  });
  assert.ok(u.banner(), 'abgelaufene Zustimmung gilt weiter');
  assert.equal(u.geladeneSkripte.length, 0);
});

test('der Widerruf ist erreichbar — Anker und globale Funktion', () => {
  const perAnker = lauf(
    { cookie_consent: 'accepted', cookie_consent_zeitpunkt: String(Date.now()) },
    '#cookie-einstellungen');
  assert.ok(perAnker.banner(), 'der Anker öffnet die Einstellungen nicht');

  const perFunktion = lauf({ cookie_consent: 'declined', cookie_consent_zeitpunkt: String(Date.now()) });
  assert.equal(typeof globalThis.window.praxuraCookieEinstellungen, 'function');
  globalThis.window.praxuraCookieEinstellungen();
  assert.ok(perFunktion.banner(), 'die globale Funktion öffnet nichts');
});

test('zweimal Akzeptieren hängt das Messskript nicht doppelt ein', () => {
  const u = lauf({});
  u.knopf('Akzeptieren')._click();
  globalThis.window.praxuraCookieEinstellungen();
  u.knopf('Akzeptieren')._click();
  assert.equal(u.geladeneSkripte.length, 1, 'doppelt eingehängt');
});
