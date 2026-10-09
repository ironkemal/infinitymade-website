import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { starte, kiBereit } from './helper.js';
import { createJetonClient } from '../../api-backend/ai/ki-jeton.js';
import { kayitAusfuehren } from '../../api-backend/merkez-istemci/kayit.js';
import { ladeKimlik } from '../../api-backend/merkez-istemci/kimlik.js';
import { formatSetupCode, FORMAT_KUTU } from '../../api-backend/routes/mitarbeiter-zugang-code.js';

// Berichtsfenster = heutiger UTC-Tag (Merkez nimmt nur ±2 Tage um die Serverzeit an, guvenlik S-55 D).
const TAG_START = new Date(Math.floor(Date.now() / 86_400_000) * 86_400_000).toISOString();
const TAG_ENDE = new Date(Date.parse(TAG_START) + 86_400_000).toISOString();

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'merkez-vertrag-'));

// Registriert eine Test-Box gegen die Merkez-Test-App
async function registriere(s, { code = s.neuerCode() } = {}) {
  const kimlikDir = tmp();
  const acmednsDir = tmp();
  const erg = await kayitAusfuehren({
    code: formatSetupCode(code, FORMAT_KUTU),
    auto: true,
    kimlikDir,
    acmednsDir,
    baseUrl: s.basis,
  });
  const kimlik = ladeKimlik({ dir: kimlikDir });
  return { code, kimlikDir, acmednsDir, kimlik, ...erg };
}

test('Vertragstest: echter Box-Client createJetonClient gegen Merkez', async () => {
  // Fake-Uhr auf echte Zeit setzen, damit Server und Client (Date.now()) synchron laufen
  const jetztEcht = Date.now();
  const s = await starte({ jetzt: jetztEcht });
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    // Box-Limit auf 1 setzen, damit der zweite Abruf das Kontingent erschöpft
    s.db.boxKiLimitSetzen(r.name, 1);

    // Fake-Entra liefert ein entraExp weit in der Zukunft (> jetzt + 3600 Sekunden)
    // Merkez muss dieses exp auf maximal sek() + 3600 kappen (Client lehnt TTL > 3600 ab)
    s.kiEntra.entraExp = Math.floor(jetztEcht / 1000) + 7200;

    const reportGesendet = {
      reportId: 'rep-vertrag-001',
      windowStart: TAG_START,
      windowEnd: TAG_ENDE,
      taskTotals: {
        'b2c-draft': { calls: 3, prompt_tokens: 120, completion_tokens: 60, total_tokens: 180 },
      },
    };

    const clientConfig = {
      mode: 'jeton',
      activationReady: true,
      valid: true,
      allowedHosts: ['ki-test.example.openai.azure.com'],
    };

    const client = createJetonClient({
      config: clientConfig,
      allowedHosts: ['ki-test.example.openai.azure.com'],
      merkezOptions: { kimlik: r.kimlik, baseUrl: s.basis },
      aggregateSupplier: () => reportGesendet,
      // now bewusst nicht überschreiben: Client nutzt echte Uhr Date.now()
    });

    // 1. Erstabruf: Token abrufen und Felder validieren
    const tokenInfo = await client.getToken();
    assert.equal(tokenInfo.token, 'fake-entra-token-abcdefghij');
    assert.equal(tokenInfo.endpoint, 'https://ki-test.example.openai.azure.com');
    assert.equal(tokenInfo.deployment, 'gpt-test');
    assert.equal(tokenInfo.region, 'swedencentral');
    assert.equal(tokenInfo.apiVersion, '2024-10-21');
    assert.ok(typeof tokenInfo.exp === 'number');

    // Merkez hat entraExp (> 7200s) auf <= 3600s gekappt
    const nowSec = Math.floor(Date.now() / 1000);
    assert.ok(tokenInfo.exp <= nowSec + 3600);

    // Report wurde über acknowledgedReportId quittiert und im Client gelöscht
    assert.equal(client.getState().hasPendingReport, false);

    // Bericht wurde in der Merkez-DB gespeichert
    const berichte = s.db.kiBerichteLesen(r.kimlik.boxId);
    assert.equal(berichte.length, 1);
    assert.equal(berichte[0].report_id, 'rep-vertrag-001');

    // 2. Limit-Erschöpfung testen:
    // Fake-Entra-Token wechseln, damit Merkez nicht dasselbe Token aus kiLetztes serviert
    s.kiEntra.token = 'fake-entra-token-zweiter-call'; // secret-scan: ignore (Fake-Testwert)

    // Zweiter Abruf mit forceRefresh: Limit (1) ist erreicht → Merkez antwortet mit 402 AI_QUOTA_EXCEEDED
    await assert.rejects(
      client.getToken({ forceRefresh: true }),
      (err) => {
        assert.equal(err.code, 'AI_QUOTA_EXCEEDED');
        return true;
      }
    );

    // Client-Zustand: Tokenkontingent erschöpft, gesperrt bis zum resetAt des Zentrums (M4.11 β)
    assert.equal(client.getState().tokenDisabled, true);
    assert.equal(client.getState().disabledReason, 'AI_QUOTA_EXCEEDED');
    const bis = client.getState().disabledUntil;
    assert.ok(bis > Date.now() && bis <= Date.now() + 32 * 86_400_000, 'Sperre endet am Monatsanfang, nicht nie');
    assert.equal(bis % 1000, 0, 'Sperrende kommt aus resetAt (UNIX-Sekunden), nicht aus der 6-h-Obergrenze');
  } finally {
    await s.stop();
  }
});

test('Vertragstest: vorübergehender Ausfall (503) deaktiviert Kontingent nicht dauerhaft', async () => {
  const jetztEcht = Date.now();
  const s = await starte({ jetzt: jetztEcht });
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);

    const clientConfig = {
      mode: 'jeton',
      activationReady: true,
      valid: true,
      allowedHosts: ['ki-test.example.openai.azure.com'],
    };

    const client = createJetonClient({
      config: clientConfig,
      allowedHosts: ['ki-test.example.openai.azure.com'],
      merkezOptions: { kimlik: r.kimlik, baseUrl: s.basis },
    });

    // Entra fällt vorübergehend aus
    s.kiEntra.fehler = true;

    await assert.rejects(
      client.getToken(),
      (err) => {
        assert.equal(err.code, 'AI_JETON_UNAVAILABLE');
        assert.equal(err.status, 503);
        return true;
      }
    );

    // 503 schaltet das Kontingent NICHT ab (Unterschied zu 402 AI_QUOTA_EXCEEDED)
    assert.equal(client.getState().tokenDisabled, false);
    assert.equal(client.getState().disabledReason, null);

    // Nach Behebung des Ausfalls funktioniert der Abruf wieder
    s.kiEntra.fehler = false;
    const tokenInfo = await client.getToken();
    assert.equal(tokenInfo.token, 'fake-entra-token-abcdefghij');
  } finally {
    await s.stop();
  }
});

test('Vertragstest M4.11 γ: abgelehnter Bericht wird auch bei 402 verworfen und blockiert nicht', async () => {
  const s = await starte({ jetzt: Date.now() });
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    s.db.boxKiLimitSetzen(r.name, 1);
    const cfg = { mode: 'jeton', activationReady: true, valid: true, allowedHosts: ['ki-test.example.openai.azure.com'] };
    const neuerClient = () => createJetonClient({
      config: cfg,
      allowedHosts: cfg.allowedHosts,
      merkezOptions: { kimlik: r.kimlik, baseUrl: s.basis },
    });
    const bericht = (calls) => ({
      reportId: 'rep-vertrag-gamma',
      windowStart: TAG_START,
      windowEnd: TAG_ENDE,
      taskTotals: { 'b2c-draft': { calls, prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
    });

    // 1. Erster Prozess meldet den Bericht, Merkez quittiert, Kontingent (1) ist damit verbraucht
    const a = neuerClient();
    await a.reportUsage(bericht(2));
    await a.getToken();
    assert.equal(a.getState().hasPendingReport, false);

    // 2. Neuer Prozess meldet dieselbe ID mit KLEINEREM Zähler (O-183: nur Wachstum ersetzt) → Merkez lehnt ab, Limit → 402
    s.kiEntra.token = 'fake-entra-token-gamma-zwei'; // secret-scan: ignore (Fake-Testwert)
    const b = neuerClient();
    await b.reportUsage(bericht(1));
    const warn = console.warn;
    console.warn = () => {};
    try {
      await assert.rejects(b.getToken(), (err) => err.code === 'AI_QUOTA_EXCEEDED');
    } finally {
      console.warn = warn;
    }
    assert.equal(b.getState().hasPendingReport, false, 'abgelehnter Bericht blockiert die Warteschlange nicht mehr');
    assert.deepEqual(await b.reportUsage({ ...bericht(1), reportId: 'rep-vertrag-gamma-2' }), { ok: true, staged: true });
  } finally {
    await s.stop();
  }
});

test('Vertragstest O-183: wachsender Tagesbericht unter derselben reportId ersetzt den alten (eine Zeile je Tag)', async () => {
  const s = await starte({ jetzt: Date.now() });
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    s.db.boxKiLimitSetzen(r.name, 10);
    const cfg = { mode: 'jeton', activationReady: true, valid: true, allowedHosts: ['ki-test.example.openai.azure.com'] };
    const bericht = (calls, extra = {}) => ({
      reportId: 'rep-vertrag-o183',
      windowStart: TAG_START,
      windowEnd: TAG_ENDE,
      taskTotals: { 'b2c-draft': { calls, prompt_tokens: 10 * calls, completion_tokens: 5 * calls, total_tokens: 15 * calls }, ...extra },
    });
    const melde = async (b, token) => {
      s.kiEntra.token = token;
      const c = createJetonClient({ config: cfg, allowedHosts: cfg.allowedHosts, merkezOptions: { kimlik: r.kimlik, baseUrl: s.basis } });
      await c.reportUsage(b);
      const warn = console.warn; console.warn = () => {};
      try { await c.getToken(); } finally { console.warn = warn; }
      return c.getState().hasPendingReport;
    };

    assert.equal(await melde(bericht(1), 'fake-entra-o183-a'), false); // secret-scan: ignore (Fake-Testwert)
    // Wachstum + neue Aufgabe → quittiert, Zeile ersetzt
    const plus = { 'rezept-ocr': { calls: 1, prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
    assert.equal(await melde(bericht(3, plus), 'fake-entra-o183-b'), false); // secret-scan: ignore (Fake-Testwert)
    let zeilen = s.db.kiBerichteLesen(r.kimlik.boxId);
    assert.equal(zeilen.length, 1);
    assert.equal(JSON.parse(zeilen[0].daten).taskTotals['b2c-draft'].calls, 3);
    // Aufgabe fehlt plötzlich → abgelehnt, alter Stand bleibt
    assert.equal(await melde(bericht(4), 'fake-entra-o183-c'), false); // secret-scan: ignore (Fake-Testwert)
    zeilen = s.db.kiBerichteLesen(r.kimlik.boxId);
    assert.equal(zeilen.length, 1);
    assert.equal(JSON.parse(zeilen[0].daten).taskTotals['b2c-draft'].calls, 3);
    assert.ok(JSON.parse(zeilen[0].daten).taskTotals['rezept-ocr']);
  } finally {
    await s.stop();
  }
});
