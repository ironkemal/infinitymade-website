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
 * MT/MLD/KGG-Leistung ohne Prüfung durch (Physio-Pilot P1, Absetzung
 * S:01011). Werte = CHECK-Constraint services_required_certificate_check (0090).
 * KG-ZNS je Methode, weil die Position an der Methode hängt (Anlage 1 Physio,
 * Anlage 7 Fassung 21.07.2021 Nr. 3-7; gkv-302 30.10.2026). X0720/X0728 (Tele)
 * folgen Bobath wie X1221 der MT. KG-Muko X0702 ist keine Zertifikatsposition.
 */
export const ZERTIFIKAT_PFLICHT = {
  X1201: 'MT', X1221: 'MT',
  X0201: 'MLD', X0202: 'MLD', X0204: 'MLD', X0205: 'MLD',
  X0507: 'KGG',
  X0710: 'ZNS-BOBATH', X0720: 'ZNS-BOBATH',
  X0711: 'ZNS-VOJTA',
  X0712: 'ZNS-PNF',
  X0708: 'ZNS-K-BOBATH', X0728: 'ZNS-K-BOBATH',
  X0709: 'ZNS-K-VOJTA',
};

/** Kinder-Zertifikat deckt Erwachsene derselben Methode ab (Anlage 7 Nr. 3/4), nie umgekehrt. */
const ZNS_KINDER_DECKT = { 'ZNS-K-BOBATH': 'ZNS-BOBATH', 'ZNS-K-VOJTA': 'ZNS-VOJTA' };

/** Die Prüfung ist Gleichheit: die mitgedeckte Stufe wird als eigene Zeile gespeichert. */
export function zertifikateMitDeckung(zertifikate) {
  const alle = new Set(zertifikate || []);
  for (const z of [...alle]) if (ZNS_KINDER_DECKT[z]) alle.add(ZNS_KINDER_DECKT[z]);
  return [...alle];
}

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

/**
 * Ergänzung der Physio-Saat (K11, Physio-Pilot P1, 30.10.2026). Bis heute säte
 * autoSeedGkvServices() nur 11 Physio-Positionen; MLD 30 (die häufigste MLD),
 * Kompressionsbandagierung und die üblichen ergänzenden Heilmittel (Wärme,
 * Kälte, Elektro) musste jede Praxis von Hand anlegen. Auswahl: physio-Agent
 * 30.10.2026 — nur was eine typische ambulante Praxis ohne Bad/Becken täglich
 * nutzt, weil die Saat gelöschte Codes beim nächsten Laden wieder anlegt.
 * Gruppen (X0401/X0601) bewusst NICHT: der Kalender kennt noch keinen
 * Gruppentermin, die Leistung würde wie ein Einzeltermin gebucht.
 * Preise = api-backend/billing/codes/physio_positions.js (Anlage 2 ab
 * 01.01.2026); der Test prüft das gegen die Datei, nicht gegen diese Zahlen.
 * Kürzel E/W/K wie HEILMITTEL_DEFAULTS dort.
 */
export const PHYSIO_KATALOG_ERGAENZUNG = [
  { code: 'X0205', kuerzel: 'MLD30', title: 'Manuelle Lymphdrainage 30 min',  duration: 30, price: 35.97 },
  { code: 'X0204', kuerzel: 'KOMP',  title: 'Kompressionsbandagierung',       duration: null, price: 22.92 },
  { code: 'X1501', kuerzel: 'W',     title: 'Warmpackung (Fango)',            duration: 30, duration_label: '20–30', price: 16.16 },
  { code: 'X1517', kuerzel: 'HL',    title: 'Wärmetherapie Heißluft',         duration: 20, duration_label: '10–20', price: 7.43 },
  { code: 'X1530', kuerzel: 'HR',    title: 'Heiße Rolle',                    duration: 15, duration_label: '10–15', price: 13.47 },
  { code: 'X1531', kuerzel: 'US',    title: 'Ultraschall-Wärmetherapie',      duration: 20, duration_label: '10–20', price: 14.66 },
  { code: 'X1534', kuerzel: 'K',     title: 'Kältetherapie',                  duration: 10, duration_label: '5–10',  price: 11.95 },
  { code: 'X1302', kuerzel: 'E',     title: 'Elektrotherapie',                duration: 20, duration_label: '10–20', price: 8.43 },
].map(e => ({ ...e, price_min: e.price, price_max: e.price, locked: true }));
