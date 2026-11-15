-- Gleiche Abfragen wie api-backend/db/schema-zaehler.js SORGULAR (+ storage_policy, rls_aus zur Info)
SELECT json_build_object(
 'public_tablo',(SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),
 'rls_policy',(SELECT count(*)::int FROM pg_policies WHERE schemaname='public'),
 'fonksiyon',(SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')),
 'trigger',(SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal),
 'index',(SELECT count(*)::int FROM pg_indexes WHERE schemaname='public'),
 'auth_trigger',(SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth' AND NOT t.tgisinternal),
 'storage_bucket',(SELECT count(*)::int FROM storage.buckets),
 'publication_uye_tablo',(SELECT count(*)::int FROM pg_publication_tables),
 'extension',(SELECT count(*)::int FROM pg_extension),
 'anon_profiles_kolon',(SELECT count(*)::int FROM pg_attribute a WHERE a.attrelid='public.profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege('anon',a.attrelid,a.attnum,'SELECT')),
 'anon_businesses_kolon',(SELECT count(*)::int FROM pg_attribute a WHERE a.attrelid='public.businesses'::regclass AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege('anon',a.attrelid,a.attnum,'SELECT')),
 'storage_policy',(SELECT count(*)::int FROM pg_policies WHERE schemaname='storage'),
 'rls_aus',(SELECT json_agg(c.relname ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity)
) AS zaehler;
