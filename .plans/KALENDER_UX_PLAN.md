# Terminkalender-UX — Umsetzungsplan Punkte 1.1 – 1.4

> Zielablage nach Freigabe: `.plans/KALENDER_UX_PLAN.md` (gleiche Konvention wie
> `OPTICA_PARITY_PLAN.md`). Die Ops-Karten aus `/tmp/ops-tasks-kalender.json` bleiben die
> Aufgabenliste, dieses Dokument ist die Bauanleitung dazu.

---

## Kontext

Beta-Rückmeldung vom 22.08.2026 aus der Praxis: der Terminkalender ist der Bildschirm, auf
dem der Praxisalltag stattfindet, und genau dort kostet jede Bedienung mehr Klicks als im
Altsystem. Vier Punkte wurden benannt — Termin anlegen geht nur in der Tagesansicht,
Termine sind farblich nicht nach Leistung unterscheidbar, Statusänderungen brauchen den
Umweg über den Seitenbereich, und die Terminmaske ist für eine schnelle Eingabe zu voll.
Dazu fehlt eine Möglichkeit, Zeit ohne Patient zu blocken (Privat, Pause).

Ergebnis nach Umsetzung: ein Termin lässt sich aus jeder Ansicht heraus in zwei Klicks
anlegen, der Kalender ist auf einen Blick lesbar, Status ändert man per Rechtsklick auf dem
Termin, und Pausen/Privatzeit blockt man ohne Patientenauswahl.

**Nicht Teil dieses Plans:** Header/Navigation (Punkte 2.1–2.3), Verordnung HMV13
(3.1–3.2), Menü und Leistungsmaske (4.1–4.2). Abhängigkeit beachten: Punkt **1.2 bleibt
wirkungslos, bis der Farbwähler aus Punkt 4.2 existiert** — Details unten.

---

## Geltende Projektregeln für diese Arbeit

| Regel | Konsequenz hier |
|---|---|
| `dashboard.js` wächst nicht (Konsey 2026-08-13, Pre-Commit-Hook `tools/check-dashboard-size.sh`, Basis 25.399 Zeilen) | Neuer Code kommt nach `module/kalender-*.js`. In `dashboard.js` nur Import-Zeile + Ersetzen bestehender Blöcke, netto ≤ 0 Zeilen. |
| Vor neuer Funktion `fonksiyon-ustasi` fragen, danach Zweck melden | Vor jedem der vier Punkte einmal fragen; nach Fertigstellung Zweck + erster Einsatzort melden. |
| Keine festen Hex-Farben | Alle neuen Flächen über `--bg-card-solid`, `--text-main`, `--border`. Ausnahme bleiben die Datenfarben (`EMP_COLORS`, `services.color`) — die kommen aus Daten, nicht aus dem Theme. |
| i18n dreisprachig | Jeder neue sichtbare Text in `de` / `en` / `tr` im `T`-Wörterbuch in `dashboard.js`. |
| Cache-Busting | Jede geänderte Datei bekommt neues `?v=YYYYMMDD` im Import bzw. in `dashboard.html`. |
| `.single()` vermeiden | Bei optionalen Lookups `.maybeSingle()`. |

---

## Ist-Zustand (verifiziert am 22.08.2026)

### Die drei Ansichten

| | Datei/Zeile | Zeitraster | Klick auf leere Fläche | Klick auf Termin |
|---|---|---|---|---|
| Tag | `dashboard.js:2660` | `.dv-slot` je 30 Min / 56 px, **pro Mitarbeiter eine Spalte** | ✅ `prefillBookingModal(timeStr)` + `bkEmployee` vorbelegt (`:2722`) | ✅ `openCalRightPanel(b)` (`:2818`) |
| Woche | `dashboard.js:2839` | **keine Slot-Elemente**, nur ein leeres `div` mit `height = 24*28px`; Spalten sind Tage | ❌ nichts | ❌ nichts (Block hat `cursor:pointer`, aber keinen Handler) |
| Monat | `dashboard.js:2938` | Zellenraster, keine Uhrzeit | Einfachklick → Wechsel in die Tagesansicht (`:3020`) | ❌ Pillen sind nicht klickbar |

### Gefundener Fehler, der 1.1 blockiert — Wochenraster ist doppelt so hoch wie sein Inhalt

`renderWeekView` füllt die Zeitspalte `#wvTimeCol` mit Elementen der Klasse `.dv-slot`
(`dashboard.js:2863-2871`). `.dv-slot` ist in `dashboard.css:1793` **56 px** hoch — es gibt
keinen `wv-`-Sonderfall im gesamten Stylesheet. Die Tagesspalten daneben rechnen aber mit
**28 px** je halber Stunde (`dashboard.js:2892`, `:2917-2918`).

Folge: die Zeitleiste ist 24 × 56 = 1344 px lang, der Inhalt 24 × 28 = 672 px. Die Uhrzeit
links stimmt mit keinem einzigen Terminblock überein. Zusätzlich hat `.dv-time-col`
`padding-top: 44px` (`dashboard.css:1790`) für die Kopfzeile der Tagesansicht, während die
Wochen-Kopfzeile nur rund 27 px hoch ist (`dashboard.js:2896`) — ein zweiter Versatz.

Ein Doppelklick auf eine Uhrzeit wäre in diesem Zustand sinnlos, weil die angezeigte
Uhrzeit nicht die getroffene ist. **Das wird zuerst repariert (Schritt 1.1.0).**

### Was bereits existiert und wiederverwendet wird

| Baustein | Ort | Wofür |
|---|---|---|
| `DV_SLOT_MIN`, `DV_SLOT_PX`, `MOVE_RASTER_MIN`, `moveVersatzMinuten()`, `zeitPlusMinuten()`, `terminZeitLabel()` | `module/kalender-raster.js` | Raster-Mathematik, schon ausgelagert. Wird um Wochenwerte erweitert. |
| `prefillBookingModal(startStr)` | `dashboard.js:3178` | Leert die Maske, füllt `bkStart`, öffnet `bookingModal`. Einziger Einstieg für „neuer Termin". |
| `prefillBookingModalFromSlot(dateStr, timeStr, empId, serviceId, …)` | `dashboard.js:2488` | Variante mit Mitarbeiter- und Leistungsvorbelegung. |
| `openCalRightPanel(b)` → `openBookingActionModal(b)` | `dashboard.js:3821`, `:3342` | Seitenbereich rechts. |
| `startMoveBooking(b)` / `placeGhost()` / `cancelMoveBooking()` | `dashboard.js:5483`, `:5527`, `:5498` | Verschieben mit Geistervorschau. |
| `showAbsagegrundModal({title, confirmText})` | `dashboard.js:7109` | Absagegrund-Abfrage, liefert `null` bei Abbruch. |
| `offerAusfallrechnung(b, 'no_show' \| 'late_cancel')` | `dashboard.js:4689 ff.` | Ausfallrechnung anbieten. |
| `ensureBlankoBonusServices()` | `dashboard.js:7727` | **Vorlage** für „interne Leistung je Inhaber bei Bedarf anlegen" (`is_internal: true`). |
| `emit()` / `on()` | `module/signal.js` | Ereigniskanal, damit Module nicht auf `dashboard.js`-Globals zugreifen müssen. |
| `services.color` | `db/SCHEMA.sql:1522`, DEFAULT `#22c55e` | Leistungsfarbe, in der DB vorhanden, im Kalender ungenutzt. |
| `no_overlapping_bookings` EXCLUDE-GIST | `db/README.md` Falle 5 | Verhindert Doppelbuchung serverseitig — gilt automatisch auch für Blocker mit `status='confirmed'`. |

---

## 1.1 — Termin per Doppelklick in Wochen- und Monatsansicht

**Ziel:** Doppelklick auf eine leere Fläche in Woche oder Monat öffnet die Terminmaske mit
Datum, Uhrzeit und (wo eindeutig) Mitarbeiter vorbelegt.

### Schritt 1.1.0 — Wochenraster-Geometrie reparieren (Vorarbeit, muss zuerst)

1. In `module/kalender-raster.js` ergänzen:
   ```js
   export const WV_SLOT_PX = 28;      // Wochenansicht: halbe Zeilenhöhe der Tagesansicht
   export const WV_HEADER_PX = 27;    // Höhe der Tages-Kopfzeile in der Wochenspalte
   ```
   Begründungskommentar im Stil der Datei: warum die Woche halb so hoch ist (7 Spalten statt
   1–3, sonst passt kein Tag auf den Bildschirm).
2. In `dashboard.css` eine eigene Regel für die Wochenansicht, statt `.dv-slot` zu ändern
   (die Tagesansicht darf sich nicht bewegen):
   ```css
   .week-view-grid .dv-slot { height: 28px; }
   .week-view-grid .dv-time-col { padding-top: 27px; }
   ```
   Beide Werte gehören zu den Konstanten aus Schritt 1 — Kommentar mit Querverweis, wie es
   `kalender-raster.js` bei `DV_SLOT_PX` schon vormacht.
3. Prüfen: Terminblock 09:20–10:00 muss in der Woche exakt zwischen den Beschriftungen
   09:00 und 10:00 sitzen.

**Alternative, falls die Wochenansicht danach zu gedrängt wirkt:** `WV_SLOT_PX` auf 56
setzen und die Rechnungen in `renderWeekView` anpassen — dann sind Tag und Woche identisch,
die Woche wird aber doppelt so lang. Entscheidung erst nach dem Sehen, nicht vorab.

### Schritt 1.1.1 — Neues Modul `module/kalender-woche.js`

Die Wochenansicht wandert aus `dashboard.js` (Zeilen 2839–2936) vollständig in ein Modul.
Das ist der von der Konsey vorgesehene „Kuschelungs"-Weg: angefasster Code zieht um,
`dashboard.js` schrumpft, der Hook zieht die Basis automatisch nach.

Öffentliche Schnittstelle:

```js
export async function renderWoche({
  supabase, dateStr, ownerId, teamMembers, calEmpFilter,
  onSlotDoppelklick,   // ({ dateStr, timeStr, empId|null }) => void
  onTerminKlick,       // (booking) => void
  onSlotKlick,         // ({ dateStr, timeStr, empId|null, slotEl, ev }) => void  — Verschieben-Modus
  farbeFuer,           // (booking) => { flaeche, rand }   — siehe 1.2
  moveAktiv,           // boolean
}) { … }
```

In `dashboard.js` bleibt eine dünne Hülle, die die Abhängigkeiten reicht — kein Zuwachs,
weil sie den alten Rumpf ersetzt.

### Schritt 1.1.2 — Slot-Raster in die Wochenspalten

Pro Tagesspalte dieselbe Doppelschleife wie in der Tagesansicht (`dashboard.js:2716-2725`),
aber mit `WV_SLOT_PX`:

- `slot.dataset.time = `${dayISO}T${hh}:${mm}``
- `slot.dataset.empId` = die **gefilterte** Mitarbeiter-ID, sonst leer (siehe unten)
- Slots liegen unter den Terminblöcken: `inner` bleibt `position:relative`, Blöcke bleiben
  `position:absolute` und werden **nach** den Slots angehängt, damit sie den Klick zuerst
  bekommen.
- `.dv-slot--past` genau wie in der Tagesansicht setzen, damit vergangene Zeit gleich
  aussieht.

**Mitarbeiterfrage:** In der Woche sind die Spalten Tage, nicht Personen.
- `calEmpFilter !== 'all'` → genau ein Mitarbeiter, `empId` wird vorbelegt.
- `calEmpFilter === 'all'` → **Entscheidung A: Feld bleibt leer, Auswahl wird erzwungen.**
  `empId` wird als `null` durchgereicht, die Maske öffnet mit leerem Mitarbeiterfeld.
  `bkSaveBtn` verlangt ohnehin einen Mitarbeiter (`dashboard.js:5987`), es entsteht also
  kein stiller Fehlgriff. Bewusst **kein** Vorbelegen auf den eingeloggten Nutzer — in
  Mehrbehandler-Praxen bucht sonst jeder Doppelklick zuerst auf dieselbe Person.

### Schritt 1.1.3 — Doppelklick statt Einfachklick

- `slot.addEventListener('dblclick', …)` → `onSlotDoppelklick`.
- Einfachklick bleibt für den **Verschieben-Modus** reserviert (`moveBooking` gesetzt →
  `placeGhost(slot, empId, text, ev)` wie `dashboard.js:2729-2733`). Damit funktioniert
  Verschieben zum ersten Mal auch in der Woche; heute erzwingt `startMoveBooking` einen
  Sprung in die Tagesansicht (`dashboard.js:5490`). Dieser Zwang darf dann entfallen, wenn
  die Wochenansicht aktiv ist.
- Der Doppelklick darf beim Verschieben **nicht** greifen — erste Zeile des Handlers:
  `if (moveAktiv) return;`.
- Textauswahl unterdrücken: `user-select: none` auf `.week-view-grid .dv-slot`, sonst
  markiert der Doppelklick die Uhrzeit.

### Schritt 1.1.4 — Terminblöcke in der Woche klickbar machen

Der nicht gemeldete Nebenfehler: Blöcke haben `cursor:pointer`, aber keinen Handler.
- `block.addEventListener('click', ev => { ev.stopPropagation(); onTerminKlick(b); })`
  → `openCalRightPanel(b)`, identisch zur Tagesansicht.
- `stopPropagation` ist nötig, damit der Klick nicht als Slot-Klick durchschlägt.

### Schritt 1.1.5 — Monatsansicht

Zwei Gesten auf derselben Zelle, deshalb sauber trennen:
- **Einfachklick** bleibt „in die Tagesansicht springen" (`dashboard.js:3018-3021`), aber
  verzögert über einen 250-ms-Timer, den ein eintreffender `dblclick` löscht. Ohne das
  feuert bei jedem Doppelklick zuerst der Ansichtswechsel.
- **Doppelklick** öffnet die Maske mit `bkStart = <Datum>T09:00`, damit ein Wert drinsteht;
  Uhrzeit ist im Monat nicht ableitbar. 09:00 ist gesetzt, nicht geraten — der Nutzer sieht
  und ändert sie. Vorbild: `dashboard.js:12114` macht genau das schon (`dateVal + 'T09:00'`).
- Klick auf eine Termin-Pille (`.month-event-pill`) öffnet den Seitenbereich statt zu
  springen — `stopPropagation` nicht vergessen.
- **Entscheidung B: Timer-Variante.** Beide Gesten bleiben nebeneinander bestehen; der
  Sprung in die Tagesansicht kostet dadurch 250 ms mehr — spürbar, aber die eingeübte
  Geste bleibt erhalten.

### Schritt 1.1.6 — Mobil / Touch

`dblclick` gibt es auf Touch praktisch nicht. Zweiter Weg, damit die Funktion auf dem Tablet
nicht fehlt: langes Drücken (500 ms, `pointerdown`/`pointerup` mit Bewegungstoleranz) löst
denselben Rückruf aus. Dieselbe Erkennung wird für 1.3 (Kontextmenü) gebraucht — **einmal
schreiben, in beiden Punkten benutzen**: `module/langer-druck.js` mit
`export function aufLangenDruck(el, handler, { ms = 500, toleranzPx = 8 })`.

### Verifikation 1.1

1. Woche öffnen → Zeitleiste links deckt sich mit den Blöcken (Termin 09:20 liegt knapp
   unter der 09:00-Linie).
2. Doppelklick auf leere Fläche Mi 14:30 → Maske öffnet, `bkStart` = `…T14:30`, Datum
   stimmt, bei aktivem Mitarbeiterfilter ist der Mitarbeiter gesetzt.
3. Termin speichern → erscheint sofort an der geklickten Stelle.
4. Klick auf bestehenden Termin in der Woche → Seitenbereich öffnet mit dem richtigen
   Patienten.
5. Verschieben aus dem Seitenbereich starten, Wochenansicht aktiv → Geist folgt dem Klick,
   kein Zwangssprung in die Tagesansicht.
6. Monat: Einfachklick springt weiterhin in den Tag, Doppelklick öffnet die Maske, beides
   löst nicht gleichzeitig aus.
7. `git commit` läuft durch → `dashboard.js` ist nicht gewachsen.

---

## 1.2 — Farbliche Differenzierung nach Leistung

**Ziel:** Termine sind auf einen Blick nach Leistung unterscheidbar, ohne die
Mitarbeiterunterscheidung zu verlieren.

### Ausgangslage

`EMP_COLORS[empIdx]` färbt heute alles: `dashboard.js:2708` (Tag), `:2920` (Woche),
`:3006` (Monat), zusätzlich `:1763`, `:2401`, `:5532`, `:15079` an anderen Stellen.
`services.color` existiert in der DB, wird aber nur an einer Stelle überhaupt mitgelesen
(`dashboard.js:1859`).

**Sperre:** `srvColor` ist in `dashboard.html:568` ein `type="hidden"` mit festem
`#22c55e`. Ohne Farbwähler haben alle Leistungen dieselbe Farbe und der Umbau ist
unsichtbar. → Der Farbwähler gehört in Punkt 4.2 (Leistungsmaske) und ist **Vorbedingung**.
Reihenfolge: entweder 4.2 vorziehen, oder 1.2 mit einer Notlösung starten (Farbe aus einer
festen Palette per Leistungs-Index ableiten, sobald `color` gesetzt wird ersetzt sie das).

### Umsetzung

1. Neue Funktion in `module/kalender-farben.js`:
   ```js
   export function terminFarben(booking, { teamMembers, servicesById }) {
     // → { flaeche: <Leistungsfarbe>, rand: <Mitarbeiterfarbe>, quelle: 'leistung'|'fallback' }
   }
   ```
   Regel: `flaeche` = `services.color` der gebuchten Leistung, Rückfall `EMP_COLORS[idx]`,
   letzter Rückfall `var(--primary)`. `rand` = immer `EMP_COLORS[idx]`.
2. Darstellung — **Entscheidung C: Fläche = Leistung, Rand = Mitarbeiter.**
   - Fläche = Leistungsfarbe mit `22`/`25` Alpha-Suffix (wie heute).
   - Linker Rand 3 px = Mitarbeiterfarbe (`border-left`).
   In der Tagesansicht trennen bereits die Spalten nach Mitarbeiter, dort ist der Rand
   Redundanz — schadet aber nicht und hält alle drei Ansichten gleich.
   Verworfen: Umschalter im Header (ein Bedienelement mehr, zwei Zustände zu pflegen) und
   Mitarbeiter-Initialen im Block (bei 28 px Blockhöhe in der Woche zu eng).
3. `services`-Abfragen der drei Renderer um `color` erweitern: `services(title)` →
   `services(title,color,code)` (Woche `dashboard.js:2884`, Monat `:2971`; Tag lädt
   `services(title,code)` in `:2693` und braucht `color` dazu).
   Achtung: das sind PostgREST-Einbettungen, keine Joins — nur die Feldliste ändern.
4. Legende: die Mitarbeiter-Chips (`#calEmpChips`) erklären heute die Farben. Sobald die
   Fläche die Leistung meint, braucht es eine zweite kleine Legende oder einen Tooltip,
   sonst rät der Nutzer. Vorschlag: Leistungsfarbe im Tooltip des Blocks mitnennen
   (`block.title` wird in `dashboard.js:2812` ohnehin gebaut).
5. Dark Theme: die Datenfarben bleiben Hex aus der DB — das ist erlaubt, weil es Daten sind.
   Aber Kontrast prüfen: `#22c55e22` auf dunklem Grund ist sehr blass. Falls nötig
   Alpha themeabhängig über eine CSS-Variable statt fest im JS.

### Verifikation 1.2

Zwei Leistungen mit verschiedenen Farben anlegen, je einen Termin bei zwei Mitarbeitern
buchen → in allen drei Ansichten unterscheiden sich die Flächen nach Leistung und die Ränder
nach Mitarbeiter; Umschalten hell/dunkel bleibt lesbar.

---

## 1.3 — Kontextmenü per Rechtsklick

**Ziel:** Rechtsklick auf einen Termin → vier Statusaktionen ohne Umweg über den
Seitenbereich.

### Ausgangslage

Kein einziger `contextmenu`-Listener im Frontend. Alle vier Aktionen existieren fertig:

| Menüpunkt | Bestehender Code | Was er tut |
|---|---|---|
| Termin wahrgenommen | `handleTerminStarten()` `dashboard.js:4469` | **Korrektur 22.08.:** NICHT `bookings.status='completed'` — das schreibt der Seitenbereich nur nebenbei für vergangene Termine. Die Handlung ist `markPrescriptionSession(id,'done')` + `pruefeVerordnungsfortschritt()`; daraus entstehen die §302-Positionen. Ein zweiter Schreibweg hätte einen Kalender erzeugt, der stimmt, und eine Abrechnung, die nie kommt. |
| Patient nicht erschienen | `dashboard.js:4585-4630` | `showAbsagegrundModal` → `status='no_show'`, `no_show_noted_at`, `prescription_sessions.status='no_show'`, `triggerNoShowBot`, `offerAusfallrechnung(b,'no_show')` |
| Verschieben | `startMoveBooking(b)` `dashboard.js:5483` | Geistermodus |
| Abgesagt / storniert | `dashboard.js:8081-8107` (`bkActionDeleteBtn`) | `showAbsagegrundModal` → `cancellation_reason` → ggf. `offerAusfallrechnung(b,'late_cancel')` → **`DELETE`** |

**Wichtig und vorher zu klären:** „Absagen" ist heute ein echtes `DELETE`, kein
`status='cancelled'`. Ein Rückgängig ist danach unmöglich. Deshalb behält der Menüpunkt die
bestehende Absagegrund-Abfrage als Bestätigung — kein stiller Sofortvollzug, kein
Undo-Toast, der nichts rückgängig machen kann.

**Entscheidung D: bestehendes Verhalten übernehmen.** Das Kontextmenü ruft denselben Ablauf
auf wie `bkActionDeleteBtn` — kein eigener Löschpfad, kein Umbau. Die Umstellung auf weiches
Stornieren (`status='cancelled'`, Zeile bleibt, Undo möglich) wäre die sauberere Lösung
(GoBD-Nachweis, Ausfallrechnung behält ihren Bezug), ist aber eine eigene Baustelle mit
Wirkung auf Statistik, Warteliste und §302 → als separate Karte aufs Ops-Board, nicht Teil
dieses Plans.

### Umsetzung

1. Neues Modul `module/kalender-kontextmenue.js`:
   ```js
   export function verdrahteKontextmenue(container, { eintraegeFuer, aufAktion });
   // container: #dvColsWrap, #wvColsWrap, #monthGrid
   // eintraegeFuer(booking) → [{ id, label, gefahr?:true, deaktiviert?:boolean }]
   // aufAktion(id, booking)
   ```
   Delegierter Listener auf dem Container statt einer je Block — Blöcke werden bei jedem
   Rendern neu gebaut.
2. Menüeinträge kontextabhängig: „wahrgenommen" nur bei `status='confirmed'` und
   Startzeit in der Vergangenheit; „nicht erschienen" nicht bei bereits abgeschlossenen
   Terminen; bei Gruppenterminen (`is_group`) zunächst nur „öffnen", weil die Aktionen
   Kinder-Buchungen betreffen.
3. Aktionen **nicht neu implementieren** — die vorhandenen Funktionen aufrufen. Dafür
   müssen drei von ihnen aus `dashboard.js` erreichbar gemacht werden. Sauberster Weg ohne
   Zeilenzuwachs: die Rückrufe beim Verdrahten übergeben (`aufAktion` bekommt eine Abbildung
   `{ wahrgenommen, nichtErschienen, verschieben, absagen }`), statt `window.*` zu setzen.
4. Nach jeder Aktion die aktive Ansicht neu zeichnen. Heute machen das die Handler nur für
   die Tagesansicht (`dashboard.js:4622`, `:8106`). Einheitlicher Weg: `emit('termin:geaendert', {id})`
   aus `module/signal.js`, und der Kalender hört darauf und zeichnet die **aktive** Ansicht.
5. Bedienung: Escape schließt, Klick daneben schließt, Pfeiltasten wandern durch die
   Einträge, `aria-menu`-Rollen. Am Bildschirmrand nach innen klappen. Auf Touch über
   `module/langer-druck.js` aus Schritt 1.1.6.
6. Das Browser-Kontextmenü nur auf Terminblöcken unterdrücken (`ev.preventDefault()`),
   nicht auf der ganzen Fläche — sonst nimmt man dem Nutzer „Link kopieren" überall weg.

### Verifikation 1.3

Je Ansicht: Rechtsklick auf Termin → Menü an der Mausposition; jede der vier Aktionen
ausführen und prüfen, dass Datenbankstatus, Seitenbereich und Kalender übereinstimmen;
Escape und Klick daneben schließen; auf dem Tablet öffnet langes Drücken dasselbe Menü.

---

## 1.4 — Schlanker Terminerfassungs-Dialog + Blocker (Privat, Pause)

### Teil A — Maske verschlanken

**Ist-Zustand** (`dashboard.html:2943 ff.`): immer sichtbar sind Mitarbeiter, Dienstleistung,
Gruppentermin-Block samt Teilnehmerliste und Patientensuche, Dauerwahl, Von, Kunde mit zwei
Anlegeknöpfen (⚡ Schnell / ＋ Normal), Telefon, Verordnungsauswahl mit Karten und
Selbstzahler-Knopf, dazu Notizen, Hausbesuch, Serientermin.

**Vorgehen:** nichts löschen, nur die Sichtbarkeit staffeln.

1. **Grundmaske:** Kunde · Dienstleistung · Von · (Mitarbeiter, wenn mehr als einer).
   Speichern-Knopf direkt darunter.
2. **„Mehr Optionen"** (aufklappbar, Zustand pro Nutzer in `localStorage` merken): Notizen,
   Hausbesuch, Serientermin, Gruppentermin.
3. **Bedingt einblenden statt dauerhaft zeigen** — die Logik existiert, sie wird heute nur
   nicht zum Ausblenden genutzt:
   - Gruppen-Block nur, wenn die gewählte Leistung `is_group` ist (`services.is_group`).
   - Verordnungs-Abschnitt nur, wenn der gewählte Patient offene Verordnungen hat — das
     prüft `bkVerordnungSection` bereits (`dashboard.js` rund um `:3210`), es wird nur nie
     verborgen gelassen.
   - Telefonfeld nur bei neu angelegtem Patienten.
4. Reihenfolge nach Eingabefluss: die Praxis nennt zuerst den Patienten, dann die Leistung,
   dann die Zeit. Heute steht der Mitarbeiter oben — bei Einzelpraxen ein toter Klick.
5. Zeilenbudget: das ist HTML in `dashboard.html`, nicht `dashboard.js` — die Umstellung der
   Sichtbarkeitslogik kommt nach `module/termin-maske.js`.

### Teil B — Blocker „Privat" und „Pause"

**Ist-Zustand:** existiert nicht. „Pause" gibt es nur in den Arbeitszeiten
(`dashboard.js:10960`, `:12217`), Abwesenheit nur über `time_offs` (`#calAddLeaveBtn`) und
das ist tagesweise, nicht stundenweise.

**Umsetzung ohne Schemaänderung** — Vorlage ist `ensureBlankoBonusServices()`
(`dashboard.js:7727`):

1. `module/kalender-blocker.js` mit `ensureBlockerServices(supabase, ownerId)`, das je
   Inhaber bei Bedarf zwei interne Leistungen anlegt:
   | Titel | `code` | `is_internal` | `duration_minutes` | `color` |
   |---|---|---|---|---|
   | Privat | `BLOCK_PRIV` | `true` | 30 | dezentes Grau |
   | Pause | `BLOCK_PAUSE` | `true` | 30 | dezentes Grau |
2. In der Maske zwei Schnellknöpfe über der Grundmaske: „⏸ Pause" / „🔒 Privat". Klick setzt
   `service_id` auf die interne Leistung, `customer_name` auf den Titel und blendet
   Kunde/Telefon/Verordnung aus.
3. `bkSaveBtn` (`dashboard.js:5975`) verlangt heute bei Nicht-Gruppen zwingend einen Kunden
   (`:6033`). Dieselbe Ausnahme wie für `isGroup` ergänzen: bei Blocker-Leistung kein
   `custId` nötig. `bookings.customer_name` ist `NOT NULL` (`db/SCHEMA.sql:326`) — deshalb
   wird der Titel eingetragen, nicht leer gelassen.
4. `populateSrvSelect` filtert interne Leistungen aus dem Dropdown (`dashboard.js:5622`) —
   gewollt. Die Blocker kommen nur über die Schnellknöpfe herein; beim **Bearbeiten** eines
   Blockers greift die vorhandene Ausnahme `s.id === selectedId`, die Leistung bleibt also
   sichtbar.
5. Darstellung: Blocker als schraffierte, blasse Fläche ohne Patientennamen — sonst sieht
   der Tag nach mehr Umsatz aus, als er hat.
6. **Vor der Umsetzung zu prüfen (Aufwand klein, Risiko sonst groß):** fallen Termine mit
   interner Leistung aus Statistik, Rechnungen und §302 heraus? `dashboard.js:19674` filtert
   `!is_internal` für die Rechnungszuordnung, aber die Auswertungen (`nav_statistik`) und
   `belegliste` wurden noch nicht geprüft. Falls nicht: dort denselben Filter ergänzen,
   bevor die Blocker ausgeliefert werden — sonst verfälschen Pausen die Auswertungen.
7. Nebeneffekt, der uns hilft: der EXCLUDE-GIST-Constraint `no_overlapping_bookings` gilt
   auch für Blocker mit `status='confirmed'` — über eine Pause lässt sich kein Patient
   buchen, ohne dass wir eine Zeile Prüfcode schreiben.

### Verifikation 1.4

Maske öffnen → nur vier Felder sichtbar; Leistung mit `is_group` wählen → Gruppenblock
erscheint; Patient mit laufender Verordnung wählen → Verordnungsabschnitt erscheint;
„Pause" klicken → speichert ohne Patient; Patiententermin über die Pause legen → DB weist
mit Constraint-Fehler ab und die Meldung ist übersetzt (`dashboard.js:5572`);
Auswertungen zeigen die Pause nicht als Leistung.

---

## Getroffene Entscheidungen (Melih, 22.08.2026)

| # | Frage | Entscheidung |
|---|---|---|
| A | Woche mit Filter „Alle Mitarbeiter": auf wen bucht der Doppelklick? | **Mitarbeiterfeld bleibt leer, Auswahl wird erzwungen.** Kein Vorbelegen auf den eingeloggten Nutzer — in Mehrbehandler-Praxen landet der Termin sonst still bei der falschen Person. `bkSaveBtn` prüft ohnehin (`dashboard.js:5987`). |
| B | Monat: Einfachklick und Doppelklick nebeneinander? | **Beides, per 250-ms-Timer entkoppelt.** Einfachklick springt weiterhin in die Tagesansicht, nur verzögert; ein eintreffender `dblclick` löscht den Timer. Eingeübte Geste bleibt erhalten. |
| C | Farblogik | **Fläche = Leistungsfarbe, linker Rand 3 px = Mitarbeiterfarbe.** Kein Umschalter im Header, keine Initialen im Block (bei 28 px Blockhöhe in der Woche zu eng). |
| D | „Absagen" bleibt `DELETE`? | **Ja, bestehendes Verhalten übernehmen.** Kontextmenü ruft denselben Ablauf wie `bkActionDeleteBtn`: Absagegrund abfragen → ggf. Ausfallrechnung → `DELETE`. Der Grund-Dialog ist der Schutz, kein Undo-Toast (er könnte nichts rückgängig machen). Umstellung auf weiches Stornieren bleibt eine eigene Aufgabe fürs Ops-Board, nicht Teil dieses Plans. |

---

## Reihenfolge und Aufwand

| Schritt | Warum in dieser Reihenfolge | Grobaufwand |
|---|---|---|
| 1.1.0 Wochenraster reparieren | Ohne stimmige Geometrie ist Doppelklick sinnlos | klein |
| 1.1 Doppelklick Woche/Monat | Größter Alltagsgewinn; schafft nebenbei Verschieben in der Woche | mittel |
| 1.3 Kontextmenü | Baut auf denselben Blöcken auf; Aktionen existieren fertig | klein–mittel |
| 1.4 A Maske verschlanken | Unabhängig, hoher gefühlter Gewinn | mittel |
| 1.4 B Blocker | Braucht 1.4 A (Schnellknöpfe) und die Prüfung aus Punkt 6 | klein–mittel |
| 1.2 Farben | Bewusst zuletzt: wirkungslos ohne Farbwähler aus Punkt 4.2 | klein, aber blockiert |

---

## Gesamt-Verifikation

1. `node --test module/*.test.js` — bestehende Modultests müssen grün bleiben; für
   `kalender-raster.js` (neue Konstanten) und `kalender-farben.js` (Farbwahl-Regel) je einen
   Test ergänzen, das ist die Konvention in diesem Ordner.
2. Kalender manuell in allen drei Ansichten durchgehen, hell und dunkel, plus Tablet-Breite.
3. `git commit` → Pre-Commit-Hook bestätigt, dass `dashboard.js` nicht gewachsen ist
   (Basis wird beim Auslagern der Wochenansicht sogar automatisch nachgezogen).
4. Nach dem Merge: `fortschritte/2026-08-XX.md` fortschreiben (eine Datei je Tag) und die
   erledigten Karten im Ops-Dashboard abhaken.
5. `fonksiyon-ustasi` melden: neue Module, warum sie entstanden sind und wo sie zuerst
   benutzt werden.
