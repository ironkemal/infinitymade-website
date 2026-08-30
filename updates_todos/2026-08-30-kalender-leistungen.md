# Kalender, Terminmaske, Leistungen — Stand 30.08.2026

Aus der Beta-Rückmeldung der Praxis (12 Punkte). **Live auf `main`** seit
30.08.2026. Ausführlich: `.plans/STAND.md` · `fortschritte/2026-08-22|25|30.md`.

---

## Gebaut

| Bereich | Was |
|---|---|
| **Kalender** | Doppelklick legt Termine an (Woche + Monat, Touch: langes Drücken) · Rechtsklick-Menü mit vier Statusaktionen · Farben nach **Leistung** (Fläche = Leistung, Rand = Mitarbeiter) · Verschieben geht jetzt auch in der Woche |
| **Kopfleiste** | Aus drei Ebenen zwei: Datum neben den Tabs · Buchungslink als Knopf statt URL-Zeile · Abwesenheit bei den Mitarbeiter-Chips |
| **Terminmaske** | Patient vor Leistung · „Mehr Optionen" klappt Notizen/Serie weg · Mitarbeiterfeld entfällt bei Einzelpraxen · Feld **Anzahl** (3 → drei Termine) · Blocker **Pause · Privat · Fortbildung** |
| **Leistungen** | Steht unter **Abrechnung** · Übersicht und GKV-Katalog sind **Tabellen** statt Kachelwänden, gruppiert nach GKV/Privat/Selbstzahler/BG/Intern · **Farbwähler** in beiden Masken |
| **Werkzeug** | `node dev_server.cjs` → lokal testbar (beantwortet `/api/config`) · `npm run probe` → 78 Prüfungen im Browser, ohne Login |

**Zehn neue Module** unter `module/`. `dashboard.js` ist dabei **geschrumpft**.

---

## Gefundene Fehler im Bestand

Der bleibende Teil der Arbeit — die waren alle schon da:

1. **Wochen-Zeitleiste doppelt so lang wie ihr Inhalt** (56 px vs. 28 px) — die
   Uhrzeit links gehörte zu keinem Terminblock. ✅ behoben, gemessen
2. **`renderDayView()` ohne Datum** im Absagen-Pfad → `RangeError`, Kalender
   blieb leer. ✅ behoben (Kemal fand denselben Fehler unabhängig)
3. **Der Größen-Hook lief nie** — `.githooks/pre-commit` hatte kein
   Ausführungsrecht, Git übersprang ihn wortlos. ✅ behoben
4. **`services.color` war nie pflegbar** — Feld war `hidden`, Speicherpfad
   schrieb die Farbe gar nicht. ✅ behoben
5. **Lokal war nie testbar** — `/api/config` fehlte, Login scheiterte immer.
   ✅ behoben
6. **Kontextmenü schloss sich beim Öffnen**, sobald die Seite gescrollt war.
   ✅ behoben (im Browsertest gefunden, hätte ausgeliefert werden können)
7. **Therapeuten-Statistik ist tot** — Abfrage selektiert `employee_id`, die
   Spalte heisst `user_id`. ❌ offen, Backend
8. **Kompaktmodus verschob alle Termine.** ✅ erledigt — Kemal hat den Modus
   entfernt

---

## Offen

### Braucht dich
- **Testdurchgang** — `.plans/BROWSER-TEST-PROMPT.md`, 86 Schritte. Läuft jetzt
  als Nachprüfung an der laufenden Anwendung.
- **`ops/.env.ops`** → dann `node ops/tools/ingest.mjs --json ops/ingest/2026-08-30-kalender-feedback.json`
  (22 Karten warten)
- **Supabase-Zugang** für Migration + Schema-Dump

### ⚠️ Sicherheit — seit 22.08. offen
**Zugangsdaten im Klartext** in `scratch_login.py` und sechs getrackten
QA-Skripten. Repo ist laut `CLAUDE.md` öffentlich. **Passwort ändern wirkt
sofort**, alles andere ist Aufräumen.

### Braucht Fachauskunft (`gkv-302` / Praxis)
**Verordnungen Muster 13** — der einzige ungebaute Block. Offen: wie viele
Heilmittel je Verordnung · stimmen 6 bzw. 8 bei Nagelspange (steht in **keinem**
Dokument im Repo) · was heisst „Podologische Behandlung gross" (laut
`SPEC-RULES.md:72` **nicht** dasselbe wie Komplexbehandlung).

### Backend, eigener Deploy-Weg
`statistik.routes.js` Abfrage 8: `user_id` statt `employee_id` **und**
`is_internal` ausschliessen — beides in einem Fix, sonst zählen Pausen als
geleistete Sitzungen.

### Aufräumen
Migration `sql-melih/2026-08-25-kostentraeger-typ.sql` (nichts ist kaputt,
solange sie nicht läuft) · 18 verwaiste CSS-Klassen · Modultexte nur deutsch ·
`git config core.hooksPath .githooks` bei Kemal setzen.

---

## Testen

```sh
# .env.local anlegen — Werte aus https://app.praxura.de/api/config
node dev_server.cjs                 # → localhost:8081
npm run probe                       # 30 Sek., muss grün sein
```

Dann `http://localhost:8081/login.html` mit einem **Testkonto** (nicht dem aus
den QA-Skripten).

**Die zwei wichtigsten Schritte:** Blocker anlegen und einen Patiententermin
darüber legen (kommt eine deutsche Meldung oder rohes `23P01`?) · Anzahl 3
speichern (werden es drei Termine **und** drei Verordnungssitzungen?).
Beide berühren Pfade, an denen Geld hängt.
