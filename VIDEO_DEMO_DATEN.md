# Praxura Demo — Musterdaten für Video-Aufnahmen

> Diese Daten während der Aufnahme im System hinterlegen.
> Alle Angaben sind fiktiv und nur für Demo-Zwecke.

---

## Musterpatient (Video 1 + alle anderen Videos)

| Feld | Wert |
|------|------|
| **Name** | Anna Becker |
| **Geburtsdatum** | 15.03.1978 |
| **Krankenkasse** | Techniker Krankenkasse (TK) |
| **Versichertennummer** | A123456780 |
| **Telefon** | 040 / 88 23 41 90 |
| **E-Mail** | anna.becker@example.de |
| **Adresse** | Elbchaussee 47, 22765 Hamburg |

---

## Verordnung (Video 1 — KI-Rezept-Scan)

| Feld | Wert |
|------|------|
| **Verordnungsdatum** | 05.06.2026 |
| **Diagnose (Text)** | Lumbale Rückenschmerzen, chronisch rezidivierend |
| **ICD-10-Code** | M54.5 |
| **Indikationsschlüssel** | WS3a |
| **Heilmittel** | Krankengymnastik (KG) |
| **Anzahl Einheiten** | 10 |
| **Dauer je Einheit** | 30 Minuten |
| **Frequenz** | 2–3× pro Woche |
| **Dringlichkeit** | Dringlich — Erstverordnung |
| **Zuzahlung Patient** | 10 % der Kosten + 10 € Rezeptgebühr |

---

## Verordnender Arzt (im Ärzte-Verzeichnis hinterlegen)

| Feld | Wert |
|------|------|
| **Name** | Dr. med. Stefan Hoffmann |
| **Fachrichtung** | Orthopädie |
| **Praxisname** | Orthopädische Praxis Hoffmann & Partner |
| **Adresse** | Friedensallee 24, 22765 Hamburg |
| **LANR** | 123456789 |
| **BSNR** | 123456700 |
| **Telefon** | 040 / 39 41 23 |

---

## Serientermine (Video 1 — nach dem Scan anlegen)

10 Termine, Präferenz: **vormittags**, Therapeutin: **Sara Yıldız**

| Nr. | Tag | Datum | Uhrzeit |
|-----|-----|-------|---------|
| 1 | Montag | 09.06.2026 | 09:00 |
| 2 | Mittwoch | 11.06.2026 | 09:30 |
| 3 | Freitag | 13.06.2026 | 09:00 |
| 4 | Montag | 16.06.2026 | 09:00 |
| 5 | Mittwoch | 18.06.2026 | 09:30 |
| 6 | Freitag | 20.06.2026 | 09:00 |
| 7 | Montag | 23.06.2026 | 09:00 |
| 8 | Mittwoch | 25.06.2026 | 09:30 |
| 9 | Freitag | 27.06.2026 | 09:00 |
| 10 | Montag | 30.06.2026 | 09:00 |

---

## Therapeutin im Demo-Account

| Feld | Wert |
|------|------|
| **Name** | Sara Yıldız |
| **Rolle** | Therapeutin |
| **Verfügbarkeit** | Mo–Fr, 08:00–13:00 Uhr |

---

## Demo-Privatpatient (Video 5 — Rechnung & Mahnwesen)

| Feld | Wert |
|------|------|
| **Name** | Klaus Richter |
| **Krankenkasse** | Privatpatient |
| **Behandlung** | Manuelle Therapie, 45 Min. |
| **Preis** | 85,00 € |
| **Rechnungsdatum** | 02.06.2026 |
| **Fälligkeitsdatum** | 16.06.2026 |
| **Status für Demo** | Überfällig (Mahnstufe 1 auslösen) |

---

## B2B-Kontakt (Video 10 — KI-Mailassistent)

| Feld | Wert |
|------|------|
| **Firmenname** | Sanitätshaus Bergmann GmbH |
| **Ansprechpartner** | Thomas Bergmann |
| **E-Mail** | thomas.bergmann@sanitaetshaus-bergmann.de |
| **Telefon** | 040 / 77 34 19 20 |
| **Status** | Kontaktiert |
| **Notiz** | Lieferant für Therabänder, Massagerollen, Lagerungskeile |

### Systemprompt (einmalig in Konfiguration eingeben)

```
Du bist der freundliche Assistent der Physiotherapie-Praxis Hoffmann und Partner in Hamburg. Schreibe immer professionell, auf Deutsch, mit persönlichem Ton. Halte E-Mails kurz und klar.
```

### KI-Chatbefehle für die Aufnahme

**B2B:**
> Fragen, ob unsere Bestellung der Therabänder diese Woche noch ankommt.

**B2C — Geburtstag:**
> Geburtstagsnachricht an Anna Becker schicken.

**B2C — Terminänderung:**
> Klaus Richter, sein Dienstagtermin fällt aus, neuen Termin für nächsten Donnerstag vorschlagen.

---

## Demo-Hausbesuch (Video 6 — Fahrtenbuch)

| Feld | Wert |
|------|------|
| **Patient** | Gerda Schumann |
| **Adresse** | Alsterdorfer Str. 88, 22297 Hamburg |
| **Strecke (einfach)** | 7,4 km |
| **Art** | Hausbesuch (GKV) |
| **Datum** | 09.06.2026 |
| **Wegegeld-Pauschale** | wird automatisch berechnet |
