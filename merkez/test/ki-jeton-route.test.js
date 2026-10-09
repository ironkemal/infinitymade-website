import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { starte, kiBereit } from './helper.js';
import { formatSetupCode, FORMAT_KUTU } from '../../api-backend/routes/mitarbeiter-zugang-code.js';
import { ladeKimlik } from '../../api-backend/merkez-istemci/kimlik.js';
import { merkezFetch } from '../../api-backend/merkez-istemci/merkez-fetch.js';
import { kayitAusfuehren } from '../../api-backend/merkez-istemci/kayit.js';
import { monatsSchluessel } from '../ki-jeton.js';

// Berichtsfenster = heutiger UTC-Tag (Merkez nimmt nur ±2 Tage um die Serverzeit an, guvenlik S-55 D).
const TAG_START = new Date(Math.floor(Date.now() / 86_400_000) * 86_400_000).toISOString();
const TAG_ENDE = new Date(Date.parse(TAG_START) + 86_400_000).toISOString();

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'merkez-ki-'));

// Registriert eine Test-Box gegen die Merkez-App
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

const signiert = (s, kimlik, body, opt = {}) =>
  merkezFetch('/v1/ki/jeton', { kimlik, baseUrl: s.basis, body, ...opt });

test('200-Pfad: alle Pflichtfelder, exp <= 3600, endpoint-Form', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    const res = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(res.status, 200);
    assert.equal(res.json.token, 'fake-entra-token-abcdefghij');
    const sek = Math.floor(s.uhr.ms / 1000);
    assert.ok(res.json.exp > sek);
    assert.ok(res.json.exp <= sek + 3600);
    assert.equal(res.json.endpoint, 'https://ki-test.example.openai.azure.com/');
    assert.equal(res.json.deployment, 'gpt-test');
    assert.equal(res.json.region, 'swedencentral');
    assert.equal(res.json.apiVersion, '2024-10-21');
    assert.equal(res.json.acknowledgedReportId, undefined);
  } finally {
    await s.stop();
  }
});

test('ki_status aus → 503 ki_nicht_freigeschaltet', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    // Global an, aber Box ki_status bleibt Standard 'aus'
    s.db.einstellungSetzen('ki_global', 'an');
    const res = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(res.status, 503);
    assert.deepEqual(res.json, { fehler: 'ki_nicht_freigeschaltet' });
  } finally {
    await s.stop();
  }
});

test('global aus (Standard) → 503 ki_aus', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    // Box aktiv, aber global bleibt 'aus'
    s.db.boxKiSetzen(r.name, 'aktiv');
    const res = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(res.status, 503);
    assert.deepEqual(res.json, { fehler: 'ki_aus' });

    // Auch explizites 'aus' führt zu 503
    s.db.einstellungSetzen('ki_global', 'aus');
    const res2 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(res2.status, 503);
    assert.deepEqual(res2.json, { fehler: 'ki_aus' });
  } finally {
    await s.stop();
  }
});

test('ungültige oder fehlende ki-Konfiguration → 503 ki_aus', async () => {
  const s1 = await starte({ ki: { gueltig: false, grund: 'fehlt:KI_ENDPOINT' } });
  try {
    const r = await registriere(s1);
    kiBereit(s1, r.name);
    const res = await signiert(s1, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(res.status, 503);
    assert.deepEqual(res.json, { fehler: 'ki_aus' });
  } finally {
    await s1.stop();
  }

  const s2 = await starte({ kiEntra: null });
  try {
    const r2 = await registriere(s2);
    kiBereit(s2, r2.name);
    const res2 = await signiert(s2, r2.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(res2.status, 503);
    assert.deepEqual(res2.json, { fehler: 'ki_aus' });
  } finally {
    await s2.stop();
  }
});

test('Limit erreicht → 402 + code AI_QUOTA_EXCEEDED + resetAt', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    s.db.boxKiLimitSetzen(r.name, 1);

    const r1 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(r1.status, 200);

    // Neues Token einstellen, damit RAM-Cache (gleiches Token) nicht greift
    s.kiEntra.token = 'fake-token-nach-limit-erschöpfung';
    const r2 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(r2.status, 402);
    assert.notEqual(r2.status, 429);
    assert.equal(r2.json.code, 'AI_QUOTA_EXCEEDED');
    assert.equal(typeof r2.json.resetAt, 'number');
    const sek = Math.floor(s.uhr.ms / 1000);
    assert.ok(r2.json.resetAt > sek);
  } finally {
    await s.stop();
  }
});

test('ki_limit der Box überschreibt Standard', async () => {
  const standardKi = {
    gueltig: true,
    grund: null,
    endpoint: 'https://ki-test.example.openai.azure.com/',
    deployment: 'gpt-test',
    region: 'swedencentral',
    apiVersion: '2024-10-21',
    monatsLimit: 1,
  };
  const s = await starte({ ki: standardKi });
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    s.db.boxKiLimitSetzen(r.name, 2); // Box darf 2 statt Standard 1

    s.kiEntra.token = 'tok-1';
    assert.equal((await signiert(s, r.kimlik, { antragsteller: 'praxura-box' })).status, 200);

    s.kiEntra.token = 'tok-2';
    assert.equal((await signiert(s, r.kimlik, { antragsteller: 'praxura-box' })).status, 200);

    s.kiEntra.token = 'tok-3';
    const r3 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(r3.status, 402);
    assert.equal(r3.json.code, 'AI_QUOTA_EXCEEDED');
  } finally {
    await s.stop();
  }
});

test('Rate-Limit (config.limitKi:2) → 503 nie 429', async () => {
  const s = await starte({ config: { limitKi: 2 } });
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);

    assert.equal((await signiert(s, r.kimlik, { antragsteller: 'praxura-box' })).status, 200);
    assert.equal((await signiert(s, r.kimlik, { antragsteller: 'praxura-box' })).status, 200);

    const r3 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.notEqual(r3.status, 429);
    assert.equal(r3.status, 503);
    assert.deepEqual(r3.json, { fehler: 'zu_viele_anfragen' });
  } finally {
    await s.stop();
  }
});

test('Report ack idempotent: 2 Aufrufe gleiche ID → beide ack, 1 Zeile in DB', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);

    const report = {
      reportId: 'rep-idempotent-01',
      windowStart: TAG_START,
      windowEnd: TAG_ENDE,
      taskTotals: {
        'b2c-draft': { calls: 1, prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      },
    };

    const a1 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box', report });
    assert.equal(a1.status, 200);
    assert.equal(a1.json.acknowledgedReportId, 'rep-idempotent-01');

    const a2 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box', report });
    assert.equal(a2.status, 200);
    assert.equal(a2.json.acknowledgedReportId, 'rep-idempotent-01');

    const berichte = s.db.kiBerichteLesen(r.kimlik.boxId);
    assert.equal(berichte.length, 1);
    assert.equal(berichte[0].report_id, 'rep-idempotent-01');
  } finally {
    await s.stop();
  }
});

test('gleiche ID, Zähler sinkt → kein ack, Alarm im Log (Wachstum ersetzt, O-183)', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);

    const repA = {
      reportId: 'rep-abweichend-01',
      windowStart: TAG_START,
      windowEnd: TAG_ENDE,
      taskTotals: {
        'b2c-draft': { calls: 99, prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      },
    };
    const repB = {
      reportId: 'rep-abweichend-01',
      windowStart: TAG_START,
      windowEnd: TAG_ENDE,
      taskTotals: {
        'b2c-draft': { calls: 1, prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      },
    };

    const a1 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box', report: repA });
    assert.equal(a1.status, 200);
    assert.equal(a1.json.acknowledgedReportId, 'rep-abweichend-01');

    const a2 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box', report: repB });
    assert.equal(a2.status, 200);
    assert.equal(a2.json.acknowledgedReportId, undefined);
    assert.equal(a2.json.rejectedReportId, 'rep-abweichend-01');
    assert.ok(s.fehlerLog.some((l) => l.includes('[merkez] ki-bericht abweichend:') && l.includes(r.name)));
  } finally {
    await s.stop();
  }
});

test('ungültiger Report → 200 ohne ack, nichts gespeichert, Log ohne Inhalt', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);

    const geheimerMarker = 'GEHEIMNIS_PATIENT_12345';
    const ungueltig = {
      reportId: geheimerMarker,
      windowStart: 'ungueltiges-datum',
    };

    const res = await signiert(s, r.kimlik, { antragsteller: 'praxura-box', report: ungueltig });
    assert.equal(res.status, 200);
    assert.ok(res.json.token);
    assert.equal(res.json.acknowledgedReportId, undefined);
    // lesbare ID → Box darf den Bericht verwerfen (O-169 γ); der Inhalt bleibt trotzdem ungespeichert/ungeloggt
    assert.equal(res.json.rejectedReportId, geheimerMarker);

    const berichte = s.db.kiBerichteLesen(r.kimlik.boxId);
    assert.equal(berichte.length, 0);

    assert.ok(s.fehlerLog.some((l) => l.includes('[merkez] bericht_ungueltig:') && l.includes(r.name)));
    assert.ok(!s.fehlerLog.some((l) => l.includes(geheimerMarker)));
  } finally {
    await s.stop();
  }
});

test('unbekannter Task abgewiesen → kein ack', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);

    const report = {
      reportId: 'rep-unbekannt-task',
      windowStart: TAG_START,
      windowEnd: TAG_ENDE,
      taskTotals: {
        'unbekannter-task': { calls: 1, prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      },
    };

    const res = await signiert(s, r.kimlik, { antragsteller: 'praxura-box', report });
    assert.equal(res.status, 200);
    assert.equal(res.json.acknowledgedReportId, undefined);
    assert.equal(s.db.kiBerichteLesen(r.kimlik.boxId).length, 0);
    assert.ok(s.fehlerLog.some((l) => l.includes('[merkez] bericht_ungueltig:') && l.includes('(tasks)')));
  } finally {
    await s.stop();
  }
});

test('Entra-Fehler → 503, kiZaehlen unverändert', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    s.kiEntra.fehler = true;

    const res = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(res.status, 503);
    assert.deepEqual(res.json, { fehler: 'dienst' });

    const monat = monatsSchluessel(s.uhr.ms);
    assert.equal(s.db.kiZaehlen(r.kimlik.boxId, monat), 0);
    assert.ok(s.fehlerLog.some((l) => l.includes('[merkez] ki-entra fehlgeschlagen:')));
  } finally {
    await s.stop();
  }
});

test('iptal-Box → 401', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    s.db.boxIptal(r.name, 1);

    const res = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(res.status, 401);
    assert.equal(res.json.fehler, 'signatur');
  } finally {
    await s.stop();
  }
});

test('gleiches Token zweimal (2 Worker) → Zähler 1, neues Token → Zähler 2', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);

    // 1. Worker fragt an
    const r1 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(r1.status, 200);

    // 2. Worker fragt an (gleiches Token)
    const r2 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(r2.status, 200);

    const monat = monatsSchluessel(s.uhr.ms);
    assert.equal(s.db.kiZaehlen(r.kimlik.boxId, monat), 1);

    // Neues Token erhalten
    s.kiEntra.token = 'zweites-entra-token-neu';
    const r3 = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(r3.status, 200);
    assert.equal(s.db.kiZaehlen(r.kimlik.boxId, monat), 2);
  } finally {
    await s.stop();
  }
});

test('Log-Spy: weder Token noch Client-Secrets in s.fehlerLog über alle Pfade', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);

    await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    s.kiEntra.fehler = true;
    await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    s.kiEntra.fehler = false;
    await signiert(s, r.kimlik, { antragsteller: 'praxura-box', report: { ungueltig: true } });

    for (const zeile of s.fehlerLog) {
      assert.ok(!zeile.includes('fake-entra-token-abcdefghij'), 'Token darf nicht im Log stehen');
      assert.ok(!zeile.toLowerCase().includes('client_secret'), 'Secret darf nicht im Log stehen');
      assert.ok(!zeile.toLowerCase().includes('clientsecret'), 'Secret darf nicht im Log stehen');
    }
  } finally {
    await s.stop();
  }
});

test('Token nie in der DB (Dump aller Tabellen durchsuchen)', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });

    const tabellen = ['boxes', 'ki_ausgabe', 'ki_bericht', 'einstellungen', 'adminlog', 'codes'];
    for (const t of tabellen) {
      const zeilen = s.db.raw.prepare(`SELECT * FROM ${t}`).all();
      const text = JSON.stringify(zeilen);
      assert.ok(!text.includes('fake-entra-token-abcdefghij'), `Token in Tabelle ${t} gefunden`);
    }
  } finally {
    await s.stop();
  }
});

test('Monatswechsel: Zähler zählt nach Berliner Monatsgrenze neu', async () => {
  // Registrierung läuft in echter Zeit (Signatur-Toleranz); danach springt die Server-Uhr.
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    const bei = (iso) => {
      s.uhr.ms = Date.parse(iso);
      s.kiEntra.entraExp = Math.floor(s.uhr.ms / 1000) + 3600;
      return { jetzt: s.uhr.ms };
    };

    s.kiEntra.token = 'token-oktober-abcdefghij'; // secret-scan: ignore (Fake-Testwert)
    await signiert(s, r.kimlik, { antragsteller: 'praxura-box' }, bei('2026-10-15T12:00:00Z'));
    assert.equal(s.db.kiZaehlen(r.kimlik.boxId, '2026-10'), 1);

    // 31.10. 23:30 Berlin (CET) = 22:30Z → schon November? Nein: 31.10. 22:30Z = 23:30 CET, noch Oktober
    s.kiEntra.token = 'token-oktober2-abcdefghij'; // secret-scan: ignore (Fake-Testwert)
    await signiert(s, r.kimlik, { antragsteller: 'praxura-box' }, bei('2026-10-31T22:30:00Z'));
    assert.equal(s.db.kiZaehlen(r.kimlik.boxId, '2026-10'), 2);

    // 31.10. 23:30Z = 00:30 CET am 01.11. → November
    s.kiEntra.token = 'token-november-abcdefghij'; // secret-scan: ignore (Fake-Testwert)
    await signiert(s, r.kimlik, { antragsteller: 'praxura-box' }, bei('2026-10-31T23:30:00Z'));
    assert.equal(s.db.kiZaehlen(r.kimlik.boxId, '2026-10'), 2);
    assert.equal(s.db.kiZaehlen(r.kimlik.boxId, '2026-11'), 1);
  } finally {
    await s.stop();
  }
});

test('Body-Prüfungen: null / fehlender oder falscher Antragsteller → 400 fehler:body', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);

    const r1 = await signiert(s, r.kimlik, null);
    assert.equal(r1.status, 400);
    assert.deepEqual(r1.json, { fehler: 'body' });

    const r2 = await signiert(s, r.kimlik, { antragsteller: 'falscher-antragsteller' });
    assert.equal(r2.status, 400);
    assert.deepEqual(r2.json, { fehler: 'body' });

    const r3 = await signiert(s, r.kimlik, {});
    assert.equal(r3.status, 400);
    assert.deepEqual(r3.json, { fehler: 'body' });
  } finally {
    await s.stop();
  }
});

test('exp <= sek() + 60 → 503 fehler:dienst', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    // Token läuft in 40 Sekunden ab
    s.kiEntra.entraExp = Math.floor(s.uhr.ms / 1000) + 40;

    const res = await signiert(s, r.kimlik, { antragsteller: 'praxura-box' });
    assert.equal(res.status, 503);
    assert.deepEqual(res.json, { fehler: 'dienst' });
  } finally {
    await s.stop();
  }
});

test('Bericht mit Tagesfenster weit weg von der Serverzeit → nicht gespeichert, rejectedReportId (S-55 D)', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    kiBereit(s, r.name);
    const alt = { reportId: 'rep-alt-01', windowStart: '2020-01-01T00:00:00.000Z', windowEnd: '2020-01-02T00:00:00.000Z', taskTotals: {} };
    const res = await signiert(s, r.kimlik, { antragsteller: 'praxura-box', report: alt });
    assert.equal(res.status, 200);
    assert.equal(res.json.acknowledgedReportId, undefined);
    assert.equal(res.json.rejectedReportId, 'rep-alt-01');
    assert.equal(s.db.kiBerichteLesen(r.kimlik.boxId).length, 0);
  } finally {
    await s.stop();
  }
});
