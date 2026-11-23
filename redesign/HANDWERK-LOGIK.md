# Handwerk-Logik — eine Regel statt 50 Einzelflicken (Kemal, 23.11.2026)

**Anlass.** Kemal: „Urlaub sieht aus wie normaler Text, ist aber ein Knopf; Emojis wirken billig;
es fehlt das teure, ruhige Premium-Gefühl.“ Frühere Runden haben einzelne Seiten geflickt —
die Fehler kamen auf der nächsten Seite wieder, weil die **Ursache im System** liegt:

| Messung 23.11. (alt-Design, das alle Kunden sehen) | Folge |
|---|---|
| ~50 verschiedene Knopf-Klassen (`btn-ghost` 200×, `btn-primary` 161×, `btn-sm` 100×, `btn-secondary` 36× …) | `btn-secondary` hat allein **keine** Regel → „Logo hochladen“ steht als loser Text da |
| `.btn-sm` setzt 11 px + 4 px Radius mit `!important` (dashboard.css) | jeder kleine Knopf wird winzig und flach |
| 152 Emojis im UI-Code; `module/ohne-emoji.js` lief nur im neuen Design | 🌴 📋 🫁 im Live-Produkt |
| Status „In Behandlung“ rot | Rot heißt „Fehler“ — der Normalfall sieht aus wie ein Alarm |

Umsetzung: **`praxura-handwerk.css`** — wird als LETZTE Datei geladen, gilt nur für das
alte Design (`html:not([data-design="neu"])`), damit Melihs Pilot unberührt bleibt.
Zurücknehmen = eine `<link>`-Zeile entfernen.

## Die sieben Regeln

1. **Alles Klickbare sieht klickbar aus.** Es gibt genau drei Knopf-Arten:
   *Haupt* (dunkel gefüllt, max. 1 pro Bereich) · *Neben* (weiß, feine Linie, leichter Schatten) ·
   *Leise* (ohne Rahmen, aber mit Hover-Fläche — nur in Werkzeugleisten/Tabellenzeilen).
   Text, der etwas auslöst, ist nie nur Text.
2. **Drei Höhen, nicht zwanzig.** 40 px Seitenaktion · 34 px Standard · 28 px in Tabellenzeilen.
   Text bricht in Knöpfen nie um (`white-space: nowrap`). Symbol + Text: 6 px Abstand.
3. **Drücken fühlt sich an.** `:active` → `scale(0.97)`, 140 ms, `cubic-bezier(0.23,1,0.32,1)`.
   Nur `transform`/`background`/`border-color`/`box-shadow` animieren, nie `all`.
   Hover nur bei echter Maus (`@media (hover:hover)`), `prefers-reduced-motion` respektiert.
4. **Keine Emojis in der Oberfläche.** Bedeutung → monochromes Linien-Symbol (currentColor),
   Dekoration → weg. Gilt jetzt in beiden Designs (`ohne-emoji.js`).
5. **Farbe nur mit Bedeutung.** Grau = Normalzustand/läuft · Blau = Info/in Arbeit ·
   Grün = erledigt/bezahlt · Bernstein = Achtung · Rot = echtes Problem. Statuspillen: getönte
   Fläche + gleichfarbiger Text, keine Rahmenlinie, 22 px hoch.
6. **Eine Ebene Karte.** Karte in Karte in Karte ist verboten; innen trennen Linien und Abstand.
   Ein Hinweis aus einem Satz ist keine Karte, sondern eine leise Zeile.
7. **Ruhe vor Dichte.** Abstände aus der 4-px-Reihe (8/12/16/24/32). Zahlen `tabular-nums`.
   Leere Zustände: Symbol (36 px, grau) + ein Satz + ggf. eine Aktion — überall gleich.

## Wo was geprüft wird
- Bilder: `node tools/redesign-shots.mjs --lauf <name> --design alt --theme beide --breite 1440,390`
- Vorher-Stand 23.11.: Lauf `kemal-alt` (lokal, gitignored).
