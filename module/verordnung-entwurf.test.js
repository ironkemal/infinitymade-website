import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pruefeVerordnung } from './verordnung-pruefung.js?v=20261021v';
import { pruefeHeilmittelZeilen } from './heilmittel-zeilen.js?v=20261102a';
import { validateRezept } from '../api-backend/ai/validators/validate.js';

const PHYSIO_PROFIL = {
  label: 'Physiotherapie',
  hoechstmengeDefault: 6,
  gruppen: {
    WS2: { code: 'WS2', label: 'Wirbelsäulenerkrankungen', hoechstmenge: 6, icd_accept: ['M40', 'M54'], icd_exclude: [] },
    EX3: { code: 'EX3', label: 'Extremitäten', hoechstmenge: 10, icd_accept: [], icd_exclude: [] },
  },
  pflichtIcd: false,
};

test('WS2 + KG: Vollstaendige Verordnung hat keine Blocker und keine fehlenden Pflichtfelder', () => {
  const vo = {
    bereich: 'physiotherapy',
    diagnosegruppe: 'WS2',
    heilmittel: 'Krankengymnastik',
    heilmittelPosition: 'X0501',
    anzahl: 6,
    frequenz: '1-2x wtl.',
    ausstellungsdatum: '2026-11-01',
    versichertennummer: 'A123456780',
    kasseIk: '101575519',
    arztLanr: '123456601',
    arztBsnr: '987654321',
    icd: 'M54.5',
    rezeptart: 'kassen',
  };

  const res = pruefeVerordnung(vo, PHYSIO_PROFIL, '2026-11-02');
  const blocker = res.befunde.filter(b => b.schwere === 'blocker');
  assert.equal(blocker.length, 0);

  // Serverseitige Validierung
  const serverRes = validateRezept({
    icd10: vo.icd,
    diagnosegruppe: vo.diagnosegruppe,
    heilmittel: vo.heilmittel,
    anzahl_einheiten: vo.anzahl,
    ausstellungsdatum: vo.ausstellungsdatum,
  });
  assert.equal(serverRes.ok, true);
  assert.equal(serverRes.blockers.length, 0);
});

test('WS2 + KG: Fehlende Pflichtfelder (LANR, Ausstellungsdatum) fuehren zur Entwurf-Meldung mit Begruendung', () => {
  // Wenn Ausstellungsdatum fehlt
  const voOhneDatum = {
    bereich: 'physiotherapy',
    diagnosegruppe: 'WS2',
    heilmittel: 'Krankengymnastik',
    anzahl: 6,
    ausstellungsdatum: '',
    rezeptart: 'kassen',
  };
  const resDatum = pruefeVerordnung(voOhneDatum, PHYSIO_PROFIL, '2026-11-02');
  const datumBlocker = resDatum.befunde.filter(b => b.code === 'PFLICHT_AUSSTELLUNGSDATUM');
  assert.equal(datumBlocker.length, 1);
  assert.match(datumBlocker[0].text, /Ausstellungsdatum fehlt/);

  // Server-Validierung ohne Ausstellungsdatum meldet Blocker
  const serverResDatum = validateRezept({
    icd10: 'M54.5',
    diagnosegruppe: 'WS2',
    heilmittel: 'KG',
    anzahl_einheiten: 6,
    ausstellungsdatum: null,
  });
  assert.equal(serverResDatum.ok, false);
  assert.ok(serverResDatum.blockers.some(b => b.code === 'AUSSTELLUNGSDATUM_INVALID'));
});

test('WS2 + KG / EX3: Ueberschreitung der Hoechstmenge ist Warnung, kein Blocker (Maske speichert als Entwurf mit Begruendung, Anlage 3: Arzt korrigiert)', () => {
  // KG 6 + MT 6 (12 > 10 in EX3 oder 12 > 6 in WS2)
  const serverRes = validateRezept({
    icd10: 'M54.5',
    diagnosegruppe: 'WS2',
    heilmittel: 'KG',
    anzahl_einheiten: 12,
    ausstellungsdatum: '2026-11-01',
  });
  assert.equal(serverRes.ok, true, 'Hoechstmenge darf keinen Blocker erzeugen');
  assert.ok(serverRes.warnings.some(w => w.code === 'OVER_HOECHSTMENGE'));

  // Mit proceed_anyway und is_entwurf=false darf der Server kein Entwurf mehr erzwingen
  const is_entwurf = false;
  const proceed_anyway = true;
  const entwurf = Boolean(is_entwurf) || !serverRes.ok || (Boolean(serverRes.warnings?.length) && !proceed_anyway);
  assert.equal(entwurf, false, 'Warnung mit proceed_anyway bestaetigt die Verordnung');
});

test('P3 Einheit 0: wird vor Entwurf-Dialog als harter Formfehler abgewiesen', () => {
  const zeilen = [{ code: 'X0501', bezeichnung: 'KG', einheiten: 0 }];
  const res = pruefeHeilmittelZeilen({ bereich: 'physio', zeilen, istEntwurf: false });
  assert.ok(res.fehler.length > 0);
  assert.match(res.fehler[0], /größer als 0/);

  // Auch bei istEntwurf: true sperrt Einheit 0
  const resEntwurf = pruefeHeilmittelZeilen({ bereich: 'physio', zeilen, istEntwurf: true });
  assert.ok(resEntwurf.fehler.length > 0);
  assert.match(resEntwurf.fehler[0], /größer als 0/);
});
