/**
 * podologie-positionen.js — der Preiskatalog der Podologie im Browser.
 *
 * Warum es das gibt (02.09.2026)
 * ──────────────────────────────
 * Für die Summe auf der Verordnung (Beta-1, 31.08.2026: „dass er die Summe
 * schon automatisch ausrechnet") braucht die Oberfläche zu jedem HPNR-Code
 * zwei Zahlen: den Bruttopreis und die Zuzahlung je Position.
 *
 * Es gab dafür bereits ZWEI Quellen, und eine davon ist eine Falle:
 *
 *   1. `GKV_LEISTUNGSKATALOG.podologie` in `dashboard.js` — führt `price`,
 *      aber KEIN `zuzahlung`. Wer damit rechnet, bekommt still `null` und
 *      landet in der 10-%-Ersatzrechnung; zuzahlungsfreie Positionen (78220,
 *      78530) würden dem Patienten mit Zuzahlung angezeigt, obwohl die
 *      gedruckte Rechnung 0 € ausweist. Genau dieser Fehler ist auf der
 *      Physio-Seite schon einmal passiert (siehe Kommentar bei
 *      `GET /billing/positions` in `abrechnung.routes.js`).
 *   2. `GET /billing/positions/podologie` — speist sich aus
 *      `api-backend/billing/codes/podologie_positions.js`, also aus DERSELBEN
 *      Datei, aus der die DTA-Erzeugung ihre Beträge nimmt, und liefert
 *      `preis` UND `zuzahlung`. Die Route existierte seit Sprint 7-1, wurde
 *      aber von keiner Zeile im Frontend aufgerufen.
 *
 * Diese Datei nimmt (2). Damit steht auf dem Bildschirm derselbe Betrag, der
 * später in der Kassendatei landet — und nicht ein zweiter, der ihm ähnelt.
 *
 * Preise sind datumsabhängig
 * ──────────────────────────
 * Der Katalog gilt je Zeitraum (`gueltig_ab` / `gueltig_bis`, Preisrunde zum
 * 01.07.). Eine Behandlung vom Juni ist deshalb mit dem Juni-Preis zu bewerten,
 * nicht mit dem von heute — sonst weicht die angezeigte Summe von der
 * Abrechnung ab, sobald eine Verordnung über den Stichtag läuft. Die Route
 * filtert selbst nach `?date=`, also wird JE BEHANDLUNGSDATUM geladen und das
 * Ergebnis für die Sitzung behalten; eine Verordnung berührt in der Praxis
 * einen, selten zwei Zeiträume.
 */

const API = 'https://n8n.infinitymade.de/api';

/** date (YYYY-MM-DD) → Promise<Map<code, position>>. Lebt bis zum Neuladen der Seite. */
const _katalog = new Map();

function _heute() {
  // Lokales Datum, nicht `toISOString()`: das rechnet nach UTC und ergibt in
  // Berlin um Mitternacht den Vortag (Projektstandard, siehe CLAUDE.md).
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function _tag(datum) {
  if (!datum) return _heute();
  const s = String(datum).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : _heute();
}

/**
 * Positionen laden, die an einem Tag gültig sind.
 *
 * @param {object} supabase  Client — nur für das Zugriffstoken.
 * @param {string} [datum]   YYYY-MM-DD, Vorgabe heute.
 * @returns {Promise<Map<string, object>>} HPNR-Code → { preis, zuzahlung, label … }
 */
export function ladePodoPositionen(supabase, datum) {
  const tag = _tag(datum);
  if (_katalog.has(tag)) return _katalog.get(tag);

  const p = (async () => {
    // Zeitgrenze für den fetch: ein Server, der die Verbindung offen hält, ohne
    // je zu antworten, liesse dieses Promise sonst nie settlen — die
    // Verordnungsansicht (module/verordnung-detail.js) hängt dann auf
    // unbestimmte Zeit bei „Lade…", ohne dass ihr eigenes try/catch je greift
    // (ein nicht settelndes Promise wirft nichts, es wartet nur). Gefunden
    // 04.09.2026: Beta-1 konnte keine podologische Verordnung mehr öffnen.
    const abbruch = new AbortController();
    const uhr = setTimeout(() => abbruch.abort(), 8000);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/billing/positions/podologie?date=${encodeURIComponent(tag)}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        signal: abbruch.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const map = new Map();
      for (const pos of (json.positions || [])) {
        map.set(String(pos.hpnr), {
          code:      String(pos.hpnr),
          label:     pos.label || '',
          preis:     Number(pos.preis) || 0,
          // NICHT `|| null`: 0 wäre ein gültiger Betrag, und `null` heisst hier
          // „zuzahlungsfrei" — die beiden dürfen nicht ineinanderlaufen.
          zuzahlung: pos.zuzahlung == null ? null : Number(pos.zuzahlung),
        });
      }
      return map;
    } catch (e) {
      console.warn('[podologie-positionen]', e.name === 'AbortError' ? 'Zeitüberschreitung (8s)' : e.message);
      // Leere Karte statt Ausnahme: die Verordnungsansicht soll auch ohne
      // Preise stehen. Die Summe meldet dann „Position unbekannt" — das ist
      // ehrlicher als eine Seite, die gar nicht erst erscheint.
      _katalog.delete(tag);   // beim nächsten Aufruf erneut versuchen
      return new Map();
    } finally {
      clearTimeout(uhr);
    }
  })();

  _katalog.set(tag, p);
  return p;
}

/**
 * Katalog für alle Behandlungstage einer Verordnung, als eine Nachschlagefunktion.
 *
 * @param {object} supabase
 * @param {Array<{behandlungsdatum?:string}>} behandlungen
 * @returns {Promise<(code:string, datum:string) => object|null>}
 *          Die Rückgabe passt auf `zuzahlungFuerPodoVerordnung(…, findePosition)`.
 */
export async function podoPositionsFinder(supabase, behandlungen) {
  const tage = [...new Set((behandlungen || []).map(b => _tag(b?.behandlungsdatum)))];
  if (!tage.length) tage.push(_heute());

  const karten = new Map();
  await Promise.all(tage.map(async t => karten.set(t, await ladePodoPositionen(supabase, t))));

  return (code, datum) => karten.get(_tag(datum))?.get(String(code)) || null;
}
