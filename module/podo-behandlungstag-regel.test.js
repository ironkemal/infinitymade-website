// gkv-302, 30.09.2026: zweiter Behandlungstag (Rueckfrage) und abrechenbare Behandlungstage (Bereit-Sperre).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  abrechenbareBehandlungstage, bestehenderBehandlungstag, zweiterBehandlungstagFrage,
} from './podo-behandlungstag-regel.js';

const b = (datum, codes, storniert_am = null) => ({ behandlungsdatum: datum, hpnr_codes: codes, storniert_am });

test('Behandlungstage: 78010 oder 78020 zaehlt, Befundung allein nicht', () => {
  assert.equal(abrechenbareBehandlungstage([b('2026-09-01', ['78030'])]), 0);
  assert.equal(abrechenbareBehandlungstage([b('2026-09-01', ['78040'])]), 0);
  assert.equal(abrechenbareBehandlungstage([b('2026-09-01', ['78030', '78010'])]), 1);
  assert.equal(abrechenbareBehandlungstage([b('2026-09-01', ['78020'])]), 1);
});

test('Behandlungstage: stornierte Zeilen zaehlen nicht', () => {
  assert.equal(abrechenbareBehandlungstage([b('2026-09-01', ['78010'], '2026-09-02T10:00:00Z')]), 0);
});

test('Behandlungstage: derselbe Kalendertag zaehlt einmal', () => {
  assert.equal(abrechenbareBehandlungstage([b('2026-09-01', ['78010']), b('2026-09-01', ['78020'])]), 1);
  assert.equal(abrechenbareBehandlungstage([b('2026-09-01', ['78010']), b('2026-09-15', ['78010'])]), 2);
});

test('Behandlungstage: Altzeilen ohne Codes und Nullwerte zaehlen nicht / brechen nichts', () => {
  assert.equal(abrechenbareBehandlungstage([b('2026-09-01', ['78040']), b('2026-09-02', null), b('2026-09-03', [])]), 0);
  assert.equal(abrechenbareBehandlungstage(undefined), 0);
  assert.equal(abrechenbareBehandlungstage([null, {}]), 0);
});

test('zweiter Tag: findet nicht stornierte Zeile am selben Datum, gleich welche Positionen', () => {
  const liste = [b('2026-09-01', ['78030']), b('2026-09-08', ['78010'], '2026-09-09T08:00:00Z')];
  assert.ok(bestehenderBehandlungstag(liste, '2026-09-01'));
  assert.equal(bestehenderBehandlungstag(liste, '2026-09-08'), null, 'storniert = kein Behandlungstag');
  assert.equal(bestehenderBehandlungstag(liste, '2026-09-15'), null);
  assert.equal(bestehenderBehandlungstag(liste, ''), null);
  assert.equal(bestehenderBehandlungstag(null, '2026-09-01'), null);
});

test('zweiter Tag: Text nennt Datum, § 12 Abs. 8 und die Frage', () => {
  assert.equal(zweiterBehandlungstagFrage('2026-09-01'),
    'Für diese Verordnung ist am 01.09.2026 bereits ein Behandlungstag erfasst. '
    + 'Je Tag ist nur eine Behandlung abrechenbar (HeilM-RL § 12 Abs. 8) — trotzdem speichern?');
});

test('UI2: Nagelspange 78610 zählt als abrechenbarer Behandlungstag, Zuschlag 78620 allein nicht', () => {
  assert.equal(abrechenbareBehandlungstage([{ behandlungsdatum: '2026-09-30', hpnr_codes: ['78610'] }]), 1);
  assert.equal(abrechenbareBehandlungstage([{ behandlungsdatum: '2026-09-30', hpnr_codes: ['78030', '79933'] }]), 0);
  assert.equal(abrechenbareBehandlungstage([{ behandlungsdatum: '2026-09-30', hpnr_codes: ['78620'] }]), 0);
});
