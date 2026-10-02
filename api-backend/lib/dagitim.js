// Box oder SaaS? EIN Signal: SUPABASE_PUBLIC_URL ist nur in der Box gesetzt (onprem, O-16/O-145).
export function istKutu() { return !!process.env.SUPABASE_PUBLIC_URL; }
