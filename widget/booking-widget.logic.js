// Reine Logik des Termin-Anfrage-Widgets: Listen, Regeln je Schritt, Zusammenfassung, Payload.
// Kein DOM, kein fetch — laeuft unter `node --test` (booking-widget.logic.test.js).
//
// Die Anliegen-Liste kommt aus module/anfrage-anliegen.js (eine Quelle fuer Widget und
// booking-request.html). Die Schluessel der Tage/Tageszeiten/Dringlichkeit stehen ZUSAETZLICH in
// api-backend/booking/widget-guards.js; widget-listen-parity.test.js haelt beide gleich.
import { ANLIEGEN, zahlungsartenFuer } from '../module/anfrage-anliegen.js?v=20261012';

export { ANLIEGEN };

export const TAGE = [
  { key: 'mo', kurz: 'Mo', lang: 'Montag' },
  { key: 'di', kurz: 'Di', lang: 'Dienstag' },
  { key: 'mi', kurz: 'Mi', lang: 'Mittwoch' },
  { key: 'do', kurz: 'Do', lang: 'Donnerstag' },
  { key: 'fr', kurz: 'Fr', lang: 'Freitag' },
];
export const TAGESZEITEN = [
  { key: 'vormittag', titel: 'Vormittag', hinweis: '8 bis 12 Uhr', text: 'Vormittag (8–12)' },
  { key: 'nachmittag', titel: 'Nachmittag', hinweis: '12 bis 16 Uhr', text: 'Nachmittag (12–16)' },
  { key: 'spaet', titel: 'Später Nachmittag', hinweis: 'ab 16 Uhr', text: 'Später Nachmittag (ab 16 Uhr)' },
];
export const DRINGLICHKEIT = [
  { key: 'asap', titel: 'So bald wie möglich' },
  { key: 'wochen', titel: 'In 2 bis 3 Wochen' },
  { key: 'egal', titel: 'Keine Eile' },
];
export const ERSTBESUCH = [
  { key: 'ja', titel: 'Ja, ich war schon einmal da' },
  { key: 'nein', titel: 'Nein, das ist mein erster Besuch' },
];
export const ZAHLARTEN = [
  { key: 'gkv', titel: 'Gesetzlich versichert' },
  { key: 'pkv', titel: 'Privat versichert' },
  { key: 'selbstzahler', titel: 'Selbstzahler' },
  { key: 'bg', titel: 'Berufsgenossenschaft' },
];
export const MAX_MITTEILUNG = 140;
export const MAX_ANMERKUNG = 80;
export const SCHRITTE = 4;

const WOCHENTAGE = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/* ---------- Zustand ---------- */

export function leererZustand() {
  return {
    anliegen: '', zahlart: '', hausbesuch: false, mitteilung: '',
    flexibel: false, tage: [], zeiten: [], dringlichkeit: '', anmerkung: '',
    vorname: '', nachname: '', tag: '', monat: '', jahr: '', erstbesuch: '', fuerAndere: false,
    telefon: '', email: '',
  };
}

/** Anliegen-Karten gibt es nur fuer Podologie (wie module/anfrage-anliegen.js). */
export function zeigeAnliegen(bereich) {
  return String(bereich || '').toLowerCase().startsWith('podolog');
}

/** Erlaubte Versicherungsarten: je Anliegen gefiltert, ohne Anliegen alle vier. */
export function zahlartOptionen(anliegen) {
  const erlaubt = zahlungsartenFuer(anliegen || null);
  return ZAHLARTEN.filter((z) => erlaubt.includes(z.key));
}

/** Wechselt das Anliegen und die gewaehlte Versicherung passt nicht mehr, wird sie geleert. */
export function waehleAnliegen(z, key) {
  const n = { ...z, anliegen: key };
  if (n.zahlart && !zahlartOptionen(key).some((o) => o.key === n.zahlart)) n.zahlart = '';
  return n;
}

/** „flexibel" und konkrete Auswahl schliessen sich aus. */
export function setzeFlexibel(z, an) {
  return an ? { ...z, flexibel: true, tage: [], zeiten: [] } : { ...z, flexibel: false };
}
export function schalte(z, feld, key) {
  const liste = z[feld].includes(key) ? z[feld].filter((k) => k !== key) : [...z[feld], key];
  return { ...z, [feld]: liste, flexibel: false };
}

/* ---------- Datum ---------- */

/** "YYYY-MM-DD" -> {y,m,d} oder null (echtes Kalenderdatum, keine Rollover). */
export function parseIsoDate(s) {
  const m = ISO_DATE.exec(String(s || ''));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

export function isoToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Tag/Monat/Jahr (Texte) -> "YYYY-MM-DD" oder null, wenn unvollstaendig/unmoeglich. */
export function geburtsdatumIso(tag, monat, jahr) {
  const t = String(tag).trim(), m = String(monat).trim(), j = String(jahr).trim();
  if (!/^\d{1,2}$/.test(t) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(j)) return null;
  const iso = `${j}-${m.padStart(2, '0')}-${t.padStart(2, '0')}`;
  return parseIsoDate(iso) ? iso : null;
}

export function validateBirthDate(iso, now = new Date()) {
  if (!parseIsoDate(iso)) return 'Bitte geben Sie Ihr Geburtsdatum an, z. B. 12 · 04 · 1975.';
  if (iso < '1900-01-01') return 'Bitte prüfen Sie das Geburtsdatum.';
  if (iso > isoToday(now)) return 'Das Geburtsdatum darf nicht in der Zukunft liegen.';
  return null;
}

/** {date,time} -> "Di., 20.10.2026, 09:30 Uhr" (nur fuer den bestaetigten Termin). */
export function formatSlot(slot) {
  const p = parseIsoDate(slot?.date);
  if (!p) return '';
  const wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return `${WOCHENTAGE[wd]}, ${String(p.d).padStart(2, '0')}.${String(p.m).padStart(2, '0')}.${p.y}, ${slot.time} Uhr`;
}

/** "2026-10-20T09:30" -> {date,time} oder null */
export function splitLocalIso(s) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(s || ''));
  return m ? { date: m[1], time: m[2] } : null;
}

/* ---------- Regeln je Schritt (Fehlertexte oder null) ---------- */

export function validateName(wert, feld) {
  const s = String(wert || '').trim();
  if (s.length < 2) return `Bitte geben Sie Ihren ${feld} an.`;
  if (s.length > 60) return `Der ${feld} ist zu lang.`;
  if (/[<>\u0000-\u001f]/.test(s)) return `Der ${feld} enthält ungültige Zeichen.`;
  return null;
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

/** {email, telefon, kontakt} (Fehlertexte oder null). Mindestens eines ist Pflicht. */
export function validateContact(email, telefon) {
  const e = String(email || '').trim();
  const t = String(telefon || '').trim();
  const out = { email: null, telefon: null, kontakt: null };
  if (e && (e.length > 120 || !EMAIL.test(e))) out.email = 'Bitte prüfen Sie die E-Mail-Adresse.';
  if (t) {
    const ziffern = t.replace(/\D/g, '');
    if (!/^[0-9+()\/\-.\s]+$/.test(t) || ziffern.length < 6 || ziffern.length > 15) {
      out.telefon = 'Bitte prüfen Sie die Telefonnummer.';
    }
  }
  if (!e && !t) out.kontakt = 'Bitte geben Sie Telefon oder E-Mail an.';
  return out;
}

/** Schritt 1: Anliegen (nur wenn Karten sichtbar) und Versicherung. Gibt {feld: text}. */
export function pruefeSchritt1(z, mitAnliegen) {
  const f = {};
  if (mitAnliegen && !z.anliegen) f.anliegen = 'Bitte wählen Sie, was Sie möchten.';
  if (!z.zahlart || !zahlartOptionen(mitAnliegen ? z.anliegen : null).some((o) => o.key === z.zahlart)) {
    f.zahlart = 'Bitte wählen Sie Ihre Versicherung.';
  }
  return f;
}

/** Schritt 2: entweder flexibel oder mindestens ein Tag UND eine Tageszeit. */
export function pruefeSchritt2(z) {
  if (z.flexibel) return {};
  if (!z.tage.length && !z.zeiten.length) return { zeit: 'Bitte wählen Sie Tage und Tageszeit, oder „Ich bin zeitlich flexibel“.' };
  if (!z.tage.length) return { zeit: 'Bitte wählen Sie mindestens einen Wochentag.' };
  if (!z.zeiten.length) return { zeit: 'Bitte wählen Sie mindestens eine Tageszeit.' };
  return {};
}

/** Schritt 3: Name, Geburtsdatum, Kontakt. Reihenfolge der Schluessel = Reihenfolge im Formular. */
export function pruefeSchritt3(z, now = new Date()) {
  const f = {};
  const vor = validateName(z.vorname, 'Vornamen');
  const nach = validateName(z.nachname, 'Nachnamen');
  if (vor) f.vorname = vor;
  if (nach) f.nachname = nach;
  const geb = validateBirthDate(geburtsdatumIso(z.tag, z.monat, z.jahr), now);
  if (geb) f.geburtsdatum = geb;
  const k = validateContact(z.email, z.telefon);
  if (k.kontakt) f.kontakt = k.kontakt;
  if (k.telefon) f.telefon = k.telefon;
  if (k.email) f.email = k.email;
  return f;
}

/* ---------- Zusammenfassung ---------- */

const titelVon = (liste, key) => liste.find((x) => x.key === key)?.titel || '';

/**
 * Zeilen fuer Seitenleiste und Pruefen-Schritt, in der Reihenfolge der Schritte.
 * `step` sagt, wohin „Aendern“ springt. Leere optionale Zeilen entfallen, Pflichtzeilen
 * ohne Wert zeigen `leer: true` (Seitenleiste: „offen“).
 */
export function zusammenfassung(z, mitAnliegen) {
  const zeilen = [];
  if (mitAnliegen) {
    let a = ANLIEGEN.find((x) => x.key === z.anliegen)?.titel || '';
    if (a && z.hausbesuch) a += ' · Hausbesuch';
    zeilen.push({ key: 'anliegen', label: 'Anliegen', wert: a, step: 1 });
  } else if (z.hausbesuch) {
    zeilen.push({ key: 'anliegen', label: 'Anliegen', wert: 'Hausbesuch', step: 1 });
  }
  zeilen.push({ key: 'zahlart', label: 'Versicherung', wert: titelVon(ZAHLARTEN, z.zahlart), step: 1 });
  if (z.mitteilung.trim()) zeilen.push({ key: 'mitteilung', label: 'Mitteilung', wert: z.mitteilung.trim(), step: 1, optional: true });

  let zeit = '';
  if (z.flexibel) zeit = 'Ich bin zeitlich flexibel';
  else if (z.tage.length && z.zeiten.length) {
    const tage = TAGE.filter((t) => z.tage.includes(t.key)).map((t) => t.kurz).join(', ');
    const zeiten = TAGESZEITEN.filter((t) => z.zeiten.includes(t.key)).map((t) => t.text).join(', ');
    zeit = `${tage} · ${zeiten}`;
  }
  zeilen.push({ key: 'zeit', label: 'Zeiten', wert: zeit, step: 2 });
  if (z.dringlichkeit) zeilen.push({ key: 'dringlichkeit', label: 'Wie bald', wert: titelVon(DRINGLICHKEIT, z.dringlichkeit), step: 2, optional: true });
  if (z.anmerkung.trim()) zeilen.push({ key: 'anmerkung', label: 'Erreichbarkeit', wert: z.anmerkung.trim(), step: 2, optional: true });

  const name = [z.vorname.trim(), z.nachname.trim()].filter(Boolean).join(' ');
  const iso = geburtsdatumIso(z.tag, z.monat, z.jahr);
  const p = iso ? parseIsoDate(iso) : null;
  const fuer = [name, p ? `geb. ${String(p.d).padStart(2, '0')}.${String(p.m).padStart(2, '0')}.${p.y}` : ''].filter(Boolean).join(', ');
  zeilen.push({ key: 'person', label: 'Für wen', wert: z.fuerAndere && fuer ? `${fuer} (Angehörige/r füllt aus)` : fuer, step: 3 });
  if (z.erstbesuch) zeilen.push({ key: 'erstbesuch', label: 'Schon da gewesen', wert: z.erstbesuch === 'ja' ? 'Ja' : 'Nein, erster Besuch', step: 3, optional: true });
  zeilen.push({ key: 'kontakt', label: 'Kontakt', wert: [z.telefon.trim(), z.email.trim()].filter(Boolean).join(' · '), step: 3 });
  return zeilen;
}

/* ---------- Senden ---------- */

/**
 * Zustand -> Body fuer POST /booking-request/create. Der Server baut die Notiz selbst aus
 * den festen Optionen (api-backend/booking/widget-guards.js) — hier geht kein fertiger Text raus.
 */
export function buildPayload(z, { ownerId, mitAnliegen, honeypot = '' }) {
  const patient = {
    vorname: z.vorname.trim(),
    nachname: z.nachname.trim(),
    geburtsdatum: geburtsdatumIso(z.tag, z.monat, z.jahr),
  };
  if (z.email.trim()) patient.email = z.email.trim();
  if (z.telefon.trim()) patient.telefon = z.telefon.trim();
  const widget = {
    anliegen: mitAnliegen ? z.anliegen : null,
    hausbesuch: z.hausbesuch === true,
    flexibel: z.flexibel === true,
    tage: z.flexibel ? [] : z.tage,
    tageszeiten: z.flexibel ? [] : z.zeiten,
    dringlichkeit: z.dringlichkeit || null,
    erstbesuch: z.erstbesuch || null,
    mitteilung: z.mitteilung.trim().slice(0, MAX_MITTEILUNG),
    anmerkung: z.anmerkung.trim().slice(0, MAX_ANMERKUNG),
    fuerAndere: z.fuerAndere === true,
  };
  return { source: 'widget', owner_id: ownerId, payment_type: z.zahlart, patient, widget, website: honeypot };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Poll-Abstaende: 3 s, 6 s, 12 s, danach alle 30 s. */
export function pollDelay(versuch) {
  return [3000, 6000, 12000][versuch] ?? 30000;
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** apiBase aus /api/config: nur https, absoluter Pfad oder lokaler Entwicklungsserver. */
export function safeApiBase(wert) {
  const s = String(wert || '').trim().replace(/\/+$/, '');
  if (/^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(s)) return s;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[^\s]*)?$/.test(s)) return s;
  if (/^\/[^\s/][^\s]*$/.test(s)) return s;
  return null;
}
