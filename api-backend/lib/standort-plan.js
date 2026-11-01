// Reine Regel: an welchen Standorten arbeitet ein Mitarbeiter an einem Tag?
// Zeilen aus employee_standort_plan: {employee_id, business_id, weekday} (0=Sonntag..6,
// wie JS getDay) ODER {employee_id, business_id, datum 'YYYY-MM-DD'}.
//   1) Einzeltag-Zeilen fuer den Tag vorhanden -> NUR diese.
//   2) sonst Wochenmuster-Zeilen fuer den Wochentag.
//   3) Hat der Mitarbeiter ein Wochenmuster, aber nicht fuer diesen Wochentag -> [] (freier Tag).
//   4) Kein Eintrag fuer den Mitarbeiter / leere oder fehlerhafte Eingabe -> alle Standorte (altes Verhalten).
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

  const woche = eigene.filter((z) => z.datum == null && z.weekday != null && z.weekday !== '');
  if (!woche.length) return alle;
  return eindeutig(woche.filter((z) => Number(z.weekday) === t.wochentag));
}

export function istAmStandort(zeilen, employeeId, datum, standortId, alleStandortIds) {
  return standorteFuerTag(zeilen, employeeId, datum, alleStandortIds).includes(standortId);
}
