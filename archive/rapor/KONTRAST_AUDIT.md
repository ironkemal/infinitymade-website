# Kontrast-Audit Report

## Funde (nach Schweregrad sortiert)

| # | Datei:Zeile | Betroffenes Element | Hintergrund | Schriftfarbe | Schweregrad | Vorgeschlagener Fix |
|---|---|---|---|---|---|---|
| 1 | `dashboard.html:3812` | `#pdInfoBlock` / `#pdInfoGrid` im Patientendetails-Modal (`#patientDetailModal`) | `#fafbfd` (hartkodiertes Hellgrau/Weiß) | `var(--text-main)` (`#F2ECDD`, nahezu weiß) & `var(--text-muted)` (`#9ca3af`) | unlesbar | Inline-Style `background:#fafbfd` entfernen oder `background: var(--bg-card-solid);` im CSS erzwingen. |
| 2 | `dashboard.js:8095` | `.pd-rech-item` (Zuzahlungsbefreiungs-Karte im Rezept-Tab von `#patientDetailModal`) | `#fafbfc` (hartkodiertes Hellgrau/Weiß) | `var(--text-main)` (`#F2ECDD`, nahezu weiß) bei `<strong style="font-size:14px;">Zuzahlungs-Befreiung</strong>` | unlesbar | Inline-Style `background:#fafbfc` durch `background: var(--bg-card-solid);` ersetzen. |
| 3 | `dashboard.html:5083` | Hinweistext in `#bkActionFahrtEndGroup` (Termin-Aktionsmodal für Fahrt-Ende KM) | `#fff7e6` (hartkodiertes helles Cremegelb) | Kein `color` gesetzt; erbt `var(--text-main)` (`#F2ECDD`, nahezu weiß) | unlesbar | Explizite dunkle Textfarbe `color: #a06200;` am `<div>` ergänzen (analog zu Zeile 5093). |
| 4 | `dashboard.js:6297` | `th`-Elemente in dynamischen Tabellen (z. B. Abrechnung/Beleglisten) | `#f5f5f5` (hartkodiertes Hellgrau) | Kein `color` im CSS-String gesetzt; erbt `var(--text-main)` (`#F2ECDD`, weiß) | unlesbar | Explizite dunkle Schriftfarbe `color: #111;` oder `background: var(--bg-card-solid);` verwenden. |
| 5 | `dashboard.html:1928` | `.badge-gray` im Aktive-Verordnung-Container `#anamRxContext` (Anamnese) | `#f0fdf4` (hellgrüner Container) + `rgba(148,163,184,0.15)` (Badge) | `var(--text-muted)` (`#9ca3af`, hellgrau) | schwer lesbar | `#anamRxContext` auf `background: var(--bg-card-solid);` umstellen oder Badge-Schrift im hellen Container abdunkeln (`color: #374151`). |
| 6 | `dashboard.css:7213` | `.vorlage-preview` / `.vorlage-preview-placeholder` in Vorlagen-Cards | `#f9fafb` (hartkodiertes Hellgrau) | Unterelemente / Platzhalter ohne explizite Textfarbe erben Dark-Theme-Text | grenzwertig | `color-scheme: light; color: #374151;` für den Vorschau-Container festlegen. |
| 7 | `dashboard.html:5406` | Native `<select>` und Date/Time-Inputs in Inline-Modalen (`#blManualType`) | `var(--bg-card)` | erben `color: var(--text-main)`, icon-scheme folgt `body { color-scheme: dark; }` | grenzwertig | Container-spezifische `color-scheme`-Steuerung für helle Modale festlegen. |

## Systemische Ursache

Das Grundproblem entsteht durch die Kombination aus **globalen Dark-Theme-Variablen auf Body-Ebene** (`--text-main: #F2ECDD`, `color-scheme: dark`) und **lokalen, hartkodierten hellen Hintergrundfarben** (`#fafbfd`, `#fafbfc`, `#fff7e6`, `#f5f5f5`, `#f0fdf4`).

Wenn ein Container oder eine Hinweiskarte eine helle Hintergrundfarbe zugewiesen bekommt, ohne gleichzeitig die Schriftfarbe abzudunkeln, erben alle enthaltenen Text- und Formularelemente weiterhin die weiße Schrift des Dark Themes.

Zudem greifen partielle Reparaturversuche wie der Notfall-Override in `dashboard.css:6817-6825` (`#patientDetailModal [style*="background:#fff"]`) zu kurz, da sie nur exakte `background:#fff`-Strings erfassen, off-white Hex-Werte wie `#fafbfd` oder `#fafbfc` aber unberührt lassen.

**Empfohlener systemischer Ansatz:**
Anstatt Dutzende Einzelfixes zu pflegen, sollten entweder:
1. Alle Info- und Spezialkomponenten konsequent auf Theme-Variablen (`var(--bg-card-solid)`, `var(--text-main)`) umgestellt werden, ODER
2. Eine globale Utility-Klasse (z. B. `.light-paper-container`) eingeführt werden, die automatisch `color: #111; color-scheme: light;` setzt und Theme-Variablen (`--text-main: #111`, `--bg-input: #fff`) lokal überschreibt.
