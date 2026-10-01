/**
 * module/abrechnung-empfaenger.js — Empfänger-Prüfung am Übermittlungstag (Frontend)
 *
 * Gegenstück zu api-backend/billing/kostentraeger/stichtag-pruefung.js (37b8f51, Oturum B).
 * Das Backend blockiert dta-bytes / upload-signed mit HTTP 409
 * (EMPFAENGER_GEAENDERT, PAPIERANNAHMESTELLE_GEAENDERT, KEINE_DATENANNAHMESTELLE), wenn
 * sich die Annahmestelle seit dem Erstellen geändert hat, und meldet Warnungen
 * (z. B. QUARTALSWECHSEL) als `stichtagWarnung` in upload-signed / mark-sent.
 *
 * Der Header X-Praxura-Stichtag-Warnung von dta-bytes ist cross-origin nicht lesbar
 * (kein Access-Control-Expose-Headers) — deshalb fragt das Frontend die Warnungen VOR dem
 * Signieren über GET /empfaenger-pruefung ab, mit Klartext statt Codes.
 */

const NEU_ERZEUGEN = 'Bitte die Abrechnung neu erzeugen (Storno + neue Abrechnung).';

/** Meldungstexte einer Stufe, zu einem Satzblock verbunden. */
export function meldungsText(meldungen, stufe) {
  return (Array.isArray(meldungen) ? meldungen : [])
    .filter(m => m && (!stufe || m.stufe === stufe) && m.text)
    .map(m => m.text)
    .join(' ');
}

/** Fehlertext aus einer Backend-Antwort; bei Empfänger-Blocks mit Hinweis auf Neu-Erzeugen. */
export function empfaengerFehlerText(json, status) {
  const basis = json?.error || ('HTTP ' + status);
  const istEmpfaenger = status === 409 && /GEAENDERT|DATENANNAHMESTELLE|STICHTAG/.test(json?.code || '');
  if (!istEmpfaenger || /neu erzeugen/i.test(basis)) return basis;
  return basis + ' ' + NEU_ERZEUGEN;
}

/**
 * Wirft bei !res.ok mit lesbarem Text; zeigt `stichtagWarnung` (nur Warnung, kein Block)
 * als Toast. Gibt das JSON zurück.
 */
export function pruefeAntwort(res, json, showToast) {
  if (!res.ok) throw new Error(empfaengerFehlerText(json, res.status));
  const warnung = meldungsText(json?.stichtagWarnung, 'warnung');
  if (warnung && typeof showToast === 'function') showToast('Hinweis: ' + warnung, 'warning');
  return json;
}

/**
 * Vorab-Prüfung vor Download/Signieren. Block → Error; Warnungen → Toast.
 * Fällt die Prüfung selbst aus (Netz, 500), wird nicht blockiert — dta-bytes prüft
 * serverseitig ohnehin noch einmal.
 */
export async function empfaengerVorabPruefen({ apiBase, token, abrechnungId, showToast, fetchFn = fetch }) {
  let json;
  try {
    const res = await fetchFn(`${apiBase}/billing/abrechnung/${abrechnungId}/empfaenger-pruefung`, {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }
  if (json?.blockiert) {
    const block = meldungsText(json.meldungen, 'block') || 'Abrechnung heute nicht übermittelbar.';
    throw new Error(/neu erzeugen/i.test(block) ? block : block + ' ' + NEU_ERZEUGEN);
  }
  const warnung = meldungsText(json?.meldungen, 'warnung');
  if (warnung && typeof showToast === 'function') showToast('Hinweis: ' + warnung, 'warning');
  return json;
}
