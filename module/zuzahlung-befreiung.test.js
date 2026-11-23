import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vorjahresBefreiungHinweis, ladeVorjahresBefreiungHinweis } from './zuzahlung-befreiung.js';

test('vorjahresBefreiungHinweis: war im Vorjahr befreit, neues Jahr noch leer -> klarer Hinweis + Vorschlag', () => {
  const h = vorjahresBefreiungHinweis(
    [{ jahr: 2026, befreit_ab: '2026-01-01', befreit_bis: '2026-12-31', nachweis_art: 'bescheinigung' }],
    '2027-01-04'
  );
  assert.ok(h);
  assert.equal(h.vorjahr, 2026);
  assert.equal(h.zielJahr, 2027);
  assert.equal(h.istJahresende, false);
  assert.equal(h.vorschlagAb, '2027-01-01');
  assert.equal(h.vorschlagBis, '2027-12-31');
  assert.equal(h.nachweisArt, 'bescheinigung');
  assert.match(h.meldung, /War 2026 zuzahlungsbefreit.*31\.12\.2026.*2027/);
});

test('vorjahresBefreiungHinweis: neues Jahr bereits eingetragen -> null (kein Fehlalarm)', () => {
  const h = vorjahresBefreiungHinweis(
    [
      { jahr: 2026, befreit_ab: '2026-01-01', befreit_bis: '2026-12-31' },
      { jahr: 2027, befreit_ab: '2027-01-01', befreit_bis: '2027-12-31' },
    ],
    '2027-01-04'
  );
  assert.equal(h, null);
});

test('vorjahresBefreiungHinweis: Dezember mit aktiver Befreiung ohne Folgejahr -> proaktive Jahresende-Erinnerung', () => {
  const h = vorjahresBefreiungHinweis(
    [{ jahr: 2026, befreit_ab: '2026-03-01', befreit_bis: '2026-12-31', nachweis_art: 'automatisch' }],
    '2026-12-10'
  );
  assert.ok(h);
  assert.equal(h.vorjahr, 2026);
  assert.equal(h.zielJahr, 2027);
  assert.equal(h.istJahresende, true);
  assert.equal(h.vorschlagAb, '2027-01-01');
  assert.equal(h.nachweisArt, 'automatisch');
  assert.match(h.meldung, /Befreiung 2026 läuft am 31\.12\.2026 aus.*2027/);
});

test('vorjahresBefreiungHinweis: November mit aktiver Befreiung -> noch kein Jahresende-Hinweis', () => {
  const h = vorjahresBefreiungHinweis(
    [{ jahr: 2026, befreit_ab: '2026-01-01', befreit_bis: '2026-12-31' }],
    '2026-11-23'
  );
  assert.equal(h, null);
});

test('vorjahresBefreiungHinweis: Dezember wenn Folgejahr schon eingetragen -> null', () => {
  const h = vorjahresBefreiungHinweis(
    [
      { jahr: 2026, befreit_ab: '2026-01-01', befreit_bis: '2026-12-31' },
      { jahr: 2027, befreit_ab: '2027-01-01', befreit_bis: '2027-12-31' },
    ],
    '2026-12-15'
  );
  assert.equal(h, null);
});

test('ladeVorjahresBefreiungHinweis: lädt [vorjahr, jahr, folgejahr] in einer Abfrage', async () => {
  let gesehenJahre = null;
  const supabase = {
    from() {
      const q = {
        select() { return q; },
        eq() { return q; },
        in(_k, vals) { gesehenJahre = vals; return q; },
        then(resolve) {
          return Promise.resolve({
            data: [{ jahr: 2026, befreit_ab: '2026-01-01', befreit_bis: '2026-12-31', nachweis_art: 'bescheinigung' }],
            error: null,
          }).then(resolve);
        },
      };
      return q;
    },
  };
  const h = await ladeVorjahresBefreiungHinweis(supabase, 'pat-1', '2027-01-05');
  assert.deepEqual(gesehenJahre, [2026, 2027, 2028]);
  assert.equal(h?.zielJahr, 2027);
});
