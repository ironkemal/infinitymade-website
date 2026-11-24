import { kasseAbrechnungsbereit } from './krankenkasse-suche.js?v=20261003e';
import { regelsatzLaden } from './verordnung-regelsatz-cache.js?v=20261124dg1';
import { pruefeVerordnung, voAusGespeicherterVerordnung } from './verordnung-pruefung.js?v=20261124dg1';

export async function bereitschaftsFehler(sb, rx) {
  if (!kasseAbrechnungsbereit(rx)) return 'Bitte Krankenkasse und Karten-IK ergänzen, bevor Sie die Verordnung als bereit markieren.';
  const vo = voAusGespeicherterVerordnung(rx);
  const regeln = await regelsatzLaden(sb, vo.bereich);
  if (!regeln) return 'Prüfdaten konnten nicht geladen werden. Bitte erneut versuchen.';
  const blocker = pruefeVerordnung(vo, regeln).befunde.filter(b => b.schwere === 'blocker');
  return blocker.length ? 'Bitte Verordnung korrigieren: ' + blocker.map(b => b.text).join(' ') : '';
}
