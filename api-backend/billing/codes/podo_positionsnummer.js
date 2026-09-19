/**
 * Abrechnungspositionsnummer einer podologischen Leistung.
 *
 * Die HPNR des Podologen ist BEREITS die vollständige, 5-stellige
 * Positionsnummer (78010, 78020, 78030 …; erste Ziffer 7 = Podologe, s.
 * wissensbank/podologie/Podologie_Positionsnummern_2026_Filtered.csv).
 * Anlage 3 §8.2.1 verlangt sie 5-stellig (an..5).
 *
 * Der Podologie-Mapper hängte bis 19.09.2026 den Abrechnungscode davor
 * (`${'71'}${'78020'}` = "7178020", 7 Stellen) — die Physio-Logik, in der aus
 * der Vorlage X0501 erst durch das Präfix eine Nummer wird. Der Preflight
 * lehnte deshalb JEDE podologische Abrechnung mit S:01002 ab; sie ist seit dem
 * ersten Commit dieses Pfads nie durchgegangen (E2E-Lauf 19.09.2026).
 *
 * @param {string|number} hpnr
 * @returns {string}
 */
export function podoPositionsnummer(hpnr) {
  const s = String(hpnr ?? '').trim();
  if (!/^\d{5}$/.test(s)) {
    throw new Error(`Podologie-HPNR "${s}" ist keine 5-stellige Positionsnummer`);
  }
  return s;
}
