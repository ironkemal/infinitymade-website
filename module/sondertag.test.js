import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  ladeSondertage,
  sondertagArt,
  sondertagText,
  warnungFuerTag,
  markiereSondertage,
  betroffeneTermine,
  anruflisteHtml,
  ladeBetroffene,
} from "./sondertag.js";

/**
 * Minimaler Mock-DOM-Helfer für isolierte Tests ohne JSDOM/Browser.
 */
function erstelleFakeDom() {
  function erstelleElement(tag, dataset = {}, className = "", id = "") {
    const kinder = [];
    const el = {
      tagName: tag.toUpperCase(),
      dataset: { ...dataset },
      className,
      id,
      textContent: "",
      style: "",
      parentNode: null,
      children: kinder,
      getAttribute(name) {
        if (name === "id") return this.id || null;
        if (name === "class") return this.className || null;
        if (name.startsWith("data-")) {
          const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          return this.dataset[key] ?? null;
        }
        return null;
      },
      setAttribute(name, val) {
        if (name === "class") this.className = val;
        else if (name === "style") this.style = val;
        else if (name.startsWith("data-")) {
          const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          this.dataset[key] = val;
        }
      },
      appendChild(kind) {
        kind.parentNode = this;
        kinder.push(kind);
        return kind;
      },
      insertBefore(neu, ref) {
        neu.parentNode = this;
        const idx = kinder.indexOf(ref);
        if (idx !== -1) kinder.splice(idx, 0, neu);
        else kinder.push(neu);
        return neu;
      },
      removeChild(kind) {
        const idx = kinder.indexOf(kind);
        if (idx !== -1) {
          kinder.splice(idx, 1);
          kind.parentNode = null;
        }
        return kind;
      },
      remove() {
        if (this.parentNode) {
          this.parentNode.removeChild(this);
        }
      },
      closest(sel) {
        let p = this;
        while (p) {
          if (p._matchesSelector(sel)) return p;
          p = p.parentNode;
        }
        return null;
      },
      _matchesSelector(sel) {
        const parts = sel.split(",").map(s => s.trim());
        return parts.some(part => {
          if (part.startsWith(".")) {
            const cls = part.slice(1).split("[")[0];
            const hasCls = (this.className || "").split(" ").includes(cls);
            if (!hasCls) return false;
            const attrMatch = part.match(/\[([a-zA-Z0-9_-]+)([\^$*]?=)"?([^"\]]+)"?\]/);
            if (attrMatch) {
              const [, attr, op, val] = attrMatch;
              const actual = this.getAttribute(attr);
              if (actual === null) return false;
              if (op === "=") return actual === val;
              if (op === "^=") return actual.startsWith(val);
            }
            return true;
          }
          if (part.startsWith("#")) {
            return this.id === part.slice(1);
          }
          if (part.startsWith("[")) {
            const attrMatch = part.match(/\[([a-zA-Z0-9_-]+)([\^$*]?=)"?([^"\]]+)"?\]/);
            if (attrMatch) {
              const [, attr, op, val] = attrMatch;
              const actual = this.getAttribute(attr);
              if (actual === null) return false;
              if (op === "=") return actual === val;
              if (op === "^=") return actual.startsWith(val);
            }
          }
          return false;
        });
      },
      querySelector(sel) {
        const alle = this.querySelectorAll(sel);
        return alle.length > 0 ? alle[0] : null;
      },
      querySelectorAll(sel) {
        const result = [];
        function walk(node) {
          for (const k of node.children) {
            if (k._matchesSelector(sel)) {
              result.push(k);
            }
            walk(k);
          }
        }
        walk(this);
        return result;
      },
    };
    return el;
  }

  const doc = {
    createElement(tag) {
      const el = erstelleElement(tag);
      el.ownerDocument = doc;
      return el;
    },
  };

  const wurzel = erstelleElement("div");
  wurzel.ownerDocument = doc;

  return { wurzel, erstelleElement, doc };
}

// ─────────────────────────────────────────────────────────────────────────────
// Abnahmeszenario A
// ─────────────────────────────────────────────────────────────────────────────
test("A. Ganztägig geschlossen ergibt 'geschlossen', Sonderzeit mit Start und Ende ergibt 'sonderzeit' und den Text mit Zeiten", () => {
  const ganztagGeschlossen = {
    type: "closed",
    start_time: null,
    end_time: null,
  };
  assert.equal(sondertagArt(ganztagGeschlossen), "geschlossen");
  assert.equal(sondertagText(ganztagGeschlossen), "Praxis geschlossen");

  const feiertagGanztag = {
    type: "holiday",
    start_time: null,
    end_time: null,
  };
  assert.equal(sondertagArt(feiertagGanztag), "geschlossen");
  assert.equal(sondertagText(feiertagGanztag), "Praxis geschlossen");

  const sonderzeit = {
    type: "special",
    start_time: "09:00:00",
    end_time: "13:00:00",
  };
  assert.equal(sondertagArt(sonderzeit), "sonderzeit");
  assert.equal(sondertagText(sonderzeit), "Sonderöffnung 09:00–13:00");

  const sonderzeitKurz = {
    type: "closed",
    start_time: "09:00",
    end_time: "13:00",
  };
  assert.equal(sondertagArt(sonderzeitKurz), "sonderzeit");
  assert.equal(sondertagText(sonderzeitKurz), "Sonderöffnung 09:00–13:00");
});

// ─────────────────────────────────────────────────────────────────────────────
// Abnahmeszenario B
// ─────────────────────────────────────────────────────────────────────────────
test("B. Die note erscheint in keinem Text und keinem HTML", () => {
  const geheimerGrund = "StrengGeheimeInterneNotiz12345";
  const tag = {
    date: "2026-12-24",
    type: "closed",
    start_time: null,
    end_time: null,
    note: geheimerGrund,
  };

  const text = sondertagText(tag);
  assert.ok(!text.includes(geheimerGrund), "sondertagText darf note nicht enthalten");

  const warnung = warnungFuerTag([tag], "2026-12-24");
  assert.ok(!warnung.includes(geheimerGrund), "warnungFuerTag darf note nicht enthalten");

  const termine = [
    {
      id: "b1",
      start_time: "2026-12-24T10:00:00",
      customer_name: "Max Mustermann",
      customer_phone: "0170 1234567",
      status: "confirmed",
      note: geheimerGrund,
      notes: geheimerGrund,
    },
  ];

  const html = anruflisteHtml(termine, "2026-12-24");
  assert.ok(!html.includes(geheimerGrund), "anruflisteHtml darf note nicht enthalten");
});

// ─────────────────────────────────────────────────────────────────────────────
// Abnahmeszenario C
// ─────────────────────────────────────────────────────────────────────────────
test("C. warnungFuerTag akzeptiert '2026-12-24' und '2026-12-24T09:00:00.000Z' und warnt nur bei geschlossen", () => {
  const tage = [
    { date: "2026-12-24", type: "closed", start_time: null, end_time: null },
    { date: "2026-12-25", type: "special", start_time: "09:00", end_time: "13:00" },
  ];

  const erwarteterText = "Die Praxis ist an diesem Tag geschlossen. Möchten Sie den Termin trotzdem eintragen?";

  // Datum als YYYY-MM-DD
  assert.equal(warnungFuerTag(tage, "2026-12-24"), erwarteterText);

  // Datum als ISO-Zeitstempel
  assert.equal(warnungFuerTag(tage, "2026-12-24T09:00:00.000Z"), erwarteterText);

  // Sonderzeit warnt nicht (liefert null)
  assert.equal(warnungFuerTag(tage, "2026-12-25"), null);
  assert.equal(warnungFuerTag(tage, "2026-12-25T10:00:00.000Z"), null);

  // Nicht vorhandener Tag liefert null
  assert.equal(warnungFuerTag(tage, "2026-12-26"), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Abnahmeszenario D
// ─────────────────────────────────────────────────────────────────────────────
test("D. betroffeneTermine lässt abgesagte, nicht erschienene und Gruppen-Kinder weg und sortiert", () => {
  const termine = [
    { id: "1", start_time: "2026-12-24T14:30:00", status: "confirmed" },
    { id: "2", start_time: "2026-12-24T09:00:00", status: "cancelled" },
    { id: "3", start_time: "2026-12-24T10:00:00", status: "no_show" },
    { id: "4", start_time: "2026-12-24T11:00:00", status: "confirmed", group_parent_id: "eltern-id-1" },
    { id: "5", start_time: "2026-12-24T08:15:00", status: "confirmed" },
    { id: "6", start_time: "2026-12-25T08:15:00", status: "confirmed" }, // anderer Tag
  ];

  const ergebnis = betroffeneTermine(termine, "2026-12-24");
  assert.equal(ergebnis.length, 2);
  assert.equal(ergebnis[0].id, "5", "Früherer Termin (08:15) muss zuerst stehen");
  assert.equal(ergebnis[1].id, "1", "Späterer Termin (14:30) muss als zweites stehen");
});

// ─────────────────────────────────────────────────────────────────────────────
// Abnahmeszenario E
// ─────────────────────────────────────────────────────────────────────────────
test("E. anruflisteHtml escaped einen Namen wie '<img src=x>' und zeigt den Hinweis bei fehlender Telefonnummer", () => {
  const xssName = "<img src=x onerror=alert(1)>";
  const termine = [
    {
      start_time: "2026-12-24T09:15:00",
      customer_name: xssName,
      customer_phone: null,
    },
    {
      start_time: "2026-12-24T10:30:00",
      customer_name: "Erika Muster",
      customer_phone: "+49 30 123456",
    },
  ];

  const html = anruflisteHtml(termine, "2026-12-24");

  // Escaping-Prüfung
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "Name muss HTML-escaped sein");
  assert.ok(!html.includes("<img src=x"), "Darf kein unescaped img-Tag enthalten");

  // Hinweis bei fehlender Telefonnummer
  assert.ok(html.includes("Keine Telefonnummer hinterlegt"), "Fehlende Nummer muss Hinweistext anzeigen");

  // Vorhandene Nummer
  assert.ok(html.includes("+49 30 123456"), "Vorhandene Telefonnummer muss angezeigt werden");

  // Überschrift mit Datum TT.MM.JJJJ
  assert.ok(html.includes("Betroffene Termine am 24.12.2026"), "Überschrift muss korrektes deutsches Datum haben");

  // Leere Liste
  const htmlLeer = anruflisteHtml([], "2026-12-24");
  assert.ok(htmlLeer.includes("Keine Termine an diesem Tag."), "Leere Liste muss Hinweistext zeigen");
  assert.ok(htmlLeer.includes("Betroffene Termine am 24.12.2026"), "Überschrift muss auch bei leerer Liste vorhanden sein");
});

// ─────────────────────────────────────────────────────────────────────────────
// Abnahmeszenario F
// ─────────────────────────────────────────────────────────────────────────────
test("F. markiereSondertage zweimal aufgerufen führt nicht zu doppelten Etiketten", () => {
  const { wurzel, erstelleElement } = erstelleFakeDom();

  // Erstelle eine simulierte Monats-Zelle
  const zelle = erstelleElement("div", { datum: "2026-12-24" }, "month-cell");
  const tagesZahl = erstelleElement("div", {}, "month-cell-day");
  tagesZahl.textContent = "24";
  zelle.appendChild(tagesZahl);
  wurzel.appendChild(zelle);

  const tage = [{ date: "2026-12-24", type: "closed" }];

  // 1. Aufruf
  markiereSondertage({ wurzel, tage, ansicht: "monat" });
  let etiketten = wurzel.querySelectorAll(".sondertag-etikett");
  assert.equal(etiketten.length, 1);
  assert.equal(etiketten[0].textContent, "Praxis geschlossen");

  // 2. Aufruf: darf nicht doppelt markieren
  markiereSondertage({ wurzel, tage, ansicht: "monat" });
  etiketten = wurzel.querySelectorAll(".sondertag-etikett");
  assert.equal(etiketten.length, 1, "Darf nach zweitem Aufruf genau 1 Etikett haben");

  // Prüfung Wochenansicht
  const { wurzel: wocheWurzel, erstelleElement: wocheEl } = erstelleFakeDom();
  const spalte = wocheEl("div", { date: "2026-12-24" }, "dv-col");
  const kopf = wocheEl("div", {}, "dv-col-header");
  kopf.textContent = "Do 24.12.";
  spalte.appendChild(kopf);
  wocheWurzel.appendChild(spalte);

  markiereSondertage({ wurzel: wocheWurzel, tage, ansicht: "woche" });
  markiereSondertage({ wurzel: wocheWurzel, tage, ansicht: "woche" });
  const wocheEtiketten = wocheWurzel.querySelectorAll(".sondertag-etikett");
  assert.equal(wocheEtiketten.length, 1, "Wochenansicht darf nach zweifachem Aufruf nur 1 Etikett tragen");

  // Prüfung Tagesansicht
  const { wurzel: tagWurzel, erstelleElement: tagEl } = erstelleFakeDom();
  tagWurzel.dataset.date = "2026-12-24";
  const dateLabel = tagEl("span", {}, "cal-view-date", "dayViewDateLabel");
  tagWurzel.appendChild(dateLabel);

  markiereSondertage({ wurzel: tagWurzel, tage, ansicht: "tag" });
  markiereSondertage({ wurzel: tagWurzel, tage, ansicht: "tag" });
  const tagEtiketten = tagWurzel.querySelectorAll(".sondertag-etikett");
  assert.equal(tagEtiketten.length, 1, "Tagesansicht darf nach zweifachem Aufruf nur 1 Etikett tragen");
});

// ─────────────────────────────────────────────────────────────────────────────
// Abnahmeszenario G
// ─────────────────────────────────────────────────────────────────────────────
test("G. ladeSondertage und ladeBetroffene werfen bei Fehler nicht", async () => {
  // 1. null / undefined als Supabase
  const res1 = await ladeSondertage({ supabase: null, ownerId: "owner-1" });
  assert.deepEqual(res1, []);

  const res2 = await ladeBetroffene({ supabase: null, ownerId: "owner-1", von: "2026-12-24" });
  assert.deepEqual(res2, []);

  // 2. Supabase wirft Exception
  const throwingSupabase = {
    from() {
      throw new Error("Netzwerkfehler Supabase down");
    },
  };
  const res3 = await ladeSondertage({ supabase: throwingSupabase, ownerId: "owner-1", von: "2026-12-01", bis: "2026-12-31" });
  assert.deepEqual(res3, []);

  const res4 = await ladeBetroffene({ supabase: throwingSupabase, ownerId: "owner-1", von: "2026-12-24" });
  assert.deepEqual(res4, []);

  // 3. Supabase liefert DB-Fehlerobjekt { error }
  const errorSupabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        gte() { return this; },
        lte() { return Promise.resolve({ data: null, error: { message: "RLS policy denied" } }); },
      };
    },
  };
  const res5 = await ladeSondertage({ supabase: errorSupabase, ownerId: "owner-1", von: "2026-12-01", bis: "2026-12-31" });
  assert.deepEqual(res5, []);

  const res6 = await ladeBetroffene({ supabase: errorSupabase, ownerId: "owner-1", von: "2026-12-24" });
  assert.deepEqual(res6, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Zusätzliche Verifikationen: Query-Parameter & Dark Theme CSS
// ─────────────────────────────────────────────────────────────────────────────
test("ladeSondertage führt korrekten Query aus", async () => {
  const aufrufe = [];
  const fake = {
    from(tabelle) { aufrufe.push(["from", tabelle]); return this; },
    select(felder) { aufrufe.push(["select", felder]); return this; },
    eq(spalte, val) { aufrufe.push(["eq", spalte, val]); return this; },
    gte(spalte, val) { aufrufe.push(["gte", spalte, val]); return this; },
    lte(spalte, val) { aufrufe.push(["lte", spalte, val]); return Promise.resolve({ data: [{ date: "2026-12-24" }] }); },
  };

  const res = await ladeSondertage({ supabase: fake, ownerId: "o123", von: "2026-12-20", bis: "2026-12-31" });
  assert.equal(res.length, 1);
  assert.deepEqual(aufrufe[0], ["from", "custom_days"]);
  assert.deepEqual(aufrufe[1], ["select", "date,type,start_time,end_time,note"]);
  assert.deepEqual(aufrufe[2], ["eq", "owner_id", "o123"]);
  assert.deepEqual(aufrufe[3], ["gte", "date", "2026-12-20"]);
  assert.deepEqual(aufrufe[4], ["lte", "date", "2026-12-31"]);
});

test("ladeBetroffene filtert lokalen Zeitraum von 00:00:00 bis 23:59:59", async () => {
  const aufrufe = [];
  const fake = {
    from(tabelle) { aufrufe.push(["from", tabelle]); return this; },
    select(felder) { aufrufe.push(["select", felder]); return this; },
    eq(spalte, val) { aufrufe.push(["eq", spalte, val]); return this; },
    gte(spalte, val) { aufrufe.push(["gte", spalte, val]); return this; },
    lte(spalte, val) { aufrufe.push(["lte", spalte, val]); return Promise.resolve({ data: [{ id: "b1" }] }); },
  };

  const res = await ladeBetroffene({ supabase: fake, ownerId: "o123", von: "2026-12-24", bis: "2026-12-24" });
  assert.equal(res.length, 1);
  assert.deepEqual(aufrufe[0], ["from", "bookings"]);
  assert.deepEqual(aufrufe[1], ["select", "id,start_time,customer_name,customer_phone,status,group_parent_id"]);
  assert.deepEqual(aufrufe[2], ["eq", "owner_id", "o123"]);
  assert.equal(aufrufe[3][0], "gte");
  assert.equal(aufrufe[3][1], "start_time");
  assert.equal(aufrufe[4][0], "lte");
  assert.equal(aufrufe[4][1], "start_time");
});

test("markiereSondertage tut nichts und wirft nicht, wenn Zelle nicht existiert", () => {
  const { wurzel } = erstelleFakeDom();
  assert.doesNotThrow(() => {
    markiereSondertage({ wurzel, tage: [{ date: "2026-12-24", type: "closed" }], ansicht: "monat" });
  });
  assert.equal(wurzel.querySelectorAll(".sondertag-etikett").length, 0);
});

test("anruflisteHtml verwendet keine festen Farben, sondern ausschließlich CSS-Variablen", () => {
  const termine = [
    { start_time: "2026-12-24T09:00:00", customer_name: "Anna Test", customer_phone: "12345" },
  ];
  const html = anruflisteHtml(termine, "2026-12-24");
  assert.ok(!html.includes("#fff"), "Keine festen Hex-Farben");
  assert.ok(!html.includes("#000"), "Keine festen Hex-Farben");
  assert.ok(!html.includes("rgb("), "Keine festen RGB-Farben");
  assert.ok(html.includes("var(--text-main)"), "Nutzt var(--text-main)");
  assert.ok(html.includes("var(--border)"), "Nutzt var(--border)");
});

test('Anrufliste zeigt die Ortszeit der Praxis, nicht UTC', () => {
  const html = anruflisteHtml([{ start_time: '2026-12-24T08:00:00+00:00', customer_name: 'Test', customer_phone: '0' }], '2026-12-24');
  assert.match(html, />09:00</);
  const sommer = anruflisteHtml([{ start_time: '2026-07-01T08:00:00+00:00', customer_name: 'Test', customer_phone: '0' }], '2026-07-01');
  assert.match(sommer, />10:00</);
});
