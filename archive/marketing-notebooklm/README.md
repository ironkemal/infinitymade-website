# InfinityMade — NotebookLM Video-Erzeugungs-Paket

Dieses Verzeichnis enthält die kuratierten Quelldokumente, die in
[notebooklm-py](https://github.com/teng-lin/notebooklm-py) eingespeist werden,
um Marketing-Videos (Hero-Video, Erklärvideo, Cinematic) für InfinityMade
zu erzeugen.

## Verfügbare Eingabedokumente

| Datei | Inhalt | Verwendung |
|---|---|---|
| `00_FAKTEN_BASIS.md` | Faktenliste, was InfinityMade ist und NICHT ist. Verbotene und erlaubte Aussagen. | **Immer mit einspielen.** Anti-Halluzinations-Schutz. |
| `01_PITCH_DEUTSCH.md` | Marketing-Pitch in finaler Tonalität. | Für allgemeine Videos / Hero. |
| `02_KUNDEN_STORY.md` | Konkretes Beispiel: "Eine Woche in der Physio-Praxis Lehmann". | Für Story-getriebene / cinematische Videos. |
| `SCRIPT_60s.md` | 60-Sekunden- und 30-Sekunden-Skripte (Voiceover-Text). | Direkt als Voiceover oder Loom-Aufnahme. |

---

## Voraussetzungen (Einmalig)

```bash
# 1. Python 3.10+ vorhanden? prüfen:
python --version    # sollte 3.10 oder höher zeigen

# 2. In das geklonte Repo wechseln (außerhalb der Website-Codebasis):
cd C:/Users/Test/Desktop/claude/notebooklm-py

# 3. Virtuelles Environment erstellen
python -m venv .venv
.venv\Scripts\activate    # Windows
# source .venv/bin/activate    # macOS/Linux

# 4. Paket installieren
pip install -e ".[browser,markdown]"
playwright install chromium

# 5. Authentifizierung — öffnet einen Browser, einloggen mit Google
notebooklm login
# Alternativ, falls Chromium-Probleme: notebooklm login --browser chrome
```

**Hinweis:** Beim ersten `login` öffnet sich Chromium. Sie loggen sich mit
einem Google-Account ein, der Zugriff auf NotebookLM hat
(z. B. `info@infinitymade.de` oder Ihr persönliches Google-Konto).
Die Session wird unter `~/.notebooklm/profiles/default/storage_state.json` gespeichert.

## Video erzeugen — Schritt für Schritt

```bash
# 1. Neues Notebook anlegen + als Standard setzen
notebooklm notebook create "InfinityMade Marketing 2026" --use

# 2. Die vier Quelldokumente einspielen (Pfade an Ihr System anpassen)
notebooklm source add C:/Users/Test/Desktop/claude/website/marketing/notebooklm/00_FAKTEN_BASIS.md
notebooklm source add C:/Users/Test/Desktop/claude/website/marketing/notebooklm/01_PITCH_DEUTSCH.md
notebooklm source add C:/Users/Test/Desktop/claude/website/marketing/notebooklm/02_KUNDEN_STORY.md
notebooklm source add C:/Users/Test/Desktop/claude/website/marketing/notebooklm/SCRIPT_60s.md

# 3. Auf Source-Verarbeitung warten (~30 Sekunden)
notebooklm source list

# 4. Video erzeugen — drei empfohlene Varianten:
```

### Variante A — Erklärvideo, Whiteboard-Stil (~60-90 Sek)

Klar, sachlich, am besten für Hero-Bereich:

```bash
notebooklm generate video \
  "Erkläre InfinityMade auf Deutsch in 60-90 Sekunden für deutsche Physiotherapeuten. \
Verwende AUSSCHLIESSLICH die Fakten aus den Quelldokumenten. \
Fokus auf: Rezept-OCR in 3 Sekunden, Sammelabrechnung in 15 Minuten, \
Hosting in Deutschland, Preis ab 29 EUR pro Monat. \
Endcall-to-Action: 'Demo buchen unter infinitymade.de'." \
  --format explainer \
  --style whiteboard \
  --language de \
  --wait \
  --timeout 900
```

### Variante B — Brief (kurz, ~30-45 Sek)

Für Instagram Reels / LinkedIn Square:

```bash
notebooklm generate video \
  "30-sekündiger Werbespot für InfinityMade auf Deutsch. Verwende den 30-Sekunden-Skript aus SCRIPT_60s.md. \
Sachlich, ohne Werbe-Übertreibung. Zielgruppe: deutsche Physiotherapeuten." \
  --format brief \
  --style classic \
  --language de \
  --wait
```

### Variante C — Cinematic (Dokumentarfilm-Stil, ~90-120 Sek)

Für eine Story-getriebene Version mit der Kunden-Story:

```bash
notebooklm generate cinematic-video \
  "Story-Video auf Deutsch nach 02_KUNDEN_STORY.md. Folge Anna Lehmann \
(Physio-Praxis in Köln) durch eine Woche mit InfinityMade. \
Visualisiere die Schritte: neuer Patient mit Rezept, Befreiungs-Workflow, \
Sammelabrechnung am Sonntag, ZAA-Antwort, Auszahlung. \
Endcall-to-Action: 'InfinityMade — infinitymade.de'." \
  --language de \
  --wait \
  --timeout 1200
```

### Nach erfolgreicher Generierung herunterladen

Die letzte Generierung wird als jüngstes Video in der Liste sichtbar:

```bash
notebooklm artifact list --type video --limit 5

# Mit der ID herunterladen
notebooklm download video ./infinitymade_hero.mp4 --artifact-id <ID-aus-der-Liste>

# ODER per Cinematic-Alias (lädt das jüngste cinematic):
notebooklm download cinematic-video ./infinitymade_story.mp4
```

---

## Style-Optionen — Übersicht

| Style | Optisch | Empfehlung |
|---|---|---|
| `whiteboard` | Hand-Zeichnung, Strichgrafik | Erklärvideo, sachlich. **Empfohlen für Hero.** |
| `classic` | Traditionelle Präsentation | Konservativ, vertrauensfördernd |
| `auto` | KI wählt selbst | Fallback wenn unentschieden |
| `kawaii` | Niedlich, japanisch | **Nicht für deutsche Physios.** Falsche Zielgruppe. |
| `anime` | Manga-/Anime-Stil | **Nicht für deutsche Physios.** |
| `watercolor` | Aquarell-Look | Künstlerisch, mögliche Alternative |
| `retro-print` | Plakat-Druck-Look | Hipster, eher für B2C |
| `heritage` | Klassisch-elegant | Konservativ, eventuell geeignet |
| `paper-craft` | Papier-Bastel-Optik | Verspielt, eher Beauty/Salon |

**Cinematic** (eigenes Kommando) ist Dokumentarfilm-Look mit echten Stockvideo-Schnitten — ideal für die Kunden-Story.

---

## Format-Optionen

| `--format` | Länge | Stil |
|---|---|---|
| `explainer` (Standard) | 60-90 Sek | Vollständige Erklärung |
| `brief` | 30-45 Sek | Kompakte Zusammenfassung |
| `cinematic` (via Alias) | 90-150 Sek | Dokumentarfilm-Look |

---

## Wichtige Hinweise

- **Throttling:** Bei intensiver Nutzung kann Google die Generierung drosseln. Mehrere Videos pro Tag = OK. Mehrere pro Stunde = Risiko.
- **Inoffiziell:** notebooklm-py nutzt undokumentierte Google-APIs. Kann jederzeit brechen. Nicht in CI-Pipelines binden.
- **Sprache:** Mit `--language de` erzwingen. Sonst kann es bei deutschen Quellen trotzdem Englisch ausgeben.
- **Qualität:** Erste Generierungen bewerten — wenn Stimme zu künstlich wirkt, Variante mit anderem Style versuchen.
- **Anti-Halluzination:** Immer `00_FAKTEN_BASIS.md` mit einspielen — das Dokument enthält explizite "verbotene Aussagen", an die sich das Modell hält.
- **Wiederverwendung:** Das Notebook bleibt bestehen — neue Generierungen ohne erneutes Source-Add möglich.

---

## Troubleshooting

| Symptom | Ursache | Fix |
|---|---|---|
| `auth login` öffnet keinen Browser | Playwright nicht installiert | `playwright install chromium` |
| `Source upload failed` | Datei-Pfad falsch | Absoluten Pfad verwenden |
| Video auf Englisch trotz `--language de` | Source-Dokumente nicht klar als Deutsch erkennbar | Im Prompt explizit "auf Deutsch" |
| `Generation timeout after 600s` | Komplexe Quellen | `--timeout 1500` setzen |
| Watermark im Video | Free-Tier oder Google-Account ohne NotebookLM-Plus | Im Output-Bild kontrollieren |

---

## Ausgabe-Verwendung (nach erfolgreichem Download)

```bash
# MP4 in das Website-Repo kopieren:
cp infinitymade_hero.mp4 C:/Users/Test/Desktop/claude/website/public/videos/

# Komprimieren (optional, für Hero-Auto-Play unter 10 MB Ziel)
ffmpeg -i infinitymade_hero.mp4 -c:v libx264 -crf 26 -preset slow -c:a aac -b:a 96k infinitymade_hero_compressed.mp4
```

Anschließend ins `index.html` oder `praxis.html` einbinden:

```html
<video
  autoplay muted loop playsinline
  poster="/videos/hero_poster.jpg"
  style="width:100%;height:auto;border-radius:12px;">
  <source src="/videos/infinitymade_hero_compressed.mp4" type="video/mp4">
</video>
```
