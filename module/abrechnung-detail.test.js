// Die untere Haelfte des §302-Archivs. Getestet sind die drei reinen Teile —
// Zeitraum, Faelligkeit und die Wortliste der Zeilen-Rueckmeldung.
//
// Die Faelligkeit ist die einzige Frist auf diesem Bildschirm, an der Geld
// haengt: 4 Wochen ab Eingang der vollstaendigen Unterlagen (Richtlinien-Text
// 20.11.2006 § 7 Abs. 2). Sie darf NICHT auf eine Datei gesetzt werden, die
// noch im Haus liegt — das waere eine erfundene Mahnung gegen die Kasse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zeitraumAusZeilen, faelligkeit, zeilenStatusInfo, leerHinweisText } from './abrechnung-detail.js';

test('zeitraumAusZeilen: erstes und letztes Verordnungsdatum', () => {
  const z = zeitraumAusZeilen([
    { verordnungsdatum: '2026-03-15' },
    { verordnungsdatum: '2026-01-05' },
    { verordnungsdatum: '2026-02-20' },
  ]);
  assert.deepEqual(z, { von: '2026-01-05', bis: '2026-03-15' });
});

test('zeitraumAusZeilen: fehlende Daten werden ausgelassen, nicht ersetzt', () => {
  // „heute" einzusetzen waere eine Zahl, die auf keinem Beleg steht.
  const z = zeitraumAusZeilen([{ verordnungsdatum: null }, { verordnungsdatum: '2026-04-01' }]);
  assert.deepEqual(z, { von: '2026-04-01', bis: '2026-04-01' });
  assert.deepEqual(zeitraumAusZeilen([]), { von: null, bis: null });
  assert.deepEqual(zeitraumAusZeilen(null), { von: null, bis: null });
});

test('faelligkeit: Einreichung + 28 Tage', () => {
  const heute = new Date('2026-09-09T12:00:00Z');
  const f = faelligkeit({ zaa_uploaded_at: '2026-09-01T08:00:00Z' }, heute);
  assert.equal(f.am, '2026-09-29');
  assert.equal(f.ueberfaellig, false);
  assert.equal(f.tageRest, 20);
});

test('faelligkeit: ueberfaellig wird als solches gemeldet', () => {
  const heute = new Date('2026-09-09T12:00:00Z');
  const f = faelligkeit({ zaa_uploaded_at: '2026-07-01T08:00:00Z' }, heute);
  assert.equal(f.ueberfaellig, true);
  assert.ok(f.tageRest < 0);
});

test('faelligkeit: nicht eingereicht heisst keine Frist', () => {
  assert.equal(faelligkeit({ zaa_uploaded_at: null }), null);
  assert.equal(faelligkeit(null), null);
});

test('zeilenStatusInfo kennt alle fuenf Datenbankwerte', () => {
  // Genau die Liste aus dem CHECK von abrechnung_zeile.status.
  for (const k of ['eingereicht', 'akzeptiert', 'abgesetzt', 'teilabgesetzt', 'nachgereicht']) {
    const i = zeilenStatusInfo(k);
    assert.ok(i.text, `${k} hat keinen Wortlaut`);
    assert.ok(i.farbe, `${k} hat keine Farbe`);
  }
  // „akzeptiert" heisst auf dem Bildschirm „angenommen" — derselbe Wortwechsel
  // wie auf der Dateiachse (abrechnung-status.js), damit die Anwendung
  // durchgehend dieselben Wörter benutzt.
  assert.equal(zeilenStatusInfo('akzeptiert').text, 'angenommen');
  // Unbekanntes wird gezeigt wie es ist, nicht auf einen bekannten Status
  // geschoent — sonst sieht ein Datenfehler wie ein Normalfall aus.
  assert.equal(zeilenStatusInfo('quatsch').text, 'quatsch');
});

test('leerHinweisText: drei Gründe für fehlende Zeilen', () => {
  // 1. Verworfen in Vorprüfung: keine Datei erzeugt, Grund wird genannt, Datum ist egal
  const verworfenMitGrund = {
    status: 'verworfen',
    verwerfungsgrund: 'Preflight [V:01011] (1 Fehler)',
    created_at: '2026-08-01T00:00:00Z',
  };
  const txt1 = leerHinweisText(verworfenMitGrund);
  assert.match(txt1, /Diese Abrechnung wurde in der Vorprüfung abgelehnt — es wurde keine Datei erzeugt: Preflight \[V:01011\] \(1 Fehler\)/);

  const verworfenOhneGrund = { status: 'verworfen' };
  const txt1b = leerHinweisText(verworfenOhneGrund);
  assert.equal(txt1b, 'Diese Abrechnung wurde in der Vorprüfung abgelehnt — es wurde keine Datei erzeugt.');

  // 2. Vor dem 09.09.2026 entstanden: damalige Altdatei ohne Zeilenspeicherung
  const alt = { created_at: '2026-09-01T10:00:00Z', prescription_count: 5 };
  const txt2 = leerHinweisText(alt);
  assert.equal(txt2, 'Für diese Datei sind keine Zeilen gespeichert. Das betrifft Dateien, die vor dem 09.09.2026 entstanden sind — damals hielt nur der Kopfsatz fest, wie viele Belege drin waren (5).');

  // 3. Neu entstanden (09.09.2026 und danach): keine falsche Altdatei-Behauptung
  const neu = { created_at: '2026-09-20T12:00:00Z', prescription_count: 3 };
  const txt3 = leerHinweisText(neu);
  assert.equal(txt3, 'Für diese Datei sind keine Zeilen gespeichert. Laut Kopfsatz enthält sie 3 Beleg(e).');
  assert.doesNotMatch(txt3, /09\.09\.2026/);
});

test('leerHinweisText: fehlendes oder ungültiges created_at macht keine historische Datumsbehauptung', () => {
  // Ohne verlässliches Erstelldatum darf nicht behauptet werden, die Datei stamme von vor dem 09.09.2026.
  const ohneDatum = { created_at: null, prescription_count: 2 };
  const txtNull = leerHinweisText(ohneDatum);
  assert.equal(txtNull, 'Für diese Datei sind keine Zeilen gespeichert. Laut Kopfsatz enthält sie 2 Beleg(e).');
  assert.doesNotMatch(txtNull, /09\.09\.2026/);

  const ungueltigesDatum = { created_at: 'ungueltig', prescription_count: 0 };
  const txtInvalid = leerHinweisText(ungueltigesDatum);
  assert.equal(txtInvalid, 'Für diese Datei sind keine Zeilen gespeichert. Laut Kopfsatz enthält sie 0 Beleg(e).');
  assert.doesNotMatch(txtInvalid, /09\.09\.2026/);
});
