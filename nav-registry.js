// ============================================================
// NAV REGISTRY — tek doğruluk kaynağı (single source of truth)
// ============================================================
// Dashboard sidebar'ında hangi modülün hangi sektör + rol için
// VAR olduğunu tanımlar. Hem dashboard.js hem admin.js buradan okur.
//
// KURAL: Buradan bir satır silmek modülü HERKESTEN kaldırır ve
// admin panelde "Im Code verschwunden" uyarısı tetikler
// (module_visibility tablosunda yetim satır kalır).
// Bir modülü gizlemek için satırı SİLME — admin paneldeki
// Sichtbarkeit toggle'ını kullan (module_visibility tablosu).
//
// roles: kod-default'u. Gerçek görünürlük module_visibility
// tablosundaki toggle'dan gelir; DB satırı yoksa buraya düşülür.

export const REGISTRY_VERSION = '20260714';

export const NAV_REGISTRY = {
  default: [
    { id: 'overview',      key: 'nav_overview',      label: 'Dashboard',       roles: ['owner', 'employee'], group: 'uebersicht' },
    { id: 'ueberblick',    key: 'nav_ueberblick',    label: 'Überblick',       roles: ['owner', 'employee'], group: 'uebersicht' },
    { id: 'calendar',      key: 'nav_calendar',      label: 'Terminkalender',  roles: ['owner', 'employee'], group: 'termine' },
    { id: 'anfragen',      key: 'nav_anfragen',      label: 'Termin-Anfragen', roles: ['owner'],             group: 'termine' },
    { id: 'kunden',        key: 'nav_kunden',        label: 'Patienten',       roles: ['owner', 'employee'], group: 'patienten' },
    { id: 'services',      key: 'nav_services',      label: 'Leistungen',      roles: ['owner', 'employee'], group: 'team' },
    { id: 'hours',         key: 'nav_hours',         label: 'Verfügbarkeit',   roles: ['owner', 'employee'], group: 'team' },
    { id: 'team',          key: 'nav_team',          label: 'Team',            roles: ['owner', 'employee'], group: 'team' },
    { id: 'rechnungen',    key: 'nav_rechnungen',    label: 'Rechnungen',      roles: ['owner', 'employee'], group: 'abrechnung' },
    { id: 'b2b',           key: 'nav_b2b',           label: 'Zuweiser',        roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'b2c',           key: 'nav_b2c',           label: 'Patientenpost',   roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'feedback',      key: 'nav_feedback',      label: 'Bewertungen',     roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'vorlagen',      key: 'nav_vorlagen',      label: 'Vorlagen',        roles: ['owner'],             group: 'einstellungen' },
    { id: 'settings',      key: 'nav_settings',      label: 'Einstellungen',   roles: ['owner', 'employee'], group: 'einstellungen' }
  ],
  physiotherapy: [
    { id: 'overview',      key: 'nav_overview',      label: 'Dashboard',       roles: ['owner', 'employee'], group: 'uebersicht' },
    { id: 'ueberblick',    key: 'nav_ueberblick',    label: 'Überblick',       roles: ['owner', 'employee'], group: 'uebersicht' },
    { id: 'calendar',      key: 'nav_calendar',      label: 'Terminkalender',  roles: ['owner', 'employee'], group: 'termine' },
    { id: 'anfragen',      key: 'nav_anfragen',      label: 'Termin-Anfragen', roles: ['owner'],             group: 'termine' },
    { id: 'kunden',        key: 'nav_kunden',        label: 'Patienten',       roles: ['owner', 'employee'], group: 'patienten' },
    { id: 'notizen',       key: 'nav_notizen',       label: 'Notizen',         roles: ['owner', 'employee'], group: 'patienten' },
    { id: 'fahrtenbuch',   key: 'nav_fahrtenbuch',   label: 'Fahrtenbuch',     roles: ['owner', 'employee'], group: 'patienten' },
    { id: 'anamnese',      key: 'nav_anamnese',      label: 'Anamnese',        roles: ['owner', 'employee'], group: 'patienten' },
    { id: 'warteliste',    key: 'nav_warteliste',    label: 'Warteliste',      roles: ['owner'],             group: 'patienten' },
    { id: 'services',      key: 'nav_services',      label: 'Leistungen',      roles: ['owner', 'employee'], group: 'team' },
    { id: 'hours',         key: 'nav_hours',         label: 'Verfügbarkeit',   roles: ['owner', 'employee'], group: 'team' },
    { id: 'team',          key: 'nav_team',          label: 'Team',            roles: ['owner', 'employee'], group: 'team' },
    { id: 'doctors',       key: 'nav_doctors',       label: 'Ärzte',           roles: ['owner', 'employee'], group: 'rezepte' },
    { id: 'verordnungen',  key: 'nav_verordnungen',  label: 'Verordnungen',    roles: ['owner', 'employee'], group: 'abrechnung' },
    { id: 'rechnungen',    key: 'nav_rechnungen',    label: 'Rechnungen',      roles: ['owner', 'employee'], group: 'abrechnung' },
    { id: 'abrechnung',    key: 'nav_abrechnung',    label: '§302-Abrechnung', roles: ['owner'],             group: 'abrechnung' },
    { id: 'belegliste',    key: 'nav_belegliste',    label: 'Kassenbuch',      roles: ['owner'],             group: 'abrechnung' },
    { id: 'mahnwesen',     key: 'nav_mahnwesen',     label: 'Mahnwesen',       roles: ['owner'],             group: 'abrechnung' },
    { id: 'statistik',     key: 'nav_statistik',     label: 'Auswertungen',    roles: ['owner'],             group: 'abrechnung' },
    { id: 'b2b',           key: 'nav_b2b',           label: 'Zuweiser',        roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'b2c',           key: 'nav_b2c',           label: 'Patientenpost',   roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'beispielmodus', key: 'nav_beispielmodus', label: 'Demo-Modus',      roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'feedback',      key: 'nav_feedback',      label: 'Bewertungen',     roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'vorlagen',      key: 'nav_vorlagen',      label: 'Vorlagen',        roles: ['owner'],             group: 'einstellungen' },
    { id: 'settings',      key: 'nav_settings',      label: 'Einstellungen',   roles: ['owner', 'employee'], group: 'einstellungen' }
  ],
  podologie: [
    { id: 'overview',          key: 'nav_overview',          label: 'Dashboard',            roles: ['owner', 'employee'], group: 'uebersicht' },
    { id: 'ueberblick',        key: 'nav_ueberblick',        label: 'Überblick',            roles: ['owner', 'employee'], group: 'uebersicht' },
    { id: 'calendar',          key: 'nav_calendar',          label: 'Terminkalender',       roles: ['owner', 'employee'], group: 'termine' },
    { id: 'anfragen',          key: 'nav_anfragen',          label: 'Termin-Anfragen',      roles: ['owner'],             group: 'termine' },
    { id: 'kunden',            key: 'nav_kunden',            label: 'Patienten',            roles: ['owner', 'employee'], group: 'patienten' },
    { id: 'notizen',           key: 'nav_notizen',           label: 'Notizen',              roles: ['owner', 'employee'], group: 'patienten' },
    { id: 'warteliste',        key: 'nav_warteliste',        label: 'Warteliste',           roles: ['owner'],             group: 'patienten' },
    { id: 'services',          key: 'nav_services',          label: 'Leistungen',           roles: ['owner', 'employee'], group: 'team' },
    { id: 'hours',             key: 'nav_hours',             label: 'Verfügbarkeit',        roles: ['owner', 'employee'], group: 'team' },
    { id: 'team',              key: 'nav_team',              label: 'Team',                 roles: ['owner', 'employee'], group: 'team' },
    { id: 'verordnungen',      key: 'nav_verordnungen',      label: 'Verordnungen',         roles: ['owner', 'employee'], group: 'abrechnung' },
    { id: 'podologie-billing', key: 'nav_podologie_billing', label: 'Podologie-Abrechnung', roles: ['owner'],             group: 'abrechnung' },
    { id: 'rechnungen',        key: 'nav_rechnungen',        label: 'Rechnungen',           roles: ['owner', 'employee'], group: 'abrechnung' },
    { id: 'fussstatus',        key: 'nav_fussstatus',        label: 'Fußstatus',            roles: ['owner', 'employee'], group: 'abrechnung' },
    { id: 'belegliste',        key: 'nav_belegliste',        label: 'Kassenbuch',           roles: ['owner'],             group: 'abrechnung' },
    { id: 'mahnwesen',         key: 'nav_mahnwesen',         label: 'Mahnwesen',            roles: ['owner'],             group: 'abrechnung' },
    { id: 'statistik',         key: 'nav_statistik',         label: 'Auswertungen',         roles: ['owner'],             group: 'abrechnung' },
    { id: 'b2b',               key: 'nav_b2b',               label: 'Zuweiser',             roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'b2c',               key: 'nav_b2c',               label: 'Patientenpost',        roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'beispielmodus',     key: 'nav_beispielmodus',     label: 'Demo-Modus',           roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'feedback',          key: 'nav_feedback',          label: 'Bewertungen',          roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'vorlagen',          key: 'nav_vorlagen',          label: 'Vorlagen',             roles: ['owner'],             group: 'einstellungen' },
    { id: 'settings',          key: 'nav_settings',          label: 'Einstellungen',        roles: ['owner', 'employee'], group: 'einstellungen' }
  ],
  praxis: [
    { id: 'overview',      key: 'nav_overview',      label: 'Dashboard',       roles: ['owner', 'employee'], group: 'uebersicht' },
    { id: 'ueberblick',    key: 'nav_ueberblick',    label: 'Überblick',       roles: ['owner', 'employee'], group: 'uebersicht' },
    { id: 'calendar',      key: 'nav_calendar',      label: 'Terminkalender',  roles: ['owner', 'employee'], group: 'termine' },
    { id: 'anfragen',      key: 'nav_anfragen',      label: 'Termin-Anfragen', roles: ['owner'],             group: 'termine' },
    { id: 'kunden',        key: 'nav_kunden',        label: 'Patienten',       roles: ['owner', 'employee'], group: 'patienten' },
    { id: 'notizen',       key: 'nav_notizen',       label: 'Notizen',         roles: ['owner', 'employee'], group: 'patienten' },
    { id: 'warteliste',    key: 'nav_warteliste',    label: 'Warteliste',      roles: ['owner'],             group: 'patienten' },
    { id: 'services',      key: 'nav_services',      label: 'Leistungen',      roles: ['owner', 'employee'], group: 'team' },
    { id: 'hours',         key: 'nav_hours',         label: 'Verfügbarkeit',   roles: ['owner', 'employee'], group: 'team' },
    { id: 'team',          key: 'nav_team',          label: 'Team',            roles: ['owner', 'employee'], group: 'team' },
    { id: 'doctors',       key: 'nav_doctors',       label: 'Ärzte',           roles: ['owner', 'employee'], group: 'rezepte' },
    { id: 'verordnungen',  key: 'nav_verordnungen',  label: 'Verordnungen',    roles: ['owner', 'employee'], group: 'abrechnung' },
    { id: 'rechnungen',    key: 'nav_rechnungen',    label: 'Rechnungen',      roles: ['owner', 'employee'], group: 'abrechnung' },
    { id: 'abrechnung',    key: 'nav_abrechnung',    label: '§302-Abrechnung', roles: ['owner'],             group: 'abrechnung' },
    { id: 'belegliste',    key: 'nav_belegliste',    label: 'Kassenbuch',      roles: ['owner'],             group: 'abrechnung' },
    { id: 'mahnwesen',     key: 'nav_mahnwesen',     label: 'Mahnwesen',       roles: ['owner'],             group: 'abrechnung' },
    { id: 'statistik',     key: 'nav_statistik',     label: 'Auswertungen',    roles: ['owner'],             group: 'abrechnung' },
    { id: 'b2b',           key: 'nav_b2b',           label: 'Zuweiser',        roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'b2c',           key: 'nav_b2c',           label: 'Patientenpost',   roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'beispielmodus', key: 'nav_beispielmodus', label: 'Demo-Modus',      roles: ['owner', 'employee'], group: 'einstellungen' },
    { id: 'vorlagen',      key: 'nav_vorlagen',      label: 'Vorlagen',        roles: ['owner'],             group: 'einstellungen' },
    { id: 'settings',      key: 'nav_settings',      label: 'Einstellungen',   roles: ['owner', 'employee'], group: 'einstellungen' }
  ]
};

// Logopädie/Ergotherapie physiotherapy setini kullanır (dashboard.js getSidebarItems ile aynı mantık)
export const SECTOR_ALIASES = { logopaedie: 'physiotherapy', ergotherapie: 'physiotherapy' };

export function resolveSector(sector) {
  if (NAV_REGISTRY[sector]) return sector;
  if (SECTOR_ALIASES[sector]) return SECTOR_ALIASES[sector];
  const praxisSectors = ['physiotherapy', 'logopaedie', 'ergotherapie', 'podologie', 'praxis'];
  return praxisSectors.includes(sector) ? 'physiotherapy' : 'default';
}
