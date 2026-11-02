/**
 * verordnung-einheiten.js — die verordnete Menge nachträglich korrigieren.
 *
 * Warum es das gibt
 * ─────────────────
 * Beta-1 (Podologe, beta), 31.08.2026:
 *
 *   „Wenn du angelegt hast, wenn du auf den Patienten gehst, [soll man es]
 *    noch mal sogar ändern lassen. … Dann kannst du es noch in der Akte selber
 *    ändern. Das ist dann nicht fest, sondern du sagst, es sind doch nur zwei
 *    oder so"
 *
 * Der Anlass ist fachlich, nicht Bequemlichkeit: nach der Eingangsbefundung
 * steht oft erst fest, wie viele Einheiten wirklich nötig sind. Bisher war die
 * Zahl im Moment des Anlegens festgeschrieben — wer sich vertan hatte, legte
 * eine zweite Verordnung an.
 *
 * Geltungsbereich:
 * ────────────────
 * 1. Podologischer Zweig (`therapie_bereich = 'podo'`): Direkte Anpassung
 *    über `speichereEinheiten()` (Verordnungsmenge ändert keinen Geldbetrag).
 * 2. Physiotherapie & Ergotherapie (`therapie_bereich IN ('physio', 'ergo')`, Ops #251):
 *    Revisionssichere Korrektur von Übertragungsfehlern gegenüber dem Original-Rezept
 *    über RPC `einheiten_korrigieren()` (GoBD-Protokoll in `einheiten_korrekturen`).
 *    Riegel: Nur Inhaber, nur Reduzierung (neu < alt), vor Abrechnung (keine Belegnummer),
 *    erbrachte Termine werden nie gelöscht (Doppelbehandlung: 1 Termin = 2 Einheiten).
 *    Eventuelle Zuzahlungsänderungen laufen separat über den bestehenden Korrekturweg
 *    (`module/zuzahlung-korrektur.js`), um zwei Rechenwege zu verhindern.
 *
 * Der Riegel
 * ──────────
 * Eine Verordnung, die schon bei der Kasse war, wird nicht mehr angefasst.
 * Gleiche Absicht wie `korrekturErlaubt` in `module/zuzahlung-rechnen.js`, aber
 * mit den Spalten dieses Topfes — deshalb hier und nicht dort: jene Datei ist
 * eine wörtliche Spiegelung des Backend-Calculators und bekommt nichts
 * hinzugedichtet, wofür es kein Gegenstück gibt.
 *
 * ⚠️ Offen und bewusst benannt: In der Datenbank hält diesen Riegel NICHTS.
 * GoBD-Trigger gibt es für `belegliste`, `invoices` und `zuzahlung_korrekturen`
 * (db/SCHEMA-RLS.sql); `anzahl_einheiten` steht auf KEINER Liste, die ein
 * Festschreibungs-Trigger sperrt — weder vorher (`verordnungen.behandlungs-
 * einheiten`) noch nachher (`prescriptions.anzahl_einheiten`, siehe auch
 * `db/REGISTER.md`: die Spalte kommt in keiner Zeile der Backend-
 * Abrechnungskette vor). Der Schreibweg der
 * Podologie-Abrechnung (`podologie-abrechnung.js`, UPDATE-Zweig des Formulars)
 * prüft ebenfalls nichts. Diese Datei ist damit heute die einzige Stelle, die
 * hinsieht — ein Riegel im Browser ist eine Hilfe für den Anwender, keine
 * Sicherung. Gehört als eigene Aufgabe auf die Ops-Karte.
 */

import { emit } from './signal.js?v=20260813';
import { oeffneZuzahlungKorrektur } from './zuzahlung-korrektur.js?v=20260901';

const ABGESCHLOSSEN = ['abgerechnet', 'archiviert', 'storniert'];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Darf die verordnete Menge dieser Verordnung noch geändert werden?
 * (Podologischer Zweig)
 *
 * @param {object} vord  Zeile aus `verordnungen`
 * @returns {{erlaubt:boolean, grund:string|null}}
 */
export function einheitenAenderungErlaubt(vord) {
  if (!vord) return { erlaubt: false, grund: 'Verordnung nicht gefunden.' };

  // Die eingefrorene Belegnummer ist das härtere Signal: sie wird bei der
  // DTA-Erzeugung EINMAL vergeben und danach nie geändert (Anlage 1 TP5 V21
  // Kap. 7.3). Ein Status lässt sich zurücksetzen, diese Nummer nicht.
  if (vord.belegnummer) {
    return {
      erlaubt: false,
      grund: `Diese Verordnung wurde bereits an die Kasse übermittelt (Beleg ${vord.belegnummer}). `
           + 'Die verordnete Menge ist festgeschrieben.',
    };
  }
  if (ABGESCHLOSSEN.includes(vord.status)) {
    return {
      erlaubt: false,
      grund: `Verordnung ist „${vord.status}“ — die verordnete Menge lässt sich nicht mehr ändern.`,
    };
  }
  return { erlaubt: true, grund: null };
}

/**
 * Darf die verordnete Menge einer Physio/Ergo-Verordnung korrigiert werden? (Ops #251)
 * Nur Inhaber, nur Physio/Ergo, keine Belegnummer, nicht abgeschlossen.
 *
 * @param {object} rx     Zeile aus `prescriptions`
 * @param {string} rolle  Rolle des angemeldeten Benutzers ('owner', 'employee' etc.)
 * @returns {{erlaubt:boolean, grund:string|null}}
 */
export function physioKorrekturErlaubt(rx, rolle) {
  if (!rx) return { erlaubt: false, grund: 'Verordnung nicht gefunden.' };
  if (rolle !== 'owner') {
    return {
      erlaubt: false,
      grund: 'Nur die Praxisinhaberin oder der Praxisinhaber darf Einheiten korrigieren.',
    };
  }
  if (rx.belegnummer) {
    return {
      erlaubt: false,
      grund: `Diese Verordnung wurde bereits an die Kasse übermittelt (Beleg ${rx.belegnummer}). `
           + 'Die verordnete Menge ist festgeschrieben.',
    };
  }
  const tb = (rx.therapie_bereich || '').toLowerCase();
  if (tb !== 'physio' && tb !== 'ergo') {
    return {
      erlaubt: false,
      grund: 'Einheiten-Korrektur ist nur für Physiotherapie und Ergotherapie vorgesehen.',
    };
  }
  if (ABGESCHLOSSEN.includes(rx.status) || ABGESCHLOSSEN.includes(rx.abrechnung_status)) {
    const st = rx.status || rx.abrechnung_status;
    return {
      erlaubt: false,
      grund: `Verordnung ist „${st}“ — die verordnete Menge lässt sich nicht mehr ändern.`,
    };
  }
  return { erlaubt: true, grund: null };
}

/**
 * Prüft eine neue Menge, bevor geschrieben wird (Podologie).
 *
 * @param {number} neu
 * @param {number} erbracht  Zahl der dokumentierten Behandlungen
 * @returns {string|null} Fehlertext oder null
 */
export function pruefeNeueMenge(neu, erbracht) {
  if (!Number.isFinite(neu) || neu < 1) return 'Mindestens 1 Behandlungseinheit.';
  if (neu > 60) return 'Mehr als 60 Einheiten je Verordnung sind nicht vorgesehen.';
  // Unter die schon erbrachten Einheiten zu gehen, würde eine Verordnung
  // erzeugen, die mehr geleistet hat als verordnet war — genau der Zustand,
  // den die Übersicht rot anzeigt, und in der Abrechnung eine Absetzung.
  if (Number.isFinite(erbracht) && erbracht > 0 && neu < erbracht) {
    return `${erbracht} Behandlung${erbracht > 1 ? 'en sind' : ' ist'} bereits dokumentiert — `
         + `weniger als ${erbracht} Einheiten sind nicht möglich.`;
  }
  return null;
}

/**
 * Prüft die neue Menge für Physio/Ergo (Ops #251).
 * Nur Reduzierung (neu < alt), Doppelbehandlung: 1 Termin = 2 Einheiten (ceil(neu/2)).
 *
 * @param {number} neu
 * @param {object} opts
 * @param {number} opts.alt
 * @param {number} [opts.erbrachteTermine=0]
 * @param {boolean} [opts.doppelbehandlung=false]
 * @returns {string|null} Fehlertext oder null
 */
export function pruefePhysioMenge(neu, { alt, erbrachteTermine = 0, doppelbehandlung = false } = {}) {
  if (!Number.isFinite(neu) || neu < 1) return 'Mindestens 1 Behandlungseinheit.';
  if (neu > 60) return 'Mehr als 60 Einheiten je Verordnung sind nicht vorgesehen.';
  if (Number.isFinite(alt) && neu >= alt) {
    return `Die neue Einheitenzahl muss kleiner als die bisherige (${alt}) sein.`;
  }
  const done = Number.isFinite(erbrachteTermine) ? erbrachteTermine : 0;
  const zielTermine = doppelbehandlung ? Math.ceil(neu / 2) : neu;
  if (done > 0 && zielTermine < done) {
    return `${done} Termin${done > 1 ? 'e sind' : ' ist'} bereits erbracht — weniger Einheiten sind nicht möglich.`;
  }
  return null;
}

/**
 * Die neue Menge speichern (Podologie).
 *
 * @param {object} supabase
 * @param {object} opts
 * @param {string} opts.vordId
 * @param {number} opts.neu
 * @returns {Promise<{ok:boolean, fehler?:string}>}
 */
export async function speichereEinheiten(supabase, { vordId, neu }) {
  const { data, error } = await supabase
    .from('prescriptions')
    .update({ anzahl_einheiten: neu })
    .eq('id', vordId)
    .eq('therapie_bereich', 'podo')
    .select('id, anzahl_einheiten');

  if (error) {
    console.error('[verordnung-einheiten]', error);
    return { ok: false, fehler: error.message };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      fehler: 'Die Änderung wurde nicht gespeichert — vermutlich fehlt die Berechtigung. '
            + 'Das Ändern der verordneten Menge ist Sache der Praxisinhaberin oder des Praxisinhabers.',
    };
  }
  return { ok: true };
}

/**
 * Revisionssichere Einheiten-Korrektur für Physio/Ergo über RPC (Ops #251).
 *
 * @param {object} supabase
 * @param {object} opts
 * @param {string} opts.rxId
 * @param {number} opts.neu
 * @param {string} opts.grund
 * @param {number|null} [opts.heilmittelIndex=null]
 * @returns {Promise<{ok:boolean, data?:object, fehler?:string}>}
 */
export async function korrigierePhysioEinheiten(supabase, { rxId, neu, grund, heilmittelIndex = null }) {
  if (!grund || grund.trim().length < 5) {
    return { ok: false, fehler: 'Begründung (mindestens 5 Zeichen) erforderlich.' };
  }
  if (!supabase || typeof supabase.rpc !== 'function') {
    return { ok: false, fehler: 'Datenbankverbindung nicht verfügbar.' };
  }

  const { data, error } = await supabase.rpc('einheiten_korrigieren', {
    p_id: rxId,
    p_neu: neu,
    p_grund: grund.trim(),
    p_heilmittel_index: (heilmittelIndex === null || heilmittelIndex === undefined) ? null : Number(heilmittelIndex),
  });

  if (error) {
    console.error('[korrigierePhysioEinheiten]', error);
    let fehler = error.message;
    if (error.code === '42883' || /function .* does not exist/i.test(error.message)) {
      fehler = 'Die Funktion zur Einheiten-Korrektur ist auf dem Server noch nicht verfügbar (Migration 0100 steht aus).';
    }
    return { ok: false, fehler, code: error.code };
  }
  return { ok: true, data };
}

/**
 * Bestehenden Termin über Buchungsmaske öffnen.
 *
 * @param {object} supabase
 * @param {string} bookingId
 */
export async function oeffneTerminBearbeiten(supabase, bookingId) {
  if (!supabase || !bookingId) return;
  const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (error || !data) {
    console.error('[verordnung-einheiten] Termin laden:', error);
    return;
  }
  if (typeof window !== 'undefined' && typeof window.openBookingModal === 'function') {
    window.openBookingModal(data);
  }
}

/**
 * Fragedialog für Zuzahlungsanpassung nach Einheiten-Korrektur.
 */
function zeigeZuzahlungPromptDialog({ supabase, rx, apiBase, toast }) {
  document.getElementById('_peZkPromptModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_peZkPromptModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" style="background:var(--bg-card-solid,#1f2937);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:380px;width:100%;color:var(--text-main);font-family:inherit;box-sizing:border-box;">
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:var(--text-main);">Zuzahlung anpassen?</div>
      <div style="font-size:13px;color:var(--text-muted);line-height:1.4;margin-bottom:16px;">
        Die verordneten Einheiten wurden reduziert. Möchten Sie die Zuzahlung für diese Verordnung anpassen?
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" data-pe-zk-spaeter style="min-height:44px;padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-main);font-size:13px;cursor:pointer;">Später</button>
        <button type="button" data-pe-zk-anpassen class="btn-primary" style="min-height:44px;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Zuzahlung anpassen</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const schliessen = () => {
    document.removeEventListener('keydown', onEsc);
    overlay.remove();
  };
  const onEsc = (e) => { if (e.key === 'Escape') schliessen(); };
  document.addEventListener('keydown', onEsc);

  overlay.querySelector('[data-pe-zk-spaeter]').onclick = () => schliessen();
  overlay.onclick = (e) => { if (e.target === overlay) schliessen(); };

  overlay.querySelector('[data-pe-zk-anpassen]').onclick = () => {
    schliessen();
    const p = rx.leads || {};
    const patientName = [p.first_name, p.last_name].filter(Boolean).join(' ') || rx.patient_name || '';
    oeffneZuzahlungKorrektur({
      supabase,
      apiBase,
      prescriptionId: rx.id,
      patientName,
      toast,
    });
  };
}

/**
 * Ergebnisdialog, wenn Termine an überzähligen Einheiten hängen.
 */
function zeigeTerminOffenDialog({ supabase, rx, terminOffen, apiBase, toast }) {
  document.getElementById('_peOffenModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_peOffenModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

  const n = terminOffen.length;
  const hatZuzahlung = (rx.zuzahlung_kassiert_am || Number(rx.zuzahlung_eur) > 0) && !rx.belegnummer;

  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" style="background:var(--bg-card-solid,#1f2937);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:380px;width:100%;color:var(--text-main);font-family:inherit;box-sizing:border-box;max-height:90vh;overflow-y:auto;">
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:var(--warning,#f59e0b);">Überzählige Termine prüfen</div>
      <div style="font-size:13px;color:var(--text-main);line-height:1.4;margin-bottom:14px;">
        Es hängen noch ${n} Termine an überzähligen Einheiten. Bitte Termine absagen oder verschieben.
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
        ${terminOffen.map(item => `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-main,#111827);border-radius:6px;border:1px solid var(--border);">
            <span style="font-size:13px;font-weight:600;">Sitzung ${item.session_number}</span>
            <button type="button" data-pe-open-booking="${esc(item.booking_id)}" style="min-height:44px;min-width:44px;font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);cursor:pointer;display:inline-flex;align-items:center;">Termin öffnen →</button>
          </div>
        `).join('')}
      </div>

      ${hatZuzahlung ? `
        <div style="margin-bottom:16px;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-main,#111827);">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Zuzahlung anpassen</div>
          <button type="button" data-pe-zk-anpassen style="min-height:44px;width:100%;padding:8px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;cursor:pointer;">Zuzahlung anpassen →</button>
        </div>
      ` : ''}

      <div style="display:flex;justify-content:flex-end;">
        <button type="button" data-pe-offen-schliessen class="btn-primary" style="min-height:44px;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Schließen</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const schliessen = () => {
    document.removeEventListener('keydown', onEsc);
    overlay.remove();
  };
  const onEsc = (e) => { if (e.key === 'Escape') schliessen(); };
  document.addEventListener('keydown', onEsc);

  overlay.querySelector('[data-pe-offen-schliessen]').onclick = () => schliessen();
  overlay.onclick = (e) => { if (e.target === overlay) schliessen(); };

  overlay.querySelectorAll('[data-pe-open-booking]').forEach(btn => {
    btn.onclick = () => oeffneTerminBearbeiten(supabase, btn.dataset.peOpenBooking);
  });

  if (hatZuzahlung) {
    overlay.querySelector('[data-pe-zk-anpassen]')?.addEventListener('click', () => {
      schliessen();
      const p = rx.leads || {};
      const patientName = [p.first_name, p.last_name].filter(Boolean).join(' ') || rx.patient_name || '';
      oeffneZuzahlungKorrektur({
        supabase,
        apiBase,
        prescriptionId: rx.id,
        patientName,
        toast,
      });
    });
  }
}

/**
 * Öffnet den Korrekturdialog für Physio/Ergo (Ops #251).
 *
 * @param {object} opts
 * @param {object} opts.supabase
 * @param {object} opts.rx
 * @param {string} opts.rolle
 * @param {()=>Promise<void>} [opts.onFertig]
 * @param {string} [opts.apiBase]
 * @param {Function} [opts.toast]
 */
export async function oeffnePhysioEinheitenDialog({
  supabase,
  rx,
  rolle,
  onFertig,
  apiBase,
  toast = (msg, typ) => {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(msg, typ);
    }
  },
}) {
  const riegel = physioKorrekturErlaubt(rx, rolle);
  if (!riegel.erlaubt) {
    toast(riegel.grund, 'error');
    return false;
  }

  const multi = Array.isArray(rx.heilmittel_items) && rx.heilmittel_items.length > 0 && rx.heilmittel_items[0]?.einheiten != null;
  let sessions = Array.isArray(rx.prescription_sessions) ? rx.prescription_sessions : [];
  if (!sessions.length && supabase) {
    try {
      const { data } = await supabase.from('prescription_sessions')
        .select('id, session_number, status, booking_id, heilmittel_index')
        .eq('prescription_id', rx.id);
      if (data) sessions = data;
    } catch (_) {}
  }

  function getItemInfo(idx) {
    if (multi) {
      const it = rx.heilmittel_items[idx] || {};
      const done = sessions.filter(s => (s.heilmittel_index ?? 0) === idx && (s.status === 'done' || s.status === 'completed')).length;
      return {
        alt: Number(it.einheiten) || 0,
        erbracht: done,
        doppel: Boolean(it.doppelbehandlung),
        name: it.bezeichnung || it.code || `Heilmittel ${idx + 1}`,
      };
    } else {
      const done = sessions.filter(s => s.status === 'done' || s.status === 'completed').length;
      return {
        alt: Number(rx.vorrangig_einheiten || rx.anzahl_einheiten) || 0,
        erbracht: done,
        doppel: Boolean(rx.doppelbehandlung),
        name: rx.heilmittel || rx.heilmittel_position || 'Heilmittel',
      };
    }
  }

  let currentIndex = 0;
  let info = getItemInfo(0);

  document.getElementById('_peModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_peModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" style="background:var(--bg-card-solid,#1f2937);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:380px;width:100%;color:var(--text-main);font-family:inherit;box-sizing:border-box;max-height:90vh;overflow-y:auto;">
      <div style="font-size:16px;font-weight:700;margin-bottom:12px;color:var(--text-main);">Verordnete Einheiten korrigieren</div>

      <div style="font-size:12px;color:var(--text-muted);line-height:1.4;margin-bottom:14px;padding:8px 10px;background:var(--bg-main,#111827);border-radius:8px;border:1px solid var(--border);">
        Nur zur Korrektur eines Übertragungsfehlers gegenüber dem Original-Rezept. Änderungen der Verordnung selbst nimmt nur die verordnende Ärztin / der verordnende Arzt vor.
      </div>

      ${multi ? `
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Heilmittel auswählen</label>
          <select data-pe-select style="width:100%;min-height:44px;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;">
            ${rx.heilmittel_items.map((it, i) => `<option value="${i}">${esc(it.bezeichnung || it.code || `Heilmittel ${i+1}`)} (${it.einheiten || '?'} EH)</option>`).join('')}
          </select>
        </div>
      ` : `
        <div style="margin-bottom:10px;font-size:13px;font-weight:600;color:var(--text-main);">${esc(info.name)}</div>
      `}

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:13px;padding:6px 0;border-bottom:1px solid var(--border);">
        <span style="color:var(--text-muted);">Aktuelle Einheiten:</span>
        <span data-pe-alt style="font-weight:700;font-size:14px;">${info.alt}</span>
      </div>

      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Neue Einheiten (nur Reduzierung)</label>
        <input type="number" data-pe-neu min="1" max="${Math.max(1, info.alt - 1)}" placeholder="z. B. ${Math.max(1, info.alt - 1)}" style="width:100%;min-height:44px;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;box-sizing:border-box;">
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Begründung <span style="color:var(--danger,#ef4444);">*</span></label>
        <textarea data-pe-grund rows="3" placeholder="Grund für die Korrektur (mind. 5 Zeichen)..." style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;resize:vertical;box-sizing:border-box;"></textarea>
      </div>

      <div data-pe-fehler style="display:none;color:var(--danger,#ef4444);font-size:12px;line-height:1.3;margin-bottom:12px;padding:6px 8px;border-radius:6px;background:rgba(239,68,68,0.1);border:1px solid var(--danger,#ef4444);"></div>

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" data-pe-cancel style="min-height:44px;padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-main);font-size:13px;cursor:pointer;">Abbrechen</button>
        <button type="button" data-pe-submit class="btn-primary" style="min-height:44px;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Korrigieren</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const $ = (sel) => overlay.querySelector(sel);
  const fehlerEl = $('[data-pe-fehler]');
  const neuInput = $('[data-pe-neu]');
  const grundEl = $('[data-pe-grund]');
  const submitBtn = $('[data-pe-submit]');
  const cancelBtn = $('[data-pe-cancel]');
  const selectEl = $('[data-pe-select]');
  const altEl = $('[data-pe-alt]');

  const zeigeFehler = (t) => {
    fehlerEl.textContent = t;
    fehlerEl.style.display = t ? '' : 'none';
  };

  if (grundEl) {
    grundEl.addEventListener('input', () => {
      if (fehlerEl && fehlerEl.style.display !== 'none') {
        zeigeFehler('');
      }
    });
  }
  if (neuInput) {
    neuInput.addEventListener('input', () => {
      if (fehlerEl && fehlerEl.style.display !== 'none' && !fehlerEl.textContent.includes('Begründung')) {
        zeigeFehler('');
      }
    });
  }

  const updateState = () => {
    if (multi && selectEl) {
      currentIndex = parseInt(selectEl.value, 10) || 0;
    }
    info = getItemInfo(currentIndex);
    if (altEl) altEl.textContent = String(info.alt);
    if (neuInput) {
      const maxVal = Math.max(1, info.alt - 1);
      neuInput.max = String(maxVal);
      neuInput.placeholder = `z. B. ${maxVal}`;
      neuInput.value = '';
    }
    zeigeFehler('');
  };

  if (selectEl) {
    selectEl.addEventListener('change', updateState);
  }

  const schliessen = (ergebnis = false) => {
    document.removeEventListener('keydown', onEsc);
    overlay.remove();
    return ergebnis;
  };
  const onEsc = (e) => { if (e.key === 'Escape') schliessen(false); };
  document.addEventListener('keydown', onEsc);

  cancelBtn.onclick = () => schliessen(false);
  overlay.onclick = (e) => { if (e.target === overlay) schliessen(false); };

  submitBtn.onclick = async () => {
    const neuVal = parseInt(neuInput.value, 10);
    const grundVal = grundEl.value.trim();

    const pruefFehler = pruefePhysioMenge(neuVal, {
      alt: info.alt,
      erbrachteTermine: info.erbracht,
      doppelbehandlung: info.doppel,
    });
    if (pruefFehler) {
      zeigeFehler(pruefFehler);
      return;
    }
    if (!grundVal || grundVal.length < 5) {
      zeigeFehler('Begründung (mindestens 5 Zeichen) erforderlich.');
      return;
    }

    zeigeFehler('');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Korrigiert…';

    const res = await korrigierePhysioEinheiten(supabase, {
      rxId: rx.id,
      neu: neuVal,
      grund: grundVal,
      heilmittelIndex: multi ? currentIndex : null,
    });

    if (!res.ok) {
      zeigeFehler(res.fehler || 'Korrektur fehlgeschlagen.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Korrigieren';
      return;
    }

    schliessen(true);
    toast('Einheiten erfolgreich korrigiert.', 'success');

    emit('verordnungen:changed', { id: rx.id, anzahl_einheiten: res.data?.neu });
    emit('bookings:changed', { verordnungId: rx.id });

    if (typeof onFertig === 'function') {
      try { await onFertig(); } catch (_) {}
    }

    const terminOffen = Array.isArray(res.data?.termin_offen) ? res.data.termin_offen : [];
    if (terminOffen.length > 0) {
      zeigeTerminOffenDialog({ supabase, rx, terminOffen, apiBase, toast });
    } else if ((rx.zuzahlung_kassiert_am || Number(rx.zuzahlung_eur) > 0) && !rx.belegnummer) {
      zeigeZuzahlungPromptDialog({ supabase, rx, apiBase, toast });
    }
  };
}

