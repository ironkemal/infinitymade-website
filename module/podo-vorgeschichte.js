/**
 * podo-vorgeschichte.js — Vorgeschichte eines Patienten aus dem Altsystem.
 *
 * Warum (VO-Import Schritt 2, Kemal 21.10.2026; Regeln gkv-302, Schema 0086):
 * die Einmaligkeitsregeln (eingangsbefundung-regel.js: darf78040, darf78100,
 * darfErstbefundungNagel) sehen nur Praxura-Behandlungen. Ein Patient, der im
 * Altsystem schon behandelt wurde, bekäme sonst 78040 bzw. eine Erstbefundung
 * erneut angeboten — Absetzung. Die Vorgeschichte steht in `leads.podo_vorgeschichte_*`
 * und wird hier zu Pseudo-Behandlungen in genau der Form, die die Regeln lesen.
 * Es entstehen KEINE Zeilen in `podologie_behandlungen` (db-ustasi).
 *
 * Nur Daten von VOs, die das Altsystem SELBST abgerechnet hat — Tage einer
 * übernommenen VO werden als Behandlungszeile nachgetragen, sonst sperrt sich
 * die eigene 78040 selbst (gkv-302).
 */

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
export const NAEGEL = ['U1 links', 'U2 links', 'U3 links', 'U4 links', 'U5 links',
  'U1 rechts', 'U2 rechts', 'U3 rechts', 'U4 rechts', 'U5 rechts'];   // Spiegel von prescriptions_nagel_check

const tag = (d) => (DATUM.test(String(d || '').slice(0, 10)) ? String(d).slice(0, 10) : null);

/**
 * @param {object} lead  Zeile aus `leads` mit den podo_vorgeschichte_*-Spalten
 * @returns {Array<{behandlungsdatum:string, hpnr_codes:string[], nagel:?string, vorgeschichte:true}>}
 */
export function vorgeschichteAlsBehandlungen(lead) {
  if (!lead) return [];
  const out = [];
  const add = (am, codes, nagel = null) => { const d = tag(am); if (d) out.push({ behandlungsdatum: d, hpnr_codes: codes, nagel, vorgeschichte: true }); };
  // Erste Behandlung: zählt für „nicht die erste Behandlung" (78040-Anspruch), ohne Code.
  add(lead.podo_vorgeschichte_erste_beh_am, []);
  add(lead.podo_vorgeschichte_78040_am, ['78040']);
  add(lead.podo_vorgeschichte_78100_am, ['78100']);
  const naegel = lead.podo_vorgeschichte_naegel && typeof lead.podo_vorgeschichte_naegel === 'object' ? lead.podo_vorgeschichte_naegel : {};
  for (const [nagel, v] of Object.entries(naegel)) {
    if (!NAEGEL.includes(nagel) || !v) continue;
    const code = ['78100', '78110'].includes(v.erstbefundung?.code) ? v.erstbefundung.code : null;
    if (code) add(v.erstbefundung.am, [code], nagel);
    add(v.abschluss_78520_am, ['78520'], nagel);
  }
  return out;
}

/**
 * Vorgeschichte des Patienten laden und gleich in Pseudo-Behandlungen umsetzen.
 * Eine Abfrage für alle vier Historien-Lader (Abrechnung, Rezeptmaske, Termin-Einheiten,
 * Befundungsvorschlag) — fonksiyon-ustasi 21.10.2026: nur einer sah die Vorgeschichte,
 * die anderen boten dem Altsystem-Patienten weiter 78040 an.
 * @returns {Promise<Array>} [] ohne Patient/Treffer
 */
export async function ladeVorgeschichte(sb, { ownerId, leadId }) {
  if (!sb || !ownerId || !leadId) return [];
  const { data } = await sb.from('leads')
    .select('podo_vorgeschichte_erste_beh_am, podo_vorgeschichte_78040_am, podo_vorgeschichte_78100_am, podo_vorgeschichte_naegel')
    .eq('id', leadId).eq('owner_id', ownerId).maybeSingle();
  return vorgeschichteAlsBehandlungen(data);
}

/**
 * Prüft und normalisiert Eingaben für die Vorgeschichte (Import, Formular).
 * @returns {{werte: object, fehler: string[]}}  `werte` nur mit gültigen Feldern
 */
export function pruefeVorgeschichte({ ersteBeh, am78040, am78100, naegel } = {}, heute = new Date().toISOString().slice(0, 10)) {
  const fehler = [];
  const d = (roh, name) => {
    if (roh == null || roh === '') return null;
    const t = tag(roh);
    if (!t) { fehler.push(`${name}: Datum nicht lesbar`); return null; }
    if (t > heute) { fehler.push(`${name}: liegt in der Zukunft`); return null; }
    return t;
  };
  const werte = {};
  const e = d(ersteBeh, 'Erste Behandlung'); if (e) werte.podo_vorgeschichte_erste_beh_am = e;
  const a = d(am78040, '78040'); if (a) werte.podo_vorgeschichte_78040_am = a;
  const b = d(am78100, 'Letzte 78100'); if (b) werte.podo_vorgeschichte_78100_am = b;
  if (e && a && a < e) fehler.push('78040 liegt vor der ersten Behandlung');
  const n = {};
  for (const [nagel, v] of Object.entries(naegel || {})) {
    if (!NAEGEL.includes(nagel)) { fehler.push(`Nagel „${nagel}" unbekannt`); continue; }
    const eb = v?.erstbefundung?.code ? { code: String(v.erstbefundung.code), am: d(v.erstbefundung.am, `${nagel} Erstbefundung`) } : null;
    if (eb && !['78100', '78110'].includes(eb.code)) { fehler.push(`${nagel}: Erstbefundung muss 78100 oder 78110 sein`); continue; }
    const ab = d(v?.abschluss_78520_am, `${nagel} Abschluss 78520`);
    const eintrag = {};
    if (eb?.am) eintrag.erstbefundung = eb;
    if (ab) eintrag.abschluss_78520_am = ab;
    if (Object.keys(eintrag).length) n[nagel] = eintrag;
  }
  if (Object.keys(n).length) werte.podo_vorgeschichte_naegel = n;
  if (Object.keys(werte).length) werte.podo_vorgeschichte_erfasst_am = new Date().toISOString();
  return { werte, fehler };
}
