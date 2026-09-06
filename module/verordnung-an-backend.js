/**
 * verordnung-an-backend.js — die Maske spricht mit dem Speicherweg.
 *
 * Das Gegenstueck zu `module/verordnung-aus-ocr.js`: die eine Datei bringt das
 * Gelesene in die Maske, diese bringt das Eingetippte zum Server.
 *
 * Warum ueberhaupt zum Server
 * ───────────────────────────
 * Bis zum 06.09.2026 schrieb die Maske selbst — aus dem Browser, direkt in
 * `prescriptions`, geschuetzt durch die Zeilensicherheit. Der Scan dagegen
 * ging ueber `POST /api/rezept/confirm`. Zwei Wege in dieselbe Tabelle heisst
 * zwei Regelwerke: nur einer von beiden legte einen unbekannten Patienten an,
 * nur einer haengte das Foto an die Verordnung, nur einer merkte sich, dass
 * jemand ueber Warnungen hinweg gespeichert hat.
 *
 * Beschlossen am 06.09.2026: der Server gewinnt. Damit laeuft die getippte
 * Verordnung durch dieselbe Pruefung wie die fotografierte.
 * (`onprem` O-44 — kein neuer Baustein im Kundenkasten, Express liegt dort
 * ohnehin; `guvenlik` — geht durch, sofern der Server `owner_id` nur aus dem
 * Token nimmt und eine mitgeschickte `patient_id` gegenprueft.)
 *
 * Was hier NICHT passiert
 * ───────────────────────
 * Kein Netz, kein DOM, keine Entscheidung. Die Datei formt um — deshalb steht
 * ein Test daneben und keine Browserprobe.
 */

import { alsIsoDatum } from './verordnung-aus-ocr.js?v=20260906';

const text = (w) => {
  const t = String(w ?? '').trim();
  return t || null;
};

/**
 * „53721 Siegburg" zurueck in Postleitzahl und Ort.
 *
 * Die Maske fuehrt beides in EINEM Feld (`rzPatOrt`), die Patientenakte in
 * zwei Spalten. Ohne diese Trennung landete der ganze Text als Ort in der
 * Akte — und das Fahrtenbuch rechnet mit der Postleitzahl.
 *
 * Ohne fuehrende Ziffernfolge gilt alles als Ort: lieber ein Ort ohne PLZ als
 * eine erfundene PLZ.
 */
export function trennePlzOrt(roh) {
  const t = String(roh ?? '').trim();
  const m = t.match(/^(\d{5})\s+(.*)$/);
  return m ? { plz: m[1], city: text(m[2]) } : { plz: null, city: text(t) };
}

/**
 * Der Rumpf fuer `POST /api/rezept/confirm`.
 *
 * @param {object} a
 * @param {object} a.nutzlast    Ausgabe von `nutzlastAusMaske()` — flach, in
 *                               den Spaltennamen von `prescriptions`
 * @param {Object<string,string>} a.patientFelder  die `rzPat*`-Werte der Maske
 * @param {boolean} [a.patientNeu]  die Maske hat „Neuer Patient" gemeldet
 * @param {?object} [a.scan]     `{ storage_path, ocr_confidence }` bei Scan
 * @param {boolean} [a.overridden]  ueber Warnungen hinweg gespeichert
 * @returns {object} Rumpf, wie ihn der Server erwartet
 */
export function verordnungFuerBackend({ nutzlast, patientFelder = {}, patientNeu = false,
                                        scan = null, overridden = false } = {}) {
  const n = nutzlast || {};
  const f = patientFelder || {};
  const { plz, city } = trennePlzOrt(f.rzPatOrt);

  const vorname = text(f.rzPatVorname);
  const nachname = text(f.rzPatName);

  return {
    storage_path: scan?.storage_path || null,
    // Hat die Maske einen Patienten, entscheidet sie — der Server prueft die
    // id nur noch gegen den eigenen Mandanten und sucht nicht selbst weiter.
    patient_id: n.patient_id || null,
    // Und sagt sie „neu", soll er auch nicht heimlich doch noch suchen.
    patient_neu: !!patientNeu,
    proceed_anyway: !!overridden,
    parsed: {
      patient: {
        first_name: vorname,
        last_name: nachname,
        name: [vorname, nachname].filter(Boolean).join(' ') || null,
        // ⚠ Im Kopf steht das Datum deutsch, die Akte fuehrt es ISO.
        geburtsdatum: alsIsoDatum(f.rzPatGeb) || null,
        versichertennummer: text(f.rzPatVersNr),
        versichertenstatus: text(f.rzPatStatus),
        krankenkasse: text(f.rzPatKasse),
        kostentraeger_ik: text(f.rzPatKasseIk) || n.kostentraeger_ik || null,
        street: text(f.rzPatStrasse),
        plz,
        city,
      },
      arzt: {
        name: text(f.rzArztName),
        ausstellungsdatum: n.ausstellungsdatum || null,
        lanr: n.doctor_lanr || null,
        bsnr: n.doctor_bsnr || null,
      },
      rezept: {
        icd10: n.icd10 || null,
        icd10_2: n.icd10_2 || null,
        diagnose_text: n.diagnose_freitext || null,
        diagnosegruppe: n.diagnosegruppe || null,
        therapiebereich: n.therapie_bereich || null,
        leitsymptomatik: n.leitsymptomatik ?? null,
        pat_leitsymptomatik: n.pat_leitsymptomatik ?? null,
        heilmittel: n.heilmittel || null,
        heilmittel_feld_text: n.heilmittel_feld_text || null,
        heilmittel_position: n.heilmittel_position || null,
        anzahl_einheiten: n.anzahl_einheiten ?? null,
        ergaenzendes_heilmittel: n.ergaenzendes_heilmittel || null,
        anzahl_ergaenzend: n.ergaenzend_einheiten ?? null,
        frequenz: n.frequenz || null,
        behandlungsbeginn: n.behandlungsbeginn || null,
        is_dringend: !!n.is_dringend,
        hausbesuch: !!n.hausbesuch,
        is_blanko: !!n.is_blanko,
        is_lhb_bvb: !!n.is_lhb_bvb,
        zuzahlung_befreit: !!n.zuzahlung_befreit,
        zuzahlung_eur: n.zuzahlung_eur ?? null,
        bericht_angefordert: !!n.bericht_angefordert,
        bericht_status: n.bericht_status || 'offen',
        unterschrift_vorhanden: n.unterschrift_vorhanden ?? null,
        signature_confidence: n.signature_confidence || null,
        // Gegenstueck zu `ocrAlsVerordnung`: dort werden die Therapieziele zu
        // den Hinweisen, hier den Weg zurueck — der Server schreibt sie wieder
        // nach `hinweise` (api-backend/server.js:2493). Eine eigene Spalte gibt
        // es nicht, und zwei Regeln dafuer waeren der alte Fehler.
        therapieziele: n.hinweise || null,
        // Podologie: an der Verordnung, nicht an der Behandlung.
        nagel: n.nagel ?? null,
        wagner_grad: n.wagner_grad ?? null,
        behandlungsanlass: n.behandlungsanlass ?? null,
      },
    },
  };
}
