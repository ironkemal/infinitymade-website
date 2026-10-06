/**
 * rezeptart.js — die vier Verordnungsarten, ohne DOM und ohne Netz.
 *
 * Entscheidung: Podoloji/PRODUKT-ENTSCHEIDUNGEN.md PE-006 A (05.10.2026, KHS M2.1;
 * baut auf den Entscheidungen vom 10.08. und 28.09.2026 auf).
 *
 * Ein Schreibwert für „Kasse": `kassen`. `gkv` (frühere Maske) und NULL
 * (Altzeilen, `POST /rezept/confirm` schrieb die Spalte nie) werden beim LESEN
 * toleriert und als Kasse behandelt — beim SCHREIBEN nie mehr.
 * Der §302-Guard im Backend (`rezeptart && rezeptart !== 'kassen'`) lässt NULL
 * als Kasse durch; deshalb darf ein Wert hier nie still auf `kassen` kippen,
 * der etwas anderes meint (Unbekanntes -> kassen entspricht dem Altverhalten,
 * ein Wert wird aber nie zu `bg` geraten).
 */

export const REZEPTARTEN = ['kassen', 'privat', 'selbstzahler', 'bg'];

const LABEL = {
  kassen: 'Kasse (GKV)',
  privat: 'Privat (PKV/Beihilfe)',
  selbstzahler: 'Selbstzahler',
  bg: 'BG / Unfallkasse',
};

const ALIAS = { gkv: 'kassen', kasse: 'kassen', pkv: 'privat' };

/** Beliebigen Rohwert (Spalte, Maske, Altwert) auf eine der vier Arten abbilden. */
export function normalisiereRezeptart(wert) {
  const w = String(wert ?? '').trim().toLowerCase();
  if (!w) return 'kassen';
  if (REZEPTARTEN.includes(w)) return w;
  return ALIAS[w] || 'kassen';
}

export function rezeptartLabel(wert) { return LABEL[normalisiereRezeptart(wert)]; }
export function istKasse(wert) { return normalisiereRezeptart(wert) === 'kassen'; }
export function istBg(wert) { return normalisiereRezeptart(wert) === 'bg'; }

/** Nur bei Kasse sind Krankenkasse, Diagnosegruppe & Co. Pflicht (sonst eingeklappt). */
export function brauchtGkvAngaben(wert) { return istKasse(wert); }

/**
 * Vorauswahl aus `leads.insurance_type` — einseitig: nur `privat` wird
 * vorgewählt. Selbstzahler und BG nie (BG hängt am Unfall, nicht am Patienten).
 */
export function vorauswahlAusPatient(insuranceType) {
  return String(insuranceType ?? '').trim().toLowerCase() === 'privat' ? 'privat' : 'kassen';
}

/**
 * Darf die Art noch umgeschaltet werden? `null` = ja, sonst die deutsche Meldung.
 * Bedingung 1 = Trigger `prescriptions_festschreibung` (0020: ab `belegnummer`).
 * Bedingung 2 geht darüber hinaus: eine nicht stornierte Rechnung zur
 * Verordnung — sonst würde still doppelt abgerechnet (Patient/BG UND Kasse).
 * Das Backend erzwingt dasselbe (PATCH /api/rezept/:id).
 */
export function umschaltSperre({ belegnummer = null, offeneRechnung = false } = {}) {
  if (belegnummer) {
    return `Die Verordnung wurde bereits an die Kasse übermittelt (Beleg ${belegnummer}) — die Art lässt sich nicht mehr ändern.`;
  }
  if (offeneRechnung) {
    return 'Zu dieser Verordnung gibt es eine Rechnung. Bitte zuerst die Rechnung stornieren, danach lässt sich die Art ändern.';
  }
  return null;
}

/** FK `verordnungen_diagnosegruppe_fkey`: leer heisst NULL, nie ''. */
export function diagnosegruppeFuerSpeichern(wert) {
  const t = String(wert ?? '').trim();
  return t || null;
}

/** Was beim Anlegen/Ändern in die Spalte geschrieben wird — immer ausdrücklich. */
export function rezeptartFuerSpeichern(wert) { return normalisiereRezeptart(wert); }
