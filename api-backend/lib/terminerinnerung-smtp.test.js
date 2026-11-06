// Terminerinnerung gegen ein ECHTES SMTP-Protokoll: nodemailer spricht mit einem Mini-Server (node:net, nur 127.0.0.1).
// Belegt, was gemockte sendMail-Aufrufe nicht zeigen: welcher Fehlercode bei welchem Serververhalten entsteht,
// und dass daraus nie ein zweiter Versand wird (G-1). Keine Netzverbindung nach aussen.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import nodemailer from 'nodemailer';

process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-test-key';
const { erinnerungsLauf } = await import('./terminerinnerung-job.js');
const { fakeDb, basis, jetzt, ENV } = await import('./terminerinnerung-testdaten.js');

/** Mini-SMTP-Server. modus: 'ok' | 'greylist' (450 bei RCPT) | 'haengt_nach_daten' (nimmt Text, antwortet nie). */
async function smtpServer(modus = 'ok') {
  const empfangen = []; // vollstaendig uebertragene Nachrichten (DATA ... .)
  const state = { modus };
  const server = net.createServer(sock => {
    sock.write('220 test ESMTP\r\n');
    let imText = false; let text = ''; let zeilenpuffer = '';
    sock.on('error', () => {});
    sock.on('data', d => {
      if (imText) {
        text += d.toString('latin1');
        if (text.endsWith('\r\n.\r\n')) {
          imText = false; empfangen.push(text); text = '';
          if (state.modus !== 'haengt_nach_daten') sock.write('250 queued\r\n');
        }
        return;
      }
      zeilenpuffer += d.toString('latin1');
      const zeilen = zeilenpuffer.split('\r\n'); zeilenpuffer = zeilen.pop();
      for (const z of zeilen) {
        const c = z.toUpperCase();
        if (c.startsWith('EHLO') || c.startsWith('HELO') || c.startsWith('MAIL')) sock.write('250 ok\r\n');
        else if (c.startsWith('RCPT')) sock.write(state.modus === 'greylist' ? '450 4.2.0 Greylisted, try later\r\n' : '250 ok\r\n');
        else if (c.startsWith('DATA')) { sock.write('354 go\r\n'); imText = true; }
        else if (c.startsWith('QUIT')) sock.end('221 bye\r\n');
      }
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { port: server.address().port, empfangen, state, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); }) };
}

const transportFuer = port => () => nodemailer.createTransport({
  host: '127.0.0.1', port, secure: false, ignoreTLS: true, connectionTimeout: 800, greetingTimeout: 800, socketTimeout: 800,
});

function lauf(db, port, extra = {}) {
  const logs = [];
  const log = { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')) };
  return erinnerungsLauf(db, { jetzt, env: ENV, kutu: true, transportFabrik: transportFuer(port), log, ...extra }).then(r => ({ r, logs }));
}

test('SMTP real: Nachricht kommt vollstaendig an (Empfaenger, Betreff, Text), Protokoll = gesendet, zweiter Lauf sendet nichts', async () => {
  const srv = await smtpServer('ok');
  try {
    const db = fakeDb(basis());
    const { r } = await lauf(db, srv.port);
    assert.equal(r.gesendet, 1);
    assert.equal(srv.empfangen.length, 1);
    assert.match(srv.empfangen[0], /^To: patient-eins@example\.invalid$/m);
    assert.match(srv.empfangen[0], /^Subject: =\?UTF-8\?/m);
    assert.equal(db.tabellen.termin_mitteilungen[0].status, 'gesendet');
    await lauf(db, srv.port);
    assert.equal(srv.empfangen.length, 1, 'kein zweiter Versand');
  } finally { await srv.close(); }
});

test('SMTP real: Greylisting (450) -> SMTP_4XX, spaeter am Abend wird genau einmal zugestellt', async () => {
  const srv = await smtpServer('greylist');
  try {
    const db = fakeDb(basis());
    const { r: r1 } = await lauf(db, srv.port);
    assert.equal(r1.fehler, 1); assert.equal(srv.empfangen.length, 0);
    assert.equal(db.tabellen.termin_mitteilungen[0].fehler_code, 'SMTP_4XX');
    srv.state.modus = 'ok';
    const { r: r2 } = await lauf(db, srv.port);
    assert.equal(r2.gesendet, 1); assert.equal(srv.empfangen.length, 1);
    await lauf(db, srv.port); assert.equal(srv.empfangen.length, 1);
  } finally { await srv.close(); }
});

test('SMTP real: Server nimmt den Text an, antwortet aber nie (Timeout) -> NIE ein zweiter Versand (G-1)', async () => {
  const srv = await smtpServer('haengt_nach_daten');
  try {
    const db = fakeDb(basis());
    const { r: r1 } = await lauf(db, srv.port);
    assert.equal(r1.fehler, 1);
    assert.equal(srv.empfangen.length, 1, 'der Server hat die Mail tatsaechlich erhalten');
    assert.equal(db.tabellen.termin_mitteilungen[0].fehler_code, 'ETIMEDOUT');
    srv.state.modus = 'ok';
    const { r: r2 } = await lauf(db, srv.port);
    await lauf(db, srv.port);
    assert.equal(r2.gesendet, 0);
    assert.equal(srv.empfangen.length, 1, 'trotz erreichbarem Server kein Neuversand');
  } finally { await srv.close(); }
});

test('SMTP real: Server nicht erreichbar -> nichts reserviert; nach Rueckkehr genau eine Mail', async () => {
  const srv = await smtpServer('ok');
  const port = srv.port;
  await srv.close(); // Port jetzt geschlossen
  const db = fakeDb(basis());
  const { r: r1, logs } = await lauf(db, port);
  assert.equal(r1.abgebrochen, true); assert.equal(r1.gesendet, 0);
  assert.equal(db.tabellen.termin_mitteilungen.length, 0);
  assert.doesNotMatch(logs.join('\n'), /example\.invalid|patient-/);
  const srv2 = await smtpServer('ok');
  try {
    const { r: r2 } = await lauf(db, srv2.port);
    assert.equal(r2.gesendet, 1); assert.equal(srv2.empfangen.length, 1);
  } finally { await srv2.close(); }
});
