// Anliegen-Auswahl der oeffentlichen Terminanfrage (booking-request.html) — Podologie.
//
// Warum: Reform-Sprint S4 („Online-Anfrage: Patient waehlt den Grund"). Ein
// Podologie-Patient weiss nicht, was „GKV / PKV / BG" fuer seinen Besuch heisst;
// er weiss, ob er ein Rezept hat, ob er zum ersten Mal kommt, ob er einen
// Hausbesuch braucht. Aus dem Anliegen folgen die erlaubten Zahlungsarten
// (Verordnung -> GKV/PKV/BG, Nagelspange/Fusspflege -> Selbstzahler) und ob eine
// Adresse Pflicht ist (Hausbesuch).
//
// Wohin gespeichert: `booking_requests` hat keine Anliegen-Spalte. Ohne Schema-
// aenderung geht der Grund als erste Zeile in `notizen` (max. 500 Zeichen, die
// Praxis sieht sie im Anfragen-Detail). Reine Funktionen, kein DOM.

export const ANLIEGEN = [
  { key: 'verordnung', titel: 'Mit Verordnung', hinweis: 'Ich habe ein Rezept (Verordnung) vom Arzt', zahlung: ['gkv', 'pkv', 'bg'] },
  { key: 'erst', titel: 'Erstbehandlung / Beratung', hinweis: 'Ich komme zum ersten Mal, ohne Rezept', zahlung: ['selbstzahler', 'pkv'] },
  { key: 'hausbesuch', titel: 'Hausbesuch', hinweis: 'Die Behandlung soll bei mir zu Hause stattfinden', zahlung: ['gkv', 'pkv', 'selbstzahler', 'bg'], adressePflicht: true },
  { key: 'nagelspange', titel: 'Nagelspange', hinweis: 'Spangenbehandlung bei eingewachsenem Nagel', zahlung: ['selbstzahler'] },
  { key: 'fusspflege', titel: 'Medizinische Fußpflege (Selbstzahler)', hinweis: 'Ohne Rezept, ich zahle selbst', zahlung: ['selbstzahler'] },
];

const ALLE_ZAHLUNG = ['gkv', 'pkv', 'selbstzahler', 'bg'];

/** Das Anliegen-Feld gibt es nur fuer Podologie; andere Fachbereiche bleiben unveraendert. */
export function anliegenFuerBereich(bereich) {
  return String(bereich || '').toLowerCase().startsWith('podolog') ? ANLIEGEN : [];
}

export function findAnliegen(key) {
  return ANLIEGEN.find(a => a.key === key) || null;
}

/** Erlaubte Zahlungsarten; ohne Anliegen alle vier (bisheriges Verhalten). */
export function zahlungsartenFuer(key) {
  return findAnliegen(key)?.zahlung || ALLE_ZAHLUNG;
}

export function adressePflicht(key) {
  return findAnliegen(key)?.adressePflicht === true;
}

/**
 * notizen-Text: „Anliegen: Hausbesuch — Adresse: …" als erste Zeile, darunter die
 * freie Notiz des Patienten. Auf 500 Zeichen gekuerzt (Server-Grenze); die Kopfzeile
 * bleibt immer vollstaendig, gekuerzt wird der freie Text.
 */
export function anliegenNotiz(key, adresse, frei, max = 500) {
  const a = findAnliegen(key);
  const rest = String(frei || '').trim();
  if (!a) return rest || null;
  let kopf = `Anliegen: ${a.titel}`;
  const adr = String(adresse || '').replace(/\s+/g, ' ').trim();
  if (a.adressePflicht && adr) kopf += ` — Adresse: ${adr}`;
  kopf = kopf.slice(0, max);
  if (!rest) return kopf;
  return `${kopf}\n${rest}`.slice(0, max);
}
