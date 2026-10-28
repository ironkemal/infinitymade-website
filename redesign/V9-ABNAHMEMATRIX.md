# V9-Abnahmeplanung und spätere Standardumstellung

Stand: 28.10.2026. Quellenpin: `a808a1104e86427bffa4ee6dade5a508e75b4ebd`.

## Auftrag und Grenze

- Problem: vorhandene Teilnachweise sauber zuordnen; tatsächliche Lücken bis V9 und spätere Standardumstellung benennen.
- Eigene Datei: ausschließlich `redesign/V9-ABNAHMEMATRIX.md`, durch Integrator reserviert; eigenes Worktree/Branch `redesign/praxura-v9-abnahme`.
- Wiederverwendung: STATUS, PLAN-V2, WERKZEUGE, V704-PHASENGATES, V803-/V804-Übergaben und vorhandene V10-Artefakte.
- Abhängigkeiten: V803-Baustopp, übrige V804-Panels, unabhängiger V209b-Review, abschließender Integrationspin.
- Nachweis: Quellen-/Artefaktabgleich, deterministische Panel-/Hashprüfung; keine neue Browsermatrix oder Fullsuite.
- Produkt vollständig readonly; kein main-Push, Deploy, Live-Connector, DB-Zugriff oder Aktivieren des Neu-Standards.

## Nachweise und ihre Grenzen

Die Commitangaben bezeichnen den jeweiligen Nachweis, nicht automatisch den aktuellen Gesamtstand. Aktuelle Integrationen ersetzen keine älteren Vollmatrizen. Ein vorhandener grüner Teilnachweis wird nicht erneut als Lücke gezählt.

| Kürzel | Commit / vorhandener Nachweis | Belastbarer Umfang und Grenze |
|---|---|---|
| E1 | `cb3349e8`, V704c; Produktbasis `f704d318` | 108 Alt-Vergleiche gegen unverändertes v801alt; 108 Neu-Bilder, Owner/voll × hell/dunkel ×1440/390. 432 Smokeversuche:408 erreicht,24 erwartete Employee-Verweigerungen. 200 Rohfunde enthalten144 bekannte Fixture-Konsolenmeldungen,16 gesperrte Writes,16 R23-Überläufe,24 Verweigerungen: kein T5-Nullbefund. 14 Proben/358 Tooltests laut Bericht. Bild-/Smoke-Metadaten geprüft, Bilder hier nicht neu gesichtet. |
| E2 | `c8b7dda1`, V704e | 108 vorhandene Neu-Bilder auf12 Kontaktbögen grob gesichtet, acht Demo-SVG-Fälle. Nach Korrektur nur ein Alt-Overview-Fall erneut verglichen, nicht107 andere. Keine vollständige Detail-/Accessibility-Abnahme. |
| E3 | V704a `6d4011b8`; b `03d4aa15`; f `14d18c07`; g `0e386edd`; h `99def44e` | Akte40 Rollen-/Fachbereich-/Theme-/Breitenfälle,84 Aktionsklicks und5 Scopewechsel ohne Reads; Öffner injiziert. Terminpfade24 Fälle,48 erlaubte Aktionen/8 Verweigerungen; Terminöffner injiziert. Doku27 synthetische UI→Writer→Readback-Ersteinträge (11 Anamnese/8 Notizen/8 Fuß), keine Update-/Writer-Race-/Trigger-/RLS-Abnahme; unabhängige3 Browser-/6 VM-Fenceproben für f. g:27 verzögerte1200ms-Roundtrips+3 Normalfälle+64 Regressionen; gemeinsame Harness-Wartezeiten bleiben. h:12 echte Kalender-DOM-Einstiege (8 erlaubt/4 verweigert),30 Tests; Produkt unverändert. |
| E4 | R06 `758df107`; F07 `050a3502`; F08 `2f9ca54d`; F09 `92217e75`; Mahnungen `961d8850`; Ready `52d42ef8`; Verfügbarkeit `c7fcf75e`; Handlungsbedarf `d09ff12e` | Owner-Finanzgate vor Businessreads; Employee/Unknown ohne Altfeedreads, unabhängige Blockzustände/30s/Altstand, Unknown ohne Entwarnung. F07–F09 unabhängig31 Tests auf92217e75 geschlossen; ältere Offen-Texte überholt. Handlungsbedarf140 Tests+6 Scope-Races. Ready nur Schätzung≈, kein Versandbeleg. Verfügbarkeit bleibt begrenzter lokaler Nachweis, DST-Woche Unknown; keine vollständige Buchungsparität. Kein direktes PostgREST-/RLS-/Liveurteil. |
| E5 | V802 `499dbf5d`; Checkbox `cffbe0ee` | Rechnungen/Belegliste/Mahnwesen/Warteliste/Anfragen:20 gefüllte Browserfälle+20 Leerbilder, beide Themes/1440/390,44px/Fokus/Trial-Klick. Checkbox-Name und Space an Originalfragment geprüft, keine Handlerwrites. Keine pauschale Fehler-/Stale-Abdeckung daraus ableiten. |
| E6 | Shell `85eb6e99`, `d287f880`, `4db89840`; Kalender `6810068b`; Listenpilot `e74c96e0`+`f7d7a54d`; Einstellungen `44a46d16` | Vorhandene Tastatur-/Drawer-/Flyoutprüfungen inkl1024/1025, Rollen/Themes; Kalendergeometrie und Verhalten abgeschlossen. Nur Auswirkungen späterer gemeinsamer Änderungen gezielt nachprüfen. Keine neue pauschale Wiederholung. |
| E7 | V10 `6823fa3e`, Kandidatenbasis `53e08f05e5ad70716bc8c9eb719f16a50824c3b1` | Historisch33 VM-Fälle:11 Bootzustände × Basis/Release/Rollback, Patches ausschließlich temporär. Auf aktuellem Quellenpin veraltet:8/9 geschützte Dateihashes abweichend, nur kalender.css gleich. Aktueller Prüflauf bricht vor Tempverzeichnis/Patch mit „HTML-Kandidat veraltet: nach Integration neu erzeugen“ ab. Keine aktuellen33 grünen Fälle. |
| E8 | V209b `aa032d916feadebb7530ee3aeb8c5d2032ab9bb3` | Owner-Dokumentensuche nach bestätigter Auswahl; gemeinsamer Picker/Loader/Renderer, Scope vor Read/Auswahl,30s/Generation, isolierte Leseansicht. Employee behält Patientensuche ohne neue Dokusuchreads.19 Tests,8 geschlossene Browserfälle Alt/Neu×Owner/Employee×hell/dunkel bei900/390;0 Writes/Fehler/Fremdhosts/Überlauf, Suchart106×44. Fullsuite4967pass/1 bestehenderSkip/0fail auf diesem Commit. Nur AltOverview hell1440 erneut pixelgleich. Unabhängiger Commitreview exklusiv Thread5 reserviert, am Quellenpin ausstehend. |
| E9 | V804 Gruppe1 Lieferung `abb3c38a`, Integration `a808a110` | Team/Ärzte/Fahrtenbuch, CSS und Übergabe bytegleich; tatsächlicher Link Cache250.18 Integrationsfälle Owner/Employee×hell/dunkel×390/1024/1440, geprüfte Ziele≥44px,0 Dokumentüberlauf/Writes/Seitenfehler/Fremdhosts. Zwei Alt-Team-Pixelvergleiche identisch, drei Bilder gesichtet,9 Scope-/Auslieferungstests. Keine neue Fullsuite/Vollmatrix. Bs14 Unteransichtsproben und unabhängiger Vorfixreview sind getrennte ältere Liefernachweise. Fahrtenbuch nur leer: keine gefüllte Tabelle/Langdaten/Export/GPS/Save-/vollständige Tastatur-/Kontrast-/Screenreaderabnahme. |
| E10 | V803 Diagnose `ede70f5a`, integriert `8213b7ad` | Nur Bericht integriert, kein Formular-CSS. R23 bestätigt, Ursachen-/Rect-Lücken bleiben. Untracked Formular-CSS unverändert und unfreigegeben. Baustopp bis ausdrücklicher Wiederaufnahme durch Melih; Diagnose hebt ihn nicht auf. |

## Abdeckungsmatrix: alle27 Bereiche

Für jede Zeile gilt E1 als historische gemeinsame Basis für Rollen, hell/dunkel und Desktop/Mobil; E2 ist grobe Neu-Sichtung. Das ist keine vollständige aktuelle Fachbereich-/Zustands-/Tastaturmatrix. Spalte „Rest“ nennt zusätzliche belegte Lücken oder abzugrenzenden Umfang.

Fachbereiche: P=Physio, E=Ergo, L=Logo, D=Podologie, I=interdisziplinär. Angaben folgen `nav-registry.js`, keine neue Berechtigungsentscheidung. `module_visibility` und vorhandene RBAC-Regeln können abweichen. O/E=Owner/Employee gemäß bestehender Freigabe; O*=Registry-Ownerdefault, explizite Employee-Rechte separat prüfen. Nicht sichtbare Panels sind keine automatisch fehlenden Produktfunktionen.

| Panel-ID | Rollen / Registry-Fachbereiche | Zusätzliche Nachweise | Rest am Quellenpin |
|---|---|---|---|
| overview | O/E · PELDI | E4,E6,E8 | Neue Start-/Suchpfade abschließend integrieren; Unknown/Stale und Scope gemäß Querachsen. |
| calendar | O/E · PELDI | E3,E6 | Vorhandene Kalenderabnahme behalten; Verfügbarkeit-/DST-Grenze E4 getrennt. |
| anfragen | O* · PELDI | E5 | Fehler/Unknown/Stale nicht durch20 Listenfälle belegt. |
| kunden | O/E · PELDI | E3,E6,E8 | Akte/Patientenauswahl abgedeckt; Dokusuchreview E8 ausstehend. |
| podologie-billing | O* · D | E3,E4 | V804-Rest; erwartete Employee-Verweigerung kein UI-Fehler. |
| fussstatus | O/E mit bestehendem Recht · D | E3,E10 | V803 offen; fehlende Rect-/Fokus-/Zielgrößenmessungen, Zugang über Akte/Termin. |
| verordnungen | O/E · PELDI | E3,E8 | Altparität vorhandener Renderer; E8-Review, keine neue Abrechnungssemantik ableiten. |
| abrechnung | O* · PELDI | E4 | V804-Rest; Finanzgrenzen und erlaubte/verweigerte Rollen getrennt. |
| rechnungen | O/E gemäß Finanzrechten · PELDI | E4,E5,E8 | Fehler/Unknown/Stale quer prüfen; Dokusuchreview offen. |
| belegliste | O* · PELDI | E5 | Zustands-/Finanzrechte gemäß Querachsen. |
| mahnwesen | O* · PELDI | E4,E5 | Mahnungenmodell vorhanden; Zustandsgrenzen nicht durch reine Listenbilder erledigt. |
| warteliste | O/E · PELDI | E5 | Fehler/Unknown/Stale gemäß Querachsen. |
| ueberblick | O/E · PELDI | E4 | V804-Rest; vorhandener Startlink statt neuer Menüpunkt. |
| anamnese | O/E · PELD | E3,E10 | V803/R23: abgeschnittene Optionen bei390; Zugang über Akte. |
| doctors | O/E · PELI | E9 | Gruppe1 integriert; kein Podologiepanel erzwingen. Vollständige A11y nicht belegt. |
| fahrtenbuch | O/E · PELD | E9 | Gruppe1 integriert; gefüllte/Langdatenansicht und vollständige Tastatur offen. Export/GPS/Save nicht ausgeführt. |
| statistik | O* · PELDI | E4 | V804-Rest; Backend-Finanzgate erhalten. |
| notizen | O/E · PELDI | E3 | Nächste begrenzte B-Gruppe schriftlich zugewiesen, noch kein Liefernachweis; Aktenzugang/Ersteinträge belegt, keine Updates/Writerraces. |
| services | O/E · PELDI | E10 | V803/R23: mainArea300px Überlauf bei390; konkrete Ursache noch nicht isoliert. |
| hours | O/E · PELDI | E10 | V803: Endzeitfeld bei390px Neu/Owner/hell sichtbar rechts gekappt; genaue Rects, weitere Rollen/Themes und Fokus/44px offen. Verfügbarkeit ist eigener Verhaltensnachweis. |
| team | O/E · PELDI | E9 | Gruppe1 integriert; vorhandene18 Fälle nicht wiederholen, vollständige A11y bleibt begrenzt. |
| vorlagen | O* · PELDI | E10 | V803: Rect/Fokus/44px fehlen; keine allgemeine Formular-Sectionnav als fertig werten. |
| settings | O/E · PELDI | E6 | Vorhandene Einstellungenabnahme behalten; gemeinsame CSS-Folgen gezielt. |
| b2b | O/E · PELDI | — | V804-Rest; keine Versand-/Kundenkontaktprobe. |
| b2c | O/E · PELDI | — | V804-Rest; keine Versand-/Kundenkontaktprobe. |
| feedback | O/E · PELD | — | Nächste begrenzte B-Gruppe schriftlich zugewiesen, noch kein Liefernachweis; keine echte Versandprobe. |
| beispielmodus | O/E · PELDI | E2 | Nächste begrenzte B-Gruppe schriftlich zugewiesen, noch kein Liefernachweis;8 Demo-SVG-Fälle begrenzter Teilnachweis. |

## Querachsen: echte Nachweislücken

| Achse | Vorhanden | Fehlende Abnahme / Freigabekriterium |
|---|---|---|
| Rollen/Fachbereiche | E1 Rollenmatrix; E3 fünf Fachbereiche in Akte; Registry deterministisch25 Panels P/E/L,26 D,22 I | Keine27×5-Fachbereich-Vollabnahme behaupten. Pro tatsächlich abweichendem Fachpfad gültige Sichtbarkeit, erlaubter Einstieg und erwartete Verweigerung zuordnen; bekannte identische Pfade wiederverwenden. Ownerdefault nicht mit Backend-Autorisierung verwechseln. |
| Hell/dunkel, Desktop/Mobil | E1 vollständige historische Bilddimensionen; E5/E8/E9 neuere Teilmengen | V803-R23 beseitigt und V804-Rest integriert; danach einmal zentral aktuelle Bild-/Interaktionsfolgen prüfen. Kein erneutes vollständiges grünes Paket pro Agent. |
| Laden/Leer/Fehler/Unknown/Stale | E4 Startblöcke getrennt,30s/Altstand/Unknown; E5 Leerlisten; E3 verzögerte Reads | Für neue/geänderte asynchrone Flächen verbleibende Zustände gezielt zuordnen: sichtbarer Ladeabschluss, echte Leere getrennt von Fehler/Unknown, keine falschen Nullbeträge, verspätete Antwort nach Rollen-/Mandanten-/Standort-/Patientenwechsel verworfen. Keine pauschale Statusvollabdeckung aus Smoke oder Screenshots. |
| Navigation/Tastatur | E6 Shell/Drawer/Flyouts, E3 echte Akten-/Kalenderwege, E5 Checkbox | Geänderte Dialoge/Restpanels: Tabfolge, sichtbarer/unverdeckter Fokus, Enter/Space, Escape/Fokusrückgabe, Scrollzugang. Versteckte Doku-Panels über echten bestehenden Einstieg; keine unerlaubten Menüs hinzufügen.44×44 Projektstandard; WCAG2.1 SC2.5.5 ist AAA, kleine Ziele allein kein pauschaler AA-Befund. |
| Bestehende Kundenzugänge | Historische E7-VM: synthetischer OAuth-/Deep-Link-Query | Aktueller echter Boot ohne erzwungenes Harness-Design: nackte URL, gespeicherte Wahl, Bookmark/Panel/Hash, Login-/Confirm-/OAuth-Rückkehr und PWA. Synthetischer Redirect ist kein echter Auth-/Bestandskundennachweis. |
| Mandant/Standort/Finanzdaten | E3 Scopewechsel, E4 Gates/Races, E8 Bindung vor Read/Auswahl | Neue Diffpfade mit verspäteten Antworten, fehlendem/unklarem Scope und Rechtewechsel prüfen: vor sensiblen Reads fail closed, keine fremden Daten/Nullentwarnung. R06-Gate in `api-backend/billing/api/statistik.routes.js` erhalten. Keine lokale UI-Probe als RLS-/Liveprüfung ausgeben. |
| Befundbearbeitung | E1 Rohfunde klassifiziert, E10 präzisiert | R23 offen halten; bekannte Fixturemeldungen, geblockte Writes und erwartete Denials getrennt von Produktbefunden. Kein „0 Funde“ durch Weglassen oder neue Skips. |

R23 konkret: Anamnese bei390 beide Rollen/Themes: Dokumentüberlauf0, mainArea Alt69/Neu65px; gemessene Options-Rechtskanten421,2656/454,8594 bei mainWidth455, abgeschnittene Medikament-/Allergieoptionen. Rechtskante ist keine Labelbreite. Services: mainArea300px in Alt/Neu; Tabellen-min-width640 innerhalb vorhandener horizontaler Scrollgruppe beweist Ursache nicht. Nach aufgehobenem Baustopp zuerst Rect/clientWidth/scrollWidth von Panel, servicesGrid, gkvCatalogSection, srv-gruppe und Tabelle messen. Übrige Formularfelder benötigen eigene Messungen. Diagnose-/Regex-Ausgabe `[]` ersetzt keine Interaktionsprüfung.

## Spätere Standardumstellung: reviewbarer Vertrag

Bestehende Dateien `V10-UMSTELLUNG.md`, `V10-PRUEFUNG.mjs`, `V10-KANDIDAT.json`, `V10-RELEASE.patch`, `V10-ROLLBACK.patch` bleiben hier unverändert. E7 ist bewusst roter Aktualitätsnachweis. Integrator erzeugt nach V9 einen neuen Kandidaten gegen festen finalen Produktpin; Patchanwendung ausschließlich temporär bis gesondertem Veröffentlichungs-GO.

| Gegenstand | Vor Veröffentlichung konkret nachzuweisen |
|---|---|
| Boot/Query/Storage | Ohne Designquery Neu für frische und bestehende Profile: `px-design` fehlt/alt/neu/unbekannt oder Storage gesperrt. Explizites `?design=neu` Neu, unbekannter Querywert Neu; befristetes `?design=alt` hat Vorrang auch vor gespeichertem Neu/gesperrtem Storage. Theme, Panel-/sonstige Präferenzen unverändert; kein Storagecleanup. Diese Sollzustände sind keine heutige Aktivierung. |
| Befristeter Alt-Ausgang | Eine Woche ab ausdrücklich autorisierter Aktivierung; vor Veröffentlichung Verantwortlichen, konkretes Enddatum und Entferndiff festhalten. Kein erfundenes Startdatum. Globaler Rückfallweg bleibt eigenständig. |
| Kundenwege | Nackte Dashboard-URL, alte Bookmarks, Loginweiterleitung, Onboarding/Confirm, OAuth-Rückkehr, vorhandene PWA-Start-/Shortcut-URLs. Quellhinweise `login.js`, `onboarding.js`, `confirm.html`, `manifest.json` sind nur Routingbelege. Auf beiden Rollen und zulässigen Fachpfaden ohne vorgeschaltete Designwahl prüfen. |
| Cache/PWA | HTML, JS, CSS, dynamische Imports, Versionslinks/Manifest als zusammengehöriges Artefakt pinnen. Frischer Cache und alter Browser-/Memory-/Diskcache, Offline→Online, Teilupdate/Mischversion mit kontrolliertem Wiederanlauf. Kein Serviceworker im aktuellen Quellbaum beweist nicht dessen Abwesenheit in alten Browsern. `vercel.json`-Cachekonfiguration ist kein gemessener Runtimeheader. |
| SaaS | Aktuelle Web-Auslieferung und Updatepfad getrennt belegen; vorhandene Headerkonfiguration allein reicht nicht. Hier kein Deploy/Liveheader-/Kundentest. Keine Onprem-Vertriebsentscheidung aus technischem SaaS-Pfad ableiten. |
| Onprem | `onprem/frontend.Dockerfile` kopiert Dashboard/module/design; Workflow `.github/workflows/publish-frontend.yml` deckt Designpfad ab. Quellenprüfung ist kein gebautes/verteiltes Paket. Kandidatenimage/-digest, enthaltene Hashes, Cache-/Importgraph und synthetisches Install-/Updateverfahren separat belegen; reale bestehende Kundeninstallation bleibt eigener offener Nachweis. Keine Live-DB/Secrets. |
| Sicherer Rollback | Neues Alt-Design-Artefakt auf finalem sicherheitskorrigiertem Code, global auch gegen Query/stored Neu wirksam; Theme erhalten. Kein altes Komplettrelease, Commitrevert, Backend-/Schema-/Datendowngrade. Manifestdiff und negative Tests beweisen: Finanzgate R06, F07/Unknown, Scope-/Antwortbindung und weitere integrierte Sicherheitsfixes bleiben auch im Alt-Design erhalten. Neuer Rollback muss ebenfalls Cache-/Importketten konsistent halten. |
| Prüfung | Neue gepinnte VM-Tabelle Basis/Release/Rollback plus tatsächlicher synthetischer Browserboot; vorhandene11 Zustände um unbekannte Werte und oben fehlende Wege erweitern. VM ersetzt keine Auth-/Cache-/Rollen-/Installationsprüfung. Unabhängiger Review gegen genau diesen Kandidaten und Hashmanifest. |

## Priorität und kürzester sinnvoller Integrationslauf

1. **P0 – Zuständigkeiten erhalten:** V803/R23 bleibt bis ausdrücklicher Wiederaufnahme durch Melih gestoppt. Dann vorhandener Besitzer, kleinste vermessene Korrektur. B bearbeitet als nächste schriftlich zugewiesene begrenzte Gruppe Notizen/Feedback/Beispielmodus; Lieferung/Integration noch offen. Weitere sechs V804-Panels (Statistik, Überblick, Podologie-Billing, Abrechnung, B2B, B2C) bleiben offen. Gruppe1 nicht neu bauen. Exklusiven Thread5-Review für V209b abwarten und konkrete Findings übernehmen; keine zweite Parallelprüfung desselben Commits.
2. **P0 – fehlende Teilabnahmen schließen:** Formular-Rects/Clipping, tatsächliche V804-Restansichten, gefülltes Fahrtenbuch/Langdaten und geänderte Tastatur-/Zustandspfade. Keine echten Writes/Versand/GPS erforderlich, vorhandene synthetische Fences verwenden. V6/V7-Aggregate nur aus konkreten Nachweisen reconciliieren, nicht automatisch grün setzen.
3. **P1 – finaler Integrationspin:** Produktdiff, Status, Dateibesitz, Cache-/Importgraph und Referenzursprung einfrieren. Kleinster Bau → gezielte relevante Tests → höchstens drei Reparaturrunden → enger unabhängiger Review. Bestehende abgeschlossene Teilmatrizen behalten.
4. **P1 – ein zentraler T1–T3-Lauf:** Pflichtgates am selektiven Stage, passende Fullsuite einmal je fertigem Integrationspaket. Keine Assertions abschwächen/neuen Skips. Fullsuite E8 nicht als Ergebnis auf a808a110 ausgeben.
5. **P1 – ein zentraler T4/T5-Abschluss:** Nach tatsächlichen Produktänderungen einmal alle27 Panels mit Referenzherkunft: Alt gegen v801alt; Neu detailliert sichten; Alt/Neu×Owner/Employee×hell/dunkel×1440/390 und vier sequenzielle Smoke-Teile. Fachabweichungen/fehlende Zustände gezielt ergänzen, bestehende E3-Pfade übernehmen. Kein paralleler Fullsuite-/Bildmatrixlauf je Agent. Vollständige bekannte Befundliste bis0 offenem akzeptanzrelevantem Produktbefund führen.
6. **P1 – geschlossene Probeumgebung:** Port mit Integrator abstimmen,18081 nicht übernehmen. HTTP- UND WebSocket-Fences vor Page, reale Writes gesperrt. Basis-Harness allein hat nicht sämtliche nötigen Transportgrenzen; vorhandene geschlossene V704f/h-Wrapper verwenden oder temporären Adapter eng reviewen. Kein ungefencter Standardaufruf.
7. **P2 – spätere Umstellung vorbereiten:** Auf finalem V9-Pin E7-Artefakte durch Integrator neu erstellen, temporäre Anwendung, Boot-/Kundenwege-/Cache-/Rollbackvertrag oben belegen. Lokales V9-Ergebnis nicht als vollständiges T1–T6-/Releaseurteil bezeichnen. T6, echte Kundeninstallation und Veröffentlichung brauchen separate erlaubte Umgebung/Auftrag.

V9 lokal abnahmefähig erst bei abgeschlossenen V8-Abhängigkeiten, aktuellem nachvollziehbarem Integrationsnachweis, erledigtem unabhängigen Review und0 offenen akzeptanzrelevanten Produktbefunden. Spätere Standardaktivierung zusätzlich erst nach aktuellem Umstellungs-/Rollbacknachweis, getrenntem Auslieferungs-/Kundenupdatebeleg und ausdrücklichem GO. Dieses Dokument erteilt keine Freigabe.

## Eigene Prüfung und Übergabegrenze

Ausgeführt: gezieltes Lesen aktueller STATUS-/Übergabe-/V10-Quellen, Abgleich tatsächlicher27 Panel-IDs und Registry-Zuordnung, vorhandener Bild-/Smoke-Metadaten, aktueller neun Kandidatenhashes. `node redesign/V10-PRUEFUNG.mjs` auf a808a110: Exit1 mit erwarteter Veraltungsassertion vor temporärer Patchanwendung. Keine aktuelle grüne Bootprüfung; Produkt unverändert. Deterministische Berichtprüfung:27 eindeutige Matrixzeilen stimmen exakt mit27 HTML-Panel-IDs überein;33 Commitreferenzen auflösbar; `git diff --check` grün. Keine neue Fullsuite, Browsermatrix, Live-/RLS-/Releaseprüfung.

Unabhängiger enger Sol-Berichtsreview: ein P2-Befund zur fehlenden ausdrücklichen Benennung des sichtbar gekappten Endzeitfelds, anhand V803-Übergabe64–72 korrigiert; sonst keine relevanten Findings im begrenzten Quellenabgleich. Kein Review der V209b-Implementierung, keine neue Browser-/Releaseabnahme.
