#!/usr/bin/env node
// O-169 Bedingung 7: Automatisierter nächtlicher Dual-Resource-Abgleich (DE Text + SE Audio)
// mit optionalem SaaS-Abzug, EUR-Kostenschätzung, Adminlog-Protokollierung und SMTP-Alarm.
//
// Sicherheit:
// - Keine Secrets, Tokens oder Patientendaten (PHI) in Code, Logs, DB oder Alarm-Mails (G1/G2).
// - Schaltet `ki_global` NIEMALS automatisch ein; nur bei bestätigter Überschreitung UND
//   explizitem `--abschalten` auf `aus` (nie bei vorübergehendem Azure-/Abruffehler).
// - Prüft ausschließlich bereits abgeschlossene UTC-Kalendertage (< heute UTC).

import { pathToFileURL } from 'node:url';
import { oeffneDb } from './db.js';
import {
  STANDARD_TOLERANZ,
  STANDARD_TOLERANZ_AUDIO,
  abgleichenGetrennt,
  utcTag,
} from './ki-abgleich.js';

const RE_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const RE_DEPLOYMENT_FILTER = /^[a-zA-Z0-9._-]{1,64}$/;
const RE_RESOURCE_ID = /^\/subscriptions\/[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9._()-]+)+$/;
const RE_METRIC_NAMES = /^[a-zA-Z0-9_,]{1,128}$/;
const RE_CONTROL_CHARS = /[\r\n\x00-\x1f\x7f]/;

/**
 * Liefert das Datum des abgeschlossenen Vortags in UTC ('YYYY-MM-DD').
 * @param {number | Date | (() => number)} [jetzt]
 * @returns {string}
 */
export function gesternUtcTag(jetzt = Date.now()) {
  const wert = typeof jetzt === 'function' ? jetzt() : jetzt;
  const d = wert instanceof Date ? wert : new Date(wert);
  if (Number.isNaN(d.getTime())) throw new Error('Ungültiger Zeitstempel');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 1))
    .toISOString()
    .slice(0, 10);
}

/**
 * Beschafft ein Azure-Management-Token (`https://management.azure.com/.default`).
 * Secret und Token werden niemals geloggt oder in Fehlermeldungen aufgenommen.
 *
 * @param {{
 *   tenantId: string,
 *   clientId: string,
 *   clientSecret: string,
 *   fetchImpl?: typeof globalThis.fetch
 * }} params
 * @returns {Promise<string>}
 */
export async function holeEntraMonitorToken({
  tenantId,
  clientId,
  clientSecret,
  fetchImpl = globalThis.fetch,
}) {
  if (!tenantId || !RE_UUID.test(String(tenantId))) {
    throw new Error('Entra tenantId fehlt oder ist ungültig');
  }
  if (!clientId || !RE_UUID.test(String(clientId))) {
    throw new Error('Entra clientId fehlt oder ist ungültig');
  }
  if (
    typeof clientSecret !== 'string' ||
    clientSecret.trim() === '' ||
    RE_CONTROL_CHARS.test(clientSecret)
  ) {
    throw new Error('Entra clientSecret fehlt oder ist ungültig');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://management.azure.com/.default',
  }).toString();

  let res;
  try {
    res = await fetchImpl(
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      }
    );
  } catch (err) {
    throw new Error(`Entra Monitor Token-Abruf fehlgeschlagen (${err?.name || 'Netzwerkfehler'})`);
  }

  if (!res?.ok) {
    throw new Error(`Entra Monitor HTTP ${res?.status ?? 'unbekannt'}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Entra Monitor Antwort ungültig (kein JSON)');
  }

  const token = data?.access_token;
  if (
    typeof token !== 'string' ||
    token.length < 10 ||
    token.length > 16384 ||
    RE_CONTROL_CHARS.test(token)
  ) {
    throw new Error('Entra Monitor Antwort enthält kein gültiges Token');
  }

  return token;
}

/**
 * Liest stündliche Summenwerte einer Azure Monitor Metrik exakt für einen abgeschlossenen UTC-Tag
 * und summiert alle Datenpunkte zu einer nicht-negativen Ganzzahl.
 *
 * @param {{
 *   resourceId: string,
 *   metricNames: string | string[],
 *   tag: string,
 *   deploymentFilter?: string | null,
 *   token: string,
 *   fetchImpl?: typeof globalThis.fetch
 * }} params
 * @returns {Promise<number>}
 */
export async function leseAzureMonitorMetrik({
  resourceId,
  metricNames,
  tag,
  deploymentFilter,
  token,
  fetchImpl = globalThis.fetch,
}) {
  const { windowStart } = utcTag(tag);
  const nextDay = new Date(Date.parse(windowStart) + 86_400_000).toISOString().slice(0, 10);

  if (
    typeof resourceId !== 'string' ||
    !RE_RESOURCE_ID.test(resourceId) ||
    resourceId.includes('..') ||
    RE_CONTROL_CHARS.test(resourceId)
  ) {
    throw new Error('Azure resourceId ungültig');
  }

  const metricStr = Array.isArray(metricNames)
    ? metricNames.map((m) => String(m).trim()).filter(Boolean).join(',')
    : String(metricNames ?? '').trim();
  if (!RE_METRIC_NAMES.test(metricStr)) {
    throw new Error('Azure metricNames ungültig');
  }

  let filterClause = '';
  if (deploymentFilter !== undefined && deploymentFilter !== null && deploymentFilter !== '') {
    if (
      typeof deploymentFilter !== 'string' ||
      !RE_DEPLOYMENT_FILTER.test(deploymentFilter)
    ) {
      throw new Error('Ungültiger deploymentFilter (OData-Schutz)');
    }
    filterClause = `&$filter=${encodeURIComponent(`ModelDeploymentName eq '${deploymentFilter}'`)}`;
  }

  if (typeof token !== 'string' || token.trim() === '' || RE_CONTROL_CHARS.test(token)) {
    throw new Error('Azure Monitor Token fehlt oder ist ungültig');
  }

  const timespan = `${tag}T00:00:00Z/${nextDay}T00:00:00Z`;
  const url =
    `https://management.azure.com${resourceId}/providers/Microsoft.Insights/metrics` +
    `?api-version=2023-10-01` +
    `&timespan=${encodeURIComponent(timespan)}` +
    `&interval=PT1H` +
    `&aggregation=Total` +
    `&metricnames=${encodeURIComponent(metricStr)}` +
    filterClause;

  let res;
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new Error(`Azure Monitor Abruf fehlgeschlagen (${err?.name || 'Netzwerkfehler'})`);
  }

  if (!res?.ok) {
    throw new Error(`Azure Monitor HTTP ${res?.status ?? 'unbekannt'}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Azure Monitor Antwort ungültig (kein JSON)');
  }

  if (!data || !Array.isArray(data.value)) {
    throw new Error('Azure Monitor Antwort ungültig (value fehlt)');
  }

  let summe = 0;
  for (const metric of data.value) {
    const series = metric?.timeseries;
    if (!Array.isArray(series)) continue;
    for (const ts of series) {
      const punkte = ts?.data;
      if (!Array.isArray(punkte)) continue;
      for (const punkt of punkte) {
        const val = punkt?.total;
        if (val === undefined || val === null) continue;
        if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
          throw new Error('Azure Monitor enthält ungültigen Metrikwert');
        }
        summe += val;
      }
    }
  }

  const gerundet = Math.round(summe);
  if (!Number.isSafeInteger(gerundet) || gerundet < 0) {
    throw new Error('Azure Monitor Summe außerhalb des gültigen Bereichs');
  }
  return gerundet;
}

/**
 * Optionaler Abruf der verifizierten SaaS-Tagessumme (für geteilte Deployments).
 * Verlangt HTTPS (kein Klartext-HTTP für Secrets), kein Redirect, 10 s Timeout.
 *
 * @param {{
 *   url: string,
 *   secret?: string | null,
 *   tag: string,
 *   fetchImpl?: typeof globalThis.fetch
 * }} params
 * @returns {Promise<{ textTokens: number, audioSeconds: number }>}
 */
export async function holeSaasTagesSumme({
  url,
  secret,
  tag,
  fetchImpl = globalThis.fetch,
}) {
  utcTag(tag);

  if (typeof url !== 'string' || url.trim() === '' || RE_CONTROL_CHARS.test(url)) {
    throw new Error('SAAS_ABGLEICH_URL ungültig');
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('SAAS_ABGLEICH_URL ist keine gültige URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('SAAS_ABGLEICH_URL muss HTTPS verwenden');
  }
  if (parsed.username || parsed.password) {
    throw new Error('SAAS_ABGLEICH_URL darf keine Zugangsdaten in der URL enthalten');
  }
  parsed.searchParams.set('tag', tag);

  const headers = { Accept: 'application/json' };
  if (secret !== undefined && secret !== null && secret !== '') {
    if (typeof secret !== 'string' || RE_CONTROL_CHARS.test(secret)) {
      throw new Error('SAAS_ABGLEICH_SECRET ungültig');
    }
    headers.Authorization = `Bearer ${secret}`;
  }

  let res;
  try {
    res = await fetchImpl(parsed.toString(), {
      method: 'GET',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    throw new Error(`SaaS-Abgleich Abruf fehlgeschlagen (${err?.name || 'Netzwerkfehler'})`);
  }

  if (!res?.ok) {
    throw new Error(`SaaS-Abgleich HTTP ${res?.status ?? 'unbekannt'}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('SaaS-Abgleich Antwort ungültig (kein JSON)');
  }

  const textTokens = data?.textTokens;
  const audioSeconds = data?.audioSeconds === undefined ? 0 : data.audioSeconds;
  if (
    typeof textTokens !== 'number' ||
    !Number.isSafeInteger(textTokens) ||
    textTokens < 0 ||
    typeof audioSeconds !== 'number' ||
    !Number.isSafeInteger(audioSeconds) ||
    audioSeconds < 0
  ) {
    throw new Error('SaaS-Abgleich Antwort enthält ungültige Zähler');
  }

  return { textTokens, audioSeconds };
}

async function erstelleStandardMailSender(env) {
  const host = env?.SMTP_HOST;
  const to = env?.ALERT_EMAIL_TO;
  if (!host || !to) {
    return null;
  }

  let nodemailer;
  try {
    const mod = await import('nodemailer');
    nodemailer = mod.default || mod;
  } catch {
    console.error('[ki-abgleich-nacht] SMTP konfiguriert, aber nodemailer ist nicht installiert; Alarm wird nur protokolliert.');
    return null;
  }

  const port = Number(env.SMTP_PORT) || 587;
  const secure = env.SMTP_SECURE === 'true' || port === 465;
  const requireTLS = env.SMTP_REQUIRE_TLS !== 'false' && !secure;
  const from = env.SMTP_FROM || env.SMTP_USER || 'noreply@praxura.de';

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(requireTLS ? { requireTLS: true } : {}),
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return async ({ subject, text }) => {
    await transport.sendMail({ from, to, subject, text });
    return true;
  };
}

async function sendeAlarmSicher({ mailSender, env, subject, text }) {
  try {
    const sender = typeof mailSender === 'function'
      ? mailSender
      : await erstelleStandardMailSender(env);
    if (!sender) {
      console.error(`[ki-abgleich-nacht] Alarm (ohne SMTP): ${subject}`);
      return false;
    }
    const res = await sender({
      to: env?.ALERT_EMAIL_TO || '',
      from: env?.SMTP_FROM || env?.SMTP_USER || 'noreply@praxura.de',
      subject,
      text,
    });
    return res !== false;
  } catch (err) {
    console.error(`[ki-abgleich-nacht] Alarm-Mail Versand fehlgeschlagen (${err?.code || err?.message || 'Fehler'})`);
    return false;
  }
}

function baueUeberschreitungsText({ zielTag, ergebnis, abschalten, abgeschaltet }) {
  const schalterHinweis = abgeschaltet
    ? 'ABGESCHALTET (ki_global = aus)'
    : abschalten
      ? 'bereits aus (unverändert)'
      : 'UNVERÄNDERT (--abschalten nicht gesetzt)';

  const zeilen = [
    `Praxura Merkez — Nächtlicher KI-Abgleich (O-169 Bed. 7)`,
    `UTC-Tag: ${zielTag}`,
    `Ergebnis: ÜBERSCHRITTEN (${ergebnis.grund})`,
    ``,
    `DE Text (${ergebnis.text.modell}):`,
    `  Azure (Box-Anteil): ${ergebnis.text.azure} Tokens (Roh: ${ergebnis.text.azureRoh}, SaaS-Abzug: ${ergebnis.text.saasAbzug})`,
    `  Box-Berichte:       ${ergebnis.text.gemeldet} Tokens`,
    `  Erlaubte Grenze:    ${ergebnis.text.grenze} Tokens`,
    `  Differenz:          ${ergebnis.text.differenz} Tokens`,
    `  Geschätzte Kosten:  ${ergebnis.text.kostenEur.toFixed(4)} EUR`,
  ];
  if (ergebnis.text.warnungSaasUeberAzure) {
    zeilen.push(`  Hinweis:            SaaS-Abzug übersteigt Azure-Rohwert (auf 0 geklemmt)`);
  }
  zeilen.push(
    ``,
    `SE Audio (${ergebnis.audio.modell}):`,
    `  Azure (Box-Anteil): ${ergebnis.audio.azure} s (Roh: ${ergebnis.audio.azureRoh} s, SaaS-Abzug: ${ergebnis.audio.saasAbzug} s)`,
    `  Box-Berichte:       ${ergebnis.audio.gemeldet} s`,
    `  Erlaubte Grenze:    ${ergebnis.audio.grenze} s`,
    `  Differenz:          ${ergebnis.audio.differenz} s`,
    `  Geschätzte Kosten:  ${ergebnis.audio.kostenEur.toFixed(4)} EUR`,
  );
  if (ergebnis.audio.warnungSaasUeberAzure) {
    zeilen.push(`  Hinweis:            SaaS-Abzug übersteigt Azure-Rohwert (auf 0 geklemmt)`);
  }
  zeilen.push(
    ``,
    `Geschätzte Gesamtkosten (Box-Anteil): ${ergebnis.geschaetzteKostenEur.toFixed(4)} EUR`,
    `Globaler KI-Schalter (ki_global):     ${schalterHinweis}`,
    ``,
    `Hinweis: Dieser Bericht enthält ausschließlich aggregierte Tageswerte (keine PHI, keine Secrets).`,
  );
  return zeilen.join('\n');
}

function baueFehlerText({ zielTag, fehler }) {
  return [
    `Praxura Merkez — Nächtlicher KI-Abgleich FEHLGESCHLAGEN`,
    `UTC-Tag: ${zielTag}`,
    `Fehler:  ${fehler}`,
    ``,
    `Globaler KI-Schalter (ki_global): UNVERÄNDERT (keine automatische Abschaltung bei Abruf-/Konfigurationsfehler).`,
    `Bitte Azure Monitor / Entra / Merkez-Logs prüfen.`,
  ].join('\n');
}

/**
 * Führt den nächtlichen Dual-Resource-Abgleich für einen abgeschlossenen UTC-Tag aus.
 *
 * @param {{
 *   db: ReturnType<typeof oeffneDb>,
 *   tag?: string,
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: typeof globalThis.fetch,
 *   mailSender?: (mail: { to: string, from: string, subject: string, text: string }) => Promise<unknown>,
 *   abschalten?: boolean,
 *   toleranzText?: { prozent: number, tokens: number },
 *   toleranzAudio?: { prozent: number, sekunden: number },
 *   jetztFn?: () => number,
 * }} params
 * @returns {Promise<{
 *   exitCode: 0 | 1 | 2,
 *   ergebnis: ReturnType<typeof abgleichenGetrennt> | null,
 *   abgeschaltet: boolean,
 *   alarmGesendet: boolean,
 *   fehler?: string
 * }>}
 */
export async function fuehreNachtAbgleichAus({
  db,
  tag,
  env = process.env,
  fetchImpl = globalThis.fetch,
  mailSender,
  abschalten = false,
  toleranzText = STANDARD_TOLERANZ,
  toleranzAudio = STANDARD_TOLERANZ_AUDIO,
  jetztFn = Date.now,
}) {
  const jetztMs = typeof jetztFn === 'function' ? jetztFn() : Number(jetztFn);
  const t = Math.floor(jetztMs / 1000);
  const heuteUtc = new Date(jetztMs).toISOString().slice(0, 10);
  const zielTag = tag || gesternUtcTag(jetztMs);

  const fehlermeldungAbbrechen = async (fehlerText) => {
    try {
      db?.adminLog?.('ki-abgleich-auto', 'ki-abgleich-fehler', zielTag, { fehler: fehlerText }, t);
    } catch { /* adminLog-Fehler soll Rückgabe nicht verschlucken */ }
    const alarmGesendet = await sendeAlarmSicher({
      mailSender,
      env,
      subject: `[Praxura Merkez] KI-Abgleich Fehler ${zielTag} (UTC)`,
      text: baueFehlerText({ zielTag, fehler: fehlerText }),
    });
    return {
      exitCode: 1,
      fehler: fehlerText,
      ergebnis: null,
      abgeschaltet: false,
      alarmGesendet,
    };
  };

  let windowStart;
  let bis;
  try {
    ({ windowStart, bis } = utcTag(zielTag));
  } catch (err) {
    return fehlermeldungAbbrechen(err.message);
  }

  if (zielTag >= heuteUtc || bis > t) {
    return fehlermeldungAbbrechen(`UTC-Tag ${zielTag} ist noch nicht abgeschlossen`);
  }

  const tenantId = env?.AZURE_MONITOR_TENANT_ID || env?.AZURE_TENANT_ID || env?.KI_ENTRA_TENANT_ID;
  const clientId = env?.AZURE_MONITOR_CLIENT_ID || env?.AZURE_CLIENT_ID || env?.KI_ENTRA_CLIENT_ID;
  const clientSecret = env?.AZURE_MONITOR_CLIENT_SECRET || env?.AZURE_CLIENT_SECRET || env?.KI_ENTRA_CLIENT_SECRET;
  const textResourceId = env?.AZURE_TEXT_RESOURCE_ID;
  const textMetrics = env?.AZURE_TEXT_METRICS || 'ProcessedPromptTokens,GeneratedTokens';
  const textDeployment = env?.AZURE_TEXT_DEPLOYMENT || '';
  const audioResourceId = env?.AZURE_AUDIO_RESOURCE_ID || '';
  const audioMetrics = env?.AZURE_AUDIO_METRICS || 'ProcessedAudioSeconds';
  const audioDeployment = env?.AZURE_AUDIO_DEPLOYMENT || '';
  const saasUrl = env?.SAAS_ABGLEICH_URL || '';
  const saasSecret = env?.SAAS_ABGLEICH_SECRET || '';
  const textModell = env?.AZURE_TEXT_MODEL || 'gpt-5-mini';
  const audioModell = env?.AZURE_AUDIO_MODEL || 'gpt-4o-transcribe';

  if (!textResourceId) {
    return fehlermeldungAbbrechen('AZURE_TEXT_RESOURCE_ID fehlt');
  }

  let azureTextTokens = 0;
  let azureAudioSeconds = 0;
  let saasTextTokens = 0;
  let saasAudioSeconds = 0;

  try {
    const token = await holeEntraMonitorToken({
      tenantId,
      clientId,
      clientSecret,
      fetchImpl,
    });

    azureTextTokens = await leseAzureMonitorMetrik({
      resourceId: textResourceId,
      metricNames: textMetrics,
      tag: zielTag,
      deploymentFilter: textDeployment || undefined,
      token,
      fetchImpl,
    });

    if (audioResourceId) {
      azureAudioSeconds = await leseAzureMonitorMetrik({
        resourceId: audioResourceId,
        metricNames: audioMetrics,
        tag: zielTag,
        deploymentFilter: audioDeployment || undefined,
        token,
        fetchImpl,
      });
    }

    if (saasUrl) {
      const saas = await holeSaasTagesSumme({
        url: saasUrl,
        secret: saasSecret,
        tag: zielTag,
        fetchImpl,
      });
      saasTextTokens = saas.textTokens;
      saasAudioSeconds = saas.audioSeconds;
    }
  } catch (err) {
    return fehlermeldungAbbrechen(err?.message || 'Azure-/SaaS-Abruf fehlgeschlagen');
  }

  const berichte = db.kiBerichteTag(windowStart);
  const ergebnis = abgleichenGetrennt({
    berichte,
    azureTextTokens,
    azureAudioSeconds,
    saasTextTokens,
    saasAudioSeconds,
    toleranzText,
    toleranzAudio,
    textModell,
    audioModell,
  });

  if (!ergebnis.ok && ergebnis.fehler) {
    return fehlermeldungAbbrechen(ergebnis.fehler);
  }

  let abgeschaltet = false;
  if (!ergebnis.ok && abschalten === true) {
    const globalVorher = db.einstellungLesen('ki_global') ?? 'aus';
    if (globalVorher !== 'aus') {
      db.einstellungSetzen('ki_global', 'aus');
      db.adminLog(
        'ki-abgleich-auto',
        'ki-global',
        null,
        { wert: 'aus', grund: 'nacht-abgleich-ueberschritten', tag: zielTag },
        t
      );
      abgeschaltet = true;
    }
  }

  db.adminLog(
    'ki-abgleich-auto',
    'ki-abgleich-nacht',
    zielTag,
    {
      ok: ergebnis.ok,
      grund: ergebnis.grund,
      text: {
        gemeldet: ergebnis.text.gemeldet,
        azureRoh: ergebnis.text.azureRoh,
        saasAbzug: ergebnis.text.saasAbzug,
        azure: ergebnis.text.azure,
        grenze: ergebnis.text.grenze,
        differenz: ergebnis.text.differenz,
        ueberschritten: ergebnis.text.ueberschritten,
        warnungSaasUeberAzure: ergebnis.text.warnungSaasUeberAzure,
        kostenEur: ergebnis.text.kostenEur,
      },
      audio: {
        gemeldet: ergebnis.audio.gemeldet,
        azureRoh: ergebnis.audio.azureRoh,
        saasAbzug: ergebnis.audio.saasAbzug,
        azure: ergebnis.audio.azure,
        grenze: ergebnis.audio.grenze,
        differenz: ergebnis.audio.differenz,
        ueberschritten: ergebnis.audio.ueberschritten,
        warnungSaasUeberAzure: ergebnis.audio.warnungSaasUeberAzure,
        kostenEur: ergebnis.audio.kostenEur,
      },
      geschaetzteKostenEur: ergebnis.geschaetzteKostenEur,
      abschalten: Boolean(abschalten),
      abgeschaltet,
    },
    t
  );

  if (!ergebnis.ok) {
    const alarmGesendet = await sendeAlarmSicher({
      mailSender,
      env,
      subject: `[Praxura Merkez] KI-Abgleich Überschreitung ${zielTag} (UTC)`,
      text: baueUeberschreitungsText({ zielTag, ergebnis, abschalten, abgeschaltet }),
    });
    return { exitCode: 2, ergebnis, abgeschaltet, alarmGesendet };
  }

  return { exitCode: 0, ergebnis, abgeschaltet: false, alarmGesendet: false };
}

function parseCliArgs(argv) {
  let tag;
  let abschalten = false;
  const toleranzText = { ...STANDARD_TOLERANZ };
  const toleranzAudio = { ...STANDARD_TOLERANZ_AUDIO };

  for (const arg of argv) {
    if (arg === '--abschalten') {
      abschalten = true;
      continue;
    }
    const mProzent = /^--toleranz-prozent=(\d{1,3})$/.exec(arg);
    if (mProzent) {
      const p = Number(mProzent[1]);
      if (p < 0 || p > 100) throw new Error('Toleranz-Prozent muss 0..100 sein');
      toleranzText.prozent = p;
      toleranzAudio.prozent = p;
      continue;
    }
    const mTokens = /^--toleranz-tokens=(\d{1,15})$/.exec(arg);
    if (mTokens) {
      toleranzText.tokens = Number(mTokens[1]);
      continue;
    }
    const mAudio = /^--toleranz-audio-sek=(\d{1,15})$/.exec(arg);
    if (mAudio) {
      toleranzAudio.sekunden = Number(mAudio[1]);
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unbekannte Option: ${arg}`);
    }
    if (tag !== undefined) {
      throw new Error(`Unerwartetes Argument: ${arg}`);
    }
    tag = arg;
  }

  return { tag, abschalten, toleranzText, toleranzAudio };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  let db;
  try {
    const opts = parseCliArgs(process.argv.slice(2));
    db = oeffneDb(env.MERKEZ_DB || './merkez.sqlite');
    const res = await fuehreNachtAbgleichAus({ db, env, ...opts });
    if (res.fehler) {
      console.error(`Fehler: ${res.fehler}`);
    } else if (res.ergebnis) {
      const e = res.ergebnis;
      console.log(
        `KI-Abgleich Nacht (${opts.tag || gesternUtcTag()} UTC): ` +
        `Text ${e.text.azure}/${e.text.grenze} · Audio ${e.audio.azure}/${e.audio.grenze}s · ` +
        `Kosten ~${e.geschaetzteKostenEur.toFixed(4)} EUR · Status: ${e.grund}` +
        (res.abgeschaltet ? ' · ki_global=aus' : '')
      );
    }
    process.exitCode = res.exitCode;
  } catch (err) {
    console.error(`Fehler: ${err.message}`);
    process.exitCode = 1;
  } finally {
    try { db?.close?.(); } catch { /* ignore */ }
  }
}
