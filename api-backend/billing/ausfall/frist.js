// Prüft, ob für einen Termin überhaupt eine Ausfallrechnung erstellt werden darf.
//
// Warum es das gibt (Loop-Liste "Kassieren", Aufgabe 8, Lücke L1):
// Die Prüfung lief bisher NUR im Browser. Wer den Aufruf direkt absetzte, konnte
// eine Ausfallrechnung auch für eine rechtzeitige Absage erzeugen oder obwohl die
// Ausfallgebühr in den Einstellungen ausgeschaltet war. Genau die Bedingung, die
// die Forderung trägt — die verletzte Absagefrist — wurde nie serverseitig geprüft.
//
// Bewusst als reine Funktion ohne DB-Zugriff, damit sie testbar ist.

/** Gründe, aus denen eine Ausfallrechnung abgelehnt wird. */
export const ABLEHNUNGSGRUND = {
  DEAKTIVIERT:      'ausfallgebuehr_deaktiviert',
  RECHTZEITIG:      'rechtzeitig_abgesagt',
  KEIN_TERMINDATUM: 'kein_termindatum',
};

const MELDUNGEN = {
  [ABLEHNUNGSGRUND.DEAKTIVIERT]:
    'Die Ausfallgebühr ist in den Einstellungen nicht aktiviert. Bitte zuerst unter Einstellungen → Ausfallgebühr einschalten.',
  [ABLEHNUNGSGRUND.RECHTZEITIG]:
    'Der Termin wurde innerhalb der Absagefrist abgesagt — dafür darf keine Ausfallrechnung gestellt werden.',
  [ABLEHNUNGSGRUND.KEIN_TERMINDATUM]:
    'Zu diesem Termin fehlt die Uhrzeit, die Absagefrist lässt sich deshalb nicht prüfen.',
};

/**
 * @param {object}  opts
 * @param {boolean} opts.enabled       profiles.ausfall_enabled
 * @param {string}  opts.reason        'no_show' | 'late_cancel'
 * @param {number}  [opts.cutoffHours] profiles.ausfall_cutoff_hours (Vorgabe 24)
 * @param {string|Date} [opts.terminStart] bookings.start_time
 * @param {Date}    [opts.jetzt]       Zeitpunkt der Absage (Vorgabe: jetzt)
 * @param {boolean} [opts.override]    bewusstes Übersteuern durch die Praxis
 *
 * @returns {{
 *   erlaubt: boolean, uebersteuert: boolean,
 *   grund: string|null, meldung: string|null, vorlaufStunden: number|null
 * }}
 */
export function pruefeAusfallFrist({
  enabled,
  reason,
  cutoffHours = 24,
  terminStart = null,
  jetzt = new Date(),
  override = false,
} = {}) {
  const frist = Number(cutoffHours);
  const grenze = Number.isFinite(frist) && frist >= 0 ? frist : 24;

  let vorlaufStunden = null;
  if (terminStart) {
    const start = terminStart instanceof Date ? terminStart : new Date(terminStart);
    if (!Number.isNaN(start.getTime())) {
      vorlaufStunden = (start.getTime() - jetzt.getTime()) / 3600000;
    }
  }

  const ablehnen = (grund) => ({
    // Übersteuern hebt die Sperre auf, der Grund bleibt aber erhalten und wird
    // vom Aufrufer in notes protokolliert — sonst wäre nicht nachvollziehbar,
    // warum trotz Sperre abgerechnet wurde.
    erlaubt: !!override,
    uebersteuert: !!override,
    grund,
    meldung: MELDUNGEN[grund] || null,
    vorlaufStunden,
  });

  const zulassen = () => ({
    erlaubt: true, uebersteuert: false, grund: null, meldung: null, vorlaufStunden,
  });

  if (!enabled) return ablehnen(ABLEHNUNGSGRUND.DEAKTIVIERT);

  // Nicht erschienen: hier gibt es nichts zu prüfen — der Patient ist schlicht
  // ausgeblieben, eine Absagefrist spielt keine Rolle.
  if (reason === 'no_show') return zulassen();

  // Kurzfristige Absage: nur zulässig, wenn die Frist wirklich verletzt wurde.
  if (vorlaufStunden === null) return ablehnen(ABLEHNUNGSGRUND.KEIN_TERMINDATUM);
  if (vorlaufStunden >= grenze) return ablehnen(ABLEHNUNGSGRUND.RECHTZEITIG);

  return zulassen();
}

/** Kurze deutsche Protokollzeile für notes, wenn bewusst übersteuert wurde. */
export function uebersteuerungsNotiz(pruefung, datum = new Date()) {
  if (!pruefung?.uebersteuert) return null;
  const stand = datum.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
  return `Trotz Sperre erstellt (${pruefung.grund}) am ${stand}.`;
}
