/**
 * Dateiversionen einer §302-Abrechnung (M1.16, Registry `abrechnung_artefakt_version`).
 *
 * Zeigt alle Versionen der Abrechnungsdateien (DTA, Auftragsdatei, Begleitzettel,
 * signierte und verschlüsselte Datei) mit Lebenszyklus, Prüfstatus und
 * Aufbewahrungshinweis — nur Lesen. Der Download läuft über den geschützten,
 * versionsgebundenen Endpunkt (`/abrechnung/:id/artefakte/:versionId/download`);
 * der Browser kennt keine Storage-Pfade.
 *
 * Aufbewahrung: Signaturen 8 Jahre erst ab dokumentierter Einreichung; ohne
 * Einreichung steht nach 7 Tagen eine Wiedervorlage — es gibt nie ein
 * automatisches Löschen (M1.16(b) ist offen und deaktiviert).
 */

const STATUS_TEXT = {
  reserved: 'in Arbeit',
  published: 'veröffentlicht',
  retire_pending: 'wird ausgemustert',
  retired: 'ausgemustert',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function datum(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  } catch { return '—'; }
}

/** Reines Rendering — testbar ohne DOM. */
export function dateiversionenHtml(liste) {
  const v = liste?.versionen || [];
  if (!v.length) {
    return `<p style="color:var(--text-muted);font-size:13px;">Für diese Abrechnung sind noch keine Dateiversionen in der Registry erfasst (ältere Abrechnungen werden nachträglich aufgenommen).</p>`;
  }
  const zeilen = v.map((r) => `
    <tr>
      <td>${esc(r.bezeichnung)}${r.aktuell ? ' <span style="font-size:11px;color:var(--success);">· aktuell</span>' : ''}</td>
      <td>${esc(STATUS_TEXT[r.status] || r.status)}</td>
      <td>${esc(datum(r.erstelltAm))}</td>
      <td style="font-size:12px;color:var(--text-muted);">${esc(r.pruefung)}${r.aufbewahrung ? '<br>' + esc(r.aufbewahrung) : ''}${r.wiedervorlage ? '<br><strong style="color:var(--warning, var(--text-main));">Wiedervorlage: seit über 7 Tagen nicht eingereicht</strong>' : ''}</td>
      <td>${r.herunterladbar ? `<button class="btn-ghost btn-sm" data-artefakt-dl="${esc(r.id)}">Herunterladen</button>` : '—'}</td>
    </tr>`).join('');
  return `<table class="data-table" style="width:100%;"><thead><tr><th>Datei</th><th>Status</th><th>Erstellt</th><th>Prüfung / Aufbewahrung</th><th></th></tr></thead><tbody>${zeilen}</tbody></table>
    <p style="margin-top:10px;font-size:12px;color:var(--text-muted);">Dateien werden nie automatisch gelöscht. Aufbewahrung (8 Jahre) beginnt mit der dokumentierten Einreichung.</p>`;
}

async function token(ctx) {
  const { data: { session } } = await ctx.supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Nicht angemeldet.');
  return session.access_token;
}

async function ladeListe(ctx, abrechnungId) {
  const res = await fetch(`${ctx.apiBase}/billing/abrechnung/${encodeURIComponent(abrechnungId)}/artefakte`, {
    headers: { Authorization: 'Bearer ' + await token(ctx) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || ('HTTP ' + res.status));
  return json;
}

async function lade(ctx, abrechnungId, versionId) {
  const res = await fetch(`${ctx.apiBase}/billing/abrechnung/${encodeURIComponent(abrechnungId)}/artefakte/${encodeURIComponent(versionId)}/download`, {
    headers: { Authorization: 'Bearer ' + await token(ctx) },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || ('HTTP ' + res.status));
  }
  const blob = await res.blob();
  const dispo = res.headers.get('Content-Disposition') || '';
  const name = (dispo.match(/filename="([^"]+)"/) || [])[1] || 'abrechnung';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * @param {object} ctx  supabase · apiBase · showToast · showHtmlModal
 * @param {{id:string}} ab
 */
export async function zeigeDateiversionen(ctx, ab) {
  try {
    const liste = await ladeListe(ctx, ab.id);
    ctx.showHtmlModal({
      title: 'Dateiversionen',
      html: `<div id="abArtefakteBody">${dateiversionenHtml(liste)}</div>`,
      afterRender: () => {
        const body = document.getElementById('abArtefakteBody');
        if (!body) return;
        body.querySelectorAll('[data-artefakt-dl]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            try { await lade(ctx, ab.id, btn.dataset.artefaktDl); }
            catch (e) { ctx.showToast?.('Download fehlgeschlagen: ' + e.message, 'error'); }
            finally { btn.disabled = false; }
          });
        });
      },
    });
  } catch (e) {
    console.error('[abrechnung/artefakte]', e);
    ctx.showToast?.('Dateiversionen konnten nicht geladen werden: ' + e.message, 'error');
  }
}
