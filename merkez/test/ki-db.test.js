import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { oeffneDb } from '../db.js';

test('Migration: alte DB ohne KI-Spalten wird idempotent erweitert (Opt-in K-20)', () => {
  const tmpPfad = path.join(os.tmpdir(), `merkez-alt-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
  try {
    // 1. Initialisiere DB mit altem boxes-Schema (ohne ki_status und ki_limit)
    const initDb = new DatabaseSync(tmpPfad);
    initDb.exec(`
      CREATE TABLE boxes (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        box_id           TEXT NOT NULL UNIQUE,
        public_key       TEXT NOT NULL,
        name             TEXT NOT NULL UNIQUE,
        status           TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','iptal')),
        erstellt         INTEGER NOT NULL,
        iptal_am         INTEGER,
        acme_user        TEXT,
        acme_subdomain   TEXT,
        acme_fulldomain  TEXT,
        lan_ip           TEXT,
        ip_am            INTEGER,
        caa_account      TEXT
      );
    `);
    initDb.prepare('INSERT INTO boxes (box_id, public_key, name, erstellt) VALUES (?, ?, ?, ?)').run(
      'alt-box-1',
      'pk-1',
      'bestehende-box',
      1_700_000_000
    );
    initDb.close();

    // 2. Mit oeffneDb öffnen: Migration muss ki_status und ki_limit nachrüsten
    const db1 = oeffneDb(tmpPfad);
    const spalten1 = new Set(db1.raw.prepare('PRAGMA table_info(boxes)').all().map((c) => c.name));
    assert.ok(spalten1.has('ki_status'), 'ki_status Spalte existiert');
    assert.ok(spalten1.has('ki_limit'), 'ki_limit Spalte existiert');

    const box = db1.boxNachName('bestehende-box');
    assert.equal(box.ki_status, 'aus', 'Bestehende Boxen bleiben standardmäßig aus (Opt-in)');
    assert.equal(box.ki_limit, null, 'ki_limit ist standardmäßig null');

    db1.close();

    // 3. Zweites Öffnen muss vollkommen idempotent sein
    const db2 = oeffneDb(tmpPfad);
    const box2 = db2.boxNachName('bestehende-box');
    assert.equal(box2.ki_status, 'aus');
    assert.equal(box2.ki_limit, null);
    db2.close();
  } finally {
    try { fs.unlinkSync(tmpPfad); } catch {}
  }
});

test('Einstellungen: Lesen, Setzen und Überschreiben (UPSERT)', () => {
  const db = oeffneDb(':memory:');
  assert.equal(db.einstellungLesen('ki_global'), null);

  db.einstellungSetzen('ki_global', 'an');
  assert.equal(db.einstellungLesen('ki_global'), 'an');

  // Überschreiben (UPSERT)
  db.einstellungSetzen('ki_global', 'aus');
  assert.equal(db.einstellungLesen('ki_global'), 'aus');
});

test('Box KI-Status und Limit: Setzen und Auslesen in boxenListe', () => {
  const db = oeffneDb(':memory:');
  db.boxNeu({
    boxId: 'box-id-1',
    publicKey: 'pk-1',
    name: 'sonne-eins',
    jetzt: 1000,
    acmeUser: 'u',
    acmeSubdomain: 's',
    acmeFulldomain: 'f',
  });

  const b0 = db.boxNachName('sonne-eins');
  assert.equal(b0.ki_status, 'aus');
  assert.equal(b0.ki_limit, null);

  // Status ändern
  assert.equal(db.boxKiSetzen('sonne-eins', 'aktiv'), true);
  assert.equal(db.boxNachName('sonne-eins').ki_status, 'aktiv');
  assert.equal(db.boxKiSetzen('nicht-existent', 'aktiv'), false);

  // Limit ändern
  assert.equal(db.boxKiLimitSetzen('sonne-eins', 500), true);
  assert.equal(db.boxNachName('sonne-eins').ki_limit, 500);

  // Limit auf Standard (null) zurücksetzen
  assert.equal(db.boxKiLimitSetzen('sonne-eins', null), true);
  assert.equal(db.boxNachName('sonne-eins').ki_limit, null);
  assert.equal(db.boxKiLimitSetzen('nicht-existent', 500), false);

  // boxenListe liefert neue Spalten
  const liste = db.boxenListe();
  assert.equal(liste.length, 1);
  assert.equal(liste[0].name, 'sonne-eins');
  assert.equal(liste[0].ki_status, 'aktiv');
  assert.equal(liste[0].ki_limit, null);
});

test('KI-Ausgabe: Zählen je Box und Monat', () => {
  const db = oeffneDb(':memory:');
  assert.equal(db.kiZaehlen('b1', '2026-10'), 0);

  db.kiAusgabeEintragen({ boxId: 'b1', zeit: 1000, monat: '2026-10', exp: 4600, entraExp: 4600 });
  db.kiAusgabeEintragen({ boxId: 'b1', zeit: 2000, monat: '2026-10', exp: 5600, entraExp: 5600 });
  db.kiAusgabeEintragen({ boxId: 'b1', zeit: 3000, monat: '2026-11', exp: 6600, entraExp: 6600 });
  db.kiAusgabeEintragen({ boxId: 'b2', zeit: 4000, monat: '2026-10', exp: 7600, entraExp: 7600 });

  assert.equal(db.kiZaehlen('b1', '2026-10'), 2);
  assert.equal(db.kiZaehlen('b1', '2026-11'), 1);
  assert.equal(db.kiZaehlen('b2', '2026-10'), 1);
  assert.equal(db.kiZaehlen('b2', '2026-11'), 0);
});

test('KI-Berichte: Speichern (neu/gleich/abweichend) und Lesen (neueste zuerst)', () => {
  const db = oeffneDb(':memory:');
  const daten1 = { reportId: 'rep-1', taskTotals: { 'b2c-draft': { total_tokens: 100 } } };

  // 1. Erstmaliges Speichern → 'neu'
  const r1 = db.kiBerichtSpeichern({
    boxId: 'b1',
    reportId: 'rep-1',
    payloadHash: 'hash-111',
    windowStart: '2026-10-01T00:00:00Z',
    empfangen: 1000,
    daten: daten1,
  });
  assert.equal(r1, 'neu');

  // 2. Erneutes Speichern mit gleichem Hash → 'gleich'
  const r2 = db.kiBerichtSpeichern({
    boxId: 'b1',
    reportId: 'rep-1',
    payloadHash: 'hash-111',
    windowStart: '2026-10-01T00:00:00Z',
    empfangen: 1010,
    daten: daten1,
  });
  assert.equal(r2, 'gleich');

  // 3. Erneutes Speichern mit abweichendem Hash → 'abweichend'
  const r3 = db.kiBerichtSpeichern({
    boxId: 'b1',
    reportId: 'rep-1',
    payloadHash: 'hash-222',
    windowStart: '2026-10-01T00:00:00Z',
    empfangen: 1020,
    daten: { abweichend: true },
  });
  assert.equal(r3, 'abweichend');

  // 4. Mehrere Berichte anlegen und mit Limit lesen (neueste zuerst)
  for (let i = 2; i <= 7; i++) {
    db.kiBerichtSpeichern({
      boxId: 'b1',
      reportId: `rep-${i}`,
      payloadHash: `hash-${i}`,
      windowStart: `2026-10-0${i}T00:00:00Z`,
      empfangen: 1000 + i * 10,
      daten: { index: i },
    });
  }

  const berichte = db.kiBerichteLesen('b1', 5);
  assert.equal(berichte.length, 5);
  // Neueste zuerst: rep-7, rep-6, rep-5, rep-4, rep-3
  assert.equal(berichte[0].report_id, 'rep-7');
  assert.equal(berichte[1].report_id, 'rep-6');
  assert.equal(berichte[4].report_id, 'rep-3');
  assert.equal(typeof berichte[0].daten, 'string');
});

test('boxRebind: überträgt Zähler und Berichte, bewahrt ki_status und ki_limit (Kontingent-Schutz)', () => {
  const db = oeffneDb(':memory:');
  db.boxNeu({
    boxId: 'box-alt',
    publicKey: 'pk-alt',
    name: 'rebind-test-box',
    jetzt: 1000,
    acmeUser: 'u1',
    acmeSubdomain: 's1',
    acmeFulldomain: 'f1',
  });
  db.boxKiSetzen('rebind-test-box', 'aktiv');
  db.boxKiLimitSetzen('rebind-test-box', 750);

  // Vor der Neu-Bindung: Zähler und Berichte auf alter box_id
  db.kiAusgabeEintragen({ boxId: 'box-alt', zeit: 1100, monat: '2026-10', exp: 4600, entraExp: 4600 });
  db.kiAusgabeEintragen({ boxId: 'box-alt', zeit: 1200, monat: '2026-10', exp: 5600, entraExp: 5600 });
  db.kiBerichtSpeichern({
    boxId: 'box-alt',
    reportId: 'rep-alt-1',
    payloadHash: 'hash-alt',
    windowStart: '2026-10-01T00:00:00Z',
    empfangen: 1250,
    daten: { test: 1 },
  });

  assert.equal(db.kiZaehlen('box-alt', '2026-10'), 2);

  // Neu-Bindung durchführen
  db.boxRebind('rebind-test-box', {
    boxId: 'box-neu',
    publicKey: 'pk-neu',
    acmeUser: 'u2',
    acmeSubdomain: 's2',
    acmeFulldomain: 'f2',
  });

  // Zähler und Berichte müssen auf box-neu übertragen worden sein
  assert.equal(db.kiZaehlen('box-alt', '2026-10'), 0);
  assert.equal(db.kiZaehlen('box-neu', '2026-10'), 2);

  assert.equal(db.kiBerichteLesen('box-alt', 5).length, 0);
  const berichteNeu = db.kiBerichteLesen('box-neu', 5);
  assert.equal(berichteNeu.length, 1);
  assert.equal(berichteNeu[0].report_id, 'rep-alt-1');

  // Box-Attribute prüfen
  const b = db.boxNachName('rebind-test-box');
  assert.equal(b.box_id, 'box-neu');
  assert.equal(b.ki_status, 'aktiv', 'ki_status bleibt erhalten');
  assert.equal(b.ki_limit, 750, 'ki_limit bleibt erhalten');

  // Idempotente Neu-Bindung mit gleicher box_id (alt == neu)
  db.boxRebind('rebind-test-box', {
    boxId: 'box-neu',
    publicKey: 'pk-neu-2',
    acmeUser: 'u3',
    acmeSubdomain: 's3',
    acmeFulldomain: 'f3',
  });
  assert.equal(db.kiZaehlen('box-neu', '2026-10'), 2);
});
