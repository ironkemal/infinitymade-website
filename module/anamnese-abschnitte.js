/** Anamnese-Aufruf der gemeinsamen Abschnittsnavigation (module/formular-abschnitte.js, art 'formular').
 * Originalfelder bleiben unverändert; Alt stellt Eltern und Reihenfolge exakt wieder her. Keine Abfragen.
 */
import { montiereFormularAbschnitte } from './formular-abschnitte.js?v=20261114v402';

export function montiereAnamneseAbschnitte(k) {
  return montiereFormularAbschnitte({
    ...k, panelId: 'anamnese', art: 'formular',
    selektor: '#anamPhysioForm > .card, #anamDynForm .anam-gruppe[data-gruppe]',
    ariaLabel: 'Abschnitte: Anamnese',
  });
}
