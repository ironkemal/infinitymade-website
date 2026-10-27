const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const id = value => typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null;
const fail = code => { throw new Error(code); };
const deny = code => { throw Object.assign(new Error(code), { status: 403, code }); };
const CODES = new Set(['KONTEXT_UNGUELTIG', 'SCOPE_UNGUELTIG', 'QUELLEN_UNVOLLSTAENDIG', 'QUELLEN_WIDERSPRUCH', 'WOCHENBASIS_FEHLT']);
const complete = value => value?.vollstaendig === true && Array.isArray(value.gruende) && value.gruende.length === 0;

// Exact count and ordered pages belong to the SAME source reads. A short page
// alone is never proof: PostgREST can cap responses below the requested range.
async function rows(supabase, table, columns, filter) {
  const result = [], seen = new Set();
  let expected = null;
  for (let page = 0; page < 10000; page++) {
    const response = await filter(supabase.from(table).select(columns, { count: 'exact' }))
      .order('id', { ascending: true }).range(result.length, result.length + 499);
    if (response?.error || !Array.isArray(response?.data)
      || !Number.isSafeInteger(response.count) || response.count < 0
      || (expected !== null && expected !== response.count)) fail('QUELLEN_UNVOLLSTAENDIG');
    expected = response.count;
    if (!response.data.length && result.length !== expected) fail('QUELLEN_UNVOLLSTAENDIG');
    for (const row of response.data) {
      const key = id(row?.id);
      if (!key || seen.has(key) || (result.length && key <= id(result.at(-1).id))) fail('QUELLEN_WIDERSPRUCH');
      seen.add(key); result.push(row);
    }
    if (result.length > expected) fail('QUELLEN_WIDERSPRUCH');
    if (result.length === expected) return result;
  }
  fail('QUELLEN_UNVOLLSTAENDIG');
}

function scopeFor(input) {
  if (!input || Object.keys(input).sort().join(',') !== 'jetzt,modus,role,tage,tenantId,userId,version'
    || input.version !== 1 || !['tag', 'woche'].includes(input.modus)
    || !id(input.tenantId) || !id(input.userId) || !['owner', 'employee'].includes(input.role)
    || (input.role === 'owner') !== (id(input.userId) === id(input.tenantId))) deny('ZUGRIFF_VERWEIGERT');
  if (input.role === 'employee' && input.modus === 'woche') deny('NUR_INHABER');
  if (!Array.isArray(input.tage) || input.tage.length !== (input.modus === 'tag' ? 1 : 7)
    || new Set(input.tage).size !== input.tage.length
    || !input.tage.every(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)
      && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day)
    || typeof input.jetzt !== 'string' || !Number.isFinite(Date.parse(input.jetzt))) deny('ZUGRIFF_VERWEIGERT');
  return { tenantId: id(input.tenantId), userId: id(input.userId), role: input.role };
}

/** Metadata only; no patient data, slot generator or permission guesswork.
 * Why/where: complete tenant/site/service evidence for B08 Startseite injection.
 * The raw weekly basis is supplied by the instrumented original engine caller.
 */
export function createVerfuegbarkeitKontext({ supabase, ladeBasis, rasterMin = 15 } = {}) {
  if (!supabase?.from || !Number.isInteger(rasterMin) || rasterMin < 1 || rasterMin > 1440) {
    throw new TypeError('Supabase und gültiges Raster erforderlich');
  }
  return async function ladeKontext(input) {
    const scope = scopeFor(input);
    const envelope = { version: 1, ...scope };
    try {
      const tenant = scope.tenantId;
      const team = await rows(supabase, 'profiles', 'id,owner_id,role,is_active', q => scope.role === 'employee' ? q.eq('id', scope.userId) : q.or(`id.eq.${tenant},owner_id.eq.${tenant}`));
      for (const p of team) {
        if (id(p.id) === tenant ? (p.owner_id != null && id(p.owner_id) !== tenant) || p.role !== 'owner'
          : id(p.owner_id) !== tenant || p.role !== 'employee') fail('SCOPE_UNGUELTIG');
        if (typeof p.is_active !== 'boolean') fail('KONTEXT_UNGUELTIG');
      }
      const members = new Set(team.map(p => id(p.id)));
      const caller = team.find(p => id(p.id) === scope.userId);
      if (!caller || !caller.is_active || caller.role !== scope.role) fail('SCOPE_UNGUELTIG');
      const services = await rows(supabase, 'services', 'id,owner_id,user_id,duration_minutes,is_internal,is_group,business_id,required_certificate',
        q => q.or(`owner_id.eq.${tenant},user_id.eq.${tenant}`));
      const businesses = await rows(supabase, 'businesses', 'id,owner_id,is_default', q => q.eq('owner_id', tenant));
      const sites = new Set(businesses.map(b => id(b.id)));
      for (const b of businesses) if (id(b.owner_id) !== tenant || typeof b.is_default !== 'boolean') fail('SCOPE_UNGUELTIG');
      for (const s of services) {
        if (id(s.owner_id ?? s.user_id) !== tenant || (s.owner_id != null && s.user_id != null && id(s.owner_id) !== id(s.user_id))) fail('SCOPE_UNGUELTIG');
        if (typeof s.is_internal !== 'boolean' || typeof s.is_group !== 'boolean'
          || (s.business_id != null && !sites.has(id(s.business_id)))) fail('KONTEXT_UNGUELTIG');
      }
      const assignments = await rows(supabase, 'employee_services', 'id,employee_id,service_id,business_id', q => q.in('employee_id', [...members]));
      const locations = await rows(supabase, 'employee_business_assignments', 'id,employee_id,business_id', q => q.in('employee_id', [...members]));
      const certificates = await rows(supabase, 'therapist_certificates', 'id,owner_id,profile_id,certificate', q => scope.role === 'employee' ? q.eq('owner_id', tenant).eq('profile_id', scope.userId) : q.eq('owner_id', tenant));
      const serviceIds = new Set(services.map(s => id(s.id)));
      for (const a of assignments) if (!members.has(id(a.employee_id)) || !serviceIds.has(id(a.service_id))
        || (a.business_id != null && !sites.has(id(a.business_id)))) fail('SCOPE_UNGUELTIG');
      for (const a of locations) if (!members.has(id(a.employee_id)) || !sites.has(id(a.business_id))) fail('SCOPE_UNGUELTIG');
      for (const c of certificates) if (id(c.owner_id) !== tenant || !members.has(id(c.profile_id)) || typeof c.certificate !== 'string') fail('SCOPE_UNGUELTIG');
      const publicServices = services.filter(s => !s.is_internal);
      for (const s of publicServices) {
        if (!Number.isInteger(s.duration_minutes) || s.duration_minutes < 1 || s.duration_minutes > 1440) fail('KONTEXT_UNGUELTIG');
        if (!assignments.some(a => id(a.service_id) === id(s.id))) fail('QUELLEN_WIDERSPRUCH');
      }
      const people = team.filter(p => p.is_active && (scope.role === 'owner' || id(p.id) === scope.userId));
      const behandler = people.map(p => {
        let standorte;
        if (id(p.id) === tenant) standorte = sites.size ? [...sites] : [null];
        else {
          standorte = [...new Set(locations.filter(a => id(a.employee_id) === id(p.id)).map(a => id(a.business_id)))];
          if (!standorte.length) {
            const defaults = businesses.filter(b => b.is_default);
            if (!sites.size) standorte = [null];
            else if (defaults.length === 1) standorte = [id(defaults[0].id)];
            else fail('QUELLEN_WIDERSPRUCH');
          }
        }
        const leistungen = [];
        for (const s of publicServices) {
          const assigned = assignments.filter(a => id(a.employee_id) === id(p.id) && id(a.service_id) === id(s.id));
          if (!assigned.length) continue;
          if (s.required_certificate != null && (typeof s.required_certificate !== 'string' || !s.required_certificate
            || !certificates.some(c => id(c.profile_id) === id(p.id) && c.certificate === s.required_certificate))) fail('QUELLEN_WIDERSPRUCH');
          const selected = new Set();
          for (const a of assigned) {
            const serviceSite = s.business_id == null ? null : id(s.business_id);
            const assignedSite = a.business_id == null ? null : id(a.business_id);
            if (serviceSite && assignedSite && serviceSite !== assignedSite) fail('QUELLEN_WIDERSPRUCH');
            const site = assignedSite ?? serviceSite;
            if (site && !standorte.includes(site)) fail('QUELLEN_WIDERSPRUCH');
            for (const businessId of site ? [site] : standorte) selected.add(businessId);
          }
          for (const businessId of selected) leistungen.push({ tenantId: tenant, serviceId: id(s.id), businessId,
            aktiv: true, erlaubt: true, dauerMin: s.duration_minutes, pufferMin: 0, rasterMin, istGruppe: s.is_group });
        }
        return { tenantId: tenant, userId: id(p.id), role: p.role, standorte, leistungen };
      });
      const context = { ...envelope, vollstaendig: true, gruende: [], behandler };
      if (input.modus === 'woche') {
        if (typeof ladeBasis !== 'function') fail('WOCHENBASIS_FEHLT');
        const tage = [];
        for (const tag of input.tage) for (const p of behandler) for (const businessId of p.standorte) {
          const basis = await ladeBasis({ tenantId: tenant, userId: p.userId, tag, businessId, jetzt: input.jetzt });
          if (!complete(basis) || basis.version !== 1 || id(basis.tenantId) !== tenant || id(basis.userId) !== p.userId
            || basis.tag !== tag || basis.businessId !== businessId
            || !['arbeitszeit', 'sperren', 'buchungen'].every(k => basis.quellen?.[k] === 'vollstaendig')
            || !(basis.externStatus === 'verbunden' ? basis.quellen.extern === 'vollstaendig'
              : ['aus', 'nicht_konfiguriert'].includes(basis.externStatus) && basis.quellen.extern === 'nicht_erforderlich')) fail('WOCHENBASIS_FEHLT');
          tage.push(basis);
        }
        context.wochenbasis = { vollstaendig: true, gruende: [], tage };
      }
      return context;
    } catch (error) {
      return { ...envelope, vollstaendig: false, gruende: [CODES.has(error?.message) ? error.message : 'QUELLEN_UNVOLLSTAENDIG'], behandler: [] };
    }
  };
}
