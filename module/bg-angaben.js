/**
 * bg-angaben.js — BG-/Arbeitsunfall-Verordnung (Podologie), KHS M2.2, PE-006 B.
 *
 * Nur belegte Angaben (gkv-302/legal-de/podoloji, 05.10.2026): UV-Träger =
 * Rechnungsempfänger, Unfalltag, Aktenzeichen (optional, Freitext — kein Format
 * erfinden), Kostenzusage, Einverständnis zur Übermittlung. KEINE Diagnose,
 * KEINE festen BG-Preise, keine Unfallmeldung. BG läuft nie über §302/DTA.
 *
 * Pflicht gilt erst beim ERSTELLEN DER RECHNUNG (Träger + Anschrift + Unfalltag);
 * beim Speichern der Verordnung wird nur gewarnt (warnen, nicht blockieren).
 * Spiegel der Spaltenliste: `api-backend/lib/rezept-felder.js` (bgFelderAusRezept).
 *
 * Reine Funktionen (kein DOM) — die Maske verdrahtet `module/verordnung-maske.js`.
 */

export const BG_FELDER = [
  { key: 'traeger_name',         id: 'rzBgTraegerName',     label: 'UV-Träger (Name)' },
  { key: 'traeger_anschrift',    id: 'rzBgTraegerAnschrift', label: 'UV-Träger (Anschrift)', mehrzeilig: true },
  { key: 'unfalltag',            id: 'rzBgUnfalltag',       label: 'Unfalltag', datum: true },
  { key: 'aktenzeichen',         id: 'rzBgAktenzeichen',    label: 'Aktenzeichen' },
  { key: 'kostenzusage_datum',   id: 'rzBgKostenzusageDatum', label: 'Kostenzusage (Datum)', datum: true },
  { key: 'kostenzusage_zeichen', id: 'rzBgKostenzusageZeichen', label: 'Kostenzusage (Zeichen)' },
  { key: 'einverstaendnis_am',   id: 'rzBgEinverstaendnis', label: 'Einverständnis zur Übermittlung', datum: true },
];

/** Version des Wortlauts unten — wird mit dem Einverständnis-Datum gespeichert (Nachweis: WELCHEM Text zugestimmt wurde). */
export const EINVERSTAENDNIS_VERSION = 'bg-einverstaendnis-v1-2026-10-05';

/** Wortlaut legal-de 05.10.2026 (compliance/LEGAL_DECISIONS.md, F1). */
export const EINVERSTAENDNIS_TEXT =
  'Ich bin damit einverstanden, dass die Praxis die für die Abrechnung erforderlichen Angaben zu meiner Behandlung '
  + '(Name, Geburtsdatum, Unfalltag, Behandlungsdaten und -leistungen) an den zuständigen Unfallversicherungsträger '
  + 'übermittelt und diesem auf Anforderung die zur Prüfung erforderlichen Auskünfte erteilt (§ 100 SGB X). '
  + 'Ohne dieses Einverständnis kann die Behandlung nur privat abgerechnet werden.';

const t = (w) => { const x = String(w ?? '').trim(); return x || null; };

/** Rohwerte (z. B. aus den Feldern) -> getrimmte Angaben, leer = null. */
export function bgAusWerte(werte = {}) {
  const out = {};
  for (const f of BG_FELDER) out[f.key] = t(werte[f.key]);
  return out;
}

/** Was für die Rechnung fehlt — Pflicht: Träger (Name + Anschrift) und Unfalltag. */
export function bgFehltFuerRechnung(bg = {}) {
  const b = bgAusWerte(bg);
  const fehlt = [];
  if (!b.traeger_name) fehlt.push('UV-Träger (Name)');
  if (!b.traeger_anschrift) fehlt.push('UV-Träger (Anschrift)');
  if (!b.unfalltag) fehlt.push('Unfalltag');
  return fehlt;
}

/** Hinweise beim Speichern der Verordnung (Liste „noch leer") — blockiert nie. */
export function bgHinweiseBeimSpeichern(bg = {}) {
  const b = bgAusWerte(bg);
  const h = bgFehltFuerRechnung(b).map((x) => `BG: ${x}`);
  if (!b.kostenzusage_datum) h.push('BG: Kostenzusage (Datum)');
  if (!b.einverstaendnis_am) h.push('BG: Einverständnis zur Übermittlung');
  return h;
}

const deutsch = (iso) => {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso ?? '');
};

/**
 * Der Empfängerblock für die BG-Rechnung: Träger als Rechnungsempfänger, darunter
 * die Bezugszeilen (Versicherte Person, Unfalltag, Aktenzeichen). Die Diagnose
 * steht bewusst NICHT darin (legal-de: keine Befunde auf der BG-Rechnung).
 *
 * @returns {{empfaenger: string[], bezug: string[]}}
 */
export function bgEmpfaengerBlock(bg = {}, { patientName = '', geburtsdatum = null } = {}) {
  const b = bgAusWerte(bg);
  const empfaenger = [b.traeger_name, ...String(b.traeger_anschrift || '').split(/\r?\n/).map((z) => z.trim()).filter(Boolean)]
    .filter(Boolean);
  const bezug = [];
  if (patientName) bezug.push(`Versicherte Person: ${patientName}${geburtsdatum ? ` (geb. ${deutsch(geburtsdatum)})` : ''}`);
  if (b.unfalltag) bezug.push(`Unfalltag: ${deutsch(b.unfalltag)}`);
  if (b.aktenzeichen) bezug.push(`Aktenzeichen: ${b.aktenzeichen}`);
  return { empfaenger, bezug };
}

/**
 * Empfänger-Block der Rechnung, eingefroren beim Entwurfsspeichern (`invoices.empfaenger_snapshot`, Migration 0075).
 * BG-Rechnung (Typ bg + BG-Verordnung mit Träger): UV-Träger + Bezugszeilen wie `bgEmpfaengerBlock`;
 * sonst die Patientin / der Patient aus der Akte. Nur gedruckte Felder — kein IBAN, keine Diagnose.
 * Spiegel: `api-backend/lib/rechnung-snapshot.js`.
 * @param {{patient?: ?object, rx?: ?object, invoiceType?: ?string}} q  patient = `leads`-Zeile, rx = `prescriptions`-Zeile
 * @returns {?object}  null, wenn kein Patient verknüpft ist
 */
export function empfaengerSnapshot({ patient = null, rx = null, invoiceType = null } = {}) {
  const name = patient ? ([t(patient.first_name), t(patient.last_name)].filter(Boolean).join(' ') || t(patient.title) || '') : '';
  if (invoiceType === 'bg' && rx?.rezeptart === 'bg' && t(rx.bg_traeger_name)) {
    const blk = bgEmpfaengerBlock(bgAusZeile(rx), { patientName: name, geburtsdatum: patient?.geburtsdatum || null });
    return { v: 1, art: 'bg', empfaenger: blk.empfaenger, bezug: blk.bezug };
  }
  if (!name) return null;
  return {
    v: 1, art: 'patient', name,
    strasse: t(patient.street), plzOrt: [t(patient.plz), t(patient.city)].filter(Boolean).join(' ') || null,
    geburtsdatum: patient.geburtsdatum ? String(patient.geburtsdatum).slice(0, 10) : null,
    krankenkasse: t(patient.krankenkasse), versichertennummer: t(patient.versichertennummer),
  };
}

/** Maske -> Angaben (nur lesen). */
export function bgAusMaske(doc) {
  const w = {};
  for (const f of BG_FELDER) w[f.key] = doc.getElementById(f.id)?.value;
  const b = bgAusWerte(w);
  // Zum Datum gehört die Version des Wortlauts (legal-de 06.10.2026) — ohne Datum keine Version.
  return { ...b, einverstaendnis_version: b.einverstaendnis_am ? EINVERSTAENDNIS_VERSION : null };
}

/** Zeile aus `prescriptions` -> Maske (leert, wenn die Spalten fehlen). */
export function bgInMaske(doc, rx = {}) {
  for (const f of BG_FELDER) {
    const el = doc.getElementById(f.id);
    if (!el) continue;
    const roh = rx?.['bg_' + f.key];
    el.value = roh == null ? '' : (f.datum ? String(roh).slice(0, 10) : String(roh));
  }
}

/** Zeile aus `prescriptions` (Spalten `bg_*`) -> Angaben. */
export function bgAusZeile(rx = {}) {
  const w = {};
  for (const f of BG_FELDER) w[f.key] = rx?.['bg_' + f.key];
  return bgAusWerte(Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v == null ? v : String(v).slice(0, f10(k) ? 10 : undefined)])));
}
const f10 = (key) => !!BG_FELDER.find(f => f.key === key)?.datum;

/**
 * Hinweis an der Verordnungszeile VOR der Behandlung (podoloji 06.10.2026): ohne Kostenzusage
 * zahlt die BG nicht (ZFD-Merkblatt) — und bei der Rechnung ist die Behandlung schon erbracht.
 * Warnt, blockiert nie. `v` = Verordnungszeile (Spalten `bg_*`, Alias aus `ausTopf` bleiben erhalten).
 * @returns {?string}
 */
export function bgKostenzusageHinweis(v) {
  if (String(v?.rezeptart ?? '').trim().toLowerCase() !== 'bg') return null;
  return String(v?.bg_kostenzusage_datum ?? '').trim() ? null : 'Kostenzusage der BG fehlt — vor der Behandlung einholen';
}

/**
 * Hinweise beim ERSTELLEN der BG-Rechnung, die nicht blockieren (legal-de 06.10.2026): ohne dokumentiertes
 * Einverständnis legt die Rechnung Angaben ohne nachweisbare Befugnis offen (§ 203 StGB / § 100 SGB X);
 * ohne Kostenzusage zahlt die BG womöglich nicht.
 */
export function bgHinweiseBeiRechnung(bg = {}) {
  const b = bgAusWerte(bg);
  const h = [];
  if (!b.einverstaendnis_am) h.push('Einverständnis zur Übermittlung an den UV-Träger nicht erfasst');
  if (!b.kostenzusage_datum) h.push('Kostenzusage der BG nicht erfasst');
  return h;
}
