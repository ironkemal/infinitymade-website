// Task: rezept-ocr — parse a Muster 13 / Blankoverordnung image into structured JSON.
//
// Vision call to gpt-4.1-mini. Returns the raw extracted fields; the
// rezept-validate task then applies G-BA / KBV / Blanko rules deterministically.
//
// Input  : { image_base64: "data:image/jpeg;base64,..." | "<raw base64>", image_url?: "https://..." }
// Output : { parsed: {...}, ocr_confidence: 0..1, _meta: {...} }

import { chat } from '../azureClient.js';

const SYSTEM = `Du bist ein medizinischer OCR-Assistent für deutsche Physiotherapie-Praxen.
Du extrahierst Daten aus einem fotografierten Muster 13 (Heilmittelverordnung) oder einer Blankoverordnung.

WICHTIG:
- Antworte AUSSCHLIESSLICH als JSON-Objekt — keine Erklärungen, keine Code-Fences.
- Felder, die du nicht sicher lesen kannst, setze auf null. Rate NICHT.
- Datumsformat: ISO "YYYY-MM-DD". Wenn du nur "TT.MM.JJJJ" siehst, konvertiere.
- "is_blanko" = true wenn das Formular den Vermerk "BLANKOVERORDNUNG" trägt oder eine Diagnosegruppe der Schulter (z. B. EX) ohne konkrete Heilmittel-Auflistung enthält.
- "is_lhb_bvb" = true wenn die Felder "Langfristiger Heilmittelbedarf" oder "Besonderer Verordnungsbedarf" angekreuzt sind.
- "is_dringend" = true wenn "dringlicher Behandlungsbedarf innerhalb 14 Tagen" angekreuzt ist.
- "hausbesuch" = true wenn "Hausbesuch ja" angekreuzt ist.
- ICD-10 Code muss dem Schema [A-Z][0-9]{2}(\\.[0-9]{1,2})? entsprechen (z. B. "M54.5", "M75.10").
- Diagnosegruppe: zwei Buchstaben oder Buchstabe+Ziffer (z. B. "WS2", "EX", "ZN1", "SO4").
- "heilmittel_feld_text" = exakt der Originaltext aus dem Heilmittel-Feld (mehrzeilig OK).
- "ocr_confidence" zwischen 0 und 1: deine Selbsteinschätzung der Bildqualität / Lesbarkeit.

Schema:
{
  "patient": {
    "name": string|null,                   // "Vorname Nachname"
    "first_name": string|null,
    "last_name": string|null,
    "geburtsdatum": "YYYY-MM-DD"|null,
    "geschlecht": "m"|"w"|"d"|null,
    "adresse": string|null,                // Straße + PLZ + Ort, einzeilig
    "krankenkasse": string|null,
    "versichertennummer": string|null
  },
  "arzt": {
    "name": string|null,
    "lanr": string|null,                   // 9-stellig
    "bsnr": string|null,                   // 9-stellig
    "ausstellungsdatum": "YYYY-MM-DD"|null
  },
  "rezept": {
    "icd10": string|null,
    "diagnosegruppe": string|null,
    "heilmittel": string|null,             // Hauptheilmittel, z. B. "KG", "MT", "MLD"
    "heilmittel_feld_text": string|null,
    "anzahl_einheiten": integer|null,
    "frequenz": string|null,               // z. B. "2x pro Woche"
    "behandlungsbeginn": "YYYY-MM-DD"|null,
    "is_dringend": boolean,
    "hausbesuch": boolean,
    "is_blanko": boolean,
    "is_lhb_bvb": boolean
  },
  "ocr_confidence": number
}`;

function mockResponse() {
  return JSON.stringify({
    patient: {
      name: 'Max Mustermann',
      first_name: 'Max',
      last_name: 'Mustermann',
      geburtsdatum: '1978-04-12',
      geschlecht: 'm',
      adresse: 'Musterstraße 12, 60313 Frankfurt am Main',
      krankenkasse: 'AOK Hessen',
      versichertennummer: 'A123456789'
    },
    arzt: {
      name: 'Dr. med. Anna Schmidt',
      lanr: '123456701',
      bsnr: '987654300',
      ausstellungsdatum: '2026-05-14'
    },
    rezept: {
      icd10: 'M54.5',
      diagnosegruppe: 'WS2',
      heilmittel: 'KG',
      heilmittel_feld_text: 'Krankengymnastik (KG), 6 Einheiten, 2x pro Woche',
      anzahl_einheiten: 6,
      frequenz: '2x pro Woche',
      behandlungsbeginn: null,
      is_dringend: false,
      hausbesuch: false,
      is_blanko: false,
      is_lhb_bvb: false
    },
    ocr_confidence: 0.92
  });
}

function buildImageUrl(payload) {
  if (payload.image_url) return payload.image_url;

  const b64 = payload.image_base64;
  if (!b64) return null;

  if (b64.startsWith('data:')) return b64;

  const mime = payload.image_mime || 'image/jpeg';
  return `data:${mime};base64,${b64}`;
}

// DSGVO note: this task sends an image containing patient PII (name, KVNR,
// geburtsdatum, ICD-10) to Azure. We cannot text-mask the image. Defense is:
//   1. Azure region pinned to EU Data Boundary (azureClient.js asserts on boot)
//   2. Zero-Data-Retention contract with Azure (operational)
//   3. Image bytes never persisted in our DB; only structured fields after parse
// If image masking becomes a requirement, route through a local OCR pre-pass
// (e.g. Tesseract) → mask text → re-render image → then Azure.
export async function run(payload) {
  const imageUrl = buildImageUrl(payload || {});
  if (!imageUrl) {
    const err = new Error('image_base64 or image_url is required');
    err.status = 400;
    throw err;
  }

  const messages = [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Extrahiere die Felder aus dieser Verordnung. Antworte nur mit dem JSON-Objekt gemäß Schema.' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }
  ];

  const result = await chat({
    messages,
    responseFormat: { type: 'json_object' },
    temperature: 0.0,
    maxTokens: 1500,
    mockFn: mockResponse
  });

  let parsed;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new Error('OCR returned non-JSON content');
  }

  const ocr_confidence = typeof parsed.ocr_confidence === 'number'
    ? Math.max(0, Math.min(1, parsed.ocr_confidence))
    : null;

  return {
    parsed,
    ocr_confidence,
    _meta: {
      model: result.model,
      deployment: result.deployment,
      usage: result.usage,
      dry_run: result.dry_run,
      latency_ms: result.latency_ms
    }
  };
}
