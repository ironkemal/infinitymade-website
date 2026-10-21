// Patientenakte (leads) zu einer bestätigten Terminanfrage finden oder anlegen.
//
// Warum (canli-test 21.10.2026): Termine aus Online-Anfragen entstanden ohne
// bookings.lead_id. Der Anfragende liegt in `patients` (öffentliche Buchung);
// in „Patienten" tauchte er nie auf — Akte, Verordnung, Fußbefund waren für ihn
// nicht erreichbar. `patients` bleibt bestehen (öffentliche Strecke), verknüpft
// wird beim Annehmen: laut db/REGISTER.md darf der Anfragende erst nach Annahme
// in `leads` (db-ustasi 21.10.2026).
//
// Abgleich NUR über Name + Geburtsdatum innerhalb der Praxis — nicht über
// E-Mail/Telefon allein (Familien teilen sich beides; booking/create macht das
// anders, dort bewusst nicht übernommen). Mehrere Treffer: nicht raten → null.
//
// Liegt ausserhalb von server.js, damit es testbar ist (wie from-request.js).

const VERSICHERUNG = { gkv: 'gkv', pkv: 'privat' };   // leads.insurance_type CHECK: gkv | privat

/** ilike-Muster ohne Platzhalter aus dem Namen. */
const wortlich = (s) => String(s ?? '').trim().replace(/[\\%_]/g, (c) => '\\' + c);

/**
 * @param {object} supabase  service-role-Client
 * @param {object} a
 * @param {string} a.ownerId
 * @param {?{vorname:string,nachname:string,geburtsdatum:string,email?:string,telefon?:string}} a.patient
 * @param {?string} [a.paymentType]   booking_requests.payment_type (gkv|pkv|selbstzahler|bg)
 * @param {?string} [a.krankenkasse]  Freitext der Anfrage
 * @returns {Promise<?string>} lead_id oder null (Patient unvollständig / mehrdeutig / Fehler)
 */
/**
 * Die eine Akte zu Name + Geburtsdatum in dieser Praxis — oder null. Gemeinsam für
 * Anfrage-Annahme und POST /api/rezept/confirm (fonksiyon-ustasi 21.10.2026: dort
 * stand `.ilike('first_name', fn || '%')` — fehlte der Vorname, passte jeder, und
 * `%`/`_` im Namen wirkten als Platzhalter).
 * @returns {Promise<{id:string, krankenkasse_ik:?string}|null|'mehrdeutig'>}
 */
export async function findeLeadNachNameGeburt(supabase, { ownerId, vorname, nachname, geburtsdatum }) {
  const vor = String(vorname ?? '').trim();
  const nach = String(nachname ?? '').trim();
  if (!ownerId || !vor || !nach || !geburtsdatum) return null;
  const { data: treffer, error } = await supabase.from('leads')
    .select('id, krankenkasse_ik')
    .eq('owner_id', ownerId).eq('geburtsdatum', geburtsdatum)
    .ilike('first_name', wortlich(vor)).ilike('last_name', wortlich(nach))
    .limit(2);
  if (error || !treffer?.length) return null;
  return treffer.length > 1 ? 'mehrdeutig' : treffer[0];
}

export async function leadAusAnfrage(supabase, { ownerId, patient, paymentType = null, krankenkasse = null } = {}) {
  const vor = String(patient?.vorname ?? '').trim();
  const nach = String(patient?.nachname ?? '').trim();
  const geb = patient?.geburtsdatum || null;
  if (!ownerId || !vor || !nach || !geb) return null;

  const treffer = await findeLeadNachNameGeburt(supabase, { ownerId, vorname: vor, nachname: nach, geburtsdatum: geb });
  if (treffer === 'mehrdeutig') return null;   // mehrdeutig — lieber ohne Akte als in der falschen
  if (treffer) return treffer.id;

  const { data: neu, error: anlegeFehler } = await supabase.from('leads')
    .insert({
      owner_id: ownerId,
      first_name: vor,
      last_name: nach,
      title: `${vor} ${nach}`,
      geburtsdatum: geb,
      email: patient.email || null,
      phone: patient.telefon || null,
      insurance_type: VERSICHERUNG[paymentType] || null,
      krankenkasse: krankenkasse || null,
      status: 'booked',
      metadata: { quelle: 'online-anfrage' },
    })
    .select('id')
    .single();
  if (anlegeFehler) return null;
  return neu?.id || null;
}
