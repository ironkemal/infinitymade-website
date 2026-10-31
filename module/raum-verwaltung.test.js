import test from "node:test";
import assert from "node:assert/strict";
import {
  raumZeilenHtml,
  formularHtml,
  ladeRaeume,
  speichereRaum,
  setzeRaumAktiv,
  loescheRaum,
  mountRaumVerwaltung,
} from "./raum-verwaltung.js";

test("A. speichereRaum legt mit bereinigtem Namen an, schickt owner_id und business_id", async () => {
  let eingefuegt = null;
  const fakeSupabase = {
    from(tabelle) {
      assert.equal(tabelle, "rooms");
      return {
        insert(payload) {
          eingefuegt = payload;
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const res = await speichereRaum({
    supabase: fakeSupabase,
    ownerId: "owner-42",
    businessId: "biz-99",
    raeume: [],
    name: "  Behandlungsraum   Nord  ",
    plaetze: "2",
  });

  assert.deepEqual(res, { ok: true });
  assert.deepEqual(eingefuegt, {
    owner_id: "owner-42",
    business_id: "biz-99",
    name: "Behandlungsraum Nord",
    plaetze: 2,
  });
});

test("B. speichereRaum ändert per id und filtert zusätzlich nach owner_id", async () => {
  let aktualisiert = null;
  const filter = {};
  const fakeSupabase = {
    from(tabelle) {
      assert.equal(tabelle, "rooms");
      return {
        update(payload) {
          aktualisiert = payload;
          return {
            eq(spalte1, wert1) {
              filter[spalte1] = wert1;
              return {
                eq(spalte2, wert2) {
                  filter[spalte2] = wert2;
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const res = await speichereRaum({
    supabase: fakeSupabase,
    ownerId: "owner-42",
    businessId: "biz-99",
    raeume: [],
    id: "raum-1",
    name: "  Neuer Raumname  ",
    plaetze: 4,
  });

  assert.deepEqual(res, { ok: true });
  assert.deepEqual(aktualisiert, {
    name: "Neuer Raumname",
    plaetze: 4,
  });
  assert.equal(filter.id, "raum-1");
  assert.equal(filter.owner_id, "owner-42");
});

test("C. Doppelter Name im selben Standort wird ohne Datenbankaufruf abgewiesen; gleicher Name an anderem Standort ist erlaubt", async () => {
  let dbAufrufe = 0;
  const fakeSupabase = {
    from() {
      dbAufrufe++;
      return {
        insert: () => Promise.resolve({ error: null }),
      };
    },
  };

  const raeume = [
    { id: "r1", name: "Raum 1", business_id: "biz-1" },
    { id: "r2", name: "Raum 2", business_id: "biz-2" },
  ];

  // Gleicher Standort: darf DB nicht aufrufen und muss ablehnen
  const resDoppelt = await speichereRaum({
    supabase: fakeSupabase,
    ownerId: "owner-42",
    businessId: "biz-1",
    raeume,
    name: "raum 1",
    plaetze: 1,
  });
  assert.equal(resDoppelt.ok, false);
  assert.equal(resDoppelt.meldung, "Dieser Raumname ist bereits vergeben.");
  assert.equal(dbAufrufe, 0, "Datenbank darf bei doppeltem Namen im gleichen Standort nicht aufgerufen werden");

  // Anderer Standort: erlaubt, ruft DB auf
  const resAndererStandort = await speichereRaum({
    supabase: fakeSupabase,
    ownerId: "owner-42",
    businessId: "biz-2",
    raeume,
    name: "Raum 1",
    plaetze: 1,
  });
  assert.equal(resAndererStandort.ok, true);
  assert.equal(dbAufrufe, 1, "Datenbank muss bei neuem Raum an anderem Standort aufgerufen werden");
});

test("D. Datenbankfehler 23505 liefert die deutsche Meldung, nichts wird geworfen", async () => {
  const fakeSupabase = {
    from() {
      return {
        insert: () => Promise.resolve({ error: { code: "23505", message: "duplicate key value" } }),
      };
    },
  };

  const res = await speichereRaum({
    supabase: fakeSupabase,
    ownerId: "owner-42",
    businessId: "biz-1",
    raeume: [],
    name: "Raum 1",
    plaetze: 1,
  });

  assert.deepEqual(res, {
    ok: false,
    meldung: "Dieser Raumname ist bereits vergeben.",
  });

  // Supabase wirft einen Fehler mit code 23505
  const throwingSupabase = {
    from() {
      return {
        insert: () => Promise.reject({ code: "23505" }),
      };
    },
  };

  const resThrow = await speichereRaum({
    supabase: throwingSupabase,
    ownerId: "owner-42",
    businessId: "biz-1",
    raeume: [],
    name: "Raum 1",
    plaetze: 1,
  });

  assert.deepEqual(resThrow, {
    ok: false,
    meldung: "Dieser Raumname ist bereits vergeben.",
  });
});

test("E. ladeRaeume mit Fehler liefert { raeume: [], fehler: true }", async () => {
  const fakeSupabaseError = {
    from(tabelle) {
      assert.equal(tabelle, "rooms");
      return {
        select() {
          return {
            eq() {
              return Promise.resolve({ data: null, error: { message: "relation rooms does not exist" } });
            },
          };
        },
      };
    },
  };

  const resError = await ladeRaeume({ supabase: fakeSupabaseError, ownerId: "owner-42" });
  assert.deepEqual(resError, { raeume: [], fehler: true });

  const fakeSupabaseThrow = {
    from() {
      throw new Error("Netzwerkfehler");
    },
  };
  const resThrow = await ladeRaeume({ supabase: fakeSupabaseThrow, ownerId: "owner-42" });
  assert.deepEqual(resThrow, { raeume: [], fehler: true });

  // Erfolgsfall prüft Spalten und Filter
  const fakeSupabaseSuccess = {
    from(tabelle) {
      assert.equal(tabelle, "rooms");
      return {
        select(spalten) {
          assert.equal(spalten, "id,owner_id,business_id,name,plaetze,aktiv,sort");
          return {
            eq(spalte, wert) {
              assert.equal(spalte, "owner_id");
              assert.equal(wert, "owner-42");
              return Promise.resolve({
                data: [{ id: "1", owner_id: "owner-42", business_id: null, name: "Raum 1", plaetze: 1, aktiv: true, sort: 0 }],
                error: null,
              });
            },
          };
        },
      };
    },
  };

  const resSuccess = await ladeRaeume({ supabase: fakeSupabaseSuccess, ownerId: "owner-42" });
  assert.equal(resSuccess.fehler, false);
  assert.equal(resSuccess.raeume.length, 1);
});

test("F. raumZeilenHtml escaped <img src=x> im Raumnamen und zeigt bei istInhaber false keine Knöpfe", () => {
  const raeume = [{ id: "r1", name: "<img src=x>", plaetze: 2, aktiv: true }];

  // istInhaber = false: Nur Liste, kein Formular, keine Knöpfe, XSS escapet
  const htmlMitarbeiter = raumZeilenHtml(raeume, { istInhaber: false });
  assert.ok(!htmlMitarbeiter.includes("<img src=x>"), "Darf unescaped <img> nicht enthalten");
  assert.ok(htmlMitarbeiter.includes("&lt;img src=x&gt;"), "Muss HTML escapen");
  assert.ok(!htmlMitarbeiter.includes("<button"), "Mitarbeiter darf keine Knöpfe sehen");

  // istInhaber = true: Buttons vorhanden, Name im Eingabefeld escapet
  const htmlInhaber = raumZeilenHtml(raeume, { istInhaber: true });
  assert.ok(!htmlInhaber.includes("<img src=x>"), "Darf unescaped <img> nicht im Value enthalten");
  assert.ok(htmlInhaber.includes("&lt;img src=x&gt;"), "Muss HTML im Value escapen");
  assert.ok(htmlInhaber.includes("Speichern"), "Inhaber muss Speichern-Knopf sehen");
  assert.ok(htmlInhaber.includes("Deaktivieren"), "Inhaber muss Deaktivieren-Knopf sehen");
  assert.ok(htmlInhaber.includes("Löschen"), "Inhaber muss Löschen-Knopf sehen");
});

test("G. loescheRaum filtert nach id und owner_id", async () => {
  const filter = {};
  const fakeSupabase = {
    from(tabelle) {
      assert.equal(tabelle, "rooms");
      return {
        delete() {
          return {
            eq(spalte1, wert1) {
              filter[spalte1] = wert1;
              return {
                eq(spalte2, wert2) {
                  filter[spalte2] = wert2;
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const res = await loescheRaum({
    supabase: fakeSupabase,
    ownerId: "owner-42",
    id: "raum-99",
  });

  assert.deepEqual(res, { ok: true });
  assert.equal(filter.id, "raum-99");
  assert.equal(filter.owner_id, "owner-42");
});

test("setzeRaumAktiv filtert nach id und owner_id", async () => {
  let geaendert = null;
  const filter = {};
  const fakeSupabase = {
    from(tabelle) {
      assert.equal(tabelle, "rooms");
      return {
        update(payload) {
          geaendert = payload;
          return {
            eq(spalte1, wert1) {
              filter[spalte1] = wert1;
              return {
                eq(spalte2, wert2) {
                  filter[spalte2] = wert2;
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const res = await setzeRaumAktiv({
    supabase: fakeSupabase,
    ownerId: "owner-42",
    id: "raum-1",
    aktiv: false,
  });

  assert.deepEqual(res, { ok: true });
  assert.deepEqual(geaendert, { aktiv: false });
  assert.equal(filter.id, "raum-1");
  assert.equal(filter.owner_id, "owner-42");
});

test("formularHtml liefert Formular mit Klassen und Beschriftungen", () => {
  const html = formularHtml();
  assert.ok(html.includes("Raumname"));
  assert.ok(html.includes("Plätze"));
  assert.ok(html.includes("Raum anlegen"));
  assert.ok(html.includes("Mehrere Plätze zum Beispiel für Wärme oder Fango"));
  assert.ok(html.includes("btn-primary"));
  assert.ok(html.includes("form-input"));
  assert.ok(html.includes("form-label"));
  assert.ok(html.includes("form-hint"));
  assert.ok(!html.includes("<datalist"));
});

test("mountRaumVerwaltung zeigt bei Fehler die vorgesehene Meldung und wirft nicht", async () => {
  const container = { innerHTML: "" };
  const fakeSupabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return Promise.resolve({ error: { message: "tabelle fehlt" } });
            },
          };
        },
      };
    },
  };

  await mountRaumVerwaltung(container, {
    supabase: fakeSupabase,
    ownerId: "owner-42",
    istInhaber: true,
  });

  assert.ok(container.innerHTML.includes("Räume sind gerade nicht verfügbar."));
  assert.ok(!container.innerHTML.includes("Raum anlegen"), "Bei Fehler darf kein Formular gerendert werden");
});

test("speichereRaum Validierungsfehler liefert deren Meldungstext", async () => {
  const resName = await speichereRaum({
    supabase: {},
    ownerId: "o",
    raeume: [],
    name: "",
    plaetze: 1,
  });
  assert.equal(resName.ok, false);
  assert.match(resName.meldung, /Raumnamen mit 1–80 Zeichen/);

  const resPlaetze = await speichereRaum({
    supabase: {},
    ownerId: "o",
    raeume: [],
    name: "Gültig",
    plaetze: 100,
  });
  assert.equal(resPlaetze.ok, false);
  assert.match(resPlaetze.meldung, /1–99 Plätze/);
});

test("speichereRaum unbekannter DB-Fehler liefert Standardmeldung", async () => {
  const fakeSupabase = {
    from() {
      return {
        insert: () => Promise.resolve({ error: { code: "42P01", message: "relation missing" } }),
      };
    },
  };
  const res = await speichereRaum({
    supabase: fakeSupabase,
    ownerId: "o",
    raeume: [],
    name: "Raum Neu",
    plaetze: 1,
  });
  assert.deepEqual(res, { ok: false, meldung: "Raum konnte nicht gespeichert werden." });
});

test("raumZeilenHtml ohne Räume zeigt Leermeldung", () => {
  assert.ok(raumZeilenHtml([], { istInhaber: true }).includes("Noch keine Räume angelegt."));
  assert.ok(raumZeilenHtml([], { istInhaber: false }).includes("Noch keine Räume angelegt."));
  assert.ok(raumZeilenHtml(null, { istInhaber: false }).includes("Noch keine Räume angelegt."));
});
