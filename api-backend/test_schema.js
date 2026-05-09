import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://njvuclullotbksskpwgk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-key' // wait, I don't have the key locally!
);

supabase.from('profiles').select('*').limit(2).then(({data, error}) => {
  console.log('Error:', error);
  console.log('Data:', data);
});
