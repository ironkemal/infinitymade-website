import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  physioKorrekturErlaubt,
  pruefePhysioMenge,
  korrigierePhysioEinheiten,
  einheitenAenderungErlaubt,
  pruefeNeueMenge,
  speichereEinheiten,
} from './verordnung-einheiten.js';

/* ── 1. Izin Matrisi (physioKorrekturErlaubt) ─────────────────────────────── */

test('physioKorrekturErlaubt: Inhaber darf Physio und Ergo vor Abrechnung korrigieren', () => {
  const rxPhysio = {
    id: 'rx-1',
    therapie_bereich: 'physio',
    anzahl_einheiten: 6,
    status: 'in_therapy',
    belegnummer: null,
  };
  const resPhysio = physioKorrekturErlaubt(rxPhysio, 'owner');
  assert.equal(resPhysio.erlaubt, true);
  assert.equal(resPhysio.grund, null);

  const rxErgo = {
    id: 'rx-2',
    therapie_bereich: 'ergo',
    anzahl_einheiten: 10,
    status: 'in_therapy',
    belegnummer: null,
  };
  const resErgo = physioKorrekturErlaubt(rxErgo, 'owner');
  assert.equal(resErgo.erlaubt, true);
  assert.equal(resErgo.grund, null);
});

test('physioKorrekturErlaubt: Angestellte (employee) duerfen nicht korrigieren (nur Inhaber)', () => {
  const rx = {
    id: 'rx-1',
    therapie_bereich: 'physio',
    anzahl_einheiten: 6,
    status: 'in_therapy',
    belegnummer: null,
  };
  const res = physioKorrekturErlaubt(rx, 'employee');
  assert.equal(res.erlaubt, false);
  assert.match(res.grund, /Praxisinhaber/);
});

test('physioKorrekturErlaubt: Vergebene Belegnummer sperrt die Korrektur (festgeschrieben)', () => {
  const rx = {
    id: 'rx-1',
    therapie_bereich: 'physio',
    anzahl_einheiten: 6,
    status: 'in_therapy',
    belegnummer: '12-34',
  };
  const res = physioKorrekturErlaubt(rx, 'owner');
  assert.equal(res.erlaubt, false);
  assert.match(res.grund, /12-34/);
  assert.match(res.grund, /festgeschrieben/);
});

test('physioKorrekturErlaubt: Podologie und andere Bereiche werden abgewiesen', () => {
  const rxPodo = {
    id: 'rx-p',
    therapie_bereich: 'podo',
    anzahl_einheiten: 6,
    status: 'in_therapy',
    belegnummer: null,
  };
  const resPodo = physioKorrekturErlaubt(rxPodo, 'owner');
  assert.equal(resPodo.erlaubt, false);
  assert.match(resPodo.grund, /Physiotherapie und Ergotherapie/);

  const rxNull = {
    id: 'rx-x',
    therapie_bereich: null,
    anzahl_einheiten: 6,
    status: 'in_therapy',
  };
  assert.equal(physioKorrekturErlaubt(rxNull, 'owner').erlaubt, false);
});

test('physioKorrekturErlaubt: Abgeschlossene/stornierte Verordnungen gesperrt', () => {
  for (const status of ['abgerechnet', 'archiviert', 'storniert']) {
    const rx = { id: 'rx-1', therapie_bereich: 'physio', anzahl_einheiten: 6, status };
    const res = physioKorrekturErlaubt(rx, 'owner');
    assert.equal(res.erlaubt, false);
    assert.match(res.grund, new RegExp(status));
  }
  assert.equal(physioKorrekturErlaubt(null, 'owner').erlaubt, false);
});

/* ── 2. Artırma Red & Grenzen (pruefePhysioMenge) ─────────────────────────── */

test('pruefePhysioMenge: Artierungs-Verbot (nur Reduzierung erlaubt)', () => {
  // Gleichstand ist verboten
  const resGleich = pruefePhysioMenge(6, { alt: 6, erbrachteTermine: 0 });
  assert.match(resGleich, /kleiner als die bisherige \(6\)/);

  // Erhoehung ist verboten
  const resHoeher = pruefePhysioMenge(7, { alt: 6, erbrachteTermine: 0 });
  assert.match(resHoeher, /kleiner als die bisherige \(6\)/);

  // Echte Reduzierung ist gueltig
  assert.equal(pruefePhysioMenge(5, { alt: 6, erbrachteTermine: 0 }), null);
  assert.equal(pruefePhysioMenge(1, { alt: 6, erbrachteTermine: 0 }), null);
});

test('pruefePhysioMenge: Grenzwerte (mindestens 1, maximal 60)', () => {
  assert.match(pruefePhysioMenge(0, { alt: 6 }), /Mindestens 1/);
  assert.match(pruefePhysioMenge(-1, { alt: 6 }), /Mindestens 1/);
  assert.match(pruefePhysioMenge(NaN, { alt: 6 }), /Mindestens 1/);
  assert.match(pruefePhysioMenge(61, { alt: 70 }), /Mehr als 60 Einheiten/);
});

/* ── 3. Erbrachte Termine Unterschreitung (pruefePhysioMenge) ─────────────── */

test('pruefePhysioMenge: Darf nicht unter bereits erbrachte Termine sinken', () => {
  // 3 Termine erbracht: 3 oder 4 Einheiten erlaubt, 2 Einheiten verboten
  assert.equal(pruefePhysioMenge(4, { alt: 6, erbrachteTermine: 3 }), null);
  assert.equal(pruefePhysioMenge(3, { alt: 6, erbrachteTermine: 3 }), null);

  const resUnter = pruefePhysioMenge(2, { alt: 6, erbrachteTermine: 3 });
  assert.match(resUnter, /3 Termine sind bereits erbracht/);

  // 1 Termin erbracht: 1 Einheit erlaubt, 0 nicht
  assert.equal(pruefePhysioMenge(1, { alt: 6, erbrachteTermine: 1 }), null);
  assert.match(pruefePhysioMenge(0, { alt: 6, erbrachteTermine: 1 }), /Mindestens 1/);
});

/* ── 4. Doppelbehandlung 6→3 Termin (pruefePhysioMenge) ───────────────────── */

test('pruefePhysioMenge: Doppelbehandlung rechnet 1 Termin = 2 Einheiten (ceil(neu/2))', () => {
  // 3 Termine bereits erbracht mit Doppelbehandlung:
  // 6 Einheiten = ceil(6/2) = 3 Termine -> deckt 3 erbrachte ab (ok)
  // 5 Einheiten = ceil(5/2) = 3 Termine -> deckt 3 erbrachte ab (ok)
  // 4 Einheiten = ceil(4/2) = 2 Termine -> deckt nur 2 ab < 3 erbrachte -> Fehler!
  const opt = { alt: 10, erbrachteTermine: 3, doppelbehandlung: true };

  assert.equal(pruefePhysioMenge(6, opt), null);
  assert.equal(pruefePhysioMenge(5, opt), null);

  const res4 = pruefePhysioMenge(4, opt);
  assert.match(res4, /3 Termine sind bereits erbracht/);

  // Bei alt: 6, erbracht: 3: 5 Einheiten erlaubt, 6 Einheiten rejected wegen alt: 6
  const optAlt6 = { alt: 6, erbrachteTermine: 3, doppelbehandlung: true };
  assert.equal(pruefePhysioMenge(5, optAlt6), null);
  assert.match(pruefePhysioMenge(6, optAlt6), /kleiner als die bisherige/);
  assert.match(pruefePhysioMenge(4, optAlt6), /3 Termine sind bereits erbracht/);
});

/* ── 5. RPC & Mehrere Heilmittel Index (korrigierePhysioEinheiten) ────────── */

test('korrigierePhysioEinheiten: Begruendung muss mindestens 5 Zeichen haben', async () => {
  const res = await korrigierePhysioEinheiten({}, { rxId: 'rx-1', neu: 4, grund: ' kurz' });
  assert.equal(res.ok, false);
  assert.match(res.fehler, /mindestens 5 Zeichen/);
});

test('korrigierePhysioEinheiten: Ruft RPC mit p_id, p_neu, p_grund, p_heilmittel_index auf', async () => {
  let aufruf = null;
  const mockSupabase = {
    rpc: async (fn, params) => {
      aufruf = { fn, params };
      return { data: { alt: 6, neu: 4, abgesagt: 2, termin_offen: [] }, error: null };
    },
  };

  // Einzelszenario: kein Heilmittel-Index -> null
  const resSingle = await korrigierePhysioEinheiten(mockSupabase, {
    rxId: 'rx-10',
    neu: 4,
    grund: 'Uebertragungsfehler vom Rezept',
  });
  assert.equal(resSingle.ok, true);
  assert.equal(aufruf.fn, 'einheiten_korrigieren');
  assert.deepEqual(aufruf.params, {
    p_id: 'rx-10',
    p_neu: 4,
    p_grund: 'Uebertragungsfehler vom Rezept',
    p_heilmittel_index: null,
  });
  assert.equal(resSingle.data.neu, 4);

  // Mehrere Heilmittel: Index 1 uebergeben
  const resMulti = await korrigierePhysioEinheiten(mockSupabase, {
    rxId: 'rx-10',
    neu: 3,
    grund: 'Falsche Menge eingetragen',
    heilmittelIndex: 1,
  });
  assert.equal(resMulti.ok, true);
  assert.equal(aufruf.params.p_heilmittel_index, 1);
  assert.equal(aufruf.params.p_neu, 3);
});

test('korrigierePhysioEinheiten: RPC fehlt auf Server (Migration 0100 noch nicht in Live) liefert verstaendlichen Fehler', async () => {
  const mockSupabaseMissing = {
    rpc: async () => ({
      data: null,
      error: { code: '42883', message: 'function einheiten_korrigieren() does not exist' },
    }),
  };

  const res = await korrigierePhysioEinheiten(mockSupabaseMissing, {
    rxId: 'rx-1',
    neu: 4,
    grund: 'Uebertragungsfehler korrigieren',
  });
  assert.equal(res.ok, false);
  assert.match(res.fehler, /Migration 0100 steht aus/);
});

test('korrigierePhysioEinheiten: Meldet termin_offen zurueck, wenn Termine dranhaengen', async () => {
  const mockSupabaseOffen = {
    rpc: async () => ({
      data: {
        alt: 6,
        neu: 4,
        abgesagt: 1,
        termin_offen: [{ session_id: 's-6', session_number: 6, booking_id: 'bk-6' }],
      },
      error: null,
    }),
  };

  const res = await korrigierePhysioEinheiten(mockSupabaseOffen, {
    rxId: 'rx-1',
    neu: 4,
    grund: 'Uebertragungsfehler korrigieren',
  });
  assert.equal(res.ok, true);
  assert.equal(res.data.termin_offen.length, 1);
  assert.equal(res.data.termin_offen[0].session_number, 6);
  assert.equal(res.data.termin_offen[0].booking_id, 'bk-6');
});

/* ── 6. Podologie Rueckwaertskompatibilitaet ───────────────────────────────── */

test('Podologie-Zweig bleibt unberuehrt (einheitenAenderungErlaubt, pruefeNeueMenge)', () => {
  assert.equal(einheitenAenderungErlaubt({ status: 'aktiv', belegnummer: null }).erlaubt, true);
  assert.equal(einheitenAenderungErlaubt({ status: 'abgerechnet' }).erlaubt, false);
  assert.equal(einheitenAenderungErlaubt({ belegnummer: '10' }).erlaubt, false);

  assert.equal(pruefeNeueMenge(4, 2), null);
  assert.match(pruefeNeueMenge(2, 4), /4 Behandlungen sind bereits dokumentiert/);
});
