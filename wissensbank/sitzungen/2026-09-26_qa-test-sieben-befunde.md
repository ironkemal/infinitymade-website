---
titel: QA-Test 26.09.2026 — sieben Befunde, Ursachen, Fixes
typ: sitzung
angelegt: 2026-09-26
tags: [sitzung, qa, zeitzone, katalog-suche, verordnungen, warteliste, booking]
commits: [2007c8e, c82e831, 8982657, 8bae297]
---

# QA-Test 26.09.2026 — sieben Befunde

Auslöser: QA-Durchlauf mit Claude in Chrome (Owner-Sicht) auf app.praxura.de. Alle Fixes am
26.09.2026 gepusht; Frontend (Vercel) und Backend (Watchtower) live. Status je Punkt auch in
`canli-test/REGISTER.md` (Block „QA turu 2026-09-26").

## Befunde und Ursachen

| # | Befund | Ursache | Fix | Nachweis |
|---|---|---|---|---|
| 1 | Auswahl im ICD/DG/Heilmittel-Dropdown „füllt nicht zuverlässig" | Wettlauf: nach der Wahl öffneten ausstehende Debounce/RPC-Antworten das Dropdown wieder | `katalog-suche.js` `verwirfSuche()` | Probe `katalog-auswahl-probe` 5/8 → 8/8 (lokal) |
| 2 | Termin-Dialog 2 h verschoben | `start_time.substring(0,16)` schrieb UTC ins Feld, Speichern liest Ortszeit → **Öffnen+Speichern verschob den Termin** | `module/datum.js` `alsDatetimeLocal()` | Unit-Test Rundreise (lokal); live noch nicht geklickt |
| 2b | Fahrtenbuch-Bearbeiten, gleicher Fehler | `toLocal = iso.slice(0,16)` | `alsDatetimeLocal` (`c82e831`) | nur Syntax; live offen |
| 3 | Warteliste-Tabs filtern nicht | Abfrage war richtig; späte „Wartend"-Antwort überschrieb „Vermittelt" | `module/warteliste-ansicht.js` verwirft fremde Antworten | **live bestätigt** 26.09. (0 vermittelte, Tab bleibt) |
| 4 | „Bewertungen" öffnet „Feedback & Support" | kein Routing-Fehler — falsches Label | `nav-registry.js` + i18n de/en/tr | **live bestätigt** |
| 5 | Kalender-Blocker auf öffentlicher Terminanfrage | `/api/services/public` filterte `is_internal` nicht | `server.js` `.not('is_internal','is',true)` | **live bestätigt**: 23 → 20 Leistungen, keine Blocker |
| 6 | Verordnungen (Originaltext verloren, live nachgestellt) | eingebettete Muster-13-Maske: (a) Kästchen nur in `#rezeptModal` gesucht, (b) `wireM13Toggles` lief nur über `openRezeptModal` | Wurzel `#rzMaskeWrap`; `maskeEinbetten` → Brücke `verdrahteToggles` | Probe 33/33; live: Verdrahtung ✅ (`m13Wired=1`), Bereich-Häkchen **uneindeutig** (s. offen) |
| 7 | 390px horizontaler Überlauf (Übersicht) | `.schedule-header` nowrap, `#ovCountSelector` 34px zu breit | `dashboard.css` ≤768px `flex-wrap` | statisches Markup 360–768px; JS-Inhalt ungemessen |

## Lernpunkte

- **Zeitzone:** DB liefert `timestamptz` als UTC. Formularwert (`datetime-local`) ⇄ Zeitpunkt nur über
  `alsDatetimeLocal` / `new Date(wert)` — nie per String-Slicing. Kandidaten mit Eigenbau (korrekt, aber
  nicht zentral): `dashboard.js` `loadSlots`, `bkStart.min`, `messDatum` (fonksiyon-ustasi, 26.09.).
- **Wettläufe bei asynchronem Nachladen** waren zweimal die Ursache (1, 3): Antworten, die zu einem
  inzwischen verlassenen Zustand gehören, müssen verworfen werden.
- **Die Muster-13-Maske ist EIN Knoten, der umzieht** (Modal ↔ Verordnungsansicht). Alles, was nur im
  Modal sucht, bricht in der eingebetteten Ansicht (vgl. `module/verordnung-podo.js` `$('rzMaskeWrap') || modal`).
- `verordnung-maske.js` hält Zustand (Brücke): **`?v=` nicht einzeln hochzählen** — ein Importeur mit
  anderem `?v` lädt eine zweite Instanz ohne Brücke. Header sind ohnehin `must-revalidate`.
- `canli-test`-Agent kann auf diesem Mac nicht einloggen (kein `.env.local` mit QA-Zugang, kein
  `playwright-cli`). Live-Prüfung lief über Claude in Chrome mit Melihs Sitzung, nur lesend.

## Offen

- Befund 6 live: Bereich-Häkchen nach Öffnen aus der Liste erneut prüfen (beim 2. Lauf war
  `rzTherapieBereich` leer — wahrscheinlich Maske noch nicht befüllt; ungeprüft).
- Befund 2/2b live: Termin/Fahrt öffnen → Feld = angezeigte Zeit; Speicher-Test nur mit Freigabe.
- **Altlast:** Termine/Fahrten, die vor dem Fix geöffnet+gespeichert wurden, können bereits um
  1–2 h verschoben in der DB stehen. Nicht untersucht.
- Befund 7 mit eingeloggtem Inhalt (Terminkarten) bei 390px messen.
