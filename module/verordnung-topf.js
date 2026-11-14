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
 *
 * `first_name, last_name` (05.09.2026 ergänzt) für den Anzeigenamen —
 * `prescriptions.patient_name` ist nur ein Freitext-Schnappschuss vom Anlegen
 * und bleibt bei vielen über die Kartei angelegten Zeilen leer. Ohne diese
 * beiden Spalten hatte `patientAnzeigename()` unten nichts zum Nachschlagen
 * und fiel für genau diese Zeilen still auf „—" zurück (Behandlungen-Liste,
 * Mahnwesen).
 */
// `versichertennummer, geburtsdatum, versichertenstatus` seit 10.09.2026
// dabei: der §302-Preflight in `module/abrechnung-auswahl.js` muss dieselben
// Pflichtfelder prüfen können, die das Backend (`create-podologie`) sonst
// erst beim Erstellen mit 422 ablehnt (`!np.nachname`, fehlende
// Versichertennummer) — vorher standen sie nicht im Select und die Lücke war
// von der Auswahlliste aus unsichtbar.
export const PODO_SELECT = '*, leads!patient_id(first_name, last_name, patientennummer, business_id, versichertennummer, geburtsdatum, versichertenstatus)';

/**
 * @typedef {{
 *   leads?: { first_name?: string | null, last_name?: string | null } | null,
 *   patient_name?: string | null,
 * }} PatientAnzeigeEingabe
 * @typedef {Record<string, unknown> & {
 *   patient_id?: string | null,
 *   anzahl_einheiten?: number | null,
 *   frequenz?: string | null,
 *   behandlungsbeginn?: string | null,
 *   gueltig_bis?: string | null,
 *   is_dringend?: boolean | null,
 *   bericht_angefordert?: boolean | null,
 *   icd10?: string | null,
 *   icd10_2?: string | null,
 *   abrechnung_status?: string | null,
 *   status?: string | null,
 *   wagner_grad?: number | null,
 * }} TopfZeileEingabe
 * @typedef {Record<string, unknown> & {
 *   lead_id: string | null,
 *   behandlungseinheiten: number | null,
 *   therapiefrequenz: string | null,
 *   behandlungsstart: string | null,
 *   beginn_spaetestens: string | null,
 *   dringend: boolean,
 *   therapiebericht: boolean,
 *   icd10: string[],
 *   status: string,
 *   bearbeitung_status: string | null,
 *   patient_id?: string | null,
 *   anzahl_einheiten?: number | null,
 *   wagner_grad?: number | null,
 *   hausbesuch?: boolean,
 * }} AusTopfZeile
 * @typedef {Record<string, unknown> & {
 *   patient_id?: string | null,
 *   anzahl_einheiten?: number | null,
 *   frequenz?: string | null,
 *   is_dringend?: boolean,
 *   bericht_angefordert?: boolean,
 *   behandlungsbeginn?: string | null,
 *   gueltig_bis?: string | null,
 *   icd10?: string | null,
 *   icd10_2?: string | null,
 *   therapie_bereich?: 'podo',
 *   abrechnung_status?: string | null,
 * }} InTopfNutzlast
 */

/**
 * Der Anzeigename einer podologischen Zeile: Kartei (`leads`-Verbund) zuerst,
 * das Freitextfeld `patient_name` nur als Notbehelf für Altzeilen ohne
 * `lead_id` (siehe Kopf dieser Datei). `null`, wenn beides fehlt — die
 * aufrufende Stelle entscheidet selbst, ob dafür „—" oder ein anderer
 * Platzhalter steht.
 *
 * @param {PatientAnzeigeEingabe | null | undefined} v  Zeile im podologischen Wortschatz (ausTopf-Ergebnis, trägt `.leads`)
 * @returns {string|null}
 */
export function patientAnzeigename(v) {
  const p = v?.leads || {};
  const voll = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return voll || v?.patient_name || null;
}

// ── Statusachse ─────────────────────────────────────────────────────────────

/**
 * alter verordnungen.status → prescriptions.abrechnung_status
 * @type {Readonly<Record<string, string | null>>}
 */
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
 * @type {Readonly<Record<string, string>>}
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

/**
 * Abrechnungsstatus einer Zeile im podologischen Wortschatz. `null` = `aktiv`.
 * @param {string | null | undefined} abrechnungStatus
 * @returns {string}
 */
export function statusAusTopf(abrechnungStatus) {
  if (abrechnungStatus == null || abrechnungStatus === '') return 'aktiv';
  return AUS_TOPF[abrechnungStatus] || 'aktiv';
}

/**
 * Podologischer Status → Spaltenwert. Unbekanntes bleibt `undefined`, nicht `null`.
 * @param {string | null | undefined} status
 * @returns {string | null | undefined}
 */
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

/**
 * Bereits an die Kasse gegangene (oder von ihr beantwortete) Verordnungen —
 * NUR für die read-only Anzeige, NICHT für Faturalama-Uygunluğu.
 *
 * Getrennt von PODO_ARBEITSLISTE_OR gehalten, weil jener Filter mit dem
 * Backend gespiegelt ist (siehe dort) und über AUSWAHL für den Sammellauf
 * entscheidet. Diese Konstante entscheidet nur, was in der Liste (eingeklappt,
 * salt-okunur) und in der Patientenakte SICHTBAR ist — Absetzung/Zahlung
 * ändert daran nichts, die Verordnung bleibt für den Podologen einsehbar.
 */
export const PODO_ABGERECHNET_OR =
  'abrechnung_status.in.(in_abrechnung,gesendet,accepted,paid)';

// ── Zeilenübersetzung ───────────────────────────────────────────────────────

/**
 * Eine Zeile aus `prescriptions` in den podologischen Wortschatz.
 *
 * Die Zieltabellen-Felder bleiben ALLE erhalten — es kommen nur Aliasnamen
 * dazu. So kann aufrufender Code schrittweise auf die neuen Namen umziehen,
 * ohne dass etwas dazwischen bricht.
 *
 * @overload
 * @param {null | undefined} row
 * @returns {null | undefined}
 */
/**
 * @overload
 * @param {TopfZeileEingabe} row
 * @returns {AusTopfZeile}
 */
/**
 * @param {TopfZeileEingabe | null | undefined} row  Zeile aus `prescriptions` (mit `leads`-Verbund)
 * @returns {AusTopfZeile | null | undefined}
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
    icd10:                [row.icd10, row.icd10_2].filter(/** @returns {x is string} */ (x) => Boolean(x)),

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
 * @param {(Record<string, unknown> & { icd10?: string | string[] | null, status?: string | null }) | null | undefined} v  Formularobjekt im alten `verordnungen`-Wortschatz
 * @returns {InTopfNutzlast}  Nutzlast für insert/update auf `prescriptions`
 */
export function inTopf(v) {
  if (!v) return /** @type {InTopfNutzlast} */ ({});

  /** @type {Record<string, unknown>} */
  const nutzlast = {};
  /**
   * @param {string} quelle
   * @param {string} ziel
   * @param {((val: unknown) => unknown)} [wandle]
   */
  const nimm = (quelle, ziel, wandle) => {
    if (!Object.prototype.hasOwnProperty.call(v, quelle)) return;
    nutzlast[ziel] = wandle ? wandle(v[quelle]) : v[quelle];
  };

  // Gleicher Name auf beiden Seiten
  for (const f of ['owner_id', 'patient_name', 'arzt_id', 'ausstellungsdatum',
                   'diagnosegruppe', 'leitsymptomatik', 'pat_leitsymptomatik',
                   'heilmittel_items', 'hausbesuch', 'wagner_grad',
                   'versichertennummer', 'behandlungsanlass', 'notizen',
                   'rezeptart', 'kostentraeger_ik', 'krankenkasse_ik', 'zuzahlung_befreit',
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
  // ⚠️ Ops #310: `inTopf()` hat heute (18.09.2026) KEINEN Aufrufer in
  // Produktion (nur Tests) — falls das je aktiv wird, muss dieser Zweig auch
  // `abrechnung_status_manuell_am/_von` setzen, sonst umgeht dieser Schreibweg
  // den Stempel aus `verordnung-status.routes.js` und die Automatik ueberschreibt
  // eine hier gesetzte Entscheidung doch wieder still.
  if (v.status != null) nutzlast.abrechnung_status = statusInTopf(v.status);

  return /** @type {InTopfNutzlast} */ (nutzlast);
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
 * Bestätigt am 18.09.2026 (`db-ustasi` + `fonksiyon-ustasi`), als der
 * Terminbereich für die Podologie offene Einheiten bekam: sie werden dort
 * BERECHNET (`module/podo-einheiten.js`), nicht als Zeilen geführt. Die
 * Begründung — drei konkrete Kollisionen — steht in `db/REGISTER.md`, Eintrag
 * `prescription_sessions`.
 *
 * Seit der Zusammenlegung tragen podologische Zeilen `anzahl_einheiten`, und
 * ohne diese Bremse legte `gleicheSitzungenAb()` ihnen beim ersten Öffnen des
 * Seitenbereichs ein Hauptbuch an, das niemand pflegt und das dem Zähler in
 * `terminZaehler()` widerspräche — zwei Wahrheiten über dieselbe Menge.
 *
 * @param {string | null | undefined} sector  `profiles.sector`
 * @returns {boolean}
 */
export function fuehrtSitzungsbuch(sector) {
  return sector !== 'podologie';
}
