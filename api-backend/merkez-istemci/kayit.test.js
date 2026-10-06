import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { kayitAusfuehren, codeAufloesen, args, durum } from './kayit.js';
import { ladeKimlik, erzeugeKimlik } from './kimlik.js';
import { leseSignaturKopf, pruefeSignatur } from './signatur.js';

const tmpDirs = [];
after(() => { for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true }); });

function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kayit-test-'));
  tmpDirs.push(d);
  return d;
}

function baueMockFetch(antworten = {}) {
  const aufrufe = [];
  const fetchImpl = async (url, opt) => {
    aufrufe.push({ url, opt });
    if (url.endsWith('/v1/vorschlag')) {
      return {
        status: 200,
        ok: true,
        json: async () => ({ name: 'sonne-tal-42', fqdn: 'sonne-tal-42.box.beispiel.test' }),
      };
    }
    if (url.endsWith('/v1/register')) {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          name: 'sonne-tal-42',
          fqdn: 'sonne-tal-42.box.beispiel.test',
          acmedns: {
            username: 'user42',
            password: 'secretpassword',
            subdomain: 'sub42',
            fulldomain: 'sub42.auth.acme-dns.box.beispiel.test',
            server_url: 'https://auth.acme-dns.box.beispiel.test',
          },
        }),
      };
    }
    if (url.endsWith('/v1/ip')) {
      if (antworten.ip502) {
        return {
          status: 502,
          ok: false,
          json: async () => ({ fehler: 'dienst' }),
        };
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ ip: '192.168.2.111', ttl: 600 }),
      };
    }
    return { status: 404, ok: false, json: async () => ({ fehler: 'not_found' }) };
  };
  return { fetchImpl, aufrufe };
}

test('Registrierung mit ip:{modus:"lan", ip:"192.168.2.111"}: /v1/ip nach /v1/register, signiert, Body korrekt', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const acmednsDir = path.join(dir, 'acmedns');
  const { fetchImpl, aufrufe } = baueMockFetch();

  const res = await kayitAusfuehren({
    code: 'ABCD-1234-EFGH-5678',
    auto: true,
    ip: { modus: 'lan', ip: '192.168.2.111' },
    baseUrl: 'https://merkez.example.org',
    fetchImpl,
    kimlikDir,
    acmednsDir,
  });

  assert.equal(res.name, 'sonne-tal-42');
  assert.equal(res.fqdn, 'sonne-tal-42.box.beispiel.test');
  assert.deepEqual(res.ip, { ok: true });

  const registerAufruf = aufrufe.find((a) => a.url === 'https://merkez.example.org/v1/register');
  const ipAufrufe = aufrufe.filter((a) => a.url === 'https://merkez.example.org/v1/ip');
  assert.ok(registerAufruf, '/v1/register muss aufgerufen werden');
  assert.equal(ipAufrufe.length, 1, 'genau ein /v1/ip-Aufruf');

  const regIdx = aufrufe.indexOf(registerAufruf);
  const ipIdx = aufrufe.indexOf(ipAufrufe[0]);
  assert.ok(ipIdx > regIdx, '/v1/ip muss nach /v1/register aufgerufen werden');

  // Body korrekt
  assert.deepEqual(JSON.parse(ipAufrufe[0].opt.body), { modus: 'lan', ip: '192.168.2.111' });

  // Signatur prüfen mit der neu aktiven Kimlik
  const aktiveKimlik = ladeKimlik({ dir: kimlikDir });
  assert.ok(aktiveKimlik, 'Kimlik muss existieren');
  assert.equal(aktiveKimlik.ad, 'sonne-tal-42');

  const h = Object.fromEntries(Object.entries(ipAufrufe[0].opt.headers).map(([k, v]) => [k.toLowerCase(), v]));
  const sigKopf = leseSignaturKopf(h);
  assert.ok(sigKopf, 'Signaturkopfzeilen müssen vorhanden sein');

  const sigPruefung = pruefeSignatur({
    method: 'POST',
    host: 'merkez.example.org',
    pfad: '/v1/ip',
    body: ipAufrufe[0].opt.body,
    kopf: sigKopf,
    publicKey: aktiveKimlik.publicKey,
  });
  assert.equal(sigPruefung.ok, true, 'Signatur muss gültig sein');
});

test('/v1/ip antwortet 502: kayitAusfuehren wirft nicht, ip.ok === false, Identität + Name gespeichert', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const acmednsDir = path.join(dir, 'acmedns');
  const { fetchImpl } = baueMockFetch({ ip502: true });

  const res = await kayitAusfuehren({
    code: 'ABCD-1234-EFGH-5678',
    auto: true,
    ip: { modus: 'lan', ip: '192.168.2.111' },
    baseUrl: 'https://merkez.example.org',
    fetchImpl,
    kimlikDir,
    acmednsDir,
  });

  assert.equal(res.name, 'sonne-tal-42');
  assert.equal(res.fqdn, 'sonne-tal-42.box.beispiel.test');
  assert.equal(res.ip.ok, false);
  assert.equal(res.ip.fehler, 'dienst');

  // Identität und Name müssen trotzdem gespeichert sein
  const k = ladeKimlik({ dir: kimlikDir });
  assert.ok(k, 'Kimlik vorhanden');
  assert.equal(k.ad, 'sonne-tal-42');
  assert.ok(fs.existsSync(res.acmednsDatei), 'acmedns.json muss existieren');
});

test('--nur-vorschlag: kein /v1/register, kein /v1/ip', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const acmednsDir = path.join(dir, 'acmedns');
  const { fetchImpl, aufrufe } = baueMockFetch();

  const res = await kayitAusfuehren({
    code: 'ABCD-1234-EFGH-5678',
    nurVorschlag: true,
    ip: { modus: 'lan', ip: '192.168.2.111' },
    baseUrl: 'https://merkez.example.org',
    fetchImpl,
    kimlikDir,
    acmednsDir,
  });

  assert.ok(res.vorschlag);
  assert.equal(res.vorschlag.name, 'sonne-tal-42');
  assert.equal(res.name, undefined);

  const urls = aufrufe.map((a) => a.url);
  assert.ok(urls.some((u) => u.endsWith('/v1/vorschlag')), '/v1/vorschlag aufgerufen');
  assert.ok(!urls.some((u) => u.endsWith('/v1/register')), '/v1/register darf NICHT aufgerufen werden');
  assert.ok(!urls.some((u) => u.endsWith('/v1/ip')), '/v1/ip darf NICHT aufgerufen werden');
});

test('codeAufloesen: Code aus KAYIT_CODE wird benutzt, wenn kein code übergeben', () => {
  assert.equal(codeAufloesen({ code: 'CLI-CODE-1234' }, { KAYIT_CODE: 'ENV-CODE-5678' }), 'CLI-CODE-1234');
  assert.equal(codeAufloesen({}, { KAYIT_CODE: 'ENV-CODE-5678' }), 'ENV-CODE-5678');
  assert.equal(codeAufloesen({ code: '' }, { KAYIT_CODE: 'ENV-CODE-5678' }), 'ENV-CODE-5678');
  assert.equal(codeAufloesen({}, {}), null);
});

test('args: Optionen --lan-ip und --internet inkl. gegenseitigem Ausschluss', () => {
  const a1 = args(['--lan-ip', '192.168.2.111', '--auto']);
  assert.equal(a1.lanIp, '192.168.2.111');
  assert.equal(a1.auto, true);

  const a2 = args(['--internet']);
  assert.equal(a2.internet, true);

  assert.throws(() => args(['--lan-ip', '192.168.2.111', '--internet']), /schließen sich gegenseitig aus/);
});

test('Registrierung: fqdn landet in box.json und ladeKimlik liefert fqdn (abwärtskompatibel wenn fehlend)', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const acmednsDir = path.join(dir, 'acmedns');
  const { fetchImpl } = baueMockFetch();

  const res = await kayitAusfuehren({
    code: 'ABCD-1234-EFGH-5678',
    auto: true,
    baseUrl: 'https://merkez.example.org',
    fetchImpl,
    kimlikDir,
    acmednsDir,
  });

  assert.equal(res.fqdn, 'sonne-tal-42.box.beispiel.test');

  // Prüfe Datei box.json direkt
  const boxJson = JSON.parse(fs.readFileSync(path.join(kimlikDir, 'box.json'), 'utf8'));
  assert.equal(boxJson.ad, 'sonne-tal-42');
  assert.equal(boxJson.fqdn, 'sonne-tal-42.box.beispiel.test');

  // Prüfe ladeKimlik
  const k = ladeKimlik({ dir: kimlikDir });
  assert.equal(k.ad, 'sonne-tal-42');
  assert.equal(k.fqdn, 'sonne-tal-42.box.beispiel.test');

  // Abwärtskompatibilität: altes box.json ohne fqdn liefert fqdn: null
  fs.writeFileSync(path.join(kimlikDir, 'box.json'), JSON.stringify({ box_id: k.boxId, ad: 'altes-format' }));
  const kAlt = ladeKimlik({ dir: kimlikDir });
  assert.equal(kAlt.ad, 'altes-format');
  assert.equal(kAlt.fqdn, null);
  // install.sh bricht in diesem Fall ab (kein "https://" als SITE_URL) — durum meldet fqdn ausdrücklich null
  assert.deepEqual(durum({ kimlikDir }), { registriert: true, ad: 'altes-format', fqdn: null, acmedns: false });
});

test('durum: vor Registrierung registriert:false, nach Registrierung registriert:true mit ad und fqdn (kein Schlüsselmaterial)', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const acmednsDir = path.join(dir, 'acmedns');
  const { fetchImpl } = baueMockFetch();

  // 1) Vor Registrierung (Verzeichnis existiert noch nicht)
  const vorVerzeichnis = durum({ kimlikDir, acmednsDir });
  assert.deepEqual(vorVerzeichnis, { registriert: false, ad: null, fqdn: null, acmedns: false });
  assert.equal(vorVerzeichnis.privateKey, undefined);
  assert.equal(vorVerzeichnis.publicKey, undefined);

  // 2) Vor Registrierung (Schlüssel erzeugt, aber noch nicht registriert)
  erzeugeKimlik({ dir: kimlikDir });
  const vorReg = durum({ kimlikDir, acmednsDir });
  assert.deepEqual(vorReg, { registriert: false, ad: null, fqdn: null, acmedns: false });
  assert.equal(vorReg.privateKey, undefined);
  assert.equal(vorReg.publicKey, undefined);

  // 3) Nach Registrierung
  await kayitAusfuehren({
    code: 'ABCD-1234-EFGH-5678',
    auto: true,
    baseUrl: 'https://merkez.example.org',
    fetchImpl,
    kimlikDir,
    acmednsDir,
  });

  const nachReg = durum({ kimlikDir, acmednsDir });
  assert.deepEqual(nachReg, {
    registriert: true,
    ad: 'sonne-tal-42',
    fqdn: 'sonne-tal-42.box.beispiel.test',
    acmedns: true,
  });
  assert.equal(nachReg.privateKey, undefined);
  assert.equal(nachReg.publicKey, undefined);
  assert.equal(nachReg.password, undefined);
});

test('durum acmedns: nicht registriert -> acmedns false', () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const acmednsDir = path.join(dir, 'acmedns');
  fs.mkdirSync(acmednsDir, { recursive: true });
  fs.writeFileSync(path.join(acmednsDir, 'acmedns.json'), JSON.stringify({
    'box.example.test': { username: 'u', password: 'p', subdomain: 's', server_url: 'https://acme.test' },
  }));
  const res = durum({ kimlikDir, acmednsDir });
  assert.equal(res.registriert, false);
  assert.equal(res.acmedns, false);
});

test('durum acmedns: registriert + passende Datei -> acmedns true, kein Passwort in Rückgabe', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const acmednsDir = path.join(dir, 'acmedns');
  const { fetchImpl } = baueMockFetch();
  await kayitAusfuehren({
    code: 'ABCD-1234-EFGH-5678',
    auto: true,
    baseUrl: 'https://merkez.example.org',
    fetchImpl,
    kimlikDir,
    acmednsDir,
  });
  const res = durum({ kimlikDir, acmednsDir });
  assert.equal(res.registriert, true);
  assert.equal(res.fqdn, 'sonne-tal-42.box.beispiel.test');
  assert.equal(res.acmedns, true);
  assert.equal(res.password, undefined);
  assert.equal(res.username, undefined);
  assert.equal(res.server_url, undefined);
});

test('durum acmedns: Datei für anderen fqdn -> acmedns false', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const acmednsDir = path.join(dir, 'acmedns');
  const { fetchImpl } = baueMockFetch();
  await kayitAusfuehren({
    code: 'ABCD-1234-EFGH-5678',
    auto: true,
    baseUrl: 'https://merkez.example.org',
    fetchImpl,
    kimlikDir,
    acmednsDir,
  });
  fs.writeFileSync(path.join(acmednsDir, 'acmedns.json'), JSON.stringify({
    'anderer-fqdn.box.beispiel.test': {
      username: 'u', password: 'p', subdomain: 's', server_url: 'https://acme.test',
    },
  }));
  const res = durum({ kimlikDir, acmednsDir });
  assert.equal(res.registriert, true);
  assert.equal(res.acmedns, false);
});

test('durum acmedns: kaputtes JSON -> acmedns false', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const acmednsDir = path.join(dir, 'acmedns');
  const { fetchImpl } = baueMockFetch();
  await kayitAusfuehren({
    code: 'ABCD-1234-EFGH-5678',
    auto: true,
    baseUrl: 'https://merkez.example.org',
    fetchImpl,
    kimlikDir,
    acmednsDir,
  });
  fs.writeFileSync(path.join(acmednsDir, 'acmedns.json'), '{ kaputt json !!!');
  const res = durum({ kimlikDir, acmednsDir });
  assert.equal(res.registriert, true);
  assert.equal(res.acmedns, false);
});

test('durum acmedns: fehlende Datei -> acmedns false', async () => {
  const dir = tmp();
  const kimlikDir = path.join(dir, 'kimlik');
  const acmednsDir = path.join(dir, 'acmedns');
  const { fetchImpl } = baueMockFetch();
  await kayitAusfuehren({
    code: 'ABCD-1234-EFGH-5678',
    auto: true,
    baseUrl: 'https://merkez.example.org',
    fetchImpl,
    kimlikDir,
    acmednsDir,
  });
  fs.unlinkSync(path.join(acmednsDir, 'acmedns.json'));
  const res = durum({ kimlikDir, acmednsDir });
  assert.equal(res.registriert, true);
  assert.equal(res.acmedns, false);
});

test('args: Option --durum wird erkannt', () => {
  const a = args(['--durum', '--json']);
  assert.equal(a.durum, true);
  assert.equal(a.json, true);
});
