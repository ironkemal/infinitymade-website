// Praxura Ops — Rollen, Ansichten und Rechte. EINZIGE Registry der Ansichten.
//
// Spiegel der RLS-Matrix in schema-rollen-betrieb.sql: Die Datenbank ist die
// eigentliche Grenze, diese Datei blendet nur aus, was die Rolle ohnehin nicht
// lesen darf. Ändert sich eine Seite, muss die andere im selben Commit mit.
// admin besteht jede Prüfung (wie ops_has_role in SQL).

export const ROLES = {
  admin:       { label: 'Admin',        hint: 'Sieht und darf alles, verwaltet Rollen' },
  vertrieb:    { label: 'Vertrieb',     hint: 'Kunden, Pipeline, Angebote; Tickets/Boxen lesend' },
  technik:     { label: 'Software/Technik', hint: 'Aufgaben, Tickets, Boxen & Wartung, Dateien; Kunden lesend' },
  support:     { label: 'Support',      hint: 'Tickets, Wartungslog, Wissen; Kunden/Boxen lesend' },
  buchhaltung: { label: 'Buchhaltung',  hint: 'Nur lesend: Finanzen und Fahrtenbuch' },
};

// Bereich → wer liest, wer schreibt (admin implizit).
const AREAS = {
  todo:        { read: ['vertrieb', 'technik', 'support'], write: ['vertrieb', 'technik', 'support'] },
  wissen:      { read: ['vertrieb', 'technik', 'support'], write: ['vertrieb', 'technik', 'support'] },
  decisions:   { read: ['technik'],                         write: [] },
  meetings:    { read: [],                                  write: [] },
  finanzen:    { read: ['buchhaltung'],                     write: [] },
  fahrtenbuch: { read: ['buchhaltung'],                     write: [] },
  files:       { read: ['technik'],                         write: [] },
  kunden:      { read: ['vertrieb', 'technik', 'support'], write: ['vertrieb'] },
  vertrieb:    { read: ['vertrieb'],                        write: ['vertrieb'] },   // Aktivitäten + Angebote
  tickets:     { read: ['vertrieb', 'technik', 'support'], write: ['technik', 'support'] },
  boxen:       { read: ['vertrieb', 'technik', 'support'], write: ['technik'] },
  wartung:     { read: ['technik', 'support'],              write: ['technik', 'support'] },
  team:        { read: [],                                  write: [] },
  uebersicht:  { read: ['vertrieb', 'technik', 'support', 'buchhaltung'], write: [] },
};

/** Ansichten in Navigationsreihenfolge. area = Rechtebereich. */
export const VIEWS = [
  { name: 'uebersicht',  label: 'Übersicht',            icon: '◎', group: null,          area: 'uebersicht',  path: './uebersicht.js?v=20261120a',   fn: 'mountUebersicht' },
  { name: 'kunden',      label: 'Kunden & Vertrieb',    icon: '◆', group: 'Vertrieb',    area: 'kunden',      path: './kunden.js?v=20261120a',       fn: 'mountKunden' },
  { name: 'support',     label: 'Support & Störungen',  icon: '✚', group: 'Betrieb',     area: 'tickets',     path: './support.js?v=20261120a',      fn: 'mountSupport' },
  { name: 'boxen',       label: 'Boxen & Wartung',      icon: '▣', group: 'Betrieb',     area: 'boxen',       path: './boxen.js?v=20261120a',        fn: 'mountBoxen' },
  { name: 'todo',        label: 'Aufgaben',             icon: '☰', group: 'Team',        area: 'todo',        path: './board.js?v=20261120a', fn: 'mountTodo' },
  { name: 'wissen',      label: 'Wissensbank',          icon: '✎', group: 'Team',        area: 'wissen',      path: './wissen.js?v=20261120a',       fn: 'mountWissen' },
  { name: 'decisions',   label: 'Entscheidungen',       icon: '⚑', group: 'Team',        area: 'decisions',   path: './decisions.js?v=20261120a',    fn: 'mountDecisions' },
  { name: 'meetings',    label: 'Meetings',             icon: '◷', group: 'Team',        area: 'meetings',    path: './meetings.js?v=20261120a',     fn: 'mountMeetings' },
  { name: 'ausgaben',    label: 'Finanzen',             icon: '€', group: 'Verwaltung',  area: 'finanzen',    path: './finance.js?v=20261120a',      fn: 'mountFinance' },
  { name: 'fahrtenbuch', label: 'Fahrtenbuch',          icon: '⇄', group: 'Verwaltung',  area: 'fahrtenbuch', path: './fahrtenbuch.js?v=20261120a',  fn: 'mountFahrtenbuch' },
  { name: 'files',       label: 'Dateien',              icon: '▤', group: 'Verwaltung',  area: 'files',       path: './files.js?v=20261120a',        fn: 'mountFiles' },
  { name: 'team',        label: 'Team & Rollen',        icon: '◉', group: 'Verwaltung',  area: 'team',        path: './team.js?v=20261120a',         fn: 'mountTeam' },
];

let currentRole = 'admin';
export const setRole = (r) => { currentRole = ROLES[r] ? r : 'support'; };
export const role = () => currentRole;
export const isAdmin = () => currentRole === 'admin';

export function canRead(area, r = currentRole) {
  if (r === 'admin') return true;
  return !!AREAS[area]?.read.includes(r);
}
export function canWrite(area, r = currentRole) {
  if (r === 'admin') return true;
  return !!AREAS[area]?.write.includes(r);
}

export const visibleViews = (r = currentRole) => VIEWS.filter(v => canRead(v.area, r));

/** Für die Team-Seite: Matrix lesbar machen. */
export function accessSummary(r) {
  return VIEWS.map(v => ({
    label: v.label,
    level: canWrite(v.area, r) ? 'schreiben' : canRead(v.area, r) ? 'lesen' : '—',
  }));
}
