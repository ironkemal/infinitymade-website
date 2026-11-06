// Terminerinnerung am Vortag (O-206 Phase A, Physio-Pilot P1, 06.11.2026) – Lauf und Zeitjob.
// Reine Logik: lib/terminerinnerung.js. Versand + Protokoll + Tagesdeckel: sendeLauf() aus routes/sondertag-mitteilung.js
// (dieselbe Reservierung VOR dem Versand, dieselbe Einwilligungspruefung – keine zweite Versandschleife).
//
// Nur Box mit Praxis-SMTP (versandWeg() === 'smtp'). SaaS/Gmail braucht einen Request-Kontext und gehoert nicht zu
// Phase A; ohne SMTP laeuft nichts und es entsteht keine Fehlerflut (G-5). Praxis-Schalter profiles.terminerinnerung_aktiv
// (Migration 0110, Standard AUS), gelesen nur aus der Inhaber-Zeile (role='owner').
// Logs: nur Anzahlen und Codes – nie Adresse, Name oder Termin (G-4).
import { istKutu } from './dagitim.js';
import { createSMTPTransport } from './mail.js';
import { berlinTagesgrenzen } from './berlin-tag.js';
import { einteilen, protokollSchluessel, IN_ARBEIT } from './sondertag-mitteilung.js';
import {
  ANLASS_ERINNERUNG, DECKEL_ERINNERUNG, fensterOffen, morgenBerlin, zuErinnern, protokollZustandErinnerung, erinnerungsText,
} from './terminerinnerung.js';
import { versandWeg } from '../routes/dokument-mail.js';
import { sendeLauf, SMTP_ABBRUCH } from '../routes/sondertag-mitteilung.js';

const leer = () => ({ mandanten: 0, gesendet: 0, fehler: 0, doppelt: 0, unklar: 0, abgelehnt: 0, anruf: 0, deckel: 0, abgebrochen: false, uebersprungen: null });

/** Grosse IN-Listen in Bloecke teilen: eine URL mit hunderten UUIDs ueberschreitet die Header-Grenze von Kong/PostgREST. */
const BLOCK = 50;
async function ladeInBloecken(ids, abfrage) {
  const daten = [];
  for (let i = 0; i < ids.length; i += BLOCK) {
    const r = await abfrage(ids.slice(i, i + BLOCK));
    if (r.error) return { data: null, error: r.error };
    daten.push(...(r.data || []));
  }
  return { data: daten, error: null };
}
/** PostgREST kappt Antworten stillschweigend (Standard 1000 Zeilen) – lieber laut scheitern als Termine auslassen. */
const ZEILENGRENZE = 1000;

const adresse = b => [b.business_name, [b.street, b.house_number].filter(Boolean).join(' '), [b.zip, b.city].filter(Boolean).join(' ')]
  .map(x => String(x || '').trim()).filter(Boolean).join(', ');

/** Ein Mandant: Termine von morgen laden, einteilen, senden. Wirft bei DB-Fehlern (Aufrufer isoliert je Mandant). */
export async function mandantLauf(supabase, profil, { jetzt, morgen, grenzen, transportFabrik }) {
  const tenantId = profil.id;
  const { data: termine, error: e1 } = await supabase.from('bookings')
    .select('id,start_time,status,group_parent_id,business_id,lead_id,created_at')
    .eq('owner_id', tenantId).gte('start_time', grenzen.von).lt('start_time', grenzen.bisExklusiv);
  if (e1) throw e1;
  if ((termine || []).length >= ZEILENGRENZE) throw Object.assign(new Error('Zeilengrenze'), { code: 'ZEILENGRENZE' });
  const liste = zuErinnern(termine, { jetzt, morgen });
  if (!liste.length) return { ergebnis: leer() };

  const leadIds = [...new Set(liste.map(x => x.termin.lead_id).filter(Boolean))];
  const bookingIds = liste.map(x => x.termin.id);
  const [leadsR, einwR, protR, bizR] = await Promise.all([
    ladeInBloecken(leadIds, ids => supabase.from('leads').select('id,email').eq('owner_id', tenantId).in('id', ids)),
    ladeInBloecken(leadIds, ids => supabase.from('patient_consents').select('patient_id,consent_type,text_version,text_snapshot,consented_at,revoked_at')
      .eq('owner_id', tenantId).eq('consent_type', 'datenschutz').in('patient_id', ids)),
    ladeInBloecken(bookingIds, ids => supabase.from('termin_mitteilungen').select('booking_id,termin_beginn,status,fehler_code')
      .eq('owner_id', tenantId).eq('anlass', ANLASS_ERINNERUNG).in('booking_id', ids)),
    supabase.from('businesses').select('id,business_name,street,house_number,zip,city').eq('owner_id', tenantId),
  ]);
  for (const r of [leadsR, einwR, protR, bizR]) if (r.error) throw r.error;
  const leads = new Map((leadsR.data || []).map(l => [l.id, l]));
  const einw = new Map();
  for (const e of einwR.data || []) { if (!einw.has(e.patient_id)) einw.set(e.patient_id, []); einw.get(e.patient_id).push(e); }
  // Standort nur nennen, wenn die Praxis mehrere hat (sonst ueberfluessig).
  const standort = new Map();
  if ((bizR.data || []).length > 1) for (const b of bizR.data) standort.set(b.id, adresse(b));

  const teile = einteilen(liste, leads, einw,
    protokollZustandErinnerung(protR.data, protokollSchluessel, IN_ARBEIT), true);
  const ergebnis = leer();
  ergebnis.anruf = teile.anruf.length;
  if (!teile.mail.length) return { ergebnis };

  // Erreichbarkeit VOR der ersten Reservierung pruefen: faellt der Mailserver aus, entsteht keine Protokollzeile und
  // der naechste Lauf versucht es erneut (ein Timeout waehrend des Sendens waere dagegen nie sicher wiederholbar).
  try {
    await transportFabrik({ requireTLS: true }).verify?.();
  } catch (err) {
    ergebnis.abgebrochen = true;
    return { ergebnis, abbruch: true, serverCode: String(err?.code || 'VERIFY_FEHLER').slice(0, 64) };
  }

  const lage = { weg: 'smtp', mail: teile.mail, profil: { business_name: profil.business_name, phone: profil.phone }, standort };
  const r = await sendeLauf(supabase, {
    tenantId, userId: null, ids: teile.mail.map(x => x.termin.id), lage, transportFabrik, jetzt,
    anlass: ANLASS_ERINNERUNG, textFn: erinnerungsText, deckel: DECKEL_ERINNERUNG, tag: 'terminerinnerung',
  });
  for (const k of ['gesendet', 'fehler', 'doppelt', 'unklar', 'abgelehnt']) ergebnis[k] = r.body?.[k] || 0;
  if (r.status === 429) ergebnis.deckel = 1;
  const abbruch = r.status === 409 && SMTP_ABBRUCH.has(r.body?.code);
  return { ergebnis, abbruch };
}

/**
 * Ein Durchlauf (ohne Timer, testbar). Ausserhalb des Versandfensters oder ohne Praxis-SMTP passiert nichts.
 * Bricht beim ersten SMTP-Transportfehler ab: der Mailserver der Box ist fuer alle Mandanten derselbe.
 */
export async function erinnerungsLauf(supabase, {
  jetzt = new Date(), env = process.env, kutu = istKutu(), transportFabrik = createSMTPTransport, log = console,
} = {}) {
  const summe = leer();
  if (!fensterOffen(jetzt)) return { ...summe, uebersprungen: 'ausserhalb_fenster' };
  if (versandWeg(env, kutu) !== 'smtp') return { ...summe, uebersprungen: 'kein_smtp' };
  const morgen = morgenBerlin(jetzt);
  const grenzen = berlinTagesgrenzen(morgen);
  if (!grenzen) return { ...summe, uebersprungen: 'ungueltiger_tag' };

  const { data: profile, error } = await supabase.from('profiles')
    .select('id,business_name,phone').eq('terminerinnerung_aktiv', true).eq('role', 'owner');
  if (error) throw error;

  for (const profil of profile || []) {
    summe.mandanten += 1;
    try {
      const { ergebnis, abbruch, serverCode } = await mandantLauf(supabase, profil, { jetzt, morgen, grenzen, transportFabrik });
      for (const k of ['gesendet', 'fehler', 'doppelt', 'unklar', 'abgelehnt', 'anruf', 'deckel']) summe[k] += ergebnis[k];
      if (abbruch) { summe.abgebrochen = true; log.error?.(`[terminerinnerung] Mailserver nicht nutzbar: ${serverCode || 'SMTP'}`); break; }
    } catch (err) {
      summe.fehler += 1;
      log.error?.(`[terminerinnerung] Mandantenlauf fehlgeschlagen: ${String(err?.code || 'FEHLER').slice(0, 64)}`);
    }
  }
  if (summe.gesendet || summe.fehler || summe.unklar || summe.abgebrochen || summe.deckel || summe.anruf) log.log?.('[terminerinnerung]', JSON.stringify(summe));
  return summe;
}

/**
 * Startet den Zeitjob (Muster: dsgvo/fristen.js): nur Worker 0, alle 15 Minuten, erster Lauf 60 s nach dem Start.
 * Innerhalb des Fensters (Berliner Zeit) holt jeder Lauf nach, was fehlt; Doppelversand verhindert die Datenbank.
 */
export function starteTerminerinnerung({
  supabase, env = process.env, jetzt = Date.now, timer = { setTimeout, setInterval }, log = console, kutu = istKutu(),
  transportFabrik = createSMTPTransport,
} = {}) {
  if (!supabase) return null;
  if (env.NODE_APP_INSTANCE !== undefined && env.NODE_APP_INSTANCE !== null && String(env.NODE_APP_INSTANCE) !== '0') return null;
  let laeuft = false;
  const tick = async () => {
    if (laeuft) return;
    laeuft = true;
    try {
      await erinnerungsLauf(supabase, { jetzt: new Date(jetzt()), env, kutu, transportFabrik, log });
    } catch (err) {
      try { (log.warn || log.log)(`[terminerinnerung] Unerwarteter Fehler: ${String(err?.code || 'FEHLER').slice(0, 64)}`); } catch {}
    } finally {
      laeuft = false;
    }
  };
  const t1 = timer.setTimeout(tick, 60_000);
  const t2 = timer.setInterval(tick, 15 * 60_000);
  for (const t of [t1, t2]) if (t && typeof t.unref === 'function') { try { t.unref(); } catch {} }
  return { tick, stop() { (timer.clearTimeout || clearTimeout)(t1); (timer.clearInterval || clearInterval)(t2); } };
}
