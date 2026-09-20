// § 302-Echtbetrieb, Schritt 1.10 — Gesetzliche Uebermittlungsdokumentation.
//
// ── WARUM DIESE DATEI EXISTIERT ──────────────────────────────────────────────
//
// Anlage 1 TP5 Kap. 3(2): "Ueber den Datenaustausch ist eine Dokumentation zu
// fuehren … mindestens 2 Jahre aufzubewahren … alle Schritte von der Initiierung
// bis ggf. zur Quittierung."
// Anhang 1 § 4.5(2) nennt die Mindestfelder (physikalischer Dateiname, Datum,
// lfd. Nr., Partner, Beginn/Ende, Groesse, Hinweise, Richtung, Kennzeichen, Fehler).
//
// Das laesst sich nicht nachtraeglich erzeugen. Deshalb entsteht die Protokollierung
// JETZT, bevor der eigentliche Versandschritt gebaut wird (Faz 2).
//
// ⚠️ DIESE RUNDE WIRD DIE FUNKTION NICHT AN DEN VERSANDWEG ANGESCHLOSSEN —
// der Versandschritt entsteht erst in Faz 2. Sie existiert, ist dokumentiert
// und durch Tests belegt, damit spaeter niemand die Dokumentation rueckwirkend
// erfinden muss.
//
// ── WARUM KEIN SUPABASE-CLIENT IM MODULRUMPF ───────────────────────────────────
//
// Wie in `betriebsart.js`: `abrechnung.routes.js` baut seinen service-role-Client
// beim Import und muss ohne Umgebungsvariablen laut sterben (server.js:166).
// Ein Modul mit eigenem `createClient` im Rumpf zwingt Tests dazu, genau diesen
// Riegel aufzuweichen. Der Client wird deshalb ausnahmslos als `db`-Argument
// uebergeben.
//
// ── ⛔ PHI-VERBOT (STRIKT) ───────────────────────────────────────────────────
//
// In diese Protokolltabelle gehoeren UNTER KEINEN UMSTAENDEN Patientendaten
// (Name, Versichertennummer, Diagnose etc.). Sie ist ein Transportprotokoll,
// keine Patientenakte.
// Werden Freitexte (verarbeitungshinweise, fehlertext) uebergeben, z. B. aus
// Rueckmeldungen der Datenannahmestellen, MÜSSEN diese vor dem Aufruf maskiert sein.
//
// ── FEHLERVERHALTEN (Vorbild ai/audit.js logCall) ─────────────────────────────
//
// Protokollierungsfehler werden geloggt, duerfen aber NIEMALS den Abrechnungs-
// oder Versandfluss unterbrechen. Bei Fehlschlag wird null zurueckgegeben.

export const ERLAUBTE_RICHTUNGEN = new Set(['senden', 'empfangen']);

/**
 * Protokolliert einen Uebertragungsschritt in public.abrechnung_uebermittlung.
 *
 * Fehler werden geschluckt und geloggt (best-effort, Vorbild logCall() in ai/audit.js),
 * damit ein Protokollierungsfehler niemals die eigentliche Abrechnung blockiert.
 *
 * @param {object} felder
 * @param {string} felder.owner_id                 Mandant (Pflicht)
 * @param {string} felder.richtung                 'senden' | 'empfangen' (Pflicht)
 * @param {string} felder.physikalischer_dateiname Dateiname nach Richtlinie (Pflicht)
 * @param {string|Date} felder.erstellt_am          Erstellungsdatum (Pflicht)
 * @param {string} felder.partner_ik               IK des Kommunikationspartners (Pflicht)
 * @param {string} [felder.business_id]            Betriebsstätte
 * @param {string} [felder.abrechnung_id]          Referenz zur Abrechnung
 * @param {string} [felder.antwort_auf]            Referenz zur Vorgaenger-Uebermittlung
 * @param {number} [felder.laufende_nummer]        Laufende Nummer
 * @param {number} [felder.transfernummer]         Transfernummer
 * @param {string} [felder.partner_name]           Name des Partners (z. B. Datenannahmestelle)
 * @param {string|Date} [felder.begonnen_am]       Beginn der Uebertragung (Default now())
 * @param {string|Date} [felder.beendet_am]        Ende der Uebertragung
 * @param {number} [felder.dateigroesse_bytes]     Dateigroesse in Bytes
 * @param {string} [felder.verarbeitungshinweise]  Freitext (ACHTUNG: PHI vorher maskieren!)
 * @param {string} [felder.verarbeitungskennzeichen] VKZ
 * @param {string} [felder.fehlerstatus='offen']   'offen'|'ok'|'fehler'|'abgebrochen'
 * @param {string} [felder.fehlertext]             Freitext (ACHTUNG: PHI vorher maskieren!)
 * @param {string} [felder.uebertragungsweg]       'portal'|'dfue'|'mail'|'datentraeger'|'papier'
 * @param {string} [felder.sha256]                 Pruefsumme der Datei
 * @param {string} [felder.betriebsart]            'test'|'erprobung'|'echt'
 * @param {string} [felder.absender_ik]            Absender-IK
 * @param {string} [felder.created_by]             User-UUID
 * @param {object} [opts]
 * @param {object} [opts.db]                       Supabase-Client
 * @returns {Promise<string|null>} Die UUID des Protokolleintrags oder null bei Fehler
 */
export async function uebermittlungProtokollieren(felder = {}, { db } = {}) {
  if (!db) {
    console.warn('[abrechnung/uebermittlung] Kein Datenbank-Client uebergeben (db ist Pflicht).');
    return null;
  }

  const {
    owner_id,
    business_id,
    abrechnung_id,
    antwort_auf,
    richtung,
    physikalischer_dateiname,
    erstellt_am,
    laufende_nummer,
    transfernummer,
    partner_ik,
    partner_name,
    begonnen_am,
    beendet_am,
    dateigroesse_bytes,
    verarbeitungshinweise,
    verarbeitungskennzeichen,
    fehlerstatus = 'offen',
    fehlertext,
    uebertragungsweg,
    sha256,
    betriebsart,
    absender_ik,
    created_by,
  } = felder;

  // 1. Pflichtfelder pruefen
  const cleanOwnerId = typeof owner_id === 'string' ? owner_id.trim() : owner_id;
  const cleanRichtung = typeof richtung === 'string' ? richtung.trim() : richtung;
  const cleanDateiname = typeof physikalischer_dateiname === 'string' ? physikalischer_dateiname.trim() : physikalischer_dateiname;
  const cleanPartnerIk = typeof partner_ik === 'string' ? partner_ik.trim() : partner_ik;

  if (!cleanOwnerId || !cleanRichtung || !cleanDateiname || !erstellt_am || !cleanPartnerIk) {
    console.warn(
      '[abrechnung/uebermittlung] Pflichtfelder fehlen: ' +
      'owner_id, richtung, physikalischer_dateiname, erstellt_am und partner_ik sind erforderlich.'
    );
    return null;
  }

  // 2. Richtung validieren ('senden' | 'empfangen')
  // Wir fangen das hier explizit vor dem DB-Aufruf ab: Ein ungueltiger Wert wuerde
  // in der DB den Check-Constraint abr_uebermittlung_richtung_chk verletzen.
  // Statt unnoetig einen DB-Roundtrip zu provozieren, brechen wir mit log + null ab.
  if (!ERLAUBTE_RICHTUNGEN.has(cleanRichtung)) {
    console.warn(
      `[abrechnung/uebermittlung] Ungueltige richtung '${cleanRichtung}': ` +
      `Nur 'senden' oder 'empfangen' erlaubt (Anlage 1 TP5 Kap. 3(2)).`
    );
    return null;
  }

  // 3. Zeile fuer Insert zusammenstellen (striktes Whitelisting gegen versehentliche PHI-Felder)
  const zeile = {
    owner_id: cleanOwnerId,
    richtung: cleanRichtung,
    physikalischer_dateiname: cleanDateiname,
    erstellt_am: erstellt_am instanceof Date ? erstellt_am.toISOString() : erstellt_am,
    partner_ik: cleanPartnerIk,
    fehlerstatus: fehlerstatus || 'offen',
  };

  if (business_id !== undefined) zeile.business_id = business_id;
  if (abrechnung_id !== undefined) zeile.abrechnung_id = abrechnung_id;
  if (antwort_auf !== undefined) zeile.antwort_auf = antwort_auf;
  if (laufende_nummer !== undefined) zeile.laufende_nummer = laufende_nummer;
  if (transfernummer !== undefined) zeile.transfernummer = transfernummer;
  if (partner_name !== undefined) zeile.partner_name = partner_name;
  if (begonnen_am !== undefined) zeile.begonnen_am = begonnen_am instanceof Date ? begonnen_am.toISOString() : begonnen_am;
  if (beendet_am !== undefined) zeile.beendet_am = beendet_am instanceof Date ? beendet_am.toISOString() : beendet_am;
  if (dateigroesse_bytes !== undefined) zeile.dateigroesse_bytes = dateigroesse_bytes;
  if (verarbeitungshinweise !== undefined) zeile.verarbeitungshinweise = verarbeitungshinweise;
  if (verarbeitungskennzeichen !== undefined) zeile.verarbeitungskennzeichen = verarbeitungskennzeichen;
  if (fehlertext !== undefined) zeile.fehlertext = fehlertext;
  if (uebertragungsweg !== undefined) zeile.uebertragungsweg = uebertragungsweg;
  if (sha256 !== undefined) zeile.sha256 = sha256;
  if (betriebsart !== undefined) zeile.betriebsart = betriebsart;
  if (absender_ik !== undefined) zeile.absender_ik = absender_ik;
  if (created_by !== undefined) zeile.created_by = created_by;

  try {
    const { data, error } = await db
      .from('abrechnung_uebermittlung')
      .insert(zeile)
      .select('id')
      .maybeSingle();

    if (error) {
      const codeOrMsg = String(error.code || error.message || '');
      if (/relation|table|does not exist|42P01/i.test(codeOrMsg)) {
        console.warn(
          '[abrechnung/uebermittlung] Tabelle abrechnung_uebermittlung existiert noch nicht (Migration 0034 ausstehend).'
        );
      } else {
        console.error('[abrechnung/uebermittlung] Insert fehlgeschlagen:', error.message || error);
      }
      return null;
    }

    const id = data?.id ?? (Array.isArray(data) ? data[0]?.id : null);
    return id ?? null;
  } catch (err) {
    console.error('[abrechnung/uebermittlung] Unerwartete Ausnahme beim Protokollieren:', err.message || err);
    return null;
  }
}
