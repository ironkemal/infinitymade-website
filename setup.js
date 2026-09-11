// Einrichtungsassistent, Schritt 1-3 (Faz 2.2, dilim 1). Läuft nur einmal
// pro Box — das Backend prüft das atomar (praxura_setup, db/migrations/0005).
//
// Kein Supabase-Client hier: alle drei Schritte laufen über /api/setup/*,
// das Backend hält den service_role-Schlüssel (der gehört nie in den
// Browser, G2). Diese Seite ruft nur fetch() gegen dieselbe Origin auf.
import { API_BASE } from './supabase-config.js';

const stepToken = document.getElementById('stepToken');
const stepOwner = document.getElementById('stepOwner');
const stepDone = document.getElementById('stepDone');
const stepClosed = document.getElementById('stepClosed');

function zeigeMsg(el, text, art) {
  el.textContent = text;
  el.className = 'msg show ' + art;
}

function verstecken(...sections) {
  sections.forEach((s) => { s.hidden = true; });
}

let gueltigerToken = null;

async function init() {
  try {
    const res = await fetch(API_BASE + '/setup/status');
    const data = await res.json();
    if (!data.verfuegbar) {
      verstecken(stepToken, stepOwner, stepDone);
      stepClosed.hidden = false;
    }
  } catch {
    // Netzwerkfehler beim Statuscheck: das Formular einfach zeigen, der
    // eigentliche Fehler kommt dann beim Absenden — kein Doppelrisiko.
  }
}
init();

document.getElementById('tokenForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('tokenSubmitBtn');
  const msg = document.getElementById('tokenMsg');
  const token = document.getElementById('token').value.trim();

  btn.disabled = true;
  try {
    const res = await fetch(API_BASE + '/setup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.status === 410) {
      verstecken(stepToken, stepOwner, stepDone);
      stepClosed.hidden = false;
      return;
    }
    if (!res.ok) {
      zeigeMsg(msg, 'Jeton wird nicht akzeptiert. Bitte aus dem Terminal-Ausdruck von install.sh kopieren.', 'error');
      return;
    }
    gueltigerToken = token;
    verstecken(stepToken);
    stepOwner.hidden = false;
  } catch {
    zeigeMsg(msg, 'Verbindung fehlgeschlagen. Bitte erneut versuchen.', 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('ownerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('ownerSubmitBtn');
  const msg = document.getElementById('ownerMsg');

  const payload = {
    token: gueltigerToken,
    business_name: document.getElementById('businessName').value.trim(),
    sector: document.getElementById('sector').value,
    owner_first_name: document.getElementById('ownerFirstName').value.trim() || null,
    owner_last_name: document.getElementById('ownerLastName').value.trim() || null,
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
  };

  btn.disabled = true;
  try {
    const res = await fetch(API_BASE + '/setup/owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 410) {
      verstecken(stepToken, stepOwner, stepDone);
      stepClosed.hidden = false;
      return;
    }
    if (!res.ok) {
      zeigeMsg(msg, data.error || 'Konto konnte nicht angelegt werden.', 'error');
      return;
    }

    verstecken(stepOwner);
    stepDone.hidden = false;
  } catch {
    zeigeMsg(msg, 'Verbindung fehlgeschlagen. Bitte erneut versuchen.', 'error');
  } finally {
    btn.disabled = false;
  }
});
