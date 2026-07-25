// Task: rezept-normalize — OCR-Freitext auf unsere Katalogwerte abbilden.
//
// Warum ein eigener Schritt: Ärzte schreiben dieselbe Angabe in beliebig vielen
// Schreibweisen ("2x wtl.", "2 x / Wo.", "zweimal wöchentlich"). Übernehmen wir
// den Rohtext 1:1 in die Bestätigungsmaske, steht dort ein Wert, den weder das
// <select> noch die Serienplanung noch die §302-Abrechnung kennt. Dieser Task
// wählt stattdessen den passenden EXISTIERENDEN Katalogeintrag aus und meldet
// mit, wie sicher die Zuordnung ist:
//
//   match = "exact" → Wortlaut deckt sich mit dem Katalogwert  → UI zeigt ✓
//   match = "fuzzy" → sinngemäß zugeordnet, Wortlaut abweichend → UI zeigt ⚠ (prüfen!)
//   match = "none"  → kein Katalogwert passt                    → UI zeigt ⚠ (manuell wählen)
//
// Input  : { rezept: {...OCR-Rohwerte}, heilmittel_positionen: [{x,label,kat}] }
// Output : { normalized: { frequenz|diagnosegruppe|heilmittel|ergaenzendes_heilmittel: {...} }, _meta }

import { chat } from '../azureClient.js';
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

const EMPTY = { value: null, match: 'none', confidence: 0, note: null };

function mockResponse() {
  return JSON.stringify({
    frequenz: { value: '2x pro Woche', match: 'exact', confidence: 0.98, note: null },
    diagnosegruppe: { value: 'WS2', match: 'exact', confidence: 0.97, note: null },
    heilmittel: { value: 'X0501', label: 'Allgemeine Krankengymnastik (KG) Einzel', match: 'exact', confidence: 0.95, note: null },
    ergaenzendes_heilmittel: { value: null, match: 'none', confidence: 0, note: null }
  });
}

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

// Ein einzelnes Feld aus der Modellantwort säubern: value muss in der erlaubten
// Liste stehen, sonst verwerfen. Damit kann eine Halluzination nie als gültige
// Auswahl in der Maske landen.
function sanitizeField(raw, allowed, labelLookup) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY };

  const value = raw.value == null ? null : String(raw.value).trim();
  const inList = value && allowed.some(a => a.toLowerCase() === value.toLowerCase());
  if (!value || !inList) {
    return {
      value: null,
      label: null,
      match: 'none',
      confidence: 0,
      note: raw.note ? String(raw.note).slice(0, 160) : null
    };
  }

  // Exakte Schreibweise aus dem Katalog übernehmen (Modell könnte Groß-/Kleinschreibung ändern)
  const canonical = allowed.find(a => a.toLowerCase() === value.toLowerCase());
  const match = ['exact', 'fuzzy'].includes(raw.match) ? raw.match : 'fuzzy';
  const confidence = typeof raw.confidence === 'number'
    ? Math.max(0, Math.min(1, raw.confidence))
    : null;

  return {
    value: canonical,
    label: labelLookup ? (labelLookup(canonical) || null) : null,
    match,
    confidence,
    note: match === 'exact' ? null : (raw.note ? String(raw.note).slice(0, 160) : null)
  };
}

export async function run(payload) {
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

  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildUserPrompt(rez, positionen) }
    ],
    responseFormat: { type: 'json_object' },
    temperature: 0.0,
    maxTokens: 700,
    mockFn: mockResponse
  });

  let parsed;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new Error('rezept-normalize returned non-JSON content');
  }

  const hmCodes = positionen.map(p => p.x);
  const hmLabel = code => (positionen.find(p => p.x === code) || {}).label;

  return {
    normalized: {
      frequenz: sanitizeField(parsed.frequenz, FREQUENZ_OPTIONEN, null),
      diagnosegruppe: sanitizeField(parsed.diagnosegruppe, DIAGNOSEGRUPPEN, null),
      heilmittel: sanitizeField(parsed.heilmittel, hmCodes, hmLabel),
      ergaenzendes_heilmittel: sanitizeField(parsed.ergaenzendes_heilmittel, hmCodes, hmLabel)
    },
    _meta: {
      model: result.model,
      deployment: result.deployment,
      usage: result.usage,
      dry_run: result.dry_run,
      latency_ms: result.latency_ms
    }
  };
}
