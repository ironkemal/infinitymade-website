# UTC-Datum: enger Live-Nachweis im separaten Physio-QA

04.11.2026, etwa 22:10–22:20 UTC. Inhabersitzung visuell als TEST-Physio QA bestätigt, synthetischer QA Testtherapeut. Geladene Version `dashboard.js?v=20261104urlaubutc`. Kein Janik/Yannik-Konto verwendet. Mail gestoppt, Hetzner ausdrücklich zuletzt.

## Drei reale Browserwriter

| Eingabeweg | Gewählter Zeitraum | POST-Payload start/end | HTTP | Erneute PostgREST-Rückgabe |
|---|---|---|---|---|
| Teamkarte, aufgeklappte Abwesenheit | 01.01.2027, ein Tag | jeweils `2027-01-01T00:00:00Z` | 201 | jeweils `2027-01-01T00:00:00+00:00`, GET200 |
| Mitarbeiterdetail, Urlaub | 31.12.2026, ein Tag | jeweils `2026-12-31T00:00:00Z` | 201 | jeweils `2026-12-31T00:00:00+00:00`, GET200 |
| Kalender, Abwesenheit eintragen | 01.07.2027, ein Tag | jeweils `2027-07-01T00:00:00Z` | 201 | jeweils `2027-07-01T00:00:00+00:00`, GET200 |

Eingabe und Speichern über tatsächliche UI-Handler, keine direkten API-Schreibaufrufe. Temporäre Fetch-Beobachtung erfasste ausschließlich Methode, Status, Start-/Enddatum und Typ der time_offs-Anfragen/-Antworten; keine Header, Tokens oder Kontaktinformationen. Nach vollem Neuladen entfernt.

Mitarbeiterkalender am 01.01.2027 zeigt Ganztags-Abwesenheit. Am 01.07.2027 zeigt er Ganztags-Abwesenheit mit synthetischem Grund TEST UTC Kalender Sommer, auch nach vollständigem Reload und erneutem Tageswechsel (GET200 mit UTC-Datum). Dezemberdatum erscheint nach vollständigem Dashboard-Reload unverändert als 31.12.2026 in der Jahresliste. Drei neue synthetische Abwesenheiten bleiben nachvollziehbar im QA-Konto erhalten; keine Löschung. Vorhandene Termine und andere Abwesenheiten nicht geändert.

## Jahresanzeige und parallele Änderung

Vor Reload zeigte Jahresanzeige 18 Anspruch, 6 verbraucht, 12 übrig: bestehende Woche07.–13.12.2026 mit5AT plus31.12. mit1AT. Nach Reload: 18 Anspruch, 3 verbraucht,15übrig: bestehende Woche3AT plus31.12.0AT.

Originale parallele QA-Übergabe erklärt Ursache: dort wurde Arbeitswoche gezielt von Mo–Fr auf Mo–Mi geändert. Der Donnerstag31.12. ist dann kein Arbeitstag. Deshalb kein Cachebug aus dieser Beobachtung ableitbar; frühere spontane Einschätzung „ein zusätzlicher Tag korrekt“ zurückgenommen. Keine Änderung von Anstellung, Arbeitszeiten oder Standortplan durch diesen Prüfer. Koordination über zusätzliche Datensätze und Schreibstopp an anderen Prüfer übergeben.

Funktionsberater bestätigt frische working_hours-Abfrage ohne Arbeitstage-Cache. Statische Folgehinweise (ungeprüft): fehlende Generationguards bei überlappenden Saldo-Läufen; generischer Mo–Fr-Zähler in Speichertoast/note. Keine Live-Reproduktion oder Fix-Abnahme dieser Hinweise behauptet.

## Grenzen

Nachweis ergänzt isolierte PG-Probe um echte Browserhandler, authentifizierten PostgREST-Schreib-/Leseweg und sichtbare Inhaberanzeige. Kein direktes SQL im Liveprojekt, keine Schema-/Sessionzeitzonenabfrage. Kein negativer RLS-/Fremdmandantenfall und keine Mitarbeiteransicht geprüft; dafür zugehörige separate Mitarbeitersitzung angefragt. Standortplan-/Rechteabnahme beim koordinierten QA-Bearbeiter, Mail/KI beim Support-Bearbeiter. Keine vollständige Planung-/Box-Abnahme aus diesen drei Fällen ableiten.
