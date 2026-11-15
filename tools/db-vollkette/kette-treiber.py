import sys, hashlib, pathlib
mdir = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2]); split = sys.argv[3]
import os
stop=os.environ.get('STOP_AT','9999')
files = sorted(p for p in mdir.glob('*.sql') if p.name[:4] <= stop)
L = ['\\set ON_ERROR_STOP on', 'SET client_min_messages = warning;',
 "CREATE TABLE IF NOT EXISTS public.praxura_migrations (version text PRIMARY KEY, name text NOT NULL, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), duration_ms integer, app_version text);",
 'ALTER TABLE public.praxura_migrations ENABLE ROW LEVEL SECURITY;',
 'REVOKE ALL ON public.praxura_migrations FROM anon, authenticated;']
for f in files:
    v = f.name[:4]
    if v == split:
        L.append("\\echo ZAEHLER_VOR_" + split); L.append('\\ir zaehler.sql')
    sha = hashlib.sha256(f.read_bytes()).hexdigest()
    L += ['BEGIN;', f"\\echo APPLY {f.name}", f"\\i /probe/api-backend/db/migrations/{f.name}", 
          f"INSERT INTO public.praxura_migrations(version,name,checksum,app_version) VALUES ('{v}','{f.name}','{sha}','proof-A');", 'COMMIT;']
L.append("\\echo ZAEHLER_NACH"); L.append('\\ir zaehler.sql')
out.write_text('\n'.join(L) + '\n')
