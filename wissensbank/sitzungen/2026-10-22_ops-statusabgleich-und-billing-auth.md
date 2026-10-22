---
titel: Ops-Statusabgleich und Billing-Auth — 22.10.2026
datum: 2026-10-22
typ: sitzung
ticket: "Ops #34 / Gesamtbestand / BILLING-AUTH-401-20261022"
tags: [sitzung, ops, statusabgleich, cookie, billing, auth, live-grenze]
---

# Ops-Statusabgleich und Billing-Auth

## Ergebnis

- 336 Ops-Karten einschließlich Archiv erfasst. Ausgang: 269 abgehakt,
  54 offene Einzelpunkte und 13 offene Sammelkarten.
- #34 Cookiebanner-Audit nach Pflichtreview und vorhandener technischer Evidenz
  neu abgehakt. Nach Reload Checkbox gesetzt, Datum 22.10.2026; Parent #119
  korrekt 3/6 und offen. #33/#44 bleiben offen.
- 16 Notizen mit bereits erledigten Teilpaketen und konkreten Restgrenzen ergänzt:
  #17/#24/#33/#34/#40/#44/#131/#132/#290/#291/#332/#334/#336/#337/#338/#339.
- Endstand dieses Abgleichs: 270 abgehakte Karten, 53 offene Einzelpunkte,
  13 offene Sammelkarten. Vollständiges ID-Register enthält jede ID genau einmal.

## Warum nur eine neue Gesamtkarte geschlossen wurde

Vorbereitung, Code, lokale Tests, Auslieferung und echte Betriebsabnahme sind
verschiedene Nachweise. Ein fertiger Diskcheck beweist keinen empfangenen VPS-Alarm;
ein DTA-Vertrag keine persistierte Implementierung; ein Preisstammvergleich keinen
vollständigen Leistungskatalog; ein Release keinen funktionierenden Launchweg.

32 ältere Häkchen nennen ausdrücklich die Übertragung in den Box-Sprint,
drei eine bewusste historische Schließentscheidung. Sie wurden nicht erneut als
heute geprüfte Lieferung ausgegeben. Bereits erledigte Arbeit nicht wiederholt.

## Billing-Auth: Quellfehler und Liveursache getrennt

Live reproduziert: Positionsabrufe und Abrechnungsdetail antworteten 401/Invalid token,
während Listen und öffentliche Backendroute funktionierten. Keine Token gelesen.

Unabhängig davon belegter Quellfehler: Billing reduzierte auch Auth-Netzwerk-/
Gatewayfehler auf 401. Gemeinsame Helper `authFehlerAntwort` und `authTransportFetch`
trennen Infrastrukturfehler (503) von Ablehnung/fehlendem Nutzer (401), vor
fachlichen Reads. 20 Auth-Prüfstellen, drei bisherige Textverträge erhalten.
Lokaler damaliger Nachweis: 110/110 fokussiert, Backend 1612/1612, Typecheck,
Gates und unabhängiger Review erfolgreich. Diese Zahlen gelten für den geprüften
Arbeitsstand und sind keine aktuelle Gesamttestzahl beliebiger späterer Änderungen.

Späterer gemeinsamer Commit `ff58303e` enthält den Authfix. Commit allein beweist
keine Live-Behebung. Tatsächliche Liveursache, bereinigte VPS-Diagnose und erneute
Liveabnahme bleiben offen. Keine Hostkey-Umgehung und keine .env-/Schlüsselabfrage.

## Wiederfinden

- Vollständiger Bericht: `konsey/tutanak/2026-10-22-ops-statusabgleich.md`.
- Tagesverlauf und Tests: `fortschritte/2026-10-21.md`, `fortschritte/2026-10-22.md`.
- Reproduktion: `canli-test/2026-10-22-billing-auth-401.md`.
- Offene Aufgaben selbst: Ops-Board; Wissensnotiz ersetzt keine Aufgabenliste.
- Ops-Wissensbank: Eintrag „Ops-Statusabgleich 22.10.2026 — 336 Karten, Teilabschlüsse und Billing-Auth“.

## Grenzen

Eigene Arbeitsnotiz, keine amtliche Quelle und keine neue juristische Gesamtfreigabe.
Kein Quellenregister-/INDEX-Eintrag. Kein vollständiger neuer Livefunktionstest aller
Archivkarten. Keine Patienten-/Kundendaten oder Zugangsdaten gespeichert.
