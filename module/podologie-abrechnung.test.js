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

test('die Zuhoerer der Liste, der §302-/Uebernehmen-Knoepfe und des Kostentraeger-Auf/Zuklappens stehen auf Modulebene', () => {
  // Modulebene = Spaltenanfang. Alles, was eingerueckt ist, steht in einer
  // Funktion und laeuft damit mehr als einmal.
  //
  // Vierter Zuhoerer seit 05.09.2026 (Faz-1-Fehlerbereich): "trotzdem
  // uebernehmen" fuer einzelne fehlerhafte Verordnungen ist ein eigener
  // Netzwerkaufruf mit eigener disabled-Bremse — dieselbe Regel wie die
  // anderen drei: an `document` haengen, nicht an ein Element, das
  // loadPodologieBilling() bei jedem Aufruf neu erzeugt.
  //
  // Fuenfter und sechster seit 07.09.2026 (Ops #283, Mehrfachauswahl):
  // ein `change`-Zuhoerer fuer die Kassen-Haken und ein `click`-Zuhoerer fuer
  // den Sammelknopf. Gerade der Sammelknopf ist der Fall, vor dem dieser Test
  // schuetzt: er stoesst N Abrechnungen an, ein doppelt registrierter Zuhoerer
  // wuerde also 2N Dateien erzeugen.
  const aufModulebene = (quelle.match(/^document\.addEventListener\(/gm) || []).length;
  assert.equal(aufModulebene, 6,
    `Erwartet: Listen- + §302- + Auf/Zuklapp- + Uebernehmen- + Auswahl- + Sammel-Zuhoerer, alle auf Modulebene. Gefunden: ${aufModulebene}.`);
});

test('der "trotzdem uebernehmen"-Handler prueft disabled — gleiche zweite Bremse wie der §302-Knopf', () => {
  const treffer = quelle.match(/pod-fehler-uebernehmen-btn[\s\S]{0,400}?if\s*\(\s*!btn\s*\|\|\s*btn\.disabled\s*\)\s*return;/);
  assert.ok(treffer, 'Der Uebernehmen-Handler muss dieselbe disabled-Bremse wie der §302-Handler haben.');
});

test('der §302-Handler prueft disabled — zweite Bremse, absichtlich', () => {
  assert.ok(/if\s*\(\s*!btn\s*\|\|\s*btn\.disabled\s*\)\s*return;/.test(quelle),
    'Zweite Bremse entfernt. Sie faengt einen Doppelklick ab, auch wenn die erste haelt.');
});

test('der Sammelknopf hat dieselbe disabled-Bremse', () => {
  assert.ok(/podSammelBtn[\s\S]{0,200}?if\s*\(\s*!btn\s*\|\|\s*btn\.disabled\s*\)\s*return;/.test(quelle),
    'Der Sammelknopf stoesst N Abrechnungen an — ohne die Bremse werden aus einem Doppelklick 2N Dateien.');
});

test('die Sammelabrechnung laeuft nacheinander, nicht parallel', () => {
  // Jede Anfrage leitet ihre Datennummer aus der Zahl der schon vorhandenen
  // abrechnung-Zeilen ab. Parallel gestartet lesen mehrere denselben Stand und
  // vergeben denselben Dateinamen.
  assert.ok(/for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*kassen\.length[\s\S]{0,1500}?await\s+fetch\(/.test(quelle),
    'Die Schleife muss jede Kasse abwarten (await im Rumpf), kein Promise.all.');
  assert.ok(!/Promise\.all\([\s\S]{0,200}kassen/.test(quelle),
    'Promise.all ueber die Kassen wuerde doppelte Datennummern erzeugen.');
});
