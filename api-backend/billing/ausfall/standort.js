// Welcher Praxisname steht auf der Ausfallrechnung?
//
// Beta-2, 12.08.2026: „obwohl wir den Namen vom Laden geändert haben, stand auf
// der Ausfallrechnung immer noch der vorherige gespeicherte Name."
//
// Ursache: der Name kam aus `businesses.business_name`. Eine Einzelpraxis hat
// dort genau einen Eintrag — den, der beim Onboarding angelegt wurde. Der
// Inhaber ändert den Namen aber in den Einstellungen, und die schreiben auf
// `profiles` (Owner-Ebene, siehe CLAUDE.md). Der businesses-Eintrag blieb
// stehen und gewann trotzdem.
//
// Regel: der Standortname zählt nur, wenn er überhaupt etwas Eigenes bedeutet —
// also wenn die Praxis mehrere Standorte führt UND der Termin ausdrücklich an
// einem davon hängt. In jedem anderen Fall ist das Inhaberprofil die Quelle.

/**
 * @param {Array<{id: string}>} standorte  Alle businesses-Zeilen des Inhabers
 * @param {string|null} businessId         bookings.business_id bzw. ausfallrechnungen.business_id
 * @returns {object|null}  Standort, dessen Name gelten soll — oder null für „Inhaberprofil"
 */
export function standortFuerName(standorte, businessId) {
  const liste = standorte || [];
  if (liste.length <= 1) return null;
  if (!businessId) return null;
  return liste.find(b => b.id === businessId) || null;
}

/**
 * Der Datensatz, an dem Zuordnung und Hinweistext hängen — unabhängig davon,
 * wessen Name gedruckt wird.
 *
 * @param {Array<{id: string, is_default?: boolean}>} standorte
 * @param {string|null} businessId
 * @returns {object|null}
 */
export function standortFuerZuordnung(standorte, businessId) {
  const liste = standorte || [];
  return (businessId ? liste.find(b => b.id === businessId) : null)
    || liste.find(b => b.is_default)
    || null;
}
