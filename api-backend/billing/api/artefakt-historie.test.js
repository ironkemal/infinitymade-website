import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { listeArtefaktVersionen, ladeArtefaktVersion, dateinameFuer } from './artefakt-historie.js';

const sha = b => createHash('sha256').update(b).digest('hex');
const O = 'o1', A = 'ab1';

function db({ header, rows, files = {}, listError = false }) {
  const q = (table) => {
    const f = [];
    const b = {
      select() { return b; },
      eq(c, v) { f.push([c, v]); return b; },
      order() { return b; },
      async maybeSingle() {
        const src = table === 'abrechnung' ? (header ? [header] : []) : rows;
        const m = src.filter(r => f.every(([c, v]) => r[c] === undefined || r[c] === v || (c === 'abrechnung_id' && true)));
        return { data: m[0] || null, error: null };
      },
      then(res) { return Promise.resolve(listError ? { data: null, error: { message: 'x' } } : { data: rows.filter(r => f.every(([c, v]) => r[c] === undefined || r[c] === v)), error: null }).then(res); },
    };
    return b;
  };
  return { from: q, storage: { from: () => ({ async download(p) { return files[p] ? { data: { async arrayBuffer() { const b = Buffer.from(files[p]); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } }, error: null } : { data: null, error: { message: 'nf' } }; } }) } };
}
const hdr = (o = {}) => ({ id: A, owner_id: O, status: 'erstellt', dateiname: 'SL/AB 1.dta', created_at: '2026-10-01T00:00:00Z', storage_path: 'o1/ab1/d', signed_storage_path: 'o1/ab1/s', ...o });
const reg = (o = {}) => ({ id: 'r1', owner_id: O, abrechnung_id: A, role: 'signed', kind: 'signed', state: 'published', sha256: sha('inhalt'), legacy: false, created_at: '2026-10-01T00:00:00Z', published_at: '2026-10-01T00:00:01Z', retired_at: null, storage_path: 'o1/ab1/s', ...o });

test('Liste: keine Pfade nach aussen, aktuell-Markierung, Aufbewahrungstext, Wiedervorlage nach 7 Tagen ohne Einreichung', async () => {
  const d = db({ header: hdr(), rows: [reg(), reg({ id: 'r2', role: 'dta', kind: 'unsigned', storage_path: 'o1/ab1/alt', sha256: null, legacy: true })] });
  const erg = await listeArtefaktVersionen({ db: d, ownerId: O, abrechnungId: A, jetzt: new Date('2026-10-20T00:00:00Z') });
  assert.equal(erg.versionen.length, 2);
  assert.ok(!JSON.stringify(erg).includes('o1/ab1'), 'Pfade duerfen nicht in der Antwort stehen');
  const s = erg.versionen.find(v => v.rolle === 'signed');
  assert.equal(s.aktuell, true);
  assert.equal(s.aufbewahrung, 'Noch nicht eingereicht');
  assert.equal(s.wiedervorlage, true);
  const dta = erg.versionen.find(v => v.rolle === 'dta');
  assert.equal(dta.aktuell, false);
  assert.equal(dta.pruefung, 'Bestandsdatei ohne Hash');
});

test('Liste: nach Einreichung 8 Jahre ab Einreichung, keine Wiedervorlage', async () => {
  const d = db({ header: hdr({ status: 'gesendet' }), rows: [reg()] });
  const erg = await listeArtefaktVersionen({ db: d, ownerId: O, abrechnungId: A, jetzt: new Date('2026-12-01T00:00:00Z') });
  assert.equal(erg.versionen[0].aufbewahrung, 'Aufbewahrung: 8 Jahre ab Einreichung');
  assert.equal(erg.versionen[0].wiedervorlage, false);
});

test('Fremder Owner: 403, unbekannte Abrechnung: 404', async () => {
  await assert.rejects(listeArtefaktVersionen({ db: db({ header: hdr({ owner_id: 'o2' }), rows: [] }), ownerId: O, abrechnungId: A }), e => e.status === 403);
  await assert.rejects(listeArtefaktVersionen({ db: db({ header: null, rows: [] }), ownerId: O, abrechnungId: A }), e => e.status === 404);
});

test('Dateinamen je Rolle: unterscheidbar, SECON-konform (verschluesselt ohne Endung), sicher', () => {
  assert.equal(dateinameFuer('dta', 'TSOL0004'), 'TSOL0004.dta');
  assert.equal(dateinameFuer('auftrag', 'TSOL0004'), 'TSOL0004.auf');
  assert.equal(dateinameFuer('begleit', 'TSOL0004'), 'Begleitzettel_TSOL0004.html');
  assert.equal(dateinameFuer('signed', 'TSOL0004'), 'TSOL0004.p7m');
  assert.equal(dateinameFuer('encrypted', 'TSOL0004'), 'TSOL0004');
  assert.equal(dateinameFuer('dta', '../../etc/passwd\n'), '.._.._etc_passwd_.dta');
  assert.equal(dateinameFuer('signed', null), 'abrechnung.p7m');
});

test('Liste enthaelt den Dateinamen je Version', async () => {
  const d = db({ header: hdr({ dateiname: 'TSOL0004' }), rows: [reg(), reg({ id: 'r2', role: 'begleit', kind: 'unsigned', storage_path: 'o1/ab1/b' })] });
  const erg = await listeArtefaktVersionen({ db: d, ownerId: O, abrechnungId: A });
  assert.deepEqual(erg.versionen.map(v => v.dateiname).sort(), ['Begleitzettel_TSOL0004.html', 'TSOL0004.p7m']);
});

test('Download: published mit passendem Hash liefert Bytes und sicheren Dateinamen', async () => {
  const d = db({ header: hdr(), rows: [reg()], files: { 'o1/ab1/s': 'inhalt' } });
  const f = await ladeArtefaktVersion({ db: d, ownerId: O, abrechnungId: A, versionId: 'r1' });
  assert.equal(f.bytes.toString(), 'inhalt');
  assert.match(f.dateiname, /^[A-Za-z0-9._-]+\.p7m$/);
});

test('Download: reserved/retired nicht verfuegbar (409), unbekannt 404', async () => {
  for (const state of ['reserved', 'retired']) {
    const d = db({ header: hdr(), rows: [reg({ state })], files: { 'o1/ab1/s': 'inhalt' } });
    await assert.rejects(ladeArtefaktVersion({ db: d, ownerId: O, abrechnungId: A, versionId: 'r1' }), e => e.status === 409);
  }
  await assert.rejects(ladeArtefaktVersion({ db: db({ header: hdr(), rows: [reg()] }), ownerId: O, abrechnungId: A, versionId: 'zzz' }), e => e.status === 404);
});

test('Download: Hashabweichung wird NICHT ausgeliefert (500)', async () => {
  const d = db({ header: hdr(), rows: [reg()], files: { 'o1/ab1/s': 'manipuliert' } });
  await assert.rejects(ladeArtefaktVersion({ db: d, ownerId: O, abrechnungId: A, versionId: 'r1' }), e => e.code === 'HASH_ABWEICHUNG');
});

test('Download: Fremd-Owner 403, Pfad ausserhalb des Owner-Ordners 403', async () => {
  await assert.rejects(ladeArtefaktVersion({ db: db({ header: hdr({ owner_id: 'o2' }), rows: [reg()] }), ownerId: O, abrechnungId: A, versionId: 'r1' }), e => e.status === 403);
  const d = db({ header: hdr(), rows: [reg({ storage_path: 'o2/ab1/s' })], files: { 'o2/ab1/s': 'inhalt' } });
  await assert.rejects(ladeArtefaktVersion({ db: d, ownerId: O, abrechnungId: A, versionId: 'r1' }), e => e.status === 403);
});

test('Download: Bestandsdatei ohne Hash wird ausgeliefert', async () => {
  const d = db({ header: hdr(), rows: [reg({ sha256: null, legacy: true })], files: { 'o1/ab1/s': 'egal' } });
  const f = await ladeArtefaktVersion({ db: d, ownerId: O, abrechnungId: A, versionId: 'r1' });
  assert.equal(f.bytes.toString(), 'egal');
});
