---
titel: M4 — Fortschritt, Kemal-Übergabe und nächste Schritte
typ: sitzungsnotiz
angelegt: 2026-10-08
tags: [sitzung, praxura, m4, fortschritt, uebergabe]
---

# M4 — Fortschritt und Fortsetzung

Stand: **08.10.2026**. Auf Melihs Wunsch nach Abschluss und erneuter Prüfung als Fortschrittsnotiz gespeichert. Grundlage sind der vorhandene QA-Bericht und die geprüfte Übergabe; beim Speichern dieser Notiz wurden keine neuen Produkttests ausgeführt.

## Erreicht

**M4 ist lokal umgesetzt und erneut geprüft (`✅*`). Kemals lokale Hat-K-Weiterarbeit ist freigegeben.** **Veröffentlichungsabgleich:** Remote `4409428` enthält laut Sprint bereits K2b.7a (`b3da84e6`) und K2b.7b (`82c30d7f`). Der zuvor genannte nächste Auftrag K2b.7a ist überholt. Remote-Code und Boxbetrieb wurden beim Dokumentationspush nicht neu getestet; lokale M4-Nachweise gelten weiterhin für den älteren Checkout `00c0a21`.

| Dokumentierter Nachweis vom 08.10.2026 | Status | Ergebnis |
|---|---|---|
| Gesamtsuite | PASS | 3117/3117: Frontend 1793, Backend 1182, Tools 142. |
| Vollständige Browser-Probesuite | PASS | Lokal mit synthetischen Daten; kein physischer Geräte-/Boxnachweis. |
| Zentraldiensttests | PASS | 48/48; kein Nachweis eines echten KI-Jetonausstellers. |
| Isolierter Vollbackend | PASS | 14/14 HTTP-Prüfungen mit echter lokaler Auth/DB und synthetischen Konten. |
| Typecheck, Funktionskarte, Diff und Packaging | PASS | Lokale Prüfungen bestanden; 19 Manifestdateien. |
| Unabhängiges Review und Freeze-Prüfung | PASS | Kein neuer lokaler Übergabeblocker im geprüften Umfang; 37 Quelldateien unverändert. |
| Freitextqualität | FAIL | Cold-Korpus: 36/156 effektive Restlecks (23,08 %). |
| NER-Übernahme | FAIL | Qualitätsgate und unverändertes Alpine-Ziel verfehlt; NO_NER bleibt. |
| Reale Box, Anbieter, Rechtsfreigabe und Produktion | NICHT GEPRÜFT | Separate Nachweise fehlen. |

Details, Testmethoden und Grenzen: [[2026-10-08_m4-qa-bericht]]. Die erneute Prüfung und die Übergabe wurden durch Code-Review- und Betriebsagenten geprüft. Frühere Planung: [[2026-10-07_m4-analyse-und-plan]].

## Nächste Schritte — Kemal

1. **Kein erneutes K2b.7a/7b:** Diese Arbeiten sind im neueren Remote-Sprint bereits als umgesetzt dokumentiert.
2. **K2b.16 / ORG und O-178:** Rechte-/Lizenzklärung und Sicherheitsentscheidung gemäß aktuellem Sprintprompt; danach „Über diese Software“ umsetzen. Keine Lizenzrechte oder Entscheidungen erfinden.
3. **Hat-K-Vertrag und Integration:** Merkez-/KI-Jetonvertrag lokal mit Fakes vorbereiten; maximal 3600 Sekunden TTL. M4-Code getrennt mit aktuellen Hat-K-Änderungen integrieren und anschließend erneut testen. Der neuere Boxstart verwendet laut Remote `start.mjs`; ältere PM2-Boxannahmen erneut gegen diesen Stand prüfen.
4. **Vor K3:** Offene Geräte-/Boxprüfungen nach §5b tatsächlich durchführen. O-179 Phase 2/T20 erfordert gesonderte Kemal-Freigabe für VPS-Arbeit; sie wird durch diesen Dokumentationspush nicht erteilt.

Verbindlicher Arbeitsauftrag: `KEMAL_M4_UEBERGABE.md`. Technischer Vertrag: `api-backend/ai/M4-VERTRAG.md`. Gesamtplan und Verantwortlichkeiten: `KUTU_HAZIRLIK_SPRINT.md`. Lokaler Browserauftrag: `CHROME-M4-TEST.md`.

## Offene Grenzen

- KI bleibt aus: `AI_MODE=aus`; `AI_ACTIVATION_READY`, `AI_MAIL_READY` und `AI_ALLOW_FREETEXT` bleiben 0. Owner-Opt-in ersetzt keine Betreiber- oder Rechtsfreigabe.
- **Keine Freitext-, Anbieter-, Produktions- oder K3-Gesamtabnahme.** Qualitäts-FAIL bleibt offen. Bekannter Cold-Satz ist Regression; eine spätere Qualitätsfreigabe braucht einen neuen unabhängigen Satz.
- Reale Azure-/Entra-Ressource, Host/Region/Deployment/RBAC, TTL-/Widerrufs-/Quoten-/Budgetvertrag und Microsoft-/Anwalts-/Vertragsnachweise fehlen weiterhin.
- Physische HTTPS-Box, Handygeräte, zwei PM2-Worker unter Boxlast und Ressourcen-/Offlineverhalten sind separat zu prüfen. Offene M3-Geräteabnahme: [[2026-10-07_m3-offene-abnahme]].
- M4-Runtime liegt im gemischten **lokalen, uncommitteten Arbeitsstand**; keine Codeveröffentlichung oder Deployment durch diesen Dokumentationspush. Übernahme nach Verantwortlichkeit und bei gemischten Dateien nach Hunks abstimmen. Ein anderer Checkout erhält M4 noch nicht durch `git pull`.
- Kemals Weiterarbeit ist dokumentiert freigegeben; keine externe Nachricht an Kemal versendet. VPS-Zugriff und Deployment gehören nicht zu dieser Freigabe.

## Wiederaufnahme

Zuerst diese Notiz und den Übergabeauftrag lesen. Arbeitsstand prüfen, fremde Änderungen erhalten. **Mit aktuellem Remote-Sprintprompt fortsetzen; K2b.7a/7b und M4-Implementierung nicht erneut von vorn beginnen.** Nach jeder abgeschlossenen Teilaufgabe Tests und tatsächlichen Stand im Sprint sowie in der Fortschrittsdokumentation nachtragen.
