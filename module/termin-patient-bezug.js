/**
 * termin-patient-bezug.js — welcher Patient gehört zu diesem Termin?
 *
 * Warum es das gibt
 * ─────────────────
 * Ein Termin zeigt auf seinen Patienten über `bookings.lead_id`. Diese Spalte
 * war jahrelang optional, und mehrere Buchungswege haben sie schlicht nicht
 * gefüllt — die Serientermine zum Beispiel (`/booking/batch-create*`) legten
 * bis 17.08.2026 jede Zeile ohne `lead_id` an. Von 274 Terminen hatten 50
 * keinen Patientenbezug; bei 17 von 18 kommenden Terminen fehlte er.
 *
 * Sichtbar wurde das an zwei Stellen, die beide „einfach nichts" taten:
 *   – der Fußbefund-Knopf im Seitenbereich blieb unsichtbar (er braucht eine
 *     Patientenakte, an der der Befund hängt),
 *   – der Terminzettel druckte nur den einen angeklickten Termin, weil er ohne
 *     `lead_id` auf einen Textvergleich `customer_name` zurückfiel und der
 *     schon an „Klaus Fischer" vs. „Klaus Fischer · 1972-07-23" scheitert.
 *
 * Der Bezug wurde im Projekt fünfmal getrennt gelöst (dashboard.js:3608, 4156,
 * 4471, 4580, 5300) — mit fünf verschiedenen Regeln, und keine davon nutzte
 * `customer_phone_normalized`. Die reifste Fassung stand in
 * `module/rechnung-editor.js:45-75`; ihre Regeln stehen jetzt hier, einmal.
 * Die fünf Kopien wandern nach dem Belagerungsprinzip hierher, wenn sie
 * ohnehin angefasst werden — nicht auf einen Schlag.
 *
 * Grundregel bei Mehrdeutigkeit: **lieber nichts als falsch.** Passen zwei
 * Patienten auf denselben Namen, wird `null` zurückgegeben. Ein falsch
 * zugeordneter Fußbefund ist ein Dokumentationsfehler in einer Patientenakte.
 */

/**
 * Zerlegt `customer_name` in Name und Geburtsdatum.
 *
 * Die Termine tragen den Patienten als Text, teils mit angehängtem
 * Geburtsdatum („Frank Becker · 1977-04-05") — erzeugt von
 * `displayNameWithBirth()` in dashboard.js. Zurückgelesen wurde das bisher
 * viermal per `split('·')[0]`, was das Geburtsdatum wegwirft; genau daran
 * scheitert die Zuordnung bei Namensdopplungen.
 *
 * @param {string} customerName
 * @returns {{name: string, geburtsdatum: string|null}}
 */
export function parseNameMitGeburt(customerName) {
  const roh = String(customerName || '').trim();
  const treffer = roh.match(/^(.+?)\s*·\s*(\d{4}-\d{2}-\d{2})$/);
  return treffer
    ? { name: treffer[1].trim(), geburtsdatum: treffer[2] }
    : { name: roh, geburtsdatum: null };
}

/** Nur Ziffern — „0170 / 123-45 67" und „017012 34567" sind dieselbe Nummer. */
const nurZiffern = (s) => String(s || '').replace(/\D/g, '');

/** Name eines Patienten so, wie er auf einem Termin stünde. */
const leadName = (l) =>
  ([l?.first_name, l?.last_name].filter(Boolean).join(' ').trim() || l?.title || '').trim();

/**
 * Findet den Patienten zu einem Termin.
 *
 * Reihenfolge, absteigend nach Verlässlichkeit:
 *   1. `booking.lead_id` — die echte Verknüpfung, seit 17.08.2026 der Normalfall
 *   2. Telefonnummer (normalisiert und roh)
 *   3. Name; bei angehängtem Geburtsdatum muss dieses zusätzlich passen
 *
 * @param {object} sb        Supabase-Client
 * @param {object} booking   { lead_id, customer_name, customer_phone, ... }
 * @param {string} ownerId
 * @param {object} [opts]
 * @param {Array}  [opts.leads]  bereits geladene Patienten (leadsCache) — spart die Abfrage
 * @returns {Promise<string|null>} lead_id oder null, wenn nicht eindeutig
 */
export async function findeLeadIdZuTermin(sb, booking, ownerId, opts = {}) {
  if (booking?.lead_id) return booking.lead_id;
  if (!booking || !ownerId) return null;

  const { name, geburtsdatum } = parseNameMitGeburt(booking.customer_name);
  const telZiffern = nurZiffern(booking.customer_phone);
  if (!name && !telZiffern) return null;

  // Vorhandene Liste bevorzugen: der Seitenbereich hat sie meist schon geladen.
  let kandidaten = Array.isArray(opts.leads) && opts.leads.length ? opts.leads : null;
  if (!kandidaten) {
    const { data, error } = await sb
      .from('leads')
      .select('id,first_name,last_name,title,phone,phone_normalized,geburtsdatum,metadata')
      .eq('owner_id', ownerId);
    if (error) { console.error('[termin-patient-bezug]', error); return null; }
    kandidaten = data || [];
  }

  // 2. Telefon — die Nummer gehört zu einer Person, der Name nicht unbedingt.
  if (telZiffern) {
    const perTelefon = kandidaten.filter(l =>
      nurZiffern(l.phone_normalized) === telZiffern || nurZiffern(l.phone) === telZiffern);
    if (perTelefon.length === 1) return perTelefon[0].id;
  }

  // 3. Name, klein geschrieben verglichen — „Müller" und „müller" ist derselbe
  // Patient, und die Schreibweise im Termin stammt aus einem Textfeld.
  if (!name) return null;
  const klein = name.toLowerCase();
  let perName = kandidaten.filter(l => leadName(l).toLowerCase() === klein);

  // Steht am Termin ein Geburtsdatum, entscheidet es die Namensdopplung.
  if (perName.length > 1 && geburtsdatum) {
    const genau = perName.filter(l => (l.geburtsdatum || l.metadata?.geburtsdatum) === geburtsdatum);
    if (genau.length) perName = genau;
  }

  return perName.length === 1 ? perName[0].id : null;
}

/**
 * Alle KOMMENDEN Termine eines Patienten — die Datenquelle des Terminzettels.
 *
 * „Kommend" heisst ab einer Stunde vor jetzt: der Termin, der gerade läuft,
 * gehört auf den Zettel, den der Patient mitnimmt. Abgesagte und bereits
 * abgeschlossene Termine gehören nicht darauf; deshalb dieselbe Statusliste
 * wie in der Patientensuche des Seitenbereichs (`termin-aktionen.js`).
 *
 * Ohne `leadId` (Altbestand, den auch `findeLeadIdZuTermin` nicht auflösen
 * konnte) wird über den Namen gefiltert — aber im Speicher, nicht per
 * `.or()`-Filter: Patientennamen enthalten Kommas („Nachname, Vorname") und
 * Punkte, und die zerlegen einen PostgREST-Filterausdruck. Die Menge ist
 * unkritisch, es sind die kommenden Termine einer Praxis.
 *
 * @returns {Promise<{termine: Array, error: object|null}>}
 */
export async function ladeKommendeTermineDesPatienten(sb, { ownerId, leadId, booking, limit = 30 }) {
  const abISO = new Date(Date.now() - 3600000).toISOString();
  // `employee_name` gibt es in `bookings` nicht (siehe db/SCHEMA.sql) — der
  // Therapeut hängt an `user_id`. Die Spalte hier zu nennen quittierte
  // PostgREST früher mit 400 und der Zettel blieb leer.
  let q = sb.from('bookings')
    .select('id,start_time,end_time,hausbesuch,user_id,customer_name,lead_id,services(title)')
    .eq('owner_id', ownerId)
    .gte('start_time', abISO)
    .in('status', ['confirmed', 'pending'])
    .order('start_time', { ascending: true })
    .limit(limit);

  if (leadId) q = q.eq('lead_id', leadId);

  const { data, error } = await q;
  if (error) return { termine: [], error };

  if (leadId) return { termine: data || [], error: null };

  const { name } = parseNameMitGeburt(booking?.customer_name);
  const klein = name.toLowerCase();
  const gefiltert = (data || []).filter(b =>
    parseNameMitGeburt(b.customer_name).name.toLowerCase() === klein);
  return { termine: gefiltert, error: null };
}
