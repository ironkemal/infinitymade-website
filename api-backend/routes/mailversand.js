// Einstellungen → E-Mail-Versand (AUFTRAG-MAILVERSAND, Kemal 09.11.2026).
//
//   GET    /api/mailversand        Status + gespeicherte Einstellung (OHNE Passwort/Token)
//   PUT    /api/mailversand        Postfach speichern (SMTP: Anbieter-Vorlage oder „Andere"), danach verify()
//   POST   /api/mailversand/test   Testmail an die Inhaber-Adresse (Empfänger NIE aus der Anfrage)
//   DELETE /api/mailversand        Postfach trennen (?gmail=1: zusätzlich Gmail-Token löschen, nur SaaS)
//
// Nur Inhaber (requireOwner): das Postfach spricht für die ganze Praxis. Box UND SaaS (Melih 09.11.2026);
// ohne Zeile bleibt alles wie vorher (lib/mail.js mailKanal: Einstellung → SMTP_* → kein).
//
// Korkuluklar (onprem, AUFTRAG §5): Passwort nur verschlüsselt (lib/phi-encrypt.js, DATA_ENCRYPTION_KEY,
// sonst 503 — nie Klartext), verlässt den Server nur Richtung Mailserver, nie in einer Antwort; Logs nur
// e.code; Hosts nur aus der festen Vorlagenliste oder vom Inhaber getippt — keine automatische Erkennung.
// Die Tabelle hat RLS ohne Policy: nur dieser Router (service_role) liest/schreibt sie.

import { Router } from 'express';
import dns from 'node:dns';
import net from 'node:net';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireOwner } from '../ai/auth.js';
import { istKutu } from '../lib/dagitim.js';
import { encryptionAvailable, decryptPHI } from '../lib/phi-encrypt.js';
import {
  SMTP_PRESETS, ANBIETER_HINWEIS, fehlerHinweis, envSmtpAnzeige, verschluesselePasswort,
  ladeMailEinstellung, mailKanal, createSMTPTransport,
} from '../lib/mail.js';

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
const HOST_RE = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const TEST_ABSTAND_MS = 10_000;
// onprem O-244 Auflage 1 (SSRF): bei „Andere" nur Mail-Ports, keine IP-Literale. Im SaaS zusätzlich kein Ziel,
// das auf private/lokale Adressen auflöst (der VPS darf nicht ins eigene Netz verbinden). In der Box ist ein
// Mailserver im Praxisnetz dagegen legitim.
export const ERLAUBTE_PORTS = new Set([25, 465, 587, 2525]);
// SaaS-VPS (Hetzner) sperrt ausgehend 25 und 465 — live gemessen 10.11.2026 (465: Zeitueberschreitung). Statt
// 15 s auf ETIMEDOUT zu warten, gleich mit klarem Hinweis ablehnen. In der Box gelten alle vier Ports.
export const SAAS_GESPERRTE_PORTS = new Set([25, 465]);

/** Private, Loopback-, Link-local-, CGNAT- und ULA-Adressen. */
export function istInterneAdresse(ip) {
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(String(ip));
  if (hex) {
    const a = parseInt(hex[1], 16); const b = parseInt(hex[2], 16);
    return istInterneAdresse(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`);
  }
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = String(ip).toLowerCase();
  if (v.startsWith('::ffff:')) return istInterneAdresse(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')
    || v.startsWith('fc') || v.startsWith('fd');
}

async function zeigtIntern(host, lookup = dns.promises.lookup) {
  try {
    const adressen = await lookup(host, { all: true });
    return adressen.some(a => istInterneAdresse(a.address));
  } catch { return false; } // nicht auflösbar → verify() meldet EDNS
}

/**
 * Verbindungsziel für verify()/Testmail. Im SaaS bei „Andere": EINMAL auflösen, prüfen und die IP festnageln
 * (tls.servername = Hostname), sonst könnte nodemailer beim Verbinden neu auflösen (DNS-Rebinding).
 * requireTLS immer: ohne STARTTLS gingen Zugangsdaten im Klartext (Review 09.11.2026).
 * @returns {Promise<object|null>} Transport-Optionen, null = internes Ziel (abgelehnt)
 */
export async function pruefZiel(smtp, { preset, kutu, lookup = dns.promises.lookup }) {
  const basis = { ...(smtp || {}), requireTLS: true };
  if (kutu || preset !== 'andere' || !smtp?.host) return basis;
  let adressen;
  try { adressen = await lookup(smtp.host, { all: true }); } catch { return basis; }
  if (!adressen.length || adressen.some(a => istInterneAdresse(a.address))) return null;
  return { ...basis, host: adressen[0].address, tls: { servername: smtp.host } };
}
const VERIFY_TIMEOUT_MS = 15_000;

/** Eingaben prüfen. @returns {{fehler:string}|{werte:object}} — `passwort` nur, wenn neu eingegeben. */
export function pruefeMailEingabe(body = {}, { kutu = true } = {}) {
  const preset = String(body.preset || '');
  const vorlage = SMTP_PRESETS[preset];
  if (!vorlage) return { fehler: 'Bitte einen Anbieter wählen.' };
  const absender_email = String(body.absender_email || '').trim();
  if (!EMAIL_RE.test(absender_email) || absender_email.length > 254) return { fehler: 'Bitte eine gültige E-Mail-Adresse eingeben.' };
  const absender_name = String(body.absender_name || '').replace(/[\r\n"<>]/g, '').trim().slice(0, 120) || null;
  let smtp_host = vorlage.host; let smtp_port = vorlage.port; let smtp_sicherheit = vorlage.sicherheit;
  if (preset === 'andere') {
    smtp_host = String(body.smtp_host || '').trim().toLowerCase();
    if (!HOST_RE.test(smtp_host)) return { fehler: 'Bitte einen gültigen Servernamen eingeben (z. B. smtp.example.de).' };
    if (net.isIP(smtp_host)) return { fehler: 'Bitte den Servernamen statt einer IP-Adresse eingeben.' };
    smtp_port = Number(body.smtp_port);
    if (!ERLAUBTE_PORTS.has(smtp_port)) return { fehler: 'Bitte einen Mail-Port wählen: 587 (STARTTLS), 465 (SSL/TLS), 25 oder 2525.' };
    if (!kutu && SAAS_GESPERRTE_PORTS.has(smtp_port)) return { fehler: 'Port 25 und 465 sind von unserem Server aus gesperrt. Bitte Port 587 mit STARTTLS wählen (bieten fast alle Anbieter an).' };
    smtp_sicherheit = String(body.smtp_sicherheit || '');
    if (!['ssl', 'starttls'].includes(smtp_sicherheit)) return { fehler: 'Bitte die Verschlüsselung wählen (SSL/TLS oder STARTTLS).' };
  }
  const smtp_benutzer = String(body.smtp_benutzer || '').trim() || absender_email;
  if (smtp_benutzer.length > 254 || /[\s\x00-\x1f]/.test(smtp_benutzer)) return { fehler: 'Der Benutzername ist ungültig.' };
  const passwort = typeof body.passwort === 'string' && body.passwort.length ? body.passwort : null;
  if (passwort && (passwort.length > 512 || /[\r\n\x00]/.test(passwort))) return { fehler: 'Das Passwort ist ungültig.' };
  return { werte: { preset, smtp_host, smtp_port, smtp_sicherheit, smtp_benutzer, absender_email, absender_name, passwort } };
}

/** Was der Browser sehen darf — nie smtp_passwort/oauth_refresh_token. */
export function oeffentlicheSicht(z) {
  if (!z) return null;
  return {
    modus: z.modus, preset: z.preset || null, smtp_host: z.smtp_host || null, smtp_port: z.smtp_port || null,
    smtp_sicherheit: z.smtp_sicherheit || null, smtp_benutzer: z.smtp_benutzer || null,
    absender_email: z.absender_email || null, absender_name: z.absender_name || null,
    passwortGespeichert: !!z.smtp_passwort, status: z.status || 'nicht_eingerichtet',
    letzter_test_at: z.letzter_test_at || null, letzter_test_ok: z.letzter_test_ok ?? null,
    letzter_fehler_code: z.letzter_fehler_code || null,
  };
}

function mitTimeout(promise, ms) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), ms); }),
  ]).finally(() => clearTimeout(t));
}

/**
 * @param {object} o
 * @param {object} o.supabase           service_role-Client
 * @param {boolean} [o.googleVerfuegbar] SaaS: GOOGLE_KONFIGURIERT (Gmail-OAuth nur dort, O-08)
 * @param {function} [o.transportFabrik] Tests
 * @param {function} [o.auth]            Ersatz für requireAuth (Tests)
 * @param {function} [o.kutu]            Ersatz für istKutu (Tests)
 */
export function createMailversandRouter({
  supabase, googleVerfuegbar = false, transportFabrik = createSMTPTransport, auth = requireAuth, kutu = istKutu,
  env = process.env, owner = requireOwner, lookup = dns.promises.lookup,
} = {}) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
    keyGenerator: (req) => req.auth?.userId || req.ip,
    message: { error: 'Zu viele Anfragen. Bitte warten Sie eine Minute.' },
  });
  const letzterTest = new Map();

  // Tabelle (0118) noch nicht angewandt? Dann zeigt die Oberfläche „noch nicht verfügbar" statt eines Fehlers.
  const tabelleDa = async () => {
    try {
      const { error } = await supabase.from('praxis_mailversand').select('owner_id').limit(1);
      return !error || !['42P01', 'PGRST205', 'PGRST204'].includes(error.code);
    } catch { return false; }
  };

  const ladeProfil = async (id) => {
    const { data } = await supabase.from('profiles').select('email, business_name, b2b_from_email').eq('id', id).maybeSingle();
    return data || {};
  };

  router.get('/mailversand', auth, owner, limiter, async (req, res) => {
    try {
      const ownerId = req.auth.tenantId;
      const box = kutu();
      const [z, profil, verfuegbar] = await Promise.all([ladeMailEinstellung(supabase, ownerId), ladeProfil(ownerId), tabelleDa()]);
      const sicht = oeffentlicheSicht(z);
      // Gespeichertes Passwort nicht mehr lesbar (Schlüssel gewechselt): sichtbar machen statt „verbunden" zu zeigen.
      if (sicht?.modus === 'smtp' && z.smtp_passwort && !decryptPHI(z.smtp_passwort)) {
        sicht.status = 'unterbrochen'; sicht.letzter_fehler_code = 'PASSWORT_NICHT_LESBAR'; sicht.passwortGespeichert = false;
      }
      const aktiv = sicht && sicht.modus !== 'aus' ? sicht : null;
      // SMTP_* der Box anzeigen (read-only); im SaaS nie — das wäre der Praxura-Server.
      const env_smtp = box ? envSmtpAnzeige(env) : null;
      res.set('Cache-Control', 'no-store');
      return res.json({
        kutu: box,
        verfuegbar,
        quelle: aktiv?.modus === 'smtp' ? 'db' : env_smtp ? 'env' : null,
        einstellung: sicht,
        env: env_smtp,
        presets: SMTP_PRESETS,
        hinweise: ANBIETER_HINWEIS,
        verschluesselung: encryptionAvailable(),
        google: !box ? { verfuegbar: !!googleVerfuegbar, verbunden: !!profil.b2b_from_email, adresse: profil.b2b_from_email || null } : null,
        vorgaben: { absender_email: profil.email || null, absender_name: profil.business_name || null },
        fehler: sicht?.letzter_fehler_code ? fehlerHinweis(sicht.letzter_fehler_code, sicht.preset) : null,
      });
    } catch (e) {
      console.error('[mailversand/get]', e?.code || 'Fehler');
      return res.status(500).json({ error: 'Einstellung konnte nicht geladen werden.' });
    }
  });

  router.put('/mailversand', auth, owner, limiter, async (req, res) => {
    const { fehler, werte } = pruefeMailEingabe(req.body, { kutu: kutu() });
    if (fehler) return res.status(400).json({ error: fehler });
    if (!encryptionAvailable()) {
      return res.status(503).json({ error: 'Passwörter können auf diesem Server nicht verschlüsselt gespeichert werden (Schlüssel fehlt). Bitte den Support kontaktieren.', code: 'VERSCHLUESSELUNG_FEHLT' });
    }
    const ownerId = req.auth.tenantId;
    try {
      if (werte.preset === 'andere' && !kutu() && await zeigtIntern(werte.smtp_host, lookup)) {
        return res.status(400).json({ error: 'Dieser Server ist aus dem Internet nicht erreichbar. Bitte den öffentlichen Postausgangsserver Ihres Anbieters eintragen.' });
      }
      if (!(await tabelleDa())) return res.status(503).json({ error: 'Der E-Mail-Versand wird mit dem nächsten Update freigeschaltet.', code: 'NOCH_NICHT_VERFUEGBAR' });
      const alt = await ladeMailEinstellung(supabase, ownerId);
      // Leeres Passwortfeld = gespeichertes behalten — aber nur für denselben Server und Benutzer.
      const gleicherZugang = alt?.smtp_passwort && alt.smtp_host === werte.smtp_host && alt.smtp_benutzer === werte.smtp_benutzer;
      if (!werte.passwort && !gleicherZugang) return res.status(400).json({ error: 'Bitte das Passwort eingeben.' });
      const smtp_passwort = werte.passwort ? verschluesselePasswort(werte.passwort) : alt.smtp_passwort;
      const zeile = {
        owner_id: ownerId, modus: 'smtp', preset: werte.preset, smtp_host: werte.smtp_host, smtp_port: werte.smtp_port,
        smtp_sicherheit: werte.smtp_sicherheit, smtp_benutzer: werte.smtp_benutzer, smtp_passwort,
        absender_email: werte.absender_email, absender_name: werte.absender_name,
        status: 'nicht_eingerichtet', letzter_fehler_code: null, updated_at: new Date().toISOString(),
      };
      // Verbindung gleich prüfen (ohne Mail): sofortige Rückmeldung mit Anbieter-Hinweis.
      const kanal = await mailKanal({ zeile, zweck: 'dokument', env: {}, kutu: kutu() });
      if (kanal.weg !== 'smtp' || kanal.quelle !== 'db') {
        return res.status(400).json({ error: 'Das gespeicherte Passwort kann nicht mehr gelesen werden. Bitte das Passwort neu eingeben.', code: 'PASSWORT_NICHT_LESBAR' });
      }
      const ziel = await pruefZiel(kanal.smtp, { preset: werte.preset, kutu: kutu(), lookup });
      if (!ziel) return res.status(400).json({ error: 'Dieser Server ist aus dem Internet nicht erreichbar. Bitte den öffentlichen Postausgangsserver Ihres Anbieters eintragen.' });
      let pruefung;
      try {
        await mitTimeout(Promise.resolve(transportFabrik(ziel).verify()), VERIFY_TIMEOUT_MS);
        pruefung = { ok: true, code: null };
      } catch (e) {
        pruefung = { ok: false, code: String(e?.code || 'VERIFY_FEHLER').slice(0, 64) };
      }
      zeile.status = pruefung.ok ? 'verbunden' : 'unterbrochen';
      zeile.letzter_fehler_code = pruefung.ok ? null : pruefung.code.replace(/[^A-Za-z0-9_]/g, '_');
      const { error } = await supabase.from('praxis_mailversand').upsert(zeile, { onConflict: 'owner_id' });
      if (error) throw error;
      return res.json({
        ok: true, verbunden: pruefung.ok,
        ...(pruefung.ok ? {} : fehlerHinweis(pruefung.code, werte.preset)),
        einstellung: oeffentlicheSicht(zeile),
      });
    } catch (e) {
      console.error('[mailversand/put]', e?.code || 'Fehler');
      return res.status(500).json({ error: 'Einstellung konnte nicht gespeichert werden.' });
    }
  });

  router.post('/mailversand/test', auth, owner, limiter, async (req, res) => {
    const ownerId = req.auth.tenantId;
    try {
      const profil = await ladeProfil(ownerId);
      if (!profil.email) return res.status(409).json({ error: 'Für das Inhaberkonto ist keine E-Mail-Adresse hinterlegt.' });
      const z = await ladeMailEinstellung(supabase, ownerId);
      const kanal = await mailKanal({ zeile: z, zweck: 'dokument', env, kutu: kutu() });
      if (kanal.weg !== 'smtp' || (kanal.quelle === 'env' && !kutu())) {
        const h = kanal.fehler ? fehlerHinweis(kanal.fehler, kanal.preset) : null;
        return res.status(409).json({ error: h?.meldung || 'Es ist noch kein Postfach eingerichtet.', code: kanal.fehler || 'VERSAND_NICHT_EINGERICHTET' });
      }
      const jetzt = Date.now();
      if (jetzt - (letzterTest.get(ownerId) || 0) < TEST_ABSTAND_MS) {
        return res.status(429).json({ error: 'Bitte kurz warten, bevor Sie es erneut versuchen.' });
      }
      // Der Speicher oben gilt nur je Prozess (SaaS: 2 Worker, node:cluster). Beim Praxis-Postfach zusaetzlich
      // atomar in der DB beanspruchen: nur ein Aufruf je 10 s setzt letzter_test_at (Regressionstest mit zwei Routern).
      if (z && kanal.quelle === 'db') {
        const grenze = new Date(jetzt - TEST_ABSTAND_MS).toISOString();
        const { data: frei, error: aErr } = await supabase.from('praxis_mailversand')
          .update({ letzter_test_at: new Date(jetzt).toISOString() })
          .eq('owner_id', ownerId).or(`letzter_test_at.is.null,letzter_test_at.lt.${grenze}`).select('owner_id');
        if (aErr || !Array.isArray(frei)) {
          console.error('[mailversand/test] Drossel', aErr?.code || 'UNGUELTIGE_ANTWORT');
          return res.status(503).json({ error: 'Testmail derzeit nicht möglich. Bitte später erneut versuchen.' });
        }
        if (frei.length === 0) {
          return res.status(429).json({ error: 'Bitte kurz warten, bevor Sie es erneut versuchen.' });
        }
      }
      if (letzterTest.size > 5000) letzterTest.clear();
      letzterTest.set(ownerId, jetzt);
      const ziel = await pruefZiel(kanal.smtp, { preset: kanal.preset, kutu: kutu(), lookup });
      if (!ziel) return res.status(400).json({ error: 'Dieser Server ist aus dem Internet nicht erreichbar.', code: 'ZIEL_INTERN' });
      let ergebnis;
      try {
        const t = transportFabrik(ziel);
        await mitTimeout(Promise.resolve(t.verify()), VERIFY_TIMEOUT_MS);
        await t.sendMail({
          from: kanal.from(profil.business_name),
          to: profil.email,
          subject: 'Praxura — Testmail',
          text: 'Diese Testmail wurde über das unter Einstellungen → E-Mail-Versand eingerichtete Postfach verschickt.\n\nDer E-Mail-Versand funktioniert.',
        });
        ergebnis = { ok: true, code: null };
      } catch (e) {
        ergebnis = { ok: false, code: String(e?.code || 'VERSAND_FEHLER').slice(0, 64).replace(/[^A-Za-z0-9_]/g, '_') };
        console.error('[mailversand/test]', ergebnis.code);
      }
      if (z && kanal.quelle === 'db') {
        const { error } = await supabase.from('praxis_mailversand').update({
          status: ergebnis.ok ? 'verbunden' : 'unterbrochen', letzter_test_at: new Date().toISOString(),
          letzter_test_ok: ergebnis.ok, letzter_fehler_code: ergebnis.code, updated_at: new Date().toISOString(),
        }).eq('owner_id', ownerId);
        if (error) console.error('[mailversand/test] Status', error.code || '');
      }
      if (ergebnis.ok) return res.json({ ok: true, gesendetAn: profil.email });
      return res.status(502).json({ ok: false, ...fehlerHinweis(ergebnis.code, kanal.preset), error: fehlerHinweis(ergebnis.code, kanal.preset).meldung });
    } catch (e) {
      console.error('[mailversand/test]', e?.code || 'Fehler');
      return res.status(500).json({ error: 'Testmail konnte nicht gesendet werden.' });
    }
  });

  router.delete('/mailversand', auth, owner, limiter, async (req, res) => {
    const ownerId = req.auth.tenantId;
    try {
      const { error } = await supabase.from('praxis_mailversand').update({
        modus: 'aus', smtp_passwort: null, oauth_refresh_token: null, status: 'nicht_eingerichtet',
        letzter_test_at: null, letzter_test_ok: null, letzter_fehler_code: null, updated_at: new Date().toISOString(),
      }).eq('owner_id', ownerId);
      if (error) throw error;
      if (req.query.gmail === '1' && !kutu()) {
        await supabase.rpc('clear_gmail_token', { p_user_id: ownerId });
        const { error: pErr } = await supabase.from('profiles').update({ b2b_from_email: null }).eq('id', ownerId);
        if (pErr) throw pErr;
      }
      return res.json({ ok: true });
    } catch (e) {
      console.error('[mailversand/delete]', e?.code || 'Fehler');
      return res.status(500).json({ error: 'Postfach konnte nicht getrennt werden.' });
    }
  });

  return router;
}
