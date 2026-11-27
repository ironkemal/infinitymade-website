// Nächtlicher KI-Abgleich (O-169 Bedingung 7, guvenlik S-55): Azure-Tagessumme der Box-Ressource ↔ Summe der
// Box-Berichte (`ki_bericht`, O-183: je Box und UTC-Tag eine Zeile mit wachsender Summe). Liegt Azure über der
// Toleranz, schaltet admin.js `ki-abgleich` den globalen KI-Schalter aus — nie ein.
//
// Ein Detektor, keine Bremse: er kommt frühestens nach Tagesende. Die Bremse ist Azure-seitig (TPM, Budget-Alarm,
// S-55 C). Bereits ausgegebene Jetons bleiben bis Entra-Ablauf (≤ ~90 min) gültig (S-55 Befund 4).
// Voraussetzung (guvenlik, 09.10.2026): die Azure-Zahl stammt aus einer Ressource, die NUR Boxen nutzen — sonst
// misst der Abgleich den SaaS-Verbrauch mit.
//
// Tag = UTC (Berichte schneiden nach UTC, `window_start` = 'JJJJ-MM-TTT00:00:00.000Z'; Azure-Metriken ebenso).

import { berechneKiKostenEur, kiModellPreis } from '../api-backend/ai/ki-preise.js';

export const STANDARD_TOLERANZ = Object.freeze({ prozent: 10, tokens: 20000 });
export const STANDARD_TOLERANZ_AUDIO = Object.freeze({ prozent: 10, sekunden: 180 });

/** Tokens eines Berichts (`daten` als JSON-Text oder Objekt). Unlesbar/ungültig zählt 0 — nie NaN (fail-closed). */
export function berichtTokens(daten) {
  let d = daten;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch { return 0; }
  }
  const totals = d?.taskTotals;
  if (!totals || typeof totals !== 'object') return 0;
  let summe = 0;
  for (const m of Object.values(totals)) {
    const n = m?.total_tokens;
    if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) summe += n;
  }
  return summe;
}

const ganzzahl = (w) => (typeof w === 'string' && /^\d{1,15}$/.test(w) ? Number(w) : w);

/** 'JJJJ-MM-TT' → { windowStart, von, bis } (UTC-Sekunden), sonst Fehler. */
export function utcTag(tag) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tag ?? ''));
  const ms = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  if (!m || new Date(ms).toISOString().slice(0, 10) !== tag) throw new Error('Tag muss JJJJ-MM-TT (UTC) sein');
  return { windowStart: `${tag}T00:00:00.000Z`, von: ms / 1000, bis: ms / 1000 + 86400 };
}

/**
 * berichte: [{ box_id, daten }] (eine Zeile je Box, siehe db.kiBerichteTag) · azureTokens: ganze Zahl ≥ 0.
 * Ungültige Eingaben werfen — ein Abgleich darf nie still "ok" sagen.
 */
export function abgleichen({ berichte, azureTokens, toleranz = STANDARD_TOLERANZ }) {
  const azure = ganzzahl(azureTokens);
  if (!Number.isSafeInteger(azure) || azure < 0) throw new Error('Azure-Tokens müssen eine ganze Zahl ≥ 0 sein');
  const prozent = ganzzahl(toleranz?.prozent);
  const tokens = ganzzahl(toleranz?.tokens);
  if (!Number.isSafeInteger(prozent) || prozent < 0 || prozent > 100) throw new Error('Toleranz-Prozent: ganze Zahl 0..100');
  if (!Number.isSafeInteger(tokens) || tokens < 0) throw new Error('Toleranz-Tokens: ganze Zahl ≥ 0');

  const kutular = (berichte || []).map((b) => ({ box_id: b.box_id, tokens: berichtTokens(b.daten) }));
  const gemeldet = kutular.reduce((s, k) => s + k.tokens, 0);
  const grenze = Math.floor(gemeldet * (100 + prozent) / 100) + tokens;
  return {
    gemeldet, azure, grenze, differenz: azure - gemeldet,
    ueberschritten: azure > grenze,
    // Mehr gemeldet als verbraucht verschleiert keine Kosten — nur Warnung (guvenlik b).
    mehrGemeldet: gemeldet > azure,
    kutular,
  };
}

function berichtAudioAusDaten(daten) {
  let d = daten;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch { return 0; }
  }
  const totals = d?.taskTotals;
  if (!totals || typeof totals !== 'object') return 0;
  let summe = 0;
  for (const m of Object.values(totals)) {
    const n = m?.audio_seconds;
    if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) summe += n;
  }
  return summe;
}

/**
 * Summiert `audio_seconds` über alle `taskTotals`-Einträge der übergebenen Berichte.
 * Fehlende/0/ungültige (negative oder nicht-ganzzahlige) Werte zählen 0 — nie NaN (fail-closed).
 * @param {Array<{ daten?: unknown } | Record<string, unknown> | string> | null | undefined} berichte
 * @returns {number}
 */
export function berichtAudioSekunden(berichte) {
  if (!berichte) return 0;
  const liste = Array.isArray(berichte) ? berichte : [berichte];
  let summe = 0;
  for (const eintrag of liste) {
    if (!eintrag) continue;
    const quelle = typeof eintrag === 'object' && !Array.isArray(eintrag) && Object.hasOwn(eintrag, 'daten')
      ? eintrag.daten
      : eintrag;
    summe += berichtAudioAusDaten(quelle);
  }
  return summe;
}

const istNichtNegGanzzahl = (w) => typeof w === 'number' && Number.isSafeInteger(w) && w >= 0;

function istPlainObject(val) {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

function fehlerErgebnis(fehler) {
  return {
    ok: false,
    fehler,
    grund: fehler,
    text: null,
    audio: null,
    geschaetzteKostenEur: 0,
  };
}

function schaetzeTextKostenEur(modell, tokens) {
  const preis = kiModellPreis(modell);
  if (!preis || preis.billingType !== 'tokens') return 0;
  // Konservative Schätzung: ohne Prompt/Completion-Aufteilung den höheren Tokenpreis ansetzen.
  const opts = preis.outputPerMtokEur >= preis.inputPerMtokEur
    ? { model: modell, promptTokens: 0, completionTokens: tokens }
    : { model: modell, promptTokens: tokens, completionTokens: 0 };
  return berechneKiKostenEur(opts).costEur;
}

/**
 * Getrennter Dual-Ressourcen-Abgleich (DE Text + SE Audio) inkl. optionalem SaaS-Abzug und EUR-Kostenschätzung.
 * Fail-closed: ungültige Eingaben liefern `{ ok: false, fehler }` statt still „ok" zu melden.
 *
 * @param {{
 *   berichte: Array<{ box_id?: string, daten?: unknown }>,
 *   azureTextTokens: number,
 *   azureAudioSeconds?: number,
 *   saasTextTokens?: number,
 *   saasAudioSeconds?: number,
 *   toleranzText?: { prozent: number, tokens: number },
 *   toleranzAudio?: { prozent: number, sekunden: number },
 *   textModell?: string,
 *   audioModell?: string,
 * }} params
 */
export function abgleichenGetrennt(params) {
  if (!params || typeof params !== 'object') return fehlerErgebnis('Ungültige Parameter');
  const {
    berichte,
    azureTextTokens,
    azureAudioSeconds = 0,
    saasTextTokens = 0,
    saasAudioSeconds = 0,
    toleranzText = STANDARD_TOLERANZ,
    toleranzAudio = STANDARD_TOLERANZ_AUDIO,
    textModell = 'gpt-5-mini',
    audioModell = 'gpt-4o-transcribe',
  } = params;

  if (!Array.isArray(berichte) || berichte.some((b) => !istPlainObject(b))) {
    return fehlerErgebnis('ungueltiger_bericht');
  }
  if (!istNichtNegGanzzahl(azureTextTokens)) return fehlerErgebnis('azureTextTokens muss eine ganze Zahl ≥ 0 sein');
  if (!istNichtNegGanzzahl(azureAudioSeconds)) return fehlerErgebnis('azureAudioSeconds muss eine ganze Zahl ≥ 0 sein');
  if (!istNichtNegGanzzahl(saasTextTokens)) return fehlerErgebnis('saasTextTokens muss eine ganze Zahl ≥ 0 sein');
  if (!istNichtNegGanzzahl(saasAudioSeconds)) return fehlerErgebnis('saasAudioSeconds muss eine ganze Zahl ≥ 0 sein');

  if (!toleranzText || typeof toleranzText !== 'object') return fehlerErgebnis('toleranzText ungültig');
  if (!istNichtNegGanzzahl(toleranzText.prozent) || toleranzText.prozent > 100) {
    return fehlerErgebnis('toleranzText.prozent muss eine ganze Zahl 0..100 sein');
  }
  if (!istNichtNegGanzzahl(toleranzText.tokens)) {
    return fehlerErgebnis('toleranzText.tokens muss eine ganze Zahl ≥ 0 sein');
  }

  if (!toleranzAudio || typeof toleranzAudio !== 'object') return fehlerErgebnis('toleranzAudio ungültig');
  if (!istNichtNegGanzzahl(toleranzAudio.prozent) || toleranzAudio.prozent > 100) {
    return fehlerErgebnis('toleranzAudio.prozent muss eine ganze Zahl 0..100 sein');
  }
  if (!istNichtNegGanzzahl(toleranzAudio.sekunden)) {
    return fehlerErgebnis('toleranzAudio.sekunden muss eine ganze Zahl ≥ 0 sein');
  }

  const warnungSaasUeberAzureText = saasTextTokens > azureTextTokens;
  const warnungSaasUeberAzureAudio = saasAudioSeconds > azureAudioSeconds;
  const boxAzureText = Math.max(0, azureTextTokens - saasTextTokens);
  const boxAzureAudio = Math.max(0, azureAudioSeconds - saasAudioSeconds);

  const textResult = abgleichen({ berichte, azureTokens: boxAzureText, toleranz: toleranzText });
  const textOk = !textResult.ueberschritten;

  const berichtAudio = berichtAudioSekunden(berichte);
  const erlaubtSek = Math.ceil((berichtAudio * (100 + toleranzAudio.prozent)) / 100) + toleranzAudio.sekunden;
  const audioOk = boxAzureAudio <= erlaubtSek;

  const textKostenEur = Number(schaetzeTextKostenEur(textModell, boxAzureText).toFixed(6));
  const audioKostenEur = Number(berechneKiKostenEur({ model: audioModell, audioSeconds: boxAzureAudio }).costEur.toFixed(6));
  const geschaetzteKostenEur = Number((textKostenEur + audioKostenEur).toFixed(6));

  let grund = 'im_rahmen';
  if (!textOk && !audioOk) grund = 'text_und_audio_ueberschritten';
  else if (!textOk) grund = 'text_ueberschritten';
  else if (!audioOk) grund = 'audio_ueberschritten';

  return {
    ok: textOk && audioOk,
    text: {
      ok: textOk,
      ueberschritten: textResult.ueberschritten,
      gemeldet: textResult.gemeldet,
      azureRoh: azureTextTokens,
      saasAbzug: saasTextTokens,
      azure: textResult.azure,
      grenze: textResult.grenze,
      differenz: textResult.differenz,
      mehrGemeldet: textResult.mehrGemeldet,
      warnungSaasUeberAzure: warnungSaasUeberAzureText,
      kutular: textResult.kutular,
      modell: textModell,
      kostenEur: textKostenEur,
    },
    audio: {
      ok: audioOk,
      ueberschritten: !audioOk,
      gemeldet: berichtAudio,
      azureRoh: azureAudioSeconds,
      saasAbzug: saasAudioSeconds,
      azure: boxAzureAudio,
      grenze: erlaubtSek,
      erlaubtSek,
      differenz: boxAzureAudio - berichtAudio,
      mehrGemeldet: berichtAudio > boxAzureAudio,
      warnungSaasUeberAzure: warnungSaasUeberAzureAudio,
      modell: audioModell,
      kostenEur: audioKostenEur,
    },
    geschaetzteKostenEur,
    grund,
  };
}
