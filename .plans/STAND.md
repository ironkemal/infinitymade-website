# Stand — Beta-Rückmeldung Praxis, Branch `kalender-ux`

**Letzte Aktualisierung: 30.08.2026.** Diese Datei ist die Übergabe. Wenn oben
ein altes Datum steht und seither gearbeitet wurde, dem Inhalt nicht trauen —
dann lieber `fortschritte/` lesen.

---

## In einem Absatz

Aus einer Rückmeldung der Beta-Praxis (12 Punkte, Kalender · Terminmaske ·
Verordnungen · Menü) sind neun Commits auf `kalender-ux` geworden. Gebaut ist
alles bis auf die Verordnungen (Muster 13) — die hängen an einer Fachauskunft,
nicht am Code. `main` ist unberührt, Kunden sehen nichts davon. Was fehlt, ist
ein Durchgang mit echten Daten durch einen Menschen.

---

## Gebaut

| Bereich | Was |
|---|---|
| **Kalender** | Doppelklick legt Termine an (Woche + Monat, Touch per langem Drücken) · Rechtsklick-Menü mit vier Statusaktionen · Termine nach **Leistung** eingefärbt (Fläche = Leistung, linker Rand = Mitarbeiter) · Verschieben funktioniert jetzt auch in der Woche |
| **Kopfleiste** | Aus drei Ebenen wurden zwei: Datum neben den Tabs, Buchungslink als Knopf statt ausgeschriebener URL, Abwesenheit bei den Mitarbeiter-Chips |
| **Terminmaske** | Patient steht vor der Leistung · „Mehr Optionen" klappt Notizen und Serientermin weg · Mitarbeiterfeld entfällt bei Einzelpraxen · Feld **Anzahl** (3 → drei Termine) · Blocker **Pause · Privat · Fortbildung** |
| **Leistungen** | Steht jetzt unter **Abrechnung** · Übersicht und GKV-Katalog sind **Tabellen** statt zwei Kachelwänden, gruppiert nach Kostenträgertyp · **Farbwähler** in beiden Masken · Feld Abrechnungsart |
| **Werkzeug** | `dev_server.cjs` beantwortet `/api/config` → lokal testbar · `tools/browser-probe/` (`npm run probe`) → 72 Prüfungen im echten Browser ohne Login |

**Zehn neue Module** unter `module/`. `dashboard.js` ist dabei von 25.399 auf
**25.240** Zeilen *geschrumpft*.

---

## Geprüft — und was das wert ist

**Maschinell, belastbar:**
- `npm run probe` → 72 Prüfungen, 0 Fehlschläge, keine Konsolenfehler.
  Darunter gemessen: Wochenraster 28 px, Tagesraster 56 px, Zeitleiste und
  Tagesspalten enden beide bei 717 px, Termin sitzt exakt auf seiner Linie.
- 180 Modultests grün · tsc-Ratsche grün · Größen-Hook grün.

**Nicht geprüft — hier liegt das Risiko:**
Alles, was einen angemeldeten Nutzer und echte Daten braucht. Also: Speichern,
Blocker wirklich anlegen, die Doppelbuchungs-Ablehnung, ob aus „Anzahl 3"
tatsächlich drei Termine mit drei belegten Verordnungssitzungen werden.
Dafür: `.plans/BROWSER-TEST-PROMPT.md`, 86 Schritte.

---

## Offen

### Braucht dich — blockiert sonst nichts weiter

1. **Der Testdurchgang.** `.env.local` anlegen (Werte aus
   `https://app.praxura.de/api/config`), `node dev_server.cjs`, mit einem
   **Testkonto** anmelden, Prüfplan durchgehen. Die sechs wichtigsten Schritte
   stehen im Vorspann des Plans.
2. **Entscheidung Kompaktmodus.** Klein: Kalender aus der Regel nehmen (dann
   verdichtet er den Kalender nicht mehr). Richtig: Zeilenhöhe als CSS-Variable
   führen und im JS auslesen.
3. **`ops/.env.ops`** mit dem Service-Role-Key des Ops-Projekts
   (`farkaejociddtgqkusvm`) — sonst bleiben **22 Ops-Karten** liegen. Sie
   stehen seit 30.08. in `ops/ingest/2026-08-30-kalender-feedback.json`
   (vorher in `/tmp`, wo sie zwischenzeitlich verlorengingen). Einspielen:
   `node ops/tools/ingest.mjs --json ops/ingest/2026-08-30-kalender-feedback.json --dry`,
   dann ohne `--dry`.
4. **Supabase-Zugang**, damit die Migration laufen und der Schema-Dump
   aufgefrischt werden kann.

### Braucht Fachauskunft, nicht Code

**Verordnungen Muster 13** ist der einzige ungebaute Block. Technisch wäre er
günstig: `heilmittel_items jsonb` gibt es in *beiden* Verordnungstabellen, und
die „+"-Mechanik existiert in der Podologie-Maske. Offen sind drei Fragen:

- Wie viele Heilmittel darf Muster 13 je Verordnung tragen?
- Stimmen die genannten Höchstmengen (6, bei Nagelspange 8)? **In `Handbücher/`
  und `Podoloji/` steht dazu nichts** — der Heilmittelkatalog liegt nicht im
  Repo. Eine falsche Grenze im UI erzeugt Verordnungen, die die Kasse absetzt.
- Was heisst „Podologische Behandlung gross"? Laut `SPEC-RULES.md:72` ist 78020
  **kein** zweiter Name für die Komplexbehandlung, sondern der Fall
  *Therapiezeit über 20 Minuten*; Einzelmassnahmen sind immer 78010. Der Code
  bildet das schon ab. Was umbenannt werden soll, muss die Praxis sagen.

### Eigener Deploy-Weg (Backend, Docker/Watchtower)

**Therapeuten-Statistik ist tot und würde Blocker mitzählen.**
`api-backend/billing/api/statistik.routes.js`, Abfrage 8: sie selektiert
`employee_id` — diese Spalte gibt es in `bookings` nicht (es ist `user_id`), die
Abfrage läuft ins Leere. Und sie filtert `is_internal` nicht. Wer das eine
behebt, muss den Filter im selben Zug setzen, sonst zählen Pausen als geleistete
Sitzungen.

### Aufräumen, wenn Zeit ist

- Migration `sql-melih/2026-08-25-kostentraeger-typ.sql` ausführen, danach
  „Schema aktualisieren". **Nichts ist kaputt, solange sie nicht läuft** — der
  Code erkennt die fehlende Spalte zur Laufzeit und blendet das Feld aus.
- 18 CSS-Klassen sind durch den Wegfall der Kachelwand verwaist.
- Englisch und Türkisch: die zehn neuen Module tragen deutsche Texte. Das
  `T`-Wörterbuch liegt in `dashboard.js` und ist für Module nicht erreichbar —
  ein grundsätzlicher Punkt, nicht nur meiner.

---

## ⚠️ Sicherheit — unabhängig von allem oben

**Zugangsdaten im Klartext in git.** `scratch_login.py` enthält E-Mail und
Passwort eines echten Kontos; dasselbe Muster in elf Dateien, davon getrackt
mindestens `qa_crawl_clinical/financial/prod.py`, `qa_demo_prep.py`,
`qa_visual_verify{,2,3}.py`. Laut `CLAUDE.md` ist dieses Repo **öffentlich**.

In dieser Reihenfolge:
1. **Passwort ändern** — der einzige Schritt, der sofort wirkt.
2. Prüfen, ob das Repo wirklich public ist und seit wann.
3. Zugangsdaten in Umgebungsvariablen verschieben.
4. Erst danach über Historien-Bereinigung reden.

Für den Testdurchgang bitte ohnehin ein **frisches Testkonto**, nicht dieses.

---

## Fallen, die ich beim Bauen gefunden habe

Wer hier weiterarbeitet, spart sich damit Stunden:

- **„Termin wahrgenommen" ist nicht `bookings.status = 'completed'`.** Was Geld
  wird, ist `prescription_sessions.status = 'done'` über
  `handleTerminStarten()`. Ein zweiter Schreibweg erzeugt einen Kalender, der
  stimmt, und eine Abrechnung, die nie kommt.
- **Woche und Monat laden weniger Spalten als die Tagesansicht.** Vor jeder
  Handlung `ladeTerminVollstaendig()` (`module/termin-laden.js`). Ohne das gilt
  ein Hausbesuch als Praxistermin — Sitzung abgehakt, Fahrtenbuch leer.
- **PostgREST weist ein INSERT mit unbekannter Spalte komplett ab.** Neue
  Spalten deshalb erst schreiben, wenn sie da sind (`spalteKostentraegerDa()`).
- **Der Größen-Hook braucht zwei Dinge:** Ausführungsrecht (jetzt 755) *und*
  `git config core.hooksPath .githooks` je Entwickler. Fehlt eins, läuft er
  wortlos nicht.
- **`npm install` scheitert an Rechten** im npm-Cache. Umgehung:
  `--cache /tmp/npm-cache-praxura`. Dauerhaft: `sudo chown -R 501:20 ~/.npm`.

---

## Commits

Auf `kalender-ux`, neun Stück, `main` unberührt:

```
7f38ccb  docs(test): Prüfplan fertig — Sprachen, Maschinenprüfung abgegrenzt
30c0d8f  fix(kalender): Kontextmenü schloss sich beim Öffnen — plus Browser-Proben
bd2e885  fix(leistungen): Layoutfehler und fehlplatzierte Rücksetzung
eaa6d42  feat(dev): lokaler Testserver, GKV-Katalog als Tabelle, Farbwähler GKV
4eb0e39  feat(leistungen): Übersicht als Tabelle, Abrechnungsart, Multiplikator
fd00aa8  feat(kalender): Kopfleiste, Fortbildungs-Blocker, Leistungen ins Menü
5d73bcb  feat(kalender): Leistungsfarben, schlanke Terminmaske und Blocker
7db5ccb  fix(tools): Größen-Schranke war wirkungslos — Hook nicht ausführbar
6feb73f  feat(kalender): Terminanlage in Woche/Monat + Rechtsklick-Kontextmenü
```

**Merge nach `main` erst nach dem Testdurchgang.** Der Blocker schreibt Daten,
und das ist der erste Punkt in dieser Reihe, der das tut.

---

## Wo was steht

| Datei | Wofür |
|---|---|
| `.plans/BROWSER-TEST-PROMPT.md` | Der Prüfplan, 86 Schritte, zum Kopieren |
| `.plans/KALENDER_UX_PLAN.md` | Bauanleitung Phase 1 (Kalender 1.1–1.4) |
| `tools/browser-probe/README.md` | Was die drei Maschinenprüfungen abdecken — und was nicht |
| `sql-melih/2026-08-25-kostentraeger-typ.sql` | Die einzige offene Migration |
| `fortschritte/2026-08-22.md`, `-25.md` | Was an welchem Tag passierte und warum |
