// Task: rezept-normalize — OCR-Freitext auf unsere Katalogwerte abbilden.
//
// M4 Gateway Integration:
// - Server-auth context verified ({ tenantId, userId, role })
// - Routes exclusively via executeKiTask (never directly calls Azure driver)
// - Patient and doctor identifying fields dropped locally before model prompt
// - Strict closed output schema validation and canonical catalog mapping
// - Normalize free text default blocked; deterministic fallback remains usable

import { executeKiTask } from '../ki-gateway.js';
import { FREQUENZ_OPTIONEN, DIAGNOSEGRUPPEN } from '../catalogs/rezept-optionen.js';

const SYSTEM = `Du ordnest Freitext aus einer deutschen Heilmittelverordnung (Muster 13) fest vorgegebenen Katalogwerten zu.

REGELN:
- Antworte AUSSCHLIESSLICH als JSON-Objekt — keine Erklärungen, keine Code-Fences.
- "value" MUSS exakt einer der vorgegebenen Optionen entsprechen (Zeichen für Zeichen kopieren) oder null sein. Erfinde NIEMALS eigene Werte.
- Setze "match":
  - "exact" — der Rohtext ist der Katalogwert oder eine reine Schreibvariante desselben Wortlauts (Groß-/Kleinschreibung, Abkürzungspunkte, Bindestrich vs. Gedankenstrich, "wtl." vs. "pro Woche", "Krankengymnastik" vs. "KG"). Bedeutung UND Menge/Umfang identisch.
  - "fuzzy" — du hast sinngemäß zugeordnet, aber es bleibt ein Rest Unsicherheit: der Arzt war unpräzise, mehrere Optionen kämen in Frage, oder du musstest interpretieren (z. B. "gelegentlich", "nach Bedarf", "KG am Gerät" ohne Angabe der Patientenzahl, "MLD" ohne Zeitangabe).
  - "none" — nichts passt; dann ist "value" null.
- "confidence": 0..1, deine Sicherheit für diese eine Zuordnung.
- "note": nur bei "fuzzy"/"none" — EIN kurzer deutscher Halbsatz, warum geprüft werden muss (z. B. "MLD ohne Zeitangabe — 30/45/60 Min prüfen"). Sonst null.
- Ist der Rohtext leer/null, gib value=null, match="none", confidence=0, note=null.
- Bei einer Frequenzspanne ("1-2x") wähle die Spannen-Option, nicht einen Einzelwert.
- Bei Heilmitteln gib in "value" den X-Code (z. B. "X0501") und in "label" das zugehörige Katalog-Label.

Antwortschema:
{
  "frequenz":                { "value": string|null, "match": "exact"|"fuzzy"|"none", "confidence": number, "note": string|null },
  "diagnosegruppe":          { "value": string|null, "match": "exact"|"fuzzy"|"none", "confidence": number, "note": string|null },
  "heilmittel":              { "value": string|null, "label": string|null, "match": "exact"|"fuzzy"|"none", "confidence": number, "note": string|null },
  "ergaenzendes_heilmittel": { "value": string|null, "label": string|null, "match": "exact"|"fuzzy"|"none", "confidence": number, "note": string|null }
}`;

/**
 * @typedef {{ x: string, label: string, kat?: string | null }} HeilmittelPosition
 */

const EMPTY = { value: null, match: 'none', confidence: 0, note: null };

/**
 * @param {Record<string, unknown>} rez
 * @param {HeilmittelPosition[]} positionen
 * @returns {string}
 */
function buildUserPrompt(rez, positionen) {
  const hmListe = positionen
    .map(p => `${p.x} = ${p.label}${p.kat ? ` [${p.kat}]` : ''}`)
    .join('\n');

  return `ROHTEXT AUS DER VERORDNUNG:
- Therapiefrequenz: ${JSON.stringify(rez.frequenz ?? null)}
- Diagnosegruppe: ${JSON.stringify(rez.diagnosegruppe ?? null)}
- Heilmittel: ${JSON.stringify(rez.heilmittel ?? null)}
- Ergänzendes Heilmittel: ${JSON.stringify(rez.ergaenzendes_heilmittel ?? null)}
- Kompletter Heilmittel-Feldtext (Kontext, enthält oft Frequenz und Einheiten): ${JSON.stringify(rez.heilmittel_feld_text ?? null)}
- Therapiebereich: ${JSON.stringify(rez.therapiebereich ?? null)}

ERLAUBTE FREQUENZ-OPTIONEN:
${FREQUENZ_OPTIONEN.join('\n')}

ERLAUBTE DIAGNOSEGRUPPEN:
${DIAGNOSEGRUPPEN.join(', ')}

ERLAUBTE HEILMITTEL (X-Code = Katalog-Label):
${hmListe}

Ordne jeden Rohwert genau einer erlaubten Option zu. Antworte nur mit dem JSON-Objekt.`;
}

/**
 * @param {unknown} raw
 * @param {readonly string[]} allowed
 * @param {((code: string) => string | null | undefined) | null} labelLookup
 */
function sanitizeField(raw, allowed, labelLookup) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY };
  const rec = /** @type {Record<string, unknown>} */ (raw);

  const value = rec.value == null ? null : String(rec.value).trim();
  const inList = value && allowed.some(a => a.toLowerCase() === value.toLowerCase());
  if (!value || !inList) {
    return {
      value: null,
      label: null,
      match: 'none',
      confidence: 0,
      note: rec.note ? String(rec.note).slice(0, 160) : null
    };
  }

  const canonical = /** @type {string} */ (allowed.find(a => a.toLowerCase() === value.toLowerCase()));
  const match = typeof rec.match === 'string' && ['exact', 'fuzzy'].includes(rec.match) ? rec.match : 'fuzzy';
  const confidence = typeof rec.confidence === 'number'
    ? Math.max(0, Math.min(1, rec.confidence))
    : null;

  return {
    value: canonical,
    label: labelLookup ? (labelLookup(canonical) || null) : null,
    match,
    confidence,
    note: match === 'exact' ? null : (rec.note ? String(rec.note).slice(0, 160) : null)
  };
}

/**
 * @param {unknown} parsed
 * @param {HeilmittelPosition[]} positionen
 * @returns {boolean}
 */
function validateNormalizeOutput(parsed, positionen) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).sort().join(',') !== 'diagnosegruppe,ergaenzendes_heilmittel,frequenz,heilmittel') return false;
  const rec = /** @type {Record<string, unknown>} */ (parsed);
  for (const key of ['frequenz','diagnosegruppe','heilmittel','ergaenzendes_heilmittel']) {
    const rawField = rec[key]; const heilmittel = key.includes('heilmittel');
    const keys = heilmittel ? 'confidence,label,match,note,value' : 'confidence,match,note,value';
    if (!rawField || typeof rawField !== 'object' || Array.isArray(rawField) || Object.keys(rawField).sort().join(',') !== keys) return false;
    const field = /** @type {Record<string, unknown>} */ (rawField);
    if (typeof field.match !== 'string' || !['exact','fuzzy','none'].includes(field.match) || typeof field.confidence !== 'number' || !Number.isFinite(field.confidence) || field.confidence < 0 || field.confidence > 1) return false;
    if (field.note !== null && (typeof field.note !== 'string' || field.note.length > 160)) return false;
    if (field.value === null) { if (field.match !== 'none' || (heilmittel && field.label !== null)) return false; continue; }
    const allowed = key === 'frequenz' ? FREQUENZ_OPTIONEN : key === 'diagnosegruppe' ? DIAGNOSEGRUPPEN : positionen.map(p => p.x);
    if (typeof field.value !== 'string' || !allowed.includes(field.value) || field.match === 'none') return false;
    const val = field.value;
    if (heilmittel && field.label !== positionen.find(p => p.x === val)?.label) return false;
  }
  return true;
}

/**
 * @param {import('../ki-gateway.js').GatewayPayload} payload
 * @param {import('../ki-gateway.js').GatewayContext} [context={}]
 */
export async function run(payload, context = {}) {
  const rez = (payload && payload.rezept) || {};
  const positionen = (payload && payload.heilmittel_positionen) || [];

  const nothingToDo = !rez.frequenz && !rez.diagnosegruppe && !rez.heilmittel
    && !rez.ergaenzendes_heilmittel && !rez.heilmittel_feld_text;
  if (nothingToDo) {
    return {
      normalized: {
        frequenz: { ...EMPTY },
        diagnosegruppe: { ...EMPTY },
        heilmittel: { ...EMPTY, label: null },
        ergaenzendes_heilmittel: { ...EMPTY, label: null }
      },
      _meta: { skipped: true }
    };
  }

  const { output, meta } = await executeKiTask({
    task: 'rezept-normalize',
    payload,
    context,
    buildMessages: (p) => [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildUserPrompt(p.rezept || {}, p.heilmittel_positionen || []) }
    ],
    validateOutput: parsed => validateNormalizeOutput(parsed, positionen),
    chatOptions: {
      responseFormat: { type: 'json_object' },
      temperature: 0.0,
      maxTokens: 700
    },
    dependencies: context?.dependencies || {}
  });

  const hmCodes = positionen.map(p => p.x);
  /** @param {string} code @returns {string | undefined} */
  const hmLabel = code => (positionen.find(p => p.x === code) || { label: undefined }).label;

  return {
    normalized: {
      frequenz: sanitizeField(output.frequenz, FREQUENZ_OPTIONEN, null),
      diagnosegruppe: sanitizeField(output.diagnosegruppe, DIAGNOSEGRUPPEN, null),
      heilmittel: sanitizeField(output.heilmittel, hmCodes, hmLabel),
      ergaenzendes_heilmittel: sanitizeField(output.ergaenzendes_heilmittel, hmCodes, hmLabel)
    },
    _meta: meta
  };
}
