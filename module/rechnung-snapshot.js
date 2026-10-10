/**
 * rechnung-snapshot.js — Aussteller/Empfänger einer Rechnung beim Entwurfsspeichern einfrieren (Migration 0075).
 *
 * Warum (legal-de + gkv-302 09.10.2026, compliance/LEGAL_DECISIONS.md; Entscheidung (a) Kemal 09.10.2026):
 * Bis 0075 froren nur Steuernummer/USt-IdNr. ein; Name, Anschrift, IK, Bank der Praxis und der Empfänger wurden
 * zur Druckzeit live gelesen — nach Umzug, Namenskorrektur oder DSGVO-Anonymisierung druckte dieselbe Rechnung
 * anders (§ 147 Abs. 2 Nr. 1 AO). `saveInvoice()` (dashboard.js) schreibt das Ergebnis in jede Entwurfs-Nutzlast;
 * ab status ≠ draft sperrt `invoice_festschreibung()` beide Spalten. Die Ansicht (`rechnung-ansicht.js`) druckt
 * den Snapshot, Altbelege ohne Snapshot weiter live.
 *
 * Die Feldauswahl steckt in `ausstellerSnapshot` (branding.js) und `empfaengerSnapshot` (bg-angaben.js).
 */
import { ausstellerSnapshot } from './branding.js?v=20261009rs';
import { empfaengerSnapshot } from './bg-angaben.js?v=20261009rs';

/** `leads`-Spalten, die der Empfängerblock druckt (gleiche Auswahl wie die Rechnungsansicht, ohne Telefon/E-Mail). */
export const EMPFAENGER_PATIENT_SPALTEN = 'first_name,last_name,title,geburtsdatum,street,plz,city,versichertennummer,krankenkasse';
/** `prescriptions`-Spalten für den BG-Empfänger (UV-Träger + Bezug). */
export const EMPFAENGER_REZEPT_SPALTEN = 'rezeptart,bg_traeger_name,bg_traeger_anschrift,bg_unfalltag,bg_aktenzeichen';

/**
 * @param {object} supabase
 * @param {{profil: object, patientId: ?string, rezeptId: ?string, invoiceType: ?string}} q
 *   profil = Profilzeile der PRAXIS (`ownerProfile || currentProfile`), rezeptId = prescription_id ODER verordnung_id
 * @returns {Promise<{aussteller_snapshot: object, empfaenger_snapshot: ?object}>}
 */
export async function rechnungSnapshots(supabase, q) {
  return (await snapshotsMitGrund(supabase, q)).snap;
}

async function snapshotsMitGrund(supabase, { profil, patientId, rezeptId, invoiceType }) {
  const [patientRes, rezeptRes] = await Promise.all([
    patientId ? supabase.from('leads').select(EMPFAENGER_PATIENT_SPALTEN).eq('id', patientId).maybeSingle() : { data: null },
    rezeptId ? supabase.from('prescriptions').select(EMPFAENGER_REZEPT_SPALTEN).eq('id', rezeptId).maybeSingle() : { data: null },
  ]);
  // Lesefehler: Empfänger bleibt null; `rechnungSnapshotsGeprueft` fragt dann, ob trotzdem als Entwurf gespeichert wird.
  if (patientRes?.error) console.error('[rechnung-snapshot] Patient', patientRes.error.message);
  if (rezeptRes?.error) console.error('[rechnung-snapshot] Verordnung', rezeptRes.error.message);
  const snap = {
    aussteller_snapshot: ausstellerSnapshot(profil),
    empfaenger_snapshot: empfaengerSnapshot({ patient: patientRes?.data || null, rx: rezeptRes?.data || null, invoiceType }),
  };
  const grund = snap.empfaenger_snapshot ? null
    : (patientRes?.error || rezeptRes?.error) ? 'Die Patientendaten konnten gerade nicht gelesen werden.'
    : 'Beim Patienten ist kein Name hinterlegt.';
  return { snap, grund };
}

/**
 * Wie `rechnungSnapshots`, aber ohne Empfänger wird VOR dem Speichern gefragt (KHS §6 KALAN İŞ 2 (v), onprem §7AN):
 * ein Entwurf ohne Empfänger-Snapshot kann ab 0080 nicht ausgestellt/bezahlt werden. Abbrechen → `null`, der Aufrufer
 * speichert nicht. `bestaetige` = showConfirmModal (dashboard.js) → Promise<boolean>.
 */
export async function rechnungSnapshotsGeprueft(supabase, q, { bestaetige } = {}) {
  const { snap, grund } = await snapshotsMitGrund(supabase, q);
  if (!grund) return snap;
  const ok = typeof bestaetige === 'function' && await bestaetige({
    title: 'Empfänger fehlt',
    message: grund + ' Ohne Empfängerangaben bleibt die Rechnung ein Entwurf: sie kann erst bezahlt oder ausgestellt werden, wenn Sie sie mit vollständigen Patientendaten erneut speichern.',
    confirmText: 'Als Entwurf speichern', cancelText: 'Abbrechen', variant: 'warning',
  });
  return ok ? snap : null;
}
