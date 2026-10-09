// =====================================================================
// Einwilligungstexte — versioniert und unveränderlich
// =====================================================================
// Konsey 2026-08-14 · konsey/tutanak/2026-08-14-patienten-uebergabe-einwilligung.md
//
// WARUM DIESE DATEI DIE QUELLE IST (und nicht `document_vorlagen`):
//   Die Konsey liess beides zu — `document_vorlagen.vorlage_type`-CHECK
//   erweitern ODER eigene Quelle. Entschieden wurde die eigene Quelle:
//   1. `document_vorlagen` ist inhaberseitig frei editierbar. Ein Inhaber, der
//      seinen Einwilligungstext "kuerzt", zerstoert den Rechtsgrund — das ist
//      ein Risiko, kein Feature.
//   2. Die Tabelle hat keine Versionsspalte; Versionierung muesste dort erst
//      erfunden werden.
//   3. Das generelle Oeffnen des `vorlage_type`-CHECKs steht laut Tutanak
//      ausdruecklich im BACKLOG, nicht im Auftrag.
//   Der Nachweis haengt ohnehin nicht an der Vorlage: in `patient_consents`
//   wird der VOLLE gerenderte Text (`text_snapshot`) + `text_version` +
//   `text_sha256` eingefroren (Art. 7 Abs. 1 DSGVO Nachweispflicht).
//
// ⚠️  VERSIONSREGEL: Wird ein Text inhaltlich geaendert, wird die `version`
//     hochgezaehlt — niemals stillschweigend ueberschrieben. Alte
//     Unterschriften bleiben ueber ihren Snapshot beweisbar.
//
// 01.10.2026 · v2 (Behandlungsvertrag + Datenschutz): nur Schreibweise —
//     ASCII-Umlaute (ae/oe/ue/ss) durch echte Umlaute ersetzt, Inhalt unveraendert
//     (legal-de 01.10.2026). Versionsnummer trotzdem hochgezaehlt, weil sich der
//     eingefrorene Wortlaut (text_sha256) aendert. Alte Unterschriften bleiben ueber
//     ihren Snapshot in patient_consents beweisbar; v1-Text steht dort, nicht hier.
//
// ⚠️  Die Formulierungen sind ein fachlich fundierter Entwurf, aber KEINE
//     Rechtsberatung. Vor dem Go-Live durch `legal-de` gegenlesen lassen.
// =====================================================================

// --- Platzhalter ------------------------------------------------------
// {{praxis_name}} {{praxis_adresse}} {{patient_name}} {{patient_geburtsdatum}}
// {{datum}} {{ausfall_regel}} {{optionen}}

const AUSFALL_FALLBACK =
  'Die Praxis erhebt derzeit keine Ausfallgebühr. Bitte sagen Sie Termine, die Sie nicht '
  + 'wahrnehmen können, dennoch rechtzeitig ab — die Zeit wird sonst für andere Patientinnen '
  + 'und Patienten blockiert.';

/**
 * Baut den Ausfallgebuehr-Absatz aus den Praxiseinstellungen.
 * Quelle ist `profiles.ausfall_*` — NICHT `businesses` (Einzelstandort-Inhaber
 * haben keinen businesses-Datensatz, siehe db/README.md Falle 4).
 */
export function ausfallRegelText(profile) {
  if (!profile || !profile.ausfall_enabled) return AUSFALL_FALLBACK;

  const stunden = Number(profile.ausfall_cutoff_hours) || 24;
  let hoehe;
  if (profile.ausfall_mode === 'percent' && profile.ausfall_percent != null) {
    hoehe = `${String(profile.ausfall_percent).replace('.', ',')} % des Behandlungspreises`;
  } else if (profile.ausfall_amount_eur != null) {
    hoehe = `${Number(profile.ausfall_amount_eur).toFixed(2).replace('.', ',')} Euro`;
  } else {
    return AUSFALL_FALLBACK;
  }

  const zusatz = (profile.ausfall_hinweis || '').trim();
  return (
    `Termine, die Sie nicht wahrnehmen können, sagen Sie bitte spätestens ${stunden} Stunden `
    + `vor Behandlungsbeginn ab. Bei späterer Absage oder Nichterscheinen berechnet die Praxis `
    + `ein Ausfallhonorar von ${hoehe}. Grundlage ist die vertragliche Vereinbarung zwischen `
    + `Ihnen und der Praxis; die Krankenkasse erstattet dieses Honorar nicht. Sagen Sie aus `
    + `einem wichtigen Grund ab (z. B. akute Erkrankung, Unfall), entfällt das Ausfallhonorar.`
    + (zusatz ? `\n${zusatz}` : '')
  );
}

// =====================================================================
// TEXTE
// =====================================================================
// Struktur je Typ:
//   version        — bei jeder inhaltlichen Aenderung hochzaehlen
//   titel          — Ueberschrift auf dem Tablet
//   kurzfassung[]  — grosse, kurze Bloecke oben (Alters-/Diabetes-tauglich)
//   absaetze[]     — Volltext unten; genau das wird unterschrieben
//   optionen[]     — (nur Datenschutz) granulare Opt-ins, Standard: AUS

export const EINWILLIGUNG_TEXTE = {

  // -------------------------------------------------------------------
  // SCHIRM 1 — §630d BGB (Behandlung) + Ausfallregelung
  // Die Ausfallgebuehr gehoert hierher: sie ist eine kommerzielle Bedingung
  // des Behandlungsvertrags, KEINE datenschutzrechtliche Einwilligung.
  // -------------------------------------------------------------------
  behandlungsvertrag: {
    version: 'behandlungsvertrag-v2-2026-10-01',
    consentType: 'behandlungsvertrag',
    titel: 'Behandlungsvertrag und Ausfallregelung',
    kurzfassung: [
      'Sie beauftragen {{praxis_name}} mit Ihrer Behandlung.',
      'Sie wurden über Ablauf, Nutzen und Risiken aufgeklärt und konnten Fragen stellen.',
      'Sie können die Behandlung jederzeit abbrechen.',
      'Termine bitte rechtzeitig absagen — sonst kann ein Ausfallhonorar anfallen.',
    ],
    absaetze: [
      {
        ueberschrift: 'Behandlungsvertrag',
        text:
          'Zwischen Ihnen, {{patient_name}} (geb. {{patient_geburtsdatum}}), und {{praxis_name}}, '
          + '{{praxis_adresse}}, kommt ein Behandlungsvertrag nach §§ 630a ff. BGB zustande. '
          + 'Die Praxis schuldet eine fachgerechte Behandlung nach dem anerkannten fachlichen '
          + 'Standard, nicht einen bestimmten Behandlungserfolg.',
      },
      {
        ueberschrift: 'Aufklärung und Einwilligung (§§ 630d, 630e BGB)',
        text:
          'Sie wurden mündlich und verständlich über Art, Umfang, Durchführung, zu erwartende '
          + 'Folgen und Risiken der vorgesehenen Maßnahmen sowie über Alternativen aufgeklärt. '
          + 'Sie hatten Gelegenheit, Fragen zu stellen, und hatten ausreichend Bedenkzeit. '
          + 'Sie willigen in die besprochenen Behandlungsmaßnahmen ein. Diese Einwilligung '
          + 'können Sie jederzeit und ohne Angabe von Gründen für die Zukunft widerrufen; '
          + 'die Behandlung wird dann nicht fortgesetzt.',
      },
      {
        ueberschrift: 'Mitwirkung',
        text:
          'Für eine sichere Behandlung ist die Praxis auf Ihre Angaben angewiesen. Bitte teilen '
          + 'Sie Vorerkrankungen (insbesondere Diabetes mellitus, Durchblutungs- und '
          + 'Sensibilitätsstörungen), Blutverdünnung (z. B. Marcumar, DOAK), Allergien und '
          + 'Infektionserkrankungen mit — auch dann, wenn sich während der laufenden Behandlung '
          + 'etwas ändert.',
      },
      {
        ueberschrift: 'Dokumentation',
        text:
          'Die Praxis führt eine Patientenakte (§ 630f BGB) und bewahrt sie zehn Jahre nach '
          + 'Abschluss der Behandlung auf. Sie können jederzeit Einsicht nehmen und gegen '
          + 'Kostenerstattung Kopien verlangen (§ 630g BGB).',
      },
      {
        ueberschrift: 'Terminabsage und Ausfallhonorar',
        text: '{{ausfall_regel}}',
      },
    ],
  },

  // -------------------------------------------------------------------
  // SCHIRM 2 — Art. 7 DSGVO. Getrennt vom Behandlungsvertrag, weil sonst
  // Koppelungsverbot (legal-de, bindende Bedingung 2).
  //
  // WICHTIG: Die Behandlung selbst stuetzt sich auf Art. 6 Abs. 1 lit. b i. V. m.
  // Art. 9 Abs. 2 lit. h DSGVO — NICHT auf Einwilligung. Eingewilligt wird hier
  // nur in das, was tatsaechlich freiwillig ist. Deshalb sind die Optionen
  // einzeln waehlbar und standardmaessig AUS.
  // -------------------------------------------------------------------
  datenschutz: {
    version: 'datenschutz-v4-2026-10-09',
    consentType: 'datenschutz',
    titel: 'Datenschutz — Information und Einwilligung',
    kurzfassung: [
      'Ihre Gesundheitsdaten werden nur für Ihre Behandlung und deren Abrechnung verarbeitet.',
      'Ihre Behandlung hängt NICHT davon ab, ob Sie unten zustimmen — alles dort ist freiwillig.',
      'Sie können Ihre Zustimmung jederzeit widerrufen, ohne Nachteile.',
      'Sie haben Auskunfts-, Berichtigungs- und Löschrechte.',
    ],
    absaetze: [
      {
        ueberschrift: 'Verantwortliche Stelle',
        text: 'Verantwortlich für die Verarbeitung Ihrer Daten ist {{praxis_name}}, {{praxis_adresse}}.{{dsb_satz}}',
      },
      {
        // Je nach Betrieb (Box in der Praxis / SaaS) — legal-de 05.10.2026: „Server in Deutschland" war für die Box falsch.
        ueberschrift: 'Praxissoftware',
        text: '{{software_satz}}',
      },
      {
        ueberschrift: 'Zweck und Rechtsgrundlage der Behandlungsdaten',
        text:
          'Ihre Gesundheitsdaten werden verarbeitet, um Sie zu behandeln, die Behandlung zu '
          + 'dokumentieren und abzurechnen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und lit. c '
          + 'i. V. m. Art. 9 Abs. 2 lit. h DSGVO sowie § 630f BGB. Hierfür ist KEINE Einwilligung '
          + 'erforderlich — die Behandlung ist von Ihrer Entscheidung auf dieser Seite unabhängig.',
      },
      {
        ueberschrift: 'Empfänger',
        text:
          'Bei gesetzlich Versicherten werden Abrechnungsdaten nach § 302 SGB V an Ihre '
          + 'Krankenkasse bzw. deren Abrechnungsstelle übermittelt; dazu ist die Praxis '
          + 'gesetzlich verpflichtet. Bei einem Arbeits- oder Wegeunfall erhält der zuständige '
          + 'Unfallversicherungsträger (Berufsgenossenschaft/Unfallkasse) die für die Abrechnung '
          + 'erforderlichen Angaben. Der verordnende Arzt erhält die nach der '
          + 'Heilmittel-Richtlinie vorgesehenen Rückmeldungen. Rechnungs- und Buchungsdaten '
          + '(Rechnungen, jedoch ohne Befunde und Diagnosen) erhält, soweit beauftragt, unser Steuerberater, '
          + 'der ebenfalls zur Verschwiegenheit verpflichtet ist. '
          + 'Andere Empfänger gibt es nur, wenn Sie eingewilligt haben oder ein Gesetz es vorschreibt.',
      },
      {
        // Nur bei aktivem KI-Modul (K-20, Opt-in). Wortlaut legal-de 05.10.2026; vorläufig bis zur
        // Anwaltsantwort (LEGAL_DECISIONS Nachtrag 4): keine Mail-Entwürfe, kein C5-Satz.
        ueberschrift: 'Optionale KI-Unterstützung',
        nur: 'ki',
        text:
          'Für einzelne Planungsaufgaben (z. B. Terminserien entsprechend Ihrer Verordnung) nutzt die '
          + 'Praxis einen KI-Dienst von Microsoft (Microsoft Ireland Operations Ltd., Dublin). '
          + 'Übermittelt werden nur pseudonymisierte Strukturangaben: keine Namen, kein Geburtsdatum, '
          + 'keine Anschrift, keine Versicherten- oder IK-Nummer und kein Freitext. Die Verarbeitung '
          + 'erfolgt in einem Rechenzentrum in Schweden (EU). Microsoft ist Unterauftragsverarbeiter '
          + 'des Softwareanbieters und an einen Auftragsverarbeitungsvertrag gebunden. Zum Schutz vor '
          + 'Missbrauch kann Microsoft auffällige Anfragen speichern und durch Mitarbeiter im '
          + 'Europäischen Wirtschaftsraum prüfen lassen. Eine Übermittlung in Länder außerhalb des Europäischen '
          + 'Wirtschaftsraums ist nicht vorgesehen. Weil Microsoft zu einem Konzern mit Sitz in den USA gehört, sind '
          + 'Zugriffe nach US-Recht nicht völlig auszuschließen. Microsoft ist nach dem EU-US Data '
          + 'Privacy Framework zertifiziert (Angemessenheitsbeschluss der EU-Kommission vom 10.07.2023), '
          + 'zusätzlich gelten EU-Standardvertragsklauseln. Rechtsgrundlage ist Art. 9 Abs. 2 lit. h '
          + 'DSGVO; jedes Ergebnis wird vor der Verwendung von der Praxis geprüft.',
      },
      {
        ueberschrift: 'Pflicht zur Bereitstellung',
        text:
          'Die Angaben zu Ihrer Person, zur Verordnung und zum Kostenträger brauchen wir für '
          + 'Behandlung und Abrechnung. Ohne sie können wir nicht über Ihre Krankenkasse bzw. den '
          + 'Unfallversicherungsträger abrechnen.',
      },
      {
        ueberschrift: 'Speicherdauer',
        text:
          'Behandlungsunterlagen werden zehn Jahre nach Abschluss der Behandlung aufbewahrt '
          + '(§ 630f Abs. 3 BGB); steuer- und handelsrechtliche Fristen bleiben unberührt. '
          + 'Diese Einwilligung wird als Nachweis (Art. 7 Abs. 1 DSGVO) ebenso lange aufbewahrt.',
      },
      {
        ueberschrift: 'Freiwillige Zusatzverarbeitungen — Ihre Auswahl',
        text: '{{optionen}}',
      },
      {
        ueberschrift: 'Widerruf (Art. 7 Abs. 3 DSGVO)',
        text:
          'Sie können jede oben erteilte Einwilligung jederzeit mit Wirkung für die Zukunft '
          + 'widerrufen — formlos, mündlich an der Rezeption, telefonisch oder schriftlich an '
          + '{{praxis_name}}, {{praxis_adresse}}. Der Widerruf berührt die Rechtmäßigkeit der '
          + 'bis dahin erfolgten Verarbeitung nicht. Ein Widerruf hat KEINE nachteiligen Folgen '
          + 'für Ihre Behandlung.',
      },
      {
        ueberschrift: 'Ihre Rechte',
        text:
          'Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung '
          + '(Art. 17, soweit keine gesetzliche Aufbewahrungspflicht entgegensteht), '
          + 'Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) '
          + 'DSGVO. Außerdem können Sie sich bei der zuständigen Datenschutz-Aufsichtsbehörde '
          + 'beschweren (Art. 77 DSGVO).',
      },
    ],
    // Granulare Opt-ins. Standard AUS — vorangekreuzte Kaestchen sind keine
    // wirksame Einwilligung (EuGH C-673/17, "Planet49").
    optionen: [
      {
        key: 'terminerinnerung',
        label: 'Terminerinnerungen per E-Mail oder SMS an mich senden',
        text: 'Terminerinnerungen per E-Mail/SMS',
      },
      {
        key: 'arztkommunikation',
        label: 'Therapieberichte an meinen behandelnden Arzt senden (Entbindung von der Schweigepflicht für diesen Zweck)',
        text: 'Übermittlung von Therapieberichten an den behandelnden Arzt',
      },
    ],
  },

  // -------------------------------------------------------------------
  // Weitere Typen — im Schema bereits zulaessig, laut Tutanak im BACKLOG.
  // Texte hier vorbereitet, damit der spaetere Ausbau kein zweiter Weg wird.
  // -------------------------------------------------------------------
  selbstzahler: {
    version: 'selbstzahler-v1-2026-08-14',
    consentType: 'selbstzahler',
    titel: 'Vereinbarung über Selbstzahlerleistungen',
    kurzfassung: [
      'Diese Leistung zahlt die gesetzliche Krankenkasse nicht.',
      'Sie tragen die Kosten selbst.',
      'Der Preis wurde Ihnen vorher genannt.',
    ],
    absaetze: [
      {
        ueberschrift: 'Gegenstand',
        text:
          'Die nachfolgend besprochene Leistung ist keine Leistung der gesetzlichen '
          + 'Krankenversicherung. Sie wird auf Ihren ausdrücklichen Wunsch erbracht und '
          + 'privat in Rechnung gestellt (§ 3 Abs. 1 BMV-Ae analog, § 630c Abs. 3 BGB).',
      },
      {
        ueberschrift: 'Wirtschaftliche Aufklärung (§ 630c Abs. 3 BGB)',
        text:
          'Sie wurden vor Beginn der Behandlung darüber informiert, dass die Kosten '
          + 'voraussichtlich nicht von einem Kostenträger übernommen werden, und über die '
          + 'voraussichtliche Höhe der Kosten in Textform unterrichtet.',
      },
    ],
  },

  foto: {
    version: 'foto-v2-2026-10-06',
    consentType: 'foto',
    titel: 'Einwilligung in die Fotodokumentation',
    kurzfassung: [
      'Fotos dienen der Verlaufskontrolle Ihres Befundes.',
      'Die Fotos bleiben in Ihrer Patientenakte.',
      'Sie können jederzeit widerrufen.',
    ],
    absaetze: [
      {
        ueberschrift: 'Zweck',
        text:
          'Zur Dokumentation und Verlaufskontrolle des Befundes werden Fotoaufnahmen der '
          + 'betroffenen Körperregion angefertigt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a '
          + 'i. V. m. Art. 9 Abs. 2 lit. a DSGVO (Ihre Einwilligung).',
      },
      {
        ueberschrift: 'Verwendung',
        text:
          'Die Aufnahmen werden ausschließlich in Ihrer Patientenakte gespeichert. Eine '
          + 'Veröffentlichung, Weitergabe zu Werbe-, Schulungs- oder Forschungszwecken erfolgt '
          + 'NICHT. Die Einwilligung ist jederzeit für die Zukunft widerrufbar; die Aufnahmen '
          + 'werden dann gelöscht, soweit keine Aufbewahrungspflicht entgegensteht.',
      },
    ],
  },
};

// =====================================================================
// Rendering + Nachweis
// =====================================================================

// Platzhalter, die leer bleiben dürfen (bedingte Sätze) — alle anderen zeigen ein leeres Feld als [key].
const OPTIONALE_PLATZHALTER = new Set(['dsb_satz']);

function ersetze(str, ctx) {
  return String(str).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = ctx[key];
    if (v === undefined || v === null || v === '') return OPTIONALE_PLATZHALTER.has(key) ? '' : `[${key}]`;
    return String(v);
  });
}

/**
 * Satz zur Praxissoftware je Betrieb (legal-de F6, 05.10.2026).
 * `kutu` = Praxura-Box in der Praxis (Praxis ist allein verantwortlich, der Hersteller hat keine Rolle);
 * alles andere = SaaS (Praxura als Auftragsverarbeiter). Bewusst OHNE § 203-Halbsatz (erst, wenn die
 * Klausel in Praxuras eigener AVV steht) und OHNE Hosting-Ort (`Server in Deutschland` ist nicht geprüft).
 */
// Box + aktives KI-Modul: nur für die KI-Unterstützung ist der Hersteller Auftragsverarbeiter (LEGAL_DECISIONS Nachtrag 4 Nr. 1).
// Ohne diesen Satz widerspräche „hat keinen Zugriff" dem KI-Absatz („Unterauftragsverarbeiter des Softwareanbieters").
const KI_AV_SATZ_KUTU = ' Nur für die optionale KI-Unterstützung (siehe unten) handelt der Softwarehersteller, Yavuz Kemal Demir (Siegburg), '
  + 'als Auftragsverarbeiter der Praxis (Art. 28 DSGVO).';

// Herstellername: bürgerlicher Name, nicht „InfinityMade" (legal-de 09.10.2026, v4).
export function softwareSatz(betrieb) {
  if (betrieb === 'kutu') {
    return 'Die Praxis nutzt die Praxissoftware Praxura, die auf einem Rechner in den Räumen der Praxis betrieben wird. '
      + 'Ihre Daten werden dort gespeichert; der Softwarehersteller hat darauf keinen Zugriff.';
  }
  return 'Die Praxis nutzt die Praxissoftware Praxura. Deren Hersteller, Yavuz Kemal Demir (Siegburg), verarbeitet Ihre Daten '
    + 'ausschließlich nach Weisung der Praxis als Auftragsverarbeiter (Art. 28 DSGVO).';
}

/**
 * Rendert den Optionsblock der Datenschutz-Einwilligung als Klartext.
 * Auch NICHT gewaehlte Optionen werden aufgefuehrt — die Ablehnung ist Teil
 * des Nachweises (Art. 7 Abs. 1: was wurde genau erklaert?).
 */
function optionenText(def, gewaehlt) {
  if (!Array.isArray(def.optionen) || def.optionen.length === 0) return '—';
  const set = new Set(gewaehlt || []);
  return def.optionen
    .map(o => `[${set.has(o.key) ? 'X' : ' '}] ${o.text}: ${set.has(o.key) ? 'JA' : 'NEIN'}`)
    .join('\n');
}

/**
 * Erzeugt den exakten Text, der unterschrieben wird und in
 * `patient_consents.text_snapshot` eingefroren wird.
 *
 * @param {string} type  Schluessel aus EINWILLIGUNG_TEXTE
 * @param {object} ctx   { praxis_name, praxis_adresse, patient_name,
 *                         patient_geburtsdatum, datum, profile, optionen: string[],
 *                         betrieb?: 'kutu'|'saas' (Standard saas), kiAktiv?: boolean (Standard false),
 *                         dsb_kontakt?: string }
 * @returns {{ version:string, titel:string, text:string, def:object }}
 */
export function renderEinwilligungText(type, ctx = {}) {
  const def = EINWILLIGUNG_TEXTE[type];
  if (!def) throw new Error(`Unbekannter Einwilligungstyp: ${type}`);

  const vollCtx = {
    ...ctx,
    ausfall_regel: ctx.ausfall_regel || ausfallRegelText(ctx.profile),
    optionen: optionenText(def, ctx.optionen),
    software_satz: softwareSatz(ctx.betrieb) + (ctx.betrieb === 'kutu' && ctx.kiAktiv === true ? KI_AV_SATZ_KUTU : ''),
    dsb_satz: ctx.dsb_kontakt ? ` Unsere Datenschutzbeauftragte bzw. unseren Datenschutzbeauftragten erreichen Sie unter ${ctx.dsb_kontakt}.` : '',
  };

  const kopf = [
    def.titel,
    `Version: ${def.version}`,
    `Praxis: ${ersetze('{{praxis_name}}, {{praxis_adresse}}', vollCtx)}`,
    `Patient/in: ${ersetze('{{patient_name}} (geb. {{patient_geburtsdatum}})', vollCtx)}`,
    `Datum: ${vollCtx.datum || ''}`,
  ].join('\n');

  const koerper = def.absaetze
    .filter(a => a.nur !== 'ki' || ctx.kiAktiv === true)
    .map(a => `${a.ueberschrift}\n${ersetze(a.text, vollCtx)}`)
    .join('\n\n');

  return {
    version: def.version,
    titel: def.titel,
    text: `${kopf}\n\n${koerper}\n`,
    def,
  };
}

/**
 * SHA-256 als Hex — Nachweis nach Art. 7 Abs. 1 DSGVO.
 * Nutzt die Web Crypto API (im Browser vorhanden, keine Abhaengigkeit).
 * Erfordert einen sicheren Kontext (https oder localhost).
 */
export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// -------------------------------------------------------------------
// K2b.15 (legal-de 09.10.2026): Datenschutzhinweise der Patientenseiten
// booking.html + booking-request.html, wenn die Praxis keine eigene
// Datenschutzerklärung (profiles.praxis_datenschutz_url) hinterlegt hat.
// Reine Information nach Art. 13 — KEINE Einwilligung, deshalb kein Widerruf.
// Keine feste Löschfrist: booking_requests hat (noch) keine automatische Löschung.
// -------------------------------------------------------------------
export const TERMIN_DATENSCHUTZ = Object.freeze({
  version: 'termin-datenschutz-v1-2026-10-09',
  titel: 'Datenschutzhinweise zur Online-Terminvereinbarung',
  absaetze: [
    { ueberschrift: 'Verantwortlich',
      text: 'Verantwortlich für die Verarbeitung Ihrer Daten ist {{praxis_name}}{{inhaber_satz}}, {{praxis_anschrift}}.{{praxis_kontakt}}{{dsb_satz}}' },
    { ueberschrift: 'Zweck und Rechtsgrundlage',
      text: 'Wir verarbeiten die Angaben, die Sie bei der Online-Terminbuchung oder Terminanfrage machen (z. B. Name, '
        + 'Geburtsdatum, Kontaktdaten, gewünschter Termin, Art der Kostenübernahme), um Ihren Termin zu vereinbaren und '
        + 'Ihre Behandlung vorzubereiten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Durchführung vorvertraglicher '
        + 'Maßnahmen auf Ihre Anfrage bzw. Erfüllung des Behandlungsvertrags).\n'
        + 'Soweit Sie Angaben zu Ihrer Gesundheit machen (z. B. Diagnose, Angaben zur ärztlichen Verordnung, Krankenkasse, '
        + 'Hinweise im Freitextfeld), verarbeiten wir diese auf Grundlage von Art. 9 Abs. 2 lit. h, Abs. 3 DSGVO in '
        + 'Verbindung mit § 22 Abs. 1 Nr. 1 lit. b BDSG ausschließlich zur Terminplanung und Behandlung. Alle '
        + 'Mitarbeitenden der Praxis unterliegen der beruflichen Schweigepflicht.' },
    { ueberschrift: 'Pflicht zur Bereitstellung',
      text: 'Name, Geburtsdatum und eine Kontaktmöglichkeit benötigen wir, um Ihren Termin zu vereinbaren; ohne diese '
        + 'Angaben ist eine Online-Terminvereinbarung nicht möglich. Weitere Angaben sind freiwillig. Sie können einen '
        + 'Termin auch telefonisch oder persönlich vereinbaren.' },
    { ueberschrift: 'Praxissoftware', text: '{{software_satz}}' },
    { ueberschrift: 'Empfänger',
      text: 'Ihre Angaben sind nur für die Praxis bestimmt. Eine Übermittlung an Dritte erfolgt nur, wenn Sie eingewilligt '
        + 'haben oder eine gesetzliche Pflicht bzw. Erlaubnis besteht. Sendet die Praxis Ihnen eine Bestätigung per '
        + 'E-Mail, wird diese über den E-Mail-Anbieter der Praxis zugestellt.' },
    { ueberschrift: 'Speicherdauer',
      text: 'Kommt eine Behandlung zustande, werden Ihre Angaben Teil der Patientendokumentation und nach den gesetzlichen '
        + 'Aufbewahrungspflichten (in der Regel zehn Jahre nach Abschluss der Behandlung, § 630f Abs. 3 BGB) aufbewahrt. '
        + 'Kommt keine Behandlung zustande, werden Ihre Angaben gelöscht, sobald sie für die Bearbeitung Ihrer Anfrage '
        + 'nicht mehr erforderlich sind.' },
    { ueberschrift: 'Ihre Rechte',
      text: 'Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung '
        + 'der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Wenden Sie sich dazu an die oben genannte Praxis.' },
    { ueberschrift: 'Beschwerderecht',
      text: 'Sie können sich bei einer Datenschutzaufsichtsbehörde beschweren, insbesondere bei {{aufsichtsbehoerde}}.' },
  ],
});

/**
 * Datenschutzhinweise der Patientenseiten als Absätze (Seite rendert mit textContent).
 * @param {object} angaben  { praxis_name, inhaber_name?, praxis_anschrift, praxis_kontakt?, dsb_kontakt?, aufsichtsbehoerde? }
 * @param {{betrieb?: 'kutu'|'saas'}} [opt]
 */
export function renderTerminDatenschutz(angaben = {}, { betrieb } = {}) {
  const name = String(angaben.praxis_name || '').trim();
  const inhaber = String(angaben.inhaber_name || '').trim();
  const ctx = {
    praxis_name: name,
    inhaber_satz: inhaber && inhaber !== name ? `, Inhaber/in ${inhaber}` : '',
    praxis_anschrift: angaben.praxis_anschrift || '',
    praxis_kontakt: angaben.praxis_kontakt ? ` Kontakt: ${angaben.praxis_kontakt}.` : '',
    dsb_satz: angaben.dsb_kontakt ? ` Unsere Datenschutzbeauftragte bzw. unseren Datenschutzbeauftragten erreichen Sie unter ${angaben.dsb_kontakt}.` : '',
    software_satz: softwareSatz(betrieb),
    aufsichtsbehoerde: angaben.aufsichtsbehoerde || 'der für die Praxis zuständigen Datenschutzaufsichtsbehörde',
  };
  const fuellen = (str) => String(str).replace(/\{\{(\w+)\}\}/g, (_, k) => ctx[k] ?? '');
  return {
    version: TERMIN_DATENSCHUTZ.version,
    titel: TERMIN_DATENSCHUTZ.titel,
    absaetze: TERMIN_DATENSCHUTZ.absaetze.map((a) => ({ ueberschrift: a.ueberschrift, text: fuellen(a.text) })),
  };
}
