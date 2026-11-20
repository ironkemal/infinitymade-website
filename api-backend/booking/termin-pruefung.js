// Gemeinsame Verfügbarkeitsregeln für die Praxis und die öffentliche Slotliste.
import { planErlaubt } from '../lib/standort-plan-laden.js';
const berlinTag = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });
const berlinZeit = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
const zeit = ms => berlinZeit.format(ms);
const trifft = (b, s, e) => Date.parse(b.start_time) < e && Date.parse(b.end_time) > s;

export function qualifikationFehlt(leistungen, zertifikate, empId) {
  return leistungen.some(s => s.required_certificate &&
    !zertifikate.some(c => c.profile_id === empId && c.certificate === s.required_certificate));
}

export function abwesendAm(eintraege, tag) {
  // time_offs speichert inklusive Kalendertage, auch den letzten Tag zu Mitternacht.
  return eintraege.some(t => berlinTag.format(Date.parse(t.start_date)) <= tag &&
    berlinTag.format(Date.parse(t.end_date)) >= tag);
}

export function terminPruefen(daten, termin) {
  const { start, dauer, empId, roomId, id } = termin;
  const ende = start + dauer * 60000;
  const tag = berlinTag.format(start);
  const wochentag = new Date(tag + 'T12:00:00Z').getUTCDay();
  const von = zeit(start), bis = zeit(ende);
  const konflikte = [];
  const melde = (grund, sperre = false) => konflikte.push({ grund, sperre });
  const parallel = daten.bookings.filter(b => b.id !== id && !b.group_parent_id && trifft(b, start, ende));
  if (parallel.some(b => b.user_id === empId && b.status === 'confirmed')) melde('Therapeut:in ist um ' + von + ' belegt.', true);
  const raum = daten.raeume.find(r => r.id === roomId);
  const geeignet = r => daten.leistungen.every(s => (s.raum_ausstattung || []).every(a => r.ausstattung?.includes(a)));
  const frei = r => {
    const belegt = parallel.filter(b => b.room_id === r.id && !['cancelled', 'no_show'].includes(b.status)).length;
    const gruppenraum = r.ausstattung?.some(a => a.trim().toLowerCase() === 'gruppenraum');
    return belegt < (gruppenraum ? r.plaetze : 1);
  };
  if (raum && !geeignet(raum)) melde('Raumausstattung passt nicht zur Leistung.', true);
  if (raum && !frei(raum)) melde('Raum „' + raum.name + '“ ist um ' + von + ' belegt.', true);
  if (!raum && !termin.ohneRaum && (daten.raeume.length || daten.leistungen.some(s => s.raum_ausstattung?.length)) && !daten.raeume.some(r => geeignet(r) && frei(r))) melde('Kein geeigneter Raum frei.', true);
  const sonder = daten.tage.find(t => t.date === tag);
  const geschlossen = sonder && ['closed', 'holiday'].includes(sonder.type);
  if (daten.geschlossen.includes(wochentag) || (geschlossen && (!sonder.start_time || (von < sonder.end_time.slice(0,5) && bis > sonder.start_time.slice(0,5))))) melde('Praxis geschlossen.', true);
  if (abwesendAm(daten.abwesenheiten.filter(t => t.employee_id === empId), tag)) melde('Therapeut:in ist wegen Abwesenheit nicht verfügbar.');
  let fenster = daten.zeiten.filter(w => w.user_id === empId && w.day_of_week === wochentag);
  if (!fenster.length) fenster = daten.zeiten.filter(w => w.user_id === daten.ownerId && w.day_of_week === wochentag);
  if (sonder?.type === 'special' && sonder.start_time && sonder.end_time) fenster = [{ ...sonder, is_active: true }];
  if (berlinTag.format(ende - 1) !== tag || !fenster.some(w => w.is_active && von >= w.start_time.slice(0,5) && bis <= w.end_time.slice(0,5) && bis > von)) melde('Termin liegt außerhalb der Arbeitszeit.');
  if (daten.pausen.some(p => p.user_id === empId && p.day_of_week === wochentag && von < p.end_time.slice(0,5) && bis > p.start_time.slice(0,5))) melde('Termin überlappt eine Pause.');
  const orte = daten.zuordnung.filter(z => z.employee_id === empId);
  if ((daten.businessId && orte.length && !orte.some(z => z.business_id === daten.businessId)) || !planErlaubt(daten.plan, empId, tag, daten.businessId, { start: von, dauerMin: dauer })) melde('Therapeut:in ist nicht an diesem Standort eingeplant.', true);
  if (daten.leistungen.some(s => s.employee_services?.length && !s.employee_services.some(es => es.employee_id === empId))) melde('Leistung ist dieser Person nicht zugeordnet.', true);
  if (qualifikationFehlt(daten.leistungen, daten.zertifikate, empId)) melde('Erforderlicher Zertifikatsnachweis fehlt (' + [...new Set(daten.leistungen.map(s => s.required_certificate).filter(Boolean))].join(', ') + ').');
  if (start < daten.jetzt) melde('Termin liegt in der Vergangenheit.');
  return konflikte;
}

export function terminAlternativen(daten, termin) {
  const konflikte = terminPruefen(daten, termin);
  const vorschlaege = [];
  if (!konflikte.length) return { konflikte, vorschlaege };
  const frei = kandidat => !terminPruefen(daten, kandidat).length;
  if (!termin.ohneRaum) {
    const raum = daten.raeume.find(r => r.id !== termin.roomId && frei({ ...termin, roomId: r.id }));
    if (raum) vorschlaege.push({ roomId: raum.id, label: raum.name });
  }
  for (let start = termin.start + 5 * 60000; start < daten.bis; start += 5 * 60000) {
    if (frei({ ...termin, start })) {
      vorschlaege.push({ startIso: new Date(start).toISOString(), label: berlinTag.format(start) + ' · ' + zeit(start) });
      break;
    }
  }
  const person = daten.team.find(p => p.id !== termin.empId && frei({ ...termin, empId: p.id }));
  if (person) vorschlaege.push({ empId: person.id, label: [person.owner_first_name, person.owner_last_name].filter(Boolean).join(' ') || 'Andere Therapeut:in' });
  return { konflikte, vorschlaege };
}
