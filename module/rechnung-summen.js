/**
 * rechnung-summen.js — Summen und Beschriftung einer Rechnung, getrennt nach Zahler (Live-Test 06.10.2026, F4/F6/F7).
 *
 * Bisher rechnete der Editor für Privat/BG „Zu zahlen“ aus den (versteckten) Zuzahlungsfeldern → 0,00 €, das
 * Speichern rechnete anders (Zwischensumme), und für SELBSTZAHLER fehlte die Ausnahme ganz: die versteckten
 * Standardwerte 10 % + 10 € landeten im Betrag. Eine Stelle für beides.
 *
 * Nicht-GKV (privat | selbstzahler | bg): kein Eigenanteil, keine Kassenzuzahlung, Betrag = Zwischensumme.
 */
const OHNE_ZUZAHLUNG = ['privat', 'selbstzahler', 'bg'];
const zahl = (w) => { const n = parseFloat(w); return Number.isFinite(n) ? n : 0; };

/** @returns {{sub:number, eigenPct:number, eigenEur:number, kasse:number, total:number}} */
export function rechnungsSummen(zeilen, invoiceType, eigenPctEingabe, kasseEingabe) {
  const sub = (zeilen || []).reduce((s, l) => s + (l.quantity || 1) * (l.unit_price || 0), 0);
  const ohne = OHNE_ZUZAHLUNG.includes(invoiceType);
  const eigenPct = ohne ? 0 : zahl(eigenPctEingabe);
  const eigenEur = sub * (eigenPct / 100);
  const kasse = ohne ? 0 : zahl(kasseEingabe);
  return { sub, eigenPct, eigenEur, kasse, total: ohne ? sub : eigenEur + kasse };
}

/** Summenblock der Rechnungsansicht: welche Zeilen, welche Beschriftung der Endsumme. */
export function summenAnzeige(inv) {
  const typ = inv?.invoice_type;
  if (typ === 'bg') {
    return { eigenZeigen: false, kasseZeigen: false, label: 'Rechnungsbetrag (zahlbar durch den Unfallversicherungsträger)' };
  }
  if (typ === 'privat' || typ === 'selbstzahler') {
    return { eigenZeigen: false, kasseZeigen: false, label: 'Rechnungsbetrag' };
  }
  return { eigenZeigen: true, kasseZeigen: true, label: 'Zu zahlen (Patient)' };
}

/** Kurzbezeichnung für die Rechnungsliste. */
export function typKennzeichen(invoiceType) {
  return { gkv: 'GKV', bg: 'BG', selbstzahler: 'Selbstzahler', zuzahlung: 'Zuzahlung' }[invoiceType] || 'Privat';
}
