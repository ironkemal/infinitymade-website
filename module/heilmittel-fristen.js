/**
 * heilmittel-fristen.js — Fristen rund um die Heilmittelverordnung.
 *
 * Warum eine eigene Datei
 * ───────────────────────
 * Die Frist stand als nackte Zahl im Speicherpfad der Muster-13-Maske
 * (`14 : 84`). 84 Tage hat keine Quelle — weder in der Heilmittel-Richtlinie
 * noch in einer der Anlagen 3. Damit die Zahl nicht ein zweites Mal
 * unbelegt irgendwo auftaucht, steht sie ab jetzt an genau einer Stelle,
 * mit dem Paragrafen daneben.
 *
 * Quelle
 * ──────
 * [Q] HeilM-RL i. d. F. vom 15.05.2025 (iK 05.08.2025), § 15 „Beginn der
 *     Heilmittelbehandlung":
 *       (1) 1Die Behandlung hat innerhalb von 28 Kalendertagen nach
 *           Verordnung zu beginnen. 2Liegt ein dringlicher Behandlungsbedarf
 *           vor, hat die Behandlung spätestens innerhalb von 14 Kalendertagen
 *           zu beginnen. 3Dies ist auf der Verordnung kenntlich zu machen.
 *       (2) Kann die Heilmittelbehandlung in den genannten Zeiträumen nach
 *           Absatz 1 nicht aufgenommen werden, verliert die Verordnung ihre
 *           Gültigkeit.
 *     Datei: `verordnung rezept/HeilM-RL_2025-05-15_iK-2025-08-05.txt:678-682`
 *
 * § 15 steht im allgemeinen Teil der Richtlinie („Grundsätze der
 * Heilmittelverordnung") und gilt deshalb für ALLE Fachbereiche — Physio,
 * Ergo, Logopädie, Podologie, Ernährungstherapie. Die Anlage 3 Podologie
 * (16.06.2025, Abschnitt 3 e) wiederholt ihn nur wortgleich.
 *
 * Was diese Datei NICHT abbildet
 * ──────────────────────────────
 * § 16 Absatz 4: wird die Behandlung länger als 14 Kalendertage ohne
 * angemessene Begründung unterbrochen, verliert die Verordnung ebenfalls ihre
 * Gültigkeit. Das ist keine Frist ab Ausstellung, sondern eine laufende
 * Bedingung während der Serie — sie gehört an die Terminkette, nicht hierher.
 */

/** [Q] § 15 Abs. 1 Satz 1 und 2 — Kalendertage ab Verordnungsdatum. */
export const BEHANDLUNGSBEGINN_TAGE = { dringend: 14, normal: 28 };

/**
 * Spätester Behandlungsbeginn. Wird die Frist versäumt, verliert die
 * Verordnung ihre Gültigkeit (§ 15 Abs. 2) — deshalb ist dieses Datum das,
 * was in `prescriptions.gueltig_bis` gehört.
 *
 * @param {string} ausstellungsdatum  ISO-Datum "YYYY-MM-DD"
 * @param {boolean} istDringend       Feld „dringlicher Behandlungsbedarf"
 * @returns {string|null} ISO-Datum, oder null bei fehlender/ungültiger Eingabe
 */
export function behandlungsbeginnFrist(ausstellungsdatum, istDringend) {
  if (!ausstellungsdatum) return null;
  const d = new Date(ausstellungsdatum);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + (istDringend ? BEHANDLUNGSBEGINN_TAGE.dringend : BEHANDLUNGSBEGINN_TAGE.normal));
  return d.toISOString().split('T')[0];
}
