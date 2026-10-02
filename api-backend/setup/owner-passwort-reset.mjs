// owner-passwort-reset.mjs — KHS K2.4, onprem/REGISTER.md O-107 (02.10.2026).
//
// Die Box verschickt keine Mails (O-142, Entscheidung 01.10.2026) — der
// Praxisinhaber kann sein Passwort also nicht per "Passwort vergessen"
// zuruecksetzen. Dieser Weg ersetzt das: aufgerufen NUR vom Host-Skript
// onprem/reset-owner-passwort.sh (root auf dem Server = physischer Zugang),
// bewusst KEIN HTTP-Endpunkt — ein Endpunkt waere aus dem Praxisnetz
// erreichbar, dieses Skript nur von jemandem, der schon auf dem Server ist.
//
// Ziel ist ausschliesslich der Owner aus praxura_setup.owner_user_id (vom
// Einrichtungsassistenten geschrieben) — keine E-Mail-Abfrage, damit das hier
// kein "beliebiges Konto zuruecksetzen"-Werkzeug wird. Mitarbeiter bekommen
// einen neuen Einrichtungscode vom Inhaber (Mitarbeiter-Zugang).
//
// Das neue Passwort kommt ueber STDIN (eine Zeile), nie ueber argv/env —
// argv ist fuer jeden Prozess auf dem Host in `ps` sichtbar.
//
// Kullanım: printf '%s\n' "$pw" | docker compose exec -T api node setup/owner-passwort-reset.mjs
// Exit: 0 ok · 2 kein Owner · 3 Konto geloescht · 4 Passwort ungueltig · 1 sonstiger Fehler
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function stdinZeile() {
  let roh = '';
  for await (const teil of process.stdin) roh += teil;
  return roh.split(/\r?\n/)[0];
}

function ende(code, meldung) {
  (code === 0 ? console.log : console.error)(meldung);
  process.exit(code);
}

const passwort = await stdinZeile();
if (!passwort || passwort.length < 8) ende(4, 'Passwort zu kurz (mindestens 8 Zeichen).');

const { data: setup, error: setupErr } = await supabase
  .from('praxura_setup').select('owner_user_id').eq('id', 1).maybeSingle();
if (setupErr) ende(1, `Datenbank nicht erreichbar: ${setupErr.message}`);
const ownerId = setup?.owner_user_id;
if (!ownerId) ende(2, 'Es wurde noch kein Inhaber angelegt — zuerst den Einrichtungsassistenten im Browser abschliessen.');

const { data: profil } = await supabase
  .from('profiles').select('email, plan_status').eq('id', ownerId).maybeSingle();
if (profil?.plan_status === 'deleted') ende(3, 'Das Inhaberkonto wurde geloescht (DSGVO) — kein Zuruecksetzen moeglich.');

const { error: pwErr } = await supabase.auth.admin.updateUserById(ownerId, { password: passwort });
if (pwErr) ende(1, `Passwort konnte nicht gesetzt werden: ${pwErr.message}`);

// Alle offenen Sitzungen beenden — wer das alte Passwort kannte und noch
// angemeldet ist, fliegt raus (gleiche RPC wie Mitarbeiter-Zugang, O-144 a).
const { data: beendet, error: rpcErr } = await supabase.rpc('auth_sitzungen_beenden', { p_user: ownerId });
const sitzungen = rpcErr ? 'nicht beendet (' + rpcErr.message + ')' : `${beendet ?? 0} beendet`;

ende(0, `ok · Konto: ${profil?.email || ownerId} · offene Sitzungen: ${sitzungen}`);
