# -*- coding: utf-8 -*-
"""Erzeugt onprem/volumes/api/kong.yml aus der Upstream-Vorlage.

Aufruf aus dem Repo-Wurzelverzeichnis:  python tools/kong-trim.py

Warum ein Erzeuger statt einer Handkopie: die Upstream-Datei enthaelt Lua-
Ausdruecke und Kong-Plugin-Konfiguration, die niemand von Hand nachpflegen
sollte. Hier werden nur ganze Bloecke WEGGELASSEN, nie welche umgeschrieben.
"""
import io, re

SRC = r'onprem/supabase-docker/volumes/api/kong.yml'
DST = r'onprem/volumes/api/kong.yml'

s = io.open(SRC, encoding='utf-8', newline='').read().replace('\r\n', '\n')

head, _, body = s.partition('services:\n')
assert body, 'services: nicht gefunden'

blocks, cur = [], []
for line in body.split('\n'):
    hat_namen = any(l.startswith('  - name: ') for l in cur)
    if hat_namen and (line.startswith('  - name: ') or line.startswith('  ##')):
        blocks.append('\n'.join(cur)); cur = []
    cur.append(line)
blocks.append('\n'.join(cur))

RAUS = {'graphql-v1', 'functions-v1', 'meta', 'mcp-blocker', 'mcp', 'dashboard'}
behalten, entfernt = [], []
for b in blocks:
    m = re.search(r'^  - name: (\S+)', b, re.M)
    nm = m.group(1) if m else None
    if nm in RAUS:
        entfernt.append(nm)
    else:
        behalten.append(b)

rest = 'services:\n' + '\n'.join(behalten)
rest = re.sub(r'\n  ## Analytics routes\n(?:  #.*\n|  ##.*\n)+', '\n', rest)

head = head.replace('consumers:\n  - username: DASHBOARD\n', 'consumers:\n')
head = re.sub(r'###\n### Dashboard credentials\n###\nbasicauth_credentials:\n(?:  .*\n)+\n?', '', head)

KOPF = u"""# \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
#  Praxura On-Premise \u2014 Kong-Konfiguration
# \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
#  ERZEUGT, nicht von Hand geschrieben:  python tools/kong-trim.py
#  Quelle: onprem/supabase-docker/volumes/api/kong.yml (Upstream-Vendorkopie)
#  Stand:  11.09.2026
#
#  Gegenueber upstream entfernt \u2014 weil die Ziele nicht in der Box laufen:
#    graphql-v1    /graphql/v1   \u2192 im Produkt nirgends aufgerufen (geprueft)
#    functions-v1  /functions/v1 \u2192 keine Deno-Laufzeit in der Box (O-11)
#    meta          /pg/          \u2192 postgres-meta faellt mit studio weg
#    mcp, mcp-blocker            \u2192 studio-Endpunkte
#    DASHBOARD-Consumer + basicauth_credentials \u2192 studio faellt weg
#
#  Alles andere ist Wort fuer Wort upstream. Insbesondere key-auth und acl
#  bleiben unangetastet \u2014 das ist die apikey-Pruefung vor PostgREST.
#
#  Aendert sich die Upstream-Datei, meldet das tools/check-onprem-volumes.sh.
# \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

"""

out = KOPF + head + rest
out = re.sub(r'\n{3,}', '\n\n', out).rstrip('\n') + '\n'
io.open(DST, 'w', encoding='utf-8', newline='\n').write(out)
print('entfernt:', ', '.join(entfernt))
print('geschrieben:', DST, len(out.split('\n')), 'Zeilen')
