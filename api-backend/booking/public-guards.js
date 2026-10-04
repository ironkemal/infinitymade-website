export function validateHoneypot(website) {
  if (website === undefined || website === null) return { ok: true, trapped: false };
  if (typeof website !== 'string') return { ok: false, status: 400, error: 'Ungültige Anfrage' };
  if (website.trim().length > 0) return { ok: true, trapped: true };
  return { ok: true, trapped: false };
}

export function checkHoneypot(req, res) {
  const website = req?.body?.website;
  const result = validateHoneypot(website);
  if (!result.ok) {
    res.status(result.status || 400).json({ error: result.error });
    return true;
  }
  if (result.trapped) {
    res.status(200).json({ success: true });
    return true;
  }
  return false;
}

export function getCanonicalOwnerId(service) {
  if (!service || typeof service !== 'object') return null;
  return service.owner_id ?? service.user_id ?? null;
}

export async function validateOwnerProfile(supabase, ownerId) {
  if (!ownerId) return { ok: false, status: 400, error: 'Ungültige Praxis' };
  const { data, error } = await supabase.from('profiles').select('id, role, owner_id, is_active, email, business_name').eq('id', ownerId).maybeSingle();
  if (error) return { ok: false, status: 500, error: 'Interner Serverfehler' };
  if (!data || data.role !== 'owner' || data.owner_id != null || data.is_active === false) {
    return { ok: false, status: 400, error: 'Ungültige Praxis' };
  }
  return { ok: true, profile: data };
}

export async function validateTherapist(supabase, therapistId, canonicalOwnerId) {
  if (!therapistId) return { ok: false, status: 400, error: 'Ungültiger Therapeut' };
  const { data, error } = await supabase.from('profiles').select('id, owner_id, is_active').eq('id', therapistId).maybeSingle();
  if (error) return { ok: false, status: 500, error: 'Interner Serverfehler' };
  if (!data || data.is_active === false) return { ok: false, status: 400, error: 'Therapeut nicht verfügbar' };
  if (data.id !== canonicalOwnerId && data.owner_id !== canonicalOwnerId) return { ok: false, status: 400, error: 'Ungültiger Therapeut' };
  return { ok: true, profile: data };
}

export async function validateService(supabase, serviceId, expectedOwnerId = null) {
  if (!serviceId) return { ok: false, status: 400, error: 'Service not found' };
  const { data, error } = await supabase.from('services').select('*').eq('id', serviceId).maybeSingle();
  if (error) return { ok: false, status: 500, error: 'Interner Serverfehler' };
  if (!data || data.is_internal === true) return { ok: false, status: 400, error: 'Service nicht verfügbar' };
  const canonicalOwnerId = getCanonicalOwnerId(data);
  if (!canonicalOwnerId || (expectedOwnerId && canonicalOwnerId !== expectedOwnerId)) {
    return { ok: false, status: 400, error: 'Service not found' };
  }
  return { ok: true, service: data, canonicalOwnerId };
}

export async function validateLead(supabase, leadId, canonicalOwnerId) {
  if (!leadId) return { ok: true };
  const { data, error } = await supabase.from('leads').select('id, owner_id').eq('id', leadId).maybeSingle();
  if (error) return { ok: false, status: 500, error: 'Interner Serverfehler' };
  if (!data || data.owner_id !== canonicalOwnerId) return { ok: false, status: 400, error: 'Ungültiger Lead' };
  return { ok: true, lead: data };
}

export async function validatePatient(supabase, patientId, canonicalOwnerId) {
  if (!patientId) return { ok: true };
  const { data, error } = await supabase.from('patients').select('id, owner_id').eq('id', patientId).maybeSingle();
  if (error) return { ok: false, status: 500, error: 'Interner Serverfehler' };
  if (!data || data.owner_id !== canonicalOwnerId) return { ok: false, status: 400, error: 'Ungültiger Patient' };
  return { ok: true, patient: data };
}
