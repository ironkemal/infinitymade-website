-- ==============================================
-- INFINITY V20 — Tenant-scoped profile visibility
-- 2026-05-19
-- ==============================================
-- Fixes Team page showing only self for owners with employees.
--
-- Before: profiles RLS only allowed reading own row (id = auth.uid()).
--   → Owners could not read employee rows directly via Supabase client.
--   → Frontend fell back to a VPS /api/team endpoint (service_role bypass).
--   → If VPS was unreachable, the page silently showed "self only".
--
-- After: a single tenant-scoped SELECT policy lets each member of a tenant
-- (owner + their employees) read every other member of the same tenant.
-- The frontend now queries Supabase directly; VPS endpoint stays as
-- backwards-compat fallback for any RLS edge case.

CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p.owner_id, p.id)
  FROM profiles p
  WHERE p.id = auth.uid();
$$;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles tenant read" ON profiles;

CREATE POLICY "Profiles tenant read" ON profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR owner_id = auth.uid()
    OR id = auth_tenant_id()
    OR owner_id = auth_tenant_id()
  );
