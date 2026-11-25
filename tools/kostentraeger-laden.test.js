import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ladeAusgaben,
  sqlClient,
  synchronisiere,
  ECHT_DIR,
} from './kostentraeger-annahmestellen-laden.mjs';

// Ursprüngliche AUSGABEN-Liste vor Beginn dieser Aufgabe (zum Abgleich)
const URSPRUENGLICHE_AUSGABEN = [
  { datei: 'AO05Q326_KE3.txt', gueltigAb: '2026-07-27' },
  { datei: 'BK05Q326_KE1.txt', gueltigAb: '2026-07-01' },
  { datei: 'IK05Q326_KE1.txt', gueltigAb: '2026-07-01' },
  { datei: 'EK05Q226_KE0.txt', gueltigAb: '2026-04-01' },
  { datei: 'AO05Q426_KE0.txt', gueltigAb: '2026-10-01' },
  { datei: 'BK05Q426_KE0.txt', gueltigAb: '2026-10-01' },
  { datei: 'IK05Q426_KE0.txt', gueltigAb: '2026-10-01' },
  { datei: 'EK05Q426_KE1.txt', gueltigAb: '2026-10-01' },
  { datei: 'EK05Q426_KE2.txt', gueltigAb: '2026-10-01' },
  { datei: 'AO05Q426_KE2.txt', gueltigAb: '2026-11-01' },
  { datei: 'EK05Q426_KE3.txt', gueltigAb: '2026-12-01' },
  { datei: 'BN050526_KE0.txt', gueltigAb: '2026-05-01' },
  { datei: 'LK05Q226_KE0.txt', gueltigAb: '2025-08-26' },
];

/**
 * In-Memory-Datenbank für synchronisiere-Tests.
 */
class MemoryDb {
  constructor() {
    /** @type {Record<string, Array<Record<string, any>>>} */
    this.tables = {
      kostentraeger: [],
      kostentraeger_annahmestellen: [],
      kostentraeger_anschriften: [],
    };
    this.nextId = 0;
  }

  async alle(tabelle, select, order) {
    const list = this.tables[tabelle] || [];
    const rows = list.map(r => ({ ...r }));
    if (order) {
      const [col, dir = 'asc'] = order.split('.');
      rows.sort((a, b) => {
        const va = String(a[col] ?? '');
        const vb = String(b[col] ?? '');
        return dir.toLowerCase() === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
      });
    }
    return rows;
  }

  async insert(tabelle, zeilen) {
    for (const z of zeilen) {
      const row = { ...z };
      if (tabelle !== 'kostentraeger' && !row.id) {
        row.id = String(++this.nextId);
      }
      this.tables[tabelle].push(row);
    }
  }

  async upsert(tabelle, zeilen, onConflict) {
    const conflictCols = onConflict.split(',').map(s => s.trim());
    for (const z of zeilen) {
      const existing = this.tables[tabelle].find(r =>
        conflictCols.every(c => String(r[c] ?? '') === String(z[c] ?? ''))
      );
      if (existing) {
        Object.assign(existing, z);
      } else {
        const row = { ...z };
        if (tabelle !== 'kostentraeger' && !row.id) {
          row.id = String(++this.nextId);
        }
        this.tables[tabelle].push(row);
      }
    }
  }

  async patch(tabelle, ik, felder) {
    const row = this.tables[tabelle].find(r => r.ik === ik);
    if (row) {
      Object.assign(row, felder);
    }
  }

  async schliessen(tabelle, ids, validTo) {
    const idSet = new Set(ids.map(String));
    for (const r of this.tables[tabelle]) {
      if (idSet.has(String(r.id))) {
        r.valid_to = validTo;
      }
    }
  }
}

// -------------------------------------------------------------
// 1) ladeAusgaben
// -------------------------------------------------------------

test('ladeAusgaben: liest echtes kostentraeger-ausgaben.json erfolgreich', () => {
  const ausgaben = ladeAusgaben();
  assert.equal(ausgaben.length, 13);
  for (const a of ausgaben) {
    assert.match(a.datei, /^[A-Z]{2}\d{2}(Q\d|\d{2})\d{2}_KE\d\.txt$/);
    assert.match(a.gueltigAb, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('ladeAusgaben: ungültiger Dateiname wirft Fehler', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'kt-test-'));
  const tempFile = join(tempDir, 'ausgaben.json');
  try {
    writeFileSync(tempFile, JSON.stringify({
      ausgaben: [{ datei: 'ungueltig.txt', gueltigAb: '2026-10-01' }],
    }));
    assert.throws(() => ladeAusgaben(tempFile), /Ungültiger Dateiname/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ladeAusgaben: doppelte Datei wirft Fehler', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'kt-test-'));
  const tempFile = join(tempDir, 'ausgaben.json');
  try {
    writeFileSync(tempFile, JSON.stringify({
      ausgaben: [
        { datei: 'AO05Q426_KE0.txt', gueltigAb: '2026-10-01' },
        { datei: 'AO05Q426_KE0.txt', gueltigAb: '2026-10-01' },
      ],
    }));
    assert.throws(() => ladeAusgaben(tempFile), /Doppelte Datei/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ladeAusgaben: nicht existierende Datei wirft Fehler', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'kt-test-'));
  const tempFile = join(tempDir, 'ausgaben.json');
  try {
    writeFileSync(tempFile, JSON.stringify({
      ausgaben: [{ datei: 'XX05Q426_KE0.txt', gueltigAb: '2026-10-01' }],
    }));
    assert.throws(() => ladeAusgaben(tempFile), /nicht in wissensbank gefunden/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ladeAusgaben: ungültiges oder gefälschtes Datum wirft Fehler', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'kt-test-'));
  const tempFile = join(tempDir, 'ausgaben.json');
  try {
    writeFileSync(tempFile, JSON.stringify({
      ausgaben: [{ datei: 'AO05Q426_KE0.txt', gueltigAb: '2026-02-31' }],
    }));
    assert.throws(() => ladeAusgaben(tempFile), /Ungültiges Datum/);

    writeFileSync(tempFile, JSON.stringify({
      ausgaben: [{ datei: 'AO05Q426_KE0.txt', gueltigAb: 'kein-datum' }],
    }));
    assert.throws(() => ladeAusgaben(tempFile), /Ungültiges Datum/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('kostentraeger-ausgaben.json entspricht exakt der ursprünglichen AUSGABEN-Liste', () => {
  const geladen = ladeAusgaben();
  assert.equal(geladen.length, URSPRUENGLICHE_AUSGABEN.length);
  for (let i = 0; i < URSPRUENGLICHE_AUSGABEN.length; i++) {
    assert.equal(geladen[i].datei, URSPRUENGLICHE_AUSGABEN[i].datei);
    assert.equal(geladen[i].gueltigAb, URSPRUENGLICHE_AUSGABEN[i].gueltigAb);
  }
});

// -------------------------------------------------------------
// 2) sqlClient
// -------------------------------------------------------------

test('sqlClient: insert zerlegt Zeilen in 500er Chunks und parametrisiert korrekt', async () => {
  const queries = [];
  const fakeQuery = async (text, params) => {
    queries.push({ text, params });
    return { rows: [] };
  };
  const client = sqlClient(fakeQuery);

  const zeilen = Array.from({ length: 1050 }, (_, i) => ({
    ik: `10000000${i}`,
    name: `Kasse ${i}`,
  }));

  await client.insert('kostentraeger', zeilen);
  assert.equal(queries.length, 3, '1050 Zeilen müssen in 3 Chunks (500 + 500 + 50) aufgeteilt werden');
  assert.ok(queries[0].text.startsWith('INSERT INTO kostentraeger (ik, name) VALUES '));
  assert.equal(queries[0].params.length, 1000); // 500 * 2 Spalten
  assert.equal(queries[0].params[0], '100000000');
  assert.equal(queries[0].params[1], 'Kasse 0');
  assert.equal(queries[2].params.length, 100); // 50 * 2 Spalten
});

test('sqlClient: upsert DO UPDATE SET enthält keine onConflict-Schlüssel', async () => {
  const queries = [];
  const fakeQuery = async (text, params) => {
    queries.push({ text, params });
    return { rows: [] };
  };
  const client = sqlClient(fakeQuery);

  await client.upsert(
    'kostentraeger_annahmestellen',
    [
      {
        kostentraeger_ik: '108310400',
        verknuepfungsart: '09',
        partner_ik: '108916709',
        abrechnungscode: '71',
        art_datenlieferung: '28',
        uebermittlungsmedium: '6',
        bundesland: '',
        quelle: 'AO05Q426_KE0.txt',
        quelle_stand: '2026-10-01',
      },
    ],
    'kostentraeger_ik, verknuepfungsart, partner_ik, abrechnungscode, art_datenlieferung, uebermittlungsmedium, bundesland'
  );

  assert.equal(queries.length, 1);
  const q = queries[0];
  assert.match(q.text, /ON CONFLICT \(kostentraeger_ik, verknuepfungsart, partner_ik, abrechnungscode, art_datenlieferung, uebermittlungsmedium, bundesland\) DO UPDATE SET/);
  assert.match(q.text, /quelle = EXCLUDED\.quelle/);
  assert.match(q.text, /quelle_stand = EXCLUDED\.quelle_stand/);
  assert.doesNotMatch(q.text, /DO UPDATE SET.*kostentraeger_ik = EXCLUDED/);
  assert.doesNotMatch(q.text, /DO UPDATE SET.*partner_ik = EXCLUDED/);
});

test('sqlClient: patch setzt updated_at = now() und WHERE ik = $1', async () => {
  const queries = [];
  const fakeQuery = async (text, params) => {
    queries.push({ text, params });
    return { rows: [] };
  };
  const client = sqlClient(fakeQuery);

  await client.patch('kostentraeger', '108310400', { valid_to: '2026-10-01', abrechnender_kt_ik: null });
  assert.equal(queries.length, 1);
  const q = queries[0];
  assert.equal(q.text, 'UPDATE kostentraeger SET valid_to = $2, abrechnender_kt_ik = $3, updated_at = now() WHERE ik = $1');
  assert.deepEqual(q.params, ['108310400', '2026-10-01', null]);
});

test('sqlClient: schliessen verwendet WHERE id = ANY($2)', async () => {
  const queries = [];
  const fakeQuery = async (text, params) => {
    queries.push({ text, params });
    return { rows: [] };
  };
  const client = sqlClient(fakeQuery);

  await client.schliessen('kostentraeger_annahmestellen', [10, 20, 30], '2026-09-30');
  assert.equal(queries.length, 1);
  const q = queries[0];
  assert.equal(q.text, 'UPDATE kostentraeger_annahmestellen SET valid_to = $1 WHERE id = ANY($2)');
  assert.deepEqual(q.params, ['2026-09-30', [10, 20, 30]]);
});

test('sqlClient: alle castet Datumspalten mit ::text und formatiert ORDER BY', async () => {
  const queries = [];
  const fakeQuery = async (text, params) => {
    queries.push({ text, params });
    return {
      rows: [
        {
          ik: '108310400',
          valid_from: new Date('2026-10-01T00:00:00Z'),
          valid_to: '2026-12-31',
        },
      ],
    };
  };
  const client = sqlClient(fakeQuery);

  const rows = await client.alle('kostentraeger', 'ik, valid_from, valid_to', 'ik.asc');
  assert.equal(queries.length, 1);
  const q = queries[0];
  assert.match(q.text, /SELECT ik, valid_from::text AS valid_from, valid_to::text AS valid_to FROM kostentraeger ORDER BY ik ASC/);
  assert.equal(rows[0].ik, '108310400');
  assert.equal(rows[0].valid_from, '2026-10-01', 'Date-Objekt muss in ISO-String umgewandelt werden');
  assert.equal(rows[0].valid_to, '2026-12-31');
});

test('sqlClient: unerlaubte Tabelle oder Spaltenname wirft Fehler', async () => {
  const client = sqlClient(async () => ({ rows: [] }));

  await assert.rejects(() => client.alle('users', 'id', 'id.asc'), /Unerlaubte Tabelle/);
  await assert.rejects(() => client.alle('kostentraeger', 'ik; DROP TABLE kostentraeger', 'ik.asc'), /Ungültiger Spaltenname/);
  await assert.rejects(() => client.alle('kostentraeger', 'ik', 'ik.drop'), /Ungültige Sortierrichtung/);
  await assert.rejects(() => client.insert('users', [{ id: 1 }]), /Unerlaubte Tabelle/);
  await assert.rejects(() => client.insert('kostentraeger', [{ 'name;drop': 'x' }]), /Ungültiger Spaltenname/);
  await assert.rejects(() => client.patch('kostentraeger', '108310400', { 'spalte-invalid': 1 }), /Ungültiger Spaltenname/);
  await assert.rejects(() => client.schliessen('users', [1], '2026-10-01'), /Unerlaubte Tabelle/);
});

// -------------------------------------------------------------
// 3) synchronisiere
// -------------------------------------------------------------

test('synchronisiere: leerer DB-Zustand erzeugt korrekte Inserts (>1000 KT, VKG/ANS > 0)', async () => {
  const db = new MemoryDb();
  const res = await synchronisiere({
    db,
    stichtag: '2026-11-18',
    heute: '2026-11-18',
    write: true,
    log: () => {},
  });

  assert.ok(res.kt.inserts.length > 1000, `KT inserts soll > 1000 sein, war: ${res.kt.inserts.length}`);
  assert.ok(res.vkg.inserts.length > 0, `VKG inserts soll > 0 sein, war: ${res.vkg.inserts.length}`);
  assert.ok(res.ans.inserts.length > 0, `ANS inserts soll > 0 sein, war: ${res.ans.inserts.length}`);
  assert.ok(db.tables.kostentraeger.length > 1000);
  assert.ok(db.tables.kostentraeger_annahmestellen.length > 0);
  assert.ok(db.tables.kostentraeger_anschriften.length > 0);
});

test('synchronisiere: zweiter Durchlauf auf derselben DB ist idempotent (0 Inserts/Closes)', async () => {
  const db = new MemoryDb();
  await synchronisiere({
    db,
    stichtag: '2026-11-18',
    heute: '2026-11-18',
    write: true,
    log: () => {},
  });

  // Zweiter Aufruf
  const res2 = await synchronisiere({
    db,
    stichtag: '2026-11-18',
    heute: '2026-11-18',
    write: true,
    log: () => {},
  });

  assert.equal(res2.kt.inserts.length, 0, 'Keine neuen KT-Inserts');
  assert.equal(res2.kt.patches.length, 0, 'Keine neuen KT-Patches');
  assert.equal(res2.vkg.inserts.length, 0, 'Keine neuen VKG-Inserts');
  assert.equal(res2.vkg.updates.length, 0, 'Keine VKG-Updates');
  assert.equal(res2.vkg.reopens.length, 0, 'Keine VKG-Reopens');
  assert.equal(res2.vkg.closes.length, 0, 'Keine VKG-Closes');
  assert.equal(res2.ans.inserts.length, 0, 'Keine neuen ANS-Inserts');
  assert.equal(res2.ans.updates.length, 0, 'Keine ANS-Updates');
  assert.equal(res2.ans.reopens.length, 0, 'Keine ANS-Reopens');
  assert.equal(res2.ans.closes.length, 0, 'Keine ANS-Closes');
});

test('synchronisiere: Stichtag in der Zukunft mit write=true löst Adim-2-Sperre aus (kod 4)', async () => {
  const db = new MemoryDb();
  await assert.rejects(
    () => synchronisiere({
      db,
      stichtag: '2026-12-01',
      heute: '2026-11-25',
      write: true,
      log: () => {},
    }),
    err => {
      assert.equal(err.kod, 4);
      assert.match(err.message, /O-139 Adim 2/);
      return true;
    }
  );
});

test('synchronisiere: Stichtag in der Zukunft mit write=false ist als Vorschau erlaubt', async () => {
  const db = new MemoryDb();
  const res = await synchronisiere({
    db,
    stichtag: '2026-12-01',
    heute: '2026-11-25',
    write: false,
    log: () => {},
  });

  assert.equal(res.stichtag, '2026-12-01');
  assert.ok(Array.isArray(res.aktiv));
  assert.ok(Array.isArray(res.kommend));
  assert.ok(res.kt.inserts.length > 0);
});

test('synchronisiere: Rückgabe enthält aktiv EK05Q426_KE2.txt und kommend EK05Q426_KE3.txt für 2026-11-18', async () => {
  const db = new MemoryDb();
  const res = await synchronisiere({
    db,
    stichtag: '2026-11-18',
    heute: '2026-11-18',
    write: false,
    log: () => {},
  });

  assert.ok(res.aktiv.includes('EK05Q426_KE2.txt'), 'EK05Q426_KE2.txt muss aktiv sein');
  assert.ok(res.kommend.includes('EK05Q426_KE3.txt'), 'EK05Q426_KE3.txt muss kommend sein');
});

test('synchronisiere: ungültiger Stichtag wirft kod 1, fehlende Kassenart wirft kod 2', async () => {
  const db = new MemoryDb();

  await assert.rejects(
    () => synchronisiere({ db, stichtag: 'kein-datum', log: () => {} }),
    err => {
      assert.equal(err.kod, 1);
      assert.match(err.message, /--stichtag=YYYY-MM-DD/);
      return true;
    }
  );

  await assert.rejects(
    () => synchronisiere({ db, stichtag: '2020-01-01', log: () => {} }),
    err => {
      assert.equal(err.kod, 2);
      assert.match(err.message, /Keine zum 2020-01-01 gültige Ausgabe/);
      return true;
    }
  );
});
