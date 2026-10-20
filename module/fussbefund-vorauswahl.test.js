import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vorauswahlTermin } from './fussbefund.js';

const jetzt = new Date('2026-10-21T09:30:00Z');   // 11:30 Berlin
const t = (id, iso) => ({ id, start_time: iso });

test('heutiger Termin vor künftigem und vergangenem', () => {
  const l = [t('zukunft', '2026-12-16T09:00:00Z'), t('heute', '2026-10-21T13:00:00Z'), t('gestern', '2026-10-20T09:00:00Z')];
  assert.equal(vorauswahlTermin(l, jetzt).id, 'heute');
});

test('ohne heutigen: letzter vergangener, nie der künftige', () => {
  const l = [t('zukunft', '2026-12-16T09:00:00Z'), t('alt', '2026-09-01T09:00:00Z'), t('neuer', '2026-10-14T09:00:00Z')];
  assert.equal(vorauswahlTermin(l, jetzt).id, 'neuer');
});

test('nur künftige Termine: keine Vorauswahl', () => {
  assert.equal(vorauswahlTermin([t('zukunft', '2026-12-16T09:00:00Z')], jetzt), null);
});
