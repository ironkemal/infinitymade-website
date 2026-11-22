// O-251 / O-250 (Testbox 22.11.2026): Die Box-Einrichtung legt den ersten Standort mit an.
//
// Warum: Im SaaS legt das Onboarding (onboarding.js, „Faz 1 multi-business") beim ersten
// Schritt einen businesses-Datensatz mit is_default=true an. Die Box-Einrichtung schrieb
// nur profiles — die frische Box hatte keinen Standort. Folge: Mitarbeiter, die vor dem
// ersten Standort angelegt wurden, bekamen keine employee_business_assignments-Zeile
// (routes/mitarbeiter-zugang.js) und konnten sich nie anmelden (dashboard.js
// loadModulePermissions). Gleiches Ergebnis in beiden Verteilungen (G7).
//
// Nicht blockierend: scheitert der Insert, ist das Konto trotzdem angelegt; der Knopf
// „＋ Neues Geschäft hinzufügen" (O-250) und der Hinweis standort_fehlt fangen den Rest auf.
// Erst prüfen, dann einfügen; 23505 (uniq_businesses_default_per_owner) gilt als „schon da".
// trg_seed_default_groups legt beim Insert die Gruppen „Mitarbeiter"/„Sekreter" an.

/**
 * @param {any} supabase  service_role-Client
 * @param {{ ownerId: string, businessName: string, sector: string }} angaben
 * @returns {Promise<{ status: 'angelegt' | 'vorhanden' | 'fehler', fehler?: string }>}
 */
export async function legeStandardStandortAn(supabase, { ownerId, businessName, sector }) {
  try {
    const { data: vorhanden, error: leseFehler } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('is_default', true)
      .maybeSingle();
    if (leseFehler) return { status: 'fehler', fehler: leseFehler.message };
    if (vorhanden?.id) return { status: 'vorhanden' };

    const { error } = await supabase.from('businesses').insert({
      owner_id: ownerId,
      business_name: businessName,
      sector,
      is_default: true,
    });
    if (error?.code === '23505') return { status: 'vorhanden' };
    if (error) return { status: 'fehler', fehler: error.message };
    return { status: 'angelegt' };
  } catch (err) {
    return { status: 'fehler', fehler: /** @type {any} */ (err)?.message || String(err) };
  }
}
