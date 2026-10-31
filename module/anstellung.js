/**
 * anstellung.js — Beschäftigung und Urlaubsanspruch je Mitarbeiter (Physio/PILOT-PLAN.md M5).
 *
 * Verwaltet Anstellungsart (Vollzeit/Teilzeit), Wochenstunden und Jahresurlaubsanspruch.
 * Regeln: UI-Text nur Deutsch, Dark-Theme CSS-Variablen, jede Eingabe escapen.
 */

const STANDARD_ARBEITSTAGE = new Set([1, 2, 3, 4, 5]);

/**
 * Escapet HTML-Sonderzeichen.
 * @param {any} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

/**
 * Zählt Tage von von bis bis einschließlich, die in arbeitstage liegen.
 * von und bis dürfen reines Datum '2026-11-02' oder Zeitstempel '2026-11-02T00:00:00+00:00' sein:
 * es zählt immer die ersten 10 Zeichen, gerechnet in UTC, damit Sommerzeit nichts verschiebt.
 * Ungültige Eingabe liefert 0. arbeitstage leer oder fehlend: Montag bis Freitag.
 *
 * @param {string} von
 * @param {string} bis
 * @param {Set<number>} [arbeitstage] 0 = Sonntag, 1 = Montag, ..., 6 = Samstag
 * @returns {number}
 */
export function arbeitstageImZeitraum(von, bis, arbeitstage) {
  if (!von || !bis) return 0;

  const vonStr = String(von).slice(0, 10);
  const bisStr = String(bis).slice(0, 10);

  const datumRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!datumRegex.test(vonStr) || !datumRegex.test(bisStr)) return 0;

  const [vy, vm, vd] = vonStr.split('-').map(Number);
  const [by, bm, bd] = bisStr.split('-').map(Number);

  const cur = new Date(Date.UTC(vy, vm - 1, vd));
  const end = new Date(Date.UTC(by, bm - 1, bd));

  if (isNaN(cur.getTime()) || isNaN(end.getTime())) return 0;
  if (cur.getUTCFullYear() !== vy || cur.getUTCMonth() !== vm - 1 || cur.getUTCDate() !== vd) return 0;
  if (end.getUTCFullYear() !== by || end.getUTCMonth() !== bm - 1 || end.getUTCDate() !== bd) return 0;
  if (cur > end) return 0;

  let tageSet = arbeitstage;
  if (!tageSet || !(tageSet instanceof Set) || tageSet.size === 0) {
    if (Array.isArray(arbeitstage) && arbeitstage.length > 0) {
      tageSet = new Set(arbeitstage);
    } else {
      tageSet = STANDARD_ARBEITSTAGE;
    }
  }

  let count = 0;
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (tageSet.has(day)) {
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/**
 * Liest working_hours (day_of_week, is_active) des Mitarbeiters, liefert Set der aktiven Tage.
 * Keine Zeilen oder Fehler: Montag bis Freitag. Wirft nie.
 *
 * @param {{ supabase: object, empId: string }} params
 * @returns {Promise<Set<number>>}
 */
export async function ladeArbeitstage({ supabase, empId }) {
  const STANDARD = new Set([1, 2, 3, 4, 5]);
  try {
    if (!supabase || !empId) {
      return new Set(STANDARD);
    }
    const { data, error } = await supabase
      .from('working_hours')
      .select('day_of_week, is_active')
      .eq('user_id', empId);

    if (error || !data || data.length === 0) {
      return new Set(STANDARD);
    }

    const aktive = data.filter(w => w && w.is_active);
    return new Set(aktive.map(w => w.day_of_week));
  } catch {
    return new Set(STANDARD);
  }
}

/**
 * Rein. Zählt nur Einträge mit type === 'urlaub'.
 * Liefert { anspruch, verbraucht, rest }, rest nie negativ.
 *
 * @param {{ abwesenheiten?: Array<object>, anspruch?: number, arbeitstage?: Set<number> }} params
 * @returns {{ anspruch: number, verbraucht: number, rest: number }}
 */
export function urlaubsKennzahlen({ abwesenheiten, anspruch, arbeitstage } = {}) {
  const normierterAnspruch = (typeof anspruch === 'number' && !isNaN(anspruch))
    ? anspruch
    : 30;

  const urlaubListe = Array.isArray(abwesenheiten)
    ? abwesenheiten.filter(a => a && a.type === 'urlaub')
    : [];

  let verbraucht = 0;
  for (const eintrag of urlaubListe) {
    verbraucht += arbeitstageImZeitraum(eintrag.start_date, eintrag.end_date, arbeitstage);
  }

  const rest = Math.max(0, normierterAnspruch - verbraucht);

  return {
    anspruch: normierterAnspruch,
    verbraucht,
    rest,
  };
}

/**
 * maybeSingle auf mitarbeiter_anstellung.
 * Fehler oder keine Zeile: { beschaeftigung: 'vollzeit', wochenstunden: null, urlaub_jahrestage: 30, vorhanden: false }.
 * Sonst Zeile plus vorhanden: true. Wirft nie.
 *
 * @param {{ supabase: object, empId: string }} params
 * @returns {Promise<object>}
 */
export async function ladeAnstellung({ supabase, empId }) {
  const VORGABE = {
    beschaeftigung: 'vollzeit',
    wochenstunden: null,
    urlaub_jahrestage: 30,
    vorhanden: false,
  };

  try {
    if (!supabase || !empId) {
      return { ...VORGABE };
    }
    const { data, error } = await supabase
      .from('mitarbeiter_anstellung')
      .select('*')
      .eq('employee_id', empId)
      .maybeSingle();

    // Lesefehler ist nicht „keine Zeile": Speichern überschriebe sonst echte Vertragswerte mit der Vorgabe.
    if (error) {
      return { ...VORGABE, fehler: true };
    }
    if (!data) {
      return { ...VORGABE };
    }

    return {
      ...data,
      vorhanden: true,
    };
  } catch {
    return { ...VORGABE, fehler: true };
  }
}

/**
 * Rein, liefert { ok: true, werte } oder { ok: false, meldung }.
 * Leere Wochenstunden werden null. Komma als Dezimaltrennzeichen wie '19,5' ist erlaubt.
 * Meldungen auf Deutsch.
 *
 * @param {{ beschaeftigung?: string, wochenstunden?: any, urlaubJahrestage?: any }} params
 * @returns {{ ok: boolean, werte?: object, meldung?: string }}
 */
export function pruefeAnstellung({ beschaeftigung, wochenstunden, urlaubJahrestage } = {}) {
  const b = typeof beschaeftigung === 'string' ? beschaeftigung.trim() : '';
  if (b !== 'vollzeit' && b !== 'teilzeit') {
    return { ok: false, meldung: 'Bitte wählen Sie Vollzeit oder Teilzeit aus.' };
  }

  let cleanWochenstunden = null;
  if (wochenstunden !== null && wochenstunden !== undefined && String(wochenstunden).trim() !== '') {
    const rawStd = String(wochenstunden).trim().replace(',', '.');
    const numStd = Number(rawStd);
    if (isNaN(numStd) || numStd < 0 || numStd > 80) {
      return { ok: false, meldung: 'Wochenstunden müssen zwischen 0 und 80 liegen.' };
    }
    cleanWochenstunden = Math.round(numStd * 10) / 10;
  }

  let cleanTage = 30;
  if (urlaubJahrestage !== undefined) {
    if (urlaubJahrestage === null || String(urlaubJahrestage).trim() === '') {
      return { ok: false, meldung: 'Urlaubsanspruch muss zwischen 0 und 60 Tagen liegen.' };
    }
    const rawTage = String(urlaubJahrestage).trim().replace(',', '.');
    const numTage = Number(rawTage);
    if (isNaN(numTage) || !Number.isInteger(numTage) || numTage < 0 || numTage > 60) {
      return { ok: false, meldung: 'Urlaubsanspruch muss zwischen 0 und 60 Tagen liegen.' };
    }
    cleanTage = numTage;
  }

  return {
    ok: true,
    werte: {
      beschaeftigung: b,
      wochenstunden: cleanWochenstunden,
      urlaub_jahrestage: cleanTage,
      urlaubJahrestage: cleanTage,
    },
  };
}

/**
 * Prüft, dann upsert mit onConflict 'employee_id'.
 * Rückgabe { ok: true } oder { ok: false, meldung }.
 * Datenbankfehler: 'Anstellung konnte nicht gespeichert werden.' Wirft nie.
 *
 * @param {{ supabase: object, ownerId: string, employeeId: string, beschaeftigung: string, wochenstunden: any, urlaubJahrestage: any }} params
 * @returns {Promise<{ ok: boolean, meldung?: string }>}
 */
export async function speichereAnstellung({
  supabase,
  ownerId,
  employeeId,
  beschaeftigung,
  wochenstunden,
  urlaubJahrestage,
}) {
  try {
    if (!ownerId || !employeeId) {
      return { ok: false, meldung: 'Mitarbeiter oder Inhaber fehlt.' };
    }
    const check = pruefeAnstellung({ beschaeftigung, wochenstunden, urlaubJahrestage });
    if (!check.ok) {
      return check;
    }
    if (!supabase) {
      return { ok: false, meldung: 'Anstellung konnte nicht gespeichert werden.' };
    }

    const payload = {
      employee_id: employeeId,
      owner_id: ownerId,
      beschaeftigung: check.werte.beschaeftigung,
      wochenstunden: check.werte.wochenstunden,
      urlaub_jahrestage: check.werte.urlaub_jahrestage,
    };

    const { error } = await supabase
      .from('mitarbeiter_anstellung')
      .upsert(payload, { onConflict: 'employee_id' });

    if (error) {
      return { ok: false, meldung: 'Anstellung konnte nicht gespeichert werden.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, meldung: 'Anstellung konnte nicht gespeichert werden.' };
  }
}

/**
 * Rein. Inhaber: Auswahl Beschäftigung (Vollzeit, Teilzeit), Feld Wochenstunden, Feld Urlaubsanspruch in Tagen, Knopf 'Speichern'.
 * Sonst nur lesbarer Text ohne Eingaben.
 *
 * @param {object} anstellung
 * @param {{ istInhaber?: boolean }} optionen
 * @returns {string} HTML
 */
export function anstellungHtml(anstellung = {}, { istInhaber = false } = {}) {
  const beschaeftigung = anstellung?.beschaeftigung === 'teilzeit' ? 'teilzeit' : 'vollzeit';
  const beschaeftigungLabel = beschaeftigung === 'teilzeit' ? 'Teilzeit' : 'Vollzeit';
  const stundenText = anstellung?.wochenstunden != null
    ? `${String(anstellung.wochenstunden).replace('.', ',')} Std. / Woche`
    : 'Keine Wochenstunden hinterlegt';
  const urlaubTage = anstellung?.urlaub_jahrestage ?? 30;
  const urlaubText = `${urlaubTage} Tage / Jahr`;

  if (!istInhaber) {
    return `
<div class="card anstellung-ansicht" style="padding:16px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;">
  <h4 style="margin:0 0 12px;font-size:14px;font-weight:600;color:var(--text-main);">Anstellung &amp; Urlaub</h4>
  <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
    <div>
      <span style="color:var(--text-muted);">Beschäftigung:</span>
      <strong style="color:var(--text-main);margin-left:6px;">${escapeHtml(beschaeftigungLabel)}</strong>
    </div>
    <div>
      <span style="color:var(--text-muted);">Wochenstunden:</span>
      <span style="color:var(--text-main);margin-left:6px;">${escapeHtml(stundenText)}</span>
    </div>
    <div>
      <span style="color:var(--text-muted);">Jahresurlaub:</span>
      <span style="color:var(--text-main);margin-left:6px;">${escapeHtml(urlaubText)}</span>
    </div>
  </div>
</div>
    `.trim();
  }

  const wochenstundenWert = anstellung?.wochenstunden != null
    ? String(anstellung.wochenstunden).replace('.', ',')
    : '';

  return `
<div class="card anstellung-formular" style="padding:16px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;">
  <h4 style="margin:0 0 12px;font-size:14px;font-weight:600;color:var(--text-main);">Anstellung &amp; Urlaub</h4>
  <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
    <div style="flex:1;min-width:140px;">
      <label class="form-label" for="anstellungBeschaeftigung" style="display:block;margin-bottom:4px;color:var(--text-main);font-size:13px;font-weight:500;">Beschäftigung</label>
      <select id="anstellungBeschaeftigung" class="form-input" style="width:100%;">
        <option value="vollzeit"${beschaeftigung === 'vollzeit' ? ' selected' : ''}>Vollzeit</option>
        <option value="teilzeit"${beschaeftigung === 'teilzeit' ? ' selected' : ''}>Teilzeit</option>
      </select>
    </div>
    <div style="width:120px;">
      <label class="form-label" for="anstellungWochenstunden" style="display:block;margin-bottom:4px;color:var(--text-main);font-size:13px;font-weight:500;">Wochenstunden</label>
      <input type="text" id="anstellungWochenstunden" class="form-input" placeholder="z. B. 38,5" value="${escapeHtml(wochenstundenWert)}" style="width:100%;">
    </div>
    <div style="width:120px;">
      <label class="form-label" for="anstellungUrlaubJahrestage" style="display:block;margin-bottom:4px;color:var(--text-main);font-size:13px;font-weight:500;">Urlaub (Tage)</label>
      <input type="number" id="anstellungUrlaubJahrestage" class="form-input" min="0" max="60" value="${escapeHtml(urlaubTage)}" style="width:100%;">
    </div>
    <button type="button" id="anstellungSpeichernBtn" class="btn-primary" style="height:36px;white-space:nowrap;">Speichern</button>
  </div>
  <div class="form-hint" style="margin-top:8px;font-size:12px;color:var(--text-muted);">Vertragliche Arbeitszeit und Urlaubsanspruch in Tagen pro Kalenderjahr.</div>
</div>
  `.trim();
}

/**
 * Baut die Oberfläche, lädt, speichert, ruft nach Erfolg nachSpeichern() auf.
 * Fehler stören den Rest der Seite nicht.
 *
 * @param {HTMLElement|object} container
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {string} deps.ownerId
 * @param {string} deps.empId
 * @param {boolean} [deps.istInhaber]
 * @param {(msg: string, typ?: string) => void} [deps.showToast]
 * @param {() => Promise<void>|void} [deps.nachSpeichern]
 */
export async function mountAnstellung(container, deps = {}) {
  if (!container) return;
  const {
    supabase,
    ownerId,
    empId,
    istInhaber = false,
    showToast = () => {},
    nachSpeichern = () => {},
  } = deps;

  try {
    const anstellung = await ladeAnstellung({ supabase, empId });
    if (anstellung.fehler) {
      container.innerHTML = '<p class="form-hint">Anstellung ist gerade nicht verfügbar.</p>';
      return;
    }
    container.innerHTML = anstellungHtml(anstellung, { istInhaber });

    if (!istInhaber) return;

    const btn = typeof container.querySelector === 'function'
      ? container.querySelector('#anstellungSpeichernBtn')
      : null;
    const beschaeftigungEl = typeof container.querySelector === 'function'
      ? container.querySelector('#anstellungBeschaeftigung')
      : null;
    const stundenEl = typeof container.querySelector === 'function'
      ? container.querySelector('#anstellungWochenstunden')
      : null;
    const urlaubEl = typeof container.querySelector === 'function'
      ? container.querySelector('#anstellungUrlaubJahrestage')
      : null;

    if (btn && beschaeftigungEl && stundenEl && urlaubEl) {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const res = await speichereAnstellung({
            supabase,
            ownerId,
            employeeId: empId,
            beschaeftigung: beschaeftigungEl.value,
            wochenstunden: stundenEl.value,
            urlaubJahrestage: urlaubEl.value,
          });

          if (!res.ok) {
            showToast(res.meldung, 'error');
            return;
          }

          showToast('Anstellung gespeichert ✓');
          try {
            await nachSpeichern();
          } catch {
            // Nachspeichern-Fehler ignorieren
          }
        } catch {
          showToast('Anstellung konnte nicht gespeichert werden.', 'error');
        } finally {
          btn.disabled = false;
        }
      });
    }
  } catch {
    // Fehler stören den Rest der Seite nicht
  }
}
