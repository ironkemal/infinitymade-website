import { ladeStandortPlan } from '../lib/standort-plan-laden.js';
import { terminAlternativen } from './termin-pruefung.js';

async function zeilen(query) {
  const { data, error } = await query;
  if (error || !Array.isArray(data) || data.length >= 1000) throw new Error('Planungsdaten unvollständig');
  return data;
}

export async function planungLaden(sb, { ownerId, businessId, serviceIds, von, bis, tag, folgetag, empId }) {
  const scope = query => businessId ? query.eq('business_id', businessId) : query.is('business_id', null);
  const team = await zeilen(sb.from('profiles').select('id,owner_first_name,owner_last_name,is_active')
    .or('id.eq.' + ownerId + ',owner_id.eq.' + ownerId));
  const employeeIds = team.filter(p => p.is_active !== false || p.id === ownerId).map(p => p.id);
  if (!employeeIds.includes(empId)) throw new Error('Person nicht verfügbar');
  const [bookings, raeume, tage, abwesenheiten, zeiten, zertifikate, leistungen, standorte, plan, pausen, zuordnung] = await Promise.all([
    zeilen(sb.from('bookings').select('id,user_id,business_id,room_id,status,start_time,end_time,group_parent_id,is_group,group_capacity,service_id').eq('owner_id', ownerId).lt('start_time', bis).gt('end_time', von).is('group_parent_id', null)),
    zeilen(scope(sb.from('rooms').select('id,name,plaetze,ausstattung').eq('owner_id', ownerId).eq('aktiv', true)).order('sort')),
    zeilen(sb.from('custom_days').select('date,type,start_time,end_time').eq('owner_id', ownerId).gte('date', tag).lte('date', folgetag)),
    zeilen(sb.from('time_offs').select('employee_id,start_date,end_date').in('employee_id', employeeIds).lt('start_date', bis).gte('end_date', von)),
    zeilen(sb.from('working_hours').select('user_id,day_of_week,start_time,end_time,is_active').in('user_id', employeeIds)),
    zeilen(sb.from('therapist_certificates').select('profile_id,certificate').eq('owner_id', ownerId)),
    serviceIds.length ? zeilen(sb.from('services').select('id,required_certificate,raum_ausstattung,is_online_meeting,is_group,employee_services(employee_id)').or('owner_id.eq.' + ownerId + ',user_id.eq.' + ownerId).in('id', serviceIds)) : [],
    businessId ? zeilen(sb.from('businesses').select('id,closed_days').eq('owner_id', ownerId).eq('id', businessId)) : [],
    ladeStandortPlan(sb, { ownerId, employeeIds }),
    zeilen(sb.from('breaks').select('user_id,day_of_week,start_time,end_time').in('user_id', employeeIds)),
    businessId ? zeilen(sb.from('employee_business_assignments').select('employee_id,business_id').in('employee_id', employeeIds)) : [],
  ]);
  if (businessId && !standorte.length || leistungen.length !== serviceIds.length) throw new Error('Standort oder Leistung nicht verfügbar');
  return { ownerId, businessId, bookings, raeume, tage, abwesenheiten, zeiten, zertifikate, leistungen, pausen, plan, zuordnung,
    team: team.filter(p => employeeIds.includes(p.id)), geschlossen: standorte[0]?.closed_days || [], jetzt: Date.now(), bis: Date.parse(bis) };
}

export function terminPlanungHandler({ sb, grenzen }) {
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  return async (req, res) => {
    const { id, empId, roomId, businessId, startIso, dauer, serviceIds = [], ohneRaum } = req.body;
    if (!uuid.test(empId) || [id, roomId, businessId].some(v => v && !uuid.test(v)) ||
        !Number.isInteger(dauer) || dauer < 1 || dauer > 1440 || !Array.isArray(serviceIds) ||
        serviceIds.length > 30 || serviceIds.some(v => !uuid.test(v)) || !Number.isFinite(Date.parse(startIso))) return res.status(400).json({ error: 'Terminangaben ungültig.' });
    try {
      const start = Date.parse(startIso);
      const tag = new Date(start).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
      const folgetag = new Date(Date.parse(tag + 'T12:00:00Z') + 86400000).toISOString().slice(0,10);
      const daten = await planungLaden(sb, { ownerId: req.auth.tenantId, empId, businessId, serviceIds: [...new Set(serviceIds)],
        von: grenzen(tag).start, bis: grenzen(folgetag).end, tag, folgetag });
      if (roomId && !daten.raeume.some(r => r.id === roomId)) return res.status(400).json({ error: 'Raum am Standort nicht verfügbar.' });
      res.setHeader('Cache-Control', 'no-store');
      return res.json(terminAlternativen(daten, { id, empId, roomId, start, dauer, ohneRaum: ohneRaum === true || daten.leistungen.length > 0 && daten.leistungen.every(s => s.is_online_meeting) }));
    } catch {
      return res.status(503).json({ error: 'Verfügbarkeit konnte nicht geprüft werden. Bitte erneut versuchen.' });
    }
  };
}
