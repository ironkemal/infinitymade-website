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
 * @param {object} ctx
 * @param {object} ctx.supabase
 * @param {() => string} ctx.getOwnerId
 * @param {string | (() => ?string)} ctx.userId
 * @param {boolean | (() => boolean)} ctx.istInhaber
 * @param {(msg: string, typ?: string) => void} ctx.showToast
 * @param {Function} [ctx.showConfirmModal]
 * @param {Function} [ctx.attachPatientSearch]
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

  root.innerHTML = `
    <div class="card" style="padding:16px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <h3 style="margin:0;font-size:15px;font-weight:700;color:var(--text-main);">Aufgaben</h3>
          <span id="startAufgabenCount" style="font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--bg-input);border:1px solid var(--border);color:var(--text-muted);">0</span>
        </div>
      </div>

      <form id="startAufgabeForm" style="margin-bottom:16px;">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
          <input type="text" id="startAufgabeInput" maxlength="500" placeholder="Neue Aufgabe …" style="flex:1 1 240px;min-height:44px;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);font-size:14px;box-sizing:border-box;" />
          <input type="date" id="startAufgabeFaellig" style="flex:0 1 145px;min-height:44px;padding:0 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);font-size:13px;box-sizing:border-box;" title="Fällig am" aria-label="Fällig am" />
          <button type="button" id="startAufgabePatientToggle" class="btn-ghost" style="flex:0 0 auto;min-height:44px;padding:0 12px;font-size:13px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--primary);border:1px dashed var(--border);border-radius:8px;background:none;box-sizing:border-box;">
            Patient verknüpfen
          </button>
          <div id="startAufgabePatientChip" style="display:none;align-items:center;gap:6px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;min-height:44px;box-sizing:border-box;">
            <span id="startAufgabePatientChipName" style="color:var(--text-main);font-weight:500;"></span>
            <button type="button" id="startAufgabePatientRemove" style="background:none;border:none;cursor:pointer;color:var(--text-muted);min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0;font-size:14px;" aria-label="Patientenbezug entfernen" title="Verknüpfung entfernen">✕</button>
          </div>
          <button type="submit" id="startAufgabeAddBtn" class="btn-primary" style="flex:0 0 auto;min-height:44px;padding:0 18px;font-size:14px;font-weight:600;border-radius:8px;cursor:pointer;box-sizing:border-box;">Hinzufügen</button>
        </div>

        <div id="startAufgabePatientBox" style="display:none;position:relative;margin-top:8px;">
          <input type="text" id="startAufgabePatientSearch" placeholder="Patient suchen (Name, Telefon, Geburtsdatum)…" autocomplete="off" style="width:100%;min-height:44px;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);font-size:14px;box-sizing:border-box;" />
          <ul id="startAufgabePatientList" class="patient-search-list" hidden></ul>
        </div>

        <div style="font-size:12px;color:var(--text-muted);margin-top:6px;line-height:1.4;">
          Patientenbezug bitte verknüpfen, statt Namen in den Text zu schreiben.
        </div>
      </form>

      <ul id="startAufgabenOffenListe" style="list-style:none;margin:0;padding:0;">
        <li style="padding:16px 0;font-size:13px;color:var(--text-muted);list-style:none;">Keine offenen Aufgaben</li>
      </ul>

      <details id="startAufgabenDetails" style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px;">
        <summary style="cursor:pointer;color:var(--text-muted);font-size:13px;font-weight:500;min-height:44px;display:inline-flex;align-items:center;user-select:none;">
          Erledigt (zuletzt 5)
        </summary>
        <ul id="startAufgabenErledigtListe" style="list-style:none;margin:8px 0 0;padding:0;">
          <li style="padding:8px 0;font-size:13px;color:var(--text-muted);list-style:none;">Keine erledigten Aufgaben</li>
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
      loadLeads: async () => {
        const ownerId = typeof ctx.getOwnerId === 'function' ? ctx.getOwnerId() : ctx.getOwnerId;
        if (!ownerId) return [];
        const { data, error } = await ctx.supabase
          .from('leads')
          .select('id, first_name, last_name, birth_date, phone, title')
          .eq('owner_id', ownerId)
          .order('last_name', { ascending: true });
        if (error) return [];
        return data || [];
      },
      matches: (lead, query) => {
        const q = String(query || '').toLowerCase().trim();
        const fn = (lead.first_name || '').toLowerCase();
        const ln = (lead.last_name || '').toLowerCase();
        const ph = (lead.phone || '').replace(/\s+/g, '');
        const full = `${fn} ${ln}`;
        return full.includes(q) || ln.includes(q) || ph.includes(q.replace(/\s+/g, ''));
      },
      labelOf: (l) => `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.title || 'Patient',
      onSelect: (lead) => {
        gewaehlterPatient = lead;
        if (patientBox) patientBox.style.display = 'none';
        if (patientSearch) patientSearch.value = '';
        aktualisierePatientenAnzeige();
      },
    });
  }

  function renderListen() {
    const heuteISO = holeHeuteISO();
    const offene = sortiereOffene(gespeicherteAufgaben, heuteISO);
    const erledigte = letzteErledigte(gespeicherteAufgaben, 5);

    const countBadge = doc.getElementById('startAufgabenCount');
    if (countBadge) countBadge.textContent = String(offene.length);

    if (offenListe) {
      if (offene.length === 0) {
        offenListe.innerHTML = `<li style="padding:16px 0;font-size:13px;color:var(--text-muted);list-style:none;">Keine offenen Aufgaben</li>`;
      } else {
        offenListe.innerHTML = offene.map((a) => {
          const ueberfaellig = istUeberfaellig(a, heuteISO);
          const faelligHtml = a.faellig_am
            ? `<span style="font-size:12px;white-space:nowrap;${ueberfaellig ? 'color:var(--danger);font-weight:600;' : 'color:var(--text-muted);'}">
                ${ueberfaellig ? '⚠ ' : ''}${formatiereDatum(a.faellig_am)}
               </span>`
            : '';
          const patientName = a.lead_id ? (gespeicherteLeads.get(a.lead_id) || '') : '';
          const patientHtml = patientName
            ? `<span style="font-size:12px;color:var(--text-muted);background:var(--bg-input);padding:2px 8px;border-radius:4px;border:1px solid var(--border);white-space:nowrap;">
                ${esc(patientName)}
               </span>`
            : '';
          const canDel = darfLoeschen(a, { userId: ctx.userId, istInhaber: ctx.istInhaber });
          const deleteBtnHtml = canDel
            ? `<button type="button" class="aufgabe-delete-btn" data-id="${esc(a.id)}" style="min-width:44px;min-height:44px;background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;display:inline-flex;align-items:center;justify-content:center;padding:0;margin-left:auto;" title="Aufgabe löschen" aria-label="Aufgabe löschen">✕</button>`
            : '';

          return `<li style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid var(--border);min-height:44px;">
            <button type="button" class="aufgabe-check-btn" data-id="${esc(a.id)}" style="min-width:44px;min-height:44px;background:none;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;" title="Als erledigt markieren" aria-label="Als erledigt markieren">
              <span class="einrichtung-aufgabe-kreis" aria-hidden="true"></span>
            </button>
            <span class="einrichtung-aufgabe-text" style="color:var(--text-main);font-size:14px;word-break:break-word;">
              ${esc(a.text)}
            </span>
            ${faelligHtml}
            ${patientHtml}
            ${deleteBtnHtml}
          </li>`;
        }).join('');
      }
    }

    if (erledigtListe) {
      if (erledigte.length === 0) {
        erledigtListe.innerHTML = `<li style="padding:8px 0;font-size:13px;color:var(--text-muted);list-style:none;">Keine erledigten Aufgaben</li>`;
      } else {
        erledigtListe.innerHTML = erledigte.map((a) => {
          const patientName = a.lead_id ? (gespeicherteLeads.get(a.lead_id) || '') : '';
          const patientHtml = patientName
            ? `<span style="font-size:12px;color:var(--text-muted);background:var(--bg-input);padding:2px 8px;border-radius:4px;border:1px solid var(--border);white-space:nowrap;">
                ${esc(patientName)}
               </span>`
            : '';
          return `<li class="einrichtung-aufgabe-fertig" style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid var(--border);min-height:44px;">
            <span class="einrichtung-aufgabe-kreis" aria-hidden="true">✓</span>
            <span class="einrichtung-aufgabe-text" style="color:var(--text-muted);font-size:14px;word-break:break-word;">
              ${esc(a.text)}
            </span>
            ${patientHtml}
            <button type="button" class="aufgabe-undo-btn" data-id="${esc(a.id)}" style="min-height:44px;padding:0 12px;background:none;border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--text-main);font-size:12px;display:inline-flex;align-items:center;justify-content:center;margin-left:auto;white-space:nowrap;" title="Aufgabe wieder öffnen">
              Rückgängig
            </button>
          </li>`;
        }).join('');
      }
    }
  }

  async function laden() {
    let ownerId = null;
    try { ownerId = typeof ctx.getOwnerId === 'function' ? ctx.getOwnerId() : ctx.getOwnerId; } catch { ownerId = null; }  // vor dem Login ist das Profil noch leer
    if (!ownerId || !ctx.supabase) return;

    try {
      const { data, error } = await ctx.supabase
        .from('praxis_aufgaben')
        .select('id, owner_id, business_id, lead_id, text, faellig_am, erledigt_at, erledigt_von, erstellt_von, created_at, updated_at')
        .eq('owner_id', ownerId);

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

    if (ctx.showToast) ctx.showToast('Aufgabe erstellt', 'success');
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
