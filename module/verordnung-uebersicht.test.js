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
//
// Seit 04.09.2026 EIN Verordnungstopf (`prescriptions`): Physio- und
// Podologie-Zeilen liegen in derselben Fixture-Tabelle, unterschieden durch
// `therapie_bereich`. Die Fixtures unten stehen deshalb in den nativen
// `prescriptions`-Feldnamen (patient_id, anzahl_einheiten, abrechnung_status,
// icd10 + icd10_2) — `ladeAktiveVerordnungen()` übersetzt den podologischen
// Zweig selbst über `verordnung-topf.js` (`ausTopf`), genau wie live.

/**
 * Minimaler, aber FILTERNDER Supabase-Ersatz.
 *
 * Seit der Zusammenlegung der Verordnungstöpfe fragen `rxQ` und `voQ` beide
 * `.from('prescriptions')` ab — nur noch `.eq('therapie_bereich', 'podo')`
 * bzw. der gegenteilige `.or(...)`-Ausschluss trennt sie. Ein Mock, der
 * `.eq()`/`.or()`/`.not()` ignoriert (wie vor dieser Datei), gäbe beiden
 * Abfragen dieselben Zeilen zurück — das genau ist die Doppelzählung, die die
 * echten Filter verhindern sollen. Der Mock muss sie deshalb ausführen.
 */
function fakeSb(tabellen) {
  const kette = (tabelle) => {
    const zeilen = tabellen[tabelle] || [];
    let bedingungen = [];

    const passt = (row) => bedingungen.every(b => b(row));

    const selbst = {
      select: () => selbst,
      // `owner_id` bewusst NICHT scharf geschaltet: das ist ein reiner
      // Durchreich-Parameter, keine Logik dieses Moduls — die Fixtures unten
      // tragen ihn nicht. Was hier wirklich geprüft wird (therapie_bereich,
      // patient_id, Status), bleibt real gefiltert.
      eq: (col, val) => {
        if (col === 'owner_id') return selbst;
        bedingungen.push(row => row[col] === val);
        return selbst;
      },
      in: (col, arr) => { bedingungen.push(row => arr.includes(row[col])); return selbst; },
      // `.not(col, 'in', '("a","b")')` — NULL zählt (wie in Postgres) als
      // nicht-getroffen und fällt damit aus der Ausschlussliste heraus.
      not: (col, _op, pgListe) => {
        const werte = String(pgListe).replace(/^\(|\)$/g, '').split(',')
          .map(s => s.trim().replace(/^"|"$/g, ''));
        bedingungen.push(row => row[col] != null && !werte.includes(row[col]));
        return selbst;
      },
      // `.or('col.is.null,col.in.(a,b)')` / `.or('col.is.null,col.neq.val')`
      // Nicht blind auf `,` splitten: `col.in.(a,b,c)` traegt selbst Kommas.
      or: (ausdruck) => {
        const teile = ausdruck.match(/[a-z_]+\.(is\.null|neq\.[^,]+|in\.\([^)]*\))/g) || [];
        const klauseln = teile.map(teil => {
          const nullM = teil.match(/^([a-z_]+)\.is\.null$/);
          if (nullM) return row => row[nullM[1]] == null;
          const inM = teil.match(/^([a-z_]+)\.in\.\(([^)]*)\)$/);
          if (inM) return row => inM[2].split(',').includes(row[inM[1]]);
          const neqM = teil.match(/^([a-z_]+)\.neq\.(.+)$/);
          if (neqM) return row => row[neqM[1]] !== neqM[2];
          throw new Error('fakeSb: unbekannte or()-Klausel: ' + teil);
        });
        bedingungen.push(row => klauseln.some(k => k(row)));
        return selbst;
      },
      limit: () => selbst,
      order: () => Promise.resolve({ data: zeilen.filter(passt), error: null }),
      maybeSingle: () => Promise.resolve({ data: zeilen.filter(passt)[0] || null, error: null }),
      then: (res) => res({ data: zeilen.filter(passt), error: null }),
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
  // Altbestand: `patient_id` ist NULL (Zeilen, die vor der Kartei-Pflicht
  // angelegt wurden). Dann vergibt der Trigger keine Verordnungsnummer — die
  // Belegnummer muss LEER bleiben und darf nichts erfinden.
  const [v] = await ladeAktiveVerordnungen(fakeSb({
    prescriptions: [{
      id: 'v1', patient_id: null, patient_name: 'Werner Müller · 1955-12-19',
      therapie_bereich: 'podo',
      ausstellungsdatum: '2026-08-02', anzahl_einheiten: 4, diagnosegruppe: 'DF2',
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
    prescriptions: [
      { id: 'rx1', ausstellungsdatum: '2026-07-01', status: 'billed', anzahl_einheiten: 6 },
      { id: 'v1', therapie_bereich: 'podo', ausstellungsdatum: '2026-07-02', abrechnung_status: 'gesendet', anzahl_einheiten: 4 },
    ],
  }), { ownerId: 'o1', nurAktive: false });

  assert.equal(liste.length, 2);
});

test('beide Zweige kommen in EINE Liste, neueste zuerst', async () => {
  // Eine interdisziplinäre Praxis führt denselben Patienten in beiden Zweigen.
  // Nach `sector` zu filtern würde hier eine der beiden Verordnungen verstecken.
  const liste = await ladeAktiveVerordnungen(fakeSb({
    prescriptions: [
      {
        id: 'rx1', patient_id: 'p1', ausstellungsdatum: '2026-08-01', heilmittel: 'KG',
        anzahl_einheiten: 6, status: 'in_therapy',
        prescription_sessions: [{ status: 'done' }],
      },
      {
        id: 'v1', therapie_bereich: 'podo', patient_id: 'p1', ausstellungsdatum: '2026-08-20', diagnosegruppe: 'DF2',
        anzahl_einheiten: 4, icd10: 'E11.40',
      },
    ],
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
    prescriptions: [
      // status ist bei prescriptions NOT NULL (DEFAULT 'parsed') — eine echte
      // Zeile ohne Wert gibt es nicht.
      { id: 'rx1', patient_id: 'p1', ausstellungsdatum: '2026-08-01', anzahl_einheiten: 6, status: 'confirmed' },
      { id: 'v1', therapie_bereich: 'podo', patient_id: 'p1', ausstellungsdatum: '2026-08-02', anzahl_einheiten: 4, diagnosegruppe: 'UI2' },
    ],
  }), OPTS);
  assert.equal(liste.find(v => v.quelle === 'physio').ziel, 'verordnungen');
  assert.equal(liste.find(v => v.quelle === 'podologie').ziel, 'podologie');
});

test('Podologie-icd10 ist zusammengesetzt aus icd10 + icd10_2 — es darf nicht als "[object Object]" landen', async () => {
  const [v] = await ladeAktiveVerordnungen(fakeSb({
    prescriptions: [{
      id: 'v1', therapie_bereich: 'podo', patient_id: 'p1', ausstellungsdatum: '2026-08-02', anzahl_einheiten: 4,
      diagnosegruppe: 'DF2', icd10: 'E11.40', icd10_2: 'E11.74',
    }],
  }), OPTS);
  assert.equal(v.diagnose, 'E11.40, E11.74 · DF2');
});

// Der eigentliche Anlass, Fragen-Antworten-Katalog Podologie Nr. 33:
// parallele Verordnungen sind zulässig, und die Akte muss sie getrennt zählen.
test('Nagelspange (UI2) und Komplexbehandlung (DF) parallel, getrennte Zähler', async () => {
  const liste = await ladeAktiveVerordnungen(fakeSb({
    prescriptions: [
      { id: 'ui2', therapie_bereich: 'podo', patient_id: 'p1', ausstellungsdatum: '2026-08-10', diagnosegruppe: 'UI2', anzahl_einheiten: 3 },
      { id: 'df2', therapie_bereich: 'podo', patient_id: 'p1', ausstellungsdatum: '2026-08-05', diagnosegruppe: 'DF2', anzahl_einheiten: 6 },
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

test('eine podologische Zeile erscheint nur einmal, nicht doppelt', () => {
  // Regression zur Zusammenlegung der Verordnungstöpfe (04.09.2026): rxQ und
  // voQ treffen jetzt dieselbe Tabelle. Ohne den therapie_bereich-Filter auf
  // BEIDEN Seiten stünde diese eine Zeile zweimal in der Liste — einmal aus
  // jeder Abfrage.
  return ladeAktiveVerordnungen(fakeSb({
    prescriptions: [
      { id: 'v1', therapie_bereich: 'podo', patient_id: 'p1', ausstellungsdatum: '2026-08-20', anzahl_einheiten: 4 },
    ],
  }), OPTS).then(liste => {
    assert.equal(liste.length, 1);
    assert.equal(liste[0].quelle, 'podologie');
  });
});
