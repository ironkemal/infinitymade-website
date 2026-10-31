import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// O-224: In der Box gibt es kein Abo. Der Owner kommt als „professional" aus dem Setup, ohne
// businesses-Zeile. Drei Stellen müssen das zusammen tragen, sonst scheitert der zweite Standort still.
const quelle = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');

test('isEnterprise ist in der Box wahr, im SaaS bleibt die Planprüfung', () => {
  assert.match(quelle, /return IST_KUTU \|\| \(ENTERPRISE_PLANS\.has\(plan\) && \['trial', 'active', 'past_due'\]\.includes\(status\)\);/);
});

test('Die zweite Sperre beim Speichern kennt die Box ebenfalls', () => {
  assert.match(quelle, /const mehrereErlaubt = IST_KUTU \|\| ENTERPRISE_PLANS\.has\(/);
  assert.doesNotMatch(quelle, /const isEnterprise = ENTERPRISE_PLANS/);
});

test('Ohne businesses-Zeile bleibt die Standortliste in der Box erreichbar', () => {
  assert.match(quelle, /if \(myBusinesses\.length === 0\) \{ wrap\.hidden = true; if \(IST_KUTU\) renderBusinessesSection\(\); return; \}/);
});

test('Der erste Standort wird Standard, weitere verlangen die Bestätigung der Rechtsperson', () => {
  assert.match(quelle, /payload\.is_default = existingCount === 0;/);
  assert.match(quelle, /existingCount >= 1 && !await showConfirmModal\(\{ title: 'Weiterer Standort'/);
});

test('Sondertage zählen in UTC weiter, sonst käme zur Zeitumstellung ein Tag doppelt', () => {
  assert.match(quelle, /d\.setUTCDate\(d\.getUTCDate\(\) \+ 1\); \/\/ UTC: lokal/);
  const tage = [];
  const d = new Date('2027-03-27');
  while (d <= new Date('2027-03-29')) { tage.push(d.toISOString().split('T')[0]); d.setUTCDate(d.getUTCDate() + 1); }
  assert.deepEqual(tage, ['2027-03-27', '2027-03-28', '2027-03-29']);
});

test('Anrufliste nur, wenn der Schließtag wirklich gespeichert wurde', () => {
  assert.match(quelle, /\.then\(ok => ok && zeigeAnrufliste\(/);
});
