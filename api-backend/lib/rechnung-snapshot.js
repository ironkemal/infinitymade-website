/**
 * rechnung-snapshot.js — Aussteller/Empfänger einer Rechnung wie gedruckt (Migration 0075), Serverseite.
 *
 * Spiegel von `module/branding.js` (brandingAus → ausstellerSnapshot) und `module/bg-angaben.js`
 * (empfaengerSnapshot). Zwei Dateien, weil `api-backend/` ein eigenes Image mit ausdrücklicher COPY-Liste ist
 * und nichts oberhalb seines Verzeichnisses importieren kann (wie `lib/geschlecht.js`). Wer hier etwas ändert,
 * ändert es dort mit — `module/rechnung-snapshot.test.js` vergleicht beide Seiten.
 *
 * Gedacht für die Server-Renderings (RE-/ZU-/Ausfallrechnung, Mahnung), die heute fünf eigene Aussteller-
 * Blöcke bauen (`abrechnung.routes.js`, `ausfall.routes.js`, `mahnwesen.routes.js`) — Umstellung ist ein
 * eigener Schritt (KUTU_HAZIRLIK_SPRINT.md §4, Rechnungs-Snapshot (v)).
 */

const t = (w) => String(w ?? '').trim();
const n = (w) => t(w) || null;

/** Spiegel von module/branding.js ausstellerSnapshot — Profilzeile der PRAXIS → Aussteller-Snapshot. */
export function ausstellerSnapshot(p) {
  const x = p || {};
  const plz = t(x.plz) || t(x.zip);
  const ort = t(x.city);
  return {
    v: 1,
    name: t(x.business_name),
    inhaber: t(x.praxis_inhaber) || [t(x.owner_first_name), t(x.owner_last_name)].filter(Boolean).join(' '),
    strasse: [t(x.street), t(x.house_number)].filter(Boolean).join(' '),
    plzOrt: [plz, ort].filter(Boolean).join(' '),
    telefon: t(x.phone), email: t(x.email), ik: t(x.ik_number),
    bank: { name: t(x.bank_name), iban: t(x.iban), bic: t(x.bic) },
  };
}

/**
 * Praxis-Kopf der Server-Renderings (RE-/ZU-/Ausfallrechnung, Mahnung) aus ausstellerSnapshot — eine
 * Normalisierung statt vier eigener Blöcke (PLZ `plz|zip`, Hausnummer, Praxis-E-Mail). `ersatzEmail` nur,
 * wenn der Inhaber selbst druckt: die Login-Adresse eines Mitarbeiters gehört nicht auf den Beleg.
 * Nur serverseitig (kein Gegenstück im Frontend, das liest den Snapshot direkt).
 */
export function praxisKopf(p, { ersatzEmail = '' } = {}) {
  const a = ausstellerSnapshot(p);
  return {
    name: a.name || 'Praxis', strasse: a.strasse, plz_ort: a.plzOrt, telefon: a.telefon, ik: a.ik,
    email: a.email || t(ersatzEmail),
  };
}

const deutsch = (iso) => {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso ?? '');
};

/** Spiegel von module/bg-angaben.js empfaengerSnapshot — leads- + prescriptions-Zeile → Empfänger-Snapshot. */
export function empfaengerSnapshot({ patient = null, rx = null, invoiceType = null } = {}) {
  const name = patient ? ([n(patient.first_name), n(patient.last_name)].filter(Boolean).join(' ') || n(patient.title) || '') : '';
  if (invoiceType === 'bg' && rx?.rezeptart === 'bg' && n(rx.bg_traeger_name)) {
    const empfaenger = [n(rx.bg_traeger_name), ...String(n(rx.bg_traeger_anschrift) || '').split(/\r?\n/).map((z) => z.trim()).filter(Boolean)]
      .filter(Boolean);
    const unfalltag = rx.bg_unfalltag == null ? null : n(String(rx.bg_unfalltag).slice(0, 10));
    const aktenzeichen = n(rx.bg_aktenzeichen);
    const bezug = [];
    if (name) bezug.push(`Versicherte Person: ${name}${patient?.geburtsdatum ? ` (geb. ${deutsch(patient.geburtsdatum)})` : ''}`);
    if (unfalltag) bezug.push(`Unfalltag: ${deutsch(unfalltag)}`);
    if (aktenzeichen) bezug.push(`Aktenzeichen: ${aktenzeichen}`);
    return { v: 1, art: 'bg', empfaenger, bezug };
  }
  if (!name) return null;
  return {
    v: 1, art: 'patient', name,
    strasse: n(patient.street), plzOrt: [n(patient.plz), n(patient.city)].filter(Boolean).join(' ') || null,
    geburtsdatum: patient.geburtsdatum ? String(patient.geburtsdatum).slice(0, 10) : null,
    krankenkasse: n(patient.krankenkasse), versichertennummer: n(patient.versichertennummer),
  };
}
