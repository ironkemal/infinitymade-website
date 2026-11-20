// Praxura Ops — Werte ↔ deutsche Bezeichnungen für Kunden, Tickets, Boxen.
// Die Schlüssel MÜSSEN den CHECK-Constraints in schema-rollen-betrieb.sql
// entsprechen. Neuer Wert = SQL + hier im selben Commit.

export const STAGES = {
  lead: 'Lead', kontakt: 'Kontakt', demo: 'Demo', angebot: 'Angebot',
  vertrag: 'Vertrag', installation: 'Installation', live: 'Live',
  pausiert: 'Pausiert', verloren: 'Verloren',
};
/** Aktiver Trichter in Reihenfolge (pausiert/verloren stehen daneben). */
export const FUNNEL = ['lead', 'kontakt', 'demo', 'angebot', 'vertrag', 'installation', 'live'];
export const STAGE_TONE = {
  lead: 'mute', kontakt: 'info', demo: 'info', angebot: 'gold', vertrag: 'gold',
  installation: 'warn', live: 'ok', pausiert: 'mute', verloren: 'bad',
};

export const FACH = {
  podologie: 'Podologie', physio: 'Physiotherapie', ergo: 'Ergotherapie',
  logo: 'Logopädie', interdisziplinaer: 'Interdisziplinär', sonstiges: 'Sonstiges',
};

export const QUELLE = {
  website: 'Website', demo_formular: 'Demo-Formular', empfehlung: 'Empfehlung', apify: 'Recherche (Apify)',
  messe: 'Messe/Event', kaltakquise: 'Kaltakquise', bestand: 'Bestandskunde (Beta)', sonstiges: 'Sonstiges',
};

export const DOK_STATUS = { offen: 'offen', gesendet: 'gesendet', unterschrieben: 'unterschrieben', nicht_noetig: 'nicht nötig' };
export const DOK_TONE = { offen: 'mute', gesendet: 'warn', unterschrieben: 'ok', nicht_noetig: 'mute' };

export const AKT_ART = {
  notiz: 'Notiz', anruf: 'Anruf', mail: 'E-Mail', demo: 'Demo', termin: 'Termin',
  angebot: 'Angebot', vertrag: 'Vertrag', stage: 'Phase',
};

export const ANGEBOT_STATUS = {
  entwurf: 'Entwurf', gesendet: 'Gesendet', angenommen: 'Angenommen', abgelehnt: 'Abgelehnt', abgelaufen: 'Abgelaufen',
};
export const ANGEBOT_TONE = { entwurf: 'mute', gesendet: 'warn', angenommen: 'ok', abgelehnt: 'bad', abgelaufen: 'mute' };

// ── Support ────────────────────────────────────────────────────────────
export const TICKET_TYP = {
  frage: 'Frage', stoerung: 'Störung', fehler: 'Softwarefehler', wunsch: 'Wunsch', wartung: 'Wartung', intern: 'Intern',
};
export const PRIO = { kritisch: 'Kritisch', hoch: 'Hoch', normal: 'Normal', niedrig: 'Niedrig' };
export const PRIO_TONE = { kritisch: 'bad', hoch: 'warn', normal: 'info', niedrig: 'mute' };
export const PRIO_COLOR = { kritisch: '#d9534f', hoch: '#d9962b', normal: '#4f8ef7', niedrig: '#6b7482' };
export const PRIO_ORDER = { kritisch: 0, hoch: 1, normal: 2, niedrig: 3 };

export const TICKET_STATUS = {
  neu: 'Neu', in_arbeit: 'In Arbeit', wartet_kunde: 'Wartet auf Kunde', wartet_intern: 'Wartet intern',
  geloest: 'Gelöst', geschlossen: 'Geschlossen',
};
export const TICKET_TONE = {
  neu: 'info', in_arbeit: 'gold', wartet_kunde: 'warn', wartet_intern: 'warn', geloest: 'ok', geschlossen: 'mute',
};
export const OPEN_STATUS = ['neu', 'in_arbeit', 'wartet_kunde', 'wartet_intern'];

export const KANAL = {
  mail: 'E-Mail', telefon: 'Telefon', fernwartung: 'Fernwartung', vor_ort: 'Vor Ort', intern: 'Intern', monitoring: 'Monitoring/Alarm',
};
export const EINTRAG_ART = { notiz: 'Interne Notiz', antwort: 'Antwort an Kunde', anruf: 'Anruf', status: 'Status', loesung: 'Lösung' };

/** Vorschlag für das Zieldatum. ⚠️ Kein zugesagtes SLA — das ist noch nicht
 *  festgelegt (Ops #30). Nur interne Orientierung, im Formular änderbar. */
export const ZIEL_STUNDEN = { kritisch: 4, hoch: 24, normal: 72, niedrig: 240 };

// ── Boxen ──────────────────────────────────────────────────────────────
export const BOX_STATUS = {
  lager: 'Lager', vorbereitet: 'Vorbereitet', installiert: 'Installiert', aktiv: 'Aktiv',
  wartung: 'In Wartung', defekt: 'Defekt', stillgelegt: 'Stillgelegt',
};
export const BOX_TONE = {
  lager: 'mute', vorbereitet: 'info', installiert: 'info', aktiv: 'ok', wartung: 'warn', defekt: 'bad', stillgelegt: 'mute',
};
export const BOX_KANAL = { stable: 'stable', beta: 'beta' };

export const WARTUNG_ART = {
  installation: 'Installation', update: 'Update', backup_pruefung: 'Backup-Prüfung', fernwartung: 'Fernwartung',
  vor_ort: 'Vor-Ort-Termin', reparatur: 'Reparatur', hardwaretausch: 'Hardwaretausch', sonstiges: 'Sonstiges',
};
export const WARTUNG_ERG = { erledigt: 'Erledigt', teilweise: 'Teilweise', fehlgeschlagen: 'Fehlgeschlagen' };
export const WARTUNG_TONE = { erledigt: 'ok', teilweise: 'warn', fehlgeschlagen: 'bad' };

/** Schwellen für Warnungen in Boxen & Übersicht (Tage). */
export const SCHWELLE = { lizenz: 30, wartung: 90, backup: 14, meldung: 2 };

export const fmtNr = (prefix, n) => n ? `${prefix}-${String(n).padStart(4, '0')}` : '';
