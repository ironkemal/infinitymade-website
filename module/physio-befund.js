/**
 * physio-befund.js — UI-Modul fuer den physiotherapeutischen Befund in der Patientenakte.
 *
 * Verwaltet Erstbefund, Zwischenbefund und Abschlussbefund (Listen-, Lese- und Formularmodus).
 * Schreibt Datensaetze nach `physio_befunde` und Messwerte nach `messreihen`.
 *
 * Touch-optimiert fuer Tablet (Touch-Ziele >= 44px, Chips statt Dropdowns).
 * Reines Vanilla JS, keine Fremdbibliotheken, Farbwahl ueber CSS-Variablen.
 */

'use strict';

import {
  FORM_VERSION,
  BEFUNDARTEN,
  REGIONEN,
  SEITEN,
  NRS_ZEITEN,
  CHARAKTER,
  INSPEKTION,
  PALPATION,
  ROM_BEWEGUNGEN,
  KRAFT_GRUPPEN,
  TESTS,
  ADL,
  ZIEL_VORSCHLAEGE,
  MASSNAHMEN,
  VERLAUF,
  ZIEL_ERREICHT,
} from './physio-befund-katalog.js';

import {
  neuerBefundZustand,
  validiere,
  baueDaten,
  baueMessreihenZeilen,
  leseMesswerte,
  uebernehmeVonVorbefund,
} from './physio-befund-logik.js';

/**
 * HTML-Escaping fuer sichere Textausgabe.
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Schrittfunktion fuer den ROM-5-Grad-Stepper (oder beliebige Schritte).
 *
 * @param {number|string|null} aktuell Aktueller Wert
 * @param {number} delta Schrittweite (+5, -5)
 * @param {number} [min=0] Minimalwert
 * @param {number} [max=360] Maximalwert
 * @returns {number} Neuer berechneter Wert im Bereich [min, max]
 */
export function schrittWert(aktuell, delta, min = 0, max = 360) {
  const num = (aktuell === null || aktuell === undefined || aktuell === '' || Number.isNaN(Number(aktuell)))
    ? 0
    : Number(aktuell);
  const neu = num + delta;
  if (min !== undefined && min !== null && neu < min) return min;
  if (max !== undefined && max !== null && neu > max) return max;
  return neu;
}

/**
 * Ermittelt den naechsten Zustand im Dreifach-Schalter fuer klinische Tests.
 * Zyklus: nicht getestet ('nicht') -> positiv ('plus') -> negativ ('minus') -> 'nicht'.
 *
 * @param {string|null} wert Aktueller Wert ('plus', 'minus', 'nicht' oder null)
 * @returns {'plus'|'minus'|'nicht'}
 */
export function naechsterTestWert(wert) {
  if (wert === 'plus') return 'minus';
  if (wert === 'minus') return 'nicht';
  return 'plus';
}

/**
 * Formatiert eine Zeile der Befundliste fuer Anzeigezwecke.
 *
 * @param {object} befund Befundobjekt aus physio_befunde
 * @returns {{ artLabel: string, datumStr: string, regionenStr: string, nrsStr: string, text: string }}
 */
export function befundListenZeile(befund) {
  if (!befund || typeof befund !== 'object') {
    return { artLabel: 'Befund', datumStr: '—', regionenStr: '', nrsStr: '', text: 'Befund' };
  }

  const artObj = BEFUNDARTEN.find(b => b.id === befund.befundart);
  const artLabel = artObj ? artObj.label : (befund.befundart || 'Befund');

  let datumStr = '—';
  if (befund.befund_datum) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(befund.befund_datum));
    datumStr = m ? `${m[3]}.${m[2]}.${m[1]}` : String(befund.befund_datum);
  }

  let regionen = [];
  if (Array.isArray(befund.daten?.bericht?.regionen) && befund.daten.bericht.regionen.length > 0) {
    regionen = befund.daten.bericht.regionen;
  } else if (befund.daten?.regionen && typeof befund.daten.regionen === 'object') {
    regionen = Object.keys(befund.daten.regionen).map(k => {
      const rk = REGIONEN.find(r => r.id === k || r.label === k);
      return rk ? rk.label : k;
    });
  }
  const regionenStr = regionen.join(', ');

  let nrsStr = '';
  if (befund.kurzNrs !== undefined && befund.kurzNrs !== null && befund.kurzNrs !== '') {
    nrsStr = `NRS ${befund.kurzNrs}`;
  } else if (befund.nrs !== undefined && befund.nrs !== null && befund.nrs !== '') {
    nrsStr = `NRS ${befund.nrs}`;
  } else if (Array.isArray(befund.messungen) && befund.messungen.length > 0) {
    const vas = befund.messungen.find(m => m.typ === 'VAS');
    if (vas && vas.wert !== null && vas.wert !== undefined) {
      nrsStr = `NRS ${vas.wert}`;
    }
  }

  const teile = [artLabel, datumStr];
  if (regionenStr) teile.push(regionenStr);
  if (nrsStr) teile.push(nrsStr);
  const text = teile.join(' · ');

  return {
    artLabel,
    datumStr,
    regionenStr,
    nrsStr,
    text,
  };
}

/** Merkt sich die letzte leadId modulweit zur Erkennung von Patientenwechseln. */
let letzteLeadId = null;

/**
 * Verdrahtet den Befund-Reiter in der Patientenakte.
 *
 * @param {object} deps Abhaengigkeiten
 * @param {object} deps.supabase Supabase-Client
 * @param {Function|string} deps.getOwnerId Mandanten-ID
 * @param {Function|string} deps.getLeadId Patienten-ID
 * @param {Function|string} deps.userId Aktueller Benutzer
 * @param {Function} deps.showToast Toast-Benachrichtigung
 * @param {Function} [deps.getBusinessId] Business-ID
 * @param {Function} [deps.getTherapeutName] Name des Therapeuten
 * @param {Document} [doc=document] DOM-Wurzel
 */
export function verdrahtePhysioBefund(deps, doc = document) {
  const tab = doc.querySelector('.pd-tab[data-tab="befund"]');
  if (!tab) return;
  if (tab.dataset.pdBefundWacht) return;
  tab.dataset.pdBefundWacht = '1';

  async function ladeUndZeichne() {
    const host = doc.getElementById('pdBefundHost');
    if (!host) return;

    const leadId = typeof deps?.getLeadId === 'function' ? deps.getLeadId() : deps?.getLeadId;
    const ownerId = typeof deps?.getOwnerId === 'function' ? deps.getOwnerId() : deps?.getOwnerId;
    if (!leadId || !ownerId) {
      host.innerHTML = '<div class="pd-empty" style="padding:24px;text-align:center;color:var(--text-muted);">Kein Patient ausgewählt.</div>';
      letzteLeadId = null;
      return;
    }

    // Bei Lead-Wechsel Host leeren und neu laden
    if (letzteLeadId !== leadId) {
      letzteLeadId = leadId;
      host.innerHTML = '';
    }

    await zeigeUebersicht(host, deps, { ownerId, leadId });
  }

  tab.addEventListener('click', () => {
    ladeUndZeichne();
  });
}

/**
 * Laedt alle aktuellen Befunde des Patienten und rendert die Listenansicht.
 */
async function zeigeUebersicht(host, deps, { ownerId, leadId }) {
  host.innerHTML = `
    <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:14px;">
      <div class="spinner-sm" style="display:inline-block;vertical-align:middle;margin-right:8px;"></div>
      Befunde werden geladen...
    </div>
  `;

  try {
    const { data: befunde, error } = await deps.supabase
      .from('physio_befunde')
      .select('id, owner_id, business_id, lead_id, prescription_id, eintrag_id, version, ist_aktuell, befundart, befund_datum, therapeut_id, daten, form_version, created_by, created_at')
      .eq('owner_id', ownerId)
      .eq('lead_id', leadId)
      .eq('ist_aktuell', true)
      .order('befund_datum', { ascending: false });

    if (error) throw error;

    // Messwerte (VAS fuer Kurz-NRS) laden
    const befundIds = (befunde || []).map(b => b.id);
    const vasMap = {};
    if (befundIds.length > 0) {
      const { data: messRows } = await deps.supabase
        .from('messreihen')
        .select('befund_id, wert, koerperteil, typ')
        .eq('owner_id', ownerId)
        .eq('lead_id', leadId)
        .in('befund_id', befundIds)
        .eq('typ', 'VAS');
      if (messRows) {
        for (const r of messRows) {
          if (!vasMap[r.befund_id]) vasMap[r.befund_id] = [];
          vasMap[r.befund_id].push(r);
        }
      }
    }

    const befundeMitMessung = (befunde || []).map(b => {
      const messungen = vasMap[b.id] || [];
      const vasRow = messungen.find(m => m.typ === 'VAS');
      return {
        ...b,
        messungen,
        kurzNrs: vasRow ? vasRow.wert : null,
      };
    });

    renderListenAnsicht(host, deps, { ownerId, leadId, befunde: befundeMitMessung });
  } catch (err) {
    host.innerHTML = `
      <div style="padding:20px;color:var(--danger);background:var(--danger-dim);border:1px solid var(--danger);border-radius:8px;">
        Fehler beim Laden der Befunde: ${escapeHtml(err?.message || err)}
      </div>
    `;
  }
}

/**
 * Rendert die Listenansicht (mit Knoepfen fuer Neu/Zwischen/Abschluss).
 */
function renderListenAnsicht(host, deps, { ownerId, leadId, befunde }) {
  const hatBefunde = befunde.length > 0;
  const hatErst = befunde.some(b => b.befundart === 'erst');
  const juengster = hatBefunde ? befunde[0] : null;

  host.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px;">
      <div>
        <h3 style="margin:0;font-size:17px;font-weight:600;color:var(--text-main);">Physiotherapeutische Befunde</h3>
        <p style="margin:2px 0 0;font-size:13px;color:var(--text-muted);">Erfassung nach Neutral-Null-ROM, MFT-Kraft und klinischen Tests</p>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        ${!hatErst ? `
          <button type="button" class="btn btn-primary" id="btnNeuerErstbefund" style="min-height:44px;padding:0 18px;font-weight:600;">
            + Erstbefund erfassen
          </button>
        ` : ''}
        ${hatBefunde ? `
          <button type="button" class="btn btn-primary" id="btnNeuerZwischenbefund" style="min-height:44px;padding:0 16px;font-weight:500;">
            + Zwischenbefund
          </button>
          <button type="button" class="btn btn-secondary" id="btnNeuerAbschlussbefund" style="min-height:44px;padding:0 16px;font-weight:500;">
            + Abschlussbefund
          </button>
        ` : ''}
      </div>
    </div>
    <div id="pdBefundListeContainer"></div>
  `;

  const btnErst = host.querySelector('#btnNeuerErstbefund');
  if (btnErst) {
    btnErst.addEventListener('click', () => {
      starteFormular(host, deps, { ownerId, leadId, befundart: 'erst', vorBefund: null });
    });
  }

  const btnZwischen = host.querySelector('#btnNeuerZwischenbefund');
  if (btnZwischen) {
    btnZwischen.addEventListener('click', () => {
      starteFormular(host, deps, { ownerId, leadId, befundart: 'zwischen', vorBefund: juengster });
    });
  }

  const btnAbschluss = host.querySelector('#btnNeuerAbschlussbefund');
  if (btnAbschluss) {
    btnAbschluss.addEventListener('click', () => {
      starteFormular(host, deps, { ownerId, leadId, befundart: 'abschluss', vorBefund: juengster });
    });
  }

  const container = host.querySelector('#pdBefundListeContainer');

  if (!hatBefunde) {
    container.innerHTML = `
      <div style="border:1px dashed var(--border);border-radius:12px;padding:36px 20px;text-align:center;background:var(--bg-card-solid);color:var(--text-muted);">
        <p style="margin:0 0 16px 0;font-size:15px;color:var(--text-main);font-weight:500;">
          Noch kein Befund für diesen Patienten erfasst.
        </p>
        <p style="margin:0 0 20px 0;font-size:13px;color:var(--text-muted);">
          Legen Sie einen Erstbefund an, um Regionen, Schmerzskala (NRS), Beweglichkeit und Behandlungsziele zu dokumentieren.
        </p>
        <button type="button" class="btn btn-primary" id="btnErstEmpty" style="min-height:44px;padding:0 24px;font-weight:600;">
          Erstbefund erfassen
        </button>
      </div>
    `;
    const btnEmpty = container.querySelector('#btnErstEmpty');
    if (btnEmpty) {
      btnEmpty.addEventListener('click', () => {
        starteFormular(host, deps, { ownerId, leadId, befundart: 'erst', vorBefund: null });
      });
    }
    return;
  }

  // Liste der vorhandenen Befunde
  container.innerHTML = '';
  for (const b of befunde) {
    const info = befundListenZeile(b);
    const card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 18px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);margin-bottom:10px;cursor:pointer;transition:border-color 0.15s ease;';

    const artBadgeStyle = b.befundart === 'erst'
      ? 'background:var(--primary-dim);color:var(--primary);border:1px solid var(--primary);'
      : 'background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);';

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-width:0;flex:1;">
        <span style="display:inline-block;padding:3px 10px;border-radius:14px;font-size:12px;font-weight:600;${artBadgeStyle}">
          ${escapeHtml(info.artLabel)}
        </span>
        <span style="font-weight:600;font-size:14px;color:var(--text-main);white-space:nowrap;">
          ${escapeHtml(info.datumStr)}
        </span>
        ${info.regionenStr ? `
          <span style="color:var(--text-muted);font-size:13px;">
            Regionen: <strong style="color:var(--text-main);font-weight:500;">${escapeHtml(info.regionenStr)}</strong>
          </span>
        ` : ''}
        ${info.nrsStr ? `
          <span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);">
            ${escapeHtml(info.nrsStr)}
          </span>
        ` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button type="button" class="btn btn-secondary btn-sm" style="min-height:44px;padding:0 14px;pointer-events:none;">
          Details ansehen
        </button>
      </div>
    `;

    card.addEventListener('click', () => {
      zeigeLesemodus(host, deps, { ownerId, leadId, befund: b, juengsterId: juengster ? juengster.id : null });
    });

    container.appendChild(card);
  }
}

/**
 * Rendert die Detail-/Zusammenfassungsansicht eines Befunds (Lesemodus).
 */
async function zeigeLesemodus(host, deps, { ownerId, leadId, befund, juengsterId }) {
  host.innerHTML = `
    <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">
      <div class="spinner-sm" style="display:inline-block;vertical-align:middle;margin-right:8px;"></div>
      Befunddetails werden geladen...
    </div>
  `;

  let messungen = [];
  try {
    const { data: mRows } = await deps.supabase
      .from('messreihen')
      .select('id, typ, koerperteil, wert, einheit, seite, notiz, gemessen_am')
      .eq('owner_id', ownerId)
      .eq('lead_id', leadId)
      .eq('befund_id', befund.id)
      .order('gemessen_am', { ascending: true });
    messungen = mRows || [];
  } catch (_) {}

  const info = befundListenZeile(befund);
  const daten = befund.daten || {};
  const bericht = daten.bericht || {};

  host.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
      <button type="button" class="btn btn-secondary" id="btnZurueckZurListe" style="min-height:44px;padding:0 16px;">
        &larr; Zurück zur Übersicht
      </button>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        ${befund.id === juengsterId ? `
          <button type="button" class="btn btn-primary" id="btnLeseZwischen" style="min-height:44px;padding:0 16px;">
            + Zwischenbefund aus diesem
          </button>
          <button type="button" class="btn btn-secondary" id="btnLeseAbschluss" style="min-height:44px;padding:0 16px;">
            + Abschlussbefund aus diesem
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Stammdaten Karte -->
    <div style="border:1px solid var(--border);border-radius:8px;padding:16px;background:var(--bg-card-solid);margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
        <h4 style="margin:0;font-size:16px;font-weight:600;color:var(--text-main);">
          ${escapeHtml(info.artLabel)} · ${escapeHtml(info.datumStr)}
        </h4>
        <span style="font-size:13px;color:var(--text-muted);">
          Version ${escapeHtml(befund.version || 1)}
        </span>
      </div>
      <div style="font-size:13px;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:16px;">
        <span>Regionen: <strong style="color:var(--text-main);">${escapeHtml(info.regionenStr || 'Keine')}</strong></span>
        ${befund.prescription_id ? `<span>Verordnung verknüpft: <code style="font-size:12px;">${escapeHtml(befund.prescription_id.slice(0, 8))}...</code></span>` : '<span>Keine Verordnung verknüpft</span>'}
      </div>
    </div>

    <!-- Regionen & Messungen -->
    <div style="border:1px solid var(--border);border-radius:8px;padding:16px;background:var(--bg-card-solid);margin-bottom:12px;">
      <h5 style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:var(--text-main);">Messwerte & Befunde je Region</h5>
      <div id="pdLeseRegionenHost"></div>
    </div>

    <!-- Inspektion & Palpation -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;margin-bottom:12px;">
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--bg-card-solid);">
        <strong style="font-size:13px;color:var(--text-main);display:block;margin-bottom:6px;">Inspektion</strong>
        <div style="font-size:13px;color:var(--text-main);">
          ${(bericht.inspektion && bericht.inspektion.length > 0) ? escapeHtml(bericht.inspektion.join(', ')) : '<span style="color:var(--text-muted);">Keine Auffälligkeiten</span>'}
        </div>
        ${daten.inspektion?.text ? `<div style="margin-top:6px;font-size:13px;color:var(--text-muted);">${escapeHtml(daten.inspektion.text)}</div>` : ''}
      </div>
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--bg-card-solid);">
        <strong style="font-size:13px;color:var(--text-main);display:block;margin-bottom:6px;">Palpation</strong>
        <div style="font-size:13px;color:var(--text-main);">
          ${(bericht.palpation && bericht.palpation.length > 0) ? escapeHtml(bericht.palpation.join(', ')) : '<span style="color:var(--text-muted);">Keine Auffälligkeiten</span>'}
        </div>
        ${daten.palpation?.text ? `<div style="margin-top:6px;font-size:13px;color:var(--text-muted);">${escapeHtml(daten.palpation.text)}</div>` : ''}
      </div>
    </div>

    <!-- ADL & Funktion -->
    <div style="border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--bg-card-solid);margin-bottom:12px;">
      <strong style="font-size:13px;color:var(--text-main);display:block;margin-bottom:6px;">Alltagsaktivitäten (ADL) & Funktion</strong>
      <div style="font-size:13px;color:var(--text-main);margin-bottom:6px;">
        ${(bericht.adl && bericht.adl.length > 0) ? escapeHtml(bericht.adl.join(', ')) : '<span style="color:var(--text-muted);">Keine Einschränkungen gewählt</span>'}
      </div>
      <div style="font-size:13px;color:var(--text-muted);display:flex;gap:16px;">
        ${daten.adl?.gehstrecke_m != null ? `<span>Gehstrecke: <strong style="color:var(--text-main);">${escapeHtml(daten.adl.gehstrecke_m)} m</strong></span>` : ''}
        ${daten.adl?.sitzdauer_min != null ? `<span>Sitzdauer: <strong style="color:var(--text-main);">${escapeHtml(daten.adl.sitzdauer_min)} min</strong></span>` : ''}
      </div>
    </div>

    <!-- Behandlungsziele -->
    <div style="border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--bg-card-solid);margin-bottom:12px;">
      <strong style="font-size:13px;color:var(--text-main);display:block;margin-bottom:8px;">Behandlungsziele</strong>
      ${Array.isArray(daten.ziele) && daten.ziele.some(z => z.text) ? `
        <ol style="margin:0;padding-left:18px;font-size:13px;color:var(--text-main);">
          ${daten.ziele.filter(z => z.text).map(z => `
            <li style="margin-bottom:4px;">
              ${escapeHtml(z.text)}
              ${z.erreicht ? ` <span style="font-size:12px;color:var(--text-muted);font-weight:600;">(${escapeHtml(z.erreicht)})</span>` : ''}
            </li>
          `).join('')}
        </ol>
      ` : '<div style="font-size:13px;color:var(--text-muted);">Keine Ziele hinterlegt.</div>'}
    </div>

    <!-- Therapieplan -->
    <div style="border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--bg-card-solid);margin-bottom:12px;">
      <strong style="font-size:13px;color:var(--text-main);display:block;margin-bottom:6px;">Therapieplan & Hausaufgaben</strong>
      <div style="font-size:13px;color:var(--text-main);margin-bottom:6px;">
        ${(bericht.massnahmen && bericht.massnahmen.length > 0) ? escapeHtml(bericht.massnahmen.join(', ')) : '<span style="color:var(--text-muted);">Keine Maßnahmen gewählt</span>'}
      </div>
      ${daten.therapieplan?.hausaufgaben ? `
        <div style="font-size:13px;color:var(--text-muted);">
          Hausaufgaben: <span style="color:var(--text-main);">${escapeHtml(daten.therapieplan.hausaufgaben)}</span>
        </div>
      ` : ''}
    </div>

    ${(daten.verlauf || daten.empfehlung?.folge_vo) ? `
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--bg-card-solid);margin-bottom:12px;">
        <strong style="font-size:13px;color:var(--text-main);display:block;margin-bottom:6px;">Verlauf & Empfehlung</strong>
        <div style="font-size:13px;color:var(--text-main);display:flex;gap:16px;flex-wrap:wrap;">
          ${daten.verlauf ? `<span>Verlauf: <strong style="color:var(--text-main);">${escapeHtml(daten.verlauf)}</strong></span>` : ''}
          ${daten.empfehlung?.folge_vo ? `<span>Folge-VO: <strong style="color:var(--text-main);">${escapeHtml(daten.empfehlung.folge_vo)}</strong></span>` : ''}
          ${daten.empfehlung?.eigentraining ? `<span>Eigentraining: <strong style="color:var(--text-main);">ja</strong></span>` : ''}
        </div>
      </div>
    ` : ''}

    ${daten.notiz ? `
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--bg-card-solid);margin-bottom:12px;">
        <strong style="font-size:13px;color:var(--text-main);display:block;margin-bottom:4px;">Zusätzliche Notiz</strong>
        <div style="font-size:13px;color:var(--text-main);white-space:pre-wrap;">${escapeHtml(daten.notiz)}</div>
      </div>
    ` : ''}
  `;

  // Regionen-Messwerte rendern
  const regHost = host.querySelector('#pdLeseRegionenHost');
  const regKeys = Object.keys(daten.regionen || {});
  if (regKeys.length === 0) {
    regHost.innerHTML = '<div style="font-size:13px;color:var(--text-muted);">Keine Regionen im Befund erfasst.</div>';
  } else {
    regHost.innerHTML = '';
    for (const rKey of regKeys) {
      const rVal = daten.regionen[rKey];
      const rKat = REGIONEN.find(r => r.id === rKey || r.label === rKey) || { label: rKey };
      const regBox = document.createElement('div');
      regBox.style.cssText = 'padding:10px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);margin-bottom:8px;font-size:13px;';

      const passendeMess = messungen.filter(m => m.koerperteil && (m.koerperteil === rKat.label || m.koerperteil.startsWith(rKat.label + ' · ')));
      const nrsRows = passendeMess.filter(m => m.typ === 'VAS');
      const romRows = passendeMess.filter(m => m.typ === 'ROM');
      const kraftRows = passendeMess.filter(m => m.typ === 'kraft');

      const testItems = [];
      for (const [tId, tVal] of Object.entries(rVal?.tests || {})) {
        if (typeof tVal === 'object') {
          for (const [s, v] of Object.entries(tVal)) {
            if (v && v !== 'nicht') testItems.push(`${escapeHtml(tId)} (${escapeHtml(s)}): ${escapeHtml(v)}`);
          }
        } else if (tVal && tVal !== 'nicht') {
          testItems.push(`${escapeHtml(tId)}: ${escapeHtml(tVal)}`);
        }
      }

      regBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="font-size:14px;color:var(--text-main);">${escapeHtml(rKat.label)}</strong>
          ${rVal?.seite ? `<span style="font-size:12px;color:var(--text-muted);">${escapeHtml(rVal.seite)}</span>` : ''}
        </div>
        ${rVal?.charakter && rVal.charakter.length > 0 ? `
          <div style="margin-bottom:4px;color:var(--text-muted);font-size:12px;">Charakter: ${escapeHtml(rVal.charakter.join(', '))}</div>
        ` : ''}
        ${nrsRows.length > 0 ? `
          <div style="margin-bottom:4px;">
            <span style="font-weight:600;">NRS:</span> ${nrsRows.map(n => `${escapeHtml(n.koerperteil.replace(rKat.label, '').replace(' · ', '') || 'aktuell')}: ${escapeHtml(n.wert)}`).join(', ')}
          </div>
        ` : ''}
        ${romRows.length > 0 ? `
          <div style="margin-bottom:4px;">
            <span style="font-weight:600;">ROM:</span> ${romRows.map(r => `${escapeHtml(r.koerperteil.replace(rKat.label + ' · ', ''))} ${r.seite ? '(' + escapeHtml(r.seite) + ')' : ''}: ${escapeHtml(r.wert)}°${r.notiz ? ' (' + escapeHtml(r.notiz) + ')' : ''}`).join(', ')}
          </div>
        ` : ''}
        ${kraftRows.length > 0 ? `
          <div style="margin-bottom:4px;">
            <span style="font-weight:600;">Kraft (MFT):</span> ${kraftRows.map(k => `${escapeHtml(k.koerperteil.replace(rKat.label + ' · ', ''))} ${k.seite ? '(' + escapeHtml(k.seite) + ')' : ''}: ${escapeHtml(k.wert)}/5`).join(', ')}
          </div>
        ` : ''}
        ${testItems.length > 0 ? `
          <div>
            <span style="font-weight:600;">Tests:</span> ${testItems.join(', ')}
          </div>
        ` : ''}
      `;
      regHost.appendChild(regBox);
    }
  }

  // Listener
  host.querySelector('#btnZurueckZurListe').addEventListener('click', () => {
    zeigeUebersicht(host, deps, { ownerId, leadId });
  });

  const btnZw = host.querySelector('#btnLeseZwischen');
  if (btnZw) {
    btnZw.addEventListener('click', () => {
      starteFormular(host, deps, { ownerId, leadId, befundart: 'zwischen', vorBefund: befund });
    });
  }

  const btnAb = host.querySelector('#btnLeseAbschluss');
  if (btnAb) {
    btnAb.addEventListener('click', () => {
      starteFormular(host, deps, { ownerId, leadId, befundart: 'abschluss', vorBefund: befund });
    });
  }
}

/**
 * Initialisiert den Formularzustand und startet die Formularansicht.
 */
async function starteFormular(host, deps, { ownerId, leadId, befundart, vorBefund }) {
  host.innerHTML = `
    <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:14px;">
      <div class="spinner-sm" style="display:inline-block;vertical-align:middle;margin-right:8px;"></div>
      Befundformular wird vorbereitet...
    </div>
  `;

  const uid = typeof deps.userId === 'function' ? deps.userId() : deps.userId;
  const todayStr = new Date().toISOString().slice(0, 10);

  let state;
  let vorMessungen = [];

  if (vorBefund && (befundart === 'zwischen' || befundart === 'abschluss')) {
    try {
      const { data: mRows } = await deps.supabase
        .from('messreihen')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('lead_id', leadId)
        .eq('befund_id', vorBefund.id);
      vorMessungen = mRows || [];
    } catch (_) {}

    state = uebernehmeVonVorbefund({
      befundart,
      datum: todayStr,
      therapeutId: uid || null,
      vorDaten: vorBefund.daten || {},
      vorMessungen,
    });
  } else {
    state = neuerBefundZustand({
      befundart: 'erst',
      datum: todayStr,
      therapeutId: uid || null,
    });
    state.vorher = {};
  }

  // Verordnungen des Patienten laden
  let verordnungen = [];
  try {
    const { data: rxData } = await deps.supabase
      .from('prescriptions')
      .select('id, rezept_typ, status, icd10, diagnosegruppe, heilmittel, ausstellungsdatum, created_at')
      .eq('owner_id', ownerId)
      .eq('patient_id', leadId)
      .order('created_at', { ascending: false });
    verordnungen = rxData || [];
  } catch (_) {}

  // Standard-Verordnung: falls vorBefund vorhanden dessen prescription_id, sonst juengste aktive
  let selectedRxId = vorBefund?.prescription_id || null;
  if (!selectedRxId && verordnungen.length > 0) {
    const aktive = verordnungen.find(v => v.status === 'active' || v.status === 'confirmed');
    selectedRxId = aktive ? aktive.id : verordnungen[0].id;
  }

  renderFormular(host, deps, { ownerId, leadId, state, verordnungen, selectedRxId, vorBefund });
}

/**
 * Rendert das Befund-Formular mit allen Abschnitten als scrollbaren Bereich.
 */
function renderFormular(host, deps, { ownerId, leadId, state, verordnungen, selectedRxId, vorBefund }) {
  let prescriptionId = selectedRxId;
  const artLabelObj = BEFUNDARTEN.find(b => b.id === state.befundart);
  const titel = artLabelObj ? artLabelObj.label : 'Befund';
  const uid = typeof deps.userId === 'function' ? deps.userId() : deps.userId;
  const thName = typeof deps.getTherapeutName === 'function' ? deps.getTherapeutName() : (uid ? 'Angemeldeter Therapeut' : '—');

  host.innerHTML = `
    <!-- Kopfzeile mit Aktionen -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border);">
      <button type="button" class="btn btn-secondary" id="btnFormAbbrechen" style="min-height:44px;padding:0 18px;">
        &larr; Abbrechen
      </button>
      <h3 style="margin:0;font-size:18px;font-weight:600;color:var(--text-main);">
        ${escapeHtml(titel)} erfassen
      </h3>
      <button type="button" class="btn btn-primary" id="btnFormSpeichern" style="min-height:44px;padding:0 22px;font-weight:600;">
        Befund speichern
      </button>
    </div>

    <!-- Fehleranzeige -->
    <div id="pdBefundFehlerBox" style="display:none;margin-bottom:16px;padding:12px 16px;border:1px solid var(--danger);background:var(--danger-dim);color:var(--text-main);border-radius:8px;font-size:13px;">
      <strong style="color:var(--danger);display:block;margin-bottom:4px;">Bitte prüfen Sie folgende Angaben:</strong>
      <ul id="pdBefundFehlerListe" style="margin:0;padding-left:18px;"></ul>
    </div>

    <!-- Scrollbarer Formularinhalt -->
    <div id="pdBefundFormScroll" style="display:flex;flex-direction:column;gap:14px;">

      <!-- 1. Basisdaten -->
      <div class="pd-befund-karte" style="padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);">
        <h4 style="margin:0 0 12px 0;font-size:15px;font-weight:600;color:var(--text-main);">1. Basisdaten</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px;align-items:end;">
          <div>
            <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Befundart</label>
            <div style="min-height:44px;display:flex;align-items:center;padding:0 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;font-size:14px;font-weight:600;color:var(--text-main);">
              ${escapeHtml(titel)}
            </div>
          </div>
          <div>
            <label for="pdInpDatum" style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Datum *</label>
            <input type="date" id="pdInpDatum" class="form-input" value="${escapeHtml(state.datum)}" style="min-height:44px;width:100%;box-sizing:border-box;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:14px;">
          </div>
          <div>
            <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Therapeut</label>
            <div style="min-height:44px;display:flex;align-items:center;padding:0 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;font-size:13px;color:var(--text-main);">
              ${escapeHtml(thName)}
            </div>
          </div>
          <div>
            <label for="pdInpPrescription" style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Zugehörige Verordnung</label>
            <select id="pdInpPrescription" class="form-input" style="min-height:44px;width:100%;box-sizing:border-box;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:13px;">
              <option value="">-- Keine Verordnung zuordnen --</option>
              ${verordnungen.map(v => {
                const sel = v.id === prescriptionId ? 'selected' : '';
                const dStr = v.ausstellungsdatum ? new Date(v.ausstellungsdatum).toLocaleDateString('de-DE') : '';
                const label = `${dStr ? 'VO ' + escapeHtml(dStr) + ' · ' : ''}${escapeHtml(v.heilmittel || v.diagnosegruppe || 'Verordnung')}`;
                return `<option value="${escapeHtml(v.id)}" ${sel}>${label}</option>`;
              }).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- 2. Regionen-Auswahl -->
      <div class="pd-befund-karte" style="padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);">
        <div style="margin-bottom:10px;">
          <h4 style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:var(--text-main);">2. Regionen & Befund (Mehrfachauswahl)</h4>
          <span style="font-size:12px;color:var(--text-muted);">Wählen Sie mindestens eine betroffene Region für Schmerz, ROM und Kraft.</span>
        </div>
        <div id="pdRegionenChipsHost" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;"></div>
        <div id="pdRegionenKartenHost" style="display:flex;flex-direction:column;gap:12px;"></div>
      </div>

      <!-- 3. Inspektion & Palpation -->
      <div class="pd-befund-karte" style="padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);">
        <h4 style="margin:0 0 12px 0;font-size:15px;font-weight:600;color:var(--text-main);">3. Inspektion & Palpation</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;">
          <div>
            <label style="display:block;font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:6px;">Inspektion (Sichtbefund)</label>
            <div id="pdInspChipsHost" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;"></div>
            <input type="text" id="pdInspText" class="form-input" placeholder="Zusätzliche Notiz zur Inspektion..." value="${escapeHtml(state.inspektion?.text || '')}" style="min-height:44px;width:100%;box-sizing:border-box;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:13px;">
          </div>
          <div>
            <label style="display:block;font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:6px;">Palpation (Tastbefund)</label>
            <div id="pdPalpChipsHost" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;"></div>
            <input type="text" id="pdPalpText" class="form-input" placeholder="Zusätzliche Notiz zur Palpation..." value="${escapeHtml(state.palpation?.text || '')}" style="min-height:44px;width:100%;box-sizing:border-box;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:13px;">
          </div>
        </div>
      </div>

      <!-- 4. Funktion & Alltagsaktivitäten (ADL) -->
      <div class="pd-befund-karte" style="padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);">
        <h4 style="margin:0 0 10px 0;font-size:15px;font-weight:600;color:var(--text-main);">4. Funktion & Alltagsaktivitäten (ADL)</h4>
        <div id="pdAdlChipsHost" style="display:flex;flex-wrap:gap:6px;margin-bottom:12px;"></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;">
          <div>
            <label for="pdInpGehstrecke" style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Gehstrecke (Meter)</label>
            <input type="number" id="pdInpGehstrecke" class="form-input" min="0" step="50" placeholder="z. B. 500" value="${state.adl?.gehstrecke_m != null ? escapeHtml(state.adl.gehstrecke_m) : ''}" style="min-height:44px;width:100%;box-sizing:border-box;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:14px;">
          </div>
          <div>
            <label for="pdInpSitzdauer" style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Sitzdauer (Minuten)</label>
            <input type="number" id="pdInpSitzdauer" class="form-input" min="0" step="5" placeholder="z. B. 30" value="${state.adl?.sitzdauer_min != null ? escapeHtml(state.adl.sitzdauer_min) : ''}" style="min-height:44px;width:100%;box-sizing:border-box;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:14px;">
          </div>
        </div>
      </div>

      <!-- 5. Behandlungsziele -->
      <div class="pd-befund-karte" style="padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
          <h4 style="margin:0;font-size:15px;font-weight:600;color:var(--text-main);">
            5. Behandlungsziele ${state.befundart === 'erst' ? '(mind. 1 Pflicht) *' : ''}
          </h4>
        </div>
        <div id="pdZielVorschlaegeBox" style="margin-bottom:12px;padding:10px;border:1px dashed var(--border);border-radius:6px;background:var(--bg-input);">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Vorschläge aus gewählten Regionen (Klick übernimmt):</div>
          <div id="pdZielVorschlaegeChips" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
        </div>
        <div id="pdZieleInputsHost" style="display:flex;flex-direction:column;gap:10px;"></div>
      </div>

      <!-- 6. Therapieplan -->
      <div class="pd-befund-karte" style="padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);">
        <h4 style="margin:0 0 10px 0;font-size:15px;font-weight:600;color:var(--text-main);">6. Therapieplan</h4>
        <div style="margin-bottom:10px;">
          <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:6px;">Maßnahmen (Mehrfachauswahl)</label>
          <div id="pdMassnahmenChipsHost" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
        </div>
        <div>
          <label for="pdInpHausaufgaben" style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Hausaufgaben / Eigenübungen</label>
          <input type="text" id="pdInpHausaufgaben" class="form-input" placeholder="z. B. Dehnübungen 2x tgl., Kälteanwendung..." value="${escapeHtml(state.therapieplan?.hausaufgaben || '')}" style="min-height:44px;width:100%;box-sizing:border-box;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:13px;">
        </div>
      </div>

      <!-- 7. Nur Zwischen/Abschluss: Verlauf & Empfehlung -->
      ${(state.befundart === 'zwischen' || state.befundart === 'abschluss') ? `
        <div class="pd-befund-karte" style="padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);">
          <h4 style="margin:0 0 12px 0;font-size:15px;font-weight:600;color:var(--text-main);">7. Verlauf & Empfehlung</h4>
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:6px;">Verlauf der Behandlung *</label>
            <div id="pdVerlaufChipsHost" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
          </div>
          ${state.befundart === 'abschluss' ? `
            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:6px;">Empfehlung Folge-Verordnung *</label>
              <div id="pdFolgeVoChipsHost" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
            </div>
            <div>
              <label style="display:flex;align-items:center;gap:10px;font-size:14px;color:var(--text-main);cursor:pointer;min-height:44px;">
                <input type="checkbox" id="pdChkEigentraining" ${state.empfehlung?.eigentraining ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer;">
                <span>Eigentraining möglich und empfohlen</span>
              </label>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- 8. Zusätzliche Befundnotiz -->
      <div class="pd-befund-karte" style="padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);">
        <h4 style="margin:0 0 8px 0;font-size:15px;font-weight:600;color:var(--text-main);">8. Zusätzliche Befundnotiz</h4>
        <textarea id="pdInpNotiz" class="form-input" rows="3" placeholder="Freitext-Bemerkungen..." style="width:100%;box-sizing:border-box;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:13px;resize:vertical;">${escapeHtml(state.notiz || '')}</textarea>
      </div>

      <!-- Speichern-Button unten -->
      <div style="margin-top:10px;margin-bottom:20px;display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" class="btn btn-secondary" id="btnFormAbbrechenUnten" style="min-height:48px;padding:0 20px;">
          Abbrechen
        </button>
        <button type="button" class="btn btn-primary" id="btnFormSpeichernUnten" style="min-height:48px;padding:0 28px;font-weight:600;font-size:15px;">
          Befund speichern
        </button>
      </div>

    </div>
  `;

  // Listener Basisdaten
  host.querySelector('#pdInpDatum').addEventListener('change', (e) => {
    state.datum = e.target.value;
  });
  host.querySelector('#pdInpPrescription').addEventListener('change', (e) => {
    prescriptionId = e.target.value || null;
  });

  // Listener ADL
  host.querySelector('#pdInpGehstrecke').addEventListener('input', (e) => {
    const val = e.target.value.trim();
    state.adl.gehstrecke_m = val !== '' ? Number(val) : null;
  });
  host.querySelector('#pdInpSitzdauer').addEventListener('input', (e) => {
    const val = e.target.value.trim();
    state.adl.sitzdauer_min = val !== '' ? Number(val) : null;
  });

  // Listener Inspektion / Palpation Text
  host.querySelector('#pdInspText').addEventListener('input', (e) => {
    state.inspektion.text = e.target.value;
  });
  host.querySelector('#pdPalpText').addEventListener('input', (e) => {
    state.palpation.text = e.target.value;
  });

  // Listener Hausaufgaben
  host.querySelector('#pdInpHausaufgaben').addEventListener('input', (e) => {
    state.therapieplan.hausaufgaben = e.target.value;
  });

  // Listener Notiz
  host.querySelector('#pdInpNotiz').addEventListener('input', (e) => {
    state.notiz = e.target.value;
  });

  // Listener Abschluss Eigentraining
  const chkEigen = host.querySelector('#pdChkEigentraining');
  if (chkEigen) {
    chkEigen.addEventListener('change', (e) => {
      state.empfehlung.eigentraining = e.target.checked;
    });
  }

  // --- Sub-Renderer verdrahten ---
  zeichneRegionenBereich(host, state);
  zeichneInspektionPalpation(host, state);
  zeichneAdlChips(host, state);
  zeichneZieleBereich(host, state);
  zeichneMassnahmenChips(host, state);
  zeichneVerlaufChips(host, state);

  // Abbruch
  const abbrechen = () => {
    zeigeUebersicht(host, deps, { ownerId, leadId });
  };
  host.querySelector('#btnFormAbbrechen').addEventListener('click', abbrechen);
  host.querySelector('#btnFormAbbrechenUnten').addEventListener('click', abbrechen);

  // Speichern
  const speichern = async () => {
    const fehlerBox = host.querySelector('#pdBefundFehlerBox');
    const fehlerListe = host.querySelector('#pdBefundFehlerListe');
    fehlerBox.style.display = 'none';
    fehlerListe.innerHTML = '';

    const pruefung = validiere(state);
    if (!pruefung.ok) {
      for (const f of pruefung.fehler) {
        const li = document.createElement('li');
        li.textContent = f;
        fehlerListe.appendChild(li);
      }
      fehlerBox.style.display = 'block';
      fehlerBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
      deps.showToast(pruefung.fehler[0], 'error');
      return;
    }

    const btnOben = host.querySelector('#btnFormSpeichern');
    const btnUnten = host.querySelector('#btnFormSpeichernUnten');
    btnOben.disabled = true;
    btnUnten.disabled = true;
    btnOben.textContent = 'Speichert...';
    btnUnten.textContent = 'Speichert...';

    try {
      const datenPayload = baueDaten(state);
      const bId = (typeof deps?.getBusinessId === 'function' ? deps.getBusinessId() : deps?.getBusinessId) || null;

      // Sicherstellen, dass das Datum fuer messreihen valide ist
      const gemessenAmIso = (() => {
        try {
          if (state.datum && /^\d{4}-\d{2}-\d{2}$/.test(state.datum)) {
            const d = new Date(state.datum + 'T12:00:00Z');
            return !Number.isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
          }
        } catch (_) {}
        return new Date().toISOString();
      })();

      // (1) physio_befunde Insert
      const { data: befundData, error: befundError } = await deps.supabase
        .from('physio_befunde')
        .insert({
          owner_id: ownerId,
          business_id: bId,
          lead_id: leadId,
          prescription_id: prescriptionId || null,
          befundart: state.befundart,
          befund_datum: state.datum,
          therapeut_id: state.therapeutId || uid || null,
          daten: datenPayload,
          form_version: FORM_VERSION,
          created_by: uid || null,
        })
        .select('id, eintrag_id')
        .maybeSingle();

      if (befundError) throw befundError;
      if (!befundData?.id) throw new Error('Befund konnte nicht angelegt werden.');

      const befundId = befundData.id;

      // (2) messreihen Insert
      const messZeilen = baueMessreihenZeilen(state, {
        ownerId,
        leadId,
        prescriptionId: prescriptionId || null,
        befundId,
        erfasstVon: uid || null,
        gemessenAm: gemessenAmIso,
      });

      if (messZeilen.length > 0) {
        const { error: messError } = await deps.supabase
          .from('messreihen')
          .insert(messZeilen);

        if (messError) {
          // Wiederholen-Dialog anzeigen
          zeigeWiederholenDialog(host, deps, { ownerId, leadId, befundId, messZeilen, messError });
          return;
        }
      }

      deps.showToast('Befund erfolgreich gespeichert.');
      await zeigeUebersicht(host, deps, { ownerId, leadId });
    } catch (err) {
      deps.showToast('Fehler beim Speichern: ' + (err?.message || err), 'error');
      btnOben.disabled = false;
      btnUnten.disabled = false;
      btnOben.textContent = 'Befund speichern';
      btnUnten.textContent = 'Befund speichern';
    }
  };

  host.querySelector('#btnFormSpeichern').addEventListener('click', speichern);
  host.querySelector('#btnFormSpeichernUnten').addEventListener('click', speichern);
}

/**
 * Zeigt den Wiederholen-Dialog, falls das Speichern der Messwerte fehlschlug.
 */
function zeigeWiederholenDialog(host, deps, { ownerId, leadId, befundId, messZeilen, messError }) {
  host.innerHTML = `
    <div style="border:1px solid var(--danger);background:var(--danger-dim);border-radius:8px;padding:24px;text-align:center;margin:20px 0;">
      <h4 style="margin:0 0 8px 0;color:var(--danger);font-size:16px;">Befund gespeichert, Messwerte nicht</h4>
      <p style="margin:0 0 16px 0;font-size:13px;color:var(--text-main);">
        Der Befund wurde erfolgreich gesichert, beim Übertragen der ${escapeHtml(messZeilen.length)} Messwerte nach messreihen ist jedoch ein Fehler aufgetreten:
        <br><code style="font-size:12px;">${escapeHtml(messError?.message || messError)}</code>
      </p>
      <div style="display:flex;justify-content:center;gap:12px;">
        <button type="button" class="btn btn-secondary" id="btnWiederholenUeberspringen" style="min-height:44px;padding:0 16px;">
          Trotzdem zur Übersicht
        </button>
        <button type="button" class="btn btn-primary" id="btnWiederholenSenden" style="min-height:44px;padding:0 20px;font-weight:600;">
          Messwerte erneut senden
        </button>
      </div>
    </div>
  `;

  host.querySelector('#btnWiederholenUeberspringen').addEventListener('click', () => {
    zeigeUebersicht(host, deps, { ownerId, leadId });
  });

  const btnSenden = host.querySelector('#btnWiederholenSenden');
  btnSenden.addEventListener('click', async () => {
    btnSenden.disabled = true;
    btnSenden.textContent = 'Wird gesendet...';
    try {
      const { error: erneutError } = await deps.supabase
        .from('messreihen')
        .insert(messZeilen);
      if (erneutError) throw erneutError;
      deps.showToast('Messwerte erfolgreich nachgetragen.');
      await zeigeUebersicht(host, deps, { ownerId, leadId });
    } catch (err) {
      deps.showToast('Erneuter Fehler: ' + (err?.message || err), 'error');
      btnSenden.disabled = false;
      btnSenden.textContent = 'Messwerte erneut senden';
    }
  });
}

/**
 * Zeichnet die Regionen-Auswahlchips und deren Detailkarten.
 */
function zeichneRegionenBereich(host, state) {
  const chipsHost = host.querySelector('#pdRegionenChipsHost');
  const kartenHost = host.querySelector('#pdRegionenKartenHost');

  chipsHost.innerHTML = '';
  for (const reg of REGIONEN) {
    const istGewaehlt = Boolean(state.regionen && state.regionen[reg.id]);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pd-chip';
    btn.style.cssText = `min-height:44px;padding:0 16px;border-radius:22px;font-size:14px;font-weight:500;cursor:pointer;user-select:none;transition:all 0.15s ease;${
      istGewaehlt
        ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
        : 'background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);'
    }`;
    btn.textContent = reg.label;

    btn.addEventListener('click', () => {
      if (state.regionen[reg.id]) {
        delete state.regionen[reg.id];
      } else {
        state.regionen[reg.id] = {
          seite: reg.seitig ? 'rechts' : null,
          nrs: { aktuell: null, ruhe: null, belastung: null, nacht: null },
          charakter: [],
          rom: {},
          kraft: {},
          tests: {},
        };
      }
      zeichneRegionenBereich(host, state);
      zeichneZieleVorschlaege(host, state);
    });

    chipsHost.appendChild(btn);
  }

  // Detailkarten je gewaehlter Region
  kartenHost.innerHTML = '';
  const gewaehlteKeys = Object.keys(state.regionen || {});
  if (gewaehlteKeys.length === 0) {
    kartenHost.innerHTML = `
      <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;border:1px dashed var(--border);border-radius:6px;">
        Klicken Sie oben auf eine oder mehrere Regionen (z. B. HWS, Schulter), um deren Befundmaske zu öffnen.
      </div>
    `;
    return;
  }

  for (const regId of gewaehlteKeys) {
    const regKatalog = REGIONEN.find(r => r.id === regId || r.label === regId) || { id: regId, label: regId, seitig: true };
    const rState = state.regionen[regId];
    const vorherReg = state.vorher?.[regId] || {};

    const karte = document.createElement('div');
    karte.style.cssText = 'border:1px solid var(--border);border-radius:8px;padding:16px;background:var(--bg-input);margin-bottom:8px;';

    karte.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);">
        <strong style="font-size:16px;color:var(--text-main);">${escapeHtml(regKatalog.label)}</strong>
        ${regKatalog.seitig ? `
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:12px;color:var(--text-muted);margin-right:4px;">Seite:</span>
            ${SEITEN.map(s => `
              <button type="button" class="btn btn-sm btn-seite-${regId}" data-seite="${escapeHtml(s.id)}" style="min-height:44px;min-width:44px;padding:0 12px;border-radius:6px;cursor:pointer;font-weight:500;${
                rState.seite === s.id
                  ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
                  : 'background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);'
              }">
                ${escapeHtml(s.label)}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <!-- Schmerz NRS -->
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:6px;">
          Schmerz aktuell (NRS 0–10) *
          ${vorherReg.nrs?.aktuell != null ? `<span style="font-size:12px;color:var(--text-muted);font-weight:normal;"> (vorher: ${escapeHtml(vorherReg.nrs.aktuell)})</span>` : ''}
        </label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
          ${Array.from({ length: 11 }, (_, i) => i).map(n => `
            <button type="button" class="btn btn-sm btn-nrs-akt-${regId}" data-nrs="${n}" style="min-height:44px;min-width:44px;border-radius:6px;font-weight:600;cursor:pointer;${
              rState.nrs?.aktuell === n
                ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
                : 'background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);'
            }">
              ${n}
            </button>
          `).join('')}
        </div>

        <details style="margin-top:6px;">
          <summary style="font-size:12px;color:var(--text-muted);cursor:pointer;padding:4px 0;">Weitere Schmerzwerte erfassen (Ruhe, Belastung, Nacht)</summary>
          <div style="padding-top:8px;display:flex;flex-direction:column;gap:8px;">
            ${NRS_ZEITEN.map(z => `
              <div>
                <span style="font-size:12px;font-weight:500;color:var(--text-main);display:block;margin-bottom:4px;">
                  NRS ${escapeHtml(z.label)}:
                  ${vorherReg.nrs?.[z.id] != null ? `<span style="color:var(--text-muted);font-size:11px;"> (vorher: ${escapeHtml(vorherReg.nrs[z.id])})</span>` : ''}
                </span>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${Array.from({ length: 11 }, (_, i) => i).map(n => `
                    <button type="button" class="btn btn-sm btn-nrs-zeit-${regId}" data-zeit="${escapeHtml(z.id)}" data-nrs="${n}" style="min-height:44px;min-width:44px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;${
                      rState.nrs?.[z.id] === n
                        ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
                        : 'background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);'
                    }">
                      ${n}
                    </button>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </details>
      </div>

      <!-- Schmerzcharakter -->
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px;">Schmerzcharakter</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${CHARAKTER.map(c => {
            const active = Array.isArray(rState.charakter) && rState.charakter.includes(c.id);
            return `
              <button type="button" class="btn btn-sm btn-charakter-${regId}" data-char="${escapeHtml(c.id)}" style="min-height:44px;padding:0 14px;border-radius:22px;cursor:pointer;font-size:13px;${
                active
                  ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
                  : 'background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);'
              }">
                ${escapeHtml(c.label)}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- ROM Bewegungen -->
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:6px;">
          ROM – Bewegungsumfang (Neutral-Null)
        </label>
        <div id="pdRomHost-${regId}" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>

      <!-- Kraft MFT -->
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:6px;">
          Kraft (MFT 0–5)
        </label>
        <div id="pdKraftHost-${regId}" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>

      <!-- Klinische Tests -->
      <div>
        <label style="display:block;font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:6px;">
          Klinische Tests (+ / − / nicht)
        </label>
        <div id="pdTestsHost-${regId}" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>
    `;

    // Seiten-Chips
    karte.querySelectorAll(`.btn-seite-${regId}`).forEach(btn => {
      btn.addEventListener('click', () => {
        rState.seite = btn.dataset.seite;
        zeichneRegionenBereich(host, state);
      });
    });

    // NRS aktuell
    karte.querySelectorAll(`.btn-nrs-akt-${regId}`).forEach(btn => {
      btn.addEventListener('click', () => {
        const val = Number(btn.dataset.nrs);
        rState.nrs.aktuell = rState.nrs.aktuell === val ? null : val;
        zeichneRegionenBereich(host, state);
      });
    });

    // NRS Ruhe/Belastung/Nacht
    karte.querySelectorAll(`.btn-nrs-zeit-${regId}`).forEach(btn => {
      btn.addEventListener('click', () => {
        const zeit = btn.dataset.zeit;
        const val = Number(btn.dataset.nrs);
        rState.nrs[zeit] = rState.nrs[zeit] === val ? null : val;
        zeichneRegionenBereich(host, state);
      });
    });

    // Charakter
    karte.querySelectorAll(`.btn-charakter-${regId}`).forEach(btn => {
      btn.addEventListener('click', () => {
        const charId = btn.dataset.char;
        if (!Array.isArray(rState.charakter)) rState.charakter = [];
        const idx = rState.charakter.indexOf(charId);
        if (idx >= 0) {
          rState.charakter.splice(idx, 1);
        } else {
          rState.charakter.push(charId);
        }
        zeichneRegionenBereich(host, state);
      });
    });

    kartenHost.appendChild(karte);

    // ROM Zeilen rendern
    zeichneRomZeilen(karte.querySelector(`#pdRomHost-${regId}`), regId, rState, vorherReg);

    // Kraft Zeilen rendern
    zeichneKraftZeilen(karte.querySelector(`#pdKraftHost-${regId}`), regId, rState, vorherReg);

    // Tests Zeilen rendern
    zeichneTestsZeilen(karte.querySelector(`#pdTestsHost-${regId}`), regId, rState);
  }
}

/**
 * Rendert die ROM-Zeilen mit 5-Grad-Steppern.
 */
function zeichneRomZeilen(hostEl, regId, rState, vorherReg) {
  if (!hostEl) return;
  const katBewegungen = ROM_BEWEGUNGEN[regId] || [];
  hostEl.innerHTML = '';

  for (const bew of katBewegungen) {
    if (!rState.rom[bew.id]) {
      rState.rom[bew.id] = {
        links: null,
        rechts: null,
        beidseits: null,
        schmerzhaft: { links: false, rechts: false, beidseits: false },
      };
    }
    const bState = rState.rom[bew.id];
    const vorBew = vorherReg.rom?.[bew.id] || {};

    const zeile = document.createElement('div');
    zeile.style.cssText = 'padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card-solid);';

    const renderStepper = (seiteKey, labelPrefix = '') => {
      const val = bState[seiteKey];
      const vorVal = vorBew[seiteKey];
      const isSchmerz = !!(bState.schmerzhaft && bState.schmerzhaft[seiteKey]);

      return `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          ${labelPrefix ? `<span style="font-size:12px;font-weight:600;min-width:20px;color:var(--text-muted);">${escapeHtml(labelPrefix)}</span>` : ''}
          <button type="button" class="btn btn-secondary btn-rom-minus" data-seite="${escapeHtml(seiteKey)}" style="min-height:44px;min-width:44px;font-weight:700;font-size:16px;">−5</button>
          <input type="number" class="form-input inp-rom-val" data-seite="${escapeHtml(seiteKey)}" min="0" max="360" step="5" placeholder="°" value="${val != null ? escapeHtml(val) : ''}" style="min-height:44px;width:64px;text-align:center;font-size:14px;box-sizing:border-box;">
          <button type="button" class="btn btn-secondary btn-rom-plus" data-seite="${escapeHtml(seiteKey)}" style="min-height:44px;min-width:44px;font-weight:700;font-size:16px;">+5</button>
          <button type="button" class="btn btn-sm btn-rom-schmerz" data-seite="${escapeHtml(seiteKey)}" style="min-height:44px;padding:0 10px;border-radius:6px;cursor:pointer;font-size:12px;${
            isSchmerz
              ? 'background:var(--danger);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--danger);'
              : 'background:var(--bg-input);color:var(--text-muted);border:1px solid var(--border);'
          }">
            schmerzhaft
          </button>
          ${vorVal != null ? `<span style="font-size:12px;color:var(--text-muted);white-space:nowrap;">(vorher: ${escapeHtml(vorVal)}°)</span>` : ''}
        </div>
      `;
    };

    zeile.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
        <span style="font-weight:600;font-size:13px;color:var(--text-main);">${escapeHtml(bew.label)}</span>
        <span style="font-size:12px;color:var(--text-muted);">Richtwert: ${escapeHtml(bew.richtwert || '—')}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${bew.seitig ? `
          ${renderStepper('links', 'L:')}
          ${renderStepper('rechts', 'R:')}
        ` : `
          ${renderStepper('beidseits', '')}
        `}
      </div>
    `;

    // Stepper Events
    zeile.querySelectorAll('.btn-rom-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = btn.dataset.seite;
        bState[s] = schrittWert(bState[s], -5, 0, 360);
        zeichneRomZeilen(hostEl, regId, rState, vorherReg);
      });
    });

    zeile.querySelectorAll('.btn-rom-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = btn.dataset.seite;
        bState[s] = schrittWert(bState[s], 5, 0, 360);
        zeichneRomZeilen(hostEl, regId, rState, vorherReg);
      });
    });

    zeile.querySelectorAll('.inp-rom-val').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const s = inp.dataset.seite;
        const v = e.target.value.trim();
        bState[s] = v !== '' ? Number(v) : null;
      });
    });

    zeile.querySelectorAll('.btn-rom-schmerz').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = btn.dataset.seite;
        if (!bState.schmerzhaft) bState.schmerzhaft = {};
        bState.schmerzhaft[s] = !bState.schmerzhaft[s];
        zeichneRomZeilen(hostEl, regId, rState, vorherReg);
      });
    });

    hostEl.appendChild(zeile);
  }
}

/**
 * Rendert die Kraft-Gruppen mit MFT-0–5-Chips.
 */
function zeichneKraftZeilen(hostEl, regId, rState, vorherReg) {
  if (!hostEl) return;
  const katKraft = KRAFT_GRUPPEN[regId] || [];
  hostEl.innerHTML = '';

  for (const grp of katKraft) {
    if (!rState.kraft[grp.id]) {
      rState.kraft[grp.id] = { links: null, rechts: null, beidseits: null };
    }
    const gState = rState.kraft[grp.id];
    const vorGrp = vorherReg.kraft?.[grp.id] || {};

    const zeile = document.createElement('div');
    zeile.style.cssText = 'padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card-solid);';

    const renderMftChips = (seiteKey, labelPrefix = '') => {
      const val = gState[seiteKey];
      const vorVal = vorGrp[seiteKey];

      return `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          ${labelPrefix ? `<span style="font-size:12px;font-weight:600;min-width:20px;color:var(--text-muted);">${escapeHtml(labelPrefix)}</span>` : ''}
          ${[0, 1, 2, 3, 4, 5].map(n => `
            <button type="button" class="btn btn-sm btn-mft" data-grp="${escapeHtml(grp.id)}" data-seite="${escapeHtml(seiteKey)}" data-val="${n}" style="min-height:44px;min-width:44px;border-radius:6px;font-weight:600;cursor:pointer;${
              val === n
                ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
                : 'background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);'
            }">
              ${n}
            </button>
          `).join('')}
          ${vorVal != null ? `<span style="font-size:12px;color:var(--text-muted);white-space:nowrap;">(vorher: ${escapeHtml(vorVal)}/5)</span>` : ''}
        </div>
      `;
    };

    zeile.innerHTML = `
      <div style="font-weight:600;font-size:13px;color:var(--text-main);margin-bottom:6px;">
        ${escapeHtml(grp.label)}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${grp.seitig ? `
          ${renderMftChips('links', 'L:')}
          ${renderMftChips('rechts', 'R:')}
        ` : `
          ${renderMftChips('beidseits', '')}
        `}
      </div>
    `;

    zeile.querySelectorAll('.btn-mft').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = btn.dataset.seite;
        const v = Number(btn.dataset.val);
        gState[s] = gState[s] === v ? null : v;
        zeichneKraftZeilen(hostEl, regId, rState, vorherReg);
      });
    });

    hostEl.appendChild(zeile);
  }
}

/**
 * Rendert die Tests mit Dreifach-Schalter (+ / − / nicht).
 */
function zeichneTestsZeilen(hostEl, regId, rState) {
  if (!hostEl) return;
  const katTests = TESTS[regId] || [];
  hostEl.innerHTML = '';

  for (const t of katTests) {
    if (!rState.tests[t.id]) {
      rState.tests[t.id] = t.seitig ? { links: 'nicht', rechts: 'nicht' } : 'nicht';
    }
    const tState = rState.tests[t.id];

    const zeile = document.createElement('div');
    zeile.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card-solid);';

    const renderTestToggle = (seiteKey, labelPrefix = '') => {
      const curVal = t.seitig ? (tState?.[seiteKey] || 'nicht') : (tState || 'nicht');
      const badgeText = curVal === 'plus' ? '+ Positiv' : curVal === 'minus' ? '− Negativ' : 'Nicht getestet';
      const badgeStyle = curVal === 'plus'
        ? 'background:var(--danger);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--danger);'
        : curVal === 'minus'
        ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
        : 'background:var(--bg-input);color:var(--text-muted);border:1px solid var(--border);';

      return `
        <div style="display:flex;align-items:center;gap:6px;">
          ${labelPrefix ? `<span style="font-size:12px;font-weight:600;min-width:20px;color:var(--text-muted);">${escapeHtml(labelPrefix)}</span>` : ''}
          <button type="button" class="btn btn-sm btn-test-toggle" data-test="${escapeHtml(t.id)}" data-seite="${escapeHtml(seiteKey || '')}" style="min-height:44px;min-width:110px;padding:0 12px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;${badgeStyle}">
            ${escapeHtml(badgeText)}
          </button>
        </div>
      `;
    };

    zeile.innerHTML = `
      <span style="font-weight:600;font-size:13px;color:var(--text-main);">${escapeHtml(t.label)}</span>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        ${t.seitig ? `
          ${renderTestToggle('links', 'L:')}
          ${renderTestToggle('rechts', 'R:')}
        ` : `
          ${renderTestToggle('', '')}
        `}
      </div>
    `;

    zeile.querySelectorAll('.btn-test-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = btn.dataset.seite;
        if (t.seitig && s) {
          if (typeof rState.tests[t.id] !== 'object') rState.tests[t.id] = {};
          rState.tests[t.id][s] = naechsterTestWert(rState.tests[t.id][s]);
        } else {
          rState.tests[t.id] = naechsterTestWert(rState.tests[t.id]);
        }
        zeichneTestsZeilen(hostEl, regId, rState);
      });
    });

    hostEl.appendChild(zeile);
  }
}

/**
 * Zeichnet Inspektion & Palpation Chips ("unauffaellig" exklusiv).
 */
function zeichneInspektionPalpation(host, state) {
  const inspHost = host.querySelector('#pdInspChipsHost');
  const palpHost = host.querySelector('#pdPalpChipsHost');

  if (inspHost) {
    inspHost.innerHTML = '';
    for (const item of INSPEKTION) {
      const active = Array.isArray(state.inspektion?.auswahl) && state.inspektion.auswahl.includes(item.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm';
      btn.style.cssText = `min-height:44px;padding:0 12px;border-radius:22px;cursor:pointer;font-size:13px;${
        active
          ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
          : 'background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);'
      }`;
      btn.textContent = item.label;

      btn.addEventListener('click', () => {
        if (!Array.isArray(state.inspektion.auswahl)) state.inspektion.auswahl = [];
        if (item.exklusiv) {
          state.inspektion.auswahl = active ? [] : [item.id];
        } else {
          state.inspektion.auswahl = state.inspektion.auswahl.filter(id => id !== 'unauffaellig');
          const idx = state.inspektion.auswahl.indexOf(item.id);
          if (idx >= 0) state.inspektion.auswahl.splice(idx, 1);
          else state.inspektion.auswahl.push(item.id);
        }
        zeichneInspektionPalpation(host, state);
      });

      inspHost.appendChild(btn);
    }
  }

  if (palpHost) {
    palpHost.innerHTML = '';
    for (const item of PALPATION) {
      const active = Array.isArray(state.palpation?.auswahl) && state.palpation.auswahl.includes(item.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm';
      btn.style.cssText = `min-height:44px;padding:0 12px;border-radius:22px;cursor:pointer;font-size:13px;${
        active
          ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
          : 'background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);'
      }`;
      btn.textContent = item.label;

      btn.addEventListener('click', () => {
        if (!Array.isArray(state.palpation.auswahl)) state.palpation.auswahl = [];
        if (item.exklusiv) {
          state.palpation.auswahl = active ? [] : [item.id];
        } else {
          state.palpation.auswahl = state.palpation.auswahl.filter(id => id !== 'unauffaellig');
          const idx = state.palpation.auswahl.indexOf(item.id);
          if (idx >= 0) state.palpation.auswahl.splice(idx, 1);
          else state.palpation.auswahl.push(item.id);
        }
        zeichneInspektionPalpation(host, state);
      });

      palpHost.appendChild(btn);
    }
  }
}

/**
 * Zeichnet die ADL-Chips.
 */
function zeichneAdlChips(host, state) {
  const adlHost = host.querySelector('#pdAdlChipsHost');
  if (!adlHost) return;
  adlHost.innerHTML = '';

  for (const item of ADL) {
    const active = Array.isArray(state.adl?.auswahl) && state.adl.auswahl.includes(item.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm';
    btn.style.cssText = `min-height:44px;padding:0 14px;border-radius:22px;cursor:pointer;font-size:13px;${
      active
        ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
        : 'background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);'
    }`;
    btn.textContent = item.label;

    btn.addEventListener('click', () => {
      if (!Array.isArray(state.adl.auswahl)) state.adl.auswahl = [];
      const idx = state.adl.auswahl.indexOf(item.id);
      if (idx >= 0) state.adl.auswahl.splice(idx, 1);
      else state.adl.auswahl.push(item.id);
      zeichneAdlChips(host, state);
    });

    adlHost.appendChild(btn);
  }
}

/**
 * Zeichnet die Ziele-Inputs und deren Erreicht-Chips.
 */
function zeichneZieleBereich(host, state) {
  const zieleHost = host.querySelector('#pdZieleInputsHost');
  if (!zieleHost) return;

  if (!Array.isArray(state.ziele) || state.ziele.length === 0) {
    state.ziele = [{ text: '', erreicht: null }];
  }

  // Sicherstellen, dass bis zu 3 Slots moeglich sind
  while (state.ziele.length < 3) {
    state.ziele.push({ text: '', erreicht: null });
  }

  zieleHost.innerHTML = '';
  state.ziele.forEach((ziel, idx) => {
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);';

    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-weight:600;font-size:13px;color:var(--text-muted);min-width:44px;">Ziel ${idx + 1}:</span>
        <input type="text" class="form-input inp-ziel-text" data-idx="${idx}" placeholder="z. B. Schmerzfreies Gehen..." value="${escapeHtml(ziel.text || '')}" style="min-height:44px;flex:1;box-sizing:border-box;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:13px;">
      </div>
      ${(state.befundart === 'zwischen' || state.befundart === 'abschluss') ? `
        <div style="display:flex;align-items:center;gap:8px;padding-left:52px;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--text-muted);">Erreicht:</span>
          ${ZIEL_ERREICHT.map(ze => `
            <button type="button" class="btn btn-sm btn-ziel-erreicht" data-idx="${idx}" data-val="${escapeHtml(ze.id)}" style="min-height:44px;padding:0 12px;border-radius:6px;cursor:pointer;font-size:12px;${
              ziel.erreicht === ze.id
                ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
                : 'background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);'
            }">
              ${escapeHtml(ze.label)}
            </button>
          `).join('')}
        </div>
      ` : ''}
    `;

    box.querySelector('.inp-ziel-text').addEventListener('input', (e) => {
      state.ziele[idx].text = e.target.value;
    });

    box.querySelectorAll('.btn-ziel-erreicht').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        state.ziele[idx].erreicht = state.ziele[idx].erreicht === val ? null : val;
        zeichneZieleBereich(host, state);
      });
    });

    zieleHost.appendChild(box);
  });

  zeichneZieleVorschlaege(host, state);
}

/**
 * Zeichnet Vorschlagschips fuer Ziele basierend auf den ausgewaehlten Regionen.
 */
function zeichneZieleVorschlaege(host, state) {
  const vorschlaegeHost = host.querySelector('#pdZielVorschlaegeChips');
  if (!vorschlaegeHost) return;
  vorschlaegeHost.innerHTML = '';

  const regKeys = Object.keys(state.regionen || {});
  const gesammelteVorschlaege = [];

  for (const rKey of regKeys) {
    const list = ZIEL_VORSCHLAEGE[rKey] || [];
    for (const v of list) {
      if (!gesammelteVorschlaege.includes(v)) gesammelteVorschlaege.push(v);
    }
  }

  if (gesammelteVorschlaege.length === 0) {
    vorschlaegeHost.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Wählen Sie oben Regionen aus, um Zielvorschläge zu erhalten.</span>';
    return;
  }

  for (const v of gesammelteVorschlaege) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm';
    btn.style.cssText = 'min-height:44px;padding:0 12px;border-radius:18px;cursor:pointer;font-size:12px;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);text-align:left;';
    btn.textContent = '+ ' + v;

    btn.addEventListener('click', () => {
      if (!Array.isArray(state.ziele)) state.ziele = [];
      // In erstes leeres Ziel eintragen oder an Ziel 1 anhaengen
      let targetZiel = state.ziele.find(z => !z.text || z.text.trim().length === 0);
      if (!targetZiel) {
        if (state.ziele.length < 3) {
          targetZiel = { text: '', erreicht: null };
          state.ziele.push(targetZiel);
        } else {
          targetZiel = state.ziele[0];
        }
      }
      targetZiel.text = v;
      zeichneZieleBereich(host, state);
    });

    vorschlaegeHost.appendChild(btn);
  }
}

/**
 * Zeichnet die Maßnahmen-Chips im Therapieplan.
 */
function zeichneMassnahmenChips(host, state) {
  const massHost = host.querySelector('#pdMassnahmenChipsHost');
  if (!massHost) return;
  massHost.innerHTML = '';

  for (const item of MASSNAHMEN) {
    const active = Array.isArray(state.therapieplan?.massnahmen) && state.therapieplan.massnahmen.includes(item.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm';
    btn.style.cssText = `min-height:44px;padding:0 14px;border-radius:22px;cursor:pointer;font-size:13px;${
      active
        ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
        : 'background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);'
    }`;
    btn.textContent = item.label;

    btn.addEventListener('click', () => {
      if (!Array.isArray(state.therapieplan.massnahmen)) state.therapieplan.massnahmen = [];
      const idx = state.therapieplan.massnahmen.indexOf(item.id);
      if (idx >= 0) state.therapieplan.massnahmen.splice(idx, 1);
      else state.therapieplan.massnahmen.push(item.id);
      zeichneMassnahmenChips(host, state);
    });

    massHost.appendChild(btn);
  }
}

/**
 * Zeichnet Verlauf- und Folge-VO-Chips.
 */
function zeichneVerlaufChips(host, state) {
  const verlaufHost = host.querySelector('#pdVerlaufChipsHost');
  if (verlaufHost) {
    verlaufHost.innerHTML = '';
    for (const item of VERLAUF) {
      const active = state.verlauf === item.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm';
      btn.style.cssText = `min-height:44px;padding:0 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;${
        active
          ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
          : 'background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);'
      }`;
      btn.textContent = item.label;

      btn.addEventListener('click', () => {
        state.verlauf = state.verlauf === item.id ? null : item.id;
        zeichneVerlaufChips(host, state);
      });

      verlaufHost.appendChild(btn);
    }
  }

  const folgeHost = host.querySelector('#pdFolgeVoChipsHost');
  if (folgeHost) {
    folgeHost.innerHTML = '';
    const optionen = [
      { id: 'ja', label: 'Ja, Folge-VO empfohlen' },
      { id: 'nein', label: 'Nein, keine Folge-VO erforderlich' },
    ];
    for (const opt of optionen) {
      const active = state.empfehlung?.folge_vo === opt.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm';
      btn.style.cssText = `min-height:44px;padding:0 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;${
        active
          ? 'background:var(--primary);color:var(--on-accent, var(--bg-card-solid));border:1px solid var(--primary);'
          : 'background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);'
      }`;
      btn.textContent = opt.label;

      btn.addEventListener('click', () => {
        state.empfehlung.folge_vo = state.empfehlung.folge_vo === opt.id ? null : opt.id;
        zeichneVerlaufChips(host, state);
      });

      folgeHost.appendChild(btn);
    }
  }
}
