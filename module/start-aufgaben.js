/**
 * start-aufgaben.js — Manuelle Praxis-Aufgaben auf der Startseite (K10).
 * Freitext, optional fällig, optional mit Patient verknüpft.
 */

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatiereDatum(iso) {
  if (!iso) return '';
  const parts = String(iso).slice(0, 10).split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return String(iso);
}

export function holeHeuteISO() {
  // Kalendertag in Europe/Berlin (en-CA liefert JJJJ-MM-TT), unabhaengig von der Geraetezeitzone.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}

export function bereinigeText(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

export function istUeberfaellig(aufgabe, heuteISO) {
  if (!aufgabe || !aufgabe.faellig_am || aufgabe.erledigt_at) return false;
  const h = String(heuteISO || '').slice(0, 10);
  const f = String(aufgabe.faellig_am || '').slice(0, 10);
  if (!f || !h) return false;
  return f < h;
}

export function darfLoeschen(aufgabe, { userId, istInhaber } = {}) {
  if (!aufgabe) return false;
  const owner = typeof istInhaber === 'function' ? istInhaber() : Boolean(istInhaber);
  if (owner) return true;
  const uid = typeof userId === 'function' ? userId() : userId;
  if (!uid) return false;
  return aufgabe.erstellt_von === uid;
}

export function sortiereOffene(liste, heuteISO) {
  const offene = (liste || []).filter((x) => !x.erledigt_at);
  return offene.slice().sort((a, b) => {
    const fa = a.faellig_am ? String(a.faellig_am).slice(0, 10) : null;
    const fb = b.faellig_am ? String(b.faellig_am).slice(0, 10) : null;
    if (fa && !fb) return -1;
    if (!fa && fb) return 1;
    if (fa && fb && fa !== fb) {
      return fa.localeCompare(fb);
    }
    const ca = a.created_at || '';
    const cb = b.created_at || '';
    return ca.localeCompare(cb);
  });
}

export function letzteErledigte(liste, n = 5) {
  const erledigte = (liste || []).filter((x) => Boolean(x.erledigt_at));
  erledigte.sort((a, b) => {
    const ea = a.erledigt_at || '';
    const eb = b.erledigt_at || '';
    return eb.localeCompare(ea);
  });
  return erledigte.slice(0, Math.max(0, n));
}

/**
 * Standort-Auswahl fuer neue Aufgaben. Nur bei mehreren Standorten; vorgewaehlt ist
 * der aktive, damit eine Aufgabe ohne Zutun dort landet, wo man gerade arbeitet.
 * @param {Array<{id: string, name?: string}>} standorte
 * @param {?string} aktivId
 * @returns {?{optionen: Array<{id: string, name: string}>, gewaehlt: string}}
 */
export function standortAuswahl(standorte, aktivId) {
  const liste = standorte || [];
  if (liste.length < 2) return null;
  const optionen = liste.map((b) => ({ id: b.id, name: b.name || 'Standort' }));
  const gewaehlt = optionen.some((o) => o.id === aktivId) ? aktivId : optionen[0].id;
  return { optionen, gewaehlt };
}

/**
 * Standort-Name fuer die Zeile, wenn die Aufgabe zu einem anderen Standort gehoert
 * (sichtbar nur bei Datenfreigabe zwischen Standorten).
 */
export function fremderStandortName(aufgabe, standorte, aktivId) {
  const id = aufgabe?.business_id;
  if (!id || id === aktivId) return '';
  return (standorte || []).find((b) => b.id === id)?.name || '';
}

/**
 * Abfrage, Treffer und Anzeige der Patientensuche gehoeren dem Aufrufer: dieselben
 * wie in den anderen Masken (bizScope, Geburtsdatum, beide Rufnummern). Die eigene
 * Abfrage verlangte eine nicht vorhandene Spalte und verschluckte den Fehler —
 * die Suche fand deshalb nie jemanden.
 * @param {object} ctx
 */
export function patientenSucheOptionen(ctx) {
  return {
    loadLeads: async () => {
      try {
        return (await ctx.ladePatienten()) || [];
      } catch {
        ctx.showToast?.('Patienten konnten nicht geladen werden.', 'error');
        return [];
      }
    },
    matches: ctx.patientPasst,
    labelOf: ctx.patientLabel,
  };
}

/**
 * @param {object} ctx
 * @param {object} ctx.supabase
 * @param {() => string} ctx.getOwnerId
 * @param {string | (() => ?string)} ctx.userId
 * @param {boolean | (() => boolean)} ctx.istInhaber
 * @param {(msg: string, typ?: string) => void} ctx.showToast
 * @param {Function} [ctx.showConfirmModal]
 * @param {Function} [ctx.attachPatientSearch]
 * @param {() => Promise<Array>} [ctx.ladePatienten] wirft bei Fehler
 * @param {(lead: object, q: string) => boolean} [ctx.patientPasst]
 * @param {(lead: object) => string} [ctx.patientLabel]
 * @param {() => Array<{id: string, name?: string}>} [ctx.getStandorte]
 * @param {() => ?string} [ctx.getBusinessId] aktiver Standort
 * @param {(query: object, kategorie: string) => object} [ctx.bizScope]
 * @param {Document} [doc]
 * @returns {{ laden: () => Promise<void> }}
 */
export function mountStartAufgaben(ctx, doc = document) {
  const root = doc.getElementById('startAufgaben');
  if (!root) {
    return { async laden() {} };
  }

  if (root.dataset.startAufgabenMounted === '1') {
    return root._startAufgabenApi || { async laden() {} };
  }
  root.dataset.startAufgabenMounted = '1';

  let gewaehlterPatient = null;
  let gespeicherteAufgaben = [];
  let gespeicherteLeads = new Map();

  const CLOSE_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  const LINK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M16 11h6"/></svg>';

  root.innerHTML = `
    <div class="card sa-card">
      <div class="sa-head">
        <div class="sa-head-title">
          <h3>Aufgaben</h3>
          <span id="startAufgabenCount" class="sa-count">0</span>
        </div>
      </div>

      <form id="startAufgabeForm" class="sa-form">
        <div class="sa-form-row">
          <input type="text" id="startAufgabeInput" class="sa-input" maxlength="500" placeholder="Neue Aufgabe …" />
          <input type="date" id="startAufgabeFaellig" class="sa-date" title="Fällig am" aria-label="Fällig am" />
          <button type="button" id="startAufgabePatientToggle" class="btn-ghost sa-pat-toggle">
            ${LINK_SVG}<span>Patient verknüpfen</span>
          </button>
          <div id="startAufgabePatientChip" class="sa-pat-chip" style="display:none;">
            <span id="startAufgabePatientChipName" class="sa-pat-chip-name"></span>
            <button type="button" id="startAufgabePatientRemove" class="sa-icon-btn" aria-label="Patientenbezug entfernen" title="Verknüpfung entfernen">${CLOSE_SVG}</button>
          </div>
          <select id="startAufgabeStandort" class="sa-select" hidden title="Standort" aria-label="Standort"></select>
          <button type="submit" id="startAufgabeAddBtn" class="btn-primary sa-submit">Hinzufügen</button>
        </div>

        <div id="startAufgabePatientBox" class="sa-pat-box" style="display:none;">
          <input type="text" id="startAufgabePatientSearch" class="sa-input" placeholder="Patient suchen (Name, Telefon, Geburtsdatum) …" autocomplete="off" />
          <ul id="startAufgabePatientList" class="patient-search-list" hidden></ul>
        </div>

        <p class="sa-hint">Patientenbezug bitte verknüpfen, statt Namen in den Text zu schreiben.</p>
      </form>

      <ul id="startAufgabenOffenListe" class="sa-list">
        <li class="sa-empty">Keine offenen Aufgaben.</li>
      </ul>

      <details id="startAufgabenDetails" class="sa-done-details">
        <summary class="sa-done-summary">Erledigt (zuletzt 5)</summary>
        <ul id="startAufgabenErledigtListe" class="sa-list sa-list--done">
          <li class="sa-empty">Keine erledigten Aufgaben.</li>
        </ul>
      </details>
    </div>
  `;

  const form = doc.getElementById('startAufgabeForm');
  const textInput = doc.getElementById('startAufgabeInput');
  const faelligInput = doc.getElementById('startAufgabeFaellig');
  const patientToggle = doc.getElementById('startAufgabePatientToggle');
  const patientChip = doc.getElementById('startAufgabePatientChip');
  const patientChipName = doc.getElementById('startAufgabePatientChipName');
  const patientRemove = doc.getElementById('startAufgabePatientRemove');
  const patientBox = doc.getElementById('startAufgabePatientBox');
  const patientSearch = doc.getElementById('startAufgabePatientSearch');
  const patientList = doc.getElementById('startAufgabePatientList');
  const standortSelect = doc.getElementById('startAufgabeStandort');
  const offenListe = doc.getElementById('startAufgabenOffenListe');
  const erledigtListe = doc.getElementById('startAufgabenErledigtListe');

  function aktualisierePatientenAnzeige() {
    if (!patientToggle || !patientChip || !patientChipName) return;
    if (gewaehlterPatient) {
      patientToggle.style.display = 'none';
      patientChip.style.display = 'inline-flex';
      const name = `${gewaehlterPatient.first_name || ''} ${gewaehlterPatient.last_name || ''}`.trim() || gewaehlterPatient.title || 'Patient';
      patientChipName.textContent = name;
    } else {
      patientToggle.style.display = 'inline-flex';
      patientChip.style.display = 'none';
      patientChipName.textContent = '';
    }
  }

  if (patientToggle && patientBox) {
    patientToggle.addEventListener('click', () => {
      const isHidden = patientBox.style.display === 'none';
      patientBox.style.display = isHidden ? 'block' : 'none';
      if (isHidden && patientSearch) {
        patientSearch.focus();
      }
    });
  }

  if (patientRemove) {
    patientRemove.addEventListener('click', () => {
      gewaehlterPatient = null;
      aktualisierePatientenAnzeige();
      if (patientSearch) patientSearch.value = '';
    });
  }

  if (patientSearch && typeof ctx.attachPatientSearch === 'function') {
    ctx.attachPatientSearch(patientSearch, {
      listEl: patientList,
      containerEl: patientBox,
      ...patientenSucheOptionen(ctx),
      onSelect: (lead) => {
        gewaehlterPatient = lead;
        if (patientBox) patientBox.style.display = 'none';
        if (patientSearch) patientSearch.value = '';
        aktualisierePatientenAnzeige();
      },
    });
  }

  const standorte = () => (typeof ctx.getStandorte === 'function' ? ctx.getStandorte() : []) || [];
  const aktiverStandort = () => (typeof ctx.getBusinessId === 'function' ? ctx.getBusinessId() : null);

  // Die Standorte stehen erst nach dem Start fest, darum nicht beim Mount. Eine laufende Auswahl bleibt.
  function aktualisiereStandortAuswahl() {
    if (!standortSelect) return;
    const auswahl = standortAuswahl(standorte(), aktiverStandort());
    standortSelect.hidden = !auswahl;
    if (!auswahl) { standortSelect.innerHTML = ''; return; }
    const bisher = standortSelect.value;
    standortSelect.innerHTML = auswahl.optionen
      .map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');
    standortSelect.value = auswahl.optionen.some((o) => o.id === bisher) ? bisher : auswahl.gewaehlt;
  }

  function standortMarke(a) {
    const name = fremderStandortName(a, standorte(), aktiverStandort());
    return name ? `<span class="sa-pill">${esc(name)}</span>` : '';
  }

  function renderListen() {
    const heuteISO = holeHeuteISO();
    const offene = sortiereOffene(gespeicherteAufgaben, heuteISO);
    const erledigte = letzteErledigte(gespeicherteAufgaben, 5);

    const countBadge = doc.getElementById('startAufgabenCount');
    if (countBadge) countBadge.textContent = String(offene.length);

    if (offenListe) {
      if (offene.length === 0) {
        offenListe.innerHTML = `<li class="sa-empty">Keine offenen Aufgaben.</li>`;
      } else {
        offenListe.innerHTML = offene.map((a) => {
          const ueberfaellig = istUeberfaellig(a, heuteISO);
          const faelligHtml = a.faellig_am
            ? `<span class="sa-due${ueberfaellig ? ' sa-due--overdue' : ''}">${ueberfaellig ? 'Überfällig · ' : ''}${formatiereDatum(a.faellig_am)}</span>`
            : '';
          const patientName = a.lead_id ? (gespeicherteLeads.get(a.lead_id) || '') : '';
          const patientHtml = patientName ? `<span class="sa-pill">${esc(patientName)}</span>` : '';
          const canDel = darfLoeschen(a, { userId: ctx.userId, istInhaber: ctx.istInhaber });
          const deleteBtnHtml = canDel
            ? `<button type="button" class="aufgabe-delete-btn sa-icon-btn sa-del-btn" data-id="${esc(a.id)}" title="Aufgabe löschen" aria-label="Aufgabe löschen">${CLOSE_SVG}</button>`
            : '';

          return `<li class="sa-row">
            <button type="button" class="aufgabe-check-btn sa-check-btn" data-id="${esc(a.id)}" title="Als erledigt markieren" aria-label="Als erledigt markieren">
              <span class="einrichtung-aufgabe-kreis sa-kreis" aria-hidden="true"></span>
            </button>
            <span class="einrichtung-aufgabe-text sa-text">${esc(a.text)}</span>
            <span class="sa-row-meta">${faelligHtml}${patientHtml}${standortMarke(a)}</span>
            ${deleteBtnHtml}
          </li>`;
        }).join('');
      }
    }

    if (erledigtListe) {
      if (erledigte.length === 0) {
        erledigtListe.innerHTML = `<li class="sa-empty">Keine erledigten Aufgaben.</li>`;
      } else {
        erledigtListe.innerHTML = erledigte.map((a) => {
          const patientName = a.lead_id ? (gespeicherteLeads.get(a.lead_id) || '') : '';
          const patientHtml = patientName ? `<span class="sa-pill">${esc(patientName)}</span>` : '';
          return `<li class="einrichtung-aufgabe-fertig sa-row sa-row--done">
            <span class="einrichtung-aufgabe-kreis sa-kreis sa-kreis--done" aria-hidden="true">${CHECK_SVG}</span>
            <span class="einrichtung-aufgabe-text sa-text sa-text--done">${esc(a.text)}</span>
            ${patientHtml}
            <button type="button" class="aufgabe-undo-btn sa-undo-btn" data-id="${esc(a.id)}" title="Aufgabe wieder öffnen">Rückgängig</button>
          </li>`;
        }).join('');
      }
    }
  }

  async function laden() {
    let ownerId = null;
    try { ownerId = typeof ctx.getOwnerId === 'function' ? ctx.getOwnerId() : ctx.getOwnerId; } catch { ownerId = null; }  // vor dem Login ist das Profil noch leer
    if (!ownerId || !ctx.supabase) return;

    aktualisiereStandortAuswahl();

    try {
      const abfrage = ctx.supabase
        .from('praxis_aufgaben')
        .select('id, owner_id, business_id, lead_id, text, faellig_am, erledigt_at, erledigt_von, erstellt_von, created_at, updated_at')
        .eq('owner_id', ownerId);
      const { data, error } = await (ctx.bizScope ? ctx.bizScope(abfrage, 'activities') : abfrage);

      if (error) {
        if (ctx.showToast) ctx.showToast('Fehler beim Laden der Aufgaben: ' + error.message, 'error');
        return;
      }
      gespeicherteAufgaben = data || [];
    } catch (err) {
      if (ctx.showToast) ctx.showToast('Fehler beim Laden der Aufgaben: ' + (err.message || err), 'error');
      return;
    }

    const leadIds = Array.from(new Set(gespeicherteAufgaben.map((a) => a.lead_id).filter(Boolean)));
    gespeicherteLeads = new Map();
    if (leadIds.length > 0) {
      try {
        const { data: leads, error: leadErr } = await ctx.supabase
          .from('leads')
          .select('id, first_name, last_name, title')
          .in('id', leadIds)
          .eq('owner_id', ownerId);
        if (!leadErr && leads) {
          for (const l of leads) {
            const name = `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.title || 'Patient';
            gespeicherteLeads.set(l.id, name);
          }
        }
      } catch {
        // Nicht abbrechen, wenn Patientenliste fehlschlaegt
      }
    }

    renderListen();
  }

  async function fuegeAufgabeHinzu() {
    if (!textInput) return;
    const text = bereinigeText(textInput.value);
    if (!text) {
      if (ctx.showToast) ctx.showToast('Bitte einen Aufgabentext eingeben', 'error');
      return;
    }

    const ownerId = typeof ctx.getOwnerId === 'function' ? ctx.getOwnerId() : ctx.getOwnerId;
    if (!ownerId) {
      if (ctx.showToast) ctx.showToast('Mandant nicht gefunden', 'error');
      return;
    }

    const faellig = faelligInput?.value ? faelligInput.value : null;
    const leadId = gewaehlterPatient?.id || null;
    const uid = typeof ctx.userId === 'function' ? ctx.userId() : ctx.userId;

    const payload = {
      owner_id: ownerId,
      text,
      faellig_am: faellig,
      lead_id: leadId,
    };
    if (uid) {
      payload.erstellt_von = uid;
    }
    // Ohne Angabe setzt der Trigger den Standard-Standort, nicht den aktiven.
    const standortId = (standortSelect && !standortSelect.hidden && standortSelect.value) || aktiverStandort();
    if (standortId) {
      payload.business_id = standortId;
    }

    const { error } = await ctx.supabase
      .from('praxis_aufgaben')
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) {
      if (ctx.showToast) ctx.showToast('Fehler beim Erstellen: ' + error.message, 'error');
      return;
    }

    textInput.value = '';
    if (faelligInput) faelligInput.value = '';
    gewaehlterPatient = null;
    aktualisierePatientenAnzeige();
    if (patientBox) patientBox.style.display = 'none';

    if (ctx.showToast) {
      const anderer = fremderStandortName({ business_id: standortId }, standorte(), aktiverStandort());
      ctx.showToast(anderer ? `Aufgabe für „${anderer}" erstellt` : 'Aufgabe erstellt', 'success');
    }
    await laden();
  }

  async function markiereErledigt(id) {
    const ownerId = typeof ctx.getOwnerId === 'function' ? ctx.getOwnerId() : ctx.getOwnerId;
    const uid = typeof ctx.userId === 'function' ? ctx.userId() : ctx.userId;
    if (!ownerId || !id) return;

    const { error } = await ctx.supabase
      .from('praxis_aufgaben')
      .update({
        erledigt_at: new Date().toISOString(),
        erledigt_von: uid || null,
      })
      .eq('id', id)
      .eq('owner_id', ownerId);

    if (error) {
      if (ctx.showToast) ctx.showToast('Fehler beim Abschließen: ' + error.message, 'error');
      return;
    }

    await laden();
  }

  async function macheRueckgaengig(id) {
    const ownerId = typeof ctx.getOwnerId === 'function' ? ctx.getOwnerId() : ctx.getOwnerId;
    if (!ownerId || !id) return;

    const { error } = await ctx.supabase
      .from('praxis_aufgaben')
      .update({
        erledigt_at: null,
        erledigt_von: null,
      })
      .eq('id', id)
      .eq('owner_id', ownerId);

    if (error) {
      if (ctx.showToast) ctx.showToast('Fehler beim Wiederherstellen: ' + error.message, 'error');
      return;
    }

    await laden();
  }

  async function loescheAufgabe(id) {
    const ownerId = typeof ctx.getOwnerId === 'function' ? ctx.getOwnerId() : ctx.getOwnerId;
    if (!ownerId || !id) return;

    let ok = false;
    if (typeof ctx.showConfirmModal === 'function') {
      ok = await ctx.showConfirmModal({
        title: 'Aufgabe löschen',
        message: 'Möchten Sie diese Aufgabe wirklich löschen?',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        variant: 'danger',
      });
    } else if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      ok = window.confirm('Möchten Sie diese Aufgabe wirklich löschen?');
    } else {
      ok = true;
    }

    if (!ok) return;

    const { error } = await ctx.supabase
      .from('praxis_aufgaben')
      .delete()
      .eq('id', id)
      .eq('owner_id', ownerId);

    if (error) {
      if (ctx.showToast) ctx.showToast('Fehler beim Löschen: ' + error.message, 'error');
      return;
    }

    if (ctx.showToast) ctx.showToast('Aufgabe gelöscht', 'success');
    await laden();
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      fuegeAufgabeHinzu();
    });
  }

  if (offenListe) {
    offenListe.addEventListener('click', (e) => {
      const checkBtn = e.target.closest('.aufgabe-check-btn');
      if (checkBtn) {
        e.preventDefault();
        const id = checkBtn.dataset.id;
        if (id) markiereErledigt(id);
        return;
      }
      const delBtn = e.target.closest('.aufgabe-delete-btn');
      if (delBtn) {
        e.preventDefault();
        const id = delBtn.dataset.id;
        if (id) loescheAufgabe(id);
      }
    });
  }

  if (erledigtListe) {
    erledigtListe.addEventListener('click', (e) => {
      const undoBtn = e.target.closest('.aufgabe-undo-btn');
      if (undoBtn) {
        e.preventDefault();
        const id = undoBtn.dataset.id;
        if (id) macheRueckgaengig(id);
      }
    });
  }

  doc.addEventListener('praxura:uebersicht', () => {
    laden();
  });

  // Geladen wird, sobald die Uebersicht gezeichnet wird (Event aus renderOverview) — nicht beim Mount,
  // da das Profil dann noch nicht da ist.

  const api = { laden };
  root._startAufgabenApi = api;
  return api;
}
