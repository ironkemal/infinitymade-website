// Podologie Positionsnummern + Preise (§ 125 Abs. 1 SGB V, Anlage 2).
// Source: 20250617_Podologie_Anlage_2.pdf  — gültig ab 01.07.2025.
//
// Prefix-Regel (Abrechnungscode laut Anlage 2 §1):
//   71xxxx = Podologe (ZL – zugelassener Leistungserbringer)  ← unser default
//   72xxxx = Med. Fußpfleger (§10 Abs.4-6 PodG)
//   27xxxx = Krankenhaus
//   28xxxx = Kurbetrieb
//
// Die tatsächlichen Abrechnungsnummern 78xxx / 68xxx / 88xxx enthalten
// den Prefix bereits; hier werden nur die ZL-78xxx-Codes geführt.
//
// Preistabellen:
//   PODOLOGIE_POSITIONS_2025  → ab 01.07.2025
//   PODOLOGIE_POSITIONS_2026  → ab 01.07.2026 (geplant)

// ─── Preise ab 01.07.2025 ────────────────────────────────────────────────────

export const PODOLOGIE_POSITIONS_2025 = Object.freeze([

  // ── a) Diagnosegruppen DF / NF / QF ─────────────────────────────────────
  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
  { hpnr: '78020', label: 'Podologische Behandlung (groß)',    diagnosegruppen: ['DF','NF','QF'], preis: 50.55, zuzahlung: 5.06,  dauer: '50', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
  { hpnr: '78030', label: 'Podologische Befundung',           diagnosegruppen: ['DF','NF','QF'], preis:  3.47, zuzahlung: 0.35,  dauer: null, gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
  { hpnr: '78040', label: 'Eingangsbefundung',                diagnosegruppen: ['DF','NF','QF'], preis: 22.48, zuzahlung: 2.25,  dauer: '20', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30',
    notiz: 'Einmalig je Patient (Lebenszeit). Nicht am selben Tag wie 78030.' },

  // ── b) UI1/UI2 – alte Nagelspange (Verordnungsdatum bis 30.09.2025) ─────
  { hpnr: '78210', label: 'Anpassung Ross-Fraser-Spange (einteilig)',   diagnosegruppen: ['UI1','UI2'], preis:  99.04, zuzahlung:  9.90, dauer: '90', gueltig_ab: '2025-07-01', gueltig_bis: '2025-09-30',
    deprecated: true, ersetzt_durch: '78610', ungueltig_ab: '2025-10-01' },
  { hpnr: '78220', label: 'Fertigung Ross-Fraser-Spange (einteilig)',   diagnosegruppen: ['UI1','UI2'], preis:  54.24, zuzahlung: null,  dauer: '45', gueltig_ab: '2025-07-01', gueltig_bis: '2025-09-30',
    deprecated: true, ersetzt_durch: '78610', ungueltig_ab: '2025-10-01' },
  { hpnr: '78230', label: 'Nachregulierung Ross-Fraser-Spange',         diagnosegruppen: ['UI1','UI2'], preis:  49.64, zuzahlung:  4.96, dauer: '45', gueltig_ab: '2025-07-01', gueltig_bis: '2025-09-30',
    deprecated: true, ersetzt_durch: '78610', ungueltig_ab: '2025-10-01' },
  { hpnr: '78300', label: 'Mehrteilige bilaterale Nagelkorrekturspange',diagnosegruppen: ['UI1','UI2'], preis:  97.64, zuzahlung:  9.76, dauer: '75', gueltig_ab: '2025-07-01', gueltig_bis: '2025-09-30',
    deprecated: true, ersetzt_durch: '78610', ungueltig_ab: '2025-10-01' },
  { hpnr: '78400', label: 'Einteilige Kunststoff-/Metall-Nagelkorrekturspange', diagnosegruppen: ['UI1','UI2'], preis:  53.89, zuzahlung:  5.39, dauer: '45', gueltig_ab: '2025-07-01', gueltig_bis: '2025-09-30',
    deprecated: true, ersetzt_durch: '78610', ungueltig_ab: '2025-10-01' },

  // ── c) UI1/UI2 – neue Nagelspange (Verordnungsdatum ab 01.10.2025) ─────
  { hpnr: '78610', label: 'Nagelspangenbehandlung',                     diagnosegruppen: ['UI1','UI2'], preis:  55.90, zuzahlung:  5.59, dauer: '45', gueltig_ab: '2025-10-01', gueltig_bis: '2026-06-30',
    max_pro_tag: 2, notiz: 'Ersetzt alle alten Nagelspange-Codes. Darf 2x je Tag abgegeben werden.' },
  { hpnr: '78620', label: 'Aufschlag für besonderen Aufwand',           diagnosegruppen: ['UI1','UI2'], preis:  16.86, zuzahlung:  1.69, dauer: '+15', gueltig_ab: '2025-10-01', gueltig_bis: '2026-06-30',
    max_pro_termin: 2, notiz: 'Bei Kinder <14 J. oder Nagel Schweregrad UI2/UI3. Max 2x je Behandlungstermin.' },

  // ── d) UI1/UI2 – unabhängig vom Verordnungsdatum ────────────────────────
  { hpnr: '78100', label: 'Erstbefundung groß',                         diagnosegruppen: ['UI1','UI2'], preis:  56.00, zuzahlung:  5.60, dauer: '45', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30',
    notiz: '1x pro Kalenderjahr. Gilt auch bei Wiedervorstellung. Nachtestung nach Heilung möglich.' },
  { hpnr: '78110', label: 'Erstbefundung klein',                        diagnosegruppen: ['UI1','UI2'], preis:  27.90, zuzahlung:  2.79, dauer: '20', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
  { hpnr: '78510', label: 'Kontrolle Sitz- und Passgenauigkeit',        diagnosegruppen: ['UI1','UI2'], preis:  17.21, zuzahlung:  1.72, dauer: '15', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
  { hpnr: '78520', label: 'Behandlungsabschluss / Entfernung Nagelkorrekturspange', diagnosegruppen: ['UI1','UI2'], preis: 25.91, zuzahlung: 2.59, dauer: '25', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
  { hpnr: '78530', label: 'Therapiebericht UI 2',                       diagnosegruppen: ['UI2'],        preis:  16.86, zuzahlung: null,  dauer: '15', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },

  // ── e) Hausbesuche ───────────────────────────────────────────────────────
  { hpnr: '79933', label: 'Hausbesuch (ärztl. verordnet), inkl. Wegegeld',      diagnosegruppen: ['DF','NF','QF','UI1','UI2'], preis: 23.61, zuzahlung: 2.36, dauer: null, gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30',
    notiz: 'Nur abrechenbar wenn Feld "Hausbesuch = Ja" auf Muster 13 angekreuzt.' },
  { hpnr: '79934', label: 'Hausbesuch in soz. Einrichtung, inkl. Wegegeld',     diagnosegruppen: ['DF','NF','QF','UI1','UI2'], preis: 13.60, zuzahlung: 1.36, dauer: null, gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30',
    notiz: 'Nur abrechenbar wenn Feld "Hausbesuch = Ja" auf Muster 13 angekreuzt.' },
]);

// ─── Preise ab 01.07.2026 ────────────────────────────────────────────────────

export const PODOLOGIE_POSITIONS_2026 = Object.freeze([
  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },
  { hpnr: '78020', label: 'Podologische Behandlung (groß)',    diagnosegruppen: ['DF','NF','QF'], preis: 51.92, zuzahlung: 5.19,  dauer: '50', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },
  { hpnr: '78030', label: 'Podologische Befundung',           diagnosegruppen: ['DF','NF','QF'], preis:  3.57, zuzahlung: 0.36,  dauer: null, gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },
  { hpnr: '78040', label: 'Eingangsbefundung',                diagnosegruppen: ['DF','NF','QF'], preis: 23.11, zuzahlung: 2.31,  dauer: '20', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31',
    notiz: 'Einmalig je Patient (Lebenszeit). Nicht am selben Tag wie 78030.' },
  { hpnr: '78210', label: 'Anpassung Ross-Fraser-Spange (einteilig)',   diagnosegruppen: ['UI1','UI2'], preis: 101.65, zuzahlung: 10.17, dauer: '90', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31',
    deprecated: true, ungueltig_ab: '2025-10-01' },
  { hpnr: '78220', label: 'Fertigung Ross-Fraser-Spange (einteilig)',   diagnosegruppen: ['UI1','UI2'], preis:  55.66, zuzahlung: null,  dauer: '45', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31',
    deprecated: true, ungueltig_ab: '2025-10-01' },
  { hpnr: '78230', label: 'Nachregulierung Ross-Fraser-Spange',         diagnosegruppen: ['UI1','UI2'], preis:  50.95, zuzahlung:  5.10, dauer: '45', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31',
    deprecated: true, ungueltig_ab: '2025-10-01' },
  { hpnr: '78300', label: 'Mehrteilige bilaterale Nagelkorrekturspange',diagnosegruppen: ['UI1','UI2'], preis:  99.90, zuzahlung:  9.99, dauer: '75', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31',
    deprecated: true, ungueltig_ab: '2025-10-01' },
  { hpnr: '78400', label: 'Einteilige Kunststoff-/Metall-Nagelkorrekturspange', diagnosegruppen: ['UI1','UI2'], preis:  55.20, zuzahlung:  5.52, dauer: '45', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31',
    deprecated: true, ungueltig_ab: '2025-10-01' },
  { hpnr: '78610', label: 'Nagelspangenbehandlung',                     diagnosegruppen: ['UI1','UI2'], preis:  57.20, zuzahlung:  5.72, dauer: '45', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31',
    max_pro_tag: 2 },
  { hpnr: '78620', label: 'Aufschlag für besonderen Aufwand',           diagnosegruppen: ['UI1','UI2'], preis:  17.33, zuzahlung:  1.73, dauer: '+15', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31',
    max_pro_termin: 2 },
  { hpnr: '78100', label: 'Erstbefundung groß',                         diagnosegruppen: ['UI1','UI2'], preis:  57.52, zuzahlung:  5.75, dauer: '45', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },
  { hpnr: '78110', label: 'Erstbefundung klein',                        diagnosegruppen: ['UI1','UI2'], preis:  28.63, zuzahlung:  2.86, dauer: '20', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },
  { hpnr: '78510', label: 'Kontrolle Sitz- und Passgenauigkeit',        diagnosegruppen: ['UI1','UI2'], preis:  17.64, zuzahlung:  1.76, dauer: '15', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },
  { hpnr: '78520', label: 'Behandlungsabschluss / Entfernung Nagelkorrekturspange', diagnosegruppen: ['UI1','UI2'], preis: 26.59, zuzahlung: 2.66, dauer: '25', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },
  { hpnr: '78530', label: 'Therapiebericht UI 2',                       diagnosegruppen: ['UI2'],        preis:  17.33, zuzahlung: null,  dauer: '15', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },
  { hpnr: '79933', label: 'Hausbesuch (ärztl. verordnet), inkl. Wegegeld',      diagnosegruppen: ['DF','NF','QF','UI1','UI2'], preis: 25.54, zuzahlung: 2.55, dauer: null, gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },
  { hpnr: '79934', label: 'Hausbesuch in soz. Einrichtung, inkl. Wegegeld',     diagnosegruppen: ['DF','NF','QF','UI1','UI2'], preis: 16.66, zuzahlung: 1.67, dauer: null, gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Find a position by HPNR for a given treatment date (YYYY-MM-DD string).
 * Returns the matching entry or null.
 */
export function findPodologiePosition(hpnr, dateStr) {
  const d = dateStr || new Date().toISOString().slice(0, 10);
  const all = [...PODOLOGIE_POSITIONS_2025, ...PODOLOGIE_POSITIONS_2026];
  return all.find(p => p.hpnr === hpnr && p.gueltig_ab <= d && p.gueltig_bis >= d) || null;
}

/**
 * Get all active (non-deprecated) positions for a given date and diagnosegruppe.
 */
export function getPodologiePositionenFuerDiagnosegruppe(diagnosegruppe, dateStr) {
  const d = dateStr || new Date().toISOString().slice(0, 10);
  const all = [...PODOLOGIE_POSITIONS_2025, ...PODOLOGIE_POSITIONS_2026];
  return all.filter(p =>
    p.diagnosegruppen.includes(diagnosegruppe) &&
    p.gueltig_ab <= d &&
    p.gueltig_bis >= d &&
    !p.deprecated
  );
}
