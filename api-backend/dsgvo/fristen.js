// Löschfristen ohne Konto-Löschung (onprem O-182 + O-146, 09.10.2026).
//
// Warum: legal-de 09.10.2026 — nicht angenommene Terminanfragen dürfen nicht unbegrenzt liegen
// bleiben („gelöscht, sobald nicht mehr erforderlich"); data_access_log rotiert nach 12 Monaten
// (O-146). Die Fristen stehen NUR in dsgvo/klassifikation.js (Feld `loeschfrist`) — hier wird
// nichts festgelegt, nur ausgeführt.
//
// Abgrenzung: dsgvo/loeschen.js löscht ein ganzes Konto auf Antrag (Art. 17) mit Sperrbestand-
// Regeln. Dieses Modul löscht einzelne abgelaufene Zeilen, mandantenübergreifend, täglich.
// Idempotent (abgelaufene Zeilen sind beim zweiten Lauf weg) → kein Lock nötig.
// Box und SaaS gleich (G7); läuft lokal gegen Postgres, kein Außenaufruf.

import { TABELLEN } from './klassifikation.js';

const BATCH = 500;

/** Stichtag: jetzt minus `monate` Kalendermonate (ISO). Rein. */
export function grenzeIso(monate, jetzt = Date.now()) {
  const d = new Date(jetzt);
  d.setUTCMonth(d.getUTCMonth() - monate);
  return d.toISOString();
}

/** Einträge mit Löschfrist, in TABELLEN-Reihenfolge (Abhängige zuerst). */
export function fristEintraege(tabellen = TABELLEN) {
  return tabellen.filter((t) => t.loeschfrist);
}

async function loescheEintrag(supabase, eintrag, grenze) {
  const f = eintrag.loeschfrist;
  const feld = f.feld || 'created_at';

  if (f.nurOhneVerweis) {
    // Nur Zeilen löschen, auf die nichts mehr zeigt (z. B. patients ← booking_requests.patient_id).
    let summe = 0;
    for (let runde = 0; runde < 20; runde++) {
      const { data: kandidaten, error: kErr } = await supabase.from(eintrag.table)
        .select('id').lt(feld, grenze).order('id').range(runde * BATCH, runde * BATCH + BATCH - 1);
      if (kErr) throw new Error(`${eintrag.table}: ${kErr.message}`);
      if (!kandidaten?.length) break;
      const ids = kandidaten.map((k) => k.id);
      const { table: refTab, spalte } = f.nurOhneVerweis;
      const { data: refs, error: rErr } = await supabase.from(refTab).select(spalte).in(spalte, ids);
      if (rErr) throw new Error(`${refTab}: ${rErr.message}`);
      const belegt = new Set((refs || []).map((r) => r[spalte]));
      const frei = ids.filter((id) => !belegt.has(id));
      if (frei.length) {
        const { error: dErr, count } = await supabase.from(eintrag.table).delete({ count: 'exact' }).in('id', frei);
        if (dErr) throw new Error(`${eintrag.table}: ${dErr.message}`);
        summe += count ?? frei.length;
      }
      if (kandidaten.length < BATCH) break;
    }
    return summe;
  }

  let q = supabase.from(eintrag.table).delete({ count: 'exact' }).lt(feld, grenze);
  if (Array.isArray(f.status) && f.status.length) q = q.in('status', f.status);
  const { error, count } = await q;
  if (error) throw new Error(`${eintrag.table}: ${error.message}`);
  return count ?? 0;
}

/**
 * Ein Lauf über alle Fristen. Ein Fehler in einer Tabelle stoppt die anderen nicht.
 * @returns {Promise<Array<{table:string, geloescht?:number, fehler?:string}>>}
 */
export async function fristenSchritt(supabase, { tabellen = TABELLEN, jetzt = Date.now() } = {}) {
  const ergebnis = [];
  for (const e of fristEintraege(tabellen)) {
    try {
      ergebnis.push({ table: e.table, geloescht: await loescheEintrag(supabase, e, grenzeIso(e.loeschfrist.monate, jetzt)) });
    } catch (err) {
      ergebnis.push({ table: e.table, fehler: err?.message || String(err) });
    }
  }
  return ergebnis;
}

/**
 * Startet den täglichen Lauf (Muster: merkez-istemci/ip-abgleich.js). Einmal je Berliner Tag,
 * erster Versuch 45 s nach dem Start (holt nach, wenn die Box nachts aus war).
 */
export function starteFristen({
  supabase,
  env = process.env,
  jetzt = Date.now,
  timer = { setTimeout, setInterval },
  log = console,
  tz = 'Europe/Berlin',
} = {}) {
  if (!supabase) return null;
  if (env.NODE_APP_INSTANCE !== undefined && env.NODE_APP_INSTANCE !== null && String(env.NODE_APP_INSTANCE) !== '0') return null;

  let erledigtFuer = null;
  let laeuft = false;
  const tick = async () => {
    if (laeuft) return;
    const heute = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(jetzt()));
    if (erledigtFuer === heute) return;
    laeuft = true;
    try {
      const r = await fristenSchritt(supabase, { jetzt: jetzt() });
      const fehler = r.filter((x) => x.fehler);
      for (const x of r) log.log(`[fristen] ${x.table}: ${x.fehler ? 'FEHLER ' + x.fehler : `${x.geloescht} gelöscht`}`);
      if (!fehler.length) erledigtFuer = heute; // bei Fehler: nächste Minute erneut
    } catch (err) {
      try { (log.warn || log.log)(`[fristen] Unerwarteter Fehler: ${err?.message || err}`); } catch {}
    } finally {
      laeuft = false;
    }
  };

  const t1 = timer.setTimeout(tick, 45_000);
  const t2 = timer.setInterval(tick, 60_000);
  for (const t of [t1, t2]) if (t && typeof t.unref === 'function') { try { t.unref(); } catch {} }
  return { tick, stop() { (timer.clearTimeout || clearTimeout)(t1); (timer.clearInterval || clearInterval)(t2); } };
}
