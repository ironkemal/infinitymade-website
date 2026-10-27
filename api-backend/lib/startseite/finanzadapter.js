import { ladeGeld } from './geld.js';

// Ein Reader, über diesen Adapter-Einstieg auch für spätere Blöcke erreichbar.
export { ladeMandantenZeilen } from './geld.js';

/**
 * B04-kompatible, lazy Finanzlader: lader.geld({tenantId}). Kein Preload/Cache.
 * Integrator übergibt den authentifizierten Tenant ausschließlich über B04;
 * Client und Uhr stammen aus dieser Factory, nicht aus Request-Overrides.
 * B05a verdrahtet nur Geld. Mahnungen/Abrechnung erscheinen nur bei explizit
 * injizierter vorhandener Funktion, nie als Dummy-Null oder unimplementierter Import.
 * Jeder Aufruf erhält frische Uhrkopie. Fehler bleiben B04-Blockfehler.
 * @param {{supabase:object,jetzt?:Date|function,lader?:object}} [opts]
 * jetzt kann feste Testzeit oder pro Ladevorgang aufgerufene Clock sein.
 * lader überschreibt vorhandene Blöcke mit Funktionen ({supabase,tenantId,jetzt}).
 * @returns {object} Teilmenge von {geld,mahnungen,abrechnung}, async Funktionen.
 */
export function createFinanzlader({ supabase, jetzt = () => new Date(), lader = {} } = {}) {
  const result = {};
  for (const name of ['geld', 'mahnungen', 'abrechnung']) {
    const laden = Object.hasOwn(lader, name) ? lader[name] : name === 'geld' ? ladeGeld : undefined;
    if (typeof laden !== 'function') continue;
    result[name] = async ({ tenantId } = {}) => {
      if (typeof tenantId !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(tenantId)) {
        throw new TypeError('Gültige tenantId erforderlich');
      }
      const zeit = typeof jetzt === 'function' ? jetzt() : jetzt;
      if (!(zeit instanceof Date) || !Number.isFinite(zeit.getTime())) throw new TypeError('Gültige Uhr erforderlich');
      return laden({ supabase, tenantId: tenantId.toLowerCase(), jetzt: new Date(zeit.getTime()) });
    };
  }
  return result;
}
