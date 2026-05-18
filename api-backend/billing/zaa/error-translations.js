// ZAA / ITSG Fehler-Code → human-readable explanation + fix hint.
//
// Source: ITSG "Schlüssel für Fehlercodes der Abrechnungsprüfung § 302/§ 295".
// Coverage: ~40 most common codes seen in Heilmittel-Abrechnung. Extend as we
// see more rejections in the wild.

export const ZAA_ERRORS = Object.freeze({
  // 00 = Annahme (sanity)
  '00': { text: 'Annahme bestätigt',              loesung: 'Kein Handlungsbedarf.' },

  // ---- Strukturelle / formale Fehler (0x) ----
  '01': { text: 'Dateiname falsch aufgebaut',     loesung: 'Filename muss EHK/EHM-Schema folgen — DTA neu erzeugen.' },
  '02': { text: 'IK Absender ungültig',           loesung: 'IK in den Einstellungen prüfen (9-stellig, ITSG-vergeben).' },
  '03': { text: 'IK Empfänger ungültig',          loesung: 'Kostenträger-Stammdaten veraltet — Aktualisierung anfordern.' },
  '04': { text: 'Datennummer doppelt',            loesung: 'Sammelrechnungsnummer schon einmal eingereicht — neue Nummer erzeugen.' },
  '05': { text: 'Zeichensatz / Encoding falsch',  loesung: 'DTA muss ISO-8859-15 (Latin-9) sein. Generator neu starten.' },
  '06': { text: 'Test/Echt-Kennzeichen ungültig', loesung: 'Echtdaten erst nach DAS-Freigabe einreichen.' },

  // ---- Segment-/Feldfehler (1x – 2x) ----
  '10': { text: 'Pflichtsegment fehlt',           loesung: 'DTA unvollständig — automatische Neugenerierung.' },
  '11': { text: 'Pflichtfeld leer',               loesung: 'Patientendaten / Diagnose / Frequenz prüfen.' },
  '12': { text: 'Feld zu lang',                   loesung: 'Texte > Limit kürzen (siehe Anlage 1 V21 Feldlängen).' },
  '13': { text: 'Datumsfeld falsch',              loesung: 'Format YYYYMMDD und plausibles Datum eintragen.' },
  '14': { text: 'Belegnummer doppelt',            loesung: 'Reihenfolge in der Sammelrechnung prüfen.' },
  '15': { text: 'Versichertennummer ungültig',    loesung: 'KVNR ist 10-stellig (Buchstabe + 9 Ziffern). OCR-Wert prüfen.' },
  '16': { text: 'Geburtsdatum unplausibel',       loesung: 'Patientenstammdaten korrigieren.' },

  // ---- Sachliche Fehler Heilmittel (10x – 11x) ----
  '101': { text: 'Positionsnummer unbekannt',         loesung: 'Heilmittel-Position aus Anlage 2 §125 SGB V wählen (aktuelle Liste).' },
  '102': { text: 'Positionsnummer nicht abrechenbar', loesung: 'Heilmittel passt nicht zum Abrechnungscode (z. B. Massage für Physio-Code).' },
  '103': { text: 'Anzahl Einheiten unzulässig',       loesung: 'Höchstmenge je Verordnung beachten — Verordnung splitten oder Folgerezept.' },
  '104': { text: 'Frequenz nicht eingehalten',        loesung: 'Therapie-Intervalle ggü. Verordnung dokumentieren / Begründung beilegen.' },
  '105': { text: 'Diagnosegruppe / ICD-10 inkonsistent', loesung: 'ICD-10 vs. Diagnosegruppe nochmals prüfen (Heilmittelkatalog).' },
  '106': { text: 'Behandlungsbeginn außerhalb Frist',  loesung: 'Verordnung war abgelaufen — neue Verordnung anfordern.' },
  '107': { text: 'Hausbesuchspauschale unzulässig',    loesung: 'Hausbesuch nicht verordnet oder nicht mit Hauptleistung kombinierbar.' },
  '108': { text: 'Blanko-Verordnung Anforderung nicht erfüllt', loesung: 'Indikationsschlüssel + Therapiebericht beilegen.' },

  // ---- Zuzahlung / Patientenkostenanteil (20x) ----
  '201': { text: 'Zuzahlungskennzeichen falsch',       loesung: 'Befreiung im Patientendokument hinterlegen oder VKZ korrigieren.' },
  '202': { text: 'Befreiung nicht nachgewiesen',       loesung: 'Befreiungsbescheinigung beilegen / Beleg-URL eintragen.' },
  '203': { text: 'Zuzahlung falsch berechnet',         loesung: '10 % + Pauschale 10 € prüfen — Generator neu rechnen lassen.' },

  // ---- Arzt / LANR / BSNR (30x) ----
  '301': { text: 'LANR ungültig',                      loesung: 'Arztstammdaten prüfen — LANR ist 9-stellig.' },
  '302': { text: 'BSNR ungültig',                      loesung: 'Betriebsstättennummer 9-stellig, ggf. mit Korrektur.' },
  '303': { text: 'Verordnender Arzt nicht zugelassen', loesung: 'KV-Status prüfen.' },

  // ---- Genehmigung (40x) ----
  '401': { text: 'Genehmigung fehlt',                  loesung: 'Genehmigungs-Kennzeichen + -datum nachtragen.' },
  '402': { text: 'Genehmigung abgelaufen',             loesung: 'Folgegenehmigung bei Krankenkasse anfordern.' },

  // ---- Beleg / Urbeleg (50x) ----
  '501': { text: 'Urbeleg fehlt',                      loesung: 'Originalverordnung + Begleitzettel postalisch nachreichen.' },
  '502': { text: 'Unterschrift Patient fehlt',         loesung: 'Patientensignatur nachholen, Beleg neu einsenden.' },

  // ---- ZAA-spezifisch ----
  '901': { text: 'Datei nicht entschlüsselbar',        loesung: 'Falscher Empfänger-Zertifikat verwendet — DAS prüfen.' },
  '902': { text: 'Signatur ungültig',                  loesung: 'Zertifikat abgelaufen oder PIN-Fehler — Datei neu signieren.' },
  '903': { text: 'Zertifikat unbekannt',               loesung: 'ITSG/Dakota-Zertifikat noch nicht freigeschaltet.' },
});

/**
 * Look up the German translation + fix hint for an error code.
 * Returns { text, loesung } or null.
 */
export function translateZaaCode(code) {
  if (code == null) return null;
  const key = String(code).trim();
  return ZAA_ERRORS[key] || ZAA_ERRORS[key.padStart(2, '0')] || null;
}
