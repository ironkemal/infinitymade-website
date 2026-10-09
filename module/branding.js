/**
 * branding.js — EINE Quelle für das Erscheinungsbild der Praxis auf Belegen (KHS M2.4, PE-006).
 *
 * Vorher baute jeder Beleg sein Praxis-Objekt selbst (`rechnung-ansicht`, `terminzettelPraxis`,
 * `beleg-druck`, Backend-PDFs) — mit verschiedenen Feldnamen (`plz` vs `zip`, `ort` vs `plz_ort`)
 * und, bei Mitarbeitern, aus dem LEEREN eigenen Profil. Diese Datei nimmt IMMER das Profil
 * der Praxis (Aufrufer: `ownerProfile || currentProfile`) und liefert ein einheitliches Objekt.
 *
 * Reine Funktionen, kein DOM, kein Netz.
 *
 * Sicherheit: `logoUrl` nur https (Freitextfeld `praxis_logo_url` nimmt beliebige URLs, S-49);
 * `stempelPfad` nur `<uuid>/stempel.png|jpg` — nie eine URL (S-47: der Stempel liegt im privaten
 * Bucket und wird beim Belegbau eingebettet, nicht verlinkt).
 */

export const STEMPEL_PFAD_RE = /^[0-9a-f-]{36}\/stempel\.(png|jpg)$/;

/**
 * Die Profilspalten, die ein MITARBEITER von der Praxis (Owner-Zeile) lesen muss, damit Belege
 * vollständig sind — bewusst eine Liste statt `*`: Stripe-IDs & Co. gehören nicht in den Browser
 * eines Mitarbeiters. Der Mitarbeiter-Weg in dashboard.js (`ownerProfile`) lud bisher nur
 * `sector,plan,plan_status,selbstzahler_stufen` — Belege liefen dort mit leerem Kopf.
 */
export const BRANDING_SPALTEN = 'business_name,praxis_inhaber,owner_first_name,owner_last_name,street,house_number,plz,zip,city,'
  + 'phone,whatsapp_number,email,ik_number,praxis_logo_url,praxis_stempel_path,invoice_footer_text,iban,bic,bank_name,'
  + 'steuernummer,ust_id,tax_exempt_note';

const t = (w) => String(w ?? '').trim();

/**
 * Nur https, ≤500 Zeichen, ohne Leer-/Steuerzeichen — sonst ''. Der DB-CHECK (0069/0073)
 * hält javascript: & Co. fern; hier wird VOR dem href noch einmal geprüft (onprem O-181 i,
 * Box-Kopien könnten abweichen). Auch für praxis_impressum_url/praxis_datenschutz_url (K2b.15).
 */
export const httpsUrl = (w) => {
  const u = t(w);
  if (!u || u.length > 500 || /[\s\u0000-\u001f\u007f]/.test(u)) return '';
  try { return new URL(u).protocol === 'https:' ? u : ''; } catch { return ''; }
};

/** Profilzeile -> einheitliches Branding-Objekt. */
export function brandingAus(p) {
  const x = p || {};
  const strasse = [t(x.street), t(x.house_number)].filter(Boolean).join(' ');
  const plz = t(x.plz) || t(x.zip);   // beide Spalten existieren (Altlast)
  const ort = t(x.city);
  const pfad = t(x.praxis_stempel_path);
  return {
    name: t(x.business_name),
    // `praxis_inhaber` (ausdrücklich gesetzt) hat Vorrang; sonst die Namen aus dem Einrichtungsassistenten.
    inhaber: t(x.praxis_inhaber) || [t(x.owner_first_name), t(x.owner_last_name)].filter(Boolean).join(' '),
    strasseName: t(x.street), strasse, plz, ort, plzOrt: [plz, ort].filter(Boolean).join(' '),
    telefon: t(x.phone), whatsapp: t(x.whatsapp_number), email: t(x.email),
    ik: t(x.ik_number),
    logoUrl: httpsUrl(x.praxis_logo_url),
    stempelPfad: STEMPEL_PFAD_RE.test(pfad) ? pfad : '',
    fusszeile: t(x.invoice_footer_text),
    bank: { iban: t(x.iban), bic: t(x.bic), name: t(x.bank_name) },
    steuer: { steuernummer: t(x.steuernummer), ustId: t(x.ust_id), hinweis: t(x.tax_exempt_note) },
  };
}

/**
 * Aussteller-Block der Rechnung, eingefroren beim Entwurfsspeichern (`invoices.aussteller_snapshot`, Migration 0075;
 * § 147 Abs. 2 Nr. 1 AO, § 14 Abs. 4 Nr. 1 UStG — legal-de/gkv-302 09.10.2026). Nur was gedruckt wird
 * (Art. 5 Abs. 1 lit. c DSGVO); Steuernummer/USt-IdNr. haben eigene Snapshot-Spalten.
 * Spiegel: `api-backend/lib/rechnung-snapshot.js` (Paritätstest `module/rechnung-snapshot.test.js`).
 * @param {object} p  Profilzeile der PRAXIS (`ownerProfile || currentProfile`)
 */
export function ausstellerSnapshot(p) {
  const b = brandingAus(p);
  return {
    v: 1, name: b.name, inhaber: b.inhaber, strasse: b.strasse, plzOrt: b.plzOrt,
    telefon: b.telefon, email: b.email, ik: b.ik, bank: { name: b.bank.name, iban: b.bank.iban, bic: b.bank.bic },
  };
}

/** Der bisherige Vertrag von `terminzettelPraxis()` (dashboard.js) — Termin- und Behandlungsbeleg. */
export function terminzettelPraxis(b) {
  return {
    praxis: {
      name: b.name, strasse: b.strasse, ort: b.plzOrt,
      telefon: b.telefon || b.whatsapp,
      iban: b.bank.iban, bic: b.bank.bic, bank: b.bank.name,
    },
  };
}

const ZIEL = 'settingsBrandingSection';

/**
 * Was fehlt? Pflicht = § 14 Abs. 4 UStG (legal-de F7, 05.10.2026), Soll = praktisch nötig,
 * optional = Optik. `ziel` ist die Einstellungs-Stelle (Sprung vom Fortschrittsring, M2.6).
 */
export function brandingLuecken(b) {
  const pflicht = []; const soll = []; const optional = [];
  const f = (liste, schluessel, label, ziel = ZIEL) => liste.push({ schluessel, label, ziel });
  if (!b.name) f(pflicht, 'name', 'Praxisname', 'settingsProfileSection');
  if (!b.strasseName || !b.plz || !b.ort) f(pflicht, 'anschrift', 'Praxisanschrift', 'settingsProfileSection');
  if (!b.inhaber) f(pflicht, 'inhaber', 'Name der Inhaberin / des Inhabers');
  if (!b.steuer.steuernummer && !b.steuer.ustId) f(pflicht, 'steuer_id', 'Steuernummer oder USt-IdNr.', 'settingsBillingSection');
  if (!b.steuer.hinweis) f(pflicht, 'steuer_hinweis', 'Hinweis zur Steuerbefreiung', 'settingsBillingSection');
  if (!b.bank.iban) f(soll, 'bank', 'Bankverbindung (IBAN)', 'settingsBillingSection');
  if (!b.telefon) f(soll, 'telefon', 'Telefonnummer', 'settingsProfileSection');
  if (!b.ik) f(soll, 'ik', 'Institutionskennzeichen (IK)', 'settingsBillingSection');
  if (!b.logoUrl) f(optional, 'logo', 'Praxis-Logo');
  if (!b.stempelPfad) f(optional, 'stempel', 'Praxisstempel');
  if (!b.fusszeile) f(optional, 'fusszeile', 'Fußzeile');
  return { pflicht, soll, optional };
}
