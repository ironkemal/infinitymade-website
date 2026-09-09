// Die untere Haelfte des §302-Archivs. Getestet sind die drei reinen Teile —
// Zeitraum, Faelligkeit und die Wortliste der Zeilen-Rueckmeldung.
//
// Die Faelligkeit ist die einzige Frist auf diesem Bildschirm, an der Geld
// haengt: 4 Wochen ab Eingang der vollstaendigen Unterlagen (Richtlinien-Text
// 20.11.2006 § 7 Abs. 2). Sie darf NICHT auf eine Datei gesetzt werden, die
// noch im Haus liegt — das waere eine erfundene Mahnung gegen die Kasse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zeitraumAusZeilen, faelligkeit, zeilenStatusInfo } from './abrechnung-detail.js';

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
