/**
 * ausfallrechnung.js — Ausfallgebühr (No-Show/Kurzfristige-Absage-Rechnung)
 * anbieten und erstellen.
 *
 * War bis 03.09.2026 nur in `dashboard.js` verdrahtet. `kalender.html` — eine
 * separate Seite mit eigenem Storno-Weg (`kalender.js`, Terminpanel) — kannte
 * den Dialog gar nicht: wer dort absagte, verlor die Ausfallgebühr still
 * (Ops-Karte #249). Statt eine zweite Kopie zu schreiben, steht die Logik
 * jetzt hier; beide Seiten übergeben nur, was bei ihnen unterschiedlich ist
 * (Supabase-Client, API-Basis, Übersetzungstexte, Toast-Funktion).
 *
 * Preis für den Prozent-Modus (`ausfall_mode: 'percent'`) wird bewusst als
 * fertige Zahl (`priceEur`) entgegengenommen statt selbst im Leistungs-Array
 * zu suchen — `dashboard.js` und `kalender.js` halten Leistungen in
 * unterschiedlich geformten Strukturen, das Nachschlagen bleibt Sache des
 * Aufrufers.
 */

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const DEFAULT_TEXTS = {
  vereinbarungSeit: 'Ausfallvereinbarung liegt vor seit',
  keineVereinbarung: 'Für diesen Patienten ist keine unterschriebene Ausfallvereinbarung hinterlegt. Ohne sie ist die Forderung in der Regel nicht durchsetzbar.',
  gesperrtTitel: 'Ausfallrechnung nicht möglich',
  trotzdemErstellen: 'Trotzdem erstellen',
  popupBlockiert: 'Popup-Blocker aktiv — Rechnung unter Mahnwesen → Ausfallrechnungen abrufbar.',
  erstellt: 'Ausfallrechnung erstellt ✓',
};

/** Vorschlag für den Rechnungsbetrag aus der Owner-Config; `null` = manuell eingeben. */
export function ausfallSuggestedAmount(cfg, priceEur) {
  if (!cfg) return null;
  if (cfg.ausfall_mode === 'percent' && cfg.ausfall_percent > 0) {
    return priceEur > 0 ? +(priceEur * cfg.ausfall_percent / 100).toFixed(2) : null;
  }
  return cfg.ausfall_amount_eur > 0 ? Number(cfg.ausfall_amount_eur) : null;
}

/**
 * Liest, ob der Patient eine Ausfallvereinbarung unterschrieben hat. Fehlt
 * sie, warnt der Dialog sichtbar — blockiert aber nicht, weil viele Praxen
 * die Vereinbarung auf Papier führen (Entscheidung Melih, 10.08.2026).
 */
export async function ausfallVereinbarungDatum(supabase, leadId) {
  if (!leadId) return null;
  try {
    const { data } = await supabase.from('leads')
      .select('ausfallvereinbarung_am')
      .eq('id', leadId).maybeSingle();
    return data?.ausfallvereinbarung_am || null;
  } catch (e) {
    console.warn('[ausfallVereinbarungDatum]', e);
    return null;
  }
}

/**
 * Zeigt das Angebot, wenn die Praxis Ausfallgebühr aktiviert hat, sonst löst
 * sofort mit `false` auf. Löst auf, sobald der Nutzer entschieden hat
 * (erstellt oder verworfen) — Aufrufer, die den Termin danach löschen/ändern,
 * müssen darauf warten.
 */
export function offerAusfallrechnung({ supabase, apiBase, booking, reason, config, priceEur = null, showToast, texts = {} } = {}) {
  const tx = { ...DEFAULT_TEXTS, ...texts };
  return new Promise(resolve => {
    if (!booking || !config?.ausfall_enabled) return resolve(false);

    const suggested = ausfallSuggestedAmount(config, priceEur);
    const reasonLabel = reason === 'late_cancel' ? 'Kurzfristige Absage' : 'Patient nicht erschienen';

    const existing = document.getElementById('_ausfallModal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = '_ausfallModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div style="background:var(--bg-card-solid,#1e293b);color:var(--text-main,#e2e8f0);border-radius:12px;max-width:420px;width:100%;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.4);">
        <div style="font-size:15px;font-weight:700;margin-bottom:4px;">Ausfallrechnung erstellen?</div>
        <div style="font-size:13px;color:var(--text-muted,#94a3b8);margin-bottom:14px;">
          ${reasonLabel} — ${escapeHtml(booking.customer_name || '')}${booking.start_time ? ', ' + new Date(booking.start_time).toLocaleDateString('de-DE') : ''}
        </div>
        <label style="font-size:12px;color:var(--text-muted,#94a3b8);display:block;margin-bottom:4px;">Betrag (€)</label>
        <input id="_afAmount" type="number" min="0.01" step="0.01" value="${suggested != null ? suggested.toFixed(2) : ''}"
          style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border,#334155);background:transparent;color:inherit;font-size:14px;margin-bottom:6px;" />
        <div id="_afErr" style="color:var(--danger,#f87171);font-size:12px;display:none;margin-bottom:6px;"></div>
        <div id="_afVereinbarung" style="font-size:12px;margin-bottom:10px;" hidden></div>
        <div style="font-size:11px;color:var(--text-muted,#94a3b8);margin-bottom:16px;">Private Rechnung an den Patienten (Schadensersatz, umsatzsteuerfrei). Setzt eine unterschriebene Ausfallvereinbarung voraus.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="_afSkip" class="btn-secondary">Nicht berechnen</button>
          <button id="_afCreate" class="btn-primary">Rechnung erstellen</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    // Ausfallvereinbarung nachladen — die Rechnung nimmt im Text darauf Bezug,
    // deshalb muss sichtbar sein, ob sie überhaupt vorliegt.
    ausfallVereinbarungDatum(supabase, booking.lead_id).then(datum => {
      const box = overlay.querySelector('#_afVereinbarung');
      if (!box) return;
      box.hidden = false;
      if (datum) {
        box.style.color = 'var(--text-muted, #94a3b8)';
        box.textContent = `✓ ${tx.vereinbarungSeit} ${new Date(datum).toLocaleDateString('de-DE')}`;
      } else {
        box.style.color = 'var(--warning-text, #b45309)';
        box.textContent = `⚠ ${tx.keineVereinbarung}`;
      }
    });

    const done = (created) => { overlay.remove(); resolve(created); };
    overlay.onclick = e => { if (e.target === overlay) done(false); };
    overlay.querySelector('#_afSkip').onclick = () => done(false);
    // Wird auf true gesetzt, sobald der Server gesperrt hat und der Praxisinhaber
    // bewusst übersteuern will. Der Server protokolliert das dann in notes.
    let uebersteuern = false;

    overlay.querySelector('#_afCreate').onclick = async () => {
      const btn = overlay.querySelector('#_afCreate');
      const errEl = overlay.querySelector('#_afErr');
      const amount = parseFloat(overlay.querySelector('#_afAmount').value.replace(',', '.'));
      if (!(amount > 0)) { errEl.textContent = 'Bitte gültigen Betrag eingeben.'; errEl.style.display = ''; return; }
      btn.disabled = true;
      btn.textContent = 'Erstelle…';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${apiBase}/billing/ausfall/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ bookingId: booking.id, amountEur: amount, reason, override: uebersteuern }),
        });
        if (!res.ok) {
          let msg = await res.text();
          let payload = null;
          try { payload = JSON.parse(msg); msg = payload.error || msg; } catch (_) {}
          // 422 = Absagefrist nicht verletzt oder Funktion aus. Ist der Fall
          // übersteuerbar, bekommt die Praxis einen zweiten, bewussten Klick.
          if (res.status === 422 && payload?.uebersteuerbar && !uebersteuern) {
            uebersteuern = true;
            errEl.innerHTML = `<strong>${escapeHtml(tx.gesperrtTitel)}:</strong> ${escapeHtml(msg)}`;
            errEl.style.display = '';
            btn.disabled = false;
            btn.textContent = tx.trotzdemErstellen;
            return;
          }
          throw new Error(msg);
        }
        const html = await res.text();
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
          w.onload = () => w.print();
        } else {
          showToast?.(tx.popupBlockiert, 'error');
        }
        showToast?.(tx.erstellt);
        done(true);
      } catch (e) {
        errEl.textContent = 'Fehler: ' + e.message;
        errEl.style.display = '';
        btn.disabled = false;
        btn.textContent = 'Rechnung erstellen';
      }
    };
  });
}
