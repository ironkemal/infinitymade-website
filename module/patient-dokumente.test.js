import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pruefeDatei,
  bauePfad,
  saubererName,
  hexSha256,
  formatiereGroesse,
  escapeHtml,
  KATEGORIEN,
} from './patient-dokumente.js';

test('pruefeDatei: gueltige Dateien (PDF, PNG, JPG, JPEG, WEBP <= 10 MB)', () => {
  assert.deepEqual(pruefeDatei({ name: 'befund.pdf', size: 1024, type: 'application/pdf' }), { ok: true });
  assert.deepEqual(pruefeDatei({ name: 'scan.png', size: 2048, type: 'image/png' }), { ok: true });
  assert.deepEqual(pruefeDatei({ name: 'foto.jpg', size: 4096, type: 'image/jpeg' }), { ok: true });
  assert.deepEqual(pruefeDatei({ name: 'foto.jpeg', size: 8192, type: 'image/jpeg' }), { ok: true });
  assert.deepEqual(pruefeDatei({ name: 'bild.webp', size: 16384, type: 'image/webp' }), { ok: true });
  assert.deepEqual(pruefeDatei({ name: 'gross.pdf', size: 10485760, type: 'application/pdf' }), { ok: true });
});

test('pruefeDatei: ungueltige Dateien (zu gross, leer, falscher MIME oder Endung)', () => {
  // Zu gross (> 10 MB)
  const zuGross = pruefeDatei({ name: 'riesig.pdf', size: 10485761, type: 'application/pdf' });
  assert.equal(zuGross.ok, false);
  assert.match(zuGross.fehler, /zu gross/);

  // Leer (0 Bytes oder negativ)
  const leer = pruefeDatei({ name: 'leer.pdf', size: 0, type: 'application/pdf' });
  assert.equal(leer.ok, false);
  assert.match(leer.fehler, /leer/);

  // Nicht erlaubter MIME-Typ
  const mimeFalsch = pruefeDatei({ name: 'skript.js', size: 100, type: 'application/javascript' });
  assert.equal(mimeFalsch.ok, false);
  assert.match(mimeFalsch.fehler, /Dateityp nicht erlaubt/);

  // Endung passt nicht zum MIME-Typ
  const endungFalsch = pruefeDatei({ name: 'schadcode.exe', size: 500, type: 'application/pdf' });
  assert.equal(endungFalsch.ok, false);
  assert.match(endungFalsch.fehler, /Dateiendung passt nicht/);

  // Endung fehlt
  const ohneEndung = pruefeDatei({ name: 'ohneendung', size: 500, type: 'application/pdf' });
  assert.equal(ohneEndung.ok, false);
  assert.match(ohneEndung.fehler, /Dateiendung passt nicht/);

  // Fehlende / unvollstaendige Angaben
  assert.equal(pruefeDatei(null).ok, false);
  assert.equal(pruefeDatei({}).ok, false);
});

test('saubererName: Sonderzeichen auf [A-Za-z0-9._-] reduzieren und laenge beschraenken', () => {
  assert.equal(saubererName('mein_befund-2026.pdf'), 'mein_befund-2026.pdf');
  assert.equal(saubererName('Befund Dr. Müller (Privat) [neu].pdf'), 'Befund_Dr._M_ller__Privat___neu_.pdf');
  assert.equal(saubererName(''), 'datei');
  assert.equal(saubererName(null), 'datei');

  // Max. 80 Zeichen
  const langeBasis = 'a'.repeat(100);
  const gekuerzt = saubererName(langeBasis + '.pdf');
  assert.equal(gekuerzt.length, 80);
});

test('bauePfad: fuegt ownerId, leadId, uuid und sauberen Dateinamen zusammen', () => {
  const pfadMitUuid = bauePfad({
    ownerId: 'own-123',
    leadId: 'lead-456',
    name: 'Befund (Kopie).pdf',
    uuid: 'uuid-789',
  });
  assert.equal(pfadMitUuid, 'own-123/lead-456/dokumente/uuid-789-Befund__Kopie_.pdf');

  // Ohne uebergebene uuid wird globalThis.crypto genutzt
  const pfadAutoUuid = bauePfad({
    ownerId: 'own-123',
    leadId: 'lead-456',
    name: 'test.png',
  });
  assert.match(pfadAutoUuid, /^own-123\/lead-456\/dokumente\/.+-test\.png$/);
});

test('hexSha256: bekannter Testvektor "abc" ergibt korrekten 64-Zeichen Hex-Hash', async () => {
  const puffer = new TextEncoder().encode('abc');
  const hash = await hexSha256(puffer);
  assert.equal(hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('hexSha256: leerer Testvektor "" ergibt Standard-SHA-256', async () => {
  const puffer = new TextEncoder().encode('');
  const hash = await hexSha256(puffer);
  assert.equal(hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('formatiereGroesse: formatiert Bytes lesbar in B, KB und MB auf Deutsch', () => {
  assert.equal(formatiereGroesse(0), '0 B');
  assert.equal(formatiereGroesse(-10), '0 B');
  assert.equal(formatiereGroesse(500), '500 B');
  assert.equal(formatiereGroesse(1024), '1,0 KB');
  assert.equal(formatiereGroesse(1536), '1,5 KB');
  assert.equal(formatiereGroesse(1048576), '1,0 MB');
  assert.equal(formatiereGroesse(5242880), '5,0 MB');
  assert.equal(formatiereGroesse(10485760), '10,0 MB');
});

test('escapeHtml: maskiert Sonderzeichen sicher', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("Tom's & Jerry's"), 'Tom&#39;s &amp; Jerry&#39;s');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('KATEGORIEN: enthaelt alle 6 erlaubten DB-Kategorien mit korrekten Bezeichnungen', () => {
  assert.equal(KATEGORIEN.befund_extern, 'Externer Befund');
  assert.equal(KATEGORIEN.arztbrief, 'Arztbrief');
  assert.equal(KATEGORIEN.bildgebung, 'Bildgebung');
  assert.equal(KATEGORIEN.foto, 'Foto');
  assert.equal(KATEGORIEN.formular_signiert, 'Unterschriebenes Formular');
  assert.equal(KATEGORIEN.sonstiges, 'Sonstiges');
});
