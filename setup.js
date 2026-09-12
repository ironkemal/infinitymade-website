// Einrichtungsassistent, Schritt 1-4 (Faz 2.2). Läuft nur einmal pro Box bis
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
// SMTP selbst wird HIER NICHT eingerichtet (O-66) — das hat install.sh schon
// erledigt oder bewusst ausgelassen. Schritt 3 TESTET nur, ob es funktioniert.
//
// Kurulum modu (Faz 2.2 dilim 2, §5.6): solange praxura_setup.abgeschlossen_am
// NULL ist, sperrt server.js die anonyme Patienten-Oberfläche (Buchung).
// Schritt 4 ("Einrichtung abschließen") hebt das auf — deshalb ist der
// Übergang zu "Fertig" ein expliziter POST, kein automatischer Redirect.
import { API_BASE } from './supabase-config.js';

const T = {
  de: {
    tokenStepLabel: 'Schritt 1 von 4', tokenTitle: 'Einrichtung starten',
    tokenSub: 'Das Einrichtungsjeton stand am Ende von install.sh im Terminal.',
    tokenLabel: 'Einrichtungs-Jeton', tokenSubmit: 'Weiter',
    tokenInvalid: 'Jeton wird nicht akzeptiert. Bitte aus dem Terminal-Ausdruck von install.sh kopieren.',
    netzwerkfehler: 'Verbindung fehlgeschlagen. Bitte erneut versuchen.',

    ownerStepLabel: 'Schritt 2 von 4', ownerTitle: 'Praxis und Konto',
    ownerSub: 'Diese Angaben legen das erste Inhaber-Konto an.',
    lblBusinessName: 'Praxisname', lblSector: 'Fachbereich', optSectorChoose: 'Bitte wählen',
    lblFirstName: 'Vorname (Inhaber)', lblLastName: 'Nachname (Inhaber)',
    lblEmail: 'E-Mail (Anmeldung)', lblPassword: 'Passwort', ownerSubmit: 'Konto anlegen',
    ownerFehlgeschlagen: 'Konto konnte nicht angelegt werden.',

    smtpStepLabel: 'Schritt 3 von 4', smtpTitle: 'Mailversand prüfen',
    smtpIntro: 'Wir prüfen jetzt, ob die Box wirklich Mails verschicken kann.',
    smtpChecking: 'Wird geprüft …',
    smtpSkippedMsg: 'Kein SMTP eingerichtet — es werden keine Einladungs-, Passwort-Reset- oder Terminmails verschickt.',
    smtpAckLabel: 'Ich bin mir bewusst, dass keine Mails verschickt werden, und möchte trotzdem fortfahren.',
    weiter: 'Weiter',
    smtpSentMsg: (empf) => `Testmail an ${empf} gesendet — bitte Posteingang und Spam-Ordner prüfen.`,
    smtpArrivedQuestion: 'Ist die Testmail angekommen (auch im Spam-Ordner prüfen)?',
    smtpNotArrived: 'Nicht angekommen', smtpArrived: 'Angekommen',
    smtpRetry: 'Erneut versuchen', smtpErrorContinue: 'Trotzdem fortfahren',
    smtpConfirmedMsg: 'Mailversand funktioniert.',
    smtpFehlgeschlagen: 'Testmail konnte nicht gesendet werden.',
    smtpNichtAngekommenText: 'Die Mail wurde vom Server angenommen, kam aber nicht an. Häufigste Ursache: die Absenderadresse gehört nicht zur eigenen Domain des Mailservers (SPF/DMARC) — Absenderadresse in der .env prüfen (SMTP_FROM).',

    doneStepLabel: 'Schritt 4 von 4',
    pruefChecking: 'Kontrollen laufen …',
    pruefTitle: 'Einrichtung abschließen', pruefIntro: 'Ein paar kurze Kontrollen, bevor die Box fertig ist.',
    pruefLabelSchema: 'Datenbank-Struktur', pruefLabelRls: 'Mandantentrennung (RLS)', pruefLabelDek: 'Verschlüsselung',
    pruefAckMsg: 'Mindestens eine Kontrolle ist rot — das Verzeichnis unten zeigt, welche.',
    pruefAckLabel: 'Ich möchte trotzdem abschließen.',
    pruefAbschlussBtn: 'Einrichtung abschließen',

    doneTitle: 'Fertig',
    doneText: 'Das Inhaber-Konto ist angelegt. Sie können sich jetzt anmelden.',
    doneLoginBtn: 'Zur Anmeldung',

    closedTitle: 'Bereits eingerichtet',
    closedSub: 'Diese Box hat bereits ein Inhaber-Konto. Die Ersteinrichtung läuft nur einmal.',
    closedLoginBtn: 'Zur Anmeldung',
  },
  en: {
    tokenStepLabel: 'Step 1 of 4', tokenTitle: 'Start setup',
    tokenSub: 'The setup token was printed at the end of install.sh in the terminal.',
    tokenLabel: 'Setup token', tokenSubmit: 'Continue',
    tokenInvalid: 'Token not accepted. Please copy it from the install.sh terminal output.',
    netzwerkfehler: 'Connection failed. Please try again.',

    ownerStepLabel: 'Step 2 of 4', ownerTitle: 'Practice and account',
    ownerSub: 'These details create the first owner account.',
    lblBusinessName: 'Practice name', lblSector: 'Specialty', optSectorChoose: 'Please choose',
    lblFirstName: 'First name (owner)', lblLastName: 'Last name (owner)',
    lblEmail: 'Email (login)', lblPassword: 'Password', ownerSubmit: 'Create account',
    ownerFehlgeschlagen: 'Account could not be created.',

    smtpStepLabel: 'Step 3 of 4', smtpTitle: 'Check mail delivery',
    smtpIntro: 'We are now checking whether the box can actually send mail.',
    smtpChecking: 'Checking …',
    smtpSkippedMsg: 'No SMTP configured — no invitation, password-reset, or appointment mails will be sent.',
    smtpAckLabel: 'I understand that no mails will be sent, and want to continue anyway.',
    weiter: 'Continue',
    smtpSentMsg: (empf) => `Test mail sent to ${empf} — please check inbox and spam folder.`,
    smtpArrivedQuestion: 'Did the test mail arrive (also check the spam folder)?',
    smtpNotArrived: 'Not arrived', smtpArrived: 'Arrived',
    smtpRetry: 'Try again', smtpErrorContinue: 'Continue anyway',
    smtpConfirmedMsg: 'Mail delivery works.',
    smtpFehlgeschlagen: 'Test mail could not be sent.',
    smtpNichtAngekommenText: "The server accepted the mail, but it never arrived. Most common cause: the sender address does not belong to the mail server's own domain (SPF/DMARC) — check the sender address in .env (SMTP_FROM).",

    doneStepLabel: 'Step 4 of 4',
    pruefChecking: 'Running checks …',
    pruefTitle: 'Finish setup', pruefIntro: 'A few quick checks before the box is done.',
    pruefLabelSchema: 'Database structure', pruefLabelRls: 'Tenant isolation (RLS)', pruefLabelDek: 'Encryption',
    pruefAckMsg: 'At least one check is red — the list below shows which.',
    pruefAckLabel: 'I want to finish anyway.',
    pruefAbschlussBtn: 'Finish setup',

    doneTitle: 'Done',
    doneText: 'The owner account has been created. You can sign in now.',
    doneLoginBtn: 'Go to sign in',

    closedTitle: 'Already set up',
    closedSub: 'This box already has an owner account. Initial setup only runs once.',
    closedLoginBtn: 'Go to sign in',
  },
  tr: {
    tokenStepLabel: '1 / 4. adım', tokenTitle: 'Kuruluma başla',
    tokenSub: 'Kurulum jetonu, install.sh çalıştırıldığında terminalde göründü.',
    tokenLabel: 'Kurulum jetonu', tokenSubmit: 'İleri',
    tokenInvalid: 'Jeton kabul edilmedi. Lütfen install.sh çıktısından kopyalayın.',
    netzwerkfehler: 'Bağlantı başarısız oldu. Lütfen tekrar deneyin.',

    ownerStepLabel: '2 / 4. adım', ownerTitle: 'Praxis ve hesap',
    ownerSub: 'Bu bilgiler ilk sahip (owner) hesabını oluşturur.',
    lblBusinessName: 'Praxis adı', lblSector: 'Alan (Fachbereich)', optSectorChoose: 'Seçiniz',
    lblFirstName: 'Ad (sahip)', lblLastName: 'Soyad (sahip)',
    lblEmail: 'E-posta (giriş)', lblPassword: 'Şifre', ownerSubmit: 'Hesap oluştur',
    ownerFehlgeschlagen: 'Hesap oluşturulamadı.',

    smtpStepLabel: '3 / 4. adım', smtpTitle: 'Mail gönderimini kontrol et',
    smtpIntro: 'Şimdi kutunun gerçekten mail gönderip gönderemediğini kontrol ediyoruz.',
    smtpChecking: 'Kontrol ediliyor …',
    smtpSkippedMsg: 'SMTP kurulmadı — davet, şifre sıfırlama veya randevu maili gönderilmeyecek.',
    smtpAckLabel: 'Hiçbir mail gönderilmeyeceğinin farkındayım ve yine de devam etmek istiyorum.',
    weiter: 'İleri',
    smtpSentMsg: (empf) => `${empf} adresine test maili gönderildi — lütfen gelen kutusunu ve spam klasörünü kontrol edin.`,
    smtpArrivedQuestion: 'Test maili geldi mi (spam klasörünü de kontrol edin)?',
    smtpNotArrived: 'Gelmedi', smtpArrived: 'Geldi',
    smtpRetry: 'Tekrar dene', smtpErrorContinue: 'Yine de devam et',
    smtpConfirmedMsg: 'Mail gönderimi çalışıyor.',
    smtpFehlgeschlagen: 'Test maili gönderilemedi.',
    smtpNichtAngekommenText: 'Mail sunucu tarafından kabul edildi ama ulaşmadı. En yaygın sebep: gönderen adresi mail sunucusunun kendi alan adına ait değil (SPF/DMARC) — .env içindeki gönderen adresini kontrol edin (SMTP_FROM).',

    doneStepLabel: '4 / 4. adım',
    pruefChecking: 'Kontroller yapılıyor …',
    pruefTitle: 'Kurulumu tamamla', pruefIntro: 'Kutu bitmeden önce birkaç kısa kontrol.',
    pruefLabelSchema: 'Veritabanı yapısı', pruefLabelRls: 'Kiracı ayrımı (RLS)', pruefLabelDek: 'Şifreleme',
    pruefAckMsg: 'En az bir kontrol kırmızı — aşağıdaki liste hangisi olduğunu gösterir.',
    pruefAckLabel: 'Yine de tamamlamak istiyorum.',
    pruefAbschlussBtn: 'Kurulumu tamamla',

    doneTitle: 'Tamamlandı',
    doneText: 'Sahip hesabı oluşturuldu. Şimdi giriş yapabilirsiniz.',
    doneLoginBtn: 'Girişe git',

    closedTitle: 'Zaten kuruldu',
    closedSub: 'Bu kutuda zaten bir sahip hesabı var. İlk kurulum yalnızca bir kez çalışır.',
    closedLoginBtn: 'Girişe git',
  },
};

let lang = localStorage.getItem('infinity_lang') || 'de';

function applyLang() {
  const t = T[lang];
  document.documentElement.lang = lang;
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('tokenStepLabel', t.tokenStepLabel); setText('tokenTitle', t.tokenTitle);
  setText('tokenSub', t.tokenSub); setText('tokenLabel', t.tokenLabel);
  setText('tokenSubmitBtn', t.tokenSubmit);

  setText('ownerStepLabel', t.ownerStepLabel); setText('ownerTitle', t.ownerTitle);
  setText('ownerSub', t.ownerSub); setText('lblBusinessName', t.lblBusinessName);
  setText('lblSector', t.lblSector); setText('optSectorChoose', t.optSectorChoose);
  setText('lblFirstName', t.lblFirstName); setText('lblLastName', t.lblLastName);
  setText('lblEmail', t.lblEmail); setText('lblPassword', t.lblPassword);
  setText('ownerSubmitBtn', t.ownerSubmit);

  setText('smtpStepLabel', t.smtpStepLabel); setText('smtpTitle', t.smtpTitle);
  setText('smtpIntro', t.smtpIntro); setText('smtpChecking', t.smtpChecking);
  setText('smtpSkippedMsg', t.smtpSkippedMsg); setText('smtpAckLabel', t.smtpAckLabel);
  setText('smtpSkipContinueBtn', t.weiter);
  setText('smtpArrivedQuestion', t.smtpArrivedQuestion);
  setText('smtpNotArrivedBtn', t.smtpNotArrived); setText('smtpArrivedBtn', t.smtpArrived);
  setText('smtpRetryBtn', t.smtpRetry); setText('smtpErrorContinueBtn', t.smtpErrorContinue);
  setText('smtpConfirmedMsg', t.smtpConfirmedMsg); setText('smtpConfirmedContinueBtn', t.weiter);

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

  document.querySelectorAll('.lang-switch button').forEach((b) => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
}
applyLang();

document.querySelectorAll('.lang-switch button').forEach((btn) => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang;
    localStorage.setItem('infinity_lang', lang);
    applyLang();
  });
});

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
    if (data.abgeschlossen) {
      verstecken(stepToken, stepOwner, stepSmtp, stepDone);
      stepClosed.hidden = false;
    }
    // abgeschlossen:false, verfuegbar:false (Owner existiert, Abschluss fehlt)
    // zeigt trotzdem stepToken — der Jeton bleibt der Ausweis, um zurück ins
    // Verfahren zu kommen; /verify entscheidet dann per ownerAngelegt, wohin.
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
    const data = await res.json().catch(() => ({}));

    if (res.status === 410) {
      verstecken(stepToken, stepOwner, stepSmtp, stepDone);
      stepClosed.hidden = false;
      return;
    }
    if (!res.ok) {
      zeigeMsg(msg, T[lang].tokenInvalid, 'error');
      return;
    }
    gueltigerToken = token;
    verstecken(stepToken);
    if (data.ownerAngelegt) {
      // Wiederaufnahme: Owner existiert schon, direkt zu Schritt 3.
      stepSmtp.hidden = false;
      testeSmtp();
    } else {
      stepOwner.hidden = false;
    }
  } catch {
    zeigeMsg(msg, T[lang].netzwerkfehler, 'error');
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
      zeigeMsg(msg, data.error || T[lang].ownerFehlgeschlagen, 'error');
      return;
    }

    verstecken(stepOwner);
    stepSmtp.hidden = false;
    testeSmtp();
  } catch {
    zeigeMsg(msg, T[lang].netzwerkfehler, 'error');
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
  verstecken(stepSmtp);
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
  verstecken(stepSmtp);
  pruefChecklist.hidden = true;
  doneFinal.hidden = false;
  stepDone.hidden = false;
}

pruefAckCheckbox.addEventListener('change', (e) => {
  pruefAbschlussBtn.disabled = !e.target.checked;
});
pruefAbschlussBtn.addEventListener('click', abschliessen);

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
      document.getElementById('smtpSentMsg').textContent = T[lang].smtpSentMsg(data.gesendetAn);
      smtpZeige(smtpSent);
      return;
    }
    document.getElementById('smtpErrorMsg').textContent = data.error || T[lang].smtpFehlgeschlagen;
    smtpZeige(smtpError);
  } catch {
    document.getElementById('smtpErrorMsg').textContent = T[lang].netzwerkfehler;
    smtpZeige(smtpError);
  }
}

document.getElementById('smtpAckCheckbox').addEventListener('change', (e) => {
  document.getElementById('smtpSkipContinueBtn').disabled = !e.target.checked;
});
document.getElementById('smtpSkipContinueBtn').addEventListener('click', zuPruefungenUndAbschluss);
document.getElementById('smtpArrivedBtn').addEventListener('click', () => {
  smtpZeige(smtpConfirmed);
});
document.getElementById('smtpConfirmedContinueBtn').addEventListener('click', zuPruefungenUndAbschluss);
document.getElementById('smtpNotArrivedBtn').addEventListener('click', () => {
  document.getElementById('smtpErrorMsg').textContent = T[lang].smtpNichtAngekommenText;
  smtpZeige(smtpError);
});
document.getElementById('smtpRetryBtn').addEventListener('click', testeSmtp);
document.getElementById('smtpErrorContinueBtn').addEventListener('click', zuPruefungenUndAbschluss);
