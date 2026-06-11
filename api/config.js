export default function handler(req, res) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase config not set in environment' });
  }

  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.json({ supabaseUrl, supabaseAnonKey });
}
