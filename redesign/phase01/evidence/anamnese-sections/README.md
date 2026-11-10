# Anamnese-Abschnittsnavigation

Bestätigtes Muster aus `module/einstellungen-nav.js` und `design/seiten.css`, auf Anamnese begrenzt. Originalfelder werden mit Rückkehrankern verschoben; keine Klone, keine neuen Datenabfragen oder Speicherwege. Nach authentifiziertem init montiert; Abschnittsliste erst bei aktivem Anamnesepanel. Desktopnavigation ab 1280 px gemäß bestätigtem Entwurf, darunter ausgeblendet.

Reproduktion: `REDESIGN_PORT=18106 rtk proxy node tools/browser-probe/p01-anamnese-sections.mjs`.

Vier isolierte synthetische Kontexte (390/1440 × hell/dunkel) bestanden:

- Sechs aktuelle Physioabschnitte; Desktoplinks mindestens 44 px hoch, Abschnittsklick fokussiert Originalziel ohne Formularladung.
- Feldknoten, Entwurf, Fokus und Textauswahl beim erstmaligen Wrappen erhalten.
- Alt stellt direkte Originalkinder in Originalreihenfolge wieder her. Scopeabweichung entfernt Wrapper und Navigation.
- Kioskcontainment unterdrückt Navigation; geprüft durch strukturelles Verschieben in tatsächlichen Kioskcontainer, kein kompletter Kiosk-PIN-/Patientenablauf.
- Keine globale Neu-Überbreite, Seitenfehler oder fremden HTTP-/WebSocket-/Schreibversuche; Fences vor Seitenerstellung.
- Alt nach Adapterrückkehr pixelgleich zum Kontrolltoggle ohne Adapter. Gleiche Scroll-/Maus-/ungefokuste Bildbedingungen; Fokus/Selection separat davor assertiert.

Erster Vergleich wurde verworfen: bei 390/hell ändern sich bereits ohne Adapter 20 native Checkboxrandpixel durch Neu→Alt-Neuzeichnung. Kontrollbilder/-hashes bleiben erhalten; keine Toleranz oder Maske. Desktop-Abweichung entstand durch unterschiedliche Scroll-/Hoverzustände nach Abschnittsklick. Test vereinheitlicht diese Bildbedingungen; Produktdarstellung dafür nicht verändert.

Zusätzlicher integrierter Lauf nach Auth-init-Hook: `P01_QUICK=1 P01_OUT=anamnese-integrated REDESIGN_PORT=18110 rtk proxy node tools/browser-probe/physio-demo-p01.mjs`. 16 Fälle bestanden: acht Rollen-/Theme-/Breitenkontexte mit je drei Panels, vier Szenarien und vier Alt-Paare mit je drei Panels. Keine Seitenfehler/Überbreite/Fenceverstöße; zwölf Alt-Panelvergleiche pixelgleich. Belege unter `../anamnese-integrated/`; ursprüngliche P01-Evidenz erhalten.

Grenzen: Abschnittsinteraktionen stammen aus isolierter Adapterprobe; integrierter Lauf belegt Erreichbarkeit und Auth-init-Einbindung unter synthetischen Konten. Kein vollständiger Fachbereichs-/Employee-/Kiosk-/Live-/Speichernachweis. Keine Regressionsgarantie für echten Panelwechsel: bestehendes `loadAnamnese()` bleibt dessen Datenverantwortlicher.
