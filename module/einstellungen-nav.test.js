import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navEintraege } from './einstellungen-nav.js';

test('navEintraege: Gruppenköpfe nur vor sichtbaren Abschnitten, unsichtbare und titellose fallen weg', () => {
  const z = [
    { gruppe: 'Allgemein', id: 'a', titel: 'Profil', sichtbar: true },
    { gruppe: 'Allgemein', id: 'b', titel: 'Ausfallgebühr', sichtbar: false },
    { gruppe: 'Abrechnung', id: 'c', titel: '', sichtbar: true },
    { gruppe: 'Abrechnung', id: 'd', titel: 'Rechnungsdaten', sichtbar: true },
    { gruppe: 'Leer', id: 'e', titel: 'X', sichtbar: false },
  ];
  assert.deepEqual(navEintraege(z), [
    { art: 'gruppe', titel: 'Allgemein' }, { art: 'abschnitt', id: 'a', titel: 'Profil' },
    { art: 'gruppe', titel: 'Abrechnung' }, { art: 'abschnitt', id: 'd', titel: 'Rechnungsdaten' },
  ]);
  assert.deepEqual(navEintraege(null), []);
});

// ── Kategorie-Modus (main, Pflichtpunkt 8, 23.11.2026) ──
import { readFileSync } from 'node:fs';
import { bereicheAus, bereichWaehlen, trifftSuche, bereichAusHash, NACHGELADEN } from './einstellungen-nav.js';

test('bereicheAus: nur Bereiche mit sichtbarem Abschnitt (System nur Inhaber+Box)', () => {
  assert.deepEqual(bereicheAus([
    { slug: 'allgemein', titel: 'Allgemein', sichtbareAbschnitte: 3 },
    { slug: 'system', titel: 'System', sichtbareAbschnitte: 0 },
    { slug: 'konto', titel: ' Konto ', sichtbareAbschnitte: 1 },
  ]), [{ slug: 'allgemein', titel: 'Allgemein' }, { slug: 'konto', titel: 'Konto' }]);
});

test('bereichWaehlen: gemerkter/Hash-Bereich nur, wenn sichtbar', () => {
  const b = [{ slug: 'allgemein' }, { slug: 'konto' }];
  assert.equal(bereichWaehlen('konto', b), 'konto');
  assert.equal(bereichWaehlen('system', b), 'allgemein');
  assert.equal(bereichWaehlen(null, []), null);
});

test('trifftSuche: Groß/klein und Umlaute egal, leere Suche trifft alles', () => {
  assert.equal(trifftSuche('Ausfallgebühr', 'gebuhr'), true);
  assert.equal(trifftSuche('DATEV-Export', 'datev'), true);
  assert.equal(trifftSuche('Profil', 'konto'), false);
  assert.equal(trifftSuche('Straße', 'strasse'), true);
  assert.equal(trifftSuche('x', '  '), true);
});

test('bereichAusHash: nur #settings/<slug>, keine fremden Zeichen', () => {
  assert.equal(bereichAusHash('#settings/termine'), 'termine');
  assert.equal(bereichAusHash('#settings/standorte'), 'praxis'); // alter Name → weitergeleitet
  assert.equal(bereichAusHash('#settings/<img>'), 'img');
  assert.equal(bereichAusHash('#kalender'), null);
});

test('dashboard.html: jeder Abschnitt steht in einem Bereich, NACHGELADEN zeigt auf vorhandene Bereiche', () => {
  const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
  const st = html.indexOf('<div class="settings-sections">');
  const block = html.slice(st, html.indexOf('<!-- /settings-sections -->'));
  const slugs = [...block.matchAll(/class="settings-group" data-einst="([a-z-]+)" data-einst-ober="[^"]+"/g)].map((m) => m[1]);
  assert.deepEqual(slugs, ['konto', 'praxis', 'termine', 'leistungen', 'dokumentation', 'briefkopf', 'team', 'kasse', 'rechnung', 'buchhaltung', 'kommunikation', 'aerzte', 'ki', 'datenschutz', 'abo', 'system']);
  for (const slug of Object.values(NACHGELADEN)) assert.ok(slugs.includes(slug), slug);
  // div-Bilanz: kein offener Abschnitt (Altfehler 23.11.: „Integrationen“ ohne </div> schluckte KI/System/DSGVO)
  assert.equal((block.match(/<div\b/g) || []).length, (block.match(/<\/div>/g) || []).length);
  // keine Abschnitte außerhalb einer Gruppe
  const ohne = block.replace(/<div class="settings-group"[\s\S]*?(?=<div class="settings-group"|$)/g, '');
  assert.equal(/class="settings-section"/.test(ohne), false);
});

import { abschnittFuerRolle, MITARBEITER_ABSCHNITTE } from './einstellungen-nav.js';
test('Mitarbeiter sehen nur persönliche Abschnitte, Inhaber alles (Melih 23.11.2026)', () => {
  assert.equal(abschnittFuerRolle('settingsPasswortSection', false), true);
  assert.equal(abschnittFuerRolle('settingsGoogleSection', false), true);
  for (const praxis of ['settingsProfileSection', 'settingsBillingSection', 'settingsBrandingSection', 'settingsDsgvoSection', 'settingsAccountSection', 'settingsSystemSection', 'settingsPaketSection', 'settingsKiSection', 'settingsVerweis-termine', 'aerzteSection']) {
    assert.equal(abschnittFuerRolle(praxis, false), false, praxis);
    assert.equal(abschnittFuerRolle(praxis, true), true, praxis);
  }
  assert.ok(MITARBEITER_ABSCHNITTE.size <= 6, 'Mitarbeiter-Liste bewusst klein halten');
});

// ── Phase 7b (23.11.2026): Weiterleitung, Obergruppen, Verweise ──
import { bereichNormal, nachOber, VERWEISE, ALT_BEREICH } from './einstellungen-nav.js';
test('alte Bereichsnamen landen im neuen Bereich (gespeicherte Links)', () => {
  assert.equal(bereichNormal('allgemein'), 'praxis');
  assert.equal(bereichNormal('dokumente'), 'kommunikation');
  assert.equal(bereichNormal('datev'), 'buchhaltung');
  assert.equal(bereichNormal('abrechnung'), 'kasse');
  assert.equal(bereichNormal('ki'), 'ki');
  assert.equal(bereichAusHash('#settings/recht'), 'datenschutz');
  assert.equal(bereichNormal(null), null);
});
test('jedes Weiterleitungsziel und jeder Verweis-Bereich existiert in dashboard.html', () => {
  const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
  for (const ziel of [...Object.values(ALT_BEREICH), ...Object.keys(VERWEISE)]) assert.ok(html.includes(`data-einst="${ziel}"`), ziel);
  for (const z of Object.values(VERWEISE).flat()) assert.ok(html.includes(`id="panel-${z.panel}"`), `panel-${z.panel} fehlt`);
});
test('nachOber: Obergruppen in Reihenfolge, ohne Obergruppe ohne Überschrift', () => {
  const g = nachOber([{ slug: 'a', ober: 'PRAXIS' }, { slug: 'b', ober: 'PRAXIS' }, { slug: 'c', ober: 'SYSTEM' }, { slug: 'd' }]);
  assert.deepEqual(g.map(([o, l]) => [o, l.map((x) => x.slug)]), [['PRAXIS', ['a', 'b']], ['SYSTEM', ['c']], ['', ['d']]]);
  assert.deepEqual(bereicheAus([{ slug: 'x', titel: 'X', ober: 'PRAXIS', sichtbareAbschnitte: 1 }]), [{ slug: 'x', titel: 'X', ober: 'PRAXIS' }]);
});
test('Abschnitte ohne ID haben jetzt eine (Mitarbeiter-Regel hängt daran)', () => {
  const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
  for (const id of ['settingsPasswortSection', 'settingsGoogleSection', 'settingsPaketSection']) assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
  assert.ok(html.slice(html.indexOf('id="settingsPasswortSection"')).indexOf('id="setPw"') < 400, 'setPw im Passwort-Abschnitt');
});
