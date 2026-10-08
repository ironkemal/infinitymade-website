// KI Privacy & Error Sanitization Contract (M4 Logging/Privacy Contract)
//
// Guarantees:
// - Whitelist of known KI error codes with fixed German messages and HTTP statuses.
// - Generic fixed error fallback for any unknown raw provider exception or code.
// - Zero reflection of raw errors, provider messages, stack traces, causes, or prompts.
// - HMAC request hashing with random process-only seed (no raw content hashes).
// - No clinical or patient data in any error response.

import crypto from 'node:crypto';

// Process-only random seed generated once per worker lifecycle.
// Never persisted, never logged, never transmitted.
const PROCESS_SEED = crypto.randomBytes(32);

export const KNOWN_AI_CODES = Object.freeze({
  AI_OCR_DISABLED: {
    status: 503,
    message: 'OCR über diesen Dienst ist deaktiviert'
  },
  AI_OWNER_OPTIN_REQUIRED: {
    status: 503,
    message: 'Einwilligung des Praxisinhabers erforderlich'
  },
  AI_MAIL_DISABLED: {
    status: 503,
    message: 'E-Mail-Assistent ist deaktiviert'
  },
  KI_SCHEMA: {
    status: 400,
    message: 'Nutzlast entspricht nicht dem Schema'
  },
  KI_AUTH_REQUIRED: {
    status: 401,
    message: 'Authentifizierter Benutzer und Mandant erforderlich'
  },
  KI_OWNER_REQUIRED: {
    status: 403,
    message: 'Nur Praxisinhaber dürfen diese Aktion ausführen'
  },
  KI_EINWILLIGUNG_INVALID: {
    status: 403,
    message: 'Einwilligung ist ungültig oder abgelaufen'
  },
  KI_WOERTERBUCH_FEHLER: {
    status: 503,
    message: 'Wörterbuch-Abfrage fehlgeschlagen oder unvollständig'
  },
  KI_FREITEXT_GESPERRT: {
    status: 403,
    message: 'Freitext ist gesperrt'
  },
  KI_RUECKFRAGE: {
    status: 409,
    message: 'Rückfrage erforderlich'
  },
  KI_RUECKFRAGE_INVALID: {
    status: 400,
    message: 'Bestätigungs-Code ist ungültig'
  },
  KI_ANTWORT_UNGUELTIG: {
    status: 502,
    message: 'KI-Antwort ungültig oder unsicher'
  },
  AI_MODE_AUS: {
    status: 503,
    message: 'KI-Dienst ist deaktiviert'
  },
  AI_NOT_ACTIVATED: {
    status: 503,
    message: 'KI-Dienst ist nicht betriebsbereit geschaltet'
  },
  AI_CONFIG_INVALID: {
    status: 503,
    message: 'KI-Konfiguration ist ungültig'
  },
  AI_HOST_NOT_ALLOWED: {
    status: 503,
    message: 'KI-Endpunkt unzulässig'
  },
  AI_DEPLOYMENT_INVALID: {
    status: 503,
    message: 'Deploymentname ist ungültig'
  },
  AI_AUTH_INVALID: {
    status: 503,
    message: 'Authentifizierung für KI-Dienst ungültig'
  },
  AI_JETON_UNAVAILABLE: {
    status: 503,
    message: 'Jeton-Client nicht initialisiert'
  },
  AI_COMMUNICATION_ERROR: {
    status: 503,
    message: 'KI-Dienst Kommunikationsfehler'
  },
  AI_UNAVAILABLE: {
    status: 503,
    message: 'KI-Dienst nicht verfügbar'
  },
  AI_RATE_LIMIT_EXCEEDED: {
    status: 503,
    message: 'KI-Dienst überlastet (Ratenbegrenzung)'
  },
  AI_QUEUE_FULL: {
    status: 503,
    message: 'KI-Dienst überlastet (Warteschlange voll)'
  },
  AI_RESPONSE_MALFORMED: {
    status: 503,
    message: 'KI-Antwort konnte nicht verarbeitet werden'
  },
  AI_ABORTED: {
    status: 499,
    message: 'KI-Anfrage abgebrochen'
  },
  AI_TIMEOUT: {
    status: 503,
    message: 'KI-Anfrage Zeitüberschreitung'
  },
  AI_FORBIDDEN: {
    status: 403,
    message: 'KI-Dienst Zugriff verweigert'
  },
  AI_PAYLOAD_INVALID: {
    status: 400,
    message: 'Ungültige Nutzlast für KI-Anfrage'
  },
  AI_MESSAGES_INVALID: {
    status: 400,
    message: 'Ungültige oder leere Nachrichtenliste'
  },
  AI_MULTIMODAL_BLOCKED: {
    status: 400,
    message: 'Multimodale Inhalte und Bilder sind am KI-Transport nicht zulässig'
  },
  AI_QUOTA_EXCEEDED: {
    status: 429,
    message: 'KI-Nutzungskontingent erschöpft'
  },
  AI_MOCK_FN_REQUIRED: {
    status: 500,
    message: 'Expliziter Mock erfordert eine mockFn-Funktion'
  },
  AI_MODE_NOT_JETON: {
    status: 503,
    message: 'Jeton-Modus ist nicht aktiv'
  },
  AI_TOKEN_RESPONSE_INVALID: {
    status: 503,
    message: 'KI-Jeton-Antwort ungültig'
  },
  AI_API_VERSION_INVALID: {
    status: 503,
    message: 'KI-Jeton-API-Version ungültig'
  },
  AI_REGION_INVALID: {
    status: 503,
    message: 'KI-Region unzulässig'
  }
});

export const GENERIC_AI_ERROR = Object.freeze({
  code: 'AI_UNAVAILABLE',
  message: 'KI-Dienst nicht verfügbar',
  status: 503
});

export const KNOWN_AI_TASKS = Object.freeze(new Set([
  'b2c-draft',
  'rezept-validate',
  'rezept-ocr',
  'appointment-confirm-draft',
  'series-scheduler',
  'b2b-draft',
  'rezept-normalize'
]));

/**
 * Maps any error or code to a safe { code, message, status } object.
 * Whitelists known KI codes with fixed German messages.
 * Unknown raw provider exceptions or arbitrary errors always map to generic fixed error.
 *
 * @param {any} err - Error object, string code, or unknown failure
 * @returns {{ code: string, message: string, status: number }}
 */
export function safeAiError(err) {
  if (!err) {
    return { ...GENERIC_AI_ERROR };
  }

  let candidateCode = null;
  if (typeof err === 'string') {
    candidateCode = err.trim();
  } else if (typeof err === 'object') {
    if (typeof err.code === 'string') {
      candidateCode = err.code.trim();
    }
  }

  if (candidateCode && Object.prototype.hasOwnProperty.call(KNOWN_AI_CODES, candidateCode)) {
    const entry = KNOWN_AI_CODES[candidateCode];
    return {
      code: candidateCode,
      message: entry.message,
      status: entry.status
    };
  }

  // Generic safe fallback
  let fallbackStatus = 503;
  if (typeof err === 'object' && err !== null && (err.status === 400 || err.status === 401 || err.status === 403 || err.status === 409 || err.status === 502 || err.status === 503)) {
      fallbackStatus = err.status;
  }

  return {
    code: GENERIC_AI_ERROR.code,
    message: GENERIC_AI_ERROR.message,
    status: fallbackStatus
  };
}

/**
 * Computes a request fingerprint using HMAC with a random process-only seed.
 * Retains existing signature: hashRequest(payload).
 * Never uses raw content hashes.
 *
 * @param {any} payload
 * @returns {string|null} 64-character HMAC hex digest or null on failure
 */
export function hashRequest(payload) {
  if (payload === undefined || payload === null) return null;
  try {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (!serialized) return null;
    return crypto.createHmac('sha256', PROCESS_SEED)
      .update(serialized)
      .digest('hex');
  } catch {
    return null;
  }
}
