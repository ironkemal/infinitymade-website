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
// ⚠️  Die Formulierungen sind ein fachlich fundierter Entwurf, aber KEINE
//     Rechtsberatung. Vor dem Go-Live durch `legal-de` gegenlesen lassen.
// =====================================================================

// --- Platzhalter ------------------------------------------------------
// {{praxis_name}} {{praxis_adresse}} {{patient_name}} {{patient_geburtsdatum}}
// {{datum}} {{ausfall_regel}} {{optionen}}

const AUSFALL_FALLBACK =
  'Die Praxis erhebt derzeit keine Ausfallgebuehr. Bitte sagen Sie Termine, die Sie nicht '
  + 'wahrnehmen koennen, dennoch rechtzeitig ab — die Zeit wird sonst fuer andere Patientinnen '
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
    `Termine, die Sie nicht wahrnehmen koennen, sagen Sie bitte spaetestens ${stunden} Stunden `
    + `vor Behandlungsbeginn ab. Bei spaeterer Absage oder Nichterscheinen berechnet die Praxis `
    + `ein Ausfallhonorar von ${hoehe}. Grundlage ist die vertragliche Vereinbarung zwischen `
    + `Ihnen und der Praxis; die Krankenkasse erstattet dieses Honorar nicht. Sagen Sie aus `
    + `einem wichtigen Grund ab (z. B. akute Erkrankung, Unfall), entfaellt das Ausfallhonorar.`
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
    version: 'behandlungsvertrag-v1-2026-08-14',
    consentType: 'behandlungsvertrag',
    titel: 'Behandlungsvertrag und Ausfallregelung',
    kurzfassung: [
      'Sie beauftragen {{praxis_name}} mit Ihrer Behandlung.',
      'Sie wurden ueber Ablauf, Nutzen und Risiken aufgeklaert und konnten Fragen stellen.',
      'Sie koennen die Behandlung jederzeit abbrechen.',
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
        ueberschrift: 'Aufklaerung und Einwilligung (§§ 630d, 630e BGB)',
        text:
          'Sie wurden muendlich und verstaendlich ueber Art, Umfang, Durchfuehrung, zu erwartende '
          + 'Folgen und Risiken der vorgesehenen Massnahmen sowie ueber Alternativen aufgeklaert. '
          + 'Sie hatten Gelegenheit, Fragen zu stellen, und hatten ausreichend Bedenkzeit. '
          + 'Sie willigen in die besprochenen Behandlungsmassnahmen ein. Diese Einwilligung '
          + 'koennen Sie jederzeit und ohne Angabe von Gruenden fuer die Zukunft widerrufen; '
          + 'die Behandlung wird dann nicht fortgesetzt.',
      },
      {
        ueberschrift: 'Mitwirkung',
        text:
          'Fuer eine sichere Behandlung ist die Praxis auf Ihre Angaben angewiesen. Bitte teilen '
          + 'Sie Vorerkrankungen (insbesondere Diabetes mellitus, Durchblutungs- und '
          + 'Sensibilitaetsstoerungen), Blutverduennung (z. B. Marcumar, DOAK), Allergien und '
          + 'Infektionserkrankungen mit — auch dann, wenn sich waehrend der laufenden Behandlung '
          + 'etwas aendert.',
      },
      {
        ueberschrift: 'Dokumentation',
        text:
          'Die Praxis fuehrt eine Patientenakte (§ 630f BGB) und bewahrt sie zehn Jahre nach '
          + 'Abschluss der Behandlung auf. Sie koennen jederzeit Einsicht nehmen und gegen '
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
    version: 'datenschutz-v1-2026-08-14',
    consentType: 'datenschutz',
    titel: 'Datenschutz — Information und Einwilligung',
    kurzfassung: [
      'Ihre Gesundheitsdaten werden nur fuer Ihre Behandlung und deren Abrechnung verarbeitet.',
      'Ihre Behandlung haengt NICHT davon ab, ob Sie unten zustimmen — alles dort ist freiwillig.',
      'Sie koennen Ihre Zustimmung jederzeit widerrufen, ohne Nachteile.',
      'Sie haben Auskunfts-, Berichtigungs- und Loeschrechte.',
    ],
    absaetze: [
      {
        ueberschrift: 'Verantwortliche Stelle',
        text:
          'Verantwortlich fuer die Verarbeitung Ihrer Daten ist {{praxis_name}}, '
          + '{{praxis_adresse}}. Die Praxis nutzt die Praxissoftware Praxura; deren Anbieter '
          + 'verarbeitet Ihre Daten ausschliesslich weisungsgebunden als Auftragsverarbeiter '
          + '(Art. 28 DSGVO) auf Servern in Deutschland.',
      },
      {
        ueberschrift: 'Zweck und Rechtsgrundlage der Behandlungsdaten',
        text:
          'Ihre Gesundheitsdaten werden verarbeitet, um Sie zu behandeln, die Behandlung zu '
          + 'dokumentieren und abzurechnen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und lit. c '
          + 'i. V. m. Art. 9 Abs. 2 lit. h DSGVO sowie § 630f BGB. Hierfuer ist KEINE Einwilligung '
          + 'erforderlich — die Behandlung ist von Ihrer Entscheidung auf dieser Seite unabhaengig.',
      },
      {
        ueberschrift: 'Empfaenger',
        text:
          'Bei gesetzlich Versicherten werden Abrechnungsdaten nach § 302 SGB V an Ihre '
          + 'Krankenkasse bzw. deren Abrechnungsstelle uebermittelt; dazu ist die Praxis '
          + 'gesetzlich verpflichtet. Der verordnende Arzt erhaelt die nach der '
          + 'Heilmittel-Richtlinie vorgesehenen Rueckmeldungen. Darueber hinaus werden Ihre '
          + 'Daten nicht an Dritte weitergegeben.',
      },
      {
        ueberschrift: 'Speicherdauer',
        text:
          'Behandlungsunterlagen werden zehn Jahre nach Abschluss der Behandlung aufbewahrt '
          + '(§ 630f Abs. 3 BGB); steuer- und handelsrechtliche Fristen bleiben unberuehrt. '
          + 'Diese Einwilligung wird als Nachweis (Art. 7 Abs. 1 DSGVO) ebenso lange aufbewahrt.',
      },
      {
        ueberschrift: 'Freiwillige Zusatzverarbeitungen — Ihre Auswahl',
        text: '{{optionen}}',
      },
      {
        ueberschrift: 'Widerruf (Art. 7 Abs. 3 DSGVO)',
        text:
          'Sie koennen jede oben erteilte Einwilligung jederzeit mit Wirkung fuer die Zukunft '
          + 'widerrufen — formlos, muendlich an der Rezeption, telefonisch oder schriftlich an '
          + '{{praxis_name}}, {{praxis_adresse}}. Der Widerruf beruehrt die Rechtmaessigkeit der '
          + 'bis dahin erfolgten Verarbeitung nicht. Ein Widerruf hat KEINE nachteiligen Folgen '
          + 'fuer Ihre Behandlung.',
      },
      {
        ueberschrift: 'Ihre Rechte',
        text:
          'Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Loeschung '
          + '(Art. 17, soweit keine gesetzliche Aufbewahrungspflicht entgegensteht), '
          + 'Einschraenkung (Art. 18), Datenuebertragbarkeit (Art. 20) und Widerspruch (Art. 21) '
          + 'DSGVO. Ausserdem koennen Sie sich bei der zustaendigen Datenschutz-Aufsichtsbehoerde '
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
        label: 'Therapieberichte an meinen behandelnden Arzt senden (Entbindung von der Schweigepflicht fuer diesen Zweck)',
        text: 'Uebermittlung von Therapieberichten an den behandelnden Arzt',
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
    titel: 'Vereinbarung ueber Selbstzahlerleistungen',
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
          + 'Krankenversicherung. Sie wird auf Ihren ausdruecklichen Wunsch erbracht und '
          + 'privat in Rechnung gestellt (§ 3 Abs. 1 BMV-Ae analog, § 630c Abs. 3 BGB).',
      },
      {
        ueberschrift: 'Wirtschaftliche Aufklaerung (§ 630c Abs. 3 BGB)',
        text:
          'Sie wurden vor Beginn der Behandlung darueber informiert, dass die Kosten '
          + 'voraussichtlich nicht von einem Kostentraeger uebernommen werden, und ueber die '
          + 'voraussichtliche Hoehe der Kosten in Textform unterrichtet.',
      },
    ],
  },

  foto: {
    version: 'foto-v1-2026-08-14',
    consentType: 'foto',
    titel: 'Einwilligung in die Fotodokumentation',
    kurzfassung: [
      'Fotos dienen der Verlaufskontrolle Ihres Befundes.',
      'Die Fotos bleiben in Ihrer Patientenakte.',
      'Sie koennen jederzeit widerrufen.',
    ],
    absaetze: [
      {
        ueberschrift: 'Zweck',
        text:
          'Zur Dokumentation und Verlaufskontrolle des Befundes werden Fotoaufnahmen der '
          + 'betroffenen Koerperregion angefertigt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a '
          + 'i. V. m. Art. 9 Abs. 2 lit. a DSGVO (Ihre Einwilligung).',
      },
      {
        ueberschrift: 'Verwendung',
        text:
          'Die Aufnahmen werden ausschliesslich in Ihrer Patientenakte gespeichert. Eine '
          + 'Veroeffentlichung, Weitergabe zu Werbe-, Schulungs- oder Forschungszwecken erfolgt '
          + 'NICHT. Die Einwilligung ist jederzeit fuer die Zukunft widerrufbar; die Aufnahmen '
          + 'werden dann geloescht, soweit keine Aufbewahrungspflicht entgegensteht.',
      },
    ],
  },
};

// =====================================================================
// Rendering + Nachweis
// =====================================================================

function ersetze(str, ctx) {
  return String(str).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = ctx[key];
    return (v === undefined || v === null || v === '') ? `[${key}]` : String(v);
  });
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
 *                         patient_geburtsdatum, datum, profile, optionen: string[] }
 * @returns {{ version:string, titel:string, text:string, def:object }}
 */
export function renderEinwilligungText(type, ctx = {}) {
  const def = EINWILLIGUNG_TEXTE[type];
  if (!def) throw new Error(`Unbekannter Einwilligungstyp: ${type}`);

  const vollCtx = {
    ...ctx,
    ausfall_regel: ctx.ausfall_regel || ausfallRegelText(ctx.profile),
    optionen: optionenText(def, ctx.optionen),
  };

  const kopf = [
    def.titel,
    `Version: ${def.version}`,
    `Praxis: ${ersetze('{{praxis_name}}, {{praxis_adresse}}', vollCtx)}`,
    `Patient/in: ${ersetze('{{patient_name}} (geb. {{patient_geburtsdatum}})', vollCtx)}`,
    `Datum: ${vollCtx.datum || ''}`,
  ].join('\n');

  const koerper = def.absaetze
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
