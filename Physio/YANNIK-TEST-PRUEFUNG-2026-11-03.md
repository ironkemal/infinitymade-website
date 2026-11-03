# Yannik Test — Browserprüfung 03.11.2026

Anlass: Melih bittet um Prüfung der Änderungen aus diesem und den verbundenen Planungschats im Konto „Yannick Test“. Geöffnete Sitzung zeigt „Yannik Test“, Praxis „Physiotherapie Testpraxis“. Keine neue Anmeldung, keine Patientendetails für Prüfung benötigt.

## Aktuell live geprüft

| Bereich | Beobachtung | Grenze |
|---|---|---|
| Dashboard / Aufgaben | Dashboard lädt, Aufgabenformular und leere Aufgabenliste sichtbar | Kein Erstellen/Erledigen/Persistenztest |
| Standortauswahl | Mitte und Nord vorhanden; Wechsel nach Nord lädt Dashboard mit Standort Nord | Keine Zuordnungs-/RLS-Prüfung; Wechsel zurück nach Mitte ausgelöst |
| Raumverwaltung Mitte | Testraum 1 mit einem Platz vorhanden; Bearbeiten/Deaktivieren/Löschen angeboten | Keine Schreibaktion; Beschreibungs-/Ausstattungsfelder fehlen in aktueller Oberfläche |
| Raumkalender | Tag zeigt Therapeut/Raum und Testraum 1; Raumansicht aktiv | Keine Terminbuchung oder Kapazitätsprüfung |
| Wochenkalender | Woche 02.11.–08.11. lädt; vor/zurück kehrt zu dieser Woche zurück | Kein belasteter Race-Test mit echten Terminen |
| Team / Abwesenheit | Nur Inhaber sichtbar; Urlaub/Abwesenheit aufklappbar, Urlaub/Krank/Frei/Elternzeit und Eintragen sichtbar | Kein Mitarbeiter, keine Anstellung, kein Mitarbeiterlogin; keine Abwesenheit gespeichert |
| Einrichtung | 69%; IK fehlt; Einrichtungsanzeige nennt fehlende Steuerangabe, IBAN, Telefonnummer; Praxisstandort für GPS nicht eingerichtet | GPS standardmäßig aus; kein Pflichtfehler der Planung |

## Noch erforderlich

1. Raumfunktion veröffentlichen und ausgelieferten Stand prüfen: lokale Raumdetails/Automatik und Gruppenbuchungsfix `c7a4a56d` sind im aktuellen Checkout noch ungepusht. Neue Felder im Browser fehlen. DB-Migrationen 0103/0104 laut Support-Chat inzwischen angewandt; daher NICHT erneut anwenden. Aktueller Katalogexport/Schema-Nachprüfung und Releaseabschluss dort noch offen. Ältere Abnahmematrix ist in diesem Punkt überholt.
2. Raum-Ausstattung, Leistungsanforderungen, automatische Auswahl, manueller Override und Kapazitätskonflikt im Konto end-to-end prüfen, einschließlich öffentlicher Bestätigung. Ein Testraum mit einem Platz begrenzt automatische Parallelbuchungen; gewünschte reale Raumkapazität klären/einrichten.
3. Test-Mitarbeiter mit bestätigtem Mitarbeiterzugang und Standortzuordnungen benötigt: Anstellung, Urlaubsanspruch/-übersicht, Wochenmuster, Einzeltag und Standortfilter durchprüfen. Vorhandene Inhabersitzung genügt dafür nicht.
4. Speichertests für Aufgaben, Sondertage und Abwesenheit sowie Terminpanelwechsel benötigen kontrollierte synthetische Datensätze; hier nicht durchgeführt.
5. Sondertag-Mail: Vorschau/HTTP-/Fehlerlogik und Tagesquota lokal getestet bzw. früher dokumentiert; echter Versand weiterhin gestoppt. Kein Versandnachweis für dieses Konto.
6. Widget-/öffentliche Buchung und installierte On-prem-Box sind durch diesen Kontodurchgang nicht abgenommen.
7. Für Abrechnung fehlen Kontoeinstellungen, insbesondere IK und Steuerangabe. Bankverbindung/Telefon ergänzen, soweit im Test gewünscht. Keine Abrechnungsprüfung hier.

## Quellen und Grenzen

- Browser: vorhandene gemeinsame Sitzung app.praxura.de, 637×988. Navigation und Lesen; keine Datensätze angelegt/geändert, kein Versand, kein Deploy.
- Support-Chat `93675022-d6f5-4216-970a-47efcf1f54fb`, Nachrichten Position 955–977: Migrationen angewandt gemeldet, Katalogexport danach durch Connectorberechtigung blockiert.
- Release-Chat `3bad516c-8f73-4395-8c4c-1188a9db603f`, Position 1711: Veröffentlichungs-GO vorhanden. Release blieb wegen DB-/Exportübergabe offen; kein neues GO erforderlich aus diesem Bericht.
- Physio/ABNAHME-RESTSTAND.md als bestehende Anforderungsliste, aktuelle Browserbeobachtungen oben gesondert.
- Zwei spätere Browser-Snapshots liefen in Timeout; Standortanzeige und Wechsel wurden anschließend über DOM-Lesen und normale UI-Klicks geprüft. Kein vollständiger Konsolen-/Netzwerkaudit.

Dies ist eine Funktions-/Einrichtungsprüfung der Planungsänderungen, keine Abnahme sämtlicher Praxura-Module. Sichtbarkeit allein beweist keine Speicherung oder korrekte Berechtigungen.
