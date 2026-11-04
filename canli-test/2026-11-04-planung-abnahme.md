# Planung: gezielte Abschlussabnahme

Stand 04.11.2026. Technische Entscheidungen übernimmt dieser QA-Chat. Umsetzung und Veröffentlichung sind getrennt von funktionaler Kontoabnahme. Mail-STOP und Test-/Datenverbot im ausgeschlossenen Kundenkonto bleiben bestehen. Keine neue Migration nötig oder ausgeführt.

## Neu erhobene Nachweise

- Zwei unabhängige Agenten (Physio-Ablauf und Realitätscheck) prüften ursprüngliche Abnahmekriterien aus Physio/PILOT-PLAN.md, Physio/ABNAHME-RESTSTAND.md und tools/box-standort-abnahme.md. Kein Produktfehler neu belegt.
- Standortplan, Arbeitszeit/Urlaub, Sondertag und Widgeteinbettung gezielt erneut geprüft:115/115 PASS, null Skips. Befehl: `node --import ./tools/test-browser-config.mjs --test module/standort-plan.test.js module/standort-plan-regel.test.js module/standort-plan-laden.test.js module/anstellung.test.js module/mein-urlaub.test.js module/sondertag.test.js module/widget-einbettung.test.js`.
- Box-Prüfer führte `node --test tools/box-standort-abnahme.test.js` aus:8/8 PASS, null Skips; ausschließlich synthetische lokale Adapter. Keine installierte Box bewiesen.
- Auslieferung des integrierten UTC-Fixes neu bestätigt: dashboard.html/js, module/anstellung.js, module/mein-urlaub.js und module/planung-bruecke.js öffentlich über HTTPS geladen, alle bytegleich zum Produktcode unter Dokumentations-HEAD da880dec. Das beweist Auslieferung, keinen erfolgreichen Live-Speichervorgang.
- Ops-Leseversuch wurde vom Connector mit -32600 abgewiesen. Keine neue Live-Statusbehauptung und keine Haken geändert. Browserstatus: keine verfügbare Sitzung. Temporäre Zugangshilfe aus vorheriger Sitzung nicht mehr vorhanden.

## Verbindliche Abnahmekriterien

| Aufgabe | Konkrete Prüfung und erwartetes Ergebnis | Noch fehlende Voraussetzung |
|---|---|---|
| #344 M3 installierte Box | Synthetischer Inhaber und zugehöriges Team an zwei Standorten derselben Rechtsperson; Standortverwaltung und Switcher sichtbar; Berechtigungen trennen Inhaber/Mitarbeiter; nach freigegebenem Neustart Zuordnung und Daten unverändert. RLS/PostgREST wirklich durchlaufen. | Autorisierte installierte Testbox nur mit synthetischen Daten; erlaubter Neustart muss ausdrücklich klar sein. Keine Kundenbox verwenden. |
| #345 M4 Standortplan | Mitarbeiter Mo=A/Di=B, Startdatum der Version setzen; Tag/Woche/Monat an A/B vergleichen. Einzelmontag nach B verlegen; Slots nur am gültigen Standort, Alttermine weiter sichtbar. Neue Version darf Tage vor Stichtag nicht verändern. | Bestätigte separate QA-Praxis, Inhaber- und zugehörige Mitarbeitersitzung. |
| #346 M5 Urlaub | Drei Arbeitstage/Woche und eine Urlaubswoche ergeben drei Tage; Überlappung zählt einmal; Jahresgrenzen stimmen. Nach Neuladen Datum und Saldo erhalten. Inhaber kann speichern, Mitarbeiter eigene Daten nur lesen und fremde Daten nicht sehen. Fehlende/ungültige Arbeitszeiten ergeben keinen erfundenen Saldo;390px ohne abgeschnittene Auswahl. | Gleiche bestätigte QA-Sitzungen, synthetisches Team. |
| #347 M6 Sondertag | Künftiger Schließtag mit bestehendem Testtermin: neue Buchung gesperrt, Alttermin rot und erkennbar in Tag/Woche/Monat; Dialog/Anrufliste nennt nur betroffene Testtermine. Kein Klick auf Versand, kein Verbinden/Konfigurieren eines Mailkontos. | Bestätigte QA-Praxis und synthetische Termine. Echter Versand ist ausdrücklich kein M6-Abnahmekriterium. |
| #348 M7 Widget | Supportkontakt erreichbar, SaaS-/Box-Code zeigt auf richtigen Host. Fremde HTTPS-Einbettung lädt eindeutig bestätigte QA-Praxis. Synthetische Anfrage kommt dort an; kontrollierte Wiederholung darf keine unbemerkte Dublette erzeugen. | Bestätigter QA-Slug und Inhabersitzung; ausschließlich synthetische Empfänger ohne automatische echte Benachrichtigung. |

## Beweiskette pro Kontotest

Vorab Produkt-SHA, Ziel-URL, QA-Zuordnung und Rollen bestätigen, keine Geheimnisse protokollieren. Je Kriterium Schritt, Soll, Ist, Zeit, Screenshot ohne persönliche Daten und Referenz auf synthetischen Vorgang erfassen. Neuladen und Rollenwechsel nachweisen. Unabhängiger Prüfer muss Schritte wiederholen können. Ops erst bei tatsächlichem Nachweis schließen. Infrastrukturfreigabe allein ist keine fachliche Abnahme durch Praxisanwender.

## Nächster Schritt

Nutzer wurde nach Kontobezeichnung oder geöffneter autorisierter QA-Sitzung sowie vorhandener synthetischer Testbox gefragt. Support-Chat wurde nur zur Koordination vorhandener Zugänge/Reservierungen kontaktiert. Bis dahin keine Kontotests, keine Accountanlage oder Testdaten im Kundenkonto. Mail-/KI-Aktivierung bleibt eigener abgegrenzter Auftrag, keine Aufhebung des Mail-STOP durch allgemeine Autonomie.
