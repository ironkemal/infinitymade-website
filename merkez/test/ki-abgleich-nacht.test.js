import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oeffneDb } from '../db.js';
import {
  STANDARD_TOLERANZ_AUDIO,
  abgleichenGetrennt,
  berichtAudioSekunden,
} from '../ki-abgleich.js';
import {
  fuehreNachtAbgleichAus,
  gesternUtcTag,
  holeEntraMonitorToken,
  holeSaasTagesSumme,
  leseAzureMonitorMetrik,
} from '../ki-abgleich-nacht.js';

const TAG = '2026-11-26';
const WS = `${TAG}T00:00:00.000Z`;
const JETZT_NACH_TAG = Date.parse('2026-11-27T02:30:00Z');
const TEXT_RESOURCE_ID = '/subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/rg-praxura/providers/Microsoft.CognitiveServices/accounts/praxura-de-text';
const AUDIO_RESOURCE_ID = '/subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/rg-praxura/providers/Microsoft.CognitiveServices/accounts/praxura-se-audio';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_SECRET = 'test-secret-do-not-log';

function erstelleBerichtDaten({ tokens = 0, audioSeconds = 0 } = {}) {
  return {
    taskTotals: {
      'b2c-draft': { calls: 1, prompt_tokens: 0, completion_tokens: 0, total_tokens: tokens },
      transkribieren: { calls: 1, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, audio_seconds: audioSeconds },
    },
  };
}

function aufbauDb() {
  const db = oeffneDb(':memory:');
  let n = 0;
  const speichere = (boxId, { tokens = 0, audioSeconds = 0, windowStart = WS, empfangen = 100 } = {}) => {
    db.kiBerichtSpeichern({
      boxId,
      reportId: `${boxId}-${windowStart.slice(0, 10)}`,
      payloadHash: `hash-${++n}`,
      windowStart,
      empfangen,
      daten: erstelleBerichtDaten({ tokens, audioSeconds }),
    });
  };
  return { db, speichere };
}

function erstelleAzureFetchMock({
  textHourly = [60000, 40000],
  audioHourly = [90, 30],
  saasResponse = null,
  status = 200,
  networkError = false,
} = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (networkError) {
      throw new Error('simulated network failure');
    }
    const u = String(url);
    if (u.startsWith('https://login.microsoftonline.com/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'mock-arm-token-1234567890', expires_in: 3600 }), // secret-scan: ignore
      };
    }
    if (u.includes(TEXT_RESOURCE_ID)) {
      if (status !== 200) return { ok: false, status, json: async () => ({}) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            {
              timeseries: [
                {
                  data: textHourly.map((total, idx) => ({
                    timeStamp: `${TAG}T${String(idx).padStart(2, '0')}:00:00Z`,
                    total,
                  })),
                },
              ],
            },
          ],
        }),
      };
    }
    if (u.includes(AUDIO_RESOURCE_ID)) {
      if (status !== 200) return { ok: false, status, json: async () => ({}) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            {
              timeseries: [
                {
                  data: audioHourly.map((total, idx) => ({
                    timeStamp: `${TAG}T${String(idx).padStart(2, '0')}:00:00Z`,
                    total,
                  })),
                },
              ],
            },
          ],
        }),
      };
    }
    if (saasResponse && u.startsWith('https://saas.example.invalid/')) {
      return {
        ok: true,
        status: 200,
        json: async () => saasResponse,
      };
    }
    throw new Error(`Unerwarteter fetch-Aufruf: ${u}`);
  };
  return { fetchImpl, calls };
}

test('berichtAudioSekunden: summiert audio_seconds über alle Berichte (fehlend/0/ungültig -> 0, fail-closed)', () => {
  assert.equal(STANDARD_TOLERANZ_AUDIO.prozent, 10);
  assert.equal(STANDARD_TOLERANZ_AUDIO.sekunden, 180);

  const berichte = [
    { box_id: 'box-a', daten: JSON.stringify(erstelleBerichtDaten({ tokens: 1000, audioSeconds: 120 })) },
    { box_id: 'box-b', daten: { taskTotals: { transkribieren: { audio_seconds: 45 }, 'b2c-draft': { total_tokens: 500 } } } },
    { box_id: 'box-c', daten: { taskTotals: { transkribieren: { audio_seconds: -10 }, other: { audio_seconds: 1.5 }, bad: { audio_seconds: 'x' } } } },
    { box_id: 'box-d', daten: '{kaputt' },
  ];
  assert.equal(berichtAudioSekunden(berichte), 165);
  assert.equal(berichtAudioSekunden([]), 0);
  assert.equal(berichtAudioSekunden(null), 0);
});

test('abgleichenGetrennt: DE Text + SE Audio im Rahmen, Überschreitungen, SaaS-Abzug, EUR-Kosten und fail-closed Validierung', () => {
  const berichte = [
    { box_id: 'box-a', daten: erstelleBerichtDaten({ tokens: 100_000, audioSeconds: 600 }) },
  ];

  // 1. Innerhalb der Toleranz (Text Grenze: 110000 + 20000 = 130000, Audio Grenze: ceil(600*1.1)+180 = 840)
  const okRes = abgleichenGetrennt({
    berichte,
    azureTextTokens: 130_000,
    azureAudioSeconds: 840,
  });
  assert.equal(okRes.ok, true);
  assert.equal(okRes.grund, 'im_rahmen');
  assert.equal(okRes.text.ok, true);
  assert.equal(okRes.audio.ok, true);
  assert.equal(okRes.audio.grenze, 840);
  // Konservativ gpt-5-mini: 130_000 * 2.024 / 1M = 0.26312 EUR; gpt-4o-transcribe: 840/60 * 0.006072 = 0.085008 EUR
  assert.ok(Math.abs(okRes.text.kostenEur - 0.26312) < 1e-6);
  assert.ok(Math.abs(okRes.audio.kostenEur - 0.085008) < 1e-6);
  assert.ok(Math.abs(okRes.geschaetzteKostenEur - 0.348128) < 1e-6);

  // 2. DE Text Überschreitung
  const textOver = abgleichenGetrennt({
    berichte,
    azureTextTokens: 130_001,
    azureAudioSeconds: 600,
  });
  assert.equal(textOver.ok, false);
  assert.equal(textOver.text.ok, false);
  assert.equal(textOver.audio.ok, true);
  assert.equal(textOver.grund, 'text_ueberschritten');

  // 3. SE Audio Überschreitung
  const audioOver = abgleichenGetrennt({
    berichte,
    azureTextTokens: 100_000,
    azureAudioSeconds: 841,
  });
  assert.equal(audioOver.ok, false);
  assert.equal(audioOver.text.ok, true);
  assert.equal(audioOver.audio.ok, false);
  assert.equal(audioOver.grund, 'audio_ueberschritten');

  // 4. SaaS-Abzug (normal)
  const mitSaas = abgleichenGetrennt({
    berichte,
    azureTextTokens: 200_000,
    azureAudioSeconds: 1000,
    saasTextTokens: 90_000,
    saasAudioSeconds: 300,
  });
  assert.equal(mitSaas.ok, true);
  assert.equal(mitSaas.text.azure, 110_000);
  assert.equal(mitSaas.audio.azure, 700);
  assert.equal(mitSaas.text.warnungSaasUeberAzure, false);
  assert.equal(mitSaas.audio.warnungSaasUeberAzure, false);

  // 5. SaaS > Azure Warnung + Clamping auf 0
  const saasUeber = abgleichenGetrennt({
    berichte,
    azureTextTokens: 50_000,
    azureAudioSeconds: 100,
    saasTextTokens: 80_000,
    saasAudioSeconds: 200,
  });
  assert.equal(saasUeber.ok, true);
  assert.equal(saasUeber.text.azure, 0);
  assert.equal(saasUeber.audio.azure, 0);
  assert.equal(saasUeber.text.warnungSaasUeberAzure, true);
  assert.equal(saasUeber.audio.warnungSaasUeberAzure, true);

  // 6. Fail-closed bei negativen/NaN/ungültigen Eingaben
  for (const bad of [-1, Number.NaN, 1.5, '100', undefined, null]) {
    const r = abgleichenGetrennt({ berichte, azureTextTokens: bad });
    assert.equal(r.ok, false);
    assert.ok(typeof r.fehler === 'string' && r.fehler.length > 0);
  }
  assert.equal(abgleichenGetrennt({ berichte, azureTextTokens: 10, azureAudioSeconds: -5 }).ok, false);
  assert.equal(abgleichenGetrennt({ berichte, azureTextTokens: 10, saasTextTokens: Number.NaN }).ok, false);
  assert.equal(abgleichenGetrennt({ berichte, azureTextTokens: 10, saasAudioSeconds: 1.2 }).ok, false);
});

test('leseAzureMonitorMetrik: OData-Injection abgelehnt, Stundensumme aggregiert, HTTP-Fehler behandelt', async () => {
  const { fetchImpl, calls } = erstelleAzureFetchMock({ textHourly: [1200, 3400, 0, 500] });

  const summe = await leseAzureMonitorMetrik({
    resourceId: TEXT_RESOURCE_ID,
    metricNames: 'ProcessedPromptTokens,GeneratedTokens',
    tag: TAG,
    deploymentFilter: 'gpt-5-mini',
    token: 'tok-abc-123456',
    fetchImpl,
  });
  assert.equal(summe, 5100);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /timespan=2026-11-26T00%3A00%3A00Z%2F2026-11-27T00%3A00%3A00Z/);
  assert.match(calls[0].url, /interval=PT1H/);
  assert.match(calls[0].url, /aggregation=Total/);
  assert.match(calls[0].url, /ModelDeploymentName%20eq%20'gpt-5-mini'/);
  assert.equal(calls[0].init.redirect, 'error');

  // OData-Injection-Versuche strikt abweisen (kein Netzaufruf)
  for (const evil of ["a' or '1'='1", 'gpt 5', 'dep$filter', '../x', 'a'.repeat(65)]) {
    await assert.rejects(
      leseAzureMonitorMetrik({
        resourceId: TEXT_RESOURCE_ID,
        metricNames: 'ProcessedPromptTokens',
        tag: TAG,
        deploymentFilter: evil,
        token: 'tok-abc-123456',
        fetchImpl,
      }),
      /OData|deploymentFilter/
    );
  }
  assert.equal(calls.length, 1);

  // HTTP 503 Fehlerbehandlung (ohne Token im Fehlertext)
  const errMock = erstelleAzureFetchMock({ status: 503 });
  await assert.rejects(
    leseAzureMonitorMetrik({
      resourceId: TEXT_RESOURCE_ID,
      metricNames: 'ProcessedPromptTokens',
      tag: TAG,
      token: 'geheimes-token-xyz',
      fetchImpl: errMock.fetchImpl,
    }),
    (err) => {
      assert.match(err.message, /HTTP 503/);
      assert.ok(!err.message.includes('geheimes-token-xyz'));
      return true;
    }
  );
});

test('gesternUtcTag, holeEntraMonitorToken & holeSaasTagesSumme: UTC-Tag, Scope und HTTPS-Pflicht', async () => {
  assert.equal(gesternUtcTag(Date.parse('2026-11-27T00:05:00Z')), '2026-11-26');
  assert.equal(gesternUtcTag(Date.parse('2026-03-01T02:30:00Z')), '2026-02-28');

  const { fetchImpl, calls } = erstelleAzureFetchMock({
    saasResponse: { textTokens: 42000, audioSeconds: 95 },
  });
  const token = await holeEntraMonitorToken({
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    fetchImpl,
  });
  assert.equal(token, 'mock-arm-token-1234567890');
  assert.match(calls[0].init.body, /management\.azure\.com/);
  assert.equal(calls[0].init.redirect, 'error');

  await assert.rejects(
    holeSaasTagesSumme({ url: 'http://saas.example.invalid/abgleich', tag: TAG, fetchImpl }),
    /HTTPS/
  );
  const saas = await holeSaasTagesSumme({
    url: 'https://saas.example.invalid/abgleich',
    secret: 'saas-sec',
    tag: TAG,
    fetchImpl,
  });
  assert.deepEqual(saas, { textTokens: 42000, audioSeconds: 95 });
});

test('fuehreNachtAbgleichAus: lehnt offenen/zukünftigen UTC-Tag ab (exitCode 1)', async () => {
  const { db } = aufbauDb();
  db.einstellungSetzen('ki_global', 'an');
  const mails = [];
  const { fetchImpl, calls } = erstelleAzureFetchMock();

  const resHeute = await fuehreNachtAbgleichAus({
    db,
    tag: '2026-11-27',
    env: {
      AZURE_MONITOR_TENANT_ID: TENANT_ID,
      AZURE_MONITOR_CLIENT_ID: CLIENT_ID,
      AZURE_MONITOR_CLIENT_SECRET: CLIENT_SECRET,
      AZURE_TEXT_RESOURCE_ID: TEXT_RESOURCE_ID,
    },
    fetchImpl,
    mailSender: async (m) => { mails.push(m); },
    abschalten: true,
    jetztFn: () => JETZT_NACH_TAG,
  });

  assert.equal(resHeute.exitCode, 1);
  assert.equal(resHeute.abgeschaltet, false);
  assert.equal(calls.length, 0);
  assert.equal(db.einstellungLesen('ki_global'), 'an');
  assert.equal(mails.length, 1);

  const resZukunft = await fuehreNachtAbgleichAus({
    db,
    tag: '2026-11-28',
    env: {
      AZURE_MONITOR_TENANT_ID: TENANT_ID,
      AZURE_MONITOR_CLIENT_ID: CLIENT_ID,
      AZURE_MONITOR_CLIENT_SECRET: CLIENT_SECRET,
      AZURE_TEXT_RESOURCE_ID: TEXT_RESOURCE_ID,
    },
    fetchImpl,
    mailSender: async (m) => { mails.push(m); },
    jetztFn: () => JETZT_NACH_TAG,
  });
  assert.equal(resZukunft.exitCode, 1);
});

test('fuehreNachtAbgleichAus: Happy Path -> exitCode 0, adminlog geschrieben, keine Alarm-Mail, ki_global unverändert', async () => {
  const { db, speichere } = aufbauDb();
  db.einstellungSetzen('ki_global', 'an');
  speichere('box-a', { tokens: 100_000, audioSeconds: 120 });

  const { fetchImpl } = erstelleAzureFetchMock({
    textHourly: [50_000, 55_000],
    audioHourly: [60, 70],
  });
  const mails = [];

  const res = await fuehreNachtAbgleichAus({
    db,
    env: {
      AZURE_MONITOR_TENANT_ID: TENANT_ID,
      AZURE_MONITOR_CLIENT_ID: CLIENT_ID,
      AZURE_MONITOR_CLIENT_SECRET: CLIENT_SECRET,
      AZURE_TEXT_RESOURCE_ID: TEXT_RESOURCE_ID,
      AZURE_AUDIO_RESOURCE_ID: AUDIO_RESOURCE_ID,
    },
    fetchImpl,
    mailSender: async (m) => { mails.push(m); },
    abschalten: true,
    jetztFn: () => JETZT_NACH_TAG,
  });

  assert.equal(res.exitCode, 0);
  assert.equal(res.ergebnis.ok, true);
  assert.equal(res.abgeschaltet, false);
  assert.equal(res.alarmGesendet, false);
  assert.equal(mails.length, 0);
  assert.equal(db.einstellungLesen('ki_global'), 'an');

  const logs = db.adminLogLesen().filter((l) => l.aktion === 'ki-abgleich-nacht');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].akteur, 'ki-abgleich-auto');
  assert.equal(logs[0].ziel, TAG);
  const details = JSON.parse(logs[0].details);
  assert.equal(details.ok, true);
  assert.equal(details.text.azure, 105_000);
  assert.equal(details.audio.azure, 130);
  assert.ok(details.geschaetzteKostenEur > 0);
});

test('fuehreNachtAbgleichAus: Überschreitung OHNE --abschalten -> exitCode 2, deutsche Alarm-Mail ohne PHI, ki_global unverändert', async () => {
  const { db, speichere } = aufbauDb();
  db.einstellungSetzen('ki_global', 'an');
  speichere('box-a', { tokens: 10_000, audioSeconds: 60 });

  const { fetchImpl } = erstelleAzureFetchMock({
    textHourly: [200_000],
    audioHourly: [60],
  });
  const mails = [];

  const res = await fuehreNachtAbgleichAus({
    db,
    tag: TAG,
    env: {
      AZURE_MONITOR_TENANT_ID: TENANT_ID,
      AZURE_MONITOR_CLIENT_ID: CLIENT_ID,
      AZURE_MONITOR_CLIENT_SECRET: CLIENT_SECRET,
      AZURE_TEXT_RESOURCE_ID: TEXT_RESOURCE_ID,
      AZURE_AUDIO_RESOURCE_ID: AUDIO_RESOURCE_ID,
      ALERT_EMAIL_TO: 'ops@example.invalid',
    },
    fetchImpl,
    mailSender: async (m) => { mails.push(m); },
    abschalten: false,
    jetztFn: () => JETZT_NACH_TAG,
  });

  assert.equal(res.exitCode, 2);
  assert.equal(res.abgeschaltet, false);
  assert.equal(res.alarmGesendet, true);
  assert.equal(db.einstellungLesen('ki_global'), 'an');
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /Überschreitung 2026-11-26 \(UTC\)/);
  assert.match(mails[0].text, /DE Text/);
  assert.match(mails[0].text, /SE Audio/);
  assert.match(mails[0].text, /EUR/);
  assert.match(mails[0].text, /UNVERÄNDERT/);
  assert.ok(!mails[0].text.includes(CLIENT_SECRET));
  assert.ok(!mails[0].text.includes('mock-arm-token'));
});

test('fuehreNachtAbgleichAus: Überschreitung MIT --abschalten -> exitCode 2, setzt ki_global=aus, Adminlog + Alarm-Mail (nie an)', async () => {
  const { db, speichere } = aufbauDb();
  db.einstellungSetzen('ki_global', 'an');
  speichere('box-a', { tokens: 50_000, audioSeconds: 60 });

  const { fetchImpl } = erstelleAzureFetchMock({
    textHourly: [50_000],
    audioHourly: [500], // Audio Grenze: ceil(60*1.1)+180 = 246 -> überschritten!
  });
  const mails = [];

  const res = await fuehreNachtAbgleichAus({
    db,
    tag: TAG,
    env: {
      AZURE_MONITOR_TENANT_ID: TENANT_ID,
      AZURE_MONITOR_CLIENT_ID: CLIENT_ID,
      AZURE_MONITOR_CLIENT_SECRET: CLIENT_SECRET,
      AZURE_TEXT_RESOURCE_ID: TEXT_RESOURCE_ID,
      AZURE_AUDIO_RESOURCE_ID: AUDIO_RESOURCE_ID,
      ALERT_EMAIL_TO: 'ops@example.invalid',
    },
    fetchImpl,
    mailSender: async (m) => { mails.push(m); },
    abschalten: true,
    jetztFn: () => JETZT_NACH_TAG,
  });

  assert.equal(res.exitCode, 2);
  assert.equal(res.abgeschaltet, true);
  assert.equal(res.alarmGesendet, true);
  assert.equal(db.einstellungLesen('ki_global'), 'aus');

  const globalLogs = db.adminLogLesen().filter((l) => l.aktion === 'ki-global');
  assert.equal(globalLogs.length, 1);
  assert.equal(globalLogs[0].akteur, 'ki-abgleich-auto');
  assert.deepEqual(JSON.parse(globalLogs[0].details), {
    wert: 'aus',
    grund: 'nacht-abgleich-ueberschritten',
    tag: TAG,
  });

  assert.equal(mails.length, 1);
  assert.match(mails[0].text, /ABGESCHALTET \(ki_global = aus\)/);

  // Zweiter Lauf im Zustand 'aus': darf ki_global niemals auf 'an' schalten
  const res2 = await fuehreNachtAbgleichAus({
    db,
    tag: TAG,
    env: {
      AZURE_MONITOR_TENANT_ID: TENANT_ID,
      AZURE_MONITOR_CLIENT_ID: CLIENT_ID,
      AZURE_MONITOR_CLIENT_SECRET: CLIENT_SECRET,
      AZURE_TEXT_RESOURCE_ID: TEXT_RESOURCE_ID,
      AZURE_AUDIO_RESOURCE_ID: AUDIO_RESOURCE_ID,
    },
    fetchImpl: erstelleAzureFetchMock({ textHourly: [50_000], audioHourly: [60] }).fetchImpl,
    mailSender: async (m) => { mails.push(m); },
    abschalten: true,
    jetztFn: () => JETZT_NACH_TAG,
  });
  assert.equal(res2.exitCode, 0);
  assert.equal(db.einstellungLesen('ki_global'), 'aus');
});

test('fuehreNachtAbgleichAus: vorübergehender Azure-Fehler -> exitCode 1, Fehler-Mail, ki_global NICHT abgeschaltet', async () => {
  const { db, speichere } = aufbauDb();
  db.einstellungSetzen('ki_global', 'an');
  speichere('box-a', { tokens: 50_000, audioSeconds: 60 });

  const { fetchImpl } = erstelleAzureFetchMock({ status: 503 });
  const mails = [];

  const res = await fuehreNachtAbgleichAus({
    db,
    tag: TAG,
    env: {
      AZURE_MONITOR_TENANT_ID: TENANT_ID,
      AZURE_MONITOR_CLIENT_ID: CLIENT_ID,
      AZURE_MONITOR_CLIENT_SECRET: CLIENT_SECRET,
      AZURE_TEXT_RESOURCE_ID: TEXT_RESOURCE_ID,
    },
    fetchImpl,
    mailSender: async (m) => { mails.push(m); },
    abschalten: true,
    jetztFn: () => JETZT_NACH_TAG,
  });

  assert.equal(res.exitCode, 1);
  assert.equal(res.abgeschaltet, false);
  assert.equal(res.alarmGesendet, true);
  assert.equal(db.einstellungLesen('ki_global'), 'an');

  const fehlerLogs = db.adminLogLesen().filter((l) => l.aktion === 'ki-abgleich-fehler');
  assert.equal(fehlerLogs.length, 1);
  assert.equal(fehlerLogs[0].akteur, 'ki-abgleich-auto');
  assert.equal(fehlerLogs[0].ziel, TAG);

  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /KI-Abgleich Fehler/);
  assert.match(mails[0].text, /UNVERÄNDERT/);
  assert.ok(!mails[0].text.includes(CLIENT_SECRET));
});

test('Negativtests: resourceId SSRF/Traversal abgelehnt, IEEE-754 Audio-Toleranz exakt (100 -> 110), null-Bericht -> ok:false', async () => {
  // 1. resourceId SSRF / Path-Traversal darf keinen fetch auslösen
  const { fetchImpl, calls } = erstelleAzureFetchMock();
  for (const evilId of [
    '',
    '/subscriptions/00000000-0000-4000-8000-000000000001/../../evil',
    'https://evil.invalid/subscriptions/sub-1/resourceGroups/rg',
    '/subscriptions/sub-1/accounts/acc?evil=1',
    '/subscriptions/sub-1/accounts/acc\r\nHost: evil',
  ]) {
    await assert.rejects(
      leseAzureMonitorMetrik({
        resourceId: evilId,
        metricNames: 'ProcessedPromptTokens',
        tag: TAG,
        token: 'tok-abc-123456',
        fetchImpl,
      }),
      /resourceId/
    );
  }
  assert.equal(calls.length, 0);

  // 2. IEEE-754 Drift: Math.ceil((100 * 110) / 100) muss exakt 110 ergeben (nicht 111!)
  const berichte100 = [
    { box_id: 'box-a', daten: erstelleBerichtDaten({ tokens: 1000, audioSeconds: 100 }) },
  ];
  const exact110 = abgleichenGetrennt({
    berichte: berichte100,
    azureTextTokens: 1000,
    azureAudioSeconds: 110,
    toleranzAudio: { prozent: 10, sekunden: 0 },
  });
  assert.equal(exact110.audio.erlaubtSek, 110);
  assert.equal(exact110.audio.grenze, 110);
  assert.equal(exact110.audio.ok, true);
  assert.equal(exact110.ok, true);

  const over111 = abgleichenGetrennt({
    berichte: berichte100,
    azureTextTokens: 1000,
    azureAudioSeconds: 111,
    toleranzAudio: { prozent: 10, sekunden: 0 },
  });
  assert.equal(over111.audio.ok, false);
  assert.equal(over111.ok, false);

  // 3. null / nicht-Objekt-Elemente in berichte liefern { ok: false, fehler: 'ungueltiger_bericht' } statt TypeError
  for (const badBerichte of [[null], [undefined], ['kaputt'], [123], [[]]]) {
    const r = abgleichenGetrennt({
      berichte: badBerichte,
      azureTextTokens: 100,
      azureAudioSeconds: 10,
    });
    assert.equal(r.ok, false);
    assert.equal(r.fehler, 'ungueltiger_bericht');
  }
});
