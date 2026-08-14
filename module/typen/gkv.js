/**
 * gkv.js — §302 SGB V Typ-Wörterbuch für den Frontend-Code.
 *
 * Warum es das gibt
 * ─────────────────
 * `gkv-302` hat im Konsey (2026-08-13) fünf Felder benannt, bei denen ein
 * falscher Typ **stillen Geldverlust** verursacht — der Fehler fällt nicht auf,
 * die Kasse rechnet nur falsch ab. Diese Datei schreibt die richtige Form fest,
 * damit der Editor (und das Modell) sie beim Tippen prüfen kann.
 *
 * **Nur Typen, keine Laufzeitprüfung.** Die prüfenden Funktionen leben im
 * Backend und bleiben dort die einzige Wahrheit:
 *   `api-backend/billing/dta/preflight.js`  → `isValidTarifkennzeichen(...)` u. a.
 *   `api-backend/billing/dta/encoding.js`   → `fmtAmount(eur)`, `fmtDate(iso)`
 * Hier wird **nichts davon nachgebaut** — ein zweiter Validator, der anders
 * urteilt als der erste, ist schlimmer als gar keiner.
 *
 * Verwendung:
 *     /** @type {import('./typen/gkv.js').Positionsnummer} *\/
 *     const pos = '07301';
 *
 * Alle Angaben unten sind am 2026-08-14 gegen Schema und Code geprüft;
 * die Fundstelle steht jeweils dabei.
 */

/**
 * §302-Positionsnummer der Leistung.
 *
 * **STRING, niemals number.** `db/SCHEMA.sql:762` → `positionsnummer text NOT NULL`
 * (PK von `positionsnummern`, `db/SCHEMA.sql:782`). Führende Nullen sind
 * bedeutungstragend: aus `'07301'` würde als Zahl `7301` — eine andere,
 * womöglich existierende Leistung. Das fällt erst bei der Kassenabrechnung auf.
 *
 * @typedef {string} Positionsnummer
 */

/**
 * Abrechnungscode der Leistungserbringergruppe (§8.1.5.2).
 *
 * **STRING, zweistellig, führende Null möglich.**
 * `db/SCHEMA.sql:764` → `abrechnungscode text NOT NULL`.
 * Belegte Werte im Code: `'22'` Physiotherapie · `'71'` Podologie
 * (Konsey 2026-08-12) · `'14'` Hörgeräteakustiker
 * (`api-backend/billing/dta/smoke.test.js:188`).
 *
 * @typedef {string} Abrechnungscode
 */

/**
 * Tarifkennzeichen, **5-stellig** (`api-backend/billing/dta/segments.js:200`).
 *
 * **STRING.** Beispiele aus den Tests: `'01001'`, `'02001'`
 * (`api-backend/billing/dta/preflight.test.js:52`). Als Zahl verlöre `'01001'`
 * seine führende Null.
 *
 * Zusammen mit {@link Abrechnungscode} bildet es die Leistungserbringergruppe:
 * `[abrechnungscode, tarifkennzeichen]` (`segments.js:209`).
 *
 * @typedef {string} Tarifkennzeichen
 */

/**
 * Institutionskennzeichen des Kostenträgers, **9-stellig**.
 *
 * **STRING.** `db/SCHEMA.sql:855` → `ik text NOT NULL`, PK von `kostentraeger`
 * (`db/SCHEMA.sql:865`). Als Zahl gehen führende Nullen verloren und der
 * Fremdschlüssel trifft ins Leere.
 *
 * @typedef {string} IK
 */

/**
 * Geldbetrag in **EURO mit zwei Nachkommastellen** — NICHT in Cent.
 *
 * Das war im Konsey offen und ist jetzt geklärt:
 * - Datenbank: `numeric(10,2)`, Spalten heißen `*_eur`
 *   (`db/SCHEMA.sql:743` `preis_eur`, `:744` `zuzahlung_eur`,
 *   `:1145` `betrag_gkv`, `:1619` `absetzung_betrag`)
 * - Code: `api-backend/billing/dta/builder.js:43` → `const r2 = v => +Number(v).toFixed(2)`
 * - EDIFACT: `api-backend/billing/dta/encoding.js:39` → `fmtAmount(eur, decimals = 2)`
 *
 * **Gefahr:** Es ist eine Gleitkommazahl. `0.1 + 0.2 !== 0.3`. Summen deshalb
 * nach jeder Rechnung über `r2()` bzw. `toFixed(2)` führen — nicht erst am Ende.
 * Wer Cent-Ganzzahlen einführt, muss das überall zugleich tun; ein gemischtes
 * Modell verursacht 100-fach falsche Beträge.
 *
 * @typedef {number} BetragEur
 */

/**
 * Datum im §302-Austauschformat: **`'YYYYMMDD'`, ohne Trennzeichen.**
 *
 * `api-backend/billing/dta/encoding.js:46-47` → `fmtDate(d)`;
 * geprüft in `smoke.test.js:20`: `fmtDate('2026-05-18') === '20260518'`.
 *
 * ⚠️ In der **Datenbank** stehen Daten als ISO (`'2026-05-18'`). Die Umwandlung
 * passiert erst beim DTA-Bau. Ein ISO-String, der ungeprüft in ein DTA-Segment
 * rutscht, erzeugt eine Dateiabweisung.
 *
 * @typedef {string} DtaDatum
 */

/**
 * Menge / Anzahl abgerechneter Einheiten. Ganzzahl, > 0.
 * @typedef {number} Menge
 */

/**
 * Faktor zur Leistung (Vervielfältiger). Dezimalzahl.
 * @typedef {number} Faktor
 */

/**
 * Eine abrechenbare Position, wie sie das Frontend zusammenstellt.
 *
 * @typedef {object} Abrechnungsposition
 * @property {Positionsnummer} positionsnummer
 * @property {Menge}           menge
 * @property {BetragEur}       einzelpreis
 * @property {BetragEur}       gesamtpreis
 * @property {DtaDatum}        [datum]
 * @property {Faktor}          [faktor]
 */

/**
 * Leistungserbringergruppe — die beiden Codes gehören immer zusammen.
 *
 * @typedef {object} Leistungserbringergruppe
 * @property {Abrechnungscode}  abrechnungscode
 * @property {Tarifkennzeichen} tarifkennzeichen
 */

// Diese Datei exportiert absichtlich nur Typen. Der leere Export macht sie
// zu einem ES-Modul, damit `import('./typen/gkv.js')` in JSDoc funktioniert.
export {};
