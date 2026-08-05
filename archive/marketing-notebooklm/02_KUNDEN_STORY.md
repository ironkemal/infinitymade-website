# Eine Woche in der Physio-Praxis Lehmann

> Konkrete Geschichte als Input für Video-Erzählung.
> Personen und Praxis sind fiktiv, der Ablauf entspricht realem Workflow.

---

## Die Praxis

Anna Lehmann führt eine Physiotherapie-Praxis in Köln. Zwei Therapeutinnen arbeiten bei ihr — Max und Sara. Drei Behandlungsräume, etwa 200 aktive Patienten, durchschnittlich 80 Verordnungen pro Monat.

Bisher arbeitete Anna mit theorg für die Praxisverwaltung, DMRZ für die Sammelabrechnung und einer einfachen Excel-Liste für Termine. Sie zahlte 90 € im Monat an theorg, 80 € an DMRZ — plus zwei Prozent Kommission auf jede Abrechnung.

---

## Montag, 8 Uhr — ein neuer Patient

Herr Weber kommt mit Rückenschmerzen. Sein Hausarzt hat ihm ein Muster-13-Rezept ausgestellt: Allgemeine Krankengymnastik, zehn Einheiten, zweimal pro Woche.

Max scannt das Rezept mit dem Telefon. Drei Sekunden später ist das Bestätigungsformular gefüllt: AOK Rheinland erkannt, Versichertennummer übernommen, Heilmittel KG erkannt, Positionsnummer X0501 automatisch zugeordnet. Max prüft kurz, klickt auf Bestätigen.

Im Anschluss legt er gleich zehn Termine im Kalender an — Montag und Donnerstag, jeweils zehn Uhr. Herr Weber unterschreibt das Papierrezept als Empfangsbestätigung der ersten Sitzung und geht zur Behandlung.

Im Dashboard sieht Anna nun in der Termin-Übersicht jeden dieser Slots:
**Weber, Klaus** als Patientenname, **KG · B3** als Heilmittel und Diagnosegruppe, **(1/10)** als Sitzungs-Zähler. Sie weiß auf einen Blick, dass das die erste von zehn Einheiten ist.

## Mittwoch, 14 Uhr — eine Befreiungsbescheinigung

Frau Schulz, eine andere Patientin, bringt ihre jährliche Zuzahlungs-Befreiung von der AOK mit. Sara öffnet ihre Patientenakte, klickt auf Befreiungs-Karte, lädt das PDF hoch, trägt das Gültigkeitsdatum ein.

In dem Moment schreibt die Datenbank automatisch: für alle laufenden Rezepte von Frau Schulz wird der Zuzahlungsstatus auf null gesetzt. Sara muss nichts weiter tun. Bei der nächsten Sammelabrechnung wird die Befreiung automatisch berücksichtigt.

## Freitag, 17 Uhr — die letzte Sitzung von Herrn Weber

Sechs Wochen später hat Herr Weber alle zehn Einheiten abgeschlossen. Max klickt in der Patientenakte auf das Rezept und markiert es als "abrechnungsbereit".

Sofort erscheint das Rezept in der Kassenabrechnungs-Seite, gruppiert unter "AOK Rheinland — 8 Rezepte abrechnungsbereit".

## Sonntag, 11 Uhr — die Sammelabrechnung

Anna setzt sich an den Laptop. Sie öffnet die Kassenabrechnungs-Seite. Drei Krankenkassen-Gruppen sind bereit: AOK mit 8 Rezepten, TK mit 3 Rezepten, BARMER mit 5 Rezepten.

Sie klickt bei der AOK-Gruppe auf **Abrechnung erstellen**. Im Hintergrund passiert Folgendes:

- Eine DTA-Datei nach § 302 SGB V im EDIFACT-Format wird erzeugt
- Ein Begleitzettel mit allen acht Belegen wird als HTML erstellt
- Beide Dateien werden im verschlüsselten Speicher abgelegt

Ein Modal öffnet sich. Anna wählt ihre ITSG/Dakota-Zertifikatsdatei aus, gibt die PIN ein. Die Signatur erfolgt direkt im Browser — der private Schlüssel verlässt ihren Rechner nicht.

Anschließend führt eine Schritt-für-Schritt-Anleitung sie durch das Hochladen ins Davaso-Portal. Sie lädt die signierte Datei herunter, öffnet das DAS-Portal, lädt sie hoch. Zurück im Dashboard markiert sie "Bereits hochgeladen". Status wechselt auf "gesendet".

Sie wiederholt das für TK und BARMER. Insgesamt vergehen siebzehn Minuten. Vor sechs Monaten hätte sie für die gleiche Arbeit fast einen ganzen Sonntagvormittag gebraucht.

## Dienstag der folgenden Woche — die ZAA-Antwort

Die AOK schickt per E-Mail die ZAA-Antwort: keine Fehler, alles akzeptiert. Anna lädt die Datei zurück ins Dashboard. Das System bestätigt: alle acht Rezepte wurden angenommen.

Bei der TK gibt es eine Ablehnung: ein Rezept, Fehlercode MIN91. Im Dashboard wird der Code automatisch übersetzt: "Versichertennummer fehlt oder ungültig". Das Rezept rotiert zurück in den Bereit-Pool. Anna korrigiert die Nummer und nimmt es bei der nächsten Abrechnungs-Runde wieder mit.

## Drei Wochen später — die Zahlung

Die AOK zahlt 1.847 Euro auf das Praxiskonto, ohne Kommissionsabzug. Bei DMRZ wären zwei Prozent — 37 Euro — abgezogen worden.

---

## Was Anna jetzt anders macht als vor InfinityMade

- Drei separate Tools wurden eins.
- Vom Rezept bis zur Auszahlung: ein Workflow im Browser.
- Vier Stunden Sammelabrechnung wurden fünfzehn Minuten.
- DMRZ-Kommission von monatlich 80-150 € wurde null.
- Privater Schlüssel des ITSG-Zertifikats verlässt nie ihren Computer — DSGVO-Compliance unverändert hoch.

Anna zahlt monatlich 108 € (Professional 69 € + DTA-Pro 39 €). Theorg und DMRZ zusammen waren 170 € plus Kommissionen. Die Differenz spart sie. Die Zeit auch.
