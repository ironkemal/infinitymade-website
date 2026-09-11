// Faz 2.2 — Einrichtungsassistent, dilim 1 + SMTP-Testmail (O-66).
//
// GET  /api/setup/status     — darf man den Assistenten ueberhaupt oeffnen?
// POST /api/setup/verify     — Jeton pruefen, OHNE ihn zu verbrauchen
// POST /api/setup/owner      — der EINE Schreibvorgang: legt den ersten Owner an
// POST /api/setup/test-smtp  — sendet EINE Testmail an den soeben angelegten Owner
//
// Dieser Router wird in server.js NUR registriert, wenn SETUP_TOKEN gesetzt
// ist — auf SaaS ist die Variable nie gesetzt (CLAUDE.md, ⛔ SET ETME), die
// Routen existieren dort also gar nicht. Das ist das eigentliche Tor, nicht
// die Tabelle praxura_setup (onprem/REGISTER.md O-62, db/REGISTER.md).
//
// Owner-Erstellung laeuft NIE im Browser: das braeuchte den service_role-
// Schluessel im Client (G2-Verstoss, keine Ausnahme). Sie laeuft hier, im
// Container, mit dem Schluessel, den server.js ohnehin schon haelt.
//
// SMTP selbst wird NICHT hier eingerichtet (O-66, Entscheidung 11.09.2026):
// `install.sh` fragt danach und schreibt EINE Wahrheit in `.env`, die GoTrue
// und `api` beide lesen. Dieser Router prueft nur, ob sie funktioniert — er
// kann `.env` nicht aendern (Container liest Umgebung nur beim Start).
//
// Was dieser Router sonst NICHT tut (dilim 2+): Praxis-/Backup-Einstellungen,
// den Assistenten als "abgeschlossen" markieren (praxura_setup.abgeschlossen_am).

import express from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { createSMTPTransport, getMailFrom } from '../lib/mail.js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Nur diese vier — die Heilmittel-Fachbereiche. Die uebrigen Werte in
// profiles_sector_check (barber/beauty/nails/…) sind ein Rest aus der
// InfinityMade-Zeit vor der Praxis-Spezialisierung (CLAUDE.md) und werden
// hier bewusst nicht angeboten.
const FACHBEREICHE = new Set(['podologie', 'physiotherapy', 'ergotherapie', 'logopaedie']);

// Zeitkonstanter Vergleich gegen die Umgebungsvariable — DAS ist die
// eigentliche Pruefung. praxura_setup.token_sha256 ist nur der Nachweis
// danach, keine zweite Pruefung (db/migrations/0005, Kommentar).
function tokenGueltig(eingabe) {
  const erwartet = process.env.SETUP_TOKEN || '';
  if (!erwartet || typeof eingabe !== 'string' || eingabe.length === 0) return false;
  const a = Buffer.from(eingabe);
  const b = Buffer.from(erwartet);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function nochOffen() {
  const { data, error } = await supabase
    .from('praxura_setup')
    .select('verbraucht_am')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return false; // Zeile fehlt/DB-Fehler: sicherheitshalber "geschlossen"
  return data.verbraucht_am === null;
}

router.get('/status', async (req, res) => {
  res.json({ verfuegbar: await nochOffen() });
});

router.post('/verify', async (req, res) => {
  const { token } = req.body || {};
  if (!(await nochOffen())) return res.status(410).json({ error: 'Bereits eingerichtet' });
  if (!tokenGueltig(token)) return res.status(401).json({ error: 'Ungültiges Jeton' });
  res.json({ ok: true });
});

router.post('/owner', async (req, res) => {
  const { token, email, password, business_name, owner_first_name, owner_last_name, sector } = req.body || {};

  if (!(await nochOffen())) return res.status(410).json({ error: 'Bereits eingerichtet' });
  if (!tokenGueltig(token)) return res.status(401).json({ error: 'Ungültiges Jeton' });

  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Passwort zu kurz (mindestens 8 Zeichen)' });
  }
  if (!FACHBEREICHE.has(sector)) {
    return res.status(400).json({ error: 'Ungültiger Fachbereich' });
  }
  if (typeof business_name !== 'string' || business_name.trim().length === 0) {
    return res.status(400).json({ error: 'Praxisname fehlt' });
  }

  // 1. Auth-Konto anlegen — email_confirm:true, weil die Box beim ersten
  // Owner noch gar kein SMTP haben muss (O-66): kein Bestätigungsmail nötig.
  const { data: newUser, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr) {
    return res.status(400).json({ error: 'Konto konnte nicht angelegt werden', detail: authErr.message });
  }
  const ownerId = newUser.user.id;

  // 2. handle_new_user hat bereits (id, email) geschrieben, role='owner' und
  // plan_status='pending' kommen aus den Spaltendefaults (db/migrations/
  // 0000_baseline.sql) — hier fehlen nur die Angaben, die NUR der Mensch
  // kennt. company_code entsteht separat und automatisch beim ersten
  // Dashboard-Aufruf (dashboard.js: ensureCompanyCode()) — nicht hier
  // nachbauen, sonst zwei Quellen für dasselbe Format.
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      business_name: business_name.trim(),
      owner_first_name: owner_first_name || null,
      owner_last_name: owner_last_name || null,
      sector,
    })
    .eq('id', ownerId);
  if (profileErr) {
    return res.status(500).json({ error: 'Konto angelegt, Profil konnte aber nicht vervollständigt werden', detail: profileErr.message });
  }

  // 3. Jeton verbrauchen — EIN bedingtes UPDATE, keine Konkurrenz möglich
  // (db/migrations/0005_praxura_setup.sql, Festlegung 2). Läuft NACH der
  // Kontoanlage: geht dieser Schritt schief, existiert zwar ein Auth-Konto,
  // aber der Jeton bleibt gültig und ein zweiter Versuch kann es beheben —
  // umgekehrt (Jeton zuerst verbrauchen, Konto scheitert) wäre die Box for
  // immer ohne Owner und ohne Weg zurück.
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { data: verbrauchZeile, error: verbrauchErr } = await supabase
    .from('praxura_setup')
    .update({ verbraucht_am: new Date().toISOString(), token_sha256: tokenHash, owner_user_id: ownerId })
    .eq('id', 1)
    .is('verbraucht_am', null)
    .select('id');
  if (verbrauchErr || !verbrauchZeile || verbrauchZeile.length === 0) {
    // Sehr seltener Wettlauf: zwei Anfragen kamen gleichzeitig durch die
    // status/verify-Prüfung. Das Konto oben ist bereits angelegt — nicht
    // rückgängig machen (ein zweites Konto wäre schlimmer), nur melden.
    return res.status(409).json({ error: 'Jeton wurde parallel bereits verbraucht — Konto ist trotzdem angelegt, bitte anmelden.' });
  }

  res.json({ ok: true, email });
});

// Rate-Limit fuer die Testmail: kein express-rate-limit-Overhead fuer einen
// einzelnen, seltenen, ohnehin schon jetongeschuetzten Endpunkt — ein simpler
// Zeitstempel reicht, verhindert nur ein versehentliches Doppelklick-Spamming.
let letzterTestmailVersand = 0;

router.post('/test-smtp', async (req, res) => {
  const { token } = req.body || {};
  // Bewusst OHNE nochOffen(): nach der Owner-Anlage ist der Jeton verbraucht
  // (410) — genau dann will man die Mail noch testen koennen. Das Jeton
  // selbst bleibt die Pruefung, nicht der Setup-Fortschritt.
  if (!tokenGueltig(token)) return res.status(401).json({ error: 'Ungültiges Jeton' });

  if (!process.env.SMTP_HOST) {
    return res.json({ eingerichtet: false });
  }

  const jetzt = Date.now();
  if (jetzt - letzterTestmailVersand < 10_000) {
    return res.status(429).json({ error: 'Bitte kurz warten, bevor Sie es erneut versuchen.' });
  }

  // Empfaenger kommt NIE aus der Anfrage — sonst waere dieser Endpunkt ein
  // Mail-Versand-Hebel fuer jeden, der das Jeton kennt (O-66, Gegenlesen
  // 11.09.2026). Ziel ist immer der Owner, den DIESE Box gerade angelegt hat.
  const { data: setupZeile } = await supabase
    .from('praxura_setup')
    .select('owner_user_id')
    .eq('id', 1)
    .maybeSingle();
  if (!setupZeile?.owner_user_id) {
    return res.status(409).json({ error: 'Noch kein Owner-Konto — zuerst Schritt 2 abschließen.' });
  }
  const { data: ownerProfil } = await supabase
    .from('profiles')
    .select('email, business_name')
    .eq('id', setupZeile.owner_user_id)
    .maybeSingle();
  if (!ownerProfil?.email) {
    return res.status(500).json({ error: 'Owner-E-Mail-Adresse nicht gefunden.' });
  }

  letzterTestmailVersand = jetzt;
  const transport = createSMTPTransport();
  try {
    await transport.verify();
    await transport.sendMail({
      from: getMailFrom(ownerProfil.business_name),
      to: ownerProfil.email,
      subject: 'Praxura — Testmail der Einrichtung',
      html: '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2>SMTP funktioniert</h2><p>Diese Mail kam über den in der Einrichtung angegebenen Mailserver an.</p></div>',
    });
    return res.json({ eingerichtet: true, gesendetAn: ownerProfil.email });
  } catch (err) {
    // Nodemailer-Fehlercodes in verstaendliche Diagnose uebersetzen — der
    // Kunde soll nicht "ECONNREFUSED" lesen muessen (RELEASE-STANDARD §5.4/9).
    const diagnose = {
      EAUTH: 'Benutzername oder Passwort wird vom Mailserver abgelehnt.',
      ECONNECTION: 'Server oder Port nicht erreichbar — Firewall oder falscher Port?',
      ESOCKET: 'Verbindung zum Mailserver ist abgebrochen — Firewall oder falscher Port?',
      ETIMEDOUT: 'Mailserver antwortet nicht (Zeitüberschreitung).',
      EENVELOPE: 'Absender- oder Empfängeradresse wurde vom Mailserver abgelehnt.',
      EDNS: 'Mailserver-Adresse ist unbekannt — Hostname in der Einrichtung prüfen.',
    }[err.code] || err.message || 'Unbekannter Fehler beim Mailversand.';
    return res.status(502).json({ error: diagnose, code: err.code || null, gesendetAn: ownerProfil.email });
  }
});

export default router;
