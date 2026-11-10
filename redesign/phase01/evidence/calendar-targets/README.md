# P01 Kalender: Touchziele

Lokal und synthetisch geprüft. `design/kalender.css` hebt Navigations-, Ansichts-, Aktions- und Mitarbeiterfilter auf mindestens 44 px an. Segmenttrack 50 px inklusive Innenabstand. Terminslots, Zeitachse und Buchungsgeometrie bleiben unverändert.

Reproduktion: `REDESIGN_PORT=18094 rtk proxy node tools/browser-probe/p01-calendar-targets.mjs`.

- Sechs Kontexte: 390/768/1440 px, jeweils hell/dunkel, Owner.
- Erwartete sechs Aktions-IDs, drei Ansichtsschalter und vorhandene Mitarbeiterfilter ausdrücklich verlangt; jeder sichtbare Zielrahmen mindestens 44 × 44 px.
- Keine globale Überbreite oder Seitenfehler. HTTP-/WebSocket-Fences vor Seitenerstellung; keine externen Anfragen oder Schreibversuche.
- Sechs Alt-Screenshotpaare mit/ohne Kalender-CSS pixelgleich.
- Screenshot 390-light visuell geprüft. Beispiele enthalten weiterhin synthetische Podologieleistungen trotz Physio-Sektor; kein fachlicher Physionachweis.

Nicht geprüft: Kontextmenü geöffnet, reale Touchhardware, Mitarbeiterrolle, Terminpanel geöffnet. Kontextmenü-Mindesthöhe ebenfalls 44 px im CSS; dafür hier kein Laufzeitbeleg. Keine Live-/Login-/DB-Prüfung, kein Push/Deploy. Dies schließt nur das Touchziel-Teilpaket, nicht Phase 1.
