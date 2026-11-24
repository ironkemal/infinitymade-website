/**
 * systemstatus.js — Einstellungen → „System“ (nur Inhaber, nur Box). Box-Test 22.11.2026, Problem 1.
 *
 * Warum: Der Browser-Test sah nur die Server-Version; Schema, letzte Sicherung, Schlüssel-
 * Schlüssel-Abgleich, Realtime und Speicherplatz fehlten. GET /api/status (routes/status.js, nurKutu +
 * requireOwner, RELEASE-STANDARD §6.5) liefert das seit O-40 — es gab nur keine Anzeige.
 * Kein neuer Endpunkt. Sichtbarkeit entscheidet der Server: 404 (SaaS) / 401 / 403 (kein Inhaber)
 * → Abschnitt bleibt verborgen. Nichts Geheimes: der Server gibt nur Zustände und Zeiten heraus,
 * den Schlüssel-Abdruck bewusst nicht (S-60 f).
 * Disk-Alarm, Image-Aufräumen usw. bleiben in onprem/PLAN-UPDATE-HALTBARKEIT.md — hier nur Anzeige.
 */

const ZEICHEN = { ok: '✓', info: 'ℹ', warnung: '⚠', fehler: '✗', unbekannt: '?', nicht_implementiert: '–' };
const FARBE = { ok: 'var(--success)', info: 'var(--text-muted)', warnung: 'var(--warning)', fehler: 'var(--danger, #dc2626)' };

/** @param {unknown} t */
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
/** @param {string|null|undefined} iso */
const zeitpunkt = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d.getTime()) ? d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; };
/** @param {number|null|undefined} b */
const groesse = (b) => (typeof b === 'number' && b >= 0 ? (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`) : '—');

/**
 * Status-Antwort → Zeilen [Bezeichnung, Zustand, Text]. Rein, testbar.
 * @param {any} s  Antwort von GET /api/status
 * @returns {Array<[string, string, string]>}
 */
export function statusZeilen(s) {
  const f = s?.felder || {};
  /** @type {Array<[string, string, string]>} */
  const z = [];
  z.push(['Version', 'info', [f.version?.version, f.version?.digest ? `Image ${String(f.version.digest).slice(7, 19)}` : ''].filter(Boolean).join(' · ') || '—']);
  const schemaText = { migration: 'Wartungsmodus: Datenbank-Update läuft oder ist fehlgeschlagen' }[f.schema?.code] || (f.version?.schema ? `Stand ${f.version.schema}` : '');
  z.push(['Datenbank-Schema', f.schema?.status || 'unbekannt', schemaText || '—']);
  const b = f.backup || {};
  const bText = b.code === 'keine' ? 'Noch keine Sicherung gelaufen'
    : b.letzte_ok ? `${zeitpunkt(b.letzte_ok)} (vor ${b.alter_stunden ?? '?'} h)${b.ziel_ausserhalb === false ? ' · liegt nur auf diesem Server' : b.ziel_ausserhalb ? ' · außerhalb gespeichert' : ''}`
    : 'Unbekannt (Zustandsdatei fehlt)';
  z.push(['Letzte Sicherung', b.status || 'unbekannt', b.code === 'alt' ? `${bText} — älter als erlaubt` : bText]);
  const k = f.data_key || {};
  // Den Abdruck selbst gibt der Server bewusst nie heraus (guvenlik S-60 f) — nur den Abgleich mit der Sicherung.
  const kText = k.vergleich === 'gleich' ? 'gleich wie in der Sicherung' : k.vergleich === 'unbekannt' ? 'Abgleich mit der Sicherung nicht möglich'
    : k.vergleich ? 'weicht von der Sicherung ab — Sicherungen evtl. nicht lesbar' : '';
  z.push(['Datenschlüssel', k.status || 'unbekannt', kText || '—']);
  if (f.zertifikat) {
    const c = f.zertifikat;
    const art = c.art === 'lokale_ca' ? 'Lokale Zertifizierungsstelle' : 'Zertifikat';
    z.push(['Zertifikat', c.status || 'unbekannt', c.gueltig_bis ? `${art} gültig bis ${zeitpunkt(c.gueltig_bis)}${c.tage_rest != null ? ` (${c.tage_rest} Tage)` : ''}`
      : c.code === 'nicht_ueberwacht' ? 'Noch nicht gemessen (nächtliche Prüfung)' : c.code === 'alt' ? 'Messung älter als 48 h' : '—']);
  }
  z.push(['Echtzeit (Realtime)', f.realtime?.status || 'unbekannt', f.realtime?.status === 'ok' ? 'verbunden' : '—']);
  const d = f.disk || {};
  z.push(['Speicherplatz', d.status || 'unbekannt', d.frei_prozent != null ? `${d.frei_prozent} % frei (${groesse(d.frei_bytes)} von ${groesse(d.gesamt_bytes)})${d.code === 'kein_platz_fuer_sicherung' ? ' · zu wenig Platz für eine Sicherung' : ''}` : '—']);
  z.push(['Uhrzeit (NTP)', f.zeit?.status || 'unbekannt', f.zeit?.status === 'ok' ? 'synchron' : f.zeit?.code === 'ntp' ? 'nicht synchron' : '—']);
  const alt = Array.isArray(f.disk?.restore_reste) ? f.disk.restore_reste : [];
  if (alt.length) {
    z.push(['Alte Datenbanken nach Wiederherstellung', 'info',
      `${alt.map((/** @type {any} */ x) => `${x.name} (${groesse(x.bytes)})`).join(', ')} — belegen Platz. Löschen nur nach Anleitung (KURULUM), wenn die Wiederherstellung passt.`]);
  }
  return z;
}

/**
 * @param {HTMLElement|null} abschnitt  #settingsSystemSection
 * @param {{ apiBase: string, getToken: () => Promise<string|null|undefined>, fetchImpl?: typeof fetch, istKutu?: boolean }} deps
 * @returns {Promise<'versteckt'|'angezeigt'|'fehler'>}
 */
export async function mountSystemstatus(abschnitt, { apiBase, getToken, fetchImpl = fetch, istKutu }) {
  if (!abschnitt) return 'versteckt';
  if (istKutu === false) { abschnitt.hidden = true; return 'versteckt'; }
  const ziel = abschnitt.querySelector('[data-systemstatus]') || abschnitt;
  try {
    const token = await getToken();
    if (!token) { abschnitt.hidden = true; return 'versteckt'; }
    const res = await fetchImpl(`${apiBase}/status`, { headers: { Authorization: `Bearer ${token}` } });
    if ([401, 403, 404].includes(res.status)) { abschnitt.hidden = true; return 'versteckt'; }
    const s = await res.json();
    abschnitt.hidden = false;
    const gesamt = s?.gesamt || 'unbekannt';
    ziel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;">
        <strong style="color:${FARBE[gesamt] || 'var(--text-main)'};">${ZEICHEN[gesamt] || '?'} Gesamtzustand: ${esc({ ok: 'in Ordnung', warnung: 'Hinweise', fehler: 'Handlungsbedarf' }[gesamt] || 'unbekannt')}</strong>
        <span style="color:var(--text-muted);font-size:12px;">gemessen ${esc(zeitpunkt(s?.gemessen_am))}</span>
      </div>
      <div style="display:flex;flex-direction:column;border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        ${statusZeilen(s).map(([name, st, text]) => `
          <div style="display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-top:1px solid var(--border);font-size:13px;">
            <span style="width:16px;color:${FARBE[st] || 'var(--text-muted)'};font-weight:700;">${ZEICHEN[st] || '?'}</span>
            <span style="flex:0 0 38%;color:var(--text-muted);">${esc(name)}</span>
            <span style="flex:1;color:var(--text-main);overflow-wrap:anywhere;">${esc(text)}</span>
          </div>`).join('')}
      </div>
      <p class="form-hint" style="margin:8px 0 0;">Nur für den Praxisinhaber sichtbar. Es werden keine Schlüssel oder Zugangsdaten angezeigt.</p>`;
    return 'angezeigt';
  } catch {
    // Netzwerkfehler: nur auf der Box melden; im SaaS gibt es keinen Systemstatus (Phase 7b F5).
    if (istKutu === false) { abschnitt.hidden = true; return 'versteckt'; }
    abschnitt.hidden = false;
    ziel.textContent = 'Systemstatus derzeit nicht abrufbar.';
    return 'fehler';
  }
}
