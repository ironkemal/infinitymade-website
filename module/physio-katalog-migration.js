/**
 * Physio-Altlast im Leistungskatalog — einmalige Korrektur (26.10.2026).
 *
 * GKV_LEISTUNGSKATALOG.physiotherapy (dashboard.js) führte bis heute
 * „Massage Einzel" unter X0102 mit 33,75 €. X0102 ist aber die
 * Unterwasserdruckstrahlmassage; die normale Massage (KMT) ist X0106 mit
 * 21,63 € (Physio Anlage 2 ab 01.01.2026, api-backend/billing/codes/
 * physio_positions.js). Eine Praxis, die KMT macht, rechnete damit die falsche
 * Position mit zu hohem Betrag ab — die Datei geht durch, die Kasse kürzt
 * später (gkv-302-Katalogprüfung, wissensbank/sitzungen/2026-10-26_katalog-physio-ergo-logo.md).
 *
 * autoSeedGkvServices() hat die falsche Karte in jede Physio-Praxis geschrieben.
 * Korrigiert werden NUR diese Saat-Karten (Titel „Massage Einzel"): wer X0102
 * bewusst als Unterwasserdruckstrahlmassage angelegt hat, bleibt unberührt.
 * Gleiches Muster wie migratePodologieLegacyServices() in dashboard.js — muss
 * VOR dem Seed laufen, sonst stünde X0106 doppelt da.
 */

export const ALT_SAAT = { code: 'X0102', title: 'Massage Einzel' };

/**
 * Welche Leistungen sind falsche Saat-Karten, und was wird aus ihnen?
 * @param {Array} services   servicesCache
 * @param {object} kmt       Katalogeintrag X0106 aus GKV_LEISTUNGSKATALOG
 * @returns {Array<{id:string, patch:object}>}
 */
export function physioAltlastPatches(services, kmt) {
  if (!kmt) return [];
  const alt = (services || []).filter(s =>
    s.gkv_position_nr === ALT_SAAT.code && String(s.title || '').trim() === ALT_SAAT.title);
  return alt.map(s => {
    // X0106 ist schon eingerichtet → die alte Karte wäre eine Dublette. Sie
    // verliert nur den GKV-Bezug und bleibt als Privatposten stehen.
    const schonDa = services.some(x => x.gkv_position_nr === kmt.code && x.id !== s.id);
    return {
      id: s.id,
      patch: schonDa
        ? { gkv_position_nr: null }
        : { gkv_position_nr: kmt.code, title: kmt.title, code: kmt.kuerzel,
            price: kmt.price.toString(), duration_minutes: kmt.duration ?? s.duration_minutes },
    };
  });
}

/**
 * Zertifikatspositionen (30.10.2026). Die Prüfung „Therapeut hat das Zertifikat"
 * gibt es seit langem (dashboard.js Buchungswarnung, module/abrechnung-auswahl.js
 * Abrechnungsstopp) — sie greift aber nur, wenn services.required_certificate
 * gesetzt ist. autoSeedGkvServices() hat das Feld nie befüllt, also lief jede
 * MT/MLD/KGG-Leistung ohne Prüfung durch (physio-Bericht Lead-Trier, Absetzung
 * S:01011). Werte = CHECK-Constraint services_required_certificate_check.
 * KG-ZNS (X07xx) fehlt bewusst: der Constraint kennt den Wert noch nicht.
 */
export const ZERTIFIKAT_PFLICHT = {
  X1201: 'MT', X1221: 'MT',
  X0201: 'MLD', X0202: 'MLD', X0204: 'MLD', X0205: 'MLD',
  X0507: 'KGG',
};

/** Leistungen mit Zertifikatsposition, denen das Pflichtzertifikat fehlt. */
export function zertifikatPatches(services) {
  return (services || [])
    .filter(s => ZERTIFIKAT_PFLICHT[s.gkv_position_nr] && !s.required_certificate)
    .map(s => ({ id: s.id, patch: { required_certificate: ZERTIFIKAT_PFLICHT[s.gkv_position_nr] } }));
}

/** Wendet die Patches an und hält servicesCache synchron. */
export async function migrierePhysioAltlast({ supabase, services, katalog }) {
  const kmt = (katalog || []).find(e => e.code === 'X0106');
  for (const { id, patch } of [...physioAltlastPatches(services, kmt), ...zertifikatPatches(services)]) {
    const { error } = await supabase.from('services').update(patch).eq('id', id);
    if (error) { console.warn('Physio-Katalogkorrektur fehlgeschlagen für', id, error.message); continue; }
    Object.assign(services.find(s => s.id === id), patch);
  }
}
