---
titel: Hetzner, Praxisserver und Ops-Abgleich – Gesprächsstand
typ: sitzung
angelegt: 2026-11-04
tags: [sitzung, onprem, hetzner, praxisserver, ops, nachweis]
---

# Hetzner, Praxisserver und Ops-Abgleich

Eigene Gesprächsnotiz, keine amtliche Quelle und keine Betriebsfreigabe. Hält den Verlauf vom 22./23.10. bis zum Ops-Abgleich am 03.11.2026 fest. Ablage und Push am 04.11.2026 beauftragt.

## Auftrag und bisherige Arbeit

1. Eigenbetrieb auf einem eigenen Hetzner-Server erklären und Funktion prüfen.
2. Für eine kleine Praxis mit altem Server und wenig IT-Personal einen neuen lokalen Server vorbereiten: Hardware, Installation, Sicherung, Betreuung und Datenübernahme analysieren; Agenten und Recherche einbeziehen.
3. Tatsächlich erledigte Ops-Aufgaben abhaken und benennen.
4. Bisherige Ergebnisse in der Wissensbank sichern, committen und pushen.

Hetzner-Anleitung, früherer Push und Migrationskollision sind bereits in [[2026-10-22_hetzner-eigener-server-und-push]] dokumentiert. Der frühere Ops-Gesamtabgleich steht in [[2026-10-22_ops-statusabgleich-und-billing-auth]] und `konsey/tutanak/2026-10-22-ops-statusabgleich.md`. Diese Notiz ergänzt die spätere Beratung und Statuskontrolle.

## Hetzner: gelesen, kein Lauf durchgeführt

Der vorhandene Weg C in `onprem/KURULUM.md` wurde erläutert: eigener x86-Server, Linux, Firewall, Einrichtungscode bzw. eigener Adressweg, TLS, Sicherungsziel und Updatekanal. Historisch genannte Servergrößen und Mindestwerte stammen aus dem damaligen Dokumentstand; keine aktuelle Preis- oder Kapazitätszusage.

In dieser Sitzung wurde weder eine Hetzner-Installation noch ein lokaler Docker-Probelauf ausgeführt. Kein Health-, Zertifikats-, Last-, Backup-/Restore- oder vollständiger Neuinstallationstest. Der frühere Push `ff58303e` ist ein Git-Ereignis und ersetzt diese Tests nicht; nach damaligem Rebase wurden `npm test` und `npm run probe` nicht erneut ausgeführt.

## Lokaler Praxisserver: damalige Empfehlung, keine Abnahme

`onprem` und `legal-de` wurden in der früheren Beratung einbezogen. Empfohlen wurde ein eigener Linux-Rechner nur für die Praxissoftware, den die Praxis selbst kauft. Vorgeschlagene Hardwareklasse: x86-64, 4–6 Kerne, 16 GB RAM, mindestens 500 GB NVMe, verschlüsselte externe Sicherung mit Wechselmedium außer Haus und eine USV. Das waren Planungswerte ohne Kapazitätsmessung oder geprüfte Einkaufsliste.

Vorbereitung mit synthetischen Daten: Betriebssystem und Updates, Docker, BIOS-Wiederanlauf nach Stromausfall, Datenträgerverschlüsselung, Netzwerk- und Sicherungskonzept. Vor Ort: feste Netzadresse, DNS/TLS, Einrichtung, Schlüsselaufbewahrung durch die Praxis, SMTP/Alarmziel und Einweisung. Ein neuer Kundencode wurde hier nicht verwendet; keine Kundendaten übernommen.

Windows/WSL wurde wegen zusätzlicher Betriebsabhängigkeiten (Kontopasswort, Autostart, Schlafmodus, freier Hostspeicher) als weniger passend für wenig IT-Personal bewertet. Auch Linux braucht einen benannten Betriebsverantwortlichen und einen erprobten Wiederanlauf.

Die damalige Rechtsberatung benannte dauerhaften Fernzugriff und Hardwareverkauf als gesondert zu entscheidende Rollen; Vertragsumfang und Gründungsentscheidungen wären vor einer solchen Zusage zu prüfen. Das Gespräch erteilte keine neue Fernwartungs-, Vertrags- oder Rechtsfreigabe. Aussagen zu KBV-Anwendbarkeit, Aufbewahrungsfristen, Entsorgung, ECC und Preisen wurden teilweise nur aus Sekundärquellen oder ohne Primärprüfung abgeleitet und dürfen nicht als belastbare Kundenvorgabe übernommen werden. Insbesondere folgt aus einer fehlenden ECC-Anforderung keine technische Eignungsprüfung.

## Damals benannte offene Nachweise

- Vollständiger Backup-/Restore-Test auf einer synthetischen Testbox; Wiederanlauf nach Neustart und Stromausfall.
- Laufende Health-/Plattenüberwachung und tatsächlich empfangener Testalarm.
- Neuinstallation, Upgrade und geprüfter Stable-Freigabeweg; freie Platte und Image-Aufbewahrung.
- Installation bis zum nutzbaren Konto und plausibler Selbstcheck.
- §302-Empfängerzertifikate, Abrechnungszähler und kontrollierte Datenübernahme ohne Doppelabrechnung.
- Kapazitätsmessung und verbindlicher Support-/Betriebsumfang vor Hardwarekauf und Kundenzusage.

Historische Verweise aus dem Gespräch: O-88, O-115, O-132, O-158, O-170, O-187, O-189, O-192, O-203, O-207, O-208, O-210, O-212 und O-213 in `onprem/REGISTER.md`. Dies ist keine erneute Prüfung ihres aktuellen Lösungsstands. Ein `O-…`-Registerpunkt ist keine gleichnummerierte Ops-Karte.

## Ops: am 03.11.2026 live gelesener Boardstatus

| Ops-Karte | Beobachtung | Grenze |
|---|---|---|
| #34 Cookiebanner-Audit | Checkbox gesetzt, Abschlussdatum 22.10.2026; Notizen enthalten Audit-/Consentnachweise. | Vorhandenen Abschluss bestätigt; Audit hier nicht neu ausgeführt. |
| #340 Unbelegte 84-Tage-Sperre S:01012 | Checkbox gesetzt, Abschlussdatum 23.10.2026. | Vorhandenen Boardstatus bestätigt; Fix/Tests hier nicht erneut abgenommen. |
| #334 Plattenalarm und uptime-kuma | Offen; Teilnotiz nennt geschriebenen, lokal getesteten Diskcheck. | Installation, empfangener Alarm und Kuma-Reparatur nicht belegt. |
| #332 Box-Vorbereitungssprint | Offen; Teilnotiz nennt Integration und Release. | Vollständige Box-/Upgrade-/Stable-Abnahme nicht durch das Häkchen ersetzt. |

Am 03.11. wurden **keine neuen Abschluss-Häkchen gesetzt**: die genannten abgeschlossenen Karten waren bereits markiert. Vorhandene Teilnotizen blieben erhalten. Archiv wurde vorübergehend sichtbar gemacht und anschließend ausgeblendet.

Der lokale SQL-Helfer war wegen fehlender `ops/.env.ops` nicht nutzbar. Deshalb wurde die vorhandene angemeldete Ops-Ansicht gelesen; keine Zugangsdaten ausgegeben oder hinzugefügt. Keine Produktdatenbank, keine Migration, kein Versand und keine Löschung.

## Ablage und weitere Arbeit

Diese Notiz sichert Beratung und Nachweisgrenzen. Sie schließt keine offene Betriebsaufgabe. Aktuelle offene Arbeit bleibt im Ops-Board bzw. zuständigen Register; vor Umsetzung den aktuellen Code-/Registerstand neu prüfen. Keine Installation, kein Hardwarekauf und keine Fernwartung durch diese Dokumentation ausgelöst.
