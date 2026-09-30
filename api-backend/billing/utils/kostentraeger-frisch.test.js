import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  kostentraegerFrischAbleiten,
  KOSTENTRAEGER_NICHT_AUFLOESBAR_CODE,
  KOSTENTRAEGER_IK_NEU_CODE,
} from './kostentraeger-frisch.js';

test('1) gleiche IK: keine Warnung, Zeile unverändert', async () => {
  const zeile = {
    id: '11112222-3333-4444',
    krankenkasse_ik: '108310400',
    kostentraeger_ik: '108310400',
  };
  const mockAufloeser = async () => '108310400';

  const { warnungen } = await kostentraegerFrischAbleiten(null, [zeile], { aufloeser: mockAufloeser });

  assert.equal(warnungen.length, 0);
  assert.equal(zeile.kostentraeger_ik, '108310400');
});

test('2) abweichende IK: Zeile aktualisiert, KOSTENTRAEGER_IK_NEU Warnung mit alt und neu', async () => {
  const zeile = {
    id: '11112222-3333-4444',
    krankenkasse_ik: '108310400',
    kostentraeger_ik: '108310400',
  };
  const mockAufloeser = async () => '103501080';

  const { warnungen } = await kostentraegerFrischAbleiten(null, [zeile], { aufloeser: mockAufloeser });

  assert.equal(warnungen.length, 1);
  assert.equal(zeile.kostentraeger_ik, '103501080');
  assert.equal(warnungen[0].code, KOSTENTRAEGER_IK_NEU_CODE);
  assert.equal(warnungen[0].code, 'KOSTENTRAEGER_IK_NEU');
  assert.equal(warnungen[0].prescriptionId, '11112222-3333-4444');
  assert.equal(warnungen[0].alt, '108310400');
  assert.equal(warnungen[0].neu, '103501080');
  assert.equal(
    warnungen[0].text,
    'Verordnung 11112222: Kostenträger-IK laut aktueller Kostenträgerdatei 103501080 statt gespeicherter 108310400 — es wird mit 103501080 abgerechnet.'
  );
});

test('3) nicht auflösbar: wirft 422 KOSTENTRAEGER_NICHT_AUFLOESBAR mit Verordnungs-Kurz-ID und Patientennamen', async () => {
  const zeile = {
    id: 'abcdef12-3456-7890',
    krankenkasse_ik: '108310400',
    kostentraeger_ik: '108310400',
    leads: { first_name: 'Max', last_name: 'Mustermann' },
  };
  const mockAufloeser = async () => null;

  await assert.rejects(
    async () => {
      await kostentraegerFrischAbleiten(null, [zeile], { aufloeser: mockAufloeser });
    },
    (err) => {
      assert.equal(err.status, 422);
      assert.equal(err.code, KOSTENTRAEGER_NICHT_AUFLOESBAR_CODE);
      assert.equal(err.code, 'KOSTENTRAEGER_NICHT_AUFLOESBAR');
      assert.equal(err.prescriptionId, 'abcdef12-3456-7890');
      assert.equal(
        err.message,
        'Verordnung abcdef12 (Max Mustermann): Zur IK der Versichertenkarte 108310400 wurde in der aktuellen Kostenträgerdatei kein Kostenträger gefunden — Verordnung prüfen bzw. Kostenträgerdatei aktualisieren.'
      );
      return true;
    }
  );
});

test('3b) nicht auflösbar ohne Patientennamen: Verordnung-Kurz-ID ohne Klammer', async () => {
  const zeile = {
    id: 'abcdef12-3456-7890',
    krankenkasse_ik: '108310400',
    kostentraeger_ik: '108310400',
  };
  const mockAufloeser = async () => null;

  await assert.rejects(
    async () => {
      await kostentraegerFrischAbleiten(null, [zeile], { aufloeser: mockAufloeser });
    },
    (err) => {
      assert.equal(err.status, 422);
      assert.equal(err.code, 'KOSTENTRAEGER_NICHT_AUFLOESBAR');
      assert.equal(
        err.message,
        'Verordnung abcdef12: Zur IK der Versichertenkarte 108310400 wurde in der aktuellen Kostenträgerdatei kein Kostenträger gefunden — Verordnung prüfen bzw. Kostenträgerdatei aktualisieren.'
      );
      return true;
    }
  );
});

test('4) Karten-IK fehlt oder ungültig: Zeile unberührt, Auflöser wird nicht aufgerufen', async () => {
  let aufgerufen = false;
  const mockAufloeser = async () => {
    aufgerufen = true;
    return '108310400';
  };
  const zeilen = [
    { id: '11111111-0000', krankenkasse_ik: null, kostentraeger_ik: '108310400' },
    { id: '22222222-0000', krankenkasse_ik: '', kostentraeger_ik: '108310400' },
    { id: '33333333-0000', krankenkasse_ik: '12345', kostentraeger_ik: '108310400' },
    { id: '44444444-0000', krankenkasse_ik: '10831040a', kostentraeger_ik: '108310400' },
    { id: '55555555-0000', krankenkasse_ik: undefined, kostentraeger_ik: '108310400' },
  ];

  const { warnungen } = await kostentraegerFrischAbleiten(null, zeilen, { aufloeser: mockAufloeser });

  assert.equal(aufgerufen, false);
  assert.equal(warnungen.length, 0);
  assert.equal(zeilen[0].kostentraeger_ik, '108310400');
  assert.equal(zeilen[1].kostentraeger_ik, '108310400');
  assert.equal(zeilen[2].kostentraeger_ik, '108310400');
  assert.equal(zeilen[3].kostentraeger_ik, '108310400');
  assert.equal(zeilen[4].kostentraeger_ik, '108310400');
});

test('5) Cache: gleiche Karten-IK in zwei Zeilen -> Auflöser wird nur 1 Mal aufgerufen', async () => {
  let anzahlAufrufe = 0;
  const mockAufloeser = async (_sb, patient) => {
    anzahlAufrufe++;
    return '103501080';
  };
  const zeilen = [
    { id: '11111111-0000', krankenkasse_ik: '108310400', kostentraeger_ik: '108310400' },
    { id: '22222222-0000', krankenkasse_ik: '108310400', kostentraeger_ik: '108310400' },
  ];

  const { warnungen } = await kostentraegerFrischAbleiten(null, zeilen, { aufloeser: mockAufloeser });

  assert.equal(anzahlAufrufe, 1);
  assert.equal(warnungen.length, 2);
  assert.equal(zeilen[0].kostentraeger_ik, '103501080');
  assert.equal(zeilen[1].kostentraeger_ik, '103501080');
});

test('6) Auflöser erhält kein krankenkasse (Name) Feld, nur krankenkasse_ik', async () => {
  let uebergebenesPatient = null;
  const mockAufloeser = async (_sb, patient) => {
    uebergebenesPatient = patient;
    return '108310400';
  };
  const zeile = {
    id: '11111111-0000',
    krankenkasse_ik: '108310400',
    kostentraeger_ik: '108310400',
    krankenkasse: 'Techniker Krankenkasse',
    leads: { krankenkasse: 'Techniker Krankenkasse' },
  };

  await kostentraegerFrischAbleiten(null, [zeile], { aufloeser: mockAufloeser });

  assert.ok(uebergebenesPatient !== null);
  assert.equal(uebergebenesPatient.krankenkasse_ik, '108310400');
  assert.equal('krankenkasse' in uebergebenesPatient, false);
});
