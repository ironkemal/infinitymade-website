# `onprem/volumes/` — Konfigurationsdateien der Kundenbox

Hier liegen die Dateien, die die Container beim Start **einlesen**. Keine
Nutzdaten. Die Nutzdaten (`volumes/db/data`, `volumes/storage`) entstehen erst
auf dem Kundenserver und stehen in `.gitignore`.

## Herkunft — das meiste ist nicht von uns

| Datei | Woher | Von uns geaendert? |
|---|---|---|
| `api/kong.yml` | upstream, **erzeugt** durch `python tools/kong-trim.py` | ja — Bloecke weggelassen, nie umgeschrieben |
| `api/kong-entrypoint.sh` | upstream, unveraendert kopiert | nein |
| `db/realtime.sql` | upstream, unveraendert kopiert | nein |
| `db/roles.sql` | upstream, unveraendert kopiert | nein |
| `db/jwt.sql` | upstream, unveraendert kopiert | nein |
| `db/_supabase.sql` | upstream, unveraendert kopiert | nein |
| `db/webhooks.sql` | upstream, unveraendert kopiert | nein |

Quelle ist immer die Vendorkopie unter `onprem/supabase-docker/volumes/`.
Stand: **11.09.2026**.

## Was upstream liefert und hier fehlt

- **`db/pooler.sql`**, **`db/logs.sql`** — supavisor und Analytics laufen in
  der Box nicht.
- **`pooler/`**, **`proxy/`**, **`snippets/`**, **`functions/`** — gehoeren zu
  Containern, die wir nicht mitliefern.

## `webhooks.sql` — warum es trotz `pg_net` drin bleibt

Die Datei installiert `pg_net` und `supabase_functions.http_request()`, also
genau die Faehigkeit, dass die Datenbank selbst ins Internet telefoniert. Wir
benutzen sie nirgends (`net.http_post` kommt in null Funktionen vor). Ohne sie
waere Leitplanke **G1** baulich gesichert statt nur eingehalten.

Der Versuch, sie einfach wegzulassen, hat am 11.09.2026 den ganzen Stack
zerlegt — und zwar an einer Stelle, die nichts damit zu tun zu haben schien:

1. `webhooks.sql` legt in Zeile 113 die Rolle `supabase_functions_admin` an.
2. Die naechste Init-Datei, `99-roles.sql` (upstream), setzt in Zeile 7 deren
   Passwort.
3. Fehlt die Rolle, bricht `psql` dort ab. Die restlichen `ALTER USER`-Zeilen
   laufen nie — darunter die fuer `supabase_storage_admin`.
4. Storage kommt mit „password authentication failed" gar nicht mehr hoch.

Sauber loesen laesst sich das nur mit einem **eigenen** Ersatz, der die Rolle
anlegt und `pg_net` weglaesst. Das ist eine eigene, testbare Aufgabe und steht
als Register-Eintrag; nebenbei erledigt wird sie nicht.

## Abgleich

`tools/check-onprem-volumes.sh` vergleicht die kopierten Dateien mit der
Vendorkopie. Hat upstream etwas geaendert, meldet das Skript es — genau das
ist die Luecke, die Register **O-45** beschreibt: wir merken sonst nicht,
wenn sich an den elf Fremdteilen etwas bewegt.
