/**
 * termin-laden.js — einen Termin vollständig nachladen.
 *
 * Warum es das gibt
 * ─────────────────
 * Die drei Kalenderansichten laden unterschiedlich viele Spalten, und das aus
 * gutem Grund: die Tagesansicht zeigt eine Spalte je Mitarbeiter und darf
 * teuer sein, die Monatsansicht zeigt bis zu sechs Wochen auf einmal und lädt
 * deshalb nur, was auf der Pille steht.
 *
 * Stand 22.08.2026:
 *
 *   Tag     id, user_id, service_id, start/end, customer_phone, hausbesuch,
 *           notes, owner_id, fahrt_*, lead_id, Verordnung mit Sitzungen …
 *   Woche   davon NICHT: customer_phone, hausbesuch, notes, owner_id,
 *           fahrt_*, lead_id, Verordnung
 *   Monat   nur id, user_id, start_time, customer_name, services(title)
 *
 * Solange man daraus nur zeichnet, ist das richtig. Seit dem Kontextmenü und
 * dem Klick auf einen Termin in Woche und Monat (22.08.2026) landen diese
 * Datensätze aber in Funktionen, die den ganzen Termin erwarten. Was dann
 * passiert, sieht man nicht — es fehlt einfach:
 *
 *   • `handleTerminStarten()` prüft `booking.hausbesuch`. Fehlt das Feld, gilt
 *     ein Hausbesuch als Praxistermin: die Sitzung wird abgehakt, ohne dass
 *     die Fahrt je gestartet oder ins Fahrtenbuch geschrieben wurde.
 *   • `ausfallSuggestedAmount()` rechnet den Prozentsatz über
 *     `booking.service_id`. Fehlt es, fällt die Ausfallrechnung stillschweigend
 *     auf den Pauschalbetrag zurück.
 *   • `offerAusfallrechnung()` und der Seitenbereich brauchen `lead_id`, um den
 *     Patienten zu finden.
 *
 * Deshalb wird vor jeder Handlung genau EIN Termin nachgeladen — eine Zeile,
 * nur bei Bedarf. Die Ansichten bleiben schlank, die Handlungen vollständig.
 */

/**
 * Der Spaltensatz der Tagesansicht — die vollständige Sicht auf einen Termin.
 * Sie steht hier, damit Tagesansicht und Nachladen nicht auseinanderlaufen.
 */
export const TERMIN_SELECT = 'id,user_id,service_id,start_time,end_time,customer_name,customer_phone,status,hausbesuch,notes,owner_id,fahrt_status,vehicle_id,start_km,end_km,fahrt_started_at,fahrt_arrived_at,fahrt_ended_at,is_group,group_capacity,group_parent_id,lead_id,services(title,code),prescription_sessions(id,session_number,prescriptions(id,heilmittel,heilmittel_feld_text,heilmittel_position,diagnosegruppe,anzahl_einheiten,icd10,rezept_typ,ausstellungsdatum,status,zuzahlung_befreit,zuzahlung_eur,zuzahlung_kassiert_am,zuzahlung_zahlart,patient_id,is_dringend,is_blanko,is_lhb_bvb,abrechnung_status,frequenz,arzt_id,aerzte(arzt_name,fachrichtung)))';

/**
 * Lädt den Termin vollständig nach.
 *
 * Gibt bei jedem Fehlschlag den übergebenen Datensatz zurück, nie `null`: die
 * Handlung soll an einer langsamen Leitung nicht wortlos ausfallen. Sie läuft
 * dann mit dem, was die Ansicht ohnehin hatte — schlechter als vollständig,
 * besser als gar nichts.
 *
 * `.maybeSingle()` und nicht `.single()`: ein zwischenzeitlich gelöschter
 * Termin ist ein normaler Fall, kein 406-Fehler (CLAUDE.md, Regeln).
 */
export async function ladeTerminVollstaendig(supabase, termin) {
  if (!supabase || !termin?.id) return termin || null;
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(TERMIN_SELECT)
      .eq('id', termin.id)
      .maybeSingle();
    if (error || !data) return termin;
    return data;
  } catch {
    return termin;
  }
}
