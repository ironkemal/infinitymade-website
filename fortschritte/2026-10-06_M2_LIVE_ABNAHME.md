# M2 — Live-Abnahme (QA-Praxis „Podologie Nord“, Stand 06.10.2026)

**Vorbereitung durch Melih:** in `app.praxura.de` als Inhaber anmelden, **Cmd+Shift+R** (hart neu laden — ein offener Tab behält alte Module, `dashboard.js?v=20261006l`). Zweiter Login (Mitarbeiter `qa-mitarbeiter@example.com`, Zugang lokal in `~/praxura-qa/`) nur für Teil C. Der Tester braucht keine PIN und keine Datei; **für den Stempel-Upload legt Melih selbst ein kleines PNG ohne Unterschrift bereit**.

Seed (db-ustasi, 06.10.2026, nur synthetisch, Praxis „Podologie Nord“): Patienten **QA-Privat M2** (privat), **QA-GKV M2** (gkv, ohne Verordnung), **QA-BG M2**, **QA-BG-Pflicht M2**, **QA-Gesperrt M2**; Verordnungen (hinweise „QA-Seed KHS M2 Fall X“): c `20b315e4` privat + 2 offene Behandlungen · d `56915883` BG, alle bg_*-Felder, 2 offene Behandlungen · e `fd87ee7c` BG ohne Träger/Unfalltag, 1 offene Behandlung · f `0179b7c3` privat mit Rechnung **INV-2026-0015** (status sent).

## Prompt für Claude in Chrome (Teil A + B)

```
Du testest die Praxis-Software Praxura live (app.praxura.de, bereits als Inhaber angemeldet, Praxis „Podologie Nord“, nur Testdaten). Gehe ruhig Schritt für Schritt, mache nichts ausserhalb der Aufgaben, tippe keine PINs, lade keine Dateien hoch/herunter. Berichte je Schritt: BESTANDEN / FEHLER (mit Text, den du siehst) / NICHT PRÜFBAR. Löse keine Browser-Dialoge aus, die ein Alert öffnen. Lade die Seite vorher mit Cmd+Shift+R neu.

TEIL A — Bedienung
A1 Verordnungen → Verordnung neu öffnen (Muster-13-Maske). Oben muss eine Leiste „Abrechnung über“ stehen: Kasse (GKV) · Privat (PKV/Beihilfe) · Selbstzahler · BG / Unfallkasse; „Kasse“ ist gewählt, alle Kassenfelder (Krankenkasse, Versichertennr., Diagnosegruppe) sind sichtbar.
A2 Patient „QA-Privat M2“ auswählen → „Privat“ muss von selbst gewählt sein, die Kassenfelder sind eingeklappt, unter der Leiste steht „GKV-Angaben anzeigen“. Klick darauf → Felder erscheinen. Dann Patient „QA-GKV M2“ → bleibt „Kasse“.
A3 Bei „Privat“ eine Diagnosegruppe eintragen (Kassenfelder aufklappen), auf „Selbstzahler“ und wieder auf „Kasse“ wechseln → der Wert ist noch da. 
A4 Wähle „BG / Unfallkasse“ → ein Block „BG-Angaben“ erscheint mit: UV-Träger (Name), UV-Träger (Anschrift), Unfalltag, Aktenzeichen, Kostenzusage (Datum/Zeichen), Einverständnis liegt vor am; „Wortlaut des Einverständnisses“ lässt sich aufklappen. Wähle wieder „Kasse“ → der Block ist weg.
A5 Öffne die bestehende Verordnung 56915883 (Patient QA-BG M2): Art „BG“, alle BG-Felder gefüllt. Ändere das Aktenzeichen, speichern, Seite neu laden → neuer Wert steht da. In der Verordnungsliste (Podologie-Abrechnung) steht bei Verordnung fd87ee7c (QA-BG-Pflicht M2) die gelbe Zeile „Kostenzusage der BG fehlt — vor der Behandlung einholen“; bei 56915883 nicht.
A6 Verordnung 20b315e4 (privat): „Behandlungsanlass“ ändern (Feld im Block „Podologische Angaben“), speichern, neu laden → der Wert ist noch da.
A7 Rechnung aus Verordnung 20b315e4 erstellen (Knopf „Rechnung“): die Zeilen heissen „Podologische Behandlung (Hornhaut und Nägel), Therapiezeit über 20 Minuten“ (oder der Name einer eigenen Leistung der Praxis), NICHT „… (groß)“ und nie „Komplexbehandlung“. Speichern, Rechnung ansehen.
A8 Rechnung aus Verordnung 56915883 (BG) erstellen: Kopf „BG-Rechnung“, Kein Zuzahlungsfeld; in der Ansicht steht oben als Empfänger „BG Test“ mit zwei Anschriftszeilen, darunter „Versicherte Person: QA-BG … (geb. …)“, „Unfalltag: …“, „Aktenzeichen: QA-AZ-2026-0001“; KEINE Diagnose/ICD, keine Krankenkasse.
A9 Verordnung fd87ee7c (BG, ohne Angaben): „Rechnung“ → Fehlermeldung „BG-Rechnung: Es fehlen UV-Träger (Name), UV-Träger (Anschrift), Unfalltag“, es wird keine Rechnung angelegt.
A10 Einstellungen → Praxis-Branding: Feld „Name der Inhaberin / des Inhabers“ vorhanden; Liste „Was fehlt noch?“ zeigt Einträge mit Sprunglinks; in der Kopfleiste oben ein Ring „xx %“ (nur wenn etwas fehlt) — Klick öffnet eine Liste, Klick auf einen Eintrag springt in die Einstellungen; Escape schliesst.
A11 Bei „Praxisstempel“: Hinweis „ohne Unterschrift“ steht da. (Upload macht Melih selbst, siehe Teil C.)

TEIL B — Sperren und Regression
B1 Verordnung 0179b7c3 (QA-Gesperrt M2, Rechnung INV-2026-0015 versendet): in der Maske ist die Leiste „Abrechnung über“ gesperrt (andere Arten ausgegraut) mit Hinweis „Zu dieser Verordnung gibt es eine Rechnung. Bitte zuerst die Rechnung stornieren …“.
B2 Rechnung INV-2026-0015 öffnen: „Bearbeiten“ (falls vorhanden) → Bemerkung ändern → speichern: es darf KEINE Fehlermeldung zur Festschreibung kommen und der Status darf nicht auf „Entwurf“ zurückfallen.
B3 Patientenakte/Verordnungen/Abrechnung/Kalender: normal öffnen, keine roten Fehler in der Konsole (read_console_messages, nur Fehler).
```

## Teil C — macht Melih (oder Tester mit Mitarbeiter-Login)
- C1 Stempel: PNG (ohne Unterschrift) hochladen → Vorschau erscheint; Rechnung INV-2026-0015 ansehen → Stempel unten; „Entfernen“ → weg. Prüfen: Datei liegt im **privaten** Bucket (kein öffentlicher Link).
- C2 Mitarbeiter-Login: Einstellungen → Branding: Felder „Inhaber“ und „Stempel hochladen“ gesperrt + Hinweis „Nur die Inhaberin bzw. der Inhaber …“; Rechnungsansicht zeigt Praxiskopf (Name, Anschrift, IBAN) vollständig; Kopfleiste ohne Ring.
- C3 Mitarbeiter: Verordnung 56915883 → BG-Feld ändern + speichern → klappt über die Maske (Backend); **direkter** Schreibzugriff auf `prescriptions.bg_*` per REST muss 42501 liefern (nur technisch prüfbar — liegt bereits per Rollen-Simulation belegt vor).
- C4 Backend-409: Verordnung 0179b7c3 per Maske auf „Kasse“ speichern (nur wenn die Sperre im UI umgangen wird) → 409 „Zu dieser Verordnung gibt es eine Rechnung …“.

## Nicht live prüfbar (ehrlich)
- Einrichtungsassistent Schritt 4 (`/api/setup/branding`): SaaS hat kein `SETUP_TOKEN`; belegt durch reine Tests + Browser-Probe `setup-probe`. Echte Prüfung gehört in K3 (Box).
- Stempel im Backend-PDF (noch nicht eingebettet), KI-Absatz (aus).
