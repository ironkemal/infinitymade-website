// Bauart-Test, kein Verhaltenstest.
//
// podologie-abrechnung.js laesst sich in node nicht importieren: der Modulrumpf
// ruft `document.addEventListener`. Geprueft wird deshalb die Quelle — und zwar
// genau die eine Eigenschaft, deren Verlust am 28.08.2026 Geld gekostet haette.
//
// Der Fehler: der Zuhoerer der §302-Knoepfe haing an `#podBillingContent`, einem
// statischen Element aus dashboard.html, und wurde INNERHALB von
// loadPodologieBilling() registriert. Jedes Neuzeichnen hing einen weiteren an;
// ein Klick loeste nach N Zeichnungen N Anfragen aus, und jede Anfrage legte
// eine eigene abrechnung-Zeile samt DTA-Datei an.
//
// Warum ein Quelltext-Test und nicht der Netz-Tab: die urspruengliche Abnahme
// („5x neu zeichnen, ein Klick = eine Anfrage") ist am heutigen Stand NICHT
// unterscheidungsfaehig. Der Handler traegt seit der Reparatur zusaetzlich
// `if (!btn || btn.disabled) return;`, und `disabled` wird vor dem ersten await
// synchron gesetzt — auch bei N Zuhoerern kaeme also genau eine Anfahrt heraus.
// Der Klicktest wuerde das Symptom bestaetigen, nicht die Ursache. Dieser Test
// prueft die Ursache. (canli-test, 28.08.2026)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const quelle = readFileSync(new URL('./podologie-abrechnung.js', import.meta.url), 'utf8');

test('kein Zuhoerer haengt an #podBillingContent', () => {
  const treffer = quelle.match(/getElementById\(\s*['"]podBillingContent['"]\s*\)\s*\??\.\s*addEventListener/g);
  assert.equal(treffer, null,
    'Das Element ist statisch (dashboard.html) — ein hier registrierter Zuhoerer ' +
    'sammelt sich bei jedem Neuzeichnen an. Auf Modulebene an `document` haengen.');
});

test('die Zuhoerer der Liste und der §302-Knoepfe stehen auf Modulebene', () => {
  // Modulebene = Spaltenanfang. Alles, was eingerueckt ist, steht in einer
  // Funktion und laeuft damit mehr als einmal.
  const aufModulebene = (quelle.match(/^document\.addEventListener\(/gm) || []).length;
  assert.equal(aufModulebene, 2,
    `Erwartet: Listen-Zuhoerer + §302-Zuhoerer, beide auf Modulebene. Gefunden: ${aufModulebene}.`);
});

test('der §302-Handler prueft disabled — zweite Bremse, absichtlich', () => {
  assert.ok(/if\s*\(\s*!btn\s*\|\|\s*btn\.disabled\s*\)\s*return;/.test(quelle),
    'Zweite Bremse entfernt. Sie faengt einen Doppelklick ab, auch wenn die erste haelt.');
});
