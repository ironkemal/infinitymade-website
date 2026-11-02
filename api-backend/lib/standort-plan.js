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

export function standorteFuerTag(zeilen, employeeId, datum, alleStandortIds) {
  const alle = Array.isArray(alleStandortIds) ? alleStandortIds.slice() : [];
  const t = wochentagVon(datum);
  if (!Array.isArray(zeilen) || employeeId == null || !t) return alle;
  const eigene = zeilen.filter((z) => z && typeof z === 'object' && z.employee_id === employeeId);
  if (!eigene.length) return alle;

  const einzel = eigene.filter((z) => typeof z.datum === 'string' && z.datum.slice(0, 10) === t.tag);
  if (einzel.length) return eindeutig(einzel);

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
  if (!gefunden) return alle;
  const woche = muster.filter((z) => gueltigAb(z.gueltig_ab) === version && Number(z.weekday) === t.wochentag);
  return woche.length ? eindeutig(woche) : alle;
}

export function istAmStandort(zeilen, employeeId, datum, standortId, alleStandortIds) {
  return standorteFuerTag(zeilen, employeeId, datum, alleStandortIds).includes(standortId);
}
