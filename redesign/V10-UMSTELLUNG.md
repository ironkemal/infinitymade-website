# V10 — prüfbarer Release- und Rückfallkandidat

Stand: 27.10.2026. **Nur Vorbereitung, keine Freigabe und nicht auf Produktdateien angewandt.** Laufende Pakete zuerst fertigstellen und vollständig integrieren/testen. P1-Nachprüfung, beide P2, V7, externe V8-Pakete und V9 sind weiterhin offen. Das Endziel bleibt Neu als Standard für sämtliche Nutzer einschließlich Bestandskunden.

## Exakte Diffs und Bindung

Basis: `53e08f05e5ad70716bc8c9eb719f16a50824c3b1`.

- `V10-RELEASE.patch`: ändert ausschließlich Kommentar und Head-IIFE in `dashboard.html`. Ohne Query wird Neu aktiviert, unabhängig von fehlendem/abweichendem/gesperrtem Storage oder `px-design=alt`. `?design=alt` bleibt expliziter Notausgang; Darkmode bleibt erhalten, soweit Theme lesbar ist. Keine Speicherung/Löschung einer Designwahl.
- `V10-ROLLBACK.patch`: **auf dem Release-Kandidaten** anwendbar, nicht auf der Basis. Erzwingt Alt unabhängig von gespeichertem `px-design=neu` und jeder Query, einschließlich `?design=neu`. Theme bleibt erhalten. Vorhandene Neu-Module/Styles bleiben paketiert, werden über das fehlende `data-design=neu` nicht aktiviert.
- `V10-KANDIDAT.json`: Basis-Commit und SHA-256 der drei HTML-Stände sowie ausgewählter Boot-/Design-Dateien. Kein vollständiges Installationsmanifest. Bei weiteren Integrations-/Cacheänderungen sind Kandidat und Hashes vor Freigabe neu zu erzeugen; ein grüner Test dieses Pins ist keine Abnahme eines späteren Standes.

Der Rückfall ist gezielt ein Frontend-Designrückfall. **Kein Backend-Downgrade, keine Rücknahme des R06-Owner-Gates, keine Schema-/Datenänderung.** Nicht einfach den ursprünglichen Opt-in-Boot wiederherstellen: Er würde gespeichertes `px-design=neu` erneut aktivieren.

## Ausgeführte lokale Probe

`rtk proxy node redesign/V10-PRUEFUNG.mjs`

Die Probe prüft Hashes, wendet beide tatsächlichen Patchdateien nacheinander ausschließlich in einem neuen temporären Ordner an und führt die jeweiligen extrahierten Head-Skripte im VM aus. Kein Backendimport, Browserport, DB- oder Netzaufruf. Ergebnis: **33/33 Fälle**, elf Zustände in Basis/Release/Rollback:

Frisches Profil; dunkler Bestand; gespeichertes Alt; gesperrter Storage; OAuth-Rückkehr; Kalender-Deep-Link; gespeichertes Neu; explizites Neu; explizites Alt vor gespeichertem Neu; explizites Alt bei gesperrtem Storage; explizites Neu bei gesperrtem Storage. Beide Kandidaten schreiben/löschen keine Storagewerte. Die Probe prüft außerdem den bestehenden `neu-start.js`-Einstieg, der nur dem HTML-Attribut folgt und keinen Storage-Bypass enthält.

Die laufende Produktdatei `dashboard.html` bleibt auf Opt-in. Diese Probe belegt Bootentscheidungen und Patchanwendung, **keine gerenderte Rollen-/Fachbereichs-/27-Bereiche-Abnahme und keine tatsächliche Kundenumstellung**.

## Nachweise und noch offene Freigabegates

| Gegenstand | Stand / erforderlicher Nachweis |
|---|---|
| Gemeinsame Einstiege | Lokal gelesen: `login.js:148`, `onboarding.js:104`, `confirm.html:177/205`, `manifest.json:5/41` führen zu nacktem `dashboard.html`. Nach Integration tatsächlich Login/OAuth/Bestätigung, PWA-Start und vorhandene Bookmarks prüfen. |
| Rollen und Fachbereiche | Owner/Employee mit jeweils gültigen Rechten; Physio/Ergo/Logo/Podo/interdisziplinär; alle 27 Bereiche und bestehenden direkten Einstiege. Erhalt von Funktionen, Mandantentrennung, Rollen und Daten konkret belegen. VM-Bootfälle ersetzen das nicht. |
| Auslieferung und Cache | Dockerfile kopiert Dashboard/Module/Design; `vercel.json` enthält must-revalidate für HTML/JS/CSS. Konfiguration ist kein Runtime-Headernachweis. Vollständiges gebautes Frontendartefakt mit zusammenpassenden HTML-/JS-/CSS-Versionen prüfen, Update aus Bestandsinstallation mit alten Caches ohne manuelle Speicherbereinigung nachweisen. Aktueller Kandidat ändert keine Asset-URLs, weil er nur den Defaultflip auf diesem Pin enthält; spätere Integrationen benötigen frische Versions-/Artefaktprüfung. |
| PWA / Service Worker | Keine Registrierung in aktuellem `dashboard.js`/`module` gefunden. Das beweist nicht, dass ein Bestandsbrowser keinen älteren Service Worker oder Cache mehr besitzt. Bestands-PWA, Offline-/Wiederonline-Verhalten und tatsächlichen installierten Kundenstand separat prüfen. |
| Rückfall | Globale Alt-Erzwingung im VM belegt. Gebautes Rollbackartefakt einschließlich Cache-Aktualisierung und weiterhin wirksamen Backend-Rechten vor Freigabe praktisch prüfen. Kundenspeicherbereinigung ist keine Voraussetzung. |
| Befristeter Notausgang | `?design=alt` gemäß PLAN-V2 eine Woche ab tatsächlicher Standardaktivierung; Termin und anschließenden Bereinigungsdiff vor Veröffentlichung festlegen. Kandidat enthält noch keinen kalendergebundenen Ablauf, weil Aktivierungszeitpunkt nicht freigegeben/festgelegt ist. Globaler Rückfall bleibt davon getrennt. |
| Veröffentlichungsfreigabe | Zuerst alle laufenden Pakete integrieren und Abnahme abschließen; dann aktualisierte Diffs, Artefaktversionen, Umstellungsweg und Rückfall Melih vorlegen. Kein main-Push, Live-DB-Zugriff, Deploy oder tatsächlicher Standardwechsel durch diesen Auftrag autorisiert. |
