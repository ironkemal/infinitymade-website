// Reine Regel: an welchen Standorten arbeitet ein Mitarbeiter an einem Tag?
// Zeilen aus employee_standort_plan: {employee_id, business_id, weekday} (0=Sonntag..6,
// wie JS getDay) ODER {employee_id, business_id, datum 'YYYY-MM-DD'}.
//   1) Einzeltag-Zeilen fuer den Tag vorhanden -> NUR diese.
//   2) sonst Wochenmuster-Zeilen fuer den Wochentag, aus der Version mit dem groessten gueltig_ab <= Tag.
//   3) Kein Eintrag fuer diesen Tag (auch: Wochenmuster ohne diesen Wochentag), keine Zeile fuer den
//      Mitarbeiter, leere oder fehlerhafte Eingabe -> alle Standorte (altes Verhalten). Ob jemand an einem
//      Tag ueberhaupt arbeitet, steuern Arbeitszeiten/Abwesenheiten, nicht der Standortplan
//      (Physio/PLANUNG-UMSETZUNG.md M4b „Einzeltag -> Wochenmuster -> alle“, physio 01.11.2026).
// Zwei Fassungen (api-backend/lib/standort-plan.js, module/standort-plan-regel.js) mit
// IDENTISCHER Logik; beide laufen gegen module/standort-plan-vektoren.json.

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;

function wochentagVon(datum) {
  if (typeof datum !== 'string') return null;
  const tag = datum.slice(0, 10);
  if (!DATUM_RE.test(tag)) return null;
  const d = new Date(tag + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  return { tag, wochentag: d.getUTCDay() };
}

function gueltigAb(wert) {
  if (typeof wert !== 'string') return null;
  const tag = wert.slice(0, 10);
  return DATUM_RE.test(tag) ? tag : null;
}

function eindeutig(zeilen) {
  const aus = [];
  for (const z of zeilen) if (z.business_id != null && !aus.includes(z.business_id)) aus.push(z.business_id);
  return aus;
}

// Zeilen, die fuer (Mitarbeiter, Tag) gelten: Einzeltag-Zeilen, sonst Wochenmuster der geltenden Version.
// null = kein Eintrag -> alle Standorte, ganzer Tag (altes Verhalten).
function geltendeZeilen(zeilen, employeeId, datum) {
  const t = wochentagVon(datum);
  if (!Array.isArray(zeilen) || employeeId == null || !t) return null;
  const eigene = zeilen.filter((z) => z && typeof z === 'object' && z.employee_id === employeeId);
  if (!eigene.length) return null;

  const einzel = eigene.filter((z) => typeof z.datum === 'string' && z.datum.slice(0, 10) === t.tag);
  if (einzel.length) return einzel;

  // Wochenmuster in Versionen (gueltig_ab, 0098): je Mitarbeiter gilt die Version mit dem groessten
  // gueltig_ab <= Tag, NULL = seit immer. Eine neue Version erbt keine Wochentage der alten.
  const muster = eigene.filter((z) => z.datum == null && z.weekday != null && z.weekday !== '');
  let version = null;
  let gefunden = false;
  for (const z of muster) {
    const g = gueltigAb(z.gueltig_ab);
    if (g !== null && g > t.tag) continue;
    if (!gefunden || (g !== null && (version === null || g > version))) { version = g; gefunden = true; }
  }
  if (!gefunden) return null;
  const woche = muster.filter((z) => gueltigAb(z.gueltig_ab) === version && Number(z.weekday) === t.wochentag);
  return woche.length ? woche : null;
}

export function standorteFuerTag(zeilen, employeeId, datum, alleStandortIds) {
  const alle = Array.isArray(alleStandortIds) ? alleStandortIds.slice() : [];
  const gelten = geltendeZeilen(zeilen, employeeId, datum);
  return gelten ? eindeutig(gelten) : alle;
}

export function istAmStandort(zeilen, employeeId, datum, standortId, alleStandortIds) {
  return standorteFuerTag(zeilen, employeeId, datum, alleStandortIds).includes(standortId);
}

// Zeitfenster (0109, Melih 04.11.2026: „Mo 8–12 Standort A, 14–18 Standort B“). von/bis 'HH:MM[:SS]' an der
// Planzeile; beide leer = ganzer Tag (Bestand, Einzeltage). Ob ueberhaupt gearbeitet wird, regeln weiter
// working_hours — die Fenster schraenken nur ein (Schnittmenge).
const ZEIT_RE = /^([01]\d|2[0-3]):[0-5]\d/;

/** 'HH:MM[:SS]' -> Minuten seit Mitternacht, sonst null. */
export function zeitInMinuten(wert) {
  if (typeof wert !== 'string' || !ZEIT_RE.test(wert)) return null;
  return Number(wert.slice(0, 2)) * 60 + Number(wert.slice(3, 5));
}

/**
 * true = der Termin [vonMin, bisMin) (Minuten, Berliner Ortszeit) passt in den Plan dieses Standorts.
 * Kein Eintrag fuer den Tag -> wie istAmStandort (alle Standorte, ganzer Tag). Ohne Zeitangabe nur Tagespruefung.
 */
export function imZeitfenster(zeilen, employeeId, datum, standortId, vonMin, bisMin, alleStandortIds) {
  const gelten = geltendeZeilen(zeilen, employeeId, datum);
  if (!gelten) return (Array.isArray(alleStandortIds) ? alleStandortIds : []).includes(standortId);
  const amOrt = gelten.filter((z) => z.business_id === standortId);
  if (!amOrt.length) return false;
  if (!Number.isFinite(vonMin) || !Number.isFinite(bisMin)) return true;
  return amOrt.some((z) => {
    const v = zeitInMinuten(z.von);
    const b = zeitInMinuten(z.bis);
    if (v === null || b === null) return true;
    return v <= vonMin && bisMin <= b;
  });
}
