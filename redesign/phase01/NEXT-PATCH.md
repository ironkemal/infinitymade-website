# P01-REP — begrenzter nächster Patchauftrag

Ziel: aktueller Funktionsstand mit bestätigter Gestaltung für Start, Kalender und Anamnese; dieselben drei Ansichten bei 390 px. Keine Aktivierungsentwicklung. Ausführung im vorbereiteten Integrationsworktree, Originale und 18086 unberührt. Dies ist Patchauftrag, kein bereits gebauter Kandidat.

## Vorprüfung

Pins/WIP-Hashes frisch vergleichen, FILE-OWNERS.tsv lesen. Exakten fonksiyon-ustasi aus .claude/agents/fonksiyon-ustasi.md konsultieren: vorhandene shell-neu/neu-start/Viewadapter und aktuelle start-aufgaben-Einstiege, keine zweite Finanzberechnung. Vor UI-Edit Impeccable craft-floor lesen. Ausstehende fünf ungebundene Modulpfade und dynamische Unteransichten vor ihrem jeweiligen Transfer gezielt auflösen.

## Dateien und erlaubte Änderungen

| Datei | Eigentümer | Präziser Schnitt |
|---|---|---|
| dashboard.html | Integrator | Nur additive, gescopte Stylesheetlinks mit frischer Cacheversion; vorhandene Panels, IDs, Scripts und Authpfad erhalten. Kein altes Dashboard ersetzen. |
| praxura-design.css | Integrator | Bestehende Token-/Bausteinschicht gegen gepinnten Designhash prüfen; Whitelist-Sicherungslücke vorher klären. Nur bestätigte Darstellungsregeln, keine Aktivierung. |
| design/shell.css | Integrator | Bestehende Shellregeln selektiv an aktuelle DOM-Struktur binden; noch keinen unauthentifizierten Shellstart übernehmen. |
| design/startseite.css | Integrator | Bestehende Startdarstellung mit aktuellen Aufgaben/Warnungen abgleichen; Unknown sichtbar halten. |
| design/kalender.css | Integrator | Nur Layout bestehender Tag-/Woche-/Monatansicht; aktuelle Raum-/Standort-/Teamfilter unverändert. |
| design/formulare.css + design/seiten.css | Integrator | Nur Anamnese-Scope samt vorhandenem Abschnitts-Wrapper, keine anderen Formularpanels mitziehen. V803-Wirkung wiederverwenden. |
| dashboard.js | Integrator | Im ersten Schnitt unverändert. Bei zwingendem Adapterbedarf separaten kleinen Diff mit Beraternachweis vorlegen; keine Fachlogik, keine Zeilenvergrößerung. |
| module/shell-neu.js, module/neu-start.js | Integrator | Zunächst Vergleichsquelle. Kein Ganzdateiimport ohne Aufrufer-/Auth-/Abhängigkeitsvertrag. |
| tools/browser-probe/physio-demo* | Integrator | Vorhandenes rein synthetisches Harness wiederverwenden; Netzwerkgrenzen vor Seitenerzeugung, keine reale Config/env. |
| redesign/phase01/* | Integrator | Status, Quellen, genaue Prüffälle und Befunde aktualisieren. |

Wenn bestehende DOM-Verträge für bestätigte Shell/Startkomposition nicht genügen: Schnitt auf Token + Kalender + Anamnese begrenzen, Differenz für Start exakt dokumentieren. Keine ähnliche Ersatzoptik improvisieren. Keine Scheinbestätigung der Startansicht.

## Abnahme auf genau diesem Kandidaten

Start: heutige Aufgaben und Warnungen unverändert, gefüllt/leer/laden/Fehler/Unknown. Kalender: Tag/Woche/Monat, lange Filter, Raum/Standort/Person unverändert gebunden. Formular: lange Checkboxlabels, Pflichtfeldfehler, ungespeicherte Eingabe nach Fehler, Abschnittswechsel, Fokus/Escape/Rückkehr.

Alle drei: hell/dunkel, Owner/Employee mit vorhandenen Rechten, 390/768/1024/1025/1440 px; keine globale horizontale Überbreite, wichtige Touchziele 44 px. Aktuelle Alt-Baseline ohne neue CSS versus mit gescopter CSS vergleichen, Druck unverändert. HTTP/WS-Fences und keine Fremdhosts/Writes; synthetische Speicherung nur wo Harness diese ausdrücklich isoliert unterstützt. Sonst Schreibnachweis als ungeprüft führen.

Tests: passende bestehende Syntax/ID/Scope/Cache-/Onprem-Gates auf diesem Worktree; gezielte Browserprobe und unabhängiger Diffreview. Keine erneute Vollsuite ohne Produktkandidat. Impeccable detect einmal nach UI-Abschluss, Renderbilder tatsächlich sichten. Ergebnis und anschauliche Ansichten Melih vor größerem Ausbau zeigen. Commit nur eigene geprüfte Dateien; kein Push.

Aktivierung: Elternvorarbeit außerhalb Repo liegt unter Downloads/Praxura-Redesign-Aktivierungsvertrag-2026-11-10.md und Praxura-Redesign-Boot-Befund-2026-11-10.json. Nicht in diesem Paket ausgeführt oder als eigene Tests gezählt. Auth/Shellstart/Allowlist/no-store/Identity-Generation später entscheiden, keine neue Tabelle/Vercelfunktion.
