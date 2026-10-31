import test from "node:test";
import assert from "node:assert/strict";
import {
  mitarbeiterKuerzel,
  streifenModell,
  streifenHtml,
  mountRaumStreifen,
} from "./raum-streifen.js";

const JETZT = "2026-11-02T09:15:00Z";
const TEAM = [
  { id: "u1", business_name: "Anna Maria Beispiel" },
  { id: "u2", business_name: "Bernd Schmidt" },
  { id: "u3", email: "clara.schulz@example.com" },
];

test("mitarbeiterKuerzel: Dreiteiliger Name, Einzelname und Leerwert", () => {
  assert.equal(mitarbeiterKuerzel("Anna Maria Beispiel"), "A. B.");
  assert.equal(mitarbeiterKuerzel("Anna"), "A.");
  assert.equal(mitarbeiterKuerzel(""), "");
  assert.equal(mitarbeiterKuerzel("   "), "");
  assert.equal(mitarbeiterKuerzel(null), "");
  assert.equal(mitarbeiterKuerzel(undefined), "");
  assert.equal(mitarbeiterKuerzel("  Erika   Muster  "), "E. M.");
});

test("A. Raum mit laufendem Termin: zustand voll, Kürzel des Therapeuten, restMinuten korrekt", () => {
  const raeume = [{ id: "r1", name: "Raum 1", plaetze: 1 }];
  const termine = [
    {
      id: "t1",
      room_id: "r1",
      user_id: "u1",
      status: "confirmed",
      start_time: "2026-11-02T09:00:00Z",
      end_time: "2026-11-02T09:30:00Z",
    },
  ];

  const modell = streifenModell(raeume, termine, TEAM, JETZT);
  assert.equal(modell.eintraege.length, 1);
  const e = modell.eintraege[0];
  assert.equal(e.raumId, "r1");
  assert.equal(e.name, "Raum 1");
  assert.equal(e.zustand, "voll");
  assert.deepEqual(e.kuerzel, ["A. B."]);
  assert.equal(e.restMinuten, 15);
  assert.equal(e.terminId, "t1");

  const html = streifenHtml(modell);
  assert.match(html, /<button[^>]*data-termin-id="t1"/);
  assert.match(html, /Raum 1/);
  assert.match(html, /A. B./);
  assert.match(html, /noch 15 Min./);
});

test("B. Raum ohne Termin: zustand frei, terminId null", () => {
  const raeume = [{ id: "r1", name: "Raum 1", plaetze: 1 }];
  const termine = [];

  const modell = streifenModell(raeume, termine, TEAM, JETZT);
  assert.equal(modell.eintraege.length, 1);
  const e = modell.eintraege[0];
  assert.equal(e.raumId, "r1");
  assert.equal(e.zustand, "frei");
  assert.equal(e.terminId, null);
  assert.deepEqual(e.kuerzel, []);
  assert.equal(e.restMinuten, 0);

  const html = streifenHtml(modell);
  assert.match(html, /<span[^>]*class="[^"]*raum-streifen-item--frei[^"]*"/);
  assert.match(html, />frei</);
  assert.ok(!html.includes("data-termin-id"));
});

test("C. Raum mit plaetze 2 und einem Termin: zustand teilweise", () => {
  const raeume = [{ id: "r-w", name: "Wärmeraum", plaetze: 2 }];
  const termine = [
    {
      id: "t1",
      room_id: "r-w",
      user_id: "u2",
      status: "confirmed",
      start_time: "2026-11-02T09:00:00Z",
      end_time: "2026-11-02T09:45:00Z",
    },
  ];

  const modell = streifenModell(raeume, termine, TEAM, JETZT);
  assert.equal(modell.eintraege.length, 1);
  const e = modell.eintraege[0];
  assert.equal(e.zustand, "teilweise");
  assert.deepEqual(e.kuerzel, ["B. S."]);
  assert.equal(e.restMinuten, 30);
  assert.equal(e.terminId, "t1");

  const html = streifenHtml(modell);
  assert.match(html, /raum-streifen-item--teilweise/);
  assert.match(html, /data-termin-id="t1"/);
  assert.match(html, /B. S./);
  assert.match(html, /noch 30 Min./);
});

test("D. Laufender Termin ohne room_id wird als ohneRaum gezählt und erscheint im HTML als Hinweis, Einzahl und Mehrzahl korrekt", () => {
  const raeume = [{ id: "r1", name: "Raum 1", plaetze: 1 }];
  const terminOhneRaum1 = {
    id: "t-o1",
    room_id: null,
    status: "confirmed",
    start_time: "2026-11-02T09:00:00Z",
    end_time: "2026-11-02T09:30:00Z",
  };
  const terminOhneRaum2 = {
    id: "t-o2",
    room_id: "",
    status: "confirmed",
    start_time: "2026-11-02T09:00:00Z",
    end_time: "2026-11-02T09:40:00Z",
  };

  const modellEinzahl = streifenModell(raeume, [terminOhneRaum1], TEAM, JETZT);
  assert.equal(modellEinzahl.ohneRaum, 1);
  const htmlEinzahl = streifenHtml(modellEinzahl);
  assert.match(htmlEinzahl, /1 Termin läuft ohne Raum/);

  const modellMehrzahl = streifenModell(raeume, [terminOhneRaum1, terminOhneRaum2], TEAM, JETZT);
  assert.equal(modellMehrzahl.ohneRaum, 2);
  const htmlMehrzahl = streifenHtml(modellMehrzahl);
  assert.match(htmlMehrzahl, /2 Termine laufen ohne Raum/);
});

test('E. Ein Termin mit customer_name "Maria Musterfrau" führt dazu, dass weder "Maria" noch "Musterfrau" noch "M." als Patientenangabe im HTML steht', () => {
  const raeume = [{ id: "r1", name: "Raum 1", plaetze: 1 }];
  const termine = [
    {
      id: "t1",
      room_id: "r1",
      user_id: "u2",
      customer_name: "Maria Musterfrau",
      status: "confirmed",
      start_time: "2026-11-02T09:00:00Z",
      end_time: "2026-11-02T09:30:00Z",
    },
  ];

  const modell = streifenModell(raeume, termine, TEAM, JETZT);
  const html = streifenHtml(modell);

  assert.ok(!html.includes("Maria"), "Patientenvorname darf nicht im HTML vorkommen");
  assert.ok(!html.includes("Musterfrau"), "Patientennachname darf nicht im HTML vorkommen");
  assert.ok(!html.includes("M."), "Patienteninitiale darf nicht im HTML vorkommen");
  assert.ok(!html.includes("customer_name"), "Datenfeld darf nicht im HTML vorkommen");
});

test("F. Unbekannter Therapeut (user_id nicht in mitarbeiter) bricht nicht ab, Eintrag bleibt ohne Kürzel", () => {
  const raeume = [{ id: "r1", name: "Raum 1", plaetze: 1 }];
  const termine = [
    {
      id: "t1",
      room_id: "r1",
      user_id: "unbekannte-id",
      status: "confirmed",
      start_time: "2026-11-02T09:00:00Z",
      end_time: "2026-11-02T09:30:00Z",
    },
  ];

  const modell = streifenModell(raeume, termine, TEAM, JETZT);
  const e = modell.eintraege[0];
  assert.equal(e.zustand, "voll");
  assert.deepEqual(e.kuerzel, []);
  assert.equal(e.restMinuten, 15);

  const html = streifenHtml(modell);
  assert.match(html, /noch 15 Min./);
  assert.ok(!html.includes("undefined"));
});

test('G. Raumname "<script>" wird escaped', () => {
  const raeume = [{ id: "r1", name: "<script>alert(1)</script>", plaetze: 1 }];
  const modell = streifenModell(raeume, [], TEAM, JETZT);
  const html = streifenHtml(modell);

  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
});

test("streifenHtml Layout: horizontal scrollbar ohne Überlauf, nur CSS-Variablen", () => {
  const raeume = [
    { id: "r1", name: "Raum 1", plaetze: 1 },
    { id: "r2", name: "Raum 2", plaetze: 1 },
  ];
  const modell = streifenModell(raeume, [], TEAM, JETZT);
  const html = streifenHtml(modell);

  assert.match(html, /overflow-x:\s*auto/);
  assert.match(html, /min-width:\s*0/);

  assert.ok(!/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.test(html), "HTML darf keine festen Hex-Farben enthalten");
  assert.match(html, /var\(--/);
});

test("mountRaumStreifen: Rendert sofort, Klick delegiert, Fehler wirft nicht, stop beendet", async () => {
  let geklickteId = null;
  const mockContainer = {
    hidden: false,
    innerHTML: "",
    eventListeners: {},
    addEventListener(typ, fn) {
      this.eventListeners[typ] = fn;
    },
    removeEventListener(typ, fn) {
      delete this.eventListeners[typ];
    },
    contains() {
      return true;
    },
  };

  const holeDaten = async () => ({
    raeume: [{ id: "r1", name: "Raum 1", plaetze: 1 }],
    termine: [
      {
        id: "t123",
        room_id: "r1",
        user_id: "u1",
        status: "confirmed",
        start_time: new Date(Date.now() - 5 * 60000).toISOString(),
        end_time: new Date(Date.now() + 25 * 60000).toISOString(),
      },
    ],
    mitarbeiter: TEAM,
  });

  const stop = mountRaumStreifen(mockContainer, {
    holeDaten,
    onTerminKlick: (id) => { geklickteId = id; },
    intervallMs: 1000,
  });

  await new Promise(r => setTimeout(r, 20));

  assert.equal(mockContainer.hidden, false);
  assert.match(mockContainer.innerHTML, /data-termin-id="t123"/);

  const mockEvent = {
    target: {
      closest: (sel) => (sel === "[data-termin-id]" ? { getAttribute: () => "t123" } : null),
    },
  };
  mockContainer.eventListeners.click(mockEvent);
  assert.equal(geklickteId, "t123");

  const mockContainerLeer = {
    hidden: false,
    innerHTML: "",
    addEventListener() {},
    removeEventListener() {},
  };
  const stopLeer = mountRaumStreifen(mockContainerLeer, {
    holeDaten: async () => ({ raeume: [], termine: [], mitarbeiter: [] }),
  });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(mockContainerLeer.hidden, true);
  stopLeer();

  const fehlerContainer = {
    hidden: false,
    innerHTML: "alter-stand",
    addEventListener() {},
    removeEventListener() {},
  };
  const stopFehler = mountRaumStreifen(fehlerContainer, {
    holeDaten: async () => { throw new Error("Netzwerkfehler"); },
  });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(fehlerContainer.innerHTML, "alter-stand");
  stopFehler();

  stop();
  assert.equal(mockContainer.eventListeners.click, undefined);
});
