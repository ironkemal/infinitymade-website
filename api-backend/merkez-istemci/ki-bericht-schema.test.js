import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RE_REPORT_ID,
  RE_UTC_DAY,
  KI_TASKS,
  pruefeKiBericht,
  kiBerichtHash
} from './ki-bericht-schema.js';
import { createJetonClient } from '../ai/ki-jeton.js';

function erzeugeGueltigenBericht(ueberschreibungen = {}) {
  return {
    reportId: 'rep_2026-10-08_box1',
    windowStart: '2026-10-08T00:00:00.000Z',
    windowEnd: '2026-10-09T00:00:00.000Z',
    taskTotals: {
      'b2c-draft': {
        calls: 10,
        prompt_tokens: 1500,
        completion_tokens: 450,
        total_tokens: 1950
      },
      'rezept-ocr': {
        calls: 5,
        prompt_tokens: 800,
        completion_tokens: 200,
        total_tokens: 1000
      }
    },
    ...ueberschreibungen
  };
}

test('Konstanten und Regex-Exporte vorhanden und korrekt', () => {
  assert.ok(RE_REPORT_ID.test('valid-id_123'));
  assert.ok(!RE_REPORT_ID.test(''));
  assert.ok(!RE_REPORT_ID.test('has spaces'));
  assert.ok(RE_UTC_DAY.test('2026-10-08T00:00:00.000Z'));
  assert.ok(Array.isArray(KI_TASKS));
  assert.ok(Object.isFrozen(KI_TASKS));
  assert.equal(KI_TASKS.length, 7);
});

test('Gueltiger Bericht ok und Rueckgabe ist frisches isoliertes Objekt', () => {
  const eingabe = erzeugeGueltigenBericht();
  const ergebnis = pruefeKiBericht(eingabe);

  assert.equal(ergebnis.ok, true);
  assert.ok(ergebnis.bericht);
  assert.notEqual(ergebnis.bericht, eingabe);
  assert.notEqual(ergebnis.bericht.taskTotals, eingabe.taskTotals);
  assert.notEqual(ergebnis.bericht.taskTotals['b2c-draft'], eingabe.taskTotals['b2c-draft']);
  assert.equal(ergebnis.bericht.reportId, eingabe.reportId);
  assert.equal(ergebnis.bericht.windowStart, eingabe.windowStart);
  assert.equal(ergebnis.bericht.windowEnd, eingabe.windowEnd);
});

test('Normalisierung: unterschiedliche Key-Reihenfolgen fuehren zum identischen Hash und sortierten Feldern', () => {
  const b1 = {
    reportId: 'rep-test-order',
    windowStart: '2026-10-08T00:00:00.000Z',
    windowEnd: '2026-10-09T00:00:00.000Z',
    taskTotals: {
      'series-scheduler': { calls: 2, prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      'b2c-draft': { calls: 1, prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
    }
  };

  const b2 = {
    taskTotals: {
      'b2c-draft': { total_tokens: 30, completion_tokens: 10, prompt_tokens: 20, calls: 1 },
      'series-scheduler': { prompt_tokens: 10, calls: 2, total_tokens: 15, completion_tokens: 5 }
    },
    windowEnd: '2026-10-09T00:00:00.000Z',
    reportId: 'rep-test-order',
    windowStart: '2026-10-08T00:00:00.000Z'
  };

  const res1 = pruefeKiBericht(b1);
  const res2 = pruefeKiBericht(b2);

  assert.equal(res1.ok, true);
  assert.equal(res2.ok, true);

  // Alphabetische Sortierung der Tasks ('b2c-draft' vor 'series-scheduler')
  assert.deepEqual(Object.keys(res1.bericht.taskTotals), ['b2c-draft', 'series-scheduler']);
  assert.deepEqual(Object.keys(res2.bericht.taskTotals), ['b2c-draft', 'series-scheduler']);

  // Feste Reihenfolge der Metrikfelder je Task
  assert.deepEqual(Object.keys(res1.bericht.taskTotals['b2c-draft']), ['calls', 'prompt_tokens', 'completion_tokens', 'total_tokens']);
  assert.deepEqual(Object.keys(res2.bericht.taskTotals['b2c-draft']), ['calls', 'prompt_tokens', 'completion_tokens', 'total_tokens']);

  // Hash ist reproduzierbar und identisch
  const hash1 = kiBerichtHash(b1);
  const hash2 = kiBerichtHash(b2);
  assert.equal(hash1, hash2);
  assert.equal(kiBerichtHash(res1.bericht), hash1);
});

test('Hash aendert sich bei abweichendem Wert', () => {
  const b1 = erzeugeGueltigenBericht();
  const b2 = erzeugeGueltigenBericht({
    taskTotals: {
      'b2c-draft': { calls: 11, prompt_tokens: 1500, completion_tokens: 450, total_tokens: 1950 },
      'rezept-ocr': { calls: 5, prompt_tokens: 800, completion_tokens: 200, total_tokens: 1000 }
    }
  });
  const hash1 = kiBerichtHash(b1);
  const hash2 = kiBerichtHash(b2);
  assert.notEqual(hash1, hash2);
});

test('Ablehnung: ungueltige reportId', () => {
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({ reportId: '' })), { ok: false, grund: 'report_id' });
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({ reportId: 12345 })), { ok: false, grund: 'report_id' });
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({ reportId: 'a'.repeat(65) })), { ok: false, grund: 'report_id' });
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({ reportId: 'ungueltig mit leerzeichen' })), { ok: false, grund: 'report_id' });
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({ reportId: 'ungueltig$sonderzeichen' })), { ok: false, grund: 'report_id' });
});

test('Ablehnung: Fenster nicht 24h', () => {
  // 23 Stunden
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    windowEnd: '2026-10-08T23:00:00.000Z'
  })), { ok: false, grund: 'fenster' });

  // 25 Stunden
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    windowEnd: '2026-10-09T01:00:00.000Z'
  })), { ok: false, grund: 'fenster' });
});

test('Ablehnung: Fenster beginnt nicht um 00:00:00.000Z', () => {
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    windowStart: '2026-10-08T12:00:00.000Z',
    windowEnd: '2026-10-09T12:00:00.000Z'
  })), { ok: false, grund: 'fenster' });

  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    windowStart: '2026-10-08T00:00:01.000Z',
    windowEnd: '2026-10-09T00:00:01.000Z'
  })), { ok: false, grund: 'fenster' });
});

test('Ablehnung: Fenster nicht kanonisch formatiert', () => {
  // Ohne Millisekunden (.000)
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    windowStart: '2026-10-08T00:00:00Z',
    windowEnd: '2026-10-09T00:00:00Z'
  })), { ok: false, grund: 'fenster' });

  // Nicht-kanonischer Tag
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    windowStart: '2026-02-30T00:00:00.000Z',
    windowEnd: '2026-03-01T00:00:00.000Z'
  })), { ok: false, grund: 'fenster' });
});

test('Ablehnung: unbekannter Task in taskTotals', () => {
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    taskTotals: {
      'fantasy-task': { calls: 1, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    }
  })), { ok: false, grund: 'tasks' });
});

test('Ablehnung: __proto__ als Task-Key', () => {
  const totalsJson = JSON.parse('{"__proto__": {"calls": 1, "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}}');
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    taskTotals: totalsJson
  })), { ok: false, grund: 'tasks' });

  const totalsObj = {
    ['__proto__']: { calls: 1, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  };
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    taskTotals: totalsObj
  })), { ok: false, grund: 'tasks' });
});

test('Ablehnung: mehr als 20 Tasks in taskTotals', () => {
  const vieleTasks = {};
  for (let i = 1; i <= 21; i++) {
    vieleTasks[`task_${i}`] = { calls: 1, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  }
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    taskTotals: vieleTasks
  })), { ok: false, grund: 'tasks' });
});

test('Ablehnung: negative, Float, unsafe Ganzzahl oder String als Metrikwert', () => {
  // Negativ
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    taskTotals: { 'b2c-draft': { calls: -1, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
  })), { ok: false, grund: 'metrik' });

  // Float
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    taskTotals: { 'b2c-draft': { calls: 1.5, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
  })), { ok: false, grund: 'metrik' });

  // Unsafe Ganzzahl (> Number.MAX_SAFE_INTEGER)
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    taskTotals: { 'b2c-draft': { calls: Number.MAX_SAFE_INTEGER + 2, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
  })), { ok: false, grund: 'metrik' });

  // String statt Ganzzahl
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    taskTotals: { 'b2c-draft': { calls: '10', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
  })), { ok: false, grund: 'metrik' });

  // Metrikwert nicht Objekt
  assert.deepEqual(pruefeKiBericht(erzeugeGueltigenBericht({
    taskTotals: { 'b2c-draft': null }
  })), { ok: false, grund: 'metrik' });
});

test('Ablehnung: Zusatzfeld auf Top-Ebene', () => {
  const b = erzeugeGueltigenBericht({ unzulaessig: 'injection' });
  assert.deepEqual(pruefeKiBericht(b), { ok: false, grund: 'zusatzfeld' });
});

test('Ablehnung: Zusatzfeld im Task', () => {
  const b = erzeugeGueltigenBericht({
    taskTotals: {
      'b2c-draft': {
        calls: 1,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        extraField: 'unerlaubt'
      }
    }
  });
  assert.deepEqual(pruefeKiBericht(b), { ok: false, grund: 'zusatzfeld' });
});

test('Ablehnung: Array als taskTotals', () => {
  const b = erzeugeGueltigenBericht({ taskTotals: [] });
  assert.deepEqual(pruefeKiBericht(b), { ok: false, grund: 'tasks' });
});

test('Ablehnung: null, Zahl, String oder Array als Berichtsobjekt', () => {
  assert.deepEqual(pruefeKiBericht(null), { ok: false, grund: 'form' });
  assert.deepEqual(pruefeKiBericht(undefined), { ok: false, grund: 'form' });
  assert.deepEqual(pruefeKiBericht(42), { ok: false, grund: 'form' });
  assert.deepEqual(pruefeKiBericht('kein-objekt'), { ok: false, grund: 'form' });
  assert.deepEqual(pruefeKiBericht([]), { ok: false, grund: 'form' });
});

test('grund enthaelt nie den Eingabewert (Information Leakage Schutz)', () => {
  const geheimnis = 'GEHEIM-123';
  // Ungültige reportId mit Geheimwert
  const r1 = pruefeKiBericht(erzeugeGueltigenBericht({ reportId: `${geheimnis}!ungueltig` }));
  assert.equal(r1.ok, false);
  assert.equal(r1.grund, 'report_id');
  assert.equal(r1.grund.includes(geheimnis), false);

  // Unbekannter Task mit Geheimwert
  const r2 = pruefeKiBericht(erzeugeGueltigenBericht({
    taskTotals: {
      [geheimnis]: { calls: 1, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    }
  }));
  assert.equal(r2.ok, false);
  assert.equal(r2.grund, 'tasks');
  assert.equal(r2.grund.includes(geheimnis), false);
});

test('Paritaet mit createJetonClient.reportUsage aus ki-jeton.js', async () => {
  function frischerClient() {
    return createJetonClient({
      config: {
        mode: 'jeton',
        activationReady: true,
        valid: true,
        allowedHosts: []
      }
    });
  }

  // Fall 1: Gültiger Bericht -> beide akzeptieren
  const gueltig = erzeugeGueltigenBericht();
  const c1 = frischerClient();
  const jetonRes1 = await c1.reportUsage(gueltig);
  assert.deepEqual(jetonRes1, { ok: true, staged: true });
  const schemaRes1 = pruefeKiBericht(gueltig);
  assert.equal(schemaRes1.ok, true);

  // Fall 2: Ungültige reportId -> reportUsage wirft, pruefeKiBericht ok: false
  const ungueltigId = erzeugeGueltigenBericht({ reportId: 'invalid id with spaces' });
  const c2 = frischerClient();
  await assert.rejects(() => c2.reportUsage(ungueltigId), /reportId ungültig/);
  const schemaRes2 = pruefeKiBericht(ungueltigId);
  assert.equal(schemaRes2.ok, false);
  assert.equal(schemaRes2.grund, 'report_id');

  // Fall 3: Ungültiges Zeitfenster (23h) -> reportUsage wirft, pruefeKiBericht ok: false
  const ungueltigFenster = erzeugeGueltigenBericht({ windowEnd: '2026-10-08T23:00:00.000Z' });
  const c3 = frischerClient();
  await assert.rejects(() => c3.reportUsage(ungueltigFenster), /Zeitfenster/);
  const schemaRes3 = pruefeKiBericht(ungueltigFenster);
  assert.equal(schemaRes3.ok, false);
  assert.equal(schemaRes3.grund, 'fenster');

  // Fall 4: Unbekannter Task -> reportUsage wirft, pruefeKiBericht ok: false
  const ungueltigTask = erzeugeGueltigenBericht({
    taskTotals: { 'unbekannter-task': { calls: 1, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
  });
  const c4 = frischerClient();
  await assert.rejects(() => c4.reportUsage(ungueltigTask), /Unbekannter Task/);
  const schemaRes4 = pruefeKiBericht(ungueltigTask);
  assert.equal(schemaRes4.ok, false);
  assert.equal(schemaRes4.grund, 'tasks');

  // Fall 5: Negative Metrik -> reportUsage wirft, pruefeKiBericht ok: false
  const ungueltigMetrik = erzeugeGueltigenBericht({
    taskTotals: { 'b2c-draft': { calls: -5, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
  });
  const c5 = frischerClient();
  await assert.rejects(() => c5.reportUsage(ungueltigMetrik), /Token-Metriken/);
  const schemaRes5 = pruefeKiBericht(ungueltigMetrik);
  assert.equal(schemaRes5.ok, false);
  assert.equal(schemaRes5.grund, 'metrik');
});
