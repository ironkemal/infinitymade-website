# REFERENZ: Vorbild, Farben, neue Übersicht

Stand der Analyse: 23.10.2026. Das Bild liegt in `redesign/referenz/quicken-dashboard-mobbin.png`. Es ist lizenziert (Mobbin), gitignored und wird nie committet.

## 1. Das Vorbild in Worten (Quicken-Dashboard)

| Merkmal | Was genau | Für Praxura |
|---|---|---|
| Grund | Kühles Hellgrau, darauf weiße Karten | übernehmen |
| Karten | Große runde Ecken (~24 px), fast kein Schatten, viel Innenabstand (~32 px) | Ecken 16–20 px (Praxura hat viele Tabellen), Innenabstand 24–32 px |
| Seitenleiste | Schmale weiße Leiste nur mit Symbolen, aktiver Punkt zart hinterlegt, Hilfs-Symbole unten | Labels bleiben (27 Bereiche). Weiß, aktiver Punkt zart Creme. Eingeklappt = schmale Icon-Leiste mit Tooltip |
| Raster | Links eine hohe Karte (Konten mit Gruppen, Unterpunkten, Summen rechts). Rechts eine breite Karte, darunter zwei nebeneinander, darunter eine | Übersicht (Abschnitt 4); andere Bereiche: Panel-Kopf + Karten |
| Titel | Groß, **normales Gewicht** (nicht fett), graue Unterzeile (Zeitraum) | übernehmen |
| Zahlen | Große Blickfang-Zahl, Beträge rechtsbündig, gleich breite Ziffern, positiv grün | übernehmen (`font-variant-numeric: tabular-nums`) |
| Listen | Links Titel + grauer Untertitel, rechts Wert + Datum, feine Trennlinien | für Termine, Verordnungen, Rechnungen |
| Kleine Karten | 2×2: Buchstaben-Kreis farbig, Datum, ⋮-Menü, Titel, Betrag | für Fristen/Hinweise |
| Fortschritt | „150 € übrig“ + Balken + „von 1.000 €“ | z. B. „2 von 6 Einheiten übrig“ |
| Betonung | Wichtigste Karte mit zart getöntem Kopfbereich | Creme-Ton |
| „Alle anzeigen“ | Breite, zart hinterlegte Leiste unten in der Karte | übernehmen |
| Akzent | **Eine** Farbe (Lila), sparsam: Logo, Links, aktiv | Espresso/Bronze statt Lila |

**Nicht übernehmen:** abgeschnittene Diagramme, schwach kontrastige graue Schrift, Tortendiagramm bei vielen Werten (dann Balken).

## 2. Farben

Logo-Farben (gemessen, Kopf von `dashboard-feinschliff.css`): Espresso `#4F4136`, Bronze `#A48565`, Champagner `#C4A381`, Creme `#F3E4D2`.

| Variable (vorhandene Namen!) | Hell | Dunkel |
|---|---|---|
| `--bg-main` | `#F3F4F6` | `#121417` |
| `--bg-card`, `--bg-card-solid`, `--bg-topbar` | `#FFFFFF` | `#1B1E23` |
| `--bg-sidebar`, `--bg-input` | `#FFFFFF` | `#16191D` |
| `--bg-hover` | `rgba(17,24,39,.04)` | `rgba(255,255,255,.05)` |
| `--border` / `--border-strong` | `#E5E7EB` / `#D1D5DB` | `rgba(255,255,255,.09)` / `rgba(255,255,255,.18)` |
| `--text-main` | `#1F2328` | `#ECEDEF` |
| `--text-muted` | `#5F6672` | `#A3A9B3` |
| `--primary` / `--primary-hover` | `#4F4136` / `#3B3028` | `#C9AB8F` / `#DCC4A8` |
| `--primary-dim`, `--nav-active` | `#F6EEE4` | `rgba(201,171,143,.14)` |
| `--bronze` / `--highlight` | `#A48565` / `#C4A381` | `#C4A381` / `#C9AB8F` |
| `--success` / `--danger` / `--warning-text` | `#2F6B4A` / `#9C3A3A` / `#8A6A2F` | vorhandene Dunkel-Werte |

**Vorab gemessene Kontraste:** `#5F6672` auf `#F3F4F6` = 5,3:1 ✓ · auf Weiß 5,8:1 ✓ · Espresso auf Creme 8,5:1 ✓ · Warnung-Text auf Weiß 5,0:1 ✓ · Grün auf Grau 5,7:1 ✓ · Dunkel-Werte alle ≥ 7:1 ✓ · **Bronze auf Weiß nur 3,4:1 → nie für normalen Text**, nur für Linien, Symbole und große Zahlen.

Diagrammpalette mit dem Skill `dataviz` bauen und validieren (Espresso, Bronze, Champagner + ein kühler Schiefer-Ton für Abstand).

**Nie umfärben:** Leistungsfarben der Terminblöcke (wählt die Praxis, `module/kalender-farben.js`), Belege, Rechnungen, PDFs, Druck, E-Mail-Vorlagen, öffentliche Seiten.

## 3. Befunde aus dem Code (23.10.2026, in Phase 0 neu prüfen)

| Fund | Zahl | Folge |
|---|---|---|
| `dashboard.css` | 8.455 Zeilen, 1.140× `var(--`, 142 Hex, 146× `!important` | nicht umschreiben, eigene Datei darüber |
| `dashboard-feinschliff.css` | 491 Zeilen, Kemal 20.–21.10. | Basis, Spezifität beachten |
| Feste Farben `dashboard.js` | 263 Hex | Phase 2 |
| Feste Farben `module/*.js` (ohne Tests) | 358 Hex | Phase 2 |
| Feste Farben `dashboard.html` | 117 Hex, 2 `<style>`-Blöcke | Phase 2 |
| Inline-`style=` in `dashboard.js` | 373 | Phase 2/3, zu Klassen |
| `getElementById/querySelector` in `dashboard.js` | 1.601 | ID-Check |
| `dashboard.js` | 18.415 Zeilen = Baseline | darf nicht wachsen |
| Panels | 27: overview ueberblick calendar kunden services hours team b2b b2c rechnungen verordnungen abrechnung belegliste mahnwesen podologie-billing fussstatus warteliste statistik notizen fahrtenbuch doctors anamnese beispielmodus feedback vorlagen settings anfragen | alle umgestalten |
| Arbeitsordner | 22 nicht gespeicherte fremde Änderungen (u. a. `dashboard.js`) | nie mitcommitten |
| Vorhandene Vorschau | `dashboard-vorschau.html` (älterer Entwurf, rot `#cb4235`, dunkle Leiste) | nur Inspiration, nicht Vorlage |

## 4. Neue Übersicht (Vorschlag, mit `podoloji` + `/konsey` bestätigen)

```
┌──────────────┬──────────────────────────────────────────────┐
│ PRAXIS HEUTE │  TAGESPLAN                                   │
│ (wie die     │  Ring: gebucht / frei / Pause                │
│  Konten-     │  Große Zahl: „3 Std 20 Min frei“             │
│  Liste)      │  Fortschritt: VO läuft bald ab, 2 von 6 übrig│
│ Termine   12 ├───────────────────────┬──────────────────────┤
│ ▸ erledigt 5 │ NÄCHSTE TERMINE       │ FRISTEN & HINWEISE   │
│ ▸ offen    7 │ Liste, getönter Kopf  │ 2×2-Karten +         │
│ Verordnungen │                       │ „Alle anzeigen“ →    │
│ ▸ überfällig │                       │ Bereich ueberblick   │
│ ▸ ≤ 7 Tage   ├───────────────────────┴──────────────────────┤
│ ▸ in Therapie│  TAGESANSICHT (bestehendes Raster)           │
│ Abrechnung*  ├──────────────────────────────────────────────┤
│ Zuzahlungen* │  LEISTUNGEN DIESEN MONAT* (Balken) · AKTIVITÄT│
└──────────────┴──────────────────────────────────────────────┘
* nur Inhaber
```

- **Bleibt mit derselben Funktion:** `#welcomeOverview`, `#todayKpiBlock`/`#kpi-today`, `#physioRezKpi` (Kacheln filtern weiter), Tagesraster mit `#ovCountSelector` (1/3/6/9/12), `#scheduleViewToggle` (Tag/Woche/Monat), `#ovEmpChips`, `#gapsList` (freie Zeiten), `#activityFeedList`, alle Banner.
- **Neu:** Auslastungs-Ring, „Nächste Termine“, „Fristen & Hinweise“, „Leistungen diesen Monat“, Summen in „Praxis heute“.
- Geld-Werte nur für `owner`. Kacheln je nach Fachbereich (Podo/Physio). Jede Karte mit Lade-, Leer- und Fehlerzustand. Neue Praxen haben anfangs keine Daten.

## 5. Allgemeine Dashboard-Regeln (aus Refero, Muzli, IBM Carbon)
- Höchstens 3–4 Hauptzahlen oben, Details per Klick.
- Wichtigstes oben links, festes Raster.
- Linie = Verlauf, Balken = Vergleich, Torte nur bei 2–3 Anteilen.
- Grün gut, Rot schlecht, sonst neutral. Farbe nie als einziger Bedeutungsträger.
- Auf kleinen Bildschirmen: Karten untereinander, Tabellen mit weniger Spalten oder als Liste.
