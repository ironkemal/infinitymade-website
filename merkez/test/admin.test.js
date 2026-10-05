import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oeffneDb } from '../db.js';
import { adminBefehl } from '../admin.js';
import { fakeCloudflare } from './helper.js';
import { hashCode, istKutuCodeGueltig, FORMAT_KUTU } from '../../api-backend/routes/mitarbeiter-zugang-code.js';

function umgebung() {
  const db = oeffneDb(':memory:');
  const cloudflare = fakeCloudflare();
  const jetzt = () => 1_800_000_000_000;
  return { db, cloudflare, boxDomain: 'box.example.org', jetzt, akteur: 'tester' };
}
const legeBoxAn = (u, name) => u.db.boxNeu({ boxId: 'a'.repeat(32), publicKey: 'pk', name, acmeUser: 'u', acmeSubdomain: 's', acmeFulldomain: 'f', jetzt: 1 });

test('kod-neu: gültiges Format, nur Hash gespeichert, 14 Tage, Log ohne Code', async () => {
  const u = umgebung();
  const r = await adminBefehl(u, ['kod-neu']);
  assert.ok(istKutuCodeGueltig(r.code));
  const zeile = u.db.codeHolen(hashCode(r.code, FORMAT_KUTU));
  assert.equal(zeile.art, 'kurulum');
  assert.equal(zeile.gueltig_bis - 1_800_000_000, 14 * 86400);
  assert.ok(!JSON.stringify(u.db.adminLogLesen()).includes(r.code.replace(/-/g, '')));
  assert.ok(!JSON.stringify(u.db.adminLogLesen()).includes(r.code));
});

test('kod-rebind: 72 h, an Box-Namen gebunden, unbekannte Box → Fehler', async () => {
  const u = umgebung();
  await assert.rejects(adminBefehl(u, ['kod-rebind', 'nix-da-1']), /Unbekannte Box/);
  legeBoxAn(u, 'sonne-tal-42');
  const r = await adminBefehl(u, ['kod-rebind', 'sonne-tal-42']);
  const zeile = u.db.codeHolen(hashCode(r.code, FORMAT_KUTU));
  assert.equal(zeile.art, 'rebind');
  assert.equal(zeile.box_name, 'sonne-tal-42');
  assert.equal(zeile.gueltig_bis - 1_800_000_000, 72 * 3600);
});

test('iptal sperrt, löscht nur den Challenge-CNAME, A-Eintrag bleibt; adresse-loeschen erst danach', async () => {
  const u = umgebung();
  legeBoxAn(u, 'sonne-tal-42');
  u.cloudflare.rec.set('A|sonne-tal-42.box.example.org', { ip: '192.168.1.5' });
  u.cloudflare.rec.set('CNAME|_acme-challenge.sonne-tal-42.box.example.org', {});
  u.cloudflare.rec.set('CAA|sonne-tal-42.box.example.org', {});
  await assert.rejects(adminBefehl(u, ['adresse-loeschen', 'sonne-tal-42']), /Erst "iptal"/);
  await adminBefehl(u, ['iptal', 'sonne-tal-42']);
  assert.equal(u.db.boxNachName('sonne-tal-42').status, 'iptal');
  assert.ok(u.cloudflare.rec.has('A|sonne-tal-42.box.example.org'));
  assert.ok(!u.cloudflare.rec.has('CNAME|_acme-challenge.sonne-tal-42.box.example.org'));
  await adminBefehl(u, ['iptal', 'sonne-tal-42']); // idempotent
  await adminBefehl(u, ['adresse-loeschen', 'sonne-tal-42']);
  assert.ok(!u.cloudflare.rec.has('A|sonne-tal-42.box.example.org'));
  assert.ok(!u.cloudflare.rec.has('CAA|sonne-tal-42.box.example.org'));
  assert.ok(u.db.nameBelegt('sonne-tal-42', 1), 'Name bleibt für immer belegt');
  assert.deepEqual(u.db.adminLogLesen().map((l) => l.aktion), ['iptal', 'iptal-wiederholt', 'adresse-loeschen']);
});

test('liste und unbekannter Befehl', async () => {
  const u = umgebung();
  legeBoxAn(u, 'sonne-tal-42');
  assert.match((await adminBefehl(u, ['liste'])).text, /sonne-tal-42/);
  await assert.rejects(adminBefehl(u, ['wasauchimmer']), /Befehl:/);
});

test('iptal bei Cloudflare-Ausfall: Sperre + Log stehen, Wiederholung löscht den CNAME nach', async () => {
  const u = umgebung();
  legeBoxAn(u, 'sonne-tal-42');
  u.cloudflare.rec.set('CNAME|_acme-challenge.sonne-tal-42.box.example.org', {});
  const echt = u.cloudflare.loesche;
  u.cloudflare.loesche = async () => { throw new Error('cf down'); };
  await assert.rejects(adminBefehl(u, ['iptal', 'sonne-tal-42']), /cf down/);
  assert.equal(u.db.boxNachName('sonne-tal-42').status, 'iptal');
  assert.equal(u.db.adminLogLesen()[0].aktion, 'iptal');
  assert.ok(u.cloudflare.rec.has('CNAME|_acme-challenge.sonne-tal-42.box.example.org'));
  u.cloudflare.loesche = echt;
  await adminBefehl(u, ['iptal', 'sonne-tal-42']);
  assert.ok(!u.cloudflare.rec.has('CNAME|_acme-challenge.sonne-tal-42.box.example.org'));
});
