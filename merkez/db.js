// Merkez-Datenbank (SQLite, node:sqlite). Alle Zeiten = Unix-Sekunden.
// Tabellen laut O-161: boxes, codes, names_rip, nonces, vorschlag (+ adminlog, nur anhängbar).
// Einrichtungscodes liegen NUR als SHA-256 vor (Klartext wird nie gespeichert).
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS boxes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  box_id           TEXT NOT NULL UNIQUE,          -- aus dem Schlüssel abgeleitet (signatur.js)
  public_key       TEXT NOT NULL,                 -- base64url(SPKI-DER), Ed25519
  name             TEXT NOT NULL UNIQUE,          -- z. B. sonne-tal-42 (ändert sich nie)
  status           TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','iptal')),
  erstellt         INTEGER NOT NULL,
  iptal_am         INTEGER,
  acme_user        TEXT,                          -- acme-dns-Konto (Passwort wird NICHT gespeichert)
  acme_subdomain   TEXT,
  acme_fulldomain  TEXT,
  lan_ip           TEXT,
  ip_am            INTEGER,
  caa_account      TEXT
);
CREATE TABLE IF NOT EXISTS codes (
  code_hash        TEXT PRIMARY KEY,              -- sha256 hex des normalisierten Codes
  art              TEXT NOT NULL CHECK (art IN ('kurulum','rebind')),
  box_name         TEXT,                          -- bei 'rebind': der Name, der neu gebunden wird
  erstellt         INTEGER NOT NULL,
  gueltig_bis      INTEGER NOT NULL,
  benutzt_am       INTEGER,
  vorschlag_anzahl INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS names_rip (            -- Grabstein: einmal vergebene/gesperrte Namen nie wieder
  name   TEXT PRIMARY KEY,
  grund  TEXT NOT NULL,
  am     INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS nonces (
  box_id TEXT NOT NULL,
  nonce  TEXT NOT NULL,
  bis    INTEGER NOT NULL,
  PRIMARY KEY (box_id, nonce)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS nonces_bis ON nonces (bis);
CREATE TABLE IF NOT EXISTS vorschlag (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash      TEXT NOT NULL,
  name           TEXT NOT NULL,
  reserviert_bis INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','verworfen','vergeben'))
);
CREATE INDEX IF NOT EXISTS vorschlag_name ON vorschlag (name);
CREATE TABLE IF NOT EXISTS adminlog (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  zeit     INTEGER NOT NULL,
  akteur   TEXT NOT NULL,
  aktion   TEXT NOT NULL,
  ziel     TEXT,
  details  TEXT
);
CREATE TRIGGER IF NOT EXISTS adminlog_kein_update BEFORE UPDATE ON adminlog
BEGIN SELECT RAISE(ABORT, 'adminlog ist nur anhaengbar'); END;
CREATE TRIGGER IF NOT EXISTS adminlog_kein_delete BEFORE DELETE ON adminlog
BEGIN SELECT RAISE(ABORT, 'adminlog ist nur anhaengbar'); END;
`;

export function oeffneDb(pfad = ':memory:') {
  const db = new DatabaseSync(pfad);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const tx = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  const run = (sql, ...p) => db.prepare(sql).run(...p);
  const get = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);

  return {
    raw: db,
    tx,
    close: () => db.close(),

    // --- Codes ---
    codeAnlegen({ codeHash, art, boxName = null, gueltigBis, jetzt }) {
      run('INSERT INTO codes (code_hash, art, box_name, erstellt, gueltig_bis) VALUES (?,?,?,?,?)', codeHash, art, boxName, jetzt, gueltigBis);
    },
    codeHolen: (codeHash) => get('SELECT * FROM codes WHERE code_hash = ?', codeHash),
    /** Einmal-Verbrauch, atomar: true nur für den ersten Aufrufer. */
    codeVerbrauchen: (codeHash, jetzt) => run('UPDATE codes SET benutzt_am = ? WHERE code_hash = ? AND benutzt_am IS NULL', jetzt, codeHash).changes === 1,
    codeFreigeben: (codeHash) => { run('UPDATE codes SET benutzt_am = NULL WHERE code_hash = ?', codeHash); },

    // --- Namensvorschläge ---
    vorschlagAnlegen(codeHash, name, bis) {
      tx(() => {
        run("UPDATE vorschlag SET status = 'verworfen' WHERE code_hash = ? AND status = 'offen'", codeHash);
        run('INSERT INTO vorschlag (code_hash, name, reserviert_bis) VALUES (?,?,?)', codeHash, name, bis);
        run('UPDATE codes SET vorschlag_anzahl = vorschlag_anzahl + 1 WHERE code_hash = ?', codeHash);
      });
    },
    vorschlagGueltig: (codeHash, name, jetzt) => !!get(
      "SELECT 1 AS x FROM vorschlag WHERE code_hash = ? AND name = ? AND status = 'offen' AND reserviert_bis > ?", codeHash, name, jetzt),
    vorschlagVergeben: (codeHash, name) => { run("UPDATE vorschlag SET status = 'vergeben' WHERE code_hash = ? AND name = ?", codeHash, name); },
    /** Belegt = Box trägt ihn, Grabstein, oder fremde offene Reservierung. */
    nameBelegt: (name, jetzt) => !!(
      get('SELECT 1 AS x FROM boxes WHERE name = ?', name)
      || get('SELECT 1 AS x FROM names_rip WHERE name = ?', name)
      || get("SELECT 1 AS x FROM vorschlag WHERE name = ? AND status = 'offen' AND reserviert_bis > ?", name, jetzt)),
    grabstein: (name, grund, jetzt) => { run('INSERT OR IGNORE INTO names_rip (name, grund, am) VALUES (?,?,?)', name, grund, jetzt); },

    // --- Boxen ---
    boxNeu: (b) => { run(
      'INSERT INTO boxes (box_id, public_key, name, erstellt, acme_user, acme_subdomain, acme_fulldomain) VALUES (?,?,?,?,?,?,?)',
      b.boxId, b.publicKey, b.name, b.jetzt, b.acmeUser, b.acmeSubdomain, b.acmeFulldomain); },
    boxNachId: (boxId) => get('SELECT * FROM boxes WHERE box_id = ?', boxId),
    boxNachName: (name) => get('SELECT * FROM boxes WHERE name = ?', name),
    boxLoeschenNachName: (name) => { run('DELETE FROM boxes WHERE name = ?', name); },
    /** Neu-Bindung: neuer Schlüssel + neues acme-dns-Konto, gleicher Name; alter Schlüssel ist damit sofort tot. */
    boxRebind: (name, b) => { run(
      "UPDATE boxes SET box_id=?, public_key=?, acme_user=?, acme_subdomain=?, acme_fulldomain=?, caa_account=NULL, status='aktiv', iptal_am=NULL WHERE name=?",
      b.boxId, b.publicKey, b.acmeUser, b.acmeSubdomain, b.acmeFulldomain, name); },
    boxIptal: (name, jetzt) => run("UPDATE boxes SET status='iptal', iptal_am=? WHERE name=? AND status='aktiv'", jetzt, name).changes === 1,
    boxIp: (boxId, ip, jetzt) => { run('UPDATE boxes SET lan_ip=?, ip_am=? WHERE box_id=?', ip, jetzt, boxId); },
    boxCaa: (boxId, accountUri) => { run('UPDATE boxes SET caa_account=? WHERE box_id=?', accountUri, boxId); },
    boxenListe: () => all('SELECT name, box_id, status, erstellt, iptal_am, lan_ip, ip_am, caa_account FROM boxes ORDER BY id'),

    // --- Nonces (Replay-Schutz) ---
    /** true = Nonce war neu und ist jetzt für `ttl` Sekunden gemerkt. */
    nonceMerken(boxId, nonce, jetzt, ttl = 600) {
      run('DELETE FROM nonces WHERE bis < ?', jetzt);
      return run('INSERT OR IGNORE INTO nonces (box_id, nonce, bis) VALUES (?,?,?)', boxId, nonce, jetzt + ttl).changes === 1;
    },

    // --- Admin-Protokoll (nur anhängbar; niemals Codes oder Schlüssel eintragen) ---
    adminLog(akteur, aktion, ziel, details, jetzt) {
      run('INSERT INTO adminlog (zeit, akteur, aktion, ziel, details) VALUES (?,?,?,?,?)', jetzt, akteur, aktion, ziel ?? null, details ? JSON.stringify(details) : null);
    },
    adminLogLesen: () => all('SELECT * FROM adminlog ORDER BY id'),
    /** K2b.4b: CAA-Kontowechsel dieser Box-Identität seit `seit` (Erstbindung zählt nicht). */
    caaWechselZaehlen: (boxId, seit) => get("SELECT COUNT(*) AS c FROM adminlog WHERE aktion = 'caa-wechsel' AND akteur = ? AND zeit >= ?", `box:${boxId}`, seit)?.c ?? 0,
  };
}
