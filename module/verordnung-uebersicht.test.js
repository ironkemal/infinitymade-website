import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ladeAktiveVerordnungen, physioZaehler, podoZaehler,
} from './verordnung-uebersicht.js';

// Warum es diese Datei gibt:
// Der Anlass war Beta-1 (Beta-Podologe, 08.08.2026): Nagelspange (UI2)
// und Komplexbehandlung (DF/NF/QF) laufen beim selben Patienten gleichzeitig,
// und weil die Akte sie nicht nebeneinander zeigte, legte die Praxis für einen
// Patienten zwei Akten an. Der Test, der das festnagelt, ist der letzte hier:
// zwei parallele Verordnungen, zwei getrennte Zähler, keine Vermischung.

/** Minimaler Supabase-Ersatz (Vorbild: rechnung-verordnung.test.js). */
function fakeSb(tabellen) {
  const kette = (tabelle) => {
    const antwort = { data: tabellen[tabelle] || [], error: null };
    const selbst = {
      select: () => selbst,
      eq: () => selbst,
      in: () => selbst,
      not: () => selbst,
      limit: () => selbst,
      order: () => Promise.resolve(antwort),
      maybeSingle: () => Promise.resolve({ data: (tabellen[tabelle] || [])[0] || null, error: null }),
      then: (res) => res(antwort),
    };
    return selbst;
  };
  return { from: kette };
}

const OPTS = { ownerId: 'o1', leadId: 'p1' };

/* ── Zähler ───────────────────────────────────────────────────────────────── */

test('Physio: erbracht zählt nur erledigte Sitzungen, nicht die Platzhalter', () => {
  // `saveRezept` legt alle Einheiten sofort als Zeilen ohne Termin an. Zählte
  // man Zeilen statt Status, stünde am ersten Tag „6 / 6".
  const rx = {
    anzahl_einheiten: 6,
    prescription_sessions: [
      { status: 'done' }, { status: 'done' },
      { status: 'planned' }, { status: 'planned' },
      { status: 'cancelled' }, { status: 'no_show' },
    ],
  };
  assert.deepEqual(physioZaehler(rx), { erbracht: 2, verordnet: 6 });
});

test('Physio: verordnet kommt aus anzahl_einheiten, nicht aus der Zeilenzahl', () => {
  // Eine gelöschte Sitzungszeile darf den Nenner nicht verkleinern — sonst
  // sieht eine unvollständige Verordnung vollständig aus.
  const rx = { anzahl_einheiten: 10, prescription_sessions: [{ status: 'done' }] };
  assert.deepEqual(physioZaehler(rx), { erbracht: 1, verordnet: 10 });
});

test('Podologie: erbracht ist die Zahl der dokumentierten Behandlungen', () => {
  // Hier gibt es keine Platzhalter — eine Zeile entsteht erst beim Behandeln.
  assert.deepEqual(
    podoZaehler({ behandlungseinheiten: 4 }, [{ id: 'b1' }, { id: 'b2' }]),
    { erbracht: 2, verordnet: 4 },
  );
  assert.deepEqual(podoZaehler({ behandlungseinheiten: 4 }, []), { erbracht: 0, verordnet: 4 });
  assert.deepEqual(podoZaehler({ behandlungseinheiten: 4 }, undefined), { erbracht: 0, verordnet: 4 });
});

/* ── Laden ────────────────────────────────────────────────────────────────── */

test('ohne owner wird gar nicht erst abgefragt', async () => {
  // `leadId` ist seit dem Umbau der Seite „Verordnungen" (31.08.2026) optional:
  // ohne ihn wird praxisweit geladen. Ohne `ownerId` dagegen fehlt die
  // Mandantengrenze — dann wird nicht gefragt, nicht „alles" geliefert.
  assert.deepEqual(await ladeAktiveVerordnungen(fakeSb({}), {}), []);
  assert.deepEqual(await ladeAktiveVerordnungen(null, OPTS), []);
});

test('praxisweit: ohne leadId kommen die Zeilen mit Nach- und Vorname', async () => {
  // Die obere Hälfte der neuen Seite zeigt Nachname und Vorname in getrennten
  // Spalten (Kemal, 31.08.2026) — beide müssen aus dem Verbund kommen.
  const liste = await ladeAktiveVerordnungen(fakeSb({
    prescriptions: [{
      id: 'rx1', patient_id: 'p1', ausstellungsdatum: '2026-08-01', anzahl_einheiten: 6,
      status: 'in_therapy', verordnungsnummer: 3,
      leads: { first_name: 'Anna', last_name: 'Berger', patientennummer: 12 },
    }],
  }), { ownerId: 'o1' });

  assert.equal(liste.length, 1);
  assert.equal(liste[0].nachname, 'Berger');
  assert.equal(liste[0].vorname, 'Anna');
  assert.equal(liste[0].leadId, 'p1');
  assert.equal(liste[0].nummerText, '12-3');
});

test('Podologie ohne Patientenakte: Name aus dem Freitextfeld, Nummer bleibt leer', async () => {
  // Altbestand: `verordnungen.lead_id` ist NULL (2 von 4 Zeilen, Stand
  // 02.09.2026). Dann vergibt der Trigger keine Verordnungsnummer — die
  // Belegnummer muss LEER bleiben und darf nichts erfinden.
  const [v] = await ladeAktiveVerordnungen(fakeSb({
    verordnungen: [{
      id: 'v1', lead_id: null, patient_name: 'Werner Müller · 1955-12-19',
      ausstellungsdatum: '2026-08-02', behandlungseinheiten: 4, diagnosegruppe: 'DF2',
      verordnungsnummer: null, belegnummer: null,
    }],
  }), { ownerId: 'o1' });

  assert.equal(v.nachname, 'Müller');
  assert.equal(v.vorname, 'Werner');
  assert.equal(v.nummerText, '');
  assert.equal(v.leadId, null);
});

test('nurAktive:false lädt auch Abgerechnetes — sonst sieht es wie Datenverlust aus', async () => {
  const liste = await ladeAktiveVerordnungen(fakeSb({
    prescriptions: [{ id: 'rx1', ausstellungsdatum: '2026-07-01', status: 'billed', anzahl_einheiten: 6 }],
    verordnungen: [{ id: 'v1', ausstellungsdatum: '2026-07-02', status: 'abgerechnet', behandlungseinheiten: 4 }],
  }), { ownerId: 'o1', nurAktive: false });

  assert.equal(liste.length, 2);
});

test('beide Töpfe kommen in EINE Liste, neueste zuerst', async () => {
  // Eine interdisziplinäre Praxis führt denselben Patienten in beiden Töpfen.
  // Nach `sector` zu filtern würde hier eine der beiden Verordnungen verstecken.
  const liste = await ladeAktiveVerordnungen(fakeSb({
    prescriptions: [{
      id: 'rx1', ausstellungsdatum: '2026-08-01', heilmittel: 'KG',
      anzahl_einheiten: 6, status: 'in_therapy',
      prescription_sessions: [{ status: 'done' }],
    }],
    verordnungen: [{
      id: 'v1', ausstellungsdatum: '2026-08-20', diagnosegruppe: 'DF2',
      behandlungseinheiten: 4, status: 'aktiv', icd10: ['E11.40'],
    }],
    podologie_behandlungen: [{ id: 'b1', verordnung_id: 'v1' }],
    leads: [{ patientennummer: 12 }],
  }), OPTS);

  assert.equal(liste.length, 2);
  assert.equal(liste[0].id, 'v1');        // 20.08. vor 01.08.
  assert.equal(liste[0].quelle, 'podologie');
  assert.equal(liste[1].quelle, 'physio');
});

test('Sprungziel je Topf — sonst landet der Klick im falschen Panel', async () => {
  const liste = await ladeAktiveVerordnungen(fakeSb({
    prescriptions: [{ id: 'rx1', ausstellungsdatum: '2026-08-01', anzahl_einheiten: 6 }],
    verordnungen: [{ id: 'v1', ausstellungsdatum: '2026-08-02', behandlungseinheiten: 4, diagnosegruppe: 'UI2' }],
  }), OPTS);
  assert.equal(liste.find(v => v.quelle === 'physio').ziel, 'verordnungen');
  assert.equal(liste.find(v => v.quelle === 'podologie').ziel, 'podologie');
});

test('Podologie-icd10 ist ein Array — es darf nicht als "[object Object]" landen', async () => {
  const [v] = await ladeAktiveVerordnungen(fakeSb({
    verordnungen: [{
      id: 'v1', ausstellungsdatum: '2026-08-02', behandlungseinheiten: 4,
      diagnosegruppe: 'DF2', icd10: ['E11.40', 'E11.74'],
    }],
  }), OPTS);
  assert.equal(v.diagnose, 'E11.40, E11.74 · DF2');
});

// Der eigentliche Anlass, Fragen-Antworten-Katalog Podologie Nr. 33:
// parallele Verordnungen sind zulässig, und die Akte muss sie getrennt zählen.
test('Nagelspange (UI2) und Komplexbehandlung (DF) parallel, getrennte Zähler', async () => {
  const liste = await ladeAktiveVerordnungen(fakeSb({
    verordnungen: [
      { id: 'ui2', ausstellungsdatum: '2026-08-10', diagnosegruppe: 'UI2', behandlungseinheiten: 3, status: 'aktiv' },
      { id: 'df2', ausstellungsdatum: '2026-08-05', diagnosegruppe: 'DF2', behandlungseinheiten: 6, status: 'aktiv' },
    ],
    podologie_behandlungen: [
      { id: 'b1', verordnung_id: 'ui2' },
      { id: 'b2', verordnung_id: 'df2' }, { id: 'b3', verordnung_id: 'df2' }, { id: 'b4', verordnung_id: 'df2' },
    ],
  }), OPTS);

  const ui2 = liste.find(v => v.id === 'ui2');
  const df2 = liste.find(v => v.id === 'df2');

  assert.deepEqual([ui2.erbracht, ui2.verordnet], [1, 3]);
  assert.deepEqual([df2.erbracht, df2.verordnet], [3, 6]);
  // Die Überschrift ist das, worüber in der Praxis gesprochen wird.
  assert.equal(ui2.titel, 'UI2 · Nagelspange');
  assert.match(df2.titel, /^DF2/);
});
