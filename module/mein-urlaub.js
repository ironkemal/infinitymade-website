/** Read-only personal employment summary; never accepts another employee's ID. */
import { ladeAnstellung, anstellungHtml, urlaubsKennzahlen } from './anstellung.js?v=20261101h';

export function mountMeinUrlaub(host, { supabase, getProfil, jetzt = () => new Date() }) {
  let generation = 0;
  async function laden() {
    const lauf = ++generation;
    const profil = getProfil();
    host.hidden = profil?.role !== 'employee' || !profil?.id;
    host.innerHTML = '';
    if (host.hidden) return;
    host.innerHTML = '<h3>Mein Urlaub</h3><p role="status">Anstellung und Urlaub werden geladen …</p>';
    const aktuell = () => lauf === generation && getProfil()?.role === 'employee' && getProfil()?.id === profil.id;
    const jahr = Number(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(jetzt()));
    const von = `${jahr}-01-01`, bis = `${jahr}-12-31`;
    try {
      const [anstellung, zeiten, urlaub] = await Promise.all([
        ladeAnstellung({ supabase, empId: profil.id }),
        supabase.from('working_hours').select('day_of_week,is_active').eq('user_id', profil.id),
        supabase.from('time_offs').select('start_date,end_date,type').eq('employee_id', profil.id)
          .eq('type', 'urlaub').lte('start_date', `${bis}T23:59:59.999+01:00`).gte('end_date', `${von}T00:00:00+01:00`),
      ]);
      if (!aktuell()) return;
      if (anstellung.fehler) throw new Error('ANSTELLUNG_UNAVAILABLE');
      if (!anstellung.vorhanden) {
        host.innerHTML = '<h3>Mein Urlaub</h3><p role="status">Noch keine Anstellungsdaten hinterlegt. Bitte Praxisinhaber kontaktieren.</p>';
        return;
      }
      host.innerHTML = `<h3>Mein Urlaub · ${jahr}</h3>${anstellungHtml(anstellung, { istInhaber: false })}`;
      const arbeitstage = new Set((zeiten.data || []).filter(z => z.is_active).map(z => z.day_of_week));
      if (zeiten.error || urlaub.error || !arbeitstage.size || !Number.isFinite(anstellung.urlaub_jahrestage)) {
        host.innerHTML += '<p role="status">Urlaubssaldo gerade nicht verfügbar. Bitte Arbeitszeiten und Urlaubseinträge mit dem Praxisinhaber prüfen.</p>';
        return;
      }
      const abwesenheiten = (urlaub.data || []).map(u => ({ ...u, start_date: String(u.start_date).slice(0, 10) < von ? von : u.start_date, end_date: String(u.end_date).slice(0, 10) > bis ? bis : u.end_date }));
      const { verbraucht, rest } = urlaubsKennzahlen({ abwesenheiten, anspruch: anstellung.urlaub_jahrestage, arbeitstage });
      host.innerHTML += `<p><strong>${rest} ${rest === 1 ? 'Tag' : 'Tage'} übrig</strong> · ${verbraucht} ${verbraucht === 1 ? 'Tag' : 'Tage'} eingetragen</p><p class="form-hint">Enthält bereits eingetragenen künftigen Urlaub. Bei Fragen bitte Praxisinhaber kontaktieren.</p>`;
    } catch {
      if (aktuell()) host.innerHTML = '<h3>Mein Urlaub</h3><p role="status">Anstellung und Urlaub sind gerade nicht verfügbar. Bitte später erneut öffnen.</p>';
    }
  }
  return { laden, verwerfen() { generation++; host.hidden = true; host.innerHTML = ''; } };
}
