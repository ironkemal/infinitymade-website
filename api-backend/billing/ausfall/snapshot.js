// Ausfallrechnung — Aussteller/Empfänger-Snapshot (Migration 0076). Ohne Netz/DB, damit testbar;
// Aufrufer: billing/api/ausfall.routes.js (create schreibt, renderInvoiceHtml liest).

import { praxisKopf, ausstellerSnapshot } from '../../lib/rechnung-snapshot.js';

// Snapshot (Migration 0076, KHS §4): Aussteller und Empfänger wie gedruckt, beim Anlegen eingefroren —
// sonst druckt dieselbe AF-Nummer nach Umzug/Umbenennung/Anonymisierung anders (§ 147 Abs. 2 Nr. 1 AO).
// Form wie invoices (0075); Ausfall druckt zusätzlich die Steuernummer, daher ein Schlüssel mehr.
export function ausfallAusstellerSnapshot(praxisProfile, { standort = null, userEmail = '' } = {}) {
  const kopf = praxisKopf(praxisProfile, { ersatzEmail: userEmail });
  return {
    ...ausstellerSnapshot(praxisProfile),
    name: standort?.business_name || kopf.name,
    telefon: standort?.phone || kopf.telefon,
    email: kopf.email,
    steuernummer: String(praxisProfile?.steuernummer ?? '').trim(),
  };
}

/** Empfänger aus patientFromBooking() — nur die gedruckten Felder (Art. 5 Abs. 1 lit. c). */
export function ausfallEmpfaengerSnapshot(patient) {
  const p = patient || {};
  const name = [p.vorname, p.nachname].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');
  if (!name) return null;
  return {
    v: 1, art: 'patient', name,
    strasse: String(p.strasse ?? '').trim() || null,
    plzOrt: [p.plz, p.ort].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ') || null,
    geburtsdatum: p.geburtsdatum ? String(p.geburtsdatum).slice(0, 10) : null,
  };
}
