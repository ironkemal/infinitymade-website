// RELEASE-STANDARD.md §5.4 — Kontrollen 5 (RLS-Negativtest) und 8 (DEK-Rundlauf).
// Faz 2.2 dilim 2b (onprem-Konsultation, 12.09.2026).
//
// Werden vom setup-Router aufgerufen, wenn /verify mit { pruefungen: true } kommt —
// bewusst NICHT bei jedem /status-Aufruf (der ist jetongeschuetzt-frei, siehe
// router.js), und bewusst NICHT als eigener Endpunkt (Dilim-2-Sperre: "spaetere
// Dilime fuegen Feldern hinzu, oeffnen keinen neuen Endpunkt").
//
// Ergebnisse werden NIE in der Antwort an anonyme Aufrufer sichtbar (der Router
// prueft das Jeton vorher) und landen dauerhaft in praxura_setup.schritte — nicht
// hier persistiert, das macht der Router (ein Schreibpfad, eine Stelle).

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { rundlaufTest, keyFingerprint } from '../lib/phi-encrypt.js';

/**
 * Kontrolle 8 — echter Verschluesselungs-Rundlauf, kein blosses "Variable gesetzt".
 * Kein DB-/Netzwerkzugriff, daher synchron-schnell.
 */
export function verschluesselungsTest() {
  const r = rundlaufTest();
  if (!r.ok) return { status: r.fehler === 'DATA_ENCRYPTION_KEY nicht gesetzt' ? 'atlandi' : 'kirmizi', neden: r.fehler };
  return { status: 'ok', fingerprint: keyFingerprint() };
}

/**
 * Kontrolle 5 — RLS-Negativtest MIT echtem JWT ueber PostgREST (Kong), nicht mit
 * dem service_role-Schluessel (der wuerde RLS umgehen und immer "gruen" melden).
 *
 * Zwei Haelften, beide muessen stimmen (sonst kann ein kaputtes Query durch eine
 * leere Tabelle "gruen" erscheinen):
 *   (a) die eigene profiles-Zeile des Testnutzers ist sichtbar
 *   (b) die des Owners ist es NICHT
 *
 * Test-Konto: feste .invalid-Domain (nie zustellbar), Zufallspasswort, wird am
 * Ende IMMER geloescht (ON DELETE CASCADE raeumt die profiles-Zeile mit auf).
 * Schlaegt das Loeschen fehl, ist das Ergebnis rot mit klarem Hinweis — ein
 * vergessenes Testkonto ist kein stiller Nebeneffekt.
 *
 * @param {object} opt
 * @param {import('@supabase/supabase-js').SupabaseClient} opt.adminClient  service_role
 * @param {string} opt.supabaseUrl   internes SUPABASE_URL (zeigt auf Kong im Docker-Netz)
 * @param {string} [opt.anonKey]     SUPABASE_ANON_KEY — fehlt sie, wird "atlandi" gemeldet
 * @param {string} [opt.ownerUserId] praxura_setup.owner_user_id
 */
export async function rlsNegativTest({ adminClient, supabaseUrl, anonKey, ownerUserId }) {
  if (!anonKey) return { status: 'atlandi', neden: 'SUPABASE_ANON_KEY nicht gesetzt' };

  const testEmail = `praxura-rls-selbstcheck-${Date.now()}@setup.invalid`;
  const testPassword = crypto.randomBytes(24).toString('hex');
  let testUserId = null;
  let ergebnis;

  try {
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (createErr) {
      ergebnis = { status: 'kirmizi', neden: `Testkonto konnte nicht angelegt werden: ${createErr.message}` };
    } else {
      testUserId = created.user.id;

      const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
      const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      if (signInErr || !signIn?.session) {
        ergebnis = { status: 'kirmizi', neden: `Testanmeldung fehlgeschlagen: ${signInErr?.message || 'keine Sitzung'}` };
      } else {
        const asTestUser = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false },
          global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
        });
        const { data: rows, error: queryErr } = await asTestUser.from('profiles').select('id');
        if (queryErr) {
          ergebnis = { status: 'kirmizi', neden: `Abfrage fehlgeschlagen: ${queryErr.message}` };
        } else {
          const sichtbareIds = (rows || []).map((r) => r.id);
          const eigeneSichtbar = sichtbareIds.includes(testUserId);
          const ownerUnsichtbar = !ownerUserId || !sichtbareIds.includes(ownerUserId);
          ergebnis = (eigeneSichtbar && ownerUnsichtbar)
            ? { status: 'ok' }
            : { status: 'kirmizi', neden: `RLS-Erwartung verletzt: eigene Zeile sichtbar=${eigeneSichtbar}, Owner-Zeile unsichtbar=${ownerUnsichtbar}` };
        }
      }
    }
  } catch (err) {
    ergebnis = { status: 'kirmizi', neden: err.message };
  }

  if (testUserId) {
    const { error: delErr } = await adminClient.auth.admin.deleteUser(testUserId);
    if (delErr) {
      // Ein liegen gebliebenes Testkonto ist kein Detail, sondern ein Datensatz
      // mehr in auth.users, der von Hand entfernt werden muss — ueberschreibt
      // ein sonst gruenes Ergebnis bewusst.
      return { status: 'kirmizi', neden: `Testkonto (${testEmail}) angelegt, aber Loeschen fehlgeschlagen: ${delErr.message}. Bitte manuell in auth.users entfernen.` };
    }
  }
  return ergebnis;
}
