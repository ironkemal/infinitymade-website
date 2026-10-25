import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeStatus, paketZeilen } from './redesign-status-check.mjs';

const kopf = '| ID | Phase | Titel | Typ | Wirkbereich | hängt ab | Status | Commit | Nachweis | Versuche |\n|---|---|---|---|---|---|---|---|---|---|\n';
const zeile = (id, status, commit = '') => `| ${id} | V0 | t | Werkzeug | – | – | ${status} | ${commit} | | |\n`;
const status = ({ pakete, naechstes = 'V0.02', cache = 'a.css ?v=1', fehlerbuch = '' }) =>
  `# S\n## 0 Kurzzustand\n- Cache-Nummern: ${cache}\n- Nächstes Paket: ${naechstes}\n\n## 2 Paketliste\n${kopf}${pakete}\n## 4 Fehlerbuch\n${fehlerbuch}\n`;
const umgebung = { html: '<link href="a.css?v=1">', istInHead: (sha) => sha === 'abc1234' };

test('gültiger Stand hat keine Fehler', () => {
  const t = status({ pakete: zeile('V0.01', 'fertig', 'abc1234') + zeile('V0.02', 'offen') });
  assert.deepEqual(pruefeStatus(t, umgebung), []);
  assert.equal(paketZeilen(t).length, 2);
});

test('fertig ohne Commit und Commit nicht in HEAD werden gemeldet', () => {
  const t = status({ pakete: zeile('V0.01', 'fertig') + zeile('V0.03', 'fertig', 'deadbee') + zeile('V0.02', 'offen') });
  const f = pruefeStatus(t, umgebung);
  assert.ok(f.some((x) => x.includes('V0.01') && x.includes('keinen Commit')));
  assert.ok(f.some((x) => x.includes('deadbee')));
});

test('„dieser Commit“ nur einmal erlaubt', () => {
  const t = status({ pakete: zeile('V0.01', 'fertig', 'dieser Commit') + zeile('V0.03', 'fertig', 'dieser Commit') + zeile('V0.02', 'offen') });
  assert.ok(pruefeStatus(t, umgebung).some((x) => x.includes('2×')));
});

test('zwei Pakete in Arbeit, unbekannter Status, blockiert ohne Fehlerbuch', () => {
  const t = status({ pakete: zeile('V0.01', 'in Arbeit') + zeile('V0.02', 'in Arbeit') + zeile('V0.03', 'erledigt') + zeile('V0.04', 'blockiert') });
  const f = pruefeStatus(t, umgebung);
  assert.ok(f.some((x) => x.includes('Mehr als ein Paket')));
  assert.ok(f.some((x) => x.includes('unbekannter Status')));
  assert.ok(f.some((x) => x.includes('V0.04') && x.includes('Fehlerbuch')));
});

test('blockiert mit Fehlerbuch-Eintrag ist ok', () => {
  const t = status({ pakete: zeile('V0.02', 'offen') + zeile('V0.04', 'blockiert'), fehlerbuch: '| R-14 | V0.04 hängt |' });
  assert.deepEqual(pruefeStatus(t, umgebung), []);
});

test('falsche Cache-Nummer und fehlendes nächstes Paket', () => {
  const t = status({ pakete: zeile('V0.01', 'fertig', 'abc1234'), naechstes: 'V0.01', cache: 'a.css ?v=2' });
  const f = pruefeStatus(t, umgebung);
  assert.ok(f.some((x) => x.includes('schon fertig')));
  assert.ok(f.some((x) => x.includes('?v=') || x.includes('als 2')));
});

test('Checklisten-Zeilen sind verboten', () => {
  const t = status({ pakete: zeile('V0.02', 'offen') }) + '- [ ] alte Liste\n';
  assert.ok(pruefeStatus(t, umgebung).some((x) => x.includes('Checklisten')));
});
