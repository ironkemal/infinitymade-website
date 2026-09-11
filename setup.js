// Einrichtungsassistent, Schritt 1-4 (Faz 2.2). Läuft nur einmal pro Box —
// das Backend prüft das atomar (praxura_setup, db/migrations/0005).
//
// Kein Supabase-Client hier: alle Schritte laufen über /api/setup/*, das
// Backend hält den service_role-Schlüssel (der gehört nie in den Browser,
// G2). Diese Seite ruft nur fetch() gegen dieselbe Origin auf.
//
// SMTP selbst wird HIER NICHT eingerichtet (O-66) — das hat install.sh schon
// erledigt oder bewusst ausgelassen. Schritt 3 TESTET nur, ob es funktioniert.
import { API_BASE } from './supabase-config.js';

const stepToken = document.getElementById('stepToken');
const stepOwner = document.getElementById('stepOwner');
const stepSmtp = document.getElementById('stepSmtp');
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
      verstecken(stepToken, stepOwner, stepSmtp, stepDone);
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
      verstecken(stepToken, stepOwner, stepSmtp, stepDone);
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
      verstecken(stepToken, stepOwner, stepSmtp, stepDone);
      stepClosed.hidden = false;
      return;
    }
    if (!res.ok) {
      zeigeMsg(msg, data.error || 'Konto konnte nicht angelegt werden.', 'error');
      return;
    }

    verstecken(stepOwner);
    stepSmtp.hidden = false;
    testeSmtp();
  } catch {
    zeigeMsg(msg, 'Verbindung fehlgeschlagen. Bitte erneut versuchen.', 'error');
  } finally {
    btn.disabled = false;
  }
});

// ── Schritt 3: SMTP testen ───────────────────────────────────────────────
const smtpChecking = document.getElementById('smtpChecking');
const smtpSkipped = document.getElementById('smtpSkipped');
const smtpSent = document.getElementById('smtpSent');
const smtpError = document.getElementById('smtpError');
const smtpConfirmed = document.getElementById('smtpConfirmed');

function smtpZeige(el) {
  [smtpChecking, smtpSkipped, smtpSent, smtpError, smtpConfirmed].forEach((s) => { s.hidden = (s !== el); });
}

function weiterZuFertig() {
  verstecken(stepSmtp);
  stepDone.hidden = false;
}

async function testeSmtp() {
  smtpZeige(smtpChecking);
  try {
    const res = await fetch(API_BASE + '/setup/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: gueltigerToken }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.eingerichtet === false) {
      smtpZeige(smtpSkipped);
      return;
    }
    if (res.ok && data.eingerichtet === true) {
      document.getElementById('smtpSentMsg').textContent =
        `Testmail an ${data.gesendetAn} gesendet — bitte Posteingang und Spam-Ordner prüfen.`;
      smtpZeige(smtpSent);
      return;
    }
    // Fehler (502 vom Testmail-Versuch, oder ein anderer Statuscode)
    document.getElementById('smtpErrorMsg').textContent =
      data.error || 'Testmail konnte nicht gesendet werden.';
    smtpZeige(smtpError);
  } catch {
    document.getElementById('smtpErrorMsg').textContent = 'Verbindung fehlgeschlagen.';
    smtpZeige(smtpError);
  }
}

document.getElementById('smtpAckCheckbox').addEventListener('change', (e) => {
  document.getElementById('smtpSkipContinueBtn').disabled = !e.target.checked;
});
document.getElementById('smtpSkipContinueBtn').addEventListener('click', weiterZuFertig);
document.getElementById('smtpArrivedBtn').addEventListener('click', () => {
  smtpZeige(smtpConfirmed);
});
document.getElementById('smtpConfirmedContinueBtn').addEventListener('click', weiterZuFertig);
document.getElementById('smtpNotArrivedBtn').addEventListener('click', () => {
  document.getElementById('smtpErrorMsg').textContent =
    'Die Mail wurde vom Server angenommen, kam aber nicht an. Häufigste Ursache: die Absenderadresse gehört nicht zur eigenen Domain des Mailservers (SPF/DMARC) — Absenderadresse in der .env prüfen (SMTP_FROM).';
  smtpZeige(smtpError);
});
document.getElementById('smtpRetryBtn').addEventListener('click', testeSmtp);
document.getElementById('smtpErrorContinueBtn').addEventListener('click', weiterZuFertig);
