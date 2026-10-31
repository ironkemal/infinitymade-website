import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  arbeitstageImZeitraum,
  ladeArbeitstage,
  urlaubsKennzahlen,
  ladeAnstellung,
  pruefeAnstellung,
  speichereAnstellung,
  anstellungHtml,
  mountAnstellung,
} from './anstellung.js';

test('A. Teilzeit Mo/Di/Mi: eine Urlaubswoche Mo–So zählt 3 Tage, nicht 5', () => {
  // 2026-11-02 (Mo) bis 2026-11-08 (So)
  // Wochentage: Mo=1, Di=2, Mi=3
  const teilzeitTage = new Set([1, 2, 3]);
  const tage = arbeitstageImZeitraum('2026-11-02', '2026-11-08', teilzeitTage);
  assert.equal(tage, 3);
});

test('B. Vollzeit Mo–Fr: Mo–So zählt 5, Wochenende allein zählt 0', () => {
  const vollzeitTage = new Set([1, 2, 3, 4, 5]);

  // Mo 2026-11-02 bis So 2026-11-08 -> Mo, Di, Mi, Do, Fr = 5 Tage
  const woche = arbeitstageImZeitraum('2026-11-02', '2026-11-08', vollzeitTage);
  assert.equal(woche, 5);

  // Wochenende: Sa 2026-11-07 bis So 2026-11-08 -> 0 Tage
  const wochenende = arbeitstageImZeitraum('2026-11-07', '2026-11-08', vollzeitTage);
  assert.equal(wochenende, 0);

  // Auch ohne explizite Angabe von arbeitstage (Vorgabe: Mo–Fr)
  assert.equal(arbeitstageImZeitraum('2026-11-02', '2026-11-08'), 5);
  assert.equal(arbeitstageImZeitraum('2026-11-07', '2026-11-08'), 0);
});

test('C. Zeitstempel 2026-11-02T00:00:00+00:00 bis 2026-11-06T00:00:00+00:00 zählt 5 Tage', () => {
  const von = '2026-11-02T00:00:00+00:00';
  const bis = '2026-11-06T00:00:00+00:00';
  const tage = arbeitstageImZeitraum(von, bis);
  assert.equal(tage, 5);
});

test('D. Eintrag über die Zeitumstellung (24.10.2026 bis 26.10.2026) zählt korrekt', () => {
  // 24.10.2026 ist Sa (6)
  // 25.10.2026 ist So (0, Tag der Zeitumstellung auf Winterzeit)
  // 26.10.2026 ist Mo (1)
  // Mit Standard-Arbeitstagen (Mo–Fr): Nur Montag (26.10.) zählt -> 1 Tag
  const tageMoFr = arbeitstageImZeitraum('2026-10-24', '2026-10-26');
  assert.equal(tageMoFr, 1);

  // Wenn alle 7 Tage Arbeitstage sind (z. B. Sa, So, Mo): genau 3 Tage
  const alleTage = new Set([0, 1, 2, 3, 4, 5, 6]);
  const tageAlle = arbeitstageImZeitraum('2026-10-24', '2026-10-26', alleTage);
  assert.equal(tageAlle, 3);
});

test('E. urlaubsKennzahlen: krank zählt nicht als Urlaub, rest wird nie negativ', () => {
  const abwesenheiten = [
    { type: 'urlaub', start_date: '2026-11-02', end_date: '2026-11-06' }, // 5 Tage
    { type: 'krank', start_date: '2026-11-09', end_date: '2026-11-13' },  // darf nicht als Urlaub zählen
    { type: 'frei', start_date: '2026-11-16', end_date: '2026-11-16' },   // darf nicht als Urlaub zählen
  ];

  // Normalfall: 30 Anspruch, 5 verbraucht -> 25 Rest
  const kz1 = urlaubsKennzahlen({ abwesenheiten, anspruch: 30 });
  assert.equal(kz1.anspruch, 30);
  assert.equal(kz1.verbraucht, 5);
  assert.equal(kz1.rest, 25);

  // Anspruch kleiner als Verbrauch: Rest bleibt 0, nie negativ
  const kz2 = urlaubsKennzahlen({ abwesenheiten, anspruch: 3 });
  assert.equal(kz2.anspruch, 3);
  assert.equal(kz2.verbraucht, 5);
  assert.equal(kz2.rest, 0);

  // Fehlende Abwesenheiten
  const kz3 = urlaubsKennzahlen({ anspruch: 25 });
  assert.equal(kz3.anspruch, 25);
  assert.equal(kz3.verbraucht, 0);
  assert.equal(kz3.rest, 25);
});

test('F. ladeArbeitstage und ladeAnstellung werfen bei Datenbankfehler nicht und liefern die Vorgabe', async () => {
  const fehlerSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: new Error('DB nicht erreichbar') }),
          then: (resolve) => resolve({ data: null, error: new Error('DB nicht erreichbar') }),
        }),
      }),
    }),
  };

  const tageFehler = await ladeArbeitstage({ supabase: fehlerSupabase, empId: 'e-1' });
  assert.deepEqual(tageFehler, new Set([1, 2, 3, 4, 5]));

  const anstellungFehler = await ladeAnstellung({ supabase: fehlerSupabase, empId: 'e-1' });
  assert.deepEqual(anstellungFehler, {
    beschaeftigung: 'vollzeit',
    wochenstunden: null,
    urlaub_jahrestage: 30,
    vorhanden: false,
  });

  // Supabase wirft Exception
  const crashSupabase = {
    from: () => {
      throw new Error('Totaler Verbindungsabbruch');
    },
  };

  const tageCrash = await ladeArbeitstage({ supabase: crashSupabase, empId: 'e-1' });
  assert.deepEqual(tageCrash, new Set([1, 2, 3, 4, 5]));

  const anstellungCrash = await ladeAnstellung({ supabase: crashSupabase, empId: 'e-1' });
  assert.deepEqual(anstellungCrash, {
    beschaeftigung: 'vollzeit',
    wochenstunden: null,
    urlaub_jahrestage: 30,
    vorhanden: false,
  });

  // Ohne Supabase / empId
  const tageLeer = await ladeArbeitstage({});
  assert.deepEqual(tageLeer, new Set([1, 2, 3, 4, 5]));

  const anstellungLeer = await ladeAnstellung({});
  assert.deepEqual(anstellungLeer, {
    beschaeftigung: 'vollzeit',
    wochenstunden: null,
    urlaub_jahrestage: 30,
    vorhanden: false,
  });
});

test('G. pruefeAnstellung: 19,5 wird 19.5, leere Stunden null, 81 Stunden und 61 Tage werden abgewiesen, unbekannte Beschäftigung abgewiesen', () => {
  // '19,5' -> 19.5
  const res1 = pruefeAnstellung({ beschaeftigung: 'teilzeit', wochenstunden: '19,5', urlaubJahrestage: 25 });
  assert.equal(res1.ok, true);
  assert.equal(res1.werte.wochenstunden, 19.5);
  assert.equal(res1.werte.beschaeftigung, 'teilzeit');
  assert.equal(res1.werte.urlaub_jahrestage, 25);

  // leere Stunden -> null
  const res2 = pruefeAnstellung({ beschaeftigung: 'vollzeit', wochenstunden: '', urlaubJahrestage: 30 });
  assert.equal(res2.ok, true);
  assert.equal(res2.werte.wochenstunden, null);

  const res2Null = pruefeAnstellung({ beschaeftigung: 'vollzeit', wochenstunden: null, urlaubJahrestage: 30 });
  assert.equal(res2Null.ok, true);
  assert.equal(res2Null.werte.wochenstunden, null);

  const res2Undef = pruefeAnstellung({ beschaeftigung: 'vollzeit', urlaubJahrestage: 30 });
  assert.equal(res2Undef.ok, true);
  assert.equal(res2Undef.werte.wochenstunden, null);

  // 81 Stunden abgewiesen
  const res81 = pruefeAnstellung({ beschaeftigung: 'vollzeit', wochenstunden: 81, urlaubJahrestage: 30 });
  assert.equal(res81.ok, false);
  assert.match(res81.meldung, /Wochenstunden/);

  const resMinusStd = pruefeAnstellung({ beschaeftigung: 'vollzeit', wochenstunden: -1, urlaubJahrestage: 30 });
  assert.equal(resMinusStd.ok, false);

  // 61 Tage abgewiesen
  const res61 = pruefeAnstellung({ beschaeftigung: 'vollzeit', wochenstunden: 40, urlaubJahrestage: 61 });
  assert.equal(res61.ok, false);
  assert.match(res61.meldung, /Urlaubsanspruch/);

  const resMinusTage = pruefeAnstellung({ beschaeftigung: 'vollzeit', wochenstunden: 40, urlaubJahrestage: -1 });
  assert.equal(resMinusTage.ok, false);

  // unbekannte Beschäftigung abgewiesen
  const resUnbekannt = pruefeAnstellung({ beschaeftigung: 'freiberufler', wochenstunden: 40, urlaubJahrestage: 30 });
  assert.equal(resUnbekannt.ok, false);
  assert.match(resUnbekannt.meldung, /Vollzeit oder Teilzeit/);

  const resLeerBeschaeftigung = pruefeAnstellung({ beschaeftigung: '', wochenstunden: 40, urlaubJahrestage: 30 });
  assert.equal(resLeerBeschaeftigung.ok, false);
});

test('H. speichereAnstellung schickt employee_id, owner_id und nutzt onConflict employee_id', async () => {
  let capturedTable = null;
  let capturedPayload = null;
  let capturedOptions = null;

  const mockSupabase = {
    from: (table) => {
      capturedTable = table;
      return {
        upsert: async (payload, options) => {
          capturedPayload = payload;
          capturedOptions = options;
          return { data: payload, error: null };
        },
      };
    },
  };

  const res = await speichereAnstellung({
    supabase: mockSupabase,
    ownerId: 'owner-uuid-1',
    employeeId: 'emp-uuid-2',
    beschaeftigung: 'teilzeit',
    wochenstunden: '19,5',
    urlaubJahrestage: 28,
  });

  assert.equal(res.ok, true);
  assert.equal(capturedTable, 'mitarbeiter_anstellung');
  assert.equal(capturedPayload.owner_id, 'owner-uuid-1');
  assert.equal(capturedPayload.employee_id, 'emp-uuid-2');
  assert.equal(capturedPayload.beschaeftigung, 'teilzeit');
  assert.equal(capturedPayload.wochenstunden, 19.5);
  assert.equal(capturedPayload.urlaub_jahrestage, 28);
  assert.deepEqual(capturedOptions, { onConflict: 'employee_id' });

  // Fehlerfall in Datenbank: liefert standardisierte Meldung
  const mockFehlerSupabase = {
    from: () => ({
      upsert: async () => ({ error: new Error('DB error') }),
    }),
  };

  const fehlerRes = await speichereAnstellung({
    supabase: mockFehlerSupabase,
    ownerId: 'owner-uuid-1',
    employeeId: 'emp-uuid-2',
    beschaeftigung: 'vollzeit',
    wochenstunden: 40,
    urlaubJahrestage: 30,
  });

  assert.equal(fehlerRes.ok, false);
  assert.equal(fehlerRes.meldung, 'Anstellung konnte nicht gespeichert werden.');
});

test('I. anstellungHtml zeigt bei istInhaber false keine Eingaben und keinen Knopf', () => {
  const anstellung = {
    beschaeftigung: 'teilzeit',
    wochenstunden: 20,
    urlaub_jahrestage: 25,
  };

  const htmlMitarbeiter = anstellungHtml(anstellung, { istInhaber: false });
  assert.equal(htmlMitarbeiter.includes('<input'), false);
  assert.equal(htmlMitarbeiter.includes('<select'), false);
  assert.equal(htmlMitarbeiter.includes('<button'), false);
  assert.equal(htmlMitarbeiter.includes('<textarea'), false);
  assert.match(htmlMitarbeiter, /Teilzeit/);
  assert.match(htmlMitarbeiter, /20 Std\./);
  assert.match(htmlMitarbeiter, /25 Tage/);

  // Bei Inhaber hingegen Eingaben und Knopf vorhanden
  const htmlInhaber = anstellungHtml(anstellung, { istInhaber: true });
  assert.equal(htmlInhaber.includes('<input'), true);
  assert.equal(htmlInhaber.includes('<select'), true);
  assert.equal(htmlInhaber.includes('<button'), true);
  assert.match(htmlInhaber, /Speichern/);
});

test('mountAnstellung laedt Daten und stoert bei Fehlern den Rest der Seite nicht', async () => {
  let mockHtml = '';
  const container = {
    set innerHTML(val) { mockHtml = val; },
    get innerHTML() { return mockHtml; },
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  // Funktioniert ohne Fehler
  await mountAnstellung(container, {
    supabase: null,
    ownerId: 'o1',
    empId: 'e1',
    istInhaber: false,
  });
  assert.match(mockHtml, /Anstellung &amp; Urlaub/);

  // Wirft auch bei null container nicht
  await assert.doesNotReject(async () => {
    await mountAnstellung(null, {});
  });
});
