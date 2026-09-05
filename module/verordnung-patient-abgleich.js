import { emit } from './signal.js?v=20260813';

/**
 * verordnung-patient-abgleich.js — Patientenstammdaten nach manueller
 * Verordnungserfassung abgleichen (dashboard.js saveRezept(), Muster 13).
 *
 * Zwei Teile, ein Aufruf:
 *  1. Leere Felder aus der Verordnung ins Patientenstammblatt übernehmen —
 *     reiner Umzug aus dashboard.js, unverändert (nie überschreiben).
 *  2. Namensabgleich (Ops #268, Beta-2 05.09.2026): weicht der auf der
 *     Verordnung stehende Name vom gespeicherten Patientennamen ab, fragt
 *     eine Bestätigung, ob der Patientenname angepasst werden soll — die
 *     Verordnung hat Vorrang, weil sie meist die korrekte Quelle ist
 *     (Handschrift des Arztes vs. Tippfehler bei Anlage, nicht nachgetragene
 *     Heirat/Namensänderung).
 */
export async function verordnungPatientenAbgleich(ctx, felder) {
  const { supabase, showConfirmModal } = ctx;
  const {
    ownerId, patientId, lead, vorname, nachname,
    versichertennummer, krankenkasse, versichertenstatus,
    strasse, ort, geburtsdatum
  } = felder;
  if (!patientId) return;

  const patch = {};
  if (!lead.versichertennummer && versichertennummer) patch.versichertennummer = versichertennummer;
  if (!lead.krankenkasse && krankenkasse) patch.krankenkasse = krankenkasse;
  if (!lead.versichertenstatus && versichertenstatus) patch.versichertenstatus = versichertenstatus;
  if (!lead.street && strasse) patch.street = strasse;
  if (!lead.plz && !lead.city && ort) {
    const mo = ort.match(/^\s*(\d{4,5})\s+(.+)$/);
    if (mo) { patch.plz = mo[1]; patch.city = mo[2].trim(); } else { patch.city = ort; }
  }
  if (!lead.geburtsdatum) {
    const mg = geburtsdatum.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (mg) {
      const yy = mg[3].length === 2 ? (parseInt(mg[3]) > 30 ? '19' + mg[3] : '20' + mg[3]) : mg[3];
      patch.geburtsdatum = `${yy}-${mg[2].padStart(2, '0')}-${mg[1].padStart(2, '0')}`;
    }
  }

  const leadVorname = (lead.first_name || '').trim();
  const leadNachname = (lead.last_name || '').trim();
  const weichtAb = (vorname && leadVorname && vorname.toLowerCase() !== leadVorname.toLowerCase())
    || (nachname && leadNachname && nachname.toLowerCase() !== leadNachname.toLowerCase());
  if (weichtAb) {
    const uebernehmen = await showConfirmModal({
      title: 'Name weicht ab',
      message: `Verordnung: "${vorname} ${nachname}"\nPatientenakte: "${leadVorname} ${leadNachname}"\n\nPatientennamen an die Verordnung anpassen?`,
      confirmText: 'Ja, Patientennamen anpassen',
      cancelText: 'Nein, nur diese Verordnung'
    });
    if (uebernehmen) {
      if (vorname) patch.first_name = vorname;
      if (nachname) patch.last_name = nachname;
      const combined = [vorname, nachname].filter(Boolean).join(' ');
      if (combined) patch.title = combined;
    }
  }

  if (!Object.keys(patch).length) return;
  await supabase.from('leads').update(patch).eq('id', patientId).eq('owner_id', ownerId);
  emit('leads:changed', { id: patientId });
}
