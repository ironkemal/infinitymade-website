import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelAusHash, urlFuerPanel, erstellePanelVerlauf } from './panel-verlauf.js';

test('F-08 panelAusHash & urlFuerPanel: #ueberblick, clean overview, ungültige Hashes -> overview', () => {
  const existiert = (id) => ['overview', 'ueberblick', 'calendar', 'team'].includes(id);
  assert.equal(panelAusHash('', { existiert }), 'overview');
  assert.equal(panelAusHash('#overview', { existiert }), 'overview');
  assert.equal(panelAusHash('#ueberblick', { existiert }), 'ueberblick');
  assert.equal(panelAusHash('#CALENDAR', { existiert }), 'calendar');
  assert.equal(panelAusHash('#unbekannt', { existiert }), 'overview');
  assert.equal(panelAusHash('#../evil', { existiert }), 'overview');

  assert.equal(urlFuerPanel('overview', { pathname: '/dashboard.html', search: '' }), '/dashboard.html');
  assert.equal(urlFuerPanel('ueberblick', { pathname: '/dashboard.html', search: '' }), '/dashboard.html#ueberblick');
  assert.equal(urlFuerPanel('team', { pathname: '/dashboard.html', search: '?design=alt' }), '/dashboard.html?design=alt#team');
});

test('F-08 erstellePanelVerlauf: pushState, Reload (#ueberblick) und Zurück (popstate) ohne Endlosschleife', async () => {
  const listeners = new Map();
  const stack = [{ url: '/dashboard.html', state: null }];
  let idx = 0;
  const win = {
    location: {
      pathname: '/dashboard.html',
      search: '',
      get hash() {
        const u = stack[idx].url;
        const p = u.indexOf('#');
        return p >= 0 ? u.slice(p) : '';
      },
    },
    history: {
      pushState(st, _title, url) {
        stack.splice(idx + 1);
        stack.push({ url, state: st });
        idx = stack.length - 1;
      },
    },
    addEventListener(ev, fn) { listeners.set(ev, fn); },
  };

  let aktiv = 'overview';
  const wechsel = [];
  const exist = (id) => ['overview', 'ueberblick', 'team'].includes(id);
  const verlauf = erstellePanelVerlauf({
    win,
    existiert: exist,
    getAktiv: () => aktiv,
    wechslePanel: async (id) => {
      aktiv = id;
      wechsel.push(id);
      verlauf.merkePanel(id);
    },
  });
  verlauf.verdrahte();

  // Einstieg ohne Hash -> bleibt overview, kein pushState
  assert.equal(await verlauf.startPanelAusUrl(), 'overview');
  assert.equal(stack.length, 1);

  // Wechsel zu Überblick -> URL erhält #ueberblick
  aktiv = 'ueberblick';
  verlauf.merkePanel('ueberblick');
  assert.equal(win.location.hash, '#ueberblick');
  assert.equal(stack.length, 2);

  // Browser-Zurück (popstate auf Index 0 -> overview) darf keinen neuen History-Eintrag anlegen
  idx = 0;
  listeners.get('popstate')();
  await Promise.resolve();
  assert.equal(aktiv, 'overview');
  assert.equal(stack.length, 2);

  // Reload auf #ueberblick -> startet direkt im Überblick
  idx = 1;
  aktiv = 'overview';
  assert.equal(await verlauf.startPanelAusUrl(), 'ueberblick');
  assert.equal(aktiv, 'ueberblick');
  assert.equal(stack.length, 2);

  // Bereits aktiv (z. B. nach handleGmailCallback) -> kein Doppelaufruf von wechslePanel
  const anzahlVorher = wechsel.length;
  assert.equal(await verlauf.startPanelAusUrl(), 'ueberblick');
  assert.equal(wechsel.length, anzahlVorher);
});
