import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('services').select('id, title, code').eq('owner_id', 'b754a526-70ef-4987-adcf-dd8f800cbce9').then(r => console.log(r.data));
