---
titel: M3 — offene Kamera- und Boxabnahme
typ: sitzungsnotiz
angelegt: 2026-10-07
status: offen
tags: [m3, qa, kamera, testbox, offen]
---

# M3 — diese drei Punkte bleiben offen

Stand: 07.10.2026. **M3 ist durch Melih als ✅* lokal abgenommen mit Einschränkungen.**
Die folgenden Hardware-/Boxabnahmen bleiben offen; keine Produktionsfreigabe.
Diese Notiz dient als Erinnerung; sie ist kein Test- oder Freigabenachweis.

## 1. Physische Kamera und Barcode in Chrome testen

- [ ] Synthetischen Muster-13-Barcode ausdrucken oder auf einem zweiten Bildschirm anzeigen und mit echter Kamera im vollständigen lokalen Dashboard erfassen.
- [ ] Übernahme prüfen: Müller, Zoë · HPNR 78010 · 6 Einheiten · Vorschau vorhanden.
- [ ] Kamera jeweils neu starten und per Escape, X sowie Abbrechen schließen. In jedem Fall müssen alle Kameratracks stoppen und der Kameraindikator ausgehen.
- [ ] Kamera nach Abbruch erneut starten und Berechtigungsverweigerung prüfen.
- [ ] Ergebnis mit Chrome-Version, Datum und Nachweis dokumentieren: ausschließlich PASS, FAIL oder NICHT GEPRÜFT pro Testfall.

Der bisherige Escape-Nachtest im vollständigen Dashboard verwendete einen synthetischen Canvas-Videostream. Der physische Nachtest nach den Änderungen steht aus.

## 2. Handykamera auf isolierter HTTPS-Testbox testen

- [ ] Freigegebene isolierte HTTPS-Testbox mit Test-URL und Testzugang bereitstellen.
- [ ] Ausschließlich synthetische Daten verwenden; keine Verbindung zu produktiven Praxisdaten.
- [ ] Barcodeaufnahme, Vorschau und Datenübernahme auf echtem Handy prüfen.
- [ ] Kameraabbruch, Schließen per X, Neustart und verweigerte Berechtigung prüfen; Kamera muss nach Schließen aus sein.
- [ ] Gerät, Betriebssystem, Browser-Version und Ergebnisse dokumentieren.

Blocker beim Schreiben: keine freigegebene HTTPS-Testbox und keine Testbox-Zugangsdaten. Lokaler Docker-Integrationstest ersetzt diese Abnahme nicht.

## 3. Abnahme dokumentieren und M3 abschließen

- [ ] Ergebnisse aus Punkt 1 und 2 im QA-Bericht ergänzen. Nicht ausgeführte Tests als NICHT GEPRÜFT belassen.
- [ ] Neue Fehler beheben und betroffene Abläufe erneut testen.
- [ ] M3-Abnahmekriterien im Sprint gegen die gesammelten Nachweise prüfen.
- [x] M3 durch Melih lokal mit Einschränkungen abgenommen (07.10.2026); offene Hardware-/Boxabnahmen ausdrücklich separat festgehalten.
- [ ] Uneingeschränkten Abschluss erst bei erfüllten Abnahmekriterien dokumentieren.

Lokale grüne Tests allein begründen keine Produktionsfreigabe.

## Bereits lokal nachgewiesen

Laut lokalem QA-Bericht: 2891/2891 automatisierte Tests, 39/39 Browserprobe-Tests und 14/14 echte API-/DB-Tests mit synthetischen Daten. Dashboard-Speichern, Wiederöffnen, PATCH und erneute Papierbestätigung wurden lokal geprüft. Diese Notiz führt keine neuen Tests aus.

## Wiederaufnahme

**Nächster Schritt: Punkt 1 im vollständigen lokalen Dashboard mit echter Kamera durchführen.**

- Testbericht: `fortschritte/2026-10-07-M3-ABNAHME.md` (Repositorywurzel).
- Chrome-Testprompt: `tools/browser-probe/CHROME-M3-TEST.md` (Repositorywurzel).
- Sprint und Abnahmekriterien: `KUTU_HAZIRLIK_SPRINT.md` (Repositorywurzel).
- Wissensbankübersicht: [[SITZUNGEN]].

Umfang auf Nutzerwunsch: ausschließlich die offenen Punkte 1–3. Punkt 4 (Commit/Deploy) gehört nicht zu dieser Erinnerung.
