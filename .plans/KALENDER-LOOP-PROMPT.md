# Loop-Prompt für Claude Code — Ops-Karte „Kalender: Terminanlage & Bedienung wie im Altsystem"

> **Für Melih:** alles ab der Trennlinie kopieren und in Claude Code (im Repo-Ordner)
> einfügen. Wenn dein Claude Code `/loop` kennt, kannst du davorsetzen:
> `/loop` + diesen Text. Ohne `/loop` funktioniert es genauso — die Schleife ist
> unten als Protokoll beschrieben und trägt sich selbst.
>
> **Vor dem Start einmal selbst erledigen:**
> 1. Ein **frisches Testkonto** in `app.praxura.de` anlegen (eigene Praxis, eigene
>    Daten). Die Zugangsdaten aus `scratch_login.py` / `qa_*.py` **nicht** benutzen —
>    die stehen im Klartext im öffentlichen Repo und gehören ohnehin gewechselt.
> 2. Claude in Chrome aktiv, in Chrome bei `app.praxura.de` **mit dem Testkonto**
>    angemeldet.
> 3. `git config core.hooksPath .githooks` einmalig gesetzt.

---

Du arbeitest im Repo **Praxura** (`infinitymade-website`) an genau einer Ops-Karte
und ihren **vier Unteraufgaben**. Lies zuerst `CLAUDE.md` vollständig — die Regeln
dort gelten über allem, was hier steht. Danach `.plans/STAND.md` (Übergabe vom
30.08.2026) und `.plans/BROWSER-TEST-PROMPT.md` (der 86-Schritte-Prüfplan).

Du arbeitest **in Schleifen**. Eine Schleife = eine Unteraufgabe = ein
abgeschlossener Zyklus **bauen → prüfen → reparieren → testen → belegen → commit**.
Zwischen den Schleifen hältst du an und meldest dich bei mir.

---

## 1 · Ausgangslage — bitte nicht neu bauen, was schon steht

Die vier Unteraufgaben wurden auf dem Branch `kalender-ux` **gebaut** und am
**30.08.2026 nach `main` gemerged und veröffentlicht**. Das heisst:

- `app.praxura.de` zeigt **den neuen Code**. Der Branch `kalender-ux` ist erledigt.
- Es wird **direkt auf `main`** gearbeitet, kein Feature-Branch (Entscheidung Melih,
  `CLAUDE.md` → Kurallar → Genel). Jeder Push geht über Vercel sofort live.
- Was fehlt, ist **nicht der Code, sondern der Beweis**: ein Durchgang mit echten
  Daten, dazu die in den Karten notierten offenen Punkte.

**Gegenprobe, dass du wirklich den neuen Stand siehst:** Kalender → Woche. Die
Uhrzeit-Leiste links muss genauso weit nach unten laufen wie die Tagesspalten
(beide enden bei 717 px). Läuft sie deutlich länger, siehst du alten Code — dann
sofort abbrechen und mich fragen.

### Die vier Unteraufgaben und ihr offener Rest

| # | Unteraufgabe | Gebaut in | Offen |
|---|---|---|---|
| 1 | **Schlanker Termindialog + Schnell-Blocker** (Pause · Privat · Fortbildung) | `module/kalender-blocker.js`, Dialog in `dashboard.js` | **Der Blocker schreibt Daten und ist völlig ungeprüft.** ⚠️ **Vorbedingung**: Therapeuten-Statistik im Backend filtert `is_internal` nicht → Pausen zählen als geleistete Sitzungen |
| 2 | **Rechtsklick-Kontextmenü für Statuswechsel** | `module/kalender-kontextmenue.js` | Durchgang mit echten Daten (Ausgrauen bei erledigten Terminen, Rand-Position, alle drei Ansichten) |
| 3 | **Termine nach Leistung farblich unterscheiden** | `module/kalender-farben.js`, `module/leistung-farbwahl.js` | Bleibt die Farbe nach dem **Speichern** wirklich erhalten? (Prüfplan **K**) |
| 4 | **Termin per Doppelklick in Wochen- und Monatsansicht anlegen** | `module/kalender-woche.js`, `module/kalender-monat.js` | Prüfung mit echten Daten (Vorbelegung Datum/Uhrzeit/Mitarbeiter) |

---

## 2 · Wo geprüft wird — und was dabei heilig ist

Geprüft wird **live auf `app.praxura.de`** mit **Claude in Chrome**, angemeldet mit
dem Testkonto.

Auf dieser Anwendung liegen **echte Gesundheitsdaten der Beta-Praxis**. Deshalb
gelten diese Regeln ohne Ausnahme:

1. **Keine Patientendaten in Berichten, Commits, Dateien oder Screenshots-Beschreibungen.**
   Schreib „ein Termin", „der Patient" — nie Name, Geburtsdatum, Diagnose, Telefon.
   Beschreibe bei Screenshots Layout und Position, nicht den Inhalt.
2. **Nichts löschen, was du nicht selbst angelegt hast.** Der Menüpunkt
   „Absagen / stornieren" löscht unwiderruflich. Ansehen ja, klicken nein — ausser
   bei deinem eigenen Testblocker.
3. **Nichts speichern ohne Aufräumplan.** Testdaten immer **weit in der Zukunft**
   (mindestens drei Monate), danach selbst wieder entfernen und im Bericht
   auflisten, was entstanden und was entfernt wurde.
4. **Einstellungen und Leistungen der Praxis** nur ändern, wenn ein Prüfschritt es
   verlangt — und **denselben Ausgangswert danach wiederherstellen**. Notiere den
   Ausgangswert *vorher* im Bericht, sonst kannst du ihn nicht zurücksetzen.
5. **Keine Sitzung, keine Abrechnung anfassen.** „Termin wahrgenommen" ist **nicht**
   `bookings.status = 'completed'`; was Geld wird, ist
   `prescription_sessions.status = 'done'` über `handleTerminStarten()`. Ein
   zweiter Schreibweg erzeugt einen Kalender, der stimmt, und eine Abrechnung, die
   nie kommt.
6. Wenn ein Prüfschritt Daten anlegen würde, die du **nicht** sicher wieder
   loswirst: **nicht ausführen**, sondern als „nicht prüfbar, weil …" melden und
   mich fragen.

---

## 3 · Die Regeln des Hauses — Verstösse machen den Commit wertlos

Aus `CLAUDE.md`, hier verdichtet. Wenn hier und `CLAUDE.md` sich widersprechen,
gilt `CLAUDE.md`.

- **`dashboard.js` wächst nicht.** Neuer Code kommt nach `module/<name>.js` und wird
  mit einer `import`-Zeile angebunden. Der pre-commit-Hook
  (`tools/check-dashboard-size.sh`) weist einen Commit zurück, der die Datei
  vergrössert. Bestehende Funktionen darfst du reparieren — ohne die Datei zu
  vergrössern.
- **Kein neuer Vercel-Serverless-Endpunkt.** `api/` ist bei **12/12** voll, der
  nächste sprengt den Deploy. Neue HTTP-Endpunkte gehören nach
  `api-backend/server.js` (G8, On-Prem-Tauglichkeit).
- **Keine Klarnamen im Repo.** Beta-Kunden heissen `Beta-1` / `Beta-2`. Zitat und
  Datum bleiben, der Name fällt weg. Kapı: `tools/check-namen.sh`.
- **Dark Theme:** keine festen Farben wie `#fff` — nur die CSS-Variablen
  (`--bg-card-solid`, `--text-main`, …).
- **i18n:** Texte in `dashboard.js` stehen im `T`-Wörterbuch in **drei** Sprachen
  (de/en/tr). Neue Modultexte erreichen dieses Wörterbuch heute **nicht** — das ist
  ein bekannter, offener Punkt. Erfinde dafür **keine** neue Mechanik in dieser
  Schleife; notiere gefundene Lücken und geh weiter.
- **Supabase:** `.single()` nicht bei optionalen Lookups (liefert 406) → `.maybeSingle()`.
- **Vor Schema-/SQL-Arbeit** zuerst `db/README.md` lesen (Falle Nr. 1: die
  Patiententabelle heisst **`leads`**, nicht `patients`). Danach `db/REGISTER.md`.
- **`git push` immer im Vordergrund** im Hauptkontext ausführen, nie im Subagenten
  und nie mit `run_in_background`.
- **`npm install`** braucht `--cache /tmp/npm-cache-praxura`, sonst scheitert es an
  Rechten.

---

## 4 · Werkzeuge, Agenten und Skills — erst schauen, was da ist

**Ganz zu Beginn, einmal:** `ls .claude/agents/` und `ls .claude/skills/`.
`CLAUDE.md` beschreibt zehn Agenten, aber **auf diesem Rechner liegt womöglich nur
`builder.md` und das Skill `konsey`**. Nutze nur, was wirklich existiert, und sag
mir im ersten Bericht, was fehlt. Erfinde keine Agenten.

Wenn vorhanden, in dieser Rolle:

| Werkzeug | Wofür in diesem Loop |
|---|---|
| `builder` (Agent) | Mehrschrittige Umbauten in einer Schleife — Arbeit zerlegen, verteilen, zurückgeliefertes prüfen |
| `/konsey` (Skill) | **Nur** bei echten Weggabelungen („so oder so?"), z. B. wenn ein Fix zwei plausible Wege hat und einer Daten berührt. Nicht für Bestätigung, nicht für Faktenfragen |
| `guvenlik`, `gkv-302`, `legal-de`, `db-ustasi`, `fonksiyon-ustasi`, `mobil-ui` (falls da) | Fachfragen im eigenen Feld. `fonksiyon-ustasi` und `db-ustasi` werden laut `CLAUDE.md` **ohne Rückfrage** aufgerufen — vor dem Schreiben fragen, nach dem Schreiben kurz melden (warum geschrieben, wo eingesetzt) |
| `engineering:code-review` (Plugin-Skill) | Vor jedem Commit über den eigenen Diff laufen lassen |
| `engineering:debug` (Plugin-Skill) | Wenn ein Befund nicht sofort erklärbar ist — reproduzieren, isolieren, diagnostizieren |
| `engineering:testing-strategy` | Wenn du für einen Fix neue Modultests brauchst und die Abdeckung planen willst |
| Claude in Chrome (`mcp__claude-in-chrome__*`) | Der Prüfdurchgang selbst. Konsole offen lassen (`read_console_messages`), rote Fehler im Wortlaut notieren |

**Maschinelle Prüfungen, die es schon gibt — vor jedem Commit alle drei:**

```
npm test                # 180 Modultests (node --test module/**/*.test.js)
npm run typecheck       # tsc-Ratsche
npm run probe           # 72 Prüfungen im echten Browser, ohne Login
```

`npm run probe` deckt bereits ab: Wochenraster 28 px, Tagesraster 56 px, Zeitleiste
und Spalten enden beide bei 717 px, Kontextmenü öffnet mit fünf Einträgen, alle
Module laden ohne Konsolenfehler, Tabellengruppierung. **Diese Punkte im Browser
nur kurz gegenprüfen, nicht gründlich.** Deine Zeit gehört dem, was einen
angemeldeten Nutzer braucht.

---

## 5 · Der Loop — Protokoll

### Zustandsdatei

Lege beim ersten Durchlauf `.plans/KALENDER-LOOP-STAND.md` an und **aktualisiere sie
am Ende jeder Schleife**. Sie ist deine Rettung, wenn der Kontext abreisst:

```markdown
# Loop-Stand — Kalender-Karte
Letzte Aktualisierung: <Datum, Uhrzeit>
Umgebung: app.praxura.de (Testkonto)

## Runden
- [ ] R1 Termindialog + Blocker      Status: offen | läuft | fertig | blockiert
- [ ] R2 Rechtsklick-Kontextmenü     Status: …
- [ ] R3 Leistungsfarben             Status: …
- [ ] R4 Doppelklick Woche/Monat     Status: …
- [ ] R5 Querschnitt (Sprachen, dunkel, schmal, Konsole)

## Angelegte Testdaten (und ob aufgeräumt)
| Was | Wann | Wo | aufgeräumt? |

## Geänderte Live-Einstellungen (und Ausgangswert)
| Was | Ausgangswert | zurückgesetzt? |

## Befunde
| Runde | Befund | Schwere | Fix-Commit | Status |

## Fragen an Melih (blockiert)
```

### Ein Rundenzyklus — immer dieselben sieben Schritte

1. **Lesen.** Die Unteraufgabe in `.plans/BROWSER-TEST-PROMPT.md` (Abschnitte siehe
   Runden unten), das zuständige Modul unter `module/`, und was `.plans/STAND.md`
   dazu sagt. Bei Funktionsfragen `funktionen/INDEX.json` statt raten.
2. **Bauen / reparieren**, falls die Runde eine offene Bauaufgabe hat (Runde 1 hat
   eine). Neuer Code nach `module/`, kein Wachstum von `dashboard.js`.
3. **Maschinell testen:** `npm test`, `npm run typecheck`, `npm run probe`. Erst
   wenn alle drei grün sind, gehst du in den Browser.
4. **Im Browser prüfen** — Claude in Chrome, `app.praxura.de`, Konsole offen, die
   Schritte der Runde der Reihe nach. Bei jedem Schritt: erwartet vs. gesehen.
   Screenshots bei jedem Fehler und bei den ausdrücklich verlangten Stellen.
5. **Reparieren**, was du gefunden hast — in derselben Runde, solange der Fix in
   die Runde gehört. Ein Fund, der zu einer *anderen* Runde gehört, wird nur
   notiert und dort behandelt. Nach jedem Fix zurück zu Schritt 3.
6. **Belegen:**
   - `fortschritte/2026-09-02.md` (heutiges Datum; **ein Tag = eine Datei**, an eine
     bestehende Datei wird angehängt, es wird keine zweite angelegt — Regeln in
     `fortschritte/REGELN.md`): was passierte und **warum**.
   - `.plans/KALENDER-LOOP-STAND.md` fortschreiben.
   - Neue Funktionen/Module: `node tools/funktionskarte.mjs` („harita güncelle") im
     selben Commit; bei Schemaänderung zusätzlich `db/SCHEMA.sql` +
     `db/SCHEMA-RLS.sql` auffrischen und `db/REGISTER.md` ergänzen.
7. **Commit** (Deutsch, im Stil der bestehenden Historie, z. B.
   `fix(kalender): Blocker zählte in der Therapeuten-Statistik mit`).
   **Push nur, wenn ich es sage** — jeder Push ist sofort live. Danach:
   **anhalten, Rundenbericht abgeben, auf mein Go warten.**

### Wann du anhältst und fragst — nicht selbst entscheidest

- Etwas löscht, verschiebt oder überschreibt echte Praxisdaten.
- Eine Schemaänderung (Migration) wäre nötig.
- Ein Fix berührt Abrechnung, `prescription_sessions`, DTA/§302 oder
  Zugriffsgrenzen zwischen Mandanten.
- Der Befund widerspricht einer festgehaltenen Entscheidung in `konsey/KARARLAR.md`
  (geschlossene Entscheidungen werden nicht wieder aufgemacht).
- Dreimal derselbe fehlschlagende Versuch. Dann: was du probiert hast, was passiert
  ist, welche zwei Wege du siehst.

---

## 6 · Die fünf Runden im Einzelnen

### Runde 1 — Schlanker Termindialog + Schnell-Blocker
**Prüfplan: L (45–49), M (50–57), P (72–77)**

Diese Runde hat als einzige eine **echte Bauaufgabe, und sie ist eine Vorbedingung:**

> **Therapeuten-Statistik zählt Blocker als geleistete Sitzungen.**
> `api-backend/billing/api/statistik.routes.js`, Abfrage 8: sie selektiert
> `employee_id` — diese Spalte gibt es in `bookings` **nicht**, dort heisst sie
> `user_id`. Die Abfrage läuft ins Leere. Und sie filtert `is_internal` nicht.
> Wer das eine behebt, **muss den Filter im selben Zug setzen**, sonst zählen
> Pause, Privat und Fortbildung als erbrachte Leistungen.

Vorgehen: erst die Abfrage gegen `db/SCHEMA.sql` prüfen (welche Spalten es
wirklich gibt), dann beides gemeinsam korrigieren, Modultest dazu wenn möglich.
⚠️ Das Backend liegt auf dem **eigenen Deploy-Weg** (Docker/Watchtower, siehe
`CLAUDE.md` → Deployment) — es geht **nicht** über Vercel live. Nicht selbst
ausrollen; Änderung committen und mir sagen, dass ein Backend-Deploy fällig ist.

Danach im Browser: Dialog kürzer als früher, „Mehr Optionen" klappt Notizen und
Serientermin weg, Mitarbeiterfeld fehlt bei Einzelpraxen, **Patient steht vor der
Leistung** (Schritt 73 ist der wichtigste Punkt der Runde), Feld „Anzahl".

Der Blocker-Test (M) **schreibt Daten**: Termin weit in der Zukunft, „Pause"
wählen, speichern, prüfen dass er grau/schraffiert ohne Namen erscheint, dann
**Schritt 55** — versuchen, über dieselbe Zeit einen normalen Termin zu legen. Das
muss mit einer **verständlichen deutschen Meldung** abgelehnt werden, nicht mit
`23P01` oder englischem Datenbanktext. Meldung im Wortlaut notieren. Danach
Blocker wieder löschen (der ist deiner, das ist erlaubt). Prüfen, dass „Pause"
in der Leistungsauswahl für **Patiententermine nicht** auftaucht.

### Runde 2 — Rechtsklick-Kontextmenü
**Prüfplan: E (13–24), F (25–27)**

In **allen drei** Ansichten. Fünf Einträge, Ausgrauen bei erledigten Terminen,
Pfeiltasten, Escape, Klick daneben, **Scrollen bei offenem Menü** (dort war schon
einmal ein Fehler: das Menü ging auf und sofort wieder zu), Menü am Bildschirmrand
klappt nach innen, Rechtsklick auf leere Fläche zeigt das **normale Chrome-Menü**.
„Absagen / stornieren" nur ansehen. „Verschieben" starten und mit dem Knopf
abbrechen — nichts wirklich verschieben.

Merke beim Reparieren: „Termin wahrgenommen" darf **keinen** zweiten Schreibweg
neben `handleTerminStarten()` bekommen.

### Runde 3 — Farben nach Leistung
**Prüfplan: K (38–44), O (60–71)**

Der eigentliche Zweifel steht in der Karte: **bleibt die Farbe nach dem Speichern
erhalten?** Vorher den Ausgangswert der Leistung notieren, danach zurücksetzen.
Schritt 40 ist der Kern: Leistung erneut öffnen — ist die gewählte Farbe markiert,
oder wurde sie nur angezeigt und nie geschrieben? Wenn nicht: der Speicherpfad ist
der Verdächtige (`srvColor` war früher ein `type=hidden` mit festem Grün, und
`color` wurde gar nicht mitgeschrieben).

Dazu die Leistungstabelle: keine Kacheln mehr, leere Gruppen erscheinen nicht,
Zeile per Tastatur öffnen, schmales Fenster scrollt **innerhalb** der Tabelle.
Schritt 70: fehlt „Abrechnungsart", ist das **kein Fehler** — die Spalte ist noch
nicht angelegt (Migration `sql-melih/2026-08-25-kostentraeger-typ.sql` offen), das
Feld blendet sich absichtlich aus. Nur berichten.

### Runde 4 — Doppelklick in Woche und Monat
**Prüfplan: A (1–3), B (4–8), C (9), D (10–12)**

Zuerst die Gegenprobe A (Zeitleiste endet auf Höhe der Spalten) — die ist maschinell
gemessen, hier reicht ein Blick mit echten Daten. Dann: Doppelklick auf leere Fläche
öffnet „Neuer Termin" mit **genau diesem Datum und dieser Uhrzeit**; bei „Alle"
Mitarbeitern bleibt das Mitarbeiterfeld leer, bei einem einzelnen ist es vorbelegt;
Doppelklick markiert keinen Text. Monat: Einfachklick springt in den Tag,
Doppelklick öffnet den Dialog mit 09:00 und springt **nicht** zusätzlich,
Klick auf eine Termin-Pille öffnet den Seitenbereich statt zu springen.

Denk beim Reparieren an die Falle: **Woche und Monat laden weniger Spalten als die
Tagesansicht.** Vor jeder Handlung `ladeTerminVollstaendig()`
(`module/termin-laden.js`) — sonst gilt ein Hausbesuch als Praxistermin.

### Runde 5 — Querschnitt und Abschluss
**Prüfplan: J (32–37), Q (78–82), H (83–85), I (86)**

Kopfleiste (zwei Ebenen statt drei, Buchungslink als Knopf, keine ausgeschriebene
URL mehr), die drei Sprachen (rohe Schlüssel wie `btn_copy_booking_link` suchen;
dass vieles auf Englisch noch deutsch ist, ist **bekannt und kein Fehler** — nur
den Umfang melden, Sprache danach auf Deutsch zurückstellen), dunkles Design,
schmales Fenster (~900 px), Konsolenfehler im Wortlaut.

Zum Abschluss:
- Zusammenfassender Bericht in der Form aus dem Prüfplan (A/B/C/… je Zeile OK/FEHLER).
- `.plans/STAND.md` fortschreiben: der Testdurchgang ist gelaufen, was er ergab.
- Vorschlag, welche der vier Ops-Karten geschlossen werden können — **schliessen
  tue ich, nicht du.** Für die Karten, die offen bleiben, je zwei Sätze warum.
- Neue Befunde, die zu keiner der vier Karten gehören, als Karten-Vorschläge für
  das Ops-Dashboard formulieren (Kategorie **Teknik**), nicht selbst einspielen.

---

## 7 · Form deines Rundenberichts

Nach jeder Runde, kurz und ohne Schmuck:

```
RUNDE <n> — <Name>           Status: fertig / teilweise / blockiert

Gebaut/repariert:  <Dateien + ein Satz warum>
Maschinell:        npm test <n/n> · typecheck <ok> · probe <n/n>
Im Browser:        <Schritt-Nr.: erwartet → gesehen>, nur Abweichungen ausführlich
Befunde:           <Schwere: blockierend / stört / Schönheitsfehler>
Testdaten:         <angelegt … / aufgeräumt: ja>
Live-Einstellungen:<geändert … / zurückgesetzt: ja>
Commit:            <hash + Betreff>   (nicht gepusht)
Nicht geprüft:     <was und warum>
Nächste Runde:     <n+1>, ich warte auf dein Go.
```

Wenn ich „weiter" sage, beginnst du die nächste Runde. Wenn ich nichts sage,
**wartest du** — du fängst keine neue Runde von selbst an.

Fang jetzt an mit **Schritt 0**: `CLAUDE.md`, `.plans/STAND.md`,
`.plans/BROWSER-TEST-PROMPT.md` lesen, `ls .claude/agents/ .claude/skills/`,
`git status` und `git log --oneline -12`, dann die drei maschinellen Prüfungen
einmal als Grundlinie laufen lassen. Melde mir die Grundlinie und was an Agenten
fehlt — **bevor** du Runde 1 beginnst.
