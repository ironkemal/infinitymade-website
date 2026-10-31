/**
 * raum-streifen.js — Schmaler Streifen "Jetzt" über der Tagesansicht (Physio P1, M2a).
 *
 * Beantwortet die Frage des Kunden: Welcher Therapeut ist gerade in welchem Raum?
 *
 * ⛔ Rechtliche Auflage (legal-de):
 * Der Streifen zeigt NIE Patientennamen, Initialen von Patienten, Diagnosen oder Leistungen.
 * Nur Raumname, Kürzel des Therapeuten, Status, Restminuten. customer_name darf im HTML
 * nicht vorkommen, auch nicht in title- oder aria-Attributen.
 */

import { belegungJetzt } from "./raum-plan.js";

/**
 * Erzeugt das Therapeuten-Kürzel aus dem Namen.
 * Regeln:
 *   "Anna Maria Beispiel" → "A. B."
 *   "Anna" → "A."
 *   leer / falsy / ungültig → ""
 *
 * @param {string} name
 * @returns {string}
 */
export function mitarbeiterKuerzel(name) {
  if (!name || typeof name !== "string") return "";
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return "";
  if (teile.length === 1) {
    const erst = teile[0][0];
    return erst ? `${erst.toUpperCase()}.` : "";
  }
  const vor = teile[0][0];
  const nach = teile[teile.length - 1][0];
  return `${vor.toUpperCase()}. ${nach.toUpperCase()}.`;
}

function mitarbeiterMapAus(mitarbeiter) {
  if (!mitarbeiter) return new Map();
  if (mitarbeiter instanceof Map) return mitarbeiter;
  if (Array.isArray(mitarbeiter)) {
    const map = new Map();
    for (const m of mitarbeiter) {
      if (m && m.id != null) map.set(m.id, m);
    }
    return map;
  }
  if (typeof mitarbeiter === "object") {
    return new Map(Object.entries(mitarbeiter).map(([k, v]) => [k, typeof v === "string" ? { name: v } : v]));
  }
  return new Map();
}

function mitarbeiterName(emp) {
  if (!emp) return "";
  if (typeof emp === "string") return emp;
  return emp.business_name || emp.name || (emp.email ? emp.email.split("@")[0] : "") || "";
}

/**
 * Reines Modell der aktuellen Raumbelegung.
 *
 * @param {Array<object>} raeume       Räume des Standorts
 * @param {Array<object>} termine      Termine
 * @param {Array<object>|Map} mitarbeiter  Mitarbeiterliste
 * @param {Date|string|number} jetzt   Referenzzeitpunkt
 * @returns {{ eintraege: Array<{ raumId: string, name: string, zustand: "frei"|"teilweise"|"voll", kuerzel: string[], restMinuten: number, terminId: string|null }>, ohneRaum: number }}
 */
export function streifenModell(raeume, termine, mitarbeiter, jetzt) {
  const belegung = belegungJetzt(raeume || [], termine || [], jetzt);
  const mitarbeiterMap = mitarbeiterMapAus(mitarbeiter);

  const eintraege = belegung.raeume.map(item => {
    const hier = item.termine || [];
    const plaetze = item.raum.plaetze ?? 1;

    let zustand = "frei";
    if (hier.length > 0) {
      zustand = hier.length >= plaetze ? "voll" : "teilweise";
    }

    const kuerzel = [];
    for (const t of hier) {
      if (!t.user_id) continue;
      const emp = mitarbeiterMap.get(t.user_id);
      const name = mitarbeiterName(emp);
      const k = mitarbeiterKuerzel(name);
      if (k && !kuerzel.includes(k)) {
        kuerzel.push(k);
      }
    }

    const terminId = hier.length > 0 ? (hier[0].id ?? null) : null;

    return {
      raumId: item.raum.id,
      name: item.raum.name,
      zustand,
      kuerzel,
      restMinuten: item.restMinuten,
      terminId,
    };
  });

  return {
    eintraege,
    ohneRaum: belegung.ohneRaum,
  };
}

function escapeHtml(wert) {
  return String(wert ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Erzeugt HTML für den Raum-Streifen.
 *
 * Barrierefrei: Zustand ist Text und Farbe.
 * Dark Theme: Nur CSS-Variablen, keine festen Farben.
 * Keine Patientendaten: customer_name kommt nicht vor.
 *
 * @param {{ eintraege: Array<object>, ohneRaum: number }} modell
 * @returns {string}
 */
export function streifenHtml(modell) {
  if (!modell || !Array.isArray(modell.eintraege) || modell.eintraege.length === 0) {
    return "";
  }

  const raumHtmls = modell.eintraege.map(e => {
    const nameEscaped = escapeHtml(e.name);
    if (e.zustand === "frei") {
      return `<span class="raum-streifen-item raum-streifen-item--frei" data-raum-id="${escapeHtml(e.raumId)}" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-card-solid);color:var(--text-muted);font-size:12px;line-height:1.4;flex-shrink:0;"><strong style="color:var(--text-main);font-weight:600;">${nameEscaped}</strong><span style="color:var(--text-muted);">frei</span></span>`;
    }

    const kuerzelStr = e.kuerzel && e.kuerzel.length ? e.kuerzel.join(", ") : "";
    const restText = `noch ${e.restMinuten} Min.`;
    const infoText = kuerzelStr ? `${escapeHtml(kuerzelStr)} · ${restText}` : restText;
    const borderFarbe = e.zustand === "teilweise" ? "var(--warning, var(--border))" : "var(--primary)";
    const bgFarbe = e.zustand === "teilweise" ? "var(--warning-dim, var(--bg-card-solid))" : "var(--primary-dim)";
    const terminIdAttr = e.terminId ? ` data-termin-id="${escapeHtml(e.terminId)}"` : "";

    return `<button type="button" class="raum-streifen-item raum-streifen-item--${escapeHtml(e.zustand)}"${terminIdAttr} data-raum-id="${escapeHtml(e.raumId)}" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:var(--radius-sm);border:1px solid ${borderFarbe};background:${bgFarbe};color:var(--text-main);font-size:12px;line-height:1.4;flex-shrink:0;cursor:pointer;font-family:inherit;"><strong style="color:var(--text-main);font-weight:600;">${nameEscaped}</strong><span>${infoText}</span></button>`;
  });

  let ohneHtml = "";
  if (modell.ohneRaum > 0) {
    const text = modell.ohneRaum === 1
      ? "1 Termin läuft ohne Raum"
      : `${modell.ohneRaum} Termine laufen ohne Raum`;
    ohneHtml = `<span class="raum-streifen-ohne-raum" style="color:var(--text-muted);font-size:12px;padding:4px 8px;flex-shrink:0;white-space:nowrap;">${escapeHtml(text)}</span>`;
  }

  return `<div class="raum-streifen" style="display:flex;align-items:center;gap:8px;overflow-x:auto;min-width:0;width:100%;padding:4px 0;white-space:nowrap;-webkit-overflow-scrolling:touch;">${raumHtmls.join("")}${ohneHtml}</div>`;
}

/**
 * Montiert den Raum-Streifen in einen DOM-Container.
 *
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {() => Promise<{ raeume: Array<object>, termine: Array<object>, mitarbeiter: Array<object> }>} opts.holeDaten
 * @param {(terminId: string) => void} [opts.onTerminKlick]
 * @param {number} [opts.intervallMs=60000]
 * @returns {() => void} stop-Funktion
 */
export function mountRaumStreifen(container, { holeDaten, onTerminKlick, intervallMs = 60000 } = {}) {
  if (!container) return () => {};

  let timer = null;
  let gestoppt = false;
  const doc = container.ownerDocument || (typeof document !== "undefined" ? document : null);

  const klickHandler = event => {
    if (!onTerminKlick) return;
    const target = event.target?.closest?.("[data-termin-id]");
    if (!target) return;
    if (typeof container.contains === "function" && !container.contains(target)) return;
    const id = target.getAttribute("data-termin-id");
    if (id) onTerminKlick(id);
  };

  if (container.addEventListener) {
    container.addEventListener("click", klickHandler);
  }

  async function aktualisieren() {
    if (gestoppt) return;
    if (doc && doc.hidden) return;
    try {
      const daten = await holeDaten();
      if (gestoppt) return;
      const raeume = daten?.raeume || [];
      if (raeume.length === 0) {
        container.hidden = true;
        return;
      }
      container.hidden = false;
      const termine = daten?.termine || [];
      const mitarbeiter = daten?.mitarbeiter || [];
      const modell = streifenModell(raeume, termine, mitarbeiter, Date.now());
      container.innerHTML = streifenHtml(modell);
    } catch {
      // Letzten Stand behalten, nichts werfen, kein Toast
    }
  }

  const visibilityHandler = () => {
    if (doc && !doc.hidden && !gestoppt) {
      aktualisieren();
    }
  };

  if (doc?.addEventListener) {
    doc.addEventListener("visibilitychange", visibilityHandler);
  }

  timer = setInterval(() => {
    if (!doc || !doc.hidden) {
      aktualisieren();
    }
  }, intervallMs);

  aktualisieren();

  return function stop() {
    gestoppt = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (container.removeEventListener) {
      container.removeEventListener("click", klickHandler);
    }
    if (doc?.removeEventListener) {
      doc.removeEventListener("visibilitychange", visibilityHandler);
    }
  };
}
