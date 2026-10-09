// Nächtlicher KI-Abgleich (O-169 Bedingung 7, guvenlik S-55): Azure-Tagessumme der Box-Ressource ↔ Summe der
// Box-Berichte (`ki_bericht`, O-183: je Box und UTC-Tag eine Zeile mit wachsender Summe). Liegt Azure über der
// Toleranz, schaltet admin.js `ki-abgleich` den globalen KI-Schalter aus — nie ein.
//
// Ein Detektor, keine Bremse: er kommt frühestens nach Tagesende. Die Bremse ist Azure-seitig (TPM, Budget-Alarm,
// S-55 C). Bereits ausgegebene Jetons bleiben bis Entra-Ablauf (≤ ~90 min) gültig (S-55 Befund 4).
// Voraussetzung (guvenlik, 09.10.2026): die Azure-Zahl stammt aus einer Ressource, die NUR Boxen nutzen — sonst
// misst der Abgleich den SaaS-Verbrauch mit.
//
// Tag = UTC (Berichte schneiden nach UTC, `window_start` = 'JJJJ-MM-TTT00:00:00.000Z'; Azure-Metriken ebenso).

export const STANDARD_TOLERANZ = Object.freeze({ prozent: 10, tokens: 20000 });

/** Tokens eines Berichts (`daten` als JSON-Text oder Objekt). Unlesbar/ungültig zählt 0 — nie NaN (fail-closed). */
export function berichtTokens(daten) {
  let d = daten;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch { return 0; }
  }
  const totals = d?.taskTotals;
  if (!totals || typeof totals !== 'object') return 0;
  let summe = 0;
  for (const m of Object.values(totals)) {
    const n = m?.total_tokens;
    if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) summe += n;
  }
  return summe;
}

const ganzzahl = (w) => (typeof w === 'string' && /^\d{1,15}$/.test(w) ? Number(w) : w);

/** 'JJJJ-MM-TT' → { windowStart, von, bis } (UTC-Sekunden), sonst Fehler. */
export function utcTag(tag) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tag ?? ''));
  const ms = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  if (!m || new Date(ms).toISOString().slice(0, 10) !== tag) throw new Error('Tag muss JJJJ-MM-TT (UTC) sein');
  return { windowStart: `${tag}T00:00:00.000Z`, von: ms / 1000, bis: ms / 1000 + 86400 };
}

/**
 * berichte: [{ box_id, daten }] (eine Zeile je Box, siehe db.kiBerichteTag) · azureTokens: ganze Zahl ≥ 0.
 * Ungültige Eingaben werfen — ein Abgleich darf nie still "ok" sagen.
 */
export function abgleichen({ berichte, azureTokens, toleranz = STANDARD_TOLERANZ }) {
  const azure = ganzzahl(azureTokens);
  if (!Number.isSafeInteger(azure) || azure < 0) throw new Error('Azure-Tokens müssen eine ganze Zahl ≥ 0 sein');
  const prozent = ganzzahl(toleranz?.prozent);
  const tokens = ganzzahl(toleranz?.tokens);
  if (!Number.isSafeInteger(prozent) || prozent < 0 || prozent > 100) throw new Error('Toleranz-Prozent: ganze Zahl 0..100');
  if (!Number.isSafeInteger(tokens) || tokens < 0) throw new Error('Toleranz-Tokens: ganze Zahl ≥ 0');

  const kutular = (berichte || []).map((b) => ({ box_id: b.box_id, tokens: berichtTokens(b.daten) }));
  const gemeldet = kutular.reduce((s, k) => s + k.tokens, 0);
  const grenze = Math.floor(gemeldet * (100 + prozent) / 100) + tokens;
  return {
    gemeldet, azure, grenze, differenz: azure - gemeldet,
    ueberschritten: azure > grenze,
    // Mehr gemeldet als verbraucht verschleiert keine Kosten — nur Warnung (guvenlik b).
    mehrGemeldet: gemeldet > azure,
    kutular,
  };
}
