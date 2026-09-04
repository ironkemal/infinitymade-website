/**
 * verordnung-topf.js — die Grenze zwischen dem podologischen Wortschatz und
 * der einen Verordnungstabelle.
 *
 * Warum es das gibt
 * ─────────────────
 * Bis zum 04.09.2026 gab es ZWEI Verordnungstöpfe: `prescriptions` (Muster-13-
 * Maske, OCR, Physio/Ergo/Logo) und `verordnungen` (Podologie-Abrechnung).
 * Dieselbe Sache, zwei Tabellen, keine Verbindung — mit der Folge, dass ein
 * gescanntes podologisches Rezept in `prescriptions` landete und die §-302-
 * Kette, die nur `verordnungen` las, es nie zu sehen bekam. Live standen
 * 9 podologische Verordnungen im falschen Topf und waren damit nicht
 * abrechenbar.
 *
 * Kemal, 04.09.2026: „ikisinin de aynı tabloya yazması lazım … 2 tablo olduğu
 * için her tarafta arızalar çıkıyor, biri oraya biri buraya çıkıyor, tek tablo
 * olması şart bu iş için."
 *
 * Zieltabelle ist `prescriptions` — nicht weil sie den schöneren Namen hat,
 * sondern weil der Weg dorthin 9 statt 47 Spalten, 7 statt 242 Zeilen und
 * 72 statt 168 Codestellen kostet.
 *
 * Was diese Datei NICHT ist
 * ─────────────────────────
 * Kein zweiter Topf und kein Cache. Es gibt genau eine Tabelle; hier werden
 * nur SPALTENNAMEN übersetzt. Der podologische Zweig spricht seit Juni von
 * `lead_id`, `behandlungseinheiten`, `therapiefrequenz` — die Zieltabelle
 * nennt dieselben Dinge `patient_id`, `anzahl_einheiten`, `frequenz`.
 *
 * ⚠️ Diese Datei ist AUF ABRUF. Sobald die Spalten in `prescriptions` auf die
 * deutschen Namen umgetauft sind (vertagte, rein kosmetische Migration), fällt
 * sie ersatzlos weg. Sie hier zu haben ist billiger und sicherer, als in einem
 * Zug 105 Feldzugriffe in fünf Dateien blind umzuschreiben.
 *
 * Die drei Fallen, die beim Übersetzen Geld kosten
 * ────────────────────────────────────────────────
 *  1. `status` heisst in beiden Töpfen `status`, meint aber Verschiedenes.
 *     `prescriptions.status` ist die BEARBEITUNGS-achse (parsed→confirmed→…),
 *     der alte `verordnungen.status` war die ABRECHNUNGS-achse. Das Gegenstück
 *     ist `prescriptions.abrechnung_status`. Wer die beiden verwechselt, setzt
 *     eine laufende Behandlung auf „abgerechnet".
 *  2. `icd10` ist hier ein Feld plus `icd10_2`, dort war es ein `text[]`.
 *  3. `beginn_spaetestens` hiess in `prescriptions` immer `gueltig_bis` — ein
 *     Fehlname: der Wert ist Ausstellung + 14/28 Tage nach HeilM-RL § 15, also
 *     der SPÄTESTE BEGINN, nicht das Ende der Gültigkeit.
 */

/** Die eine Tabelle. Über diese Konstante, damit die spätere Umbenennung eine Zeile ist. */
export const TOPF = 'prescriptions';

/**
 * Auswahl für die podologische Arbeitsliste.
 * `leads(patientennummer)` für die Belegnummer neben dem Namen (`belegnummer`
 * ist bis zur ersten Abrechnung leer), `leads(business_id)` für den Standort.
 */
export const PODO_SELECT = '*, leads!patient_id(patientennummer, business_id)';

// ── Statusachse ─────────────────────────────────────────────────────────────

/** alter verordnungen.status → prescriptions.abrechnung_status */
const NACH_TOPF = Object.freeze({
  aktiv:          null,
  abrechenbar:    'bereit',
  abgerechnet:    'gesendet',
  abgesetzt:      'rejected',
  teilabsetzung:  'teilabsetzung',
  storniert:      'storniert',
  archiviert:     'archiviert',
});

/**
 * prescriptions.abrechnung_status → alter verordnungen.status
 *
 * Nicht die Umkehrung von NACH_TOPF: die Zieltabelle kennt drei Werte mehr
 * (`in_abrechnung`, `accepted`, `paid`), die es im podologischen Zweig nie
 * gab. Alle drei bedeuten dort „ist raus" — also `abgerechnet`. Sie auf
 * `aktiv` fallen zu lassen wäre der teure Fehler: eine bereits eingereichte
 * Verordnung stünde wieder in der Arbeitsliste und würde ein zweites Mal
 * abgerechnet.
 */
const AUS_TOPF = Object.freeze({
  bereit:         'abrechenbar',
  in_abrechnung:  'abgerechnet',
  gesendet:       'abgerechnet',
  accepted:       'abgerechnet',
  paid:           'abgerechnet',
  rejected:       'abgesetzt',
  teilabsetzung:  'teilabsetzung',
  storniert:      'storniert',
  archiviert:     'archiviert',
});

/** Abrechnungsstatus einer Zeile im podologischen Wortschatz. `null` = `aktiv`. */
export function statusAusTopf(abrechnungStatus) {
  if (abrechnungStatus == null || abrechnungStatus === '') return 'aktiv';
  return AUS_TOPF[abrechnungStatus] || 'aktiv';
}

/** Podologischer Status → Spaltenwert. Unbekanntes bleibt `undefined`, nicht `null`. */
export function statusInTopf(status) {
  if (status == null) return undefined;
  return Object.prototype.hasOwnProperty.call(NACH_TOPF, status) ? NACH_TOPF[status] : undefined;
}

/**
 * Die Statusfilter der podologischen Arbeitsliste als PostgREST-`or`.
 *
 * `aktiv` ist in der Zieltabelle NULL, und `.in()` trifft NULL nicht — deshalb
 * die `or`-Form statt einer Liste.
 *
 * ⚠️ SPIEGEL von `VERORDNUNG_EINREICHBAR` in
 * `api-backend/billing/utils/einreichbar.js`. Zwei Deploys (Vercel hier,
 * Docker dort), kein gemeinsamer Build — wer eine ändert, ändert beide, sonst
 * zeigt die Arbeitsliste eine Verordnung, die das Backend mit 409 abweist.
 */
export const PODO_ARBEITSLISTE_OR =
  'abrechnung_status.is.null,abrechnung_status.in.(bereit,rejected,teilabsetzung)';

// ── Zeilenübersetzung ───────────────────────────────────────────────────────

/**
 * Eine Zeile aus `prescriptions` in den podologischen Wortschatz.
 *
 * Die Zieltabellen-Felder bleiben ALLE erhalten — es kommen nur Aliasnamen
 * dazu. So kann aufrufender Code schrittweise auf die neuen Namen umziehen,
 * ohne dass etwas dazwischen bricht.
 *
 * @param {object} row  Zeile aus `prescriptions` (mit `leads`-Verbund)
 * @returns {object}
 */
export function ausTopf(row) {
  if (!row) return row;
  return {
    ...row,

    // Patientenbezug
    lead_id:              row.patient_id ?? null,

    // Menge und Takt
    behandlungseinheiten: row.anzahl_einheiten ?? null,
    therapiefrequenz:     row.frequenz ?? null,

    // Fristen. `gueltig_bis` ist der späteste Beginn, siehe Kopf.
    behandlungsstart:     row.behandlungsbeginn ?? null,
    beginn_spaetestens:   row.gueltig_bis ?? null,

    // Kennzeichen
    dringend:             row.is_dringend === true,
    therapiebericht:      row.bericht_angefordert === true,

    // ICD als Liste — der podologische Zweig prüft mit Mengenoperationen.
    icd10:                [row.icd10, row.icd10_2].filter(Boolean),

    // ⚠️ Achse tauschen: `status` heisst hier Abrechnung, nicht Bearbeitung.
    //    Die Bearbeitungsachse bleibt unter ihrem eigenen Namen erreichbar.
    status:               statusAusTopf(row.abrechnung_status),
    bearbeitung_status:   row.status ?? null,
  };
}

/**
 * Podologisches Formularobjekt → Nutzlast für `prescriptions`.
 *
 * Nur die Felder, die das podologische Formular tatsächlich führt. Alles
 * andere (OCR-Spalten, PHI-Schatten, Zuzahlungs-Kassierung) wird bewusst
 * NICHT angefasst — sonst überschriebe ein Speichern aus diesem Formular
 * Felder, die es gar nicht anzeigt.
 *
 * @param {object} v  Formularobjekt im alten `verordnungen`-Wortschatz
 * @returns {object}  Nutzlast für insert/update auf `prescriptions`
 */
export function inTopf(v) {
  if (!v) return {};

  const nutzlast = {};
  const nimm = (quelle, ziel, wandle) => {
    if (!Object.prototype.hasOwnProperty.call(v, quelle)) return;
    nutzlast[ziel] = wandle ? wandle(v[quelle]) : v[quelle];
  };

  // Gleicher Name auf beiden Seiten
  for (const f of ['owner_id', 'patient_name', 'arzt_id', 'ausstellungsdatum',
                   'diagnosegruppe', 'leitsymptomatik', 'pat_leitsymptomatik',
                   'heilmittel_items', 'hausbesuch', 'wagner_grad',
                   'versichertennummer', 'behandlungsanlass', 'notizen',
                   'rezeptart', 'kostentraeger_ik', 'zuzahlung_befreit',
                   // Nagelspange: behandelter Zehennagel, „U1 links" .. „U5
                   // rechts" (§ 3b Satz 5). Haelt die Behandlungsserie ueber
                   // mehrere Verordnungen zusammen; heisst beidseitig gleich.
                   'nagel']) {
    nimm(f, f);
  }

  // Umbenennungen
  nimm('lead_id',              'patient_id');
  nimm('behandlungseinheiten', 'anzahl_einheiten');
  nimm('therapiefrequenz',     'frequenz');
  nimm('behandlungsstart',     'behandlungsbeginn');
  nimm('beginn_spaetestens',   'gueltig_bis');
  nimm('dringend',             'is_dringend',         x => x === true);
  nimm('therapiebericht',      'bericht_angefordert', x => x === true);

  // Liste → zwei Felder. Nur anfassen, wenn ICD ueberhaupt mitgegeben wurde.
  if (Object.prototype.hasOwnProperty.call(v, 'icd10')) {
    const icds = Array.isArray(v.icd10) ? v.icd10.filter(Boolean) : [v.icd10].filter(Boolean);
    nutzlast.icd10   = icds[0] ?? null;
    nutzlast.icd10_2 = icds[1] ?? null;
  }

  // Der podologische Zweig ist an dieser Tabelle kenntlich — ohne die
  // Markierung liesse sich später nicht mehr sagen, welche Zeile aus welcher
  // Maske stammt.
  nutzlast.therapie_bereich = 'podo';

  // Den Abrechnungsstatus nur setzen, wenn das Formular ihn wirklich meint.
  // Fehlt er, heisst das „nicht anfassen" — ein blindes `null` holte eine
  // eingereichte Verordnung zurück auf „aktiv" und damit ein zweites Mal in
  // die Abrechnung.
  if (v.status != null) nutzlast.abrechnung_status = statusInTopf(v.status);

  return nutzlast;
}

/**
 * Trägt diese Praxis ein Einheiten-Hauptbuch (`prescription_sessions`)?
 *
 * Physio/Ergo/Logo: ja — eine Zeile je verordneter Einheit, ab Anlage der
 * Verordnung (`module/sitzung-abgleich.js`).
 * Podologie: NEIN, und das ist eine Entscheidung, keine Lücke. Dort lautet die
 * Frage „zu welcher Verordnung gehört dieser Termin?" (`bookings.verordnung_id`),
 * nicht „welche der 6 Einheiten hat dieser Termin erfüllt?" — Begründung mit
 * Fundstellen in `module/verordnung-termine.js`.
 *
 * Seit der Zusammenlegung tragen podologische Zeilen `anzahl_einheiten`, und
 * ohne diese Bremse legte `gleicheSitzungenAb()` ihnen beim ersten Öffnen des
 * Seitenbereichs ein Hauptbuch an, das niemand pflegt und das dem Zähler in
 * `terminZaehler()` widerspräche — zwei Wahrheiten über dieselbe Menge.
 *
 * @param {?string} sector  `profiles.sector`
 * @returns {boolean}
 */
export function fuehrtSitzungsbuch(sector) {
  return sector !== 'podologie';
}
