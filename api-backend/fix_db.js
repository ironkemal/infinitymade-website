import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

supabase.from('profiles').update({ company_code: 'INF-SIIDO' }).eq('email', 'ironkemal30@gmail.com').then(({error}) => {
  console.log('Update Error:', error);
  console.log('Successfully set company code to INF-SIIDO');
});
