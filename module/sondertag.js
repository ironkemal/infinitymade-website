/**
 * sondertag.js — Verwaltung und Kalenderanzeige von Sondertagen (Tabelle custom_days).
 *
 * Warum es das gibt:
 * Sondertage (custom_days) wirkten bisher nur auf die Online-Buchung.
 * Mit diesem Modul werden sie:
 *   1. Im internen Kalender sichtbar (Tag-, Woche-, Monatsansicht mit .sondertag-etikett),
 *   2. Beim Terminanlegen warnen (warnungFuerTag),
 *   3. Bei geschlossenen Tagen eine Patienten-Anrufliste (anruflisteHtml) betroffener Termine anzeigen.
 *
 * ⛔ Rechtliche Auflagen (legal-de & Praxura Guardrails):
 * - custom_days.note ist seit 0116/0117 (S-64) nur noch für das eigene Team lesbar und bleibt intern: sie erscheint in keinem
 *   Kalendermarkierungstext, keiner Warnung und keinem HTML der Anrufliste.
 * - Patientenlisten nur im Dashboard, nie Diagnosen oder Leistungen.
 * - Die Anrufliste nennt nicht den Grund des Sondertags.
 * - Es wird in diesem Paket KEINE Mail versendet.
 * - Dark Theme: keine festen Farben, nur CSS-Variablen.
 * - Jede Eingabe im HTML wird konsequent escaped.
 */

import { alsBerlinDatum } from './berlin-datum.js';

/**
 * Escaped HTML-Sonderzeichen zur Vermeidung von XSS.
 *
 * @param {any} wert
 * @returns {string}
 */
export function escapeHtml(wert) {
  return String(wert ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wandelt ein Datum (YYYY-MM-DD oder Date) in das deutsche Format TT.MM.JJJJ um.
 *
 * @param {string|Date} datum
 * @returns {string}
 */
function formatDatumDE(datum) {
  if (!datum) return "";
  if (typeof datum === "string") {
    const dStr = datum.slice(0, 10);
    const teile = dStr.split("-");
    if (teile.length === 3) {
      return `${teile[2]}.${teile[1]}.${teile[0]}`;
    }
  }
  if (datum instanceof Date && !isNaN(datum.getTime())) {
    const tag = String(datum.getDate()).padStart(2, "0");
    const monat = String(datum.getMonth() + 1).padStart(2, "0");
    const jahr = datum.getFullYear();
    return `${tag}.${monat}.${jahr}`;
  }
  return String(datum);
}

/**
 * Formatiert einen Zeitstempel in eine 5-stellige Uhrzeit (HH:MM).
 *
 * @param {string|Date} t
 * @returns {string}
 */
function formatUhrzeit(t) {
  if (!t) return "—";
  // Zeitstempel kommen als UTC aus der Datenbank; die Anrufliste braucht die Ortszeit der Praxis.
  const d = new Date(t);
  if (isNaN(d.getTime())) return String(t).slice(0, 5);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}

/**
 * Prüft, ob ein Termin (start_time) am gesuchten lokalen Kalendertag liegt.
 *
 * @param {string|Date} startTime
 * @param {string} targetDateStr YYYY-MM-DD
 * @returns {boolean}
 */
function istGleicherTag(startTime, targetDateStr) {
  if (!startTime || !targetDateStr) return false;
  try {
    const d = new Date(startTime);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      if (`${y}-${m}-${day}` === targetDateStr) return true;
    }
  } catch {}
  return false;
}

/**
 * Wandelt ein Datum und eine Uhrzeit in einen lokalen ISO-Zeitstempel um.
 *
 * @param {string|Date} datum
 * @param {string} zeitStr
 * @returns {string|null}
 */
function zuLokalerZeitISO(datum, zeitStr) {
  if (!datum) return null;
  const dStr = typeof datum === "string"
    ? datum.slice(0, 10)
    : (datum instanceof Date && !isNaN(datum.getTime())
        ? `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}-${String(datum.getDate()).padStart(2, "0")}`
        : "");
  if (!dStr) return null;
  const d = new Date(`${dStr}T${zeitStr}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * 1. Lädt Sondertage für einen Zeitraum aus custom_days.
 *
 * @param {object} opts
 * @param {object} opts.supabase
 * @param {string} opts.ownerId
 * @param {string} [opts.von] YYYY-MM-DD
 * @param {string} [opts.bis] YYYY-MM-DD
 * @returns {Promise<Array<object>>}
 */
export async function ladeSondertage({ supabase, ownerId, von, bis } = {}) {
  if (!supabase || !ownerId) return [];
  try {
    let query = supabase
      .from("custom_days")
      .select("date,type,start_time,end_time,note")
      .eq("owner_id", ownerId);

    if (von) query = query.gte("date", typeof von === "string" ? von.slice(0, 10) : von);
    if (bis) query = query.lte("date", typeof bis === "string" ? bis.slice(0, 10) : bis);

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

/**
 * 2. Bestimmt die Art des Sondertags nach der exakten server.js-Regel:
 * Ein Tag gilt als geschlossener Tag, wenn (type === "closed" || type === "holiday")
 * und weder start_time noch end_time gesetzt sind. Andernfalls "sonderzeit".
 *
 * @param {object} tag
 * @returns {"geschlossen"|"sonderzeit"|null}
 */
export function sondertagArt(tag) {
  if (!tag) return null;
  const isClosed = (tag.type === "closed" || tag.type === "holiday") && !tag.start_time && !tag.end_time;
  return isClosed ? "geschlossen" : "sonderzeit";
}

/**
 * 3. Liefert den Anzeigetext für den Sondertag.
 * Geschlossen: "Praxis geschlossen"
 * Sonderzeit: "Sonderöffnung 09:00–13:00"
 * Die note steht NICHT im Text.
 *
 * @param {object} tag
 * @returns {string}
 */
export function sondertagText(tag) {
  if (!tag) return "";
  const art = sondertagArt(tag);
  if (art === "geschlossen") {
    return "Praxis geschlossen";
  }
  const von = tag.start_time ? String(tag.start_time).slice(0, 5) : "";
  const bis = tag.end_time ? String(tag.end_time).slice(0, 5) : "";
  if (von && bis) {
    return `Sonderöffnung ${von}–${bis}`;
  }
  if (von) {
    return `Sonderöffnung ab ${von}`;
  }
  if (bis) {
    return `Sonderöffnung bis ${bis}`;
  }
  return "Sonderöffnung";
}

/**
 * 4. Liefert eine Warnung beim Anlegen eines Termins an einem geschlossenen Sondertag.
 * datum ist YYYY-MM-DD oder ISO-Zeit. Geschlossen:
 * "Die Praxis ist an diesem Tag geschlossen (Sondertag). Neue Termine sind gesperrt.".
 * Sonst null.
 *
 * @param {Array<object>|Map|object} tage
 * @param {string|Date} datum YYYY-MM-DD oder ISO-Zeit
 * @returns {string|null}
 */
export function warnungFuerTag(tage, datum) {
  if (!tage || !datum) return null;
  const dStr = typeof datum === "string"
    ? datum.slice(0, 10)
    : (datum instanceof Date && !isNaN(datum.getTime())
        ? `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}-${String(datum.getDate()).padStart(2, "0")}`
        : "");
  if (!dStr) return null;

  let tag = null;
  if (Array.isArray(tage)) {
    tag = tage.find(t => t && t.date === dStr);
  } else if (tage instanceof Map) {
    tag = tage.get(dStr);
  } else if (typeof tage === "object") {
    tag = tage.date === dStr ? tage : tage[dStr];
  }

  if (!tag) return null;
  if (sondertagArt(tag) === "geschlossen") {
    return "Die Praxis ist an diesem Tag geschlossen (Sondertag). Neue Termine sind gesperrt.";
  }
  return null;
}

/**
 * Erstellt ein Etikett-Element für die Kalenderansicht.
 *
 * @param {Document|object} doc
 * @param {"geschlossen"|"sonderzeit"} art
 * @param {string} text
 * @returns {HTMLElement|object}
 */
function erstelleEtikett(doc, art, text) {
  let el = null;
  if (doc && typeof doc.createElement === "function") {
    el = doc.createElement("span");
  } else {
    el = {
      className: "",
      classList: {
        _classes: [],
        add(c) {
          if (!this._classes.includes(c)) this._classes.push(c);
          el.className = this._classes.join(" ");
        },
      },
      textContent: "",
      style: "",
      parentNode: null,
      remove() {
        if (this.parentNode && typeof this.parentNode.removeChild === "function") {
          this.parentNode.removeChild(this);
        }
      },
    };
  }

  el.className = "sondertag-etikett";
  if (el.classList && typeof el.classList.add === "function") {
    el.classList.add(`sondertag-etikett--${art}`);
  }
  el.textContent = text;

  if (typeof el.setAttribute === "function") {
    el.setAttribute("data-art", art);
  }

  if (!el.remove) {
    el.remove = function() {
      if (this.parentNode && typeof this.parentNode.removeChild === "function") {
        this.parentNode.removeChild(this);
      }
    };
  }

  const istGeschlossen = art === "geschlossen";
  const border = istGeschlossen ? "var(--danger)" : "var(--warning)";
  const bg = istGeschlossen ? "var(--danger-dim)" : "var(--warning-dim)";
  const color = istGeschlossen ? "var(--danger)" : "var(--warning-text, var(--warning))";
  const css = `display:inline-block;padding:2px 6px;font-size:11px;font-weight:600;line-height:1.2;border-radius:var(--radius-sm);border:1px solid ${border};background:${bg};color:${color};margin:2px 0;`;

  if (typeof el.setAttribute === "function") {
    el.setAttribute("style", css);
  } else {
    el.style = css;
  }

  return el;
}

/** Einzelnes Etikett, für die Tagesansicht neben dem Datum. */
export function sondertagEtikett(doc, tag) {
  return erstelleEtikett(doc, sondertagArt(tag), sondertagText(tag));
}

/**
 * 5. Markiert Sondertage in der Kalenderansicht (Tag, Woche oder Monat).
 * Hängt an die zum Datum passende Stelle der bereits gerenderten Ansicht ein
 * kleines Etikett mit Klasse sondertag-etikett und dem sondertagText.
 * Mehrfacher Aufruf darf nicht doppelt markieren: alte Etiketten vorher entfernen.
 * Findest du keine passende Zelle, tue nichts und wirf nicht.
 *
 * @param {object} opts
 * @param {HTMLElement|object} opts.wurzel Wurzel-Container der Ansicht
 * @param {Array<object>} opts.tage Liste der Sondertage
 * @param {"tag"|"woche"|"monat"} opts.ansicht Aktuelle Kalenderansicht
 */
export function markiereSondertage({ wurzel, tage, ansicht } = {}) {
  if (!wurzel || !tage) return;
  const tagListe = Array.isArray(tage) ? tage : [tage];

  // Vorherige Etiketten restlos entfernen
  try {
    if (typeof wurzel.querySelectorAll === "function") {
      const alte = wurzel.querySelectorAll(".sondertag-etikett");
      if (alte) {
        const liste = Array.from(alte);
        for (const el of liste) {
          if (typeof el.remove === "function") {
            el.remove();
          } else if (el.parentNode && typeof el.parentNode.removeChild === "function") {
            el.parentNode.removeChild(el);
          }
        }
      }
    }
  } catch {}

  if (tagListe.length === 0) return;

  const doc = (wurzel && wurzel.ownerDocument) || (typeof document !== "undefined" ? document : null);

  for (const t of tagListe) {
    if (!t || !t.date) continue;
    const dStr = t.date;
    const art = sondertagArt(t);
    const text = sondertagText(t);
    if (!text) continue;

    let ziel = null;

    if (ansicht === "monat") {
      try {
        if (typeof wurzel.querySelector === "function") {
          ziel = wurzel.querySelector(
            `.month-cell[data-datum="${dStr}"], .month-cell[data-date="${dStr}"], [data-datum="${dStr}"], [data-date="${dStr}"]`
          );
        }
      } catch {}
    } else if (ansicht === "woche") {
      try {
        if (typeof wurzel.querySelector === "function") {
          ziel = wurzel.querySelector(
            `.dv-col[data-date="${dStr}"], .dv-col[data-datum="${dStr}"], [data-date="${dStr}"], [data-datum="${dStr}"]`
          );
          if (!ziel) {
            const slot = wurzel.querySelector(`.dv-slot[data-time^="${dStr}"]`);
            if (slot) {
              ziel = (slot.closest && slot.closest(".dv-col")) || (slot.parentElement?.closest && slot.parentElement.closest(".dv-col")) || slot.parentElement;
            }
          }
          if (ziel) {
            const kopf = (ziel.querySelector && ziel.querySelector(".dv-col-header")) || ziel;
            ziel = kopf;
          }
        }
      } catch {}
    } else if (ansicht === "tag") {
      try {
        let passt = false;
        const wurzelDatum = wurzel.dataset?.date || wurzel.dataset?.datum || (typeof wurzel.getAttribute === "function" ? (wurzel.getAttribute("data-date") || wurzel.getAttribute("data-datum")) : null);
        if (wurzelDatum === dStr) {
          passt = true;
        } else if (typeof wurzel.querySelector === "function") {
          if (wurzel.querySelector(`[data-date="${dStr}"], [data-datum="${dStr}"]`)) {
            passt = true;
          } else if (wurzel.querySelector(`.dv-slot[data-time^="${dStr}"]`)) {
            passt = true;
          }
        }

        if (passt) {
          if (typeof wurzel.querySelector === "function") {
            ziel = wurzel.querySelector("#dayViewDateLabel, .cal-view-date, .day-view-header, .dv-cols-wrap") || wurzel;
          } else {
            ziel = wurzel;
          }
        }
      } catch {}
    }

    if (!ziel || typeof ziel.appendChild !== "function") continue;

    // Doppelte Markierung an derselben Zelle verhindern
    if (typeof ziel.querySelector === "function" && ziel.querySelector(".sondertag-etikett")) {
      continue;
    }

    const etikett = erstelleEtikett(doc, art, text);
    if (!etikett) continue;

    if (ansicht === "monat" && typeof ziel.querySelector === "function") {
      const eventsWrap = ziel.querySelector(".month-cell-events");
      if (eventsWrap && eventsWrap.parentNode === ziel && typeof ziel.insertBefore === "function") {
        ziel.insertBefore(etikett, eventsWrap);
        continue;
      }
    }

    ziel.appendChild(etikett);
  }
}

/**
 * 6. Filtert Termine eines lokalen Tages:
 * - schließt cancelled und no_show aus
 * - schließt Gruppen-Kinder (group_parent_id) aus
 * - sortiert aufsteigend nach start_time
 *
 * @param {Array<object>} termine
 * @param {string|Date} datum
 * @returns {Array<object>}
 */
export function betroffeneTermine(termine, datum) {
  if (!Array.isArray(termine) || !datum) return [];
  const dStr = typeof datum === "string"
    ? datum.slice(0, 10)
    : (datum instanceof Date && !isNaN(datum.getTime())
        ? `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}-${String(datum.getDate()).padStart(2, "0")}`
        : "");
  if (!dStr) return [];

  const gefiltert = termine.filter(t => {
    if (!t || !t.start_time) return false;
    const st = String(t.status || "").toLowerCase();
    if (st === "cancelled" || st === "no_show") return false;
    if (t.group_parent_id != null && t.group_parent_id !== "") return false;
    return istGleicherTag(t.start_time, dStr);
  });

  return gefiltert.sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")));
}

/**
 * 7. Erzeugt das HTML der Anrufliste für betroffene Patienten.
 *
 * ⛔ Auflagen:
 * - Keine Leistungen, keine Notiz.
 * - Tabellenspalten: Uhrzeit, Patient, Telefon.
 * - Hinweis "Keine Telefonnummer hinterlegt" bei fehlender Nummer.
 * - Überschrift: "Betroffene Termine am TT.MM.JJJJ"
 * - Leere Liste: "Keine Termine an diesem Tag."
 *
 * @param {Array<object>} eintraege
 * @param {string|Date} datum
 * @returns {string}
 */
export function anruflisteHtml(eintraege, datum) {
  const datumStr = formatDatumDE(datum);
  const titel = `Betroffene Termine am ${datumStr}`;

  if (!Array.isArray(eintraege) || eintraege.length === 0) {
    return `<div class="sondertag-anrufliste" style="font-family:inherit;color:var(--text-main);"><h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:var(--text-main);">${escapeHtml(titel)}</h3><p style="margin:0;color:var(--text-muted);font-size:13px;">Keine Termine an diesem Tag.</p></div>`;
  }

  const zeilen = eintraege.map(t => {
    const uhrzeit = formatUhrzeit(t.start_time);
    const name = escapeHtml(t.customer_name || "—");
    const tel = t.customer_phone
      ? escapeHtml(t.customer_phone)
      : '<span style="color:var(--text-muted);font-style:italic;">Keine Telefonnummer hinterlegt</span>';

    return `<tr>`
      + `<td style="padding:8px 12px;border-bottom:1px solid var(--border);white-space:nowrap;font-weight:500;">${escapeHtml(uhrzeit)}</td>`
      + `<td style="padding:8px 12px;border-bottom:1px solid var(--border);">${name}</td>`
      + `<td style="padding:8px 12px;border-bottom:1px solid var(--border);">${tel}</td>`
      + `</tr>`;
  }).join("");

  return `<div class="sondertag-anrufliste" style="font-family:inherit;color:var(--text-main);"`
    + `><h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:var(--text-main);">${escapeHtml(titel)}</h3>`
    + `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">`
    + `<table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">`
    + `<thead><tr style="border-bottom:2px solid var(--border);color:var(--text-muted);">`
    + `<th style="padding:8px 12px;font-weight:600;">Uhrzeit</th>`
    + `<th style="padding:8px 12px;font-weight:600;">Patient</th>`
    + `<th style="padding:8px 12px;font-weight:600;">Telefon</th>`
    + `</tr></thead>`
    + `<tbody>${zeilen}</tbody>`
    + `</table>`
    + `</div>`
    + `</div>`;
}

/**
 * 8. Lädt betroffene Termine aus bookings für einen lokalen Zeitraum (00:00 bis 23:59:59).
 * Wirft nie und liefert im Fehlerfall [].
 *
 * @param {object} opts
 * @param {object} opts.supabase
 * @param {string} opts.ownerId
 * @param {string|Date} opts.von
 * @param {string|Date} [opts.bis]
 * @returns {Promise<Array<object>>}
 */
export async function ladeBetroffene({ supabase, ownerId, von, bis } = {}) {
  if (!supabase || !ownerId || !von) return [];
  try {
    const endDatum = bis || von;
    const startIso = zuLokalerZeitISO(von, "00:00:00");
    const endIso = zuLokalerZeitISO(endDatum, "23:59:59");

    let query = supabase
      .from("bookings")
      .select("id,start_time,customer_name,customer_phone,status,group_parent_id")
      .eq("owner_id", ownerId);

    if (startIso) query = query.gte("start_time", startIso);
    if (endIso) query = query.lte("start_time", endIso);

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

/** true, wenn der Termin an einem ganztägig geschlossenen Sondertag liegt und noch gilt (nicht abgesagt). */
export function terminAmSondertag(termin, tage) {
  if (!termin?.start_time || !Array.isArray(tage)) return false;
  if (["cancelled", "canceled", "no_show"].includes(termin.status)) return false;
  const tag = alsBerlinDatum(new Date(termin.start_time));
  if (!tag) return false;
  return tage.some(t => t?.date === tag && sondertagArt(t) === "geschlossen");
}

export const SONDERTAG_TERMIN_HINWEIS = "Praxis an diesem Tag geschlossen (Sondertag). Termin bitte absagen oder verschieben.";

/**
 * Kemal 31.10.: Bestehende Termine am geschlossenen Sondertag rot zeigen (nicht verstecken, nicht verschieben).
 * Liest den Termin aus `el._termin` (Tag-, Wochen-, Monatsansicht setzen ihn). Rot = Ring + Tönung,
 * die Mitarbeiterfarbe am linken Rand bleibt. Zeichnet der Kalender neu, sind die Elemente frisch.
 */
export function markiereSondertagTermine({ wurzel, tage } = {}) {
  if (!wurzel || typeof wurzel.querySelectorAll !== "function") return 0;
  let anzahl = 0;
  for (const el of wurzel.querySelectorAll(".dv-booking-block, .month-event-pill")) {
    if (!terminAmSondertag(el._termin, tage)) continue;
    el.dataset.sondertag = "geschlossen";
    el.style.boxShadow = "inset 0 0 0 2px var(--danger, #dc2626)";
    el.style.backgroundImage = "linear-gradient(rgba(220, 38, 38, 0.22), rgba(220, 38, 38, 0.22))";
    el.title = el.title ? `${SONDERTAG_TERMIN_HINWEIS}\n${el.title}` : SONDERTAG_TERMIN_HINWEIS;
    anzahl += 1;
  }
  return anzahl;
}
