/**
 * zu-beleg.js — Reiner Berechnungs- und Bau-Kern für Zuzahlungsbelege (ZU) als invoices-Zeilen.
 *
 * Rechts- und Fachgrundlage:
 * - GoBD (§ 147 Abs. 1 Nr. 4 AO, Aufbewahrung 8 Jahre, bildlich reproduzierbar)
 * - compliance/LEGAL_DECISIONS.md (Block 10.10.2026, ZU-Nummernkreis + Festschreibung)
 * - wissensbank/SPEC-RULES.md („Zuzahlungsaufforderung (ZU) = VKZ-03-Urbeleg", § 43c SGB V)
 * - Migration 0078_zuzahlungsbeleg_invoices.sql
 *
 * Rein synchron, ohne Netz und ohne Datenbank (testbar mit node:test).
 */

import { ausstellerSnapshot } from '../../lib/rechnung-snapshot.js';

function addDays(isoOrDate, days) {
  if (!isoOrDate) return null;
  let d;
  if (typeof isoOrDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(isoOrDate)) {
    const parts = isoOrDate.slice(0, 10).split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(isoOrDate);
  }
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

/**
 * Baut das Objekt für den INSERT in `invoices` für einen Zuzahlungsbeleg.
 *
 * Wichtig: invoice_number, rechnung_nr und issued_at werden NICHT mitgegeben;
 * der DB-Trigger set_invoice_nummer() vergibt ZU-JJJJ-nnnn und issued_at
 * in Europe/Berlin (Migration 0078).
 */
export function baueZuBelegZeile({
  tenantId,
  rx,
  praxisDruck = {},
  patientDruck = {},
  verordnungDruck = {},
  printSessions = [],
  totals = {},
  zahlungszielTage = 14,
  hinweisText = null,
  invoiceFooterText = '',
  logoUrl = '',
  bankverbindung = '',
}) {
  const zielTage = parseInt(zahlungszielTage, 10) || 14;

  // Normalisierter Aussteller-Snapshot mit Praxisdaten
  const pInput = {
    business_name: praxisDruck.name || praxisDruck.business_name || '',
    street: praxisDruck.strasse || praxisDruck.street || '',
    city: praxisDruck.ort || praxisDruck.city || '',
    plz: praxisDruck.plz || '',
    phone: praxisDruck.telefon || praxisDruck.phone || '',
    email: praxisDruck.email || '',
    ik_number: praxisDruck.ik || praxisDruck.ik_number || '',
    steuernummer: praxisDruck.steuernummer || '',
    ust_id: praxisDruck.ust_id || '',
    ...praxisDruck,
  };
  const baseAussteller = ausstellerSnapshot(pInput);
  if (praxisDruck.name && !baseAussteller.name) baseAussteller.name = praxisDruck.name;
  if (praxisDruck.strasse && !baseAussteller.strasse) baseAussteller.strasse = praxisDruck.strasse;
  if (praxisDruck.plz_ort && !baseAussteller.plzOrt) baseAussteller.plzOrt = praxisDruck.plz_ort;

  const aussteller_snapshot = {
    ...baseAussteller,
    v: 1,
    zu: {
      praxis: praxisDruck,
      bankverbindung: bankverbindung || '',
      logoUrl: logoUrl || '',
      invoiceFooterText: invoiceFooterText || '',
      hinweisText: hinweisText ?? null,
      zahlungszielTage: zielTage,
    },
  };

  const patientName = [patientDruck.vorname, patientDruck.nachname].filter(Boolean).join(' ')
    || [rx?.leads?.first_name, rx?.leads?.last_name].filter(Boolean).join(' ')
    || rx?.patient_name
    || '';

  const patStrasse = patientDruck.strasse || rx?.leads?.street || null;
  const patPlzOrt = [patientDruck.plz || rx?.leads?.plz, patientDruck.ort || rx?.leads?.city].filter(Boolean).join(' ') || null;
  const patGeb = patientDruck.geburtsdatum
    ? String(patientDruck.geburtsdatum).slice(0, 10)
    : (rx?.leads?.geburtsdatum ? String(rx.leads.geburtsdatum).slice(0, 10) : null);

  const empfaenger_snapshot = {
    v: 1,
    art: 'patient',
    name: patientName,
    strasse: patStrasse,
    plzOrt: patPlzOrt,
    geburtsdatum: patGeb,
    zu: {
      patient: patientDruck,
      verordnung: verordnungDruck,
      sessions: printSessions,
      totals,
    },
  };

  // line_items im Format des Rechnungs-Editors (title, quantity, unit_price, price) + ZU-Felder
  const line_items = (printSessions || []).map((s) => ({
    title: s.bezeichnung || rx?.heilmittel || 'Zuzahlung',
    quantity: 1,
    unit_price: Number(s.brutto || 0),
    price: Number(s.brutto || 0),
    session_id: s.session_id || s.id || null,
    datum: s.datum ? String(s.datum).slice(0, 10) : null,
    position: s.position || '',
    brutto: Number(s.brutto || 0),
    zuzahlung: Number(s.zuzahlung || 0),
  }));

  const daten = (printSessions || [])
    .map((s) => (s.datum ? String(s.datum).slice(0, 10) : null))
    .filter(Boolean)
    .sort();
  const leistung_von = daten.length > 0 ? daten[0] : null;
  const leistung_bis = daten.length > 0 ? daten[daten.length - 1] : null;

  const subtotal = Math.round((printSessions || []).reduce((acc, s) => acc + Number(s.brutto || 0), 0) * 100) / 100;
  const gesZuzahlung = Math.round(Number(totals?.gesZuzahlung || 0) * 100) / 100;

  const row = {
    owner_id: tenantId,
    patient_id: rx.patient_id,
    prescription_id: rx.id,
    verordnung_id: null,
    patient_name: patientName,
    invoice_type: 'zuzahlung',
    status: 'sent',
    payment_status: 'pending',
    line_items,
    subtotal,
    kassenzuzahlung: gesZuzahlung,
    total_patient: gesZuzahlung,
    leistung_von,
    leistung_bis,
    aussteller_snapshot,
    empfaenger_snapshot,
  };

  if (rx.business_id) {
    row.business_id = rx.business_id;
  }

  // Schon kassiert (Kassieren vor dem ersten Druck — der übliche Weg am Empfang): Beleg entsteht bezahlt,
  // sonst stünde eine kassierte Zuzahlung als offener Beleg da. Keine zweite Belegliste-Buchung.
  if (rx.zuzahlung_kassiert_am) {
    row.status = 'paid';
    row.payment_status = 'paid';
    row.paid_at = rx.zuzahlung_kassiert_am;
    row.payment_method = ZAHLART_ZU_PAYMENT_METHOD[rx.zuzahlung_zahlart] || null;
  }

  return row;
}

// Spiegel von module/rechnung-zahlung.js ZAHLART_ZU_PAYMENT_METHOD (prescriptions.zuzahlung_zahlart →
// invoices.payment_method); api-backend kann nichts oberhalb seines Verzeichnisses importieren.
const ZAHLART_ZU_PAYMENT_METHOD = { bar: 'bar', ec: 'karte', ueberweisung: 'ueberweisung', paypal: 'sonstiges', sonstiges: 'sonstiges' };

/**
 * Wandelt eine gespeicherte invoices-Zeile in genau die Argumente um,
 * die `renderZuzahlungsrechnung(...)` erwartet.
 */
export function zuDruckDaten(row) {
  const ausZu = row.aussteller_snapshot?.zu || {};
  const empZu = row.empfaenger_snapshot?.zu || {};

  const zahlungszielTage = parseInt(ausZu.zahlungszielTage, 10) || 14;
  const datum = row.issued_at ? String(row.issued_at).slice(0, 10) : null;
  const faelligkeit = datum ? addDays(datum, zahlungszielTage) : new Date(Date.now() + zahlungszielTage * 24 * 60 * 60 * 1000);

  return {
    praxis: ausZu.praxis || {
      name: row.aussteller_snapshot?.name || '',
      strasse: row.aussteller_snapshot?.strasse || '',
      plz_ort: row.aussteller_snapshot?.plzOrt || '',
      telefon: row.aussteller_snapshot?.telefon || '',
      ik: row.aussteller_snapshot?.ik || '',
      email: row.aussteller_snapshot?.email || '',
      steuernummer: row.steuernummer_snapshot || '',
      ust_id: row.ust_id_snapshot || '',
    },
    patient: empZu.patient || {
      nachname: row.empfaenger_snapshot?.name || row.patient_name || '',
      vorname: '',
      strasse: row.empfaenger_snapshot?.strasse || '',
      plz: row.empfaenger_snapshot?.plzOrt?.split(' ')[0] || '',
      ort: row.empfaenger_snapshot?.plzOrt?.split(' ').slice(1).join(' ') || '',
      geburtsdatum: row.empfaenger_snapshot?.geburtsdatum || '',
      kvnr: row.empfaenger_snapshot?.versichertennummer || '',
    },
    verordnung: empZu.verordnung || {},
    rechnung: {
      nummer: row.invoice_number || '',
      datum: datum || new Date(),
      faelligkeit,
    },
    sessions: empZu.sessions || (row.line_items || []).map((l) => ({
      datum: l.datum,
      position: l.position,
      bezeichnung: l.title || l.bezeichnung,
      brutto: l.brutto ?? l.unit_price ?? l.price,
      zuzahlung: l.zuzahlung,
      session_id: l.session_id,
    })),
    totals: empZu.totals || {
      gesZuzahlung: Number(row.kassenzuzahlung ?? row.total_patient ?? 0),
    },
    bankverbindung: ausZu.bankverbindung || '',
    logoUrl: ausZu.logoUrl || '',
    invoiceFooterText: ausZu.invoiceFooterText || '',
    hinweisText: ausZu.hinweisText ?? null,
  };
}

/**
 * Prüft, ob ein gespeicherter ZU-Beleg veraltet ist:
 * true, wenn die gespeicherte Sitzungsmenge (session_id-Menge) oder `gesZuzahlung`
 * von der aktuellen Berechnung abweicht.
 */
export function zuBelegVeraltet(row, { printSessions = [], totals = {} } = {}) {
  if (!row) return true;

  const rowSessionIds = (row.line_items || [])
    .map((l) => l.session_id)
    .filter(Boolean);
  const fallbackRowIds = (row.empfaenger_snapshot?.zu?.sessions || [])
    .map((s) => s.session_id || s.id)
    .filter(Boolean);
  const savedIds = rowSessionIds.length ? rowSessionIds : fallbackRowIds;

  const currentIds = (printSessions || [])
    .map((s) => s.session_id || s.id)
    .filter(Boolean);

  if (savedIds.length !== currentIds.length) {
    return true;
  }

  const savedSet = new Set(savedIds);
  for (const id of currentIds) {
    if (!savedSet.has(id)) {
      return true;
    }
  }

  if (savedIds.length === 0 && currentIds.length === 0) {
    const savedCount = (row.line_items || row.empfaenger_snapshot?.zu?.sessions || []).length;
    if (savedCount !== (printSessions || []).length) {
      return true;
    }
  }

  const savedZuzahlung = row.kassenzuzahlung != null
    ? Number(row.kassenzuzahlung)
    : (row.total_patient != null
      ? Number(row.total_patient)
      : Number(row.empfaenger_snapshot?.zu?.totals?.gesZuzahlung || 0));

  const currentZuzahlung = Number(totals?.gesZuzahlung || 0);

  const centSaved = Math.round(savedZuzahlung * 100);
  const centCurrent = Math.round(currentZuzahlung * 100);

  if (centSaved !== centCurrent) {
    return true;
  }

  return false;
}

/**
 * Erzeugt das INSERT-Objekt für den Storno-Gegenbeleg zu einem ZU-Original.
 *
 * Storno = Gegenbeleg mit eigener Nummer + Verweis auf storno_von, alle Beträge negiert.
 */
export function baueGegenbeleg(orig) {
  if (!orig) throw new Error('Original-Beleg erforderlich für Gegenbeleg');

  const neg = (v) => -Math.abs(Number(v || 0));

  const negLineItems = (orig.line_items || []).map((l) => ({
    ...l,
    unit_price: neg(l.unit_price ?? l.price),
    price: neg(l.price ?? l.unit_price),
    brutto: neg(l.brutto ?? l.unit_price ?? l.price),
    zuzahlung: neg(l.zuzahlung),
  }));

  const gegen = {
    owner_id: orig.owner_id,
    patient_id: orig.patient_id,
    prescription_id: orig.prescription_id,
    verordnung_id: null,
    patient_name: orig.patient_name,
    invoice_type: 'zuzahlung',
    status: 'sent',
    payment_status: 'pending',
    storno_von: orig.id,
    notes: 'Storno zu ' + (orig.invoice_number || ''),
    subtotal: neg(orig.subtotal),
    kassenzuzahlung: neg(orig.kassenzuzahlung),
    total_patient: neg(orig.total_patient),
    line_items: negLineItems,
    aussteller_snapshot: orig.aussteller_snapshot || null,
    empfaenger_snapshot: orig.empfaenger_snapshot || null,
    leistung_von: orig.leistung_von || null,
    leistung_bis: orig.leistung_bis || null,
  };

  if (orig.business_id) {
    gegen.business_id = orig.business_id;
  }

  // Sicherstellen: keine invoice_number, rechnung_nr, issued_at
  delete gegen.invoice_number;
  delete gegen.rechnung_nr;
  delete gegen.issued_at;

  return gegen;
}
