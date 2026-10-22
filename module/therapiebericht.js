/**
 * therapiebericht.js — Therapiebericht an den verordnenden Arzt: erstellen, senden, Archiv.
 *
 * Warum es das gibt
 * ─────────────────
 * Kemal 22.10.2026: Dokumente per Mail versenden, „podologlara da lazım". Bisher
 * gab es an der Verordnung nur das Flag „Therapiebericht angefordert", aber keinen
 * Bericht. Inhalt nach podoloji (22.10.2026): der automatische Teil (Patient,
 * Arzt, VO, Behandlungen, Befund) kommt vom Server, die Therapeutin schreibt nur
 * Verlauf und Empfehlung — plus drei Schnellwahl-Empfehlungen.
 *
 * Versandwege (legal-de 22.10.2026, compliance/LEGAL_DECISIONS.md):
 *   - Mail: PDF mit Zufallspasswort (AES-256). Das Passwort steht nach dem Senden
 *     groß auf dem Schirm, daneben der Anruf beim Arzt — es wird NIRGENDS
 *     gespeichert. Kann die Instanz nicht selbst mailen (SaaS, Box ohne SMTP —
 *     onprem O-216), wird das verschlüsselte PDF heruntergeladen und ein
 *     Mail-Entwurf geöffnet; die Praxis hängt es an.
 *   - Fax / Druck: offenes PDF zum Drucken, beim Fax mit Deckblatt
 *     (module/fax-deckblatt.js).
 * Geschrieben wird nur über das Backend (api-backend/routes/dokument-mail.js);
 * die Tabelle `therapieberichte` (Migration 0087) ist für den Browser nur lesbar.
 */
import { API_BASE } from '../supabase-config.js';
import { mailtoLink } from './mail-entwurf.js?v=20261007a';
import { druckeFaxDeckblatt } from './fax-deckblatt.js?v=20261022a';

'use strict';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export const EMPFEHLUNGEN = [
  ['fortsetzung', 'Fortsetzung empfohlen'],
  ['ziel_erreicht', 'Ziel erreicht'],
  ['abklaerung', 'Ärztliche Abklärung erbeten'],
];

const WEG_LABEL = { mail: 'E-Mail', fax: 'Fax', druck: 'Druck' };

const datumZeit = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** base64 → Blob-URL (PDF). */
export function pdfBlobUrl(base64, win = globalThis) {
  const bin = win.atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return win.URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

/** Text des Mail-Entwurfs, wenn die Praxis das PDF selbst anhängt. Kein Passwort darin. */
export function entwurfText(praxis = {}) {
  return [
    '[Bitte das heruntergeladene PDF anhängen, dann diese Zeile löschen.]',
    '',
    'Sehr geehrte Damen und Herren,',
    '',
    'anbei erhalten Sie unseren Therapiebericht. Das PDF ist passwortgeschützt; das Passwort teilen wir Ihnen telefonisch mit.',
    '',
    'Mit freundlichen kollegialen Grüßen',
    praxis.name || '',
    praxis.telefon ? `Tel. ${praxis.telefon}` : '',
  ].join('\n').trim();
}

async function api(supabase, pfad, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Bitte erneut anmelden.');
  const res = await fetch(`${API_BASE.replace(/\/+$/, '')}${pfad}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(json.error || `Fehler ${res.status}`); e.code = json.code; throw e; }
  return json;
}

/**
 * Block an der Verordnung: Knopf + Liste der versandten Berichte.
 * @param {HTMLElement} el
 * @param {{supabase:object, rxId:string, arztId?:string|null}} deps
 */
export async function mountTherapiebericht(el, deps) {
  if (!el || !deps?.rxId) return;
  el.innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm" data-tb-neu style="font-size:12px;">Bericht erstellen</button>
    <div data-tb-liste style="margin-top:8px;"></div>`;
  el.querySelector('[data-tb-neu]').addEventListener('click', () => oeffneBerichtDialog({ ...deps, nachher: () => mountTherapiebericht(el, deps) }));
  await zeichneListe(el.querySelector('[data-tb-liste]'), deps);
}

async function zeichneListe(host, deps) {
  const { data, error } = await deps.supabase.from('therapieberichte')
    .select('id, art, versand_weg, empfaenger, versendet_am, verschluesselt, passwort_telefonisch')
    .eq('prescription_id', deps.rxId).order('versendet_am', { ascending: false });
  if (error) { host.innerHTML = '<span class="text-muted" style="font-size:12px;">Berichte konnten nicht geladen werden.</span>'; return; }
  if (!data?.length) { host.innerHTML = ''; return; }
  host.innerHTML = data.map(b => `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;padding:4px 0;border-top:1px solid var(--border);">
      <span>${esc(datumZeit(b.versendet_am))}</span>
      <span class="text-muted">${b.art === 'abschlussbericht' ? 'Abschlussbericht' : 'Zwischenbericht'} · ${esc(WEG_LABEL[b.versand_weg] || b.versand_weg)}${b.empfaenger ? ' an ' + esc(b.empfaenger) : ''}</span>
      <button type="button" class="btn-outline" data-tb-pdf="${esc(b.id)}" style="font-size:11px;padding:2px 8px;">PDF</button>
      ${b.verschluesselt && !b.passwort_telefonisch
        ? `<button type="button" class="btn-outline" data-tb-tel="${esc(b.id)}" style="font-size:11px;padding:2px 8px;" title="Vermerk setzen">Passwort telefonisch übermittelt?</button>`
        : (b.verschluesselt ? '<span class="text-muted">Passwort übermittelt ✓</span>' : '')}
    </div>`).join('');
  host.onclick = async (e) => {
    const pdf = e.target.closest('[data-tb-pdf]');
    if (pdf) {
      const w = window.open('', '_blank');
      try {
        const r = await api(deps.supabase, `/dokument/therapiebericht/${encodeURIComponent(pdf.dataset.tbPdf)}/pdf`);
        if (w) w.location.href = pdfBlobUrl(r.pdf_base64);
      } catch (err) { if (w) w.close(); alert(err.message); }
      return;
    }
    const tel = e.target.closest('[data-tb-tel]');
    if (tel) {
      tel.disabled = true;
      try { await api(deps.supabase, `/dokument/therapiebericht/${encodeURIComponent(tel.dataset.tbTel)}/passwort-telefonisch`, { method: 'POST', body: {} }); }
      catch (err) { alert(err.message); }
      await zeichneListe(host, deps);
    }
  };
}

/**
 * Der Dialog. Eigenes Overlay (Klassen aus dashboard.css), damit dashboard.html
 * nicht wächst und der Dialog überall aufgehen kann, wo eine Verordnung steht.
 */
export async function oeffneBerichtDialog({ supabase, rxId, arztId = null, nachher = null }) {
  let arzt = null;
  if (arztId) {
    const { data } = await supabase.from('aerzte').select('arzt_name, email, fax, telefon').eq('id', arztId).maybeSingle();
    arzt = data || null;
  }

  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal" style="max-width:620px;">
      <div class="modal-header">
        <span class="modal-title">Therapiebericht</span>
        <button type="button" class="modal-close" data-tb-zu>✕</button>
      </div>
      <div class="modal-body" data-tb-body>
        <p class="text-muted" style="margin:0 0 10px;font-size:13px;">
          An: <strong>${esc(arzt?.arzt_name || 'kein Arzt an der Verordnung')}</strong>.
          Patient, Verordnung, Behandlungen und Befund werden automatisch übernommen.
        </p>
        <label style="font-size:12px;color:var(--text-muted);">Art
          <select data-tb-art style="display:block;font-size:13px;margin-bottom:10px;">
            <option value="zwischenbericht">Zwischenbericht</option>
            <option value="abschlussbericht">Abschlussbericht</option>
          </select>
        </label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;" data-tb-chips>
          ${EMPFEHLUNGEN.map(([c, l]) => `<button type="button" class="btn-outline" data-tb-code="${c}" aria-pressed="false" style="font-size:12px;padding:4px 10px;">${esc(l)}</button>`).join('')}
        </div>
        <label style="font-size:12px;color:var(--text-muted);">Verlauf / Besonderheiten
          <textarea data-tb-verlauf rows="3" maxlength="4000" style="display:block;width:100%;font-size:13px;margin-bottom:10px;"></textarea>
        </label>
        <label style="font-size:12px;color:var(--text-muted);">Empfehlung (Ergänzung)
          <textarea data-tb-empf rows="2" maxlength="4000" style="display:block;width:100%;font-size:13px;margin-bottom:10px;"></textarea>
        </label>
        <label style="font-size:12px;color:var(--text-muted);">E-Mail des Arztes
          <input type="email" data-tb-mail value="${esc(arzt?.email || '')}" style="display:block;width:100%;font-size:13px;">
        </label>
        <p data-tb-fehler style="color:var(--danger,#dc2626);font-size:12px;margin:8px 0 0;" hidden></p>
      </div>
      <div class="modal-footer" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;" data-tb-fuss>
        <button type="button" class="btn-ghost" data-tb-aktion="vorschau">Vorschau</button>
        <button type="button" class="btn-outline" data-tb-aktion="druck">Drucken</button>
        <button type="button" class="btn-outline" data-tb-aktion="fax">Fax</button>
        <button type="button" class="btn btn-primary" data-tb-aktion="mail">Per E-Mail senden</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  const zu = () => { ov.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = (e) => { if (e.key === 'Escape') zu(); };
  document.addEventListener('keydown', esc_);
  ov.querySelector('[data-tb-zu]').onclick = zu;
  ov.addEventListener('click', (e) => { if (e.target === ov) zu(); });

  let code = null;
  ov.querySelector('[data-tb-chips]').onclick = (e) => {
    const b = e.target.closest('[data-tb-code]');
    if (!b) return;
    code = code === b.dataset.tbCode ? null : b.dataset.tbCode;
    ov.querySelectorAll('[data-tb-code]').forEach(x => {
      const an = x.dataset.tbCode === code;
      x.setAttribute('aria-pressed', String(an));
      // Theme-Klassen statt fester Farben (Dark-Theme-Regel).
      x.className = an ? 'btn btn-primary' : 'btn-outline';
    });
  };

  const fehler = (t) => { const f = ov.querySelector('[data-tb-fehler]'); f.textContent = t || ''; f.hidden = !t; };

  ov.querySelector('[data-tb-fuss]').onclick = async (e) => {
    const knopf = e.target.closest('[data-tb-aktion]');
    if (!knopf) return;
    const aktion = knopf.dataset.tbAktion;
    fehler('');
    // Fenster SOFORT im Klick öffnen — nach dem await blockt der Popup-Blocker.
    const fenster = (aktion === 'vorschau' || aktion === 'druck' || aktion === 'fax') ? window.open('', '_blank') : null;
    const knoepfe = ov.querySelectorAll('[data-tb-aktion]');
    knoepfe.forEach(k => { k.disabled = true; });
    try {
      const r = await api(supabase, '/dokument/therapiebericht', {
        method: 'POST',
        body: {
          aktion, prescription_id: rxId,
          art: ov.querySelector('[data-tb-art]').value,
          empfehlung_code: code,
          verlauf: ov.querySelector('[data-tb-verlauf]').value,
          empfehlung: ov.querySelector('[data-tb-empf]').value,
          an_email: ov.querySelector('[data-tb-mail]').value.trim(),
        },
      });
      if (r.pdf_base64 && fenster) fenster.location.href = pdfBlobUrl(r.pdf_base64);
      if (aktion === 'vorschau') { knoepfe.forEach(k => { k.disabled = false; }); return; }
      zeigeErgebnis(ov, r, aktion, supabase);
      if (typeof nachher === 'function') nachher();
    } catch (err) {
      if (fenster) fenster.close();
      fehler(err.message);
      knoepfe.forEach(k => { k.disabled = false; });
    }
  };
}

function zeigeErgebnis(ov, r, aktion, supabase) {
  const body = ov.querySelector('[data-tb-body]');
  const fuss = ov.querySelector('[data-tb-fuss]');
  const tel = r.arzt?.telefon ? `<a href="tel:${esc(r.arzt.telefon.replace(/[^\d+]/g, ''))}" class="btn btn-secondary btn-sm">Arzt anrufen: ${esc(r.arzt.telefon)}</a>` : '';

  if (aktion === 'mail') {
    const selbst = !r.gesendet;
    body.innerHTML = `
      <p style="margin:0 0 8px;">${selbst
        ? 'Das verschlüsselte PDF wurde heruntergeladen. Bitte im Mailprogramm an den Arzt anhängen.'
        : `Bericht an <strong>${esc(r.empfaenger || '')}</strong> gesendet.`}</p>
      <p style="margin:0 0 4px;font-size:12px;color:var(--text-muted);">Passwort — bitte telefonisch durchgeben, nicht per Mail. Es wird nicht gespeichert.</p>
      <div style="font:600 28px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.12em;padding:10px 14px;border:2px dashed var(--border);border-radius:8px;margin-bottom:12px;user-select:all;">${esc(r.passwort || '')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        ${tel}
        ${selbst ? '<button type="button" class="btn btn-secondary btn-sm" data-tb-entwurf>Mail-Entwurf öffnen</button>' : ''}
        <label style="font-size:13px;display:flex;gap:6px;align-items:center;"><input type="checkbox" data-tb-telok> Passwort telefonisch übermittelt</label>
      </div>`;
    if (selbst && r.pdf_base64) {
      const a = document.createElement('a');
      a.href = pdfBlobUrl(r.pdf_base64); a.download = r.dateiname || 'Therapiebericht.pdf';
      document.body.appendChild(a); a.click(); a.remove();
    }
    body.querySelector('[data-tb-entwurf]')?.addEventListener('click', () => {
      globalThis.location.href = mailtoLink({ to: r.empfaenger || '', subject: 'Therapiebericht', text: entwurfText(r.praxis) });
    });
    body.querySelector('[data-tb-telok]').addEventListener('change', async (e) => {
      if (!e.target.checked) return;
      e.target.disabled = true;
      try { await api(supabase, `/dokument/therapiebericht/${encodeURIComponent(r.bericht_id)}/passwort-telefonisch`, { method: 'POST', body: {} }); }
      catch (err) { e.target.checked = false; e.target.disabled = false; alert(err.message); }
    });
  } else {
    body.innerHTML = `
      <p style="margin:0 0 8px;">Bericht erstellt und in der Akte vermerkt. Das PDF ist in einem neuen Fenster geöffnet — dort drucken.</p>
      ${aktion === 'fax' ? `<p style="margin:0 0 8px;font-size:13px;">Fax an: <strong>${esc(r.empfaenger || 'keine Faxnummer hinterlegt')}</strong></p>
        <button type="button" class="btn btn-secondary btn-sm" data-tb-deckblatt>Fax-Deckblatt drucken</button>` : ''}`;
    body.querySelector('[data-tb-deckblatt]')?.addEventListener('click', () => {
      druckeFaxDeckblatt({ praxis: r.praxis || {}, empfaenger: { name: r.arzt?.name || '', fax: r.arzt?.fax || '', telefon: r.arzt?.telefon || '' }, betreff: 'Therapiebericht' });
    });
  }
  fuss.innerHTML = '<button type="button" class="btn btn-primary" data-tb-fertig>Fertig</button>';
  fuss.onclick = (e) => { if (e.target.closest('[data-tb-fertig]')) ov.querySelector('[data-tb-zu]').click(); };
}
