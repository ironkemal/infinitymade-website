// Welche Kasse gehört in welche §302-Datei?
//
// Eine DTA-Datei gilt genau einer Datenannahmestelle × Kassenart (Anlage 1 TP5
// V21, Kap. 5.3.1). Wer mehrere Kassen auf einmal abrechnet, erzeugt also
// mehrere Dateien und mehrere Umschläge — das muss VOR dem Klick sichtbar sein,
// nicht danach. Die Praxis muss jeden Begleitzettel dem richtigen Umschlag
// zuordnen können; eine Oberfläche, die „alles erledigt" suggeriert und im
// Hintergrund vier Dateien erzeugt, macht genau das unmöglich.
//
// Die Auflösung kommt aus dem Backend (POST /abrechnung/annahmestellen) und ist
// dieselbe, die der spätere Versand benutzt. Bewusst nicht im Frontend
// nachgebaut: zwei Antworten auf dieselbe Frage wären der nächste stille Fehler.

// Über ctx.apiBase statt fest verdrahtetem Host — onprem-Urteil O-01/O-44
// (08.09.2026): eine zweite Host-Konstante hätte die Onprem-Baseline über
// 26 gehoben und die spätere Faz-1.1-Ablösung nicht mehr an einer Stelle machbar.
const annahmestellenUrl = () => `${_ctx.apiBase}/billing/abrechnung/annahmestellen`;

let _ctx = null;
const _cache = new Map();   // ik -> { aufloesbar, davIk, davName, kassenart, dateieinheit, … }

export function initDateieinheit(ctx) { _ctx = ctx; }

/** Bekannt? (ohne Netzaufruf) */
export function dateieinheitVon(ik) { return _cache.get(ik) || null; }

/**
 * Lädt die Dateieinheit für alle noch unbekannten IKs nach.
 * Fehler werden NICHT geworfen: die Abrechnung muss auch dann bedienbar
 * bleiben, wenn diese Zusatzinformation fehlt — sie ist Orientierung, kein
 * Riegel. Der Riegel sitzt im Backend (412, wenn nicht auflösbar).
 * @returns {Promise<boolean>} true, wenn etwas Neues geladen wurde
 */
export async function ladeDateieinheiten(iks) {
  const offen = [...new Set(iks.filter(ik => ik && !_cache.has(ik)))];
  if (!offen.length) return false;
  try {
    const { data: { session } } = await _ctx.supabase.auth.getSession();
    const res = await fetch(annahmestellenUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ iks: offen }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    for (const [ik, info] of Object.entries(json.annahmestellen || {})) _cache.set(ik, info);
    return true;
  } catch {
    return false;   // siehe oben: Orientierung, kein Riegel
  }
}

/**
 * Gruppiert IKs nach Dateieinheit.
 * @returns {{ dateieinheiten: Map<string, string[]>, ungeklaert: string[], nichtAufloesbar: string[] }}
 */
export function gruppiereNachDatei(iks) {
  const dateieinheiten = new Map();
  const ungeklaert = [], nichtAufloesbar = [];
  for (const ik of iks) {
    const info = _cache.get(ik);
    if (!info)                 { ungeklaert.push(ik);      continue; }
    if (!info.aufloesbar)      { nichtAufloesbar.push(ik); continue; }
    const key = info.dateieinheit;
    if (!dateieinheiten.has(key)) dateieinheiten.set(key, []);
    dateieinheiten.get(key).push(ik);
  }
  return { dateieinheiten, ungeklaert, nichtAufloesbar };
}

/** Kurzer Hinweis neben dem Kassennamen. Leer, solange nichts bekannt ist —
 *  ein Platzhalter wie „unbekannt" verunsichert mehr, als er erklärt. */
export function dateieinheitBadge(ik, escapeHtml) {
  const info = _cache.get(ik);
  if (!info) return '';
  if (!info.aufloesbar) {
    return `<span class="pod-dav-badge" style="font-size:11px;color:#ef4444;border:1px solid #ef4444;border-radius:4px;padding:1px 5px;margin-left:6px;"
      title="Für diese Kasse ist keine elektronische Datenannahmestelle hinterlegt. Die Abrechnung würde mit einer Fehlermeldung abbrechen.">keine Annahmestelle</span>`;
  }
  const titel = `Datei geht an ${info.davName || info.davIk}` +
    (info.kassenart ? ` · Kassenart ${info.kassenart}` : '') +
    (info.ueberSammelschluessel ? ' (über Sammelschlüssel aufgelöst)' : '');
  return `<span class="pod-dav-badge" style="font-size:11px;color:var(--text-muted);border:1px solid var(--border);border-radius:4px;padding:1px 5px;margin-left:6px;"
    title="${escapeHtml(titel)}">${escapeHtml(info.kassenart || '–')} · ${escapeHtml(info.davIk)}</span>`;
}

/**
 * Satz für die Sammelaktion — sagt in einem Satz, was der Klick auslöst.
 * Absichtlich in Dateien UND Annahmestellen gerechnet: die Zahl der Umschläge
 * ist die Zahl der Dateien, aber wohin sie gehen, entscheidet die Annahmestelle.
 */
export function auswahlHinweis(iks) {
  const { dateieinheiten, ungeklaert, nichtAufloesbar } = gruppiereNachDatei(iks);
  const gewaehlt = iks.length;
  if (!gewaehlt) return 'Keine Kasse ausgewählt.';

  const teile = [`${gewaehlt} Kasse${gewaehlt > 1 ? 'n' : ''} ausgewählt`];
  // Je Kasse entsteht eine eigene Datei mit eigenem Begleitzettel — die
  // Produktentscheidung vom 05.09.2026: getrennte Pakete, keine Sammelrechnung.
  teile.push(`${gewaehlt} Datei${gewaehlt > 1 ? 'en' : ''} · ${gewaehlt} Begleitzettel`);
  if (dateieinheiten.size) {
    teile.push(`an ${dateieinheiten.size} Annahmestelle${dateieinheiten.size > 1 ? 'n' : ''}`);
  }
  if (nichtAufloesbar.length) teile.push(`${nichtAufloesbar.length} ohne Annahmestelle (wird abgelehnt)`);
  if (ungeklaert.length)      teile.push(`${ungeklaert.length} noch nicht geprüft`);
  return teile.join(' · ');
}
