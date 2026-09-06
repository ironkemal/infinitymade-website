/**
 * verordnung-aus-ocr.js — was die KI gelesen hat, in der Sprache der Maske.
 *
 * Warum es das gibt
 * ─────────────────
 * Ein gescanntes Rezept landete bisher in einem EIGENEN Fenster
 * (`#rezeptConfirmModal`, Felder `rxc*`) — einer zweiten Maske mit einem
 * zweiten Feldsatz und einem zweiten Speicherweg. Dieselbe Arbeit, zweimal
 * gebaut: jede Korrektur am Formular musste an zwei Stellen gemacht werden,
 * und eine davon wurde vergessen. Genau daran sieht man es heute — das eine
 * Fenster kennt `icd10_2` und `therapieziele`, das andere `zuzahlung_eur` und
 * `hinweise`.
 *
 * Kemal, 06.09.2026: „tek bir modül her tarafta kullanılan, sabit aynı …
 * böylece farklı formatlarda data beslenmiyor."
 *
 * Also gibt es nur noch EINE Maske — das Muster 13. Diese Datei ist der
 * Übersetzer davor: sie nimmt, was `/rezept/upload` geliefert hat, und gibt es
 * in den Spaltennamen zurück, die `fuelleMuster13()` erwartet.
 *
 * Warum uebersetzen und nicht die OCR umbauen
 * ───────────────────────────────────────────
 * Die verschachtelte Form `{patient, arzt, rezept}` ist die Sprache des
 * Backends — `POST /rezept/confirm` nimmt sie entgegen, die Validatoren lesen
 * sie, und die Antwort der KI ist so aufgebaut. Sie dort umzubauen hiesse, den
 * ganzen OCR-Pfad anzufassen, um ein Formular zu fuellen. Die Uebersetzung
 * kostet eine Datei und laesst beide Seiten in ihrer eigenen Sprache.
 *
 * Rein und ohne DOM — deshalb steht ein Test daneben statt einer Browserprobe.
 */

/**
 * ISO-Datum in die Schreibweise des Papiers.
 * `1975-03-08` → `08.03.1975`. Alles andere kommt unveraendert zurueck: im
 * Zweifel lieber der Rohwert im Feld als ein leeres Feld.
 */
export function alsDeutschesDatum(roh) {
  const treffer = String(roh ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return treffer ? `${treffer[3]}.${treffer[2]}.${treffer[1]}` : String(roh ?? '');
}

/**
 * Die Gegenrichtung: `08.03.1975` → `1975-03-08`.
 *
 * ⚠ Nicht `alsISODatum()` aus module/datum.js nehmen — die Funktion gibt ihre
 * Eingabe an `new Date()` weiter, und das liest `08.03.1975` als den 3. August
 * (Monat zuerst, amerikanisch). Ein Geburtsdatum waere damit still um Monate
 * verschoben. Deutsche Schreibweise braucht ihren eigenen Leser.
 *
 * Was schon ISO ist, kommt unveraendert zurueck; alles andere leer, denn ein
 * halb gelesenes Datum ist schlimmer als gar keins.
 */
export function alsIsoDatum(roh) {
  const t = String(roh ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return '';
  const tag = m[1].padStart(2, '0');
  const monat = m[2].padStart(2, '0');
  if (+monat < 1 || +monat > 12 || +tag < 1 || +tag > 31) return '';
  return `${m[3]}-${monat}-${tag}`;
}

/**
 * Der Verordnungsteil — in den Spaltennamen von `prescriptions`.
 *
 * `patient_id` bleibt bewusst `null`: wer der Patient ist, entscheidet der
 * Abgleich (bestehender Patient oder neu), nicht die Texterkennung.
 *
 * `hinweise` bekommt die `therapieziele`. Das ist keine Erfindung, sondern
 * genau das, was der Speicherweg heute schon tut (`api-backend/server.js:2493`)
 * — eine eigene Spalte dafuer gibt es nicht. Zwei Regeln fuer dasselbe Feld
 * waeren wieder der Fehler, den diese Zusammenlegung beseitigt.
 *
 * @param {object} parsed  `{ patient, arzt, rezept }` aus `/rezept/upload`
 * @returns {object}       Satz in der Form einer `prescriptions`-Zeile
 */
export function ocrAlsVerordnung(parsed) {
  const p = parsed || {};
  const patient = p.patient || {};
  const arzt = p.arzt || {};
  const rezept = p.rezept || {};

  return {
    // Noch offen — der Patientenabgleich setzt ihn.
    patient_id: null,

    ausstellungsdatum: arzt.ausstellungsdatum || null,
    doctor_lanr: arzt.lanr || null,
    doctor_bsnr: arzt.bsnr || null,
    // `fuelleMuster13` liest den Arztnamen aus der verbundenen Zeile.
    aerzte: arzt.name ? { arzt_name: arzt.name } : null,

    icd10: rezept.icd10 || null,
    icd10_2: rezept.icd10_2 || null,
    diagnose_freitext: rezept.diagnose_text || null,
    diagnosegruppe: rezept.diagnosegruppe || null,
    leitsymptomatik: rezept.leitsymptomatik ?? null,
    pat_leitsymptomatik: rezept.pat_leitsymptomatik ?? null,

    heilmittel: rezept.heilmittel || null,
    heilmittel_feld_text: rezept.heilmittel_feld_text || null,
    heilmittel_position: rezept.heilmittel_position || null,
    anzahl_einheiten: rezept.anzahl_einheiten ?? null,
    ergaenzendes_heilmittel: rezept.ergaenzendes_heilmittel || null,
    ergaenzend_einheiten: rezept.anzahl_ergaenzend ?? null,
    frequenz: rezept.frequenz || null,
    therapie_bereich: rezept.therapiebereich || null,
    behandlungsbeginn: rezept.behandlungsbeginn || null,

    is_dringend: !!rezept.is_dringend,
    hausbesuch: !!rezept.hausbesuch,
    is_blanko: !!rezept.is_blanko,
    is_lhb_bvb: !!rezept.is_lhb_bvb,
    zuzahlung_befreit: !!rezept.zuzahlung_befreit,
    bericht_angefordert: !!rezept.bericht_angefordert,
    bericht_status: rezept.bericht_status || 'offen',

    // Siehe Kopf: die Therapieziele sind die Hinweise.
    hinweise: rezept.therapieziele || null,

    unterschrift_vorhanden: rezept.unterschrift_vorhanden ?? null,
    signature_confidence: rezept.signature_confidence || null,

    kostentraeger_ik: patient.kostentraeger_ik || null,
  };
}

/**
 * Der Patientenkopf — als Feld-ID → Wert, so wie die Maske ihn traegt.
 *
 * Bewusst NICHT ueber `fillRzPatientFromLead()`: die Funktion laedt einen
 * Patienten aus der Akte, und beim Scannen gibt es den vielleicht noch gar
 * nicht. Was auf dem Papier steht, ist hier die einzige Quelle.
 *
 * `rzPatKasseIk` steht nur drin, wenn die Texterkennung das IK schon kennt —
 * sonst leitet es der Aufrufer aus der Kassenliste ab, wie bisher.
 *
 * @param {object} parsed
 * @returns {Object<string,string>}
 */
export function ocrAlsPatientkopf(parsed) {
  const patient = (parsed || {}).patient || {};
  const kopf = {
    rzPatVorname: patient.first_name || '',
    rzPatName: patient.last_name || '',
    rzPatGeb: alsDeutschesDatum(patient.geburtsdatum),
    rzPatVersNr: patient.versichertennummer || '',
    rzPatStatus: patient.versichertenstatus || '',
    rzPatKasse: patient.krankenkasse || '',
    rzPatStrasse: patient.street || '',
    rzPatOrt: [patient.plz, patient.city].filter(Boolean).join(' '),
  };
  if (patient.kostentraeger_ik) kopf.rzPatKasseIk = patient.kostentraeger_ik;
  return kopf;
}

/**
 * Die Angaben, mit denen ein Patient gesucht bzw. angelegt wird.
 *
 * Eigener Rueckgabewert, damit der Abgleich nicht in den Feldern der Maske
 * herumliest: dort steht das Geburtsdatum deutsch, gesucht wird aber ISO.
 *
 * @param {object} parsed
 * @returns {{first_name:?string, last_name:?string, geburtsdatum:?string,
 *            versichertennummer:?string}}
 */
export function ocrAlsPatientensuche(parsed) {
  const patient = (parsed || {}).patient || {};
  const putzen = (w) => {
    const t = String(w ?? '').trim();
    return t || null;
  };
  return {
    first_name: putzen(patient.first_name),
    last_name: putzen(patient.last_name),
    geburtsdatum: putzen(patient.geburtsdatum),
    versichertennummer: putzen(patient.versichertennummer)?.toUpperCase().replace(/\s/g, '') || null,
  };
}

// ─── Patientenabgleich ──────────────────────────────────────────────────────
//
// Wem gehoert dieses Rezept? Der Speicherweg beantwortet das heute selbst
// (`api-backend/server.js:2346`) — aber still und grosszuegig: er nimmt
// `.limit(1)`, akzeptiert den ersten Treffer ohne zu pruefen ob es mehrere
// gibt, und schreibt dem so gefundenen Patienten gleich noch die Kontaktdaten
// vom Papier in die Akte. Steht in der Praxis eine zweite Person mit demselben
// Geburtstag und Nachnamen, bekommt sie fremde Daten — ohne dass es jemand
// sieht.
//
// `module/termin-patient-bezug.js` hat fuer dieselbe Frage laengst die
// richtige Regel: **lieber nichts als falsch.** Sie gilt hier genauso, nur mit
// anderen Schluesseln — auf dem Papier steht keine Telefonnummer, dafuer die
// Versichertennummer, und die ist der staerkste Schluessel den es gibt.
//
// Deshalb entscheidet diese Funktion NICHT, sie BERICHTET: eindeutig,
// mehrdeutig, oder neu. Was daraus wird, sagt die Oberflaeche — und bei
// „mehrdeutig" waehlt der Mensch.

/** Versichertennummer vergleichbar machen: „a 123 456 789" → „A123456789". */
const alsVsnr = (w) => String(w ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Name eines Patienten, klein geschrieben — Schreibweise entscheidet nicht. */
const kleinName = (l) =>
  String(l?.first_name || '').trim().toLowerCase() + '|' + String(l?.last_name || '').trim().toLowerCase();

/** Geburtsdatum eines Patienten; Altbestand traegt es in `metadata`. */
const gebVon = (l) => l?.geburtsdatum || l?.metadata?.geburtsdatum || null;

/**
 * Sucht den Patienten zum gescannten Rezept.
 *
 * Rein: bekommt die bereits geladene Patientenliste (die Maske hat sie ohnehin)
 * und gibt nur einen Befund zurueck. Kein Netz, kein DOM — deshalb pruefbar.
 *
 * Schluessel, absteigend nach Verlaesslichkeit:
 *   1. Versichertennummer — gehoert genau einer Person.
 *   2. Geburtsdatum + Nachname (+ Vorname, wenn gelesen).
 *   3. Nur Name, wenn kein Geburtsdatum gelesen wurde — und dann NUR eindeutig.
 *
 * ⚠ Ein fehlender Vorname macht die Suche NICHT weiter. Der Speicherweg setzt
 * dort heute `ilike '%'` ein und trifft damit jeden Namensvetter; genau das
 * soll hier nicht passieren.
 *
 * @param {object} kriterien  Ausgabe von `ocrAlsPatientensuche()`
 * @param {Array}  patienten  Patienten der Praxis (bereits mandantengefiltert)
 * @returns {{status:'gefunden'|'mehrdeutig'|'neu'|'unbekannt', kandidaten:Array}}
 */
export function patientAbgleichAusOcr(kriterien, patienten) {
  const k = kriterien || {};
  const liste = Array.isArray(patienten) ? patienten : [];

  const vsnr = alsVsnr(k.versichertennummer);
  const geb = k.geburtsdatum || null;
  const vor = String(k.first_name || '').trim().toLowerCase();
  const nach = String(k.last_name || '').trim().toLowerCase();

  // Gar nichts gelesen — dann ist auch „neu" eine Behauptung zu viel.
  if (!vsnr && !geb && !nach) return { status: 'unbekannt', kandidaten: [] };

  const befund = (kandidaten) => ({
    status: kandidaten.length === 1 ? 'gefunden' : kandidaten.length > 1 ? 'mehrdeutig' : 'neu',
    kandidaten,
  });

  // 1. Versichertennummer.
  if (vsnr) {
    const treffer = liste.filter(l => alsVsnr(l.versichertennummer) === vsnr);
    if (treffer.length) return befund(treffer);
    // Kein Treffer heisst hier NICHT „neu": die Nummer kann in der Akte
    // schlicht fehlen. Also weiter mit den anderen Schluesseln.
  }

  // 2. Geburtsdatum + Name.
  if (geb && nach) {
    let treffer = liste.filter(l => gebVon(l) === geb
      && String(l.last_name || '').trim().toLowerCase() === nach);
    // Der Vorname verengt nur, wenn er gelesen wurde — fehlt er, bleibt es
    // mehrdeutig, statt sich auf den ersten Namensvetter festzulegen.
    if (vor && treffer.length > 1) {
      const genau = treffer.filter(l => kleinName(l) === `${vor}|${nach}`);
      if (genau.length) treffer = genau;
    }
    return befund(treffer);
  }

  // 3. Nur der Name — schwaechster Schluessel, deshalb nur eindeutig brauchbar.
  if (nach) {
    const treffer = liste.filter(l => vor
      ? kleinName(l) === `${vor}|${nach}`
      : String(l.last_name || '').trim().toLowerCase() === nach);
    return befund(treffer);
  }

  return { status: 'neu', kandidaten: [] };
}

/**
 * Traegt das Papier eine andere Versichertennummer als die Akte?
 *
 * Warum das eine eigene Frage ist: der Abgleich oben findet den Patienten
 * auch ueber Geburtsdatum und Namen. Wechselt jemand die Krankenkasse,
 * stimmt genau dann alles ausser der Nummer — und die alte Nummer bliebe
 * stehen, bis es bei der Abrechnung auffaellt. Beta-2 hat danach gefragt
 * (05.09.2026).
 *
 * Bewusst nur eine MELDUNG, kein stilles Update. Die Akte ohne Rueckfrage
 * mit dem zu ueberschreiben, was auf einem Blatt Papier steht, ist genau der
 * Fehler, den der alte Server-Abgleich gemacht hat.
 *
 * Kein Befund, wenn eine der beiden Seiten leer ist: eine fehlende Nummer in
 * der Akte ist eine Luecke, kein Wechsel — die fuellt das Speichern ohnehin.
 *
 * @param {object} kriterien  Ausgabe von `ocrAlsPatientensuche()`
 * @param {object} lead       der getroffene Patient
 * @returns {{geaendert:boolean, alt:?string, neu:?string}}
 */
export function versichertennummerAbweichung(kriterien, lead) {
  const neu = alsVsnr(kriterien?.versichertennummer);
  const alt = alsVsnr(lead?.versichertennummer);
  if (!neu || !alt) return { geaendert: false, alt: alt || null, neu: neu || null };
  return { geaendert: neu !== alt, alt, neu };
}
