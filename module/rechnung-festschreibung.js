/**
 * rechnung-festschreibung.js — was beim Speichern einer schon ausgestellten Rechnung NICHT mitgeschrieben wird.
 *
 * Hintergrund (legal-de/db-ustasi 06.10.2026, Migration 0070): `invoice_festschreibung()` sperrt ab status ≠ draft die
 * Pflichtangaben einer Rechnung (§ 14 Abs. 4 UStG, § 146 Abs. 4 AO). `saveInvoice()` baut seine Nutzlast aber bei JEDEM
 * Speichern neu aus dem Profil (Steuernummer, Steuerstatus, Name …) — nach einer Profiländerung würde schon ein
 * geänderter Bemerkungstext an einer versendeten Rechnung scheitern. Und `status: 'draft'` würde eine versendete
 * Rechnung still auf Entwurf zurücksetzen. Für Nicht-Entwürfe schreibt der Browser deshalb nur noch, was erlaubt ist.
 *
 * Spiegel der DB-Liste (Test prüft die Abdeckung). Die DB bleibt die eigentliche Sperre.
 */
export const FESTGESCHRIEBENE_SPALTEN = Object.freeze([
  'line_items', 'subtotal', 'total_patient', 'netto_gesamt', 'steuer_gesamt', 'brutto_gesamt', 'tax_summary',
  'patient_id', 'issued_at', 'steuerhinweis_text',
  'steuernummer_snapshot', 'ust_id_snapshot', 'steuer_status', 'leistung_von', 'leistung_bis', 'patient_name', 'invoice_type',
  // Eigenanteil/Zuzahlung gehören zum Betrag, den die DB-Sperre über `total_patient` mitschützt.
  'eigenanteil_pct', 'eigenanteil_eur', 'kassenzuzahlung',
]);

/** @param {object} payload  Nutzlast aus saveInvoice()   @param {?string} status  Status der bestehenden Rechnung */
export function payloadFuerUpdate(payload, status) {
  if (!status || status === 'draft') return payload;
  const r = { ...payload };
  for (const sp of FESTGESCHRIEBENE_SPALTEN) delete r[sp];
  delete r.status;
  return r;
}
