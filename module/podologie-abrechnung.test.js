// Bauart-Test, kein Verhaltenstest.
//
// podologie-abrechnung.js laesst sich in node nicht importieren: der Modulrumpf
// ruft `document.addEventListener`. Geprueft wird deshalb die Quelle — und zwar
// genau die eine Eigenschaft, deren Verlust am 28.08.2026 Geld gekostet haette.
//
// Der Fehler: der Zuhoerer der §302-Knoepfe hing an `#podBillingContent`, einem
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
//
// ⚠️ 09.09.2026: Diese Datei traegt keinen §302-Teil mehr. Der Bildschirm heisst
// jetzt „Behandlungen" (Tagesbehandlung + Verordnungsliste); Auswahl, Sammellauf,
// Dateieinheit-Abzeichen und „trotzdem uebernehmen" sind nach
// `module/abrechnung-auswahl.js` gezogen (ABRECHNUNG_BILDSCHIRM_PLAN.md Phase 1).
// Die fuenf Tests, die dort hingehoeren, stehen jetzt in
// `abrechnung-auswahl.test.js` — sie wurden verschoben, nicht gestrichen.
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

test('der Zuhoerer der Verordnungsliste steht auf Modulebene', () => {
  // Modulebene = Spaltenanfang. Alles, was eingerueckt ist, steht in einer
  // Funktion und laeuft damit mehr als einmal.
  const aufModulebene = (quelle.match(/^document\.addEventListener\(/gm) || []).length;
  assert.equal(aufModulebene, 1,
    `Erwartet: genau der Listen-Zuhoerer (Status · Rechnung · Zeile waehlen). Gefunden: ${aufModulebene}.`);
});

test('der §302-Teil ist wirklich weg und kommt nicht als dritter Weg zurueck', () => {
  // „Kein dritter Weg, der spaeter aufgeraeumt wird" — genau so ist die
  // Doppelung prescriptions/verordnungen entstanden (Plan, Phase 1).
  for (const spur of ['pod-abr-btn', 'podSammelBtn', 'pod-kk-check', 'pod-fehler-uebernehmen-btn',
                      'create-podologie', 'podAbrZeitraum']) {
    assert.ok(!quelle.includes(spur),
      `"${spur}" gehoert nach module/abrechnung-auswahl.js — zwei Auswahllisten fuer dieselbe Sache gibt es nicht mehr.`);
  }
});
