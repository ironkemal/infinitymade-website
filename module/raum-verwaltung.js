/**
 * raum-verwaltung.js — Verwaltung der Praxisräume (Physio/PILOT-PLAN.md M1c).
 *
 * Bietet Funktionen zur Raumverwaltung (Laden, Anlegen, Ändern, Deaktivieren, Löschen)
 * sowie HTML-Generierung und Montage im Dashboard/Einstellungen.
 *
 * Regeln: UI-Text nur Deutsch, Dark-Theme CSS-Variablen, jede Eingabe escapet, kein <datalist>.
 */

import {
  raumName,
  raumPlaetze,
  raumNameFrei,
  raeumeDesStandorts,
  RAUM_NAME_MAX,
} from "./raum-plan.js";

import { raumDetails } from "./raum-details.js";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[c]));
}

function detailsHtml(raum = {}, verfuegbar = true) {
  if (!verfuegbar) return '<p class="form-hint">Beschreibung und Ausstattung sind derzeit nicht verfügbar.</p>';
  return `<div class="raum-details" style="flex-basis:100%;min-width:0;">
    <label style="display:block;">Beschreibung<textarea class="form-input raum-beschreibung" maxlength="2000" rows="3" style="display:block;width:100%;box-sizing:border-box;">${escapeHtml(raum.beschreibung)}</textarea></label>
    <fieldset style="min-width:0;margin:12px 0;padding:8px;border:1px solid var(--border);"><legend>Ausstattung</legend>
    <div class="raum-ausstattung-liste">${(raum.ausstattung || []).map(text => ausstattungHtml(text)).join('')}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;"><label style="flex:1;min-width:0;">Weiterer Ausstattungspunkt<input class="form-input raum-ausstattung-neu" maxlength="80" style="width:100%;box-sizing:border-box;"></label><button type="button" class="btn-ghost raum-ausstattung-hinzufuegen">Hinzufügen</button></div>
    <p class="form-hint" aria-live="polite">Angehakt = im Raum vorhanden. Änderungen anschließend speichern.</p></fieldset>
  </div>`;
}

function ausstattungHtml(text) {
  return `<div class="raum-ausstattung-punkt" style="display:flex;gap:8px;align-items:center;overflow-wrap:anywhere;"><label style="flex:1;min-width:0;"><input type="checkbox" class="raum-ausstattung-check" value="${escapeHtml(text)}" checked> ${escapeHtml(text)}</label><button type="button" class="btn-ghost raum-ausstattung-entfernen" aria-label="${escapeHtml(text)} entfernen">Entfernen</button></div>`;
}

function leseDetails(root) {
  if (!root?.querySelector('.raum-details')) return {};
  return {
    beschreibung: root.querySelector('.raum-beschreibung').value,
    ausstattung: Array.from(root.querySelectorAll('.raum-ausstattung-check')).filter(el => el.checked).map(el => el.value),
  };
}

function verdrahteDetails(root, showToast) {
  for (const editor of root.querySelectorAll('.raum-details')) {
    editor.addEventListener('click', event => {
      const entfernen = event.target.closest('.raum-ausstattung-entfernen');
      if (entfernen) { entfernen.closest('.raum-ausstattung-punkt').remove(); return; }
      if (!event.target.closest('.raum-ausstattung-hinzufuegen')) return;
      const eingabe = editor.querySelector('.raum-ausstattung-neu');
      const vorhanden = Array.from(editor.querySelectorAll('.raum-ausstattung-check')).map(el => el.value);
      try {
        const details = raumDetails('', [...vorhanden, eingabe.value]);
        editor.querySelector('.raum-ausstattung-liste').insertAdjacentHTML('beforeend', ausstattungHtml(details.ausstattung.at(-1)));
        eingabe.value = '';
        eingabe.focus();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }
}

/**
 * Reine Funktion: Formular zum Anlegen eines neuen Raums.
 * @returns {string} HTML
 */
export function formularHtml({ detailsVerfuegbar = true } = {}) {
  return `
    <div class="card" style="padding:16px;margin-bottom:16px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;">
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
        <div style="flex:1;min-width:200px;">
          <label class="form-label" for="raumNeuName" style="display:block;margin-bottom:4px;color:var(--text-main);font-size:13px;font-weight:500;">Raumname</label>
          <input type="text" id="raumNeuName" class="form-input" placeholder="z. B. Behandlungsraum 1" maxlength="${RAUM_NAME_MAX}" style="width:100%;">
        </div>
        <div style="width:100px;">
          <label class="form-label" for="raumNeuPlaetze" style="display:block;margin-bottom:4px;color:var(--text-main);font-size:13px;font-weight:500;">Plätze</label>
          <input type="number" id="raumNeuPlaetze" class="form-input" value="1" min="1" max="99" style="width:100%;">
        </div>
      </div>
      ${detailsHtml({}, detailsVerfuegbar)}
        <button type="button" id="raumNeuBtn" class="btn-primary" style="height:36px;white-space:nowrap;">Raum anlegen</button>
      <div class="form-hint" style="margin-top:6px;font-size:12px;color:var(--text-muted);">Mehrere Plätze zum Beispiel für Wärme oder Fango</div>
    </div>
  `.trim();
}

/**
 * Reine Funktion: Zeilen für die Raumliste.
 * @param {Array<object>} raeume
 * @param {{ istInhaber?: boolean }} optionen
 * @returns {string} HTML
 */
export function raumZeilenHtml(raeume, { istInhaber = false, detailsVerfuegbar = true } = {}) {
  if (!raeume || raeume.length === 0) {
    return "<p class=\"form-hint\" style=\"margin:8px 0;color:var(--text-muted);\">Noch keine Räume angelegt.</p>";
  }

  return raeume.map(r => {
    const escId = escapeHtml(r.id);
    const escName = escapeHtml(r.name);
    const plaetze = r.plaetze ?? 1;
    const aktiv = r.aktiv !== false;

    if (!istInhaber) {
      return `
        <div class="card raum-zeile" data-raum-id="${escId}" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;margin-bottom:8px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;">
          <div>
            <strong style="color:var(--text-main);font-size:14px;">${escName}</strong>
            ${!aktiv ? " <span class=\"form-hint\" style=\"margin-left:6px;\">(inaktiv)</span>" : ""}
            ${r.beschreibung ? `<p style="white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(r.beschreibung)}</p>` : ""}
            ${(r.ausstattung || []).length ? `<ul>${r.ausstattung.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul>` : ""}
          </div>
          <div style="color:var(--text-muted);font-size:13px;">
            ${plaetze} ${plaetze === 1 ? "Platz" : "Plätze"}
          </div>
        </div>
      `.trim();
    }

    return `
      <div class="card raum-zeile" data-raum-id="${escId}" style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 16px;margin-bottom:8px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;${!aktiv ? "opacity:0.7;" : ""}">
        <div style="flex:1;min-width:180px;">
          <label class="form-label" style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Raumname</label>
          <input type="text" class="form-input raum-edit-name" value="${escName}" maxlength="${RAUM_NAME_MAX}" style="width:100%;">
        </div>
        <div style="width:80px;">
          <label class="form-label" style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Plätze</label>
          <input type="number" class="form-input raum-edit-plaetze" value="${plaetze}" min="1" max="99" style="width:100%;">
        </div>
        ${detailsHtml(r, detailsVerfuegbar)}
        <div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px;margin-top:auto;">
          <button type="button" class="btn-ghost raum-btn-save" data-action="speichern" data-id="${escId}">Speichern</button>
          <button type="button" class="btn-ghost raum-btn-toggle" data-action="toggle-aktiv" data-id="${escId}" data-aktiv="${aktiv ? "true" : "false"}">${aktiv ? "Deaktivieren" : "Aktivieren"}</button>
          <button type="button" class="btn-ghost raum-btn-delete" data-action="loeschen" data-id="${escId}" style="color:var(--danger, #ef4444);">Löschen</button>
        </div>
      </div>
    `.trim();
  }).join("\n");
}

/**
 * Räume des Mandanten laden.
 * @param {{ supabase: object, ownerId: string }} params
 * @returns {Promise<{ raeume: Array<object>, fehler: boolean }>}
 */
export async function ladeRaeume({ supabase, ownerId }) {
  try {
    if (!supabase || !ownerId) {
      return { raeume: [], fehler: true };
    }
    let { data, error } = await supabase.from("rooms")
      .select("id,owner_id,business_id,name,plaetze,aktiv,sort,beschreibung,ausstattung").eq("owner_id", ownerId);
    let detailsVerfuegbar = true;
    if (error && ['42703', 'PGRST204'].includes(String(error.code))) {
      const alt = await supabase.from("rooms").select("id,owner_id,business_id,name,plaetze,aktiv,sort").eq("owner_id", ownerId);
      data = alt.data; error = alt.error; detailsVerfuegbar = false;
    }

    if (error) {
      return { raeume: [], fehler: true };
    }
    return { raeume: data || [], fehler: false, detailsVerfuegbar };
  } catch {
    return { raeume: [], fehler: true };
  }
}

/**
 * Raum anlegen oder aktualisieren.
 * @param {object} params
 * @param {object} params.supabase
 * @param {string} params.ownerId
 * @param {?string} [params.businessId]
 * @param {Array<object>} [params.raeume]
 * @param {?string} [params.id]
 * @param {string} params.name
 * @param {number|string} params.plaetze
 * @returns {Promise<{ ok: boolean, meldung?: string }>}
 */
export async function speichereRaum({
  supabase,
  ownerId,
  businessId = null,
  raeume = [],
  id = null,
  name,
  plaetze,
  beschreibung,
  ausstattung,
}) {
  let details = {};
  try {
    if (beschreibung !== undefined || ausstattung !== undefined) {
      if (beschreibung === undefined || ausstattung === undefined) throw new Error('Beschreibung und Ausstattung müssen gemeinsam gespeichert werden.');
      details = raumDetails(beschreibung, ausstattung);
    }
  } catch (err) { return { ok: false, meldung: err.message }; }
  let cleanName;
  try {
    cleanName = raumName(name);
  } catch (err) {
    return { ok: false, meldung: err.message };
  }

  let cleanPlaetze;
  try {
    cleanPlaetze = raumPlaetze(plaetze);
  } catch (err) {
    return { ok: false, meldung: err.message };
  }

  if (!raumNameFrei(raeume, cleanName, { id: id ?? null, businessId: businessId ?? null })) {
    return { ok: false, meldung: "Dieser Raumname ist bereits vergeben." };
  }

  try {
    if (id) {
      const { error } = await supabase
        .from("rooms")
        .update({ name: cleanName, plaetze: cleanPlaetze, ...details })
        .eq("id", id)
        .eq("owner_id", ownerId);

      if (error) {
        if (error.code === "23505" || String(error.code) === "23505" || String(error.message).includes("23505")) {
          return { ok: false, meldung: "Dieser Raumname ist bereits vergeben." };
        }
        return { ok: false, meldung: "Raum konnte nicht gespeichert werden." };
      }
      return { ok: true };
    } else {
      const { error } = await supabase
        .from("rooms")
        .insert({
          owner_id: ownerId,
          business_id: businessId ?? null,
          name: cleanName,
          plaetze: cleanPlaetze,
          ...details,
        });

      if (error) {
        if (error.code === "23505" || String(error.code) === "23505" || String(error.message).includes("23505")) {
          return { ok: false, meldung: "Dieser Raumname ist bereits vergeben." };
        }
        return { ok: false, meldung: "Raum konnte nicht gespeichert werden." };
      }
      return { ok: true };
    }
  } catch (err) {
    if (err && (err.code === "23505" || String(err.code) === "23505" || String(err.message).includes("23505"))) {
      return { ok: false, meldung: "Dieser Raumname ist bereits vergeben." };
    }
    return { ok: false, meldung: "Raum konnte nicht gespeichert werden." };
  }
}

/**
 * Aktiv-Status eines Raums umschalten.
 * @param {{ supabase: object, ownerId: string, id: string, aktiv: boolean }} params
 * @returns {Promise<{ ok: boolean, meldung?: string }>}
 */
export async function setzeRaumAktiv({ supabase, ownerId, id, aktiv }) {
  try {
    const { error } = await supabase
      .from("rooms")
      .update({ aktiv: Boolean(aktiv) })
      .eq("id", id)
      .eq("owner_id", ownerId);

    if (error) {
      return { ok: false, meldung: "Status konnte nicht geändert werden." };
    }
    return { ok: true };
  } catch {
    return { ok: false, meldung: "Status konnte nicht geändert werden." };
  }
}

/**
 * Raum löschen.
 * @param {{ supabase: object, ownerId: string, id: string }} params
 * @returns {Promise<{ ok: boolean, meldung?: string }>}
 */
export async function loescheRaum({ supabase, ownerId, id }) {
  try {
    const { error } = await supabase
      .from("rooms")
      .delete()
      .eq("id", id)
      .eq("owner_id", ownerId);

    if (error) {
      return { ok: false, meldung: "Raum konnte nicht gelöscht werden." };
    }
    return { ok: true };
  } catch {
    return { ok: false, meldung: "Raum konnte nicht gelöscht werden." };
  }
}

/**
 * Baut die Raumverwaltung in container, lädt Daten und rendert nach Änderungen neu.
 * @param {HTMLElement|object} container
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {string} deps.ownerId
 * @param {?string} [deps.businessId]
 * @param {boolean} [deps.istInhaber]
 * @param {(msg: string, typ?: string) => void} [deps.showToast]
 * @param {(opts: { title: string, message: string, confirmText: string, cancelText: string }) => Promise<boolean>} [deps.showConfirmModal]
 */
export async function mountRaumVerwaltung(container, deps = {}) {
  if (!container) return;
  const {
    supabase,
    ownerId,
    businessId = null,
    istInhaber = false,
    showToast = () => {},
    showConfirmModal = async () => true,
  } = deps;

  async function rendern() {
    const ergebnis = await ladeRaeume({ supabase, ownerId });
    if (ergebnis.fehler) {
      container.innerHTML = `
        <div class="raum-verwaltung">
          <h3 class="raum-titel" style="margin:0 0 6px;font-size:16px;color:var(--text-main);">Räume</h3>
          <p class="raum-hinweis form-hint" style="margin:0 0 12px;font-size:13px;color:var(--text-muted);">Räume dieses Standorts mit Beschreibung und Ausstattung. Passende freie Räume werden bei der Terminplanung vorgeschlagen.</p>
          <p class="raum-fehler form-hint" style="color:var(--text-muted);font-size:13px;margin:0;">Räume sind gerade nicht verfügbar.</p>
        </div>
      `.trim();
      return;
    }

    const alleRaeume = ergebnis.raeume || [];
    let gefilterteRaeume;
    if (istInhaber) {
      const standortPassend = businessId
        ? alleRaeume.filter(r => r.business_id === businessId || r.business_id == null)
        : alleRaeume;
      gefilterteRaeume = [...standortPassend].sort(
        (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "de")
      );
    } else {
      gefilterteRaeume = raeumeDesStandorts(alleRaeume, businessId);
    }

    const detailsVerfuegbar = ergebnis.detailsVerfuegbar !== false;
    const formular = istInhaber ? formularHtml({ detailsVerfuegbar }) : "";
    const zeilen = raumZeilenHtml(gefilterteRaeume, { istInhaber, detailsVerfuegbar });

    container.innerHTML = `
      <div class="raum-verwaltung">
        <h3 class="raum-titel" style="margin:0 0 6px;font-size:16px;color:var(--text-main);">Räume</h3>
        <p class="raum-hinweis form-hint" style="margin:0 0 16px;font-size:13px;color:var(--text-muted);">Räume dieses Standorts mit Beschreibung und Ausstattung. Passende freie Räume werden bei der Terminplanung vorgeschlagen.</p>
        ${formular}
        <div class="raum-liste">
          ${zeilen}
        </div>
      </div>
    `.trim();

    if (!istInhaber) return;
    if (typeof container.querySelectorAll === "function") verdrahteDetails(container, showToast);

    const neuBtn = typeof container.querySelector === "function" ? container.querySelector("#raumNeuBtn") : null;
    const neuNameInput = typeof container.querySelector === "function" ? container.querySelector("#raumNeuName") : null;
    const neuPlaetzeInput = typeof container.querySelector === "function" ? container.querySelector("#raumNeuPlaetze") : null;

    if (neuBtn && neuNameInput && neuPlaetzeInput) {
      neuBtn.addEventListener("click", async () => {
        const name = neuNameInput.value;
        const plaetze = neuPlaetzeInput.value;
        neuBtn.disabled = true;
        try {
          const res = await speichereRaum({
            supabase,
            ownerId,
            businessId,
            raeume: alleRaeume,
            name,
            plaetze,
            ...leseDetails(neuBtn.closest?.(".card")),
          });
          if (!res.ok) {
            showToast(res.meldung, "error");
            return;
          }
          showToast("Raum gespeichert ✓");
          await rendern();
        } finally {
          neuBtn.disabled = false;
        }
      });
    }

    const zeilenEls = typeof container.querySelectorAll === "function"
      ? Array.from(container.querySelectorAll(".raum-zeile"))
      : [];

    zeilenEls.forEach(zeile => {
      const id = zeile.dataset.raumId;
      const nameInput = zeile.querySelector(".raum-edit-name");
      const plaetzeInput = zeile.querySelector(".raum-edit-plaetze");
      const saveBtn = zeile.querySelector("[data-action=\"speichern\"]");
      const toggleBtn = zeile.querySelector("[data-action=\"toggle-aktiv\"]");
      const delBtn = zeile.querySelector("[data-action=\"loeschen\"]");

      if (saveBtn && nameInput && plaetzeInput) {
        saveBtn.addEventListener("click", async () => {
          saveBtn.disabled = true;
          try {
            const res = await speichereRaum({
              supabase,
              ownerId,
              businessId,
              raeume: alleRaeume,
              id,
              name: nameInput.value,
              plaetze: plaetzeInput.value,
              ...leseDetails(zeile),
            });
            if (!res.ok) {
              showToast(res.meldung, "error");
              return;
            }
            showToast("Raum gespeichert ✓");
            await rendern();
          } finally {
            saveBtn.disabled = false;
          }
        });
      }

      if (toggleBtn) {
        toggleBtn.addEventListener("click", async () => {
          const istAktuellAktiv = toggleBtn.dataset.aktiv !== "false";
          const neuesAktiv = !istAktuellAktiv;
          toggleBtn.disabled = true;
          try {
            const res = await setzeRaumAktiv({
              supabase,
              ownerId,
              id,
              aktiv: neuesAktiv,
            });
            if (!res.ok) {
              showToast(res.meldung, "error");
              return;
            }
            showToast(neuesAktiv ? "Raum aktiviert ✓" : "Raum deaktiviert ✓");
            await rendern();
          } finally {
            toggleBtn.disabled = false;
          }
        });
      }

      if (delBtn) {
        delBtn.addEventListener("click", async () => {
          const bestaetigt = await showConfirmModal({
            title: "Raum löschen",
            message: "Der Raum wird aus allen Terminen entfernt.",
            confirmText: "Löschen",
            cancelText: "Abbrechen",
          });
          if (!bestaetigt) return;

          delBtn.disabled = true;
          try {
            const res = await loescheRaum({ supabase, ownerId, id });
            if (!res.ok) {
              showToast(res.meldung, "error");
              return;
            }
            showToast("Raum gelöscht ✓");
            await rendern();
          } finally {
            delBtn.disabled = false;
          }
        });
      }
    });
  }

  await rendern();
}
