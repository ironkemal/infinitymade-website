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

test('ki-an und ki-aus: Status umschalten, Adminlog und Fehler bei unbekannter Box', async () => {
  const u = umgebung();
  await assert.rejects(adminBefehl(u, ['ki-an', 'sonne-tal-42']), /Unbekannte Box/);
  await assert.rejects(adminBefehl(u, ['ki-aus', 'sonne-tal-42']), /Unbekannte Box/);

  legeBoxAn(u, 'sonne-tal-42');
  assert.equal(u.db.boxNachName('sonne-tal-42').ki_status, 'aus');

  // ki-an
  const rAn = await adminBefehl(u, ['ki-an', 'sonne-tal-42']);
  assert.match(rAn.text, /aktiviert/);
  assert.equal(u.db.boxNachName('sonne-tal-42').ki_status, 'aktiv');

  // ki-aus
  const rAus = await adminBefehl(u, ['ki-aus', 'sonne-tal-42']);
  assert.match(rAus.text, /deaktiviert/);
  assert.equal(u.db.boxNachName('sonne-tal-42').ki_status, 'aus');

  const log = u.db.adminLogLesen();
  const aktionen = log.map((l) => l.aktion);
  assert.ok(aktionen.includes('ki-an'));
  assert.ok(aktionen.includes('ki-aus'));
  assert.equal(log.find((l) => l.aktion === 'ki-an').ziel, 'sonne-tal-42');
  assert.equal(log.find((l) => l.aktion === 'ki-aus').ziel, 'sonne-tal-42');
});

test('ki-limit: Zahl und standard, Log-Details und Validierungsfehler', async () => {
  const u = umgebung();
  await assert.rejects(adminBefehl(u, ['ki-limit', 'sonne-tal-42', '500']), /Unbekannte Box/);

  legeBoxAn(u, 'sonne-tal-42');

  // Feste Zahl
  const r1 = await adminBefehl(u, ['ki-limit', 'sonne-tal-42', '500']);
  assert.match(r1.text, /500/);
  assert.equal(u.db.boxNachName('sonne-tal-42').ki_limit, 500);

  // 'standard' (setzt auf null zurück)
  const r2 = await adminBefehl(u, ['ki-limit', 'sonne-tal-42', 'standard']);
  assert.match(r2.text, /standard/);
  assert.equal(u.db.boxNachName('sonne-tal-42').ki_limit, null);

  // Fehlerhafte Limits
  await assert.rejects(adminBefehl(u, ['ki-limit', 'sonne-tal-42', '0']), /Limit muss zwischen/);
  await assert.rejects(adminBefehl(u, ['ki-limit', 'sonne-tal-42', '1000001']), /Limit muss zwischen/);
  await assert.rejects(adminBefehl(u, ['ki-limit', 'sonne-tal-42', '-5']), /Limit muss zwischen/);
  await assert.rejects(adminBefehl(u, ['ki-limit', 'sonne-tal-42', 'keineZahl']), /Limit muss zwischen/);

  const logLimits = u.db.adminLogLesen().filter((l) => l.aktion === 'ki-limit');
  assert.equal(logLimits.length, 2);
  assert.deepEqual(JSON.parse(logLimits[0].details), { limit: 500 });
  assert.deepEqual(JSON.parse(logLimits[1].details), { limit: null });
});

test('ki-global: an und aus, O-169 Hinweis bei an, Log-Details und Fehler', async () => {
  const u = umgebung();
  assert.equal(u.db.einstellungLesen('ki_global'), null);

  // ki-global an mit Hinweis
  const rAn = await adminBefehl(u, ['ki-global', 'an']);
  assert.match(rAn.text, /an/);
  assert.match(rAn.text, /Nur öffnen nach O-169 Bedingung 7 \+ ORG-Freigabe\./);
  assert.equal(u.db.einstellungLesen('ki_global'), 'an');

  // ki-global aus
  const rAus = await adminBefehl(u, ['ki-global', 'aus']);
  assert.match(rAus.text, /aus/);
  assert.equal(u.db.einstellungLesen('ki_global'), 'aus');

  // Ungültiger Wert
  await assert.rejects(adminBefehl(u, ['ki-global', 'ungueltig']), /Wert muss "an" oder "aus" sein/);

  const logs = u.db.adminLogLesen().filter((l) => l.aktion === 'ki-global');
  assert.equal(logs.length, 2);
  assert.deepEqual(JSON.parse(logs[0].details), { wert: 'an' });
  assert.deepEqual(JSON.parse(logs[1].details), { wert: 'aus' });
});

test('ki-stand: Schalter, Box-Status, Monatszähler, Berichte ohne Token, Einzelfilter', async () => {
  const u = umgebung();
  legeBoxAn(u, 'sonne-tal-42');
  const boxId = 'a'.repeat(32);

  // 1 Ausgabe im aktuellen Berliner Monat (u.jetzt() = 1_800_000_000_000 ms = 2027-01-15 -> 2027-01)
  u.db.kiAusgabeEintragen({ boxId, zeit: 1_800_000_000, monat: '2027-01', exp: 1_800_003_600, entraExp: 1_800_003_600 });
  // 1 Bericht mit Token-Summe 350 + 150 = 500
  u.db.kiBerichtSpeichern({
    boxId,
    reportId: 'rep-test-99',
    payloadHash: 'hash-abc',
    windowStart: '2027-01-14T00:00:00Z',
    empfangen: 1_800_000_000,
    daten: {
      taskTotals: {
        'b2c-draft': { total_tokens: 350 },
        'rezept-ocr': { total_tokens: 150 },
      },
    },
  });

  // Einzelfilter ki-stand sonne-tal-42
  const rEinzel = await adminBefehl(u, ['ki-stand', 'sonne-tal-42']);
  assert.match(rEinzel.text, /Globaler KI-Schalter: aus/);
  assert.match(rEinzel.text, /Box: sonne-tal-42/);
  assert.match(rEinzel.text, /KI-Status: aus/);
  assert.match(rEinzel.text, /Zähler \(2027-01\): 1 \/ 600/);
  assert.match(rEinzel.text, /rep-test-99 \(2027-01-14T00:00:00Z\): 500 Tokens/);
  assert.ok(!rEinzel.text.includes('token-'), 'Kein Token im Text');

  // Globale Übersicht ki-stand (alle Boxen)
  await adminBefehl(u, ['ki-global', 'an']);
  await adminBefehl(u, ['ki-an', 'sonne-tal-42']);
  await adminBefehl(u, ['ki-limit', 'sonne-tal-42', '450']);

  const rAlle = await adminBefehl(u, ['ki-stand']);
  assert.match(rAlle.text, /Globaler KI-Schalter: an/);
  assert.match(rAlle.text, /Box: sonne-tal-42/);
  assert.match(rAlle.text, /KI-Status: aktiv/);
  assert.match(rAlle.text, /Zähler \(2027-01\): 1 \/ 450/);

  // Unbekannte Box
  await assert.rejects(adminBefehl(u, ['ki-stand', 'nix-da']), /Unbekannte Box/);
});

test('Hilfetext im default-Fall enthält alle neuen KI-Befehle', async () => {
  const u = umgebung();
  await assert.rejects(adminBefehl(u, ['gibtsnicht']), (err) => {
    assert.match(err.message, /ki-an/);
    assert.match(err.message, /ki-aus/);
    assert.match(err.message, /ki-limit/);
    assert.match(err.message, /ki-global/);
    assert.match(err.message, /ki-stand/);
    return true;
  });
});
