// Gemeinsame Verfügbarkeitsregeln für die Praxis und die öffentliche Slotliste.
import { planErlaubt } from '../lib/standort-plan-laden.js';
/**
 * @typedef {{start:number,dauer:number,empId:string,roomId?:string|null,id?:string|null,ohneRaum?:boolean}} Termin
 * @typedef {{id:string,name:string,plaetze:number,ausstattung?:string[]}} Raum
 * @typedef {{id?:string,required_certificate?:string,raum_ausstattung?:string[],employee_services?:{employee_id:string}[]}} Leistung
 * @typedef {{user_id?:string,day_of_week?:number,is_active?:boolean,start_time:string,end_time:string}} Zeitfenster
 * @typedef {{type:string,date:string,start_time:string,end_time:string}} Sondertag
 * @typedef {{start_time:string,end_time:string,id:string,group_parent_id?:string,business_id?:string|null,room_id:string,user_id:string,status:string}} Buchung
 * @typedef {{employee_id:string,start_date:string,end_date:string}} Abwesenheit
 * @typedef {{profile_id:string,certificate:string}} Nachweis
 * @typedef {{ownerId:string,businessId:string|null,bookings:Buchung[],raeume:Raum[],tage:Sondertag[],
 *   abwesenheiten:Abwesenheit[],zeiten:Zeitfenster[],zertifikate:Nachweis[],leistungen:Leistung[],
 *   team:{id:string,owner_first_name?:string,owner_last_name?:string}[],pausen:Zeitfenster[],
 *   geschlossen:number[],zuordnung:{employee_id:string,business_id:string}[],plan:any[],jetzt:number,bis:number}} Planung
 */
const berlinTag = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });
const berlinZeit = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
/** @param {number} ms */
const zeit = ms => berlinZeit.format(ms);
/** @param {Buchung} b @param {number} s @param {number} e */
const trifft = (b, s, e) => Date.parse(b.start_time) < e && Date.parse(b.end_time) > s;

/** @param {Leistung[]} leistungen @param {Nachweis[]} zertifikate @param {string} empId */
export function qualifikationFehlt(leistungen, zertifikate, empId) {
  return leistungen.some(s => s.required_certificate &&
    !zertifikate.some(c => c.profile_id === empId && c.certificate === s.required_certificate));
}

/** @param {Abwesenheit[]} eintraege @param {string} tag */
export function abwesendAm(eintraege, tag) {
  // time_offs speichert inklusive Kalendertage, auch den letzten Tag zu Mitternacht.
  return eintraege.some(t => berlinTag.format(Date.parse(t.start_date)) <= tag &&
    berlinTag.format(Date.parse(t.end_date)) >= tag);
}

/** @param {Planung} daten @param {string} empId @param {number} wochentag @param {Sondertag|undefined} sonder */
export function arbeitsfenster(daten, empId, wochentag, sonder) {
  let fenster = daten.zeiten.filter(w => w.user_id === empId && w.day_of_week === wochentag);
  if (!fenster.length) fenster = daten.zeiten.filter(w => w.user_id === daten.ownerId && w.day_of_week === wochentag);
  if (sonder?.type === 'special' && sonder.start_time && sonder.end_time) fenster = [{ ...sonder, is_active: true }];
  return fenster.filter(w => w.is_active);
}

/** @param {Planung} daten @param {Termin} termin */
export function terminPruefen(daten, termin) {
  const { start, dauer, empId, roomId, id } = termin;
  const ende = start + dauer * 60000;
  const tag = berlinTag.format(start);
  const wochentag = new Date(tag + 'T12:00:00Z').getUTCDay();
  const von = zeit(start), bis = zeit(ende);
  /** @type {{grund:string,sperre:boolean}[]} */
  const konflikte = [];
  /** @param {string} grund */
  const melde = (grund, sperre = false) => konflikte.push({ grund, sperre });
  const parallel = daten.bookings.filter(b => b.id !== id && !b.group_parent_id && trifft(b, start, ende));
  if (parallel.some(b => b.user_id === empId && b.status === 'confirmed')) melde('Therapeut:in ist um ' + von + ' belegt.', true);
  const raum = daten.raeume.find(r => r.id === roomId);
  /** @param {Raum} r */
  const geeignet = r => daten.leistungen.every(s => (s.raum_ausstattung || []).every(a => r.ausstattung?.includes(a)));
  /** @param {Raum} r */
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
  const bestand = id && daten.bookings.some(b => b.id === id && Date.parse(b.start_time) === start && (b.business_id ?? null) === (daten.businessId ?? null));
  if (daten.geschlossen.includes(wochentag) || (geschlossen && (!sonder.start_time || (von < sonder.end_time.slice(0,5) && bis > sonder.start_time.slice(0,5))))) melde('Praxis geschlossen.', !bestand);
  if (abwesendAm(daten.abwesenheiten.filter(t => t.employee_id === empId), tag)) melde('Therapeut:in ist wegen Abwesenheit nicht verfügbar.');
  const fenster = arbeitsfenster(daten, empId, wochentag, sonder);
  if (berlinTag.format(ende - 1) !== tag || !fenster.some(w => w.is_active && von >= w.start_time.slice(0,5) && bis <= w.end_time.slice(0,5) && bis > von)) melde('Termin liegt außerhalb der Arbeitszeit.');
  if (daten.pausen.some(p => p.user_id === empId && p.day_of_week === wochentag && von < p.end_time.slice(0,5) && bis > p.start_time.slice(0,5))) melde('Termin überlappt eine Pause.');
  const orte = daten.zuordnung.filter(z => z.employee_id === empId);
  if ((daten.businessId && orte.length && !orte.some(z => z.business_id === daten.businessId)) || !planErlaubt(daten.plan, empId, tag, daten.businessId, { start: von, dauerMin: dauer })) melde('Therapeut:in ist nicht an diesem Standort eingeplant.', true);
  if (daten.leistungen.some(s => s.employee_services?.length && !s.employee_services.some(es => es.employee_id === empId))) melde('Leistung ist dieser Person nicht zugeordnet.', true);
  if (qualifikationFehlt(daten.leistungen, daten.zertifikate, empId)) melde('Erforderlicher Zertifikatsnachweis fehlt (' + [...new Set(daten.leistungen.map(s => s.required_certificate).filter(Boolean))].join(', ') + ').');
  if (start < daten.jetzt) melde('Termin liegt in der Vergangenheit.');
  return konflikte;
}

/** @param {Planung} daten @param {Termin} termin */
export function terminAlternativen(daten, termin) {
  const konflikte = terminPruefen(daten, termin);
  /** @type {{label:string,roomId?:string,empId?:string,startIso?:string}[]} */
  const vorschlaege = [];
  if (!konflikte.length) return { konflikte, vorschlaege };
  /** @param {Termin} kandidat */
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
