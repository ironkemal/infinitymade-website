import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { starteIpAbgleich, ipAbgleichSchritt, erzeugeZustand } from './ip-abgleich.js';
import { erzeugeKimlik, speichereAd } from './kimlik.js';

const tmpDirs = [];
after(() => {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  }
});

function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ip-abgleich-test-'));
  tmpDirs.push(d);
  return d;
}

function erstelleRegistrierteKimlik(dir, name = 'sonne-tal-42', fqdn = 'sonne-tal-42.box.beispiel.test') {
  erzeugeKimlik({ dir });
  speichereAd({ dir, ad: name, fqdn });
}

test('starteIpAbgleich: MERKEZ_URL leer -> kein Timer registriert (SaaS-Beweis)', () => {
  let timerAufgerufen = false;
  const fakeTimer = {
    setTimeout: () => { timerAufgerufen = true; return { unref() {} }; },
    setInterval: () => { timerAufgerufen = true; return { unref() {} }; },
  };
  const erg = starteIpAbgleich({
    env: { MERKEZ_URL: '' },
    timer: fakeTimer,
  });
  assert.equal(erg, null);
  assert.equal(timerAufgerufen, false, 'kein Timer darf bei leerem MERKEZ_URL registriert werden');
});

test('starteIpAbgleich: NODE_APP_INSTANCE="1" -> kein Timer registriert', () => {
  let timerAufgerufen = false;
  const fakeTimer = {
    setTimeout: () => { timerAufgerufen = true; return { unref() {} }; },
    setInterval: () => { timerAufgerufen = true; return { unref() {} }; },
  };
  const erg = starteIpAbgleich({
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test', NODE_APP_INSTANCE: '1' },
    timer: fakeTimer,
  });
  assert.equal(erg, null);
  assert.equal(timerAufgerufen, false, 'kein Timer darf auf Instanz != 0 registriert werden');
});

test('ipAbgleichSchritt: nicht registriert -> kein fetch', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const ipDir = path.join(dir, 'ip');
  fs.mkdirSync(ipDir, { recursive: true });
  fs.writeFileSync(path.join(ipDir, 'modus'), 'lan');
  fs.writeFileSync(path.join(ipDir, 'lan-ip'), '192.168.1.10');

  let fetchAufgerufen = false;
  const fetchImpl = async () => {
    fetchAufgerufen = true;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const zustand = erzeugeZustand();

  // Fall a: Gar keine Kimlik
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    kimlikDir,
    ipDir,
  });
  assert.equal(fetchAufgerufen, false, 'ohne Kimlik darf kein fetch erfolgen');

  // Fall b: Kimlik vorhanden, aber ad ist null (nicht registriert)
  erzeugeKimlik({ dir: kimlikDir });
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    kimlikDir,
    ipDir,
  });
  assert.equal(fetchAufgerufen, false, 'mit unregistrierter Kimlik darf kein fetch erfolgen');
});

test('lan: erster Tick sendet {modus:"lan", ip} signiert; gleicher Wert danach kein zweiter Aufruf; nach 6 h erneut; IP-Wechsel sofort', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const ipDir = path.join(dir, 'ip');
  erstelleRegistrierteKimlik(kimlikDir);
  fs.mkdirSync(ipDir, { recursive: true });
  fs.writeFileSync(path.join(ipDir, 'modus'), 'lan');
  fs.writeFileSync(path.join(ipDir, 'lan-ip'), '192.168.1.100');

  const aufrufe = [];
  const fetchImpl = async (url, opt) => {
    aufrufe.push({ url, opt });
    return {
      status: 200,
      ok: true,
      json: async () => ({ ip: '192.168.1.100', ttl: 600 }),
    };
  };

  const zustand = erzeugeZustand();
  let aktuelleZeit = 1000;
  const jetzt = () => aktuelleZeit;

  // 1. Tick: Erstsendung
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    jetzt,
    kimlikDir,
    ipDir,
  });

  assert.equal(aufrufe.length, 1, 'erster Tick muss senden');
  assert.equal(aufrufe[0].url, 'https://merkez.box.beispiel.test/v1/ip');
  assert.deepEqual(JSON.parse(aufrufe[0].opt.body), { modus: 'lan', ip: '192.168.1.100' });
  assert.ok(aufrufe[0].opt.headers['X-Praxura-Signatur'], 'muss signiert sein (X-Praxura-Signatur)');

  // 2. Tick nach 60 s mit gleichem Wert -> kein zweiter Aufruf
  aktuelleZeit += 60_000;
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    jetzt,
    kimlikDir,
    ipDir,
  });
  assert.equal(aufrufe.length, 1, 'gleicher Wert darf nicht erneut senden');

  // 3. Tick nach 6 Stunden -> erneuter Aufruf
  aktuelleZeit += 6 * 60 * 60 * 1000;
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    jetzt,
    kimlikDir,
    ipDir,
  });
  assert.equal(aufrufe.length, 2, 'nach 6 Stunden muss erneut gesendet werden');

  // 4. IP-Wechsel -> sofortiger Aufruf auch kurz nach vorherigem Senden
  aktuelleZeit += 60_000;
  fs.writeFileSync(path.join(ipDir, 'lan-ip'), '192.168.1.200');
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    jetzt,
    kimlikDir,
    ipDir,
  });
  assert.equal(aufrufe.length, 3, 'IP-Wechsel muss sofort senden');
  assert.deepEqual(JSON.parse(aufrufe[2].opt.body), { modus: 'lan', ip: '192.168.1.200' });
});

test('internet: sendet {modus:"internet"}', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const ipDir = path.join(dir, 'ip');
  erstelleRegistrierteKimlik(kimlikDir);
  fs.mkdirSync(ipDir, { recursive: true });
  fs.writeFileSync(path.join(ipDir, 'modus'), 'internet');

  const aufrufe = [];
  const fetchImpl = async (url, opt) => {
    aufrufe.push({ url, opt });
    return {
      status: 200,
      ok: true,
      json: async () => ({ ip: '203.0.113.1', ttl: 600 }),
    };
  };

  const zustand = erzeugeZustand();
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    kimlikDir,
    ipDir,
  });

  assert.equal(aufrufe.length, 1);
  assert.deepEqual(JSON.parse(aufrufe[0].opt.body), { modus: 'internet' });
});

test('502 -> nächster Versuch erst nach >= 5 min; 401 -> erst nach 6 h, Warnung genau einmal', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const ipDir = path.join(dir, 'ip');
  erstelleRegistrierteKimlik(kimlikDir);
  fs.mkdirSync(ipDir, { recursive: true });
  fs.writeFileSync(path.join(ipDir, 'modus'), 'lan');
  fs.writeFileSync(path.join(ipDir, 'lan-ip'), '192.168.1.50');

  let statusCode = 502;
  let aufrufe = 0;
  const fetchImpl = async () => {
    aufrufe++;
    return {
      status: statusCode,
      ok: statusCode === 200,
      json: async () => ({ fehler: `http_${statusCode}` }),
    };
  };

  const warnungen = [];
  const logMock = {
    log: () => {},
    warn: (msg) => { warnungen.push(msg); },
    error: (msg) => { warnungen.push(msg); },
  };

  const zustand = erzeugeZustand();
  let zeit = 1000;
  const jetzt = () => zeit;

  // 1. Versuch: 502
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    jetzt,
    log: logMock,
    kimlikDir,
    ipDir,
  });
  assert.equal(aufrufe, 1, 'erster Aufruf bei 502');

  // Nach 4 Minuten (noch vor 5 min) -> kein Versuch
  zeit += 4 * 60 * 1000;
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    jetzt,
    log: logMock,
    kimlikDir,
    ipDir,
  });
  assert.equal(aufrufe, 1, 'nach 4 Minuten noch blockiert');

  // Nach 5 Minuten (ab T0) -> Versuch erlaubt
  zeit += 1 * 60 * 1000 + 1;
  statusCode = 401; // Jetzt 401 liefern
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    jetzt,
    log: logMock,
    kimlikDir,
    ipDir,
  });
  assert.equal(aufrufe, 2, 'nach >= 5 Minuten erneuter Aufruf');
  assert.equal(warnungen.filter((w) => w.includes('Nicht autorisiert')).length, 1, 'erste 401-Warnung geloggt');

  // Weiterer Tick nach 1 Stunde -> kein Aufruf, keine weitere Warnung
  zeit += 60 * 60 * 1000;
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    jetzt,
    log: logMock,
    kimlikDir,
    ipDir,
  });
  assert.equal(aufrufe, 2, 'bei 401 vor 6 h kein Aufruf');
  assert.equal(warnungen.filter((w) => w.includes('Nicht autorisiert')).length, 1, 'Warnung darf nicht wiederholt werden');

  // Nach 6 Stunden ab dem 401-Fehler -> erneuter Versuch
  zeit += 5 * 60 * 60 * 1000;
  statusCode = 200;
  await ipAbgleichSchritt(zustand, {
    env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
    fetchImpl,
    jetzt,
    log: logMock,
    kimlikDir,
    ipDir,
  });
  assert.equal(aufrufe, 3, 'nach 6 h erneuter Aufruf bei 401');
});

test('Kaputte lan-ip-Datei -> kein fetch', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const ipDir = path.join(dir, 'ip');
  erstelleRegistrierteKimlik(kimlikDir);
  fs.mkdirSync(ipDir, { recursive: true });
  fs.writeFileSync(path.join(ipDir, 'modus'), 'lan');

  let aufrufe = 0;
  const fetchImpl = async () => {
    aufrufe++;
    return { status: 200, ok: true, json: async () => ({}) };
  };

  const ungueltigeWerte = [
    '',
    'keine-ip',
    '999.999.999.999',
    '192.168.1.1.1',
    '192.168.01.1',
    '256.1.1.1',
    '8.8.8.8',     // öffentlich
    '100.64.0.1',  // CGNAT/Tailscale
    '127.0.0.1',   // Loopback
    '172.17.0.1'.replace('17', '15'), // 172.15 = nicht privat
  ];

  for (const ungueltig of ungueltigeWerte) {
    fs.writeFileSync(path.join(ipDir, 'lan-ip'), ungueltig);
    const zustand = erzeugeZustand();
    await ipAbgleichSchritt(zustand, {
      env: { MERKEZ_URL: 'https://merkez.box.beispiel.test' },
      fetchImpl,
      kimlikDir,
      ipDir,
    });
    assert.equal(aufrufe, 0, `bei "${ungueltig}" darf kein fetch stattfinden`);
  }
});
