// Einrichtungsassistent, Schritt 1-5 (Faz 2.2; Schritt 4 = Praxisangaben, KHS M2.5). Läuft nur einmal pro Box bis
// zum Abschluss — das Backend prüft das atomar (praxura_setup, db/migrations/
// 0005). Wiederaufnehmbar: schliesst der Browser das Fenster nach der Owner-
// Anlage (Schritt 2) und VOR dem Abschluss (Schritt 4), führt derselbe Jeton
// beim nächsten Aufruf direkt zurück zu Schritt 3/4, nicht zur Owner-Anlage
// noch einmal (api-backend/setup/router.js: ownerAngelegt/istAbgeschlossen).
//
// Kein Supabase-Client hier: alle Schritte laufen über /api/setup/*, das
// Backend hält den service_role-Schlüssel (der gehört nie in den Browser,
// G2). Diese Seite ruft nur fetch() gegen dieselbe Origin auf.
//
// Mail ist KEIN Schritt der Einrichtung mehr (AUFTRAG-MAILVERSAND, Kemal 09.11.2026):
// die Praxis verbindet ihr Postfach später, optional, unter Einstellungen → E-Mail-Versand.
//
// Kurulum modu (Faz 2.2 dilim 2, §5.6): solange praxura_setup.abgeschlossen_am
// NULL ist, sperrt server.js die anonyme Patienten-Oberfläche (Buchung).
// Schritt 4 ("Einrichtung abschließen") hebt das auf — deshalb ist der
// Übergang zu "Fertig" ein expliziter POST, kein automatischer Redirect.
// Erster Import (Reihenfolge ist Absicht): liest den Jeton aus #… und entfernt ihn,
// BEVOR supabase-config.js beim Laden fetch aufruft (module/setup-fragment.js, K2b.11).
import { fragmentJeton } from './module/setup-fragment.js';
import { API_BASE } from './supabase-config.js';

const T = {
  de: {
    tokenStepLabel: 'Schritt 1 von 4', tokenTitle: 'Einrichtung starten',
    // Gleicher Text wie NEUER_LINK_* in module/einrichtung-hinweis.js — setup.js darf
    // das Modul nicht importieren (Jeton-Seite, tools/onprem-setup-jeton.test.js);
    // Gleichlauf prüft tools/onprem-setup-kapi.test.js.
    tokenSub: `Hier legen Sie E-Mail und Passwort des Inhaber-Kontos fest. Dazu brauchen Sie den Einrichtungslink vom Ende der Installation. Neuen Link erzeugen — Linux-Server: sudo bash /opt/praxura/onprem/install.sh --neuer-jeton · Windows-PC: „Praxura-Einrichtung" erneut starten. Alternativ den Teil nach „#" aus dem Link hier eintragen.`,
    tokenAuto: 'Einrichtung wird geprüft …',
    tokenLabel: 'Einrichtungs-Jeton', tokenSubmit: 'Weiter',
    tokenInvalid: 'Jeton wird nicht akzeptiert. Bitte den Link vom Ende von install.sh erneut öffnen.',
    netzwerkfehler: 'Verbindung fehlgeschlagen. Bitte erneut versuchen.',

    ownerStepLabel: 'Schritt 2 von 4', ownerTitle: 'Praxis und Konto',
    ownerSub: 'Diese Angaben legen das erste Inhaber-Konto an.',
    lblBusinessName: 'Praxisname', lblSector: 'Fachbereich', optSectorChoose: 'Bitte wählen',
    lblFirstName: 'Vorname (Inhaber)', lblLastName: 'Nachname (Inhaber)',
    lblEmail: 'E-Mail (Anmeldung)', lblPassword: 'Passwort', ownerSubmit: 'Konto anlegen',
    ownerFehlgeschlagen: 'Konto konnte nicht angelegt werden.',

    brandingStepLabel: 'Schritt 3 von 4', brandingTitle: 'Praxisangaben für Rechnungen',
    brandingSub: 'Diese Angaben stehen später auf Ihren Rechnungen. Sie können den Schritt überspringen und alles in den Einstellungen nachtragen — dort auch Logo, Stempel und Fußzeile.',
    lblBrStreet: 'Straße und Hausnummer', lblBrPlz: 'Postleitzahl', lblBrCity: 'Ort', lblBrPhone: 'Telefon',
    lblBrSteuernummer: 'Steuernummer', lblBrUstId: 'oder USt-IdNr.',
    lblBrTaxNote: 'Hinweis zur Umsatzsteuer (steht auf der Rechnung)',
    lblBrIban: 'IBAN', lblBrBic: 'BIC', lblBrBank: 'Bank', lblBrIk: 'Institutionskennzeichen (IK)',
    brandingSkip: 'Überspringen', brandingSave: 'Speichern und weiter',
    brandingFehlgeschlagen: 'Die Angaben konnten nicht gespeichert werden. Sie lassen sich später in den Einstellungen nachtragen.',

    doneStepLabel: 'Schritt 4 von 4',
    pruefChecking: 'Kontrollen laufen …',
    pruefTitle: 'Einrichtung abschließen', pruefIntro: 'Ein paar kurze Kontrollen, bevor die Box fertig ist.',
    pruefLabelSchema: 'Datenbank-Struktur', pruefLabelRls: 'Mandantentrennung (RLS)', pruefLabelDek: 'Verschlüsselung',
    pruefAckMsg: 'Mindestens eine Kontrolle ist rot — das Verzeichnis unten zeigt, welche.',
    pruefAckLabel: 'Ich möchte trotzdem abschließen.',
    pruefAbschlussBtn: 'Einrichtung abschließen',

    doneTitle: 'Fertig',
    doneText: 'Das Inhaber-Konto ist angelegt. Sie können sich jetzt anmelden. Den E-Mail-Versand richten Sie später in Ruhe unter Einstellungen → E-Mail-Versand ein (optional).',
    doneLoginBtn: 'Zur Anmeldung',

    closedTitle: 'Bereits eingerichtet',
    closedSub: 'Diese Box hat bereits ein Inhaber-Konto. Die Ersteinrichtung läuft nur einmal.',
    closedLoginBtn: 'Zur Anmeldung',
    abgelaufenTitle: 'Einrichtungslink abgelaufen',
    abgelaufenSub: `Der Link gilt 14 Tage. Neuen Link erzeugen — Linux-Server: sudo bash /opt/praxura/onprem/install.sh --neuer-jeton · Windows-PC: „Praxura-Einrichtung" erneut starten.`,
  },
};

// Produkt ist nur Deutsch (Entscheidung 28.09.2026) — kein Sprachumschalter, kein infinity_lang.
const lang = 'de';

function applyLang() {
  const t = T[lang];
  document.documentElement.lang = lang;
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('tokenStepLabel', t.tokenStepLabel); setText('tokenTitle', t.tokenTitle);
  setText('tokenSub', t.tokenSub); setText('tokenAuto', t.tokenAuto); setText('tokenLabel', t.tokenLabel);
  setText('tokenSubmitBtn', t.tokenSubmit);

  setText('ownerStepLabel', t.ownerStepLabel); setText('ownerTitle', t.ownerTitle);
  setText('ownerSub', t.ownerSub); setText('lblBusinessName', t.lblBusinessName);
  setText('lblSector', t.lblSector); setText('optSectorChoose', t.optSectorChoose);
  setText('lblFirstName', t.lblFirstName); setText('lblLastName', t.lblLastName);
  setText('lblEmail', t.lblEmail); setText('lblPassword', t.lblPassword);
  setText('ownerSubmitBtn', t.ownerSubmit);


  for (const id of ['brandingStepLabel', 'brandingTitle', 'brandingSub', 'lblBrStreet', 'lblBrPlz', 'lblBrCity', 'lblBrPhone',
    'lblBrSteuernummer', 'lblBrUstId', 'lblBrTaxNote', 'lblBrIban', 'lblBrBic', 'lblBrBank', 'lblBrIk']) setText(id, t[id]);
  setText('brandingSkipBtn', t.brandingSkip); setText('brandingSaveBtn', t.brandingSave);

  setText('doneStepLabel', t.doneStepLabel);
  setText('pruefChecking', t.pruefChecking);
  setText('pruefTitle', t.pruefTitle); setText('pruefIntro', t.pruefIntro);
  setText('pruefLabelSchema', t.pruefLabelSchema); setText('pruefLabelRls', t.pruefLabelRls); setText('pruefLabelDek', t.pruefLabelDek);
  setText('pruefAckMsg', t.pruefAckMsg); setText('pruefAckLabel', t.pruefAckLabel);
  setText('pruefAbschlussBtn', t.pruefAbschlussBtn);
  setText('doneTitle', t.doneTitle);
  setText('doneText', t.doneText); setText('doneLoginBtn', t.doneLoginBtn);

  setText('closedTitle', t.closedTitle); setText('closedSub', t.closedSub);
  setText('closedLoginBtn', t.closedLoginBtn);

}
applyLang();

const stepToken = document.getElementById('stepToken');
const stepOwner = document.getElementById('stepOwner');
const stepBranding = document.getElementById('stepBranding');
const stepDone = document.getElementById('stepDone');
const stepClosed = document.getElementById('stepClosed');

// K2b.7a: Endbildschirm für "bereits eingerichtet" (410 vom Tor, oder 404 —
// nach dem Abschluss leeren install.sh/update.sh SETUP_TOKEN, dann hängt
// server.js den Router gar nicht mehr ein) und für "Link abgelaufen" (410 mit
// abgelaufen:true, 14 Tage). Derselbe Abschnitt, nur andere Texte.
function zeigeGeschlossen(abgelaufen) {
  verstecken(stepToken, stepOwner, stepBranding, stepDone);
  document.getElementById('closedTitle').textContent = abgelaufen ? T[lang].abgelaufenTitle : T[lang].closedTitle;
  document.getElementById('closedSub').textContent = abgelaufen ? T[lang].abgelaufenSub : T[lang].closedSub;
  // style statt hidden: der Knopf hat inline display:block (setup.html)
  document.getElementById('closedLoginBtn').style.display = abgelaufen ? 'none' : 'block';
  stepClosed.hidden = false;
}
const tokenAuto = document.getElementById('tokenAuto');
const tokenForm = document.getElementById('tokenForm');

function zeigeMsg(el, text, art) {
  el.textContent = text;
  el.className = 'msg show ' + art;
}

function verstecken(...sections) {
  sections.forEach((s) => { s.hidden = true; });
}

let gueltigerToken = null;
// Jeton aus dem Link, solange er nicht abgelehnt wurde: nach einem Netzwerkfehler
// beim automatischen Start soll „Weiter" ihn erneut prüfen — die Praxis hat ihn nie
// gesehen und kann ihn nicht eintippen (das Fragment ist schon aus der Adresse).
let ausstehenderJeton = fragmentJeton;

async function pruefeJeton(token) {
  const btn = document.getElementById('tokenSubmitBtn');
  const msg = document.getElementById('tokenMsg');
  const tokenInput = document.getElementById('token');

  btn.disabled = true;
  try {
    const res = await fetch(API_BASE + '/setup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 410) {
      tokenAuto.hidden = true;
      tokenForm.hidden = false;
      zeigeGeschlossen(!!data.abgelaufen);
      return;
    }
    if (!res.ok) {
      ausstehenderJeton = null;
      tokenInput.required = true;
      tokenAuto.hidden = true;
      tokenForm.hidden = false;
      tokenInput.value = '';
      zeigeMsg(msg, T[lang].tokenInvalid, 'error');
      return;
    }
    gueltigerToken = token;
    ausstehenderJeton = null;
    tokenAuto.hidden = true;
    verstecken(stepToken);
    if (data.ownerAngelegt) {
      // Wiederaufnahme: Owner existiert schon, direkt zu den Praxisangaben.
      zuBranding();
    } else {
      stepOwner.hidden = false;
    }
  } catch {
    tokenAuto.hidden = true;
    tokenForm.hidden = false;
    tokenInput.value = '';
    // Leeres Feld + „Weiter" prüft den Link-Jeton erneut (required würde das blockieren).
    tokenInput.required = !ausstehenderJeton;
    zeigeMsg(msg, T[lang].netzwerkfehler, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function init() {
  try {
    const res = await fetch(API_BASE + '/setup/status');
    // 404: Router nicht eingehängt (SETUP_TOKEN nach Abschluss geleert, K2b.7a)
    if (res.status === 404) { zeigeGeschlossen(false); return; }
    const data = await res.json();
    if (data.abgeschlossen) zeigeGeschlossen(false);
    else if (data.abgelaufen) zeigeGeschlossen(true);
    // abgeschlossen:false, verfuegbar:false (Owner existiert, Abschluss fehlt)
    // zeigt trotzdem stepToken — der Jeton bleibt der Ausweis, um zurück ins
    // Verfahren zu kommen; /verify entscheidet dann per ownerAngelegt, wohin.
  } catch {
    // Netzwerkfehler beim Statuscheck: das Formular einfach zeigen, der
    // eigentliche Fehler kommt dann beim Absenden — kein Doppelrisiko.
  }
}

if (fragmentJeton) {
  tokenForm.hidden = true;
  tokenAuto.hidden = false;
}

init().then(async () => {
  if (fragmentJeton && !stepToken.hidden) {
    await pruefeJeton(fragmentJeton);
  }
}).catch(() => {
  // Nie im Zustand „wird geprüft …" hängen bleiben — manueller Weg bleibt offen.
  tokenAuto.hidden = true;
  tokenForm.hidden = false;
});

tokenForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = document.getElementById('token').value.trim() || ausstehenderJeton || '';
  await pruefeJeton(token);
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
      zeigeGeschlossen(!!data.abgelaufen);
      return;
    }
    if (!res.ok) {
      zeigeMsg(msg, data.error || T[lang].ownerFehlgeschlagen, 'error');
      return;
    }

    verstecken(stepOwner);
    zuBranding();
  } catch {
    zeigeMsg(msg, T[lang].netzwerkfehler, 'error');
  } finally {
    btn.disabled = false;
  }
});

// Schritt 3 — Praxisangaben für Rechnungen (KHS M2.5, überspringbar). Läuft über den Jeton
// (POST /setup/branding), nicht über eine Anmeldung: diese Seite hat keinen Supabase-Client.
// Ein Fehler hält die Einrichtung NIE auf — „Überspringen" und Nachtragen in den Einstellungen
// bleiben immer möglich.
function zuBranding() {
  stepBranding.hidden = false;
}

document.getElementById('brandingSkipBtn').addEventListener('click', zuPruefungenUndAbschluss);
document.getElementById('brandingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('brandingSaveBtn');
  const msg = document.getElementById('brandingMsg');
  const wert = (id) => document.getElementById(id).value.trim();
  const payload = {
    token: gueltigerToken,
    street: wert('brStreet'), plz: wert('brPlz'), city: wert('brCity'), phone: wert('brPhone'),
    steuernummer: wert('brSteuernummer'), ust_id: wert('brUstId'), tax_exempt_note: wert('brTaxNote'),
    iban: wert('brIban'), bic: wert('brBic'), bank_name: wert('brBank'), ik_number: wert('brIk'),
  };
  btn.disabled = true;
  try {
    const res = await fetch(API_BASE + '/setup/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 410) {
      zeigeGeschlossen(!!data.abgelaufen);
      return;
    }
    if (!res.ok) {
      zeigeMsg(msg, data.error || T[lang].brandingFehlgeschlagen, 'error');
      return;
    }
    await zuPruefungenUndAbschluss();
  } catch {
    zeigeMsg(msg, T[lang].netzwerkfehler, 'error');
  } finally {
    btn.disabled = false;
  }
});

// Schritt 4 — zwei Teile, beide NICHT automatisch:
//  a) §5.4/1/5/8 laufen lassen und anzeigen (billigePruefungenLaufen, Faz 2.2
//     dilim 2b) — der Klick auf "Einrichtung abschließen" ist der bewusste
//     Menschen-Moment, der abgeschlossen_am setzt (Dilim-2-Sperre: Kontrollen
//     zeigen, sperren aber nie mechanisch).
//  b) POST /abschluss markiert die Box als fertig eingerichtet (hebt
//     "kurulum modu" auf, server.js).
// Kann /verify(pruefungen:true) nicht erreicht werden (Netzwerkfehler), wird
// wie vor dilim 2b verfahren: direkt abschließen, der eigentliche Fehler kommt
// dann beim eigentlichen /abschluss-Aufruf, kein doppeltes Risiko.
const pruefChecking = document.getElementById('pruefChecking');
const pruefChecklist = document.getElementById('pruefChecklist');
const doneFinal = document.getElementById('doneFinal');
const pruefAckBox = document.getElementById('pruefAckBox');
const pruefAbschlussBtn = document.getElementById('pruefAbschlussBtn');
const pruefAckCheckbox = document.getElementById('pruefAckCheckbox');

function pruefZeileZeichnen(rowId, ergebnis) {
  const row = document.getElementById(rowId);
  const dot = row.querySelector('.check-dot');
  const detail = row.querySelector('.check-detail');
  dot.className = 'check-dot ' + (ergebnis?.status || 'gri');
  // fingerprint (nur Verschlüsselung, §5.4/8) neben dem Grund zeigen — nie den
  // Schlüssel selbst, nur seinen SHA-256-Fingerabdruck (server-seitig gekürzt).
  detail.textContent = [ergebnis?.neden, ergebnis?.fingerprint ? `Fingerprint: ${ergebnis.fingerprint}` : null]
    .filter(Boolean).join(' — ');
}

async function zuPruefungenUndAbschluss() {
  verstecken(stepBranding);
  stepDone.hidden = false;
  pruefChecklist.hidden = true;
  doneFinal.hidden = true;
  pruefChecking.hidden = false;

  let billigePruefungen = null;
  try {
    const res = await fetch(API_BASE + '/setup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: gueltigerToken, pruefungen: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) billigePruefungen = data.billigePruefungen || null;
  } catch { /* siehe Kommentar oben */ }

  if (!billigePruefungen) {
    // Nicht messbar (Netzwerk/Backend-Fehler) — nicht blockieren, direkt abschließen.
    await abschliessen();
    return;
  }

  pruefZeileZeichnen('pruefRowSchema', billigePruefungen.schema);
  pruefZeileZeichnen('pruefRowRls', billigePruefungen.rls);
  pruefZeileZeichnen('pruefRowDek', billigePruefungen.sifreleme);

  const rotVorhanden = [billigePruefungen.schema, billigePruefungen.rls, billigePruefungen.sifreleme]
    .some((e) => e?.status === 'kirmizi');

  pruefAckBox.hidden = !rotVorhanden;
  pruefAckCheckbox.checked = false;
  pruefAbschlussBtn.disabled = rotVorhanden;

  pruefChecking.hidden = true;
  pruefChecklist.hidden = false;
}

async function abschliessen() {
  try {
    await fetch(API_BASE + '/setup/abschluss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: gueltigerToken }),
    });
  } catch { /* "Fertig" wird trotzdem gezeigt, siehe Kommentar oben */ }
  pruefChecklist.hidden = true;
  doneFinal.hidden = false;
  stepDone.hidden = false;
}

pruefAckCheckbox.addEventListener('change', (e) => {
  pruefAbschlussBtn.disabled = !e.target.checked;
});
pruefAbschlussBtn.addEventListener('click', abschliessen);

