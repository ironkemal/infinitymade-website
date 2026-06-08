/**
 * Praxura - Unified Supabase Client Library
 * ==============================================
 * Single source of truth for Supabase connections.
 * 
 * Usage:
 *   import { supabase, TABLES } from './lib/supabase.js';
 * 
 * For API routes (server-side), use environment variables:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

// ============================================================================
// CONFIGURATION - Single Source of Truth
// ============================================================================

// Detect environment
const isBrowser = typeof window !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions?.node;

// Supabase configuration
const SUPABASE_URL = 
  (isNode ? process.env.SUPABASE_URL : null) ||
  (isNode ? process.env.NEXT_PUBLIC_SUPABASE_URL : null) ||
  'https://njvuclullotbksskpwgk.supabase.co';

const SUPABASE_ANON_KEY = 
  (isNode ? process.env.SUPABASE_ANON_KEY : null) ||
  (isNode ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : null) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdnVjbHVsbG90Ymtzc2twd2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTgyNDEsImV4cCI6MjA5MjM3NDI0MX0.KLABvM3skC9TMM1N2NTEKjWHLA9aUY0pfS-EbzLfLug';

const SUPABASE_SERVICE_ROLE_KEY = 
  isNode ? process.env.SUPABASE_SERVICE_ROLE_KEY : null;

// ============================================================================
// CLIENT CREATION
// ============================================================================

let _supabase = null;
let _supabaseAdmin = null;

/**
 * Create Supabase client for browser use
 * Uses esm.sh for dynamic import
 */
async function createBrowserClient() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Create Supabase client for server-side use
 */
function createServerClient(isAdmin = false) {
  // Use dynamic import for Node ESM
  const { createClient } = require('@supabase/supabase-js');
  const key = isAdmin ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  if (!key) {
    console.warn(`[supabase] ${isAdmin ? 'Admin' : 'Anon'} key not available`);
    return null;
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: isAdmin ? false : undefined }
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

// For browser (frontend) use - these are async factories
export const getSupabase = async () => {
  if (!_supabase) {
    _supabase = await createBrowserClient();
  }
  return _supabase;
};

// For server-side (API routes) use
export const getSupabaseAdmin = () => {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createServerClient(true);
  }
  return _supabaseAdmin;
};

// Synchronous singleton for browser (requires async initialization)
let _syncSupabase = null;
export const supabase = {
  from: (table) => {
    if (_syncSupabase) return _syncSupabase.from(table);
    // Fallback: return a proxy that queues operations
    console.warn('[supabase] Client not initialized. Use getSupabase() for async access.');
    return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
      insert: () => ({ select: () => Promise.resolve({ data: null }) }),
      update: () => ({ eq: () => Promise.resolve({ data: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ data: null }) })
    };
  },
  auth: {
    getSession: () => _syncSupabase?.auth.getSession() || Promise.resolve({ data: { session: null } }),
    getUser: () => _syncSupabase?.auth.getUser() || Promise.resolve({ data: { user: null } }),
    signInWithPassword: (creds) => _syncSupabase?.auth.signInWithPassword(creds) || Promise.resolve({ error: { message: 'Not initialized' } }),
    signUp: (creds) => _syncSupabase?.auth.signUp(creds) || Promise.resolve({ error: { message: 'Not initialized' } }),
    signOut: () => _syncSupabase?.auth.signOut() || Promise.resolve(),
    updateUser: (data) => _syncSupabase?.auth.updateUser(data) || Promise.resolve({ error: { message: 'Not initialized' } }),
    setSession: (session) => _syncSupabase?.auth.setSession(session) || Promise.resolve({ error: { message: 'Not initialized' } }),
  },
  storage: {
    from: (bucket) => _syncSupabase?.storage.from(bucket) || {
      upload: () => Promise.resolve({ error: { message: 'Not initialized' } }),
      getPublicUrl: () => ({ data: { publicUrl: null } })
    }
  },
  channel: (name) => _syncSupabase?.channel(name) || { on: () => ({ subscribe: () => {} }) },
  rpc: (fn, args) => _syncSupabase?.rpc(fn, args) || Promise.resolve({ data: null, error: { message: 'Not initialized' } })
};

// Initialize sync client (call this in your app startup)
export async function initSupabase() {
  _syncSupabase = await createBrowserClient();
  return _syncSupabase;
}

// ============================================================================
// TABLE REFERENCE CONSTANTS
// ============================================================================

export const TABLES = {
  // Core user & business
  PROFILES: 'profiles',
  PROFILES_PUBLIC: 'profiles_public',
  BUSINESSES: 'businesses',
  USER_PREFERENCES: 'user_preferences',
  SERVICES: 'services',
  BUSINESS_SERVICES: 'business_services',
  BOOKINGS: 'bookings',
  WORKING_HOURS: 'working_hours',
  BREAKS: 'breaks',
  TIME_OFFS: 'time_offs',
  CUSTOM_DAYS: 'custom_days',

  // Employee management
  EMPLOYEE_SERVICES: 'employee_services',
  CALENDAR_INTEGRATIONS: 'calendar_integrations',

  // Customer relationships
  LEADS: 'leads',
  // wa_contacts, conversations, messages — DROPPED 2026-05-22 (WhatsApp shelved)
  
  // Medical/Health (Physiotherapy/Praxis)
  ANAMNESE: 'anamnese',
  PATIENT_NOTES: 'patient_notes',
  INVOICES: 'invoices',
  UEBERWEISUNGEN: 'ueberweisungen',
  AERZTE: 'aerzte',
  KRANKENKASSEN: 'krankenkassen',
  
  // B2B
  B2B_CONTACTS: 'b2b_contacts',
  EMAIL_LOGS: 'email_logs',
  
  // Utilities
  SCRAPER_DATA: 'scraper_data',
  FEEDBACKS: 'feedbacks',
  USER_CREDITS: 'user_credits',
  APPLICATIONS: 'applications',
  PENDING_SIGNUPS: 'pending_signups',
};

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Get services for a business (owner or employee)
 */
export async function getServices(ownerId, userId = null) {
  const client = await getSupabase();
  if (userId) {
    return client.from(TABLES.SERVICES)
      .select('*,employee_services(employee_id)')
      .or(`owner_id.eq.${ownerId},user_id.eq.${userId}`);
  }
  return client.from(TABLES.SERVICES)
    .select('*,employee_services(employee_id)')
    .eq('owner_id', ownerId);
}

/**
 * Get working hours for an employee with owner fallback
 */
export async function getWorkingHours(userId, ownerId = null) {
  const client = await getSupabase();
  let query = client.from(TABLES.WORKING_HOURS)
    .select('*')
    .eq('user_id', userId);
  
  const { data, error } = await query;
  
  // Fallback to owner hours if employee has none
  if ((!data || data.length === 0) && ownerId) {
    return client.from(TABLES.WORKING_HOURS)
      .select('*')
      .eq('user_id', ownerId);
  }
  
  return { data, error };
}

/**
 * Get bookings for calendar view
 */
export async function getBookings(userId, startDate, endDate) {
  const client = await getSupabase();
  return client.from(TABLES.BOOKINGS)
    .select('*,services(title,color,code,duration_minutes)')
    .eq('user_id', userId)
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .neq('status', 'cancelled');
}

/**
 * Get leads with optional filtering
 */
export async function getLeads(ownerId, status = null) {
  const client = await getSupabase();
  let query = client.from(TABLES.LEADS)
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  
  if (status) {
    query = query.eq('status', status);
  }
  return query;
}

/**
 * Get patient details with related data
 */
export async function getPatientDetails(leadId, ownerId) {
  const client = await getSupabase();
  const [lead, anamnese, notes, invoices] = await Promise.all([
    client.from(TABLES.LEADS).select('*').eq('id', leadId).single(),
    client.from(TABLES.ANAMNESE).select('*').eq('patient_id', leadId).maybeSingle(),
    client.from(TABLES.PATIENT_NOTES).select('*').eq('lead_id', leadId).maybeSingle(),
    client.from(TABLES.INVOICES).select('*').eq('patient_id', leadId).order('created_at', { ascending: false })
  ]);
  
  return {
    lead: lead.data,
    anamnese: anamnese.data,
    notes: notes.data,
    invoices: invoices.data || []
  };
}

/**
 * Get the owner ID from any user ID (handles employee/owner hierarchy)
 */
export async function getOwnerId(userId) {
  const client = await getSupabase();
  const { data: profile } = await client
    .from(TABLES.PROFILES)
    .select('owner_id,role')
    .eq('id', userId)
    .single();

  if (!profile) return userId;
  return profile.role === 'employee' && profile.owner_id ? profile.owner_id : userId;
}

// ============================================================================
// EXPORT CONFIG FOR LEGACY COMPATIBILITY
// ============================================================================

export { SUPABASE_URL, SUPABASE_ANON_KEY };
export default supabase;