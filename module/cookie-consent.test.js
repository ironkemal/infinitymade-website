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
function lauf(gespeichert = {}, hash = '', schreibbar = true, fehler = {}, cookies = {}) {
  const speicher = { ...gespeichert };
  const geladeneSkripte = [];
  let reloads = 0;
  const events = {};
  const entfernungen = [];
  const cookieSchreibungen = [];

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
    getItem: (k) => {
      if (fehler.lesen?.(k)) throw new Error('read blocked');
      return k in speicher ? speicher[k] : null;
    },
    setItem: (k, v) => {
      if (!schreibbar || fehler.schreiben?.(k, v)) throw new Error('storage blocked');
      speicher[k] = v;
    },
    removeItem: (k) => {
      entfernungen.push(k);
      if (fehler.entfernen?.(k)) throw new Error('remove blocked');
      delete speicher[k];
    },
  };
  globalThis.document = {
    readyState: 'complete', body, head: machElement('head'),
    createElement: machElement,
    createTextNode: (t) => ({ nodeValue: t, textContent: t }),
    getElementById: (id) => body.children.find((c) => c.id === id) || null,
    addEventListener: () => {},
  };
  Object.defineProperty(globalThis.document, 'cookie', {
    get() {
      if (fehler.cookieLesen) throw new Error('cookie read blocked');
      return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set(wert) {
      cookieSchreibungen.push(wert);
      if (fehler.cookieSchreiben) throw new Error('cookie write blocked');
      if (fehler.cookieIgnorieren) return;
      const [paar] = wert.split(';');
      const [k, v] = paar.split('=');
      if (/Max-Age=0(?:;|$)/i.test(wert)) delete cookies[k];
      else cookies[k] = v;
    },
  });
  globalThis.window = { addEventListener: (typ, fn) => { events[typ] = fn; } };
  globalThis.location = { hash, reload: () => { reloads++; } };

  new Function(QUELLE)();

  const fenster = globalThis.window;
  const doc = globalThis.document;
  const banner = () => body.children.find((c) => c.id === 'cookie-banner') || null;
  return {
    speicher, cookies, entfernungen, cookieSchreibungen, geladeneSkripte, banner,
    pagehide: () => events.pagehide?.(),
    storage: () => events.storage?.(),
    einstellungen: () => fenster.praxuraCookieEinstellungen(),
    reloads: () => reloads,
    vorSenden: (payload) => fenster.praxuraUmamiVorSenden('event', payload),
    skriptAttribute: () => doc.head.children[0]?.attrs,
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

test('Widerruf beendet die laufende Messung vor dem Reload und überlebt Seitenneuladung', () => {
  const l = lauf();
  l.knopf('Akzeptieren')._click();
  assert.deepEqual(l.vorSenden({ url: '/synthetisch' }), { url: '/synthetisch' });
  assert.equal(l.skriptAttribute()['data-before-send'], 'praxuraUmamiVorSenden');
  window.praxuraCookieEinstellungen();
  l.knopf('Ablehnen')._click();
  assert.equal(l.vorSenden({ url: '/weiter' }), false);
  assert.equal(l.reloads(), 1);
  const danach = lauf(l.speicher);
  assert.equal(danach.geladeneSkripte.length, 0);
  assert.equal(danach.vorSenden({ url: '/weiter' }), false);
});

test('Widerruf bleibt bei blockierter Speicherung wirksam und lädt kein altes accepted neu', () => {
  const l = lauf();
  l.knopf('Akzeptieren')._click();
  window.praxuraCookieEinstellungen();
  globalThis.localStorage.setItem = () => { throw new Error('storage blocked'); };
  l.knopf('Ablehnen')._click();
  assert.equal(l.speicher.cookie_consent, undefined);
  assert.equal(l.vorSenden({ event: 'manuell' }), false);
  assert.equal(l.reloads(), 1);
  assert.equal(lauf(l.speicher).geladeneSkripte.length, 0);
});

test('altes accepted wird ohne schreibbaren Speicher nicht erneut aktiviert', () => {
  const l = lauf({ cookie_consent: 'accepted', cookie_consent_zeitpunkt: String(Date.now()) }, '', false);
  assert.equal(l.geladeneSkripte.length, 0);
  assert.ok(l.banner());
  assert.equal(l.vorSenden({ event: 'auto' }), false);
});

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

const ACCEPTED = () => ({ cookie_consent: 'accepted', cookie_consent_zeitpunkt: String(Date.now()) });
const MARKER = '__Host-praxura_consent_widerruf';

for (const blockiert of [null, 'cookie_consent', 'cookie_consent_zeitpunkt']) {
  test(`fehlgeschlagener Widerruf entfernt beide Schlüssel unabhängig (${blockiert})`, () => {
    const fehler = {};
    const l = lauf(ACCEPTED(), '', true, fehler);
    fehler.schreiben = () => true;
    fehler.entfernen = (k) => k === blockiert;
    l.einstellungen();
    l.knopf('Ablehnen')._click();
    assert.deepEqual(l.entfernungen, ['cookie_consent', 'cookie_consent_zeitpunkt']);
    assert.equal(l.vorSenden({}), false);
    assert.equal(lauf(l.speicher, '', true, {}, l.cookies).geladeneSkripte.length, 0);
    assert.equal(l.cookies[MARKER], undefined, 'kein Fallback bei nachgewiesener Invalidierung');
  });
}

test('beide Löschungen blockiert: verifizierter Host-Cookie sperrt stale accepted vor jedem Opt-in', () => {
  const fehler = {};
  const l = lauf(ACCEPTED(), '', true, fehler);
  fehler.schreiben = () => true;
  fehler.entfernen = () => true;
  l.einstellungen();
  l.knopf('Ablehnen')._click();
  assert.equal(l.speicher.cookie_consent, 'accepted');
  assert.equal(l.cookies[MARKER], '1');
  assert.ok(l.cookieSchreibungen.some((v) => v === `${MARKER}=1; Path=/; Secure; SameSite=Lax; Max-Age=31536000`));
  assert.equal(l.reloads(), 1);
  const neu = lauf(l.speicher, '', true, {}, l.cookies);
  assert.equal(neu.geladeneSkripte.length, 0);
  assert.equal(neu.vorSenden({}), false);
  neu.einstellungen();
  neu.knopf('Akzeptieren')._click();
  assert.equal(neu.cookies[MARKER], undefined);
  assert.equal(neu.geladeneSkripte.length, 1, 'frischer expliziter Opt-in erlaubt');
});

for (const phase of ['zeitpunkt', 'readback']) {
  test(`Teilfehler ${phase}: Widerruf wird invalidiert statt als gespeichert gemeldet`, () => {
    const fehler = {};
    const l = lauf(ACCEPTED(), '', true, fehler);
    if (phase === 'zeitpunkt') fehler.schreiben = (k) => k === 'cookie_consent_zeitpunkt';
    else fehler.lesen = () => true;
    l.einstellungen();
    l.knopf('Ablehnen')._click();
    assert.deepEqual(l.entfernungen, ['cookie_consent', 'cookie_consent_zeitpunkt']);
    assert.equal(l.speicher.cookie_consent, undefined);
    assert.equal(lauf(l.speicher, '', true, {}, l.cookies).geladeneSkripte.length, 0);
  });
}

for (const cookieFehler of ['cookieSchreiben', 'cookieIgnorieren', 'cookieLesen']) {
  test(`alle dauerhaften Wege unbestätigt (${cookieFehler}): Dokument gesperrt, kein Reload`, () => {
    const fehler = {};
    const l = lauf(ACCEPTED(), '', true, fehler);
    fehler.schreiben = () => true;
    fehler.entfernen = () => true;
    fehler[cookieFehler] = true;
    l.einstellungen();
    l.knopf('Ablehnen')._click();
    assert.equal(l.vorSenden({}), false);
    assert.equal(l.reloads(), 0);
  });
}

test('pagehide versucht offenen Widerruf erneut, sobald Speicher wieder funktioniert', () => {
  const fehler = {};
  const l = lauf(ACCEPTED(), '', true, fehler);
  fehler.schreiben = () => true;
  fehler.entfernen = () => true;
  fehler.cookieSchreiben = true;
  l.einstellungen();
  l.knopf('Ablehnen')._click();
  delete fehler.schreiben;
  delete fehler.entfernen;
  l.pagehide();
  assert.equal(l.speicher.cookie_consent, 'declined');
  assert.equal(l.vorSenden({}), false);
  assert.equal(lauf(l.speicher).geladeneSkripte.length, 0);
});

test('frischer Opt-in nach rein dokumentlokalem Widerruf beendet ausstehenden Retry', () => {
  const fehler = {};
  const l = lauf(ACCEPTED(), '', true, fehler);
  fehler.schreiben = () => true;
  fehler.entfernen = () => true;
  fehler.cookieSchreiben = true;
  l.einstellungen();
  l.knopf('Ablehnen')._click();
  delete fehler.schreiben;
  l.einstellungen();
  l.knopf('Akzeptieren')._click();
  l.pagehide();
  assert.equal(l.speicher.cookie_consent, 'accepted');
  assert.deepEqual(l.vorSenden({ ok: true }), { ok: true });
});

test('Marker bleibt aktiv, wenn expliziter Opt-in ihn nicht löschen kann', () => {
  const l = lauf(ACCEPTED(), '', true, { cookieIgnorieren: true }, { [MARKER]: '1' });
  l.einstellungen();
  l.knopf('Akzeptieren')._click();
  assert.equal(l.geladeneSkripte.length, 0);
  assert.equal(l.vorSenden({}), false);
});

test('Regression: Speicher erholt sich vor Navigation, stale accepted darf nicht starten', () => {
  const fehler = {};
  const l = lauf(ACCEPTED(), '', true, fehler);
  fehler.schreiben = () => true;
  l.einstellungen();
  l.knopf('Ablehnen')._click();
  const neu = lauf(l.speicher, '', true, {}, l.cookies);
  assert.equal(neu.geladeneSkripte.length, 0);
});

test('vollständiger Storage-Ausfall plus Cookie-Ausfall hält laufenden Tracker gesperrt', () => {
  const fehler = {};
  const l = lauf(ACCEPTED(), '', true, fehler);
  fehler.lesen = () => true;
  fehler.schreiben = () => true;
  fehler.entfernen = () => true;
  fehler.cookieSchreiben = true;
  fehler.cookieLesen = true;
  l.einstellungen();
  l.knopf('Ablehnen')._click();
  l.pagehide();
  assert.equal(l.vorSenden({}), false);
  assert.equal(l.reloads(), 0);
});

test('Marker wird nach verifiziertem pagehide-Widerruf entfernt', () => {
  const fehler = {};
  const l = lauf(ACCEPTED(), '', true, fehler);
  fehler.schreiben = () => true;
  fehler.entfernen = () => true;
  l.einstellungen();
  l.knopf('Ablehnen')._click();
  assert.equal(l.cookies[MARKER], '1');
  delete fehler.schreiben;
  l.pagehide();
  assert.equal(l.cookies[MARKER], undefined);
  assert.equal(l.speicher.cookie_consent, 'declined');
});

for (const unlesbar of ['cookie_consent', 'cookie_consent_zeitpunkt']) {
  test(`Invalidierung bleibt nachweisbar bei einzelnem Lesefehler (${unlesbar})`, () => {
    const fehler = {};
    const l = lauf(ACCEPTED(), '', true, fehler);
    fehler.schreiben = () => true;
    fehler.lesen = (k) => k === unlesbar;
    l.einstellungen();
    l.knopf('Ablehnen')._click();
    assert.equal(l.reloads(), 1);
    assert.equal(l.cookies[MARKER], undefined);
    assert.equal(lauf(l.speicher).geladeneSkripte.length, 0);
  });
}

test('unlesbarer Cookie sperrt gespeicherten Opt-in vor Skript-Injektion', () => {
  const l = lauf(ACCEPTED(), '', true, { cookieLesen: true });
  assert.equal(l.geladeneSkripte.length, 0);
  assert.ok(l.banner());
});

test('Widerruf in anderem Tab stoppt laufende Messung dieses Tabs (storage-Ereignis)', () => {
  const l = lauf(ACCEPTED());
  assert.deepEqual(l.vorSenden({ url: '/a' }), { url: '/a' });
  l.speicher.cookie_consent = 'declined'; // anderer Tab hat abgelehnt
  l.storage();
  assert.equal(l.vorSenden({ url: '/b' }), false);
});
