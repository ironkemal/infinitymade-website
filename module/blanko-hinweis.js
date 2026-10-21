import { datumDe, alsISODatum } from './datum.js?v=20261001a';

/**
 * Bewusst keine Vergütungsampel: Vertragsgrenzen und Zählbasis sind noch nicht
 * fachbereichsspezifisch bestätigt (Ops #291). Nullwerte sind kein Verbrauch 0.
 * Erster Einsatz: Rezeptkarten in der Patientenakte.
 */
export function renderBlankoHinweis(rx, dokumentiert = 0, heute = new Date()) {
  if (!rx || !(rx.rezept_typ === 'blanko' || rx.is_blanko === true)) return '';
  const anzahl = Number.isSafeInteger(dokumentiert) && dokumentiert >= 0 ? dokumentiert : null;
  // Nur ein echter Kalendertag darf in HTML gelangen, kein freier Rezepttext.
  const tag = typeof rx.gueltig_bis === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rx.gueltig_bis)
    ? rx.gueltig_bis : '';
  const zeit = tag ? new Date(tag + 'T12:00:00Z') : null;
  const datum = zeit && !Number.isNaN(zeit.getTime()) && zeit.toISOString().slice(0, 10) === tag
    ? datumDe(tag) : '';
  const heuteTag = alsISODatum(heute);
  const resttage = datum && heuteTag
    ? Math.round((Date.parse(tag + 'T12:00:00Z') - Date.parse(heuteTag + 'T12:00:00Z')) / 86400000) : null;
  const frist = resttage === null ? '' : resttage < 0 ? ' (abgelaufen)' : ` (noch ${resttage} Tage)`;
  return `<div class="blanko-budget-card">
    <div class="blanko-budget-header">
      <strong>Blankoverordnung</strong>
      <span class="ampel-badge">Vergütungszone nicht geprüft</span>
      ${datum ? `<span>Gültig bis: ${datum}${frist}</span>` : ''}
    </div>
    <p>Vergütungszone nicht berechenbar: Bestätigte Vertragsgrenzen und eine geprüfte Zählbasis fehlen. Bitte vor der Abrechnung fachlich prüfen.</p>
    ${anzahl === null ? '' : `<span>${anzahl} Sitzung${anzahl === 1 ? '' : 'en'} dokumentiert</span>`}
  </div>`;
}
