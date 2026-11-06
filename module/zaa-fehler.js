// ZAA-Fehlertabelle — EIN Renderer für beide Wege in `#zaaResult` (06.11.2026).
//
// Vorher zwei Vorlagen im selben Modal: nach dem Upload (Code · Beleg · Fehler ·
// Lösung, ohne „Beheben") und beim späteren Öffnen (Code · Status · Fehler ·
// Lösung · Aktion, ohne Beleg). Gefunden über funktionen/DOM-KANDIDATEN-2026-11-06.md.
//
// Spalten nach gkv-302 (06.11.2026): Code · Beleg · Status · Fehler · Lösung · Aktion.
// Beleg bleibt Pflicht: Die Kasse meldet Fehler je Belegnummer, und die
// Korrekturrechnung muss die ursprüngliche Belegnummer liefern (Anlage 1 TP5 V21
// Kap. 7, URI-Segment). „Beheben" allein reicht der Praxis nicht.
//
// Herkunft der Belegnummer: Upload-Antwort = Rohwert der Kasse; gespeicherte
// Zeilen (`zaa_fehler`) haben keine eigene Spalte, die Nummer kommt per Join aus
// `prescriptions.belegnummer` (dort eingefroren, Zuordnung in
// api-backend/billing/zaa/anwenden.js). Ohne Zuordnung: Rohnummer der Kasse aus
// `zaa_fehler.belegnummer_kasse` (Migration 0111, gkv-302 06.11.2026).

/** Gespeicherte Zeilen (zaa_fehler + prescriptions(belegnummer)) → Tabellenzeilen. */
export function zaaZeilenAusDb(data) {
  return (data || []).map(e => ({
    code: e.fehler_code,
    beleg: e.prescriptions?.belegnummer || e.belegnummer_kasse || null,
    status: e.status || 'offen',
    fehler: e.uebersetzung || e.fehler_text || '',
    loesung: e.loesung_hint || '',
    rxId: e.prescription_id || null,
  }));
}

/**
 * Upload-Antwort → Tabellenzeilen. `dbZeilen` (aus zaaZeilenAusDb) liefert, wo die
 * Belegnummer zugeordnet wurde, Verordnung und Status nach — damit „Beheben" auch
 * direkt nach dem Upload funktioniert. Ohne Treffer bleibt die Rohnummer der Kasse
 * sichtbar (genau die Zeilen, die die Praxis von Hand prüfen muss).
 */
export function zaaZeilenAusUpload(errors, dbZeilen = []) {
  const proBeleg = new Map();
  for (const z of dbZeilen) if (z.beleg && z.rxId && !proBeleg.has(z.beleg)) proBeleg.set(z.beleg, z);
  return (errors || []).map(e => {
    const treffer = e.belegnummer ? proBeleg.get(e.belegnummer) : null;
    return {
      code: e.code,
      beleg: e.belegnummer || null,
      status: treffer?.status || 'offen',
      fehler: e.uebersetzung || e.text || '',
      loesung: e.loesung || '',
      rxId: treffer?.rxId || null,
    };
  });
}

/** Tabelle als HTML. Leere Liste → ''. */
export function renderZaaFehlerTabelle(zeilen, { escapeHtml = (s) => String(s ?? '') } = {}) {
  if (!zeilen?.length) return '';
  const esc = escapeHtml;
  const rows = zeilen.map(z => {
    const aktion = z.rxId
      ? `<a href="#" class="zaa-fix-link" data-rx="${esc(z.rxId)}" style="color:var(--primary);text-decoration:underline;font-weight:600;">Beheben</a>`
      : '—';
    return `<tr>
      <td><code>${esc(z.code)}</code></td>
      <td>${esc(z.beleg || '—')}</td>
      <td>${esc(z.status || '')}</td>
      <td>${esc(z.fehler)}</td>
      <td style="color:var(--text-muted);">${esc(z.loesung)}</td>
      <td>${aktion}</td>
    </tr>`;
  }).join('');
  return `<table class="data-table"><thead><tr><th>Code</th><th>Beleg</th><th>Status</th><th>Fehler</th><th>Lösung</th><th>Aktion</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** Ergebnis nach dem Upload: Zusammenfassung + Warnung + gemeinsame Tabelle. */
export function renderZaaUploadResult(json, { escapeHtml, dbZeilen = [] } = {}) {
  const summary = json?.errorCount
    ? `<div style="padding:10px;background:var(--danger-dim, rgba(239,68,68,0.12));border:1px solid var(--danger, #ef4444);border-radius:6px;margin-bottom:10px;color:var(--danger, #ef4444);">
         ${Number(json.errorCount)} Fehler erkannt — Abrechnung als <strong>abgelehnt</strong> markiert.
       </div>`
    : `<div style="padding:10px;background:var(--success-dim, rgba(34,197,94,0.12));border:1px solid var(--success, #22c55e);border-radius:6px;margin-bottom:10px;color:var(--success, #22c55e);">
         Keine Fehler erkannt — Abrechnung als <strong>akzeptiert</strong> markiert.
       </div>`;
  const warnung = (json?.nichtZugeordnet && json.nichtZugeordnet > 0)
    ? `<div style="padding:10px;background:var(--warning-dim, rgba(245,158,11,0.12));border:1px solid var(--warning, #f59e0b);border-radius:6px;margin-bottom:10px;color:var(--warning-text, var(--warning, #f59e0b));">
         ${Number(json.nichtZugeordnet)} Absetzung(en) konnte(n) keinem Beleg zugeordnet werden — bitte manuell prüfen.
       </div>`
    : '';
  return summary + warnung + renderZaaFehlerTabelle(zaaZeilenAusUpload(json?.errors, dbZeilen), { escapeHtml });
}

/** Gespeicherte Fehler einer Abrechnung laden (mit Belegnummer per Join). */
export async function ladeZaaZeilen(supabase, abrechnungId) {
  const { data, error } = await supabase
    .from('zaa_fehler')
    .select('fehler_code, fehler_text, uebersetzung, loesung_hint, status, prescription_id, belegnummer_kasse, created_at, prescriptions(belegnummer)')
    .eq('abrechnung_id', abrechnungId)
    .order('created_at');
  if (error) throw error;
  return zaaZeilenAusDb(data);
}

/** „Beheben"-Links im Container verdrahten. onBeheben(rxId) öffnet die Verordnung. */
export function verdrahteZaaBeheben(container, onBeheben) {
  container.querySelectorAll('.zaa-fix-link').forEach(link => {
    link.addEventListener('click', (evt) => {
      evt.preventDefault();
      onBeheben(link.dataset.rx);
    });
  });
}
