# Widget-API

Das Widget spricht mit dem bestehenden Backend (`apiBase` aus `/api/config`, SaaS:
`https://n8n.infinitymade.de/api`). Alle Antworten sind JSON. Es gibt **keine** Cookies und keinen
Login; die Zuordnung einer Anfrage zur anfragenden Person läuft über einen Token.

## Abbildung auf die ursprüngliche Spezifikation

| Spezifikation | Umsetzung |
|---|---|
| `POST /api/requests` | `POST /booking-request/create` |
| `GET /api/status/:requestId` | `GET /booking-request/status?request_id=…` mit `Authorization: Bearer <token>` |
| `{name, birthYear, contact?, preferredSlots[]}` | `patient.{vorname,nachname,geburtsdatum,email?,telefon?}`; statt `preferredSlots` das Objekt `widget` (Wochentage, Tageszeiten, flexibel) |

Abweichungen mit Grund:
- **Geburtsdatum statt Geburtsjahr:** die Patiententabelle führt `geburtsdatum date NOT NULL` und
  dedupliziert über `(owner_id, nachname, geburtsdatum)`. Ein Jahr ließe sich nicht abbilden.
- **Zwei Namensfelder statt „Full name":** gleiche Tabelle, getrennte Spalten.
- **Kontakt Pflicht (mindestens eines):** ohne Kontakt kann die Praxis nicht antworten.
- **Keine Wunschtermine als Datum:** Inhaberentscheidung 12.10.2026 — Wochentage und Tageszeit; die
  Praxis legt den Termin beim Bestätigen fest (Server lehnt Bestätigen ohne Datum ab).

## `POST /booking-request/create`

```json
{
  "source": "widget",
  "owner_id": "<uuid>",
  "payment_type": "gkv | pkv | selbstzahler | bg",
  "patient": { "vorname": "Erika", "nachname": "Musterfrau", "geburtsdatum": "1975-04-12",
               "email": "optional", "telefon": "optional" },
  "widget": {
    "anliegen": "rezept | nagelspange | ohne_rezept | unsicher | null",
    "hausbesuch": false,
    "flexibel": false,
    "tage": ["mo", "mi"],
    "tageszeiten": ["vormittag"],
    "dringlichkeit": "asap | wochen | egal | null",
    "erstbesuch": "ja | nein | null",
    "mitteilung": "optional, höchstens 140 Zeichen",
    "anmerkung": "optional, höchstens 80 Zeichen",
    "fuerAndere": false
  },
  "website": ""
}
```

- `website` ist der Honeypot und muss leer sein.
- `anliegen` darf nur bei Podologie-Praxen gesetzt sein; `payment_type` muss zum Anliegen passen
  (Liste in `api-backend/booking/widget-guards.js`).
- `flexibel: true` ersetzt `tage` und `tageszeiten`; sonst sind beide Pflicht (mindestens je ein Eintrag).
- **Der Server baut die Notiz** (`booking_requests.notizen`) aus diesen Feldern und ignoriert einen
  mitgeschickten `notizen`-Text. Freitexte werden von Markup und Steuerzeichen befreit und gekürzt.
  Reihenfolge: Anliegen · Zeit · Wie bald · Schon da gewesen · Mitteilung · Erreichbarkeit.
  Beispiel: `Anliegen: Nagelspange — Hausbesuch\nZeit: Mo, Mi · Vormittag (8–12)\nWie bald: In 2 bis 3 Wochen`.
- `preferred_date` und `preferred_time` bleiben leer.
- Die Benachrichtigungs-E-Mail an die Praxis enthält bei Widget-Anfragen **keinen** Freitext.

Antwort `200`:

```json
{ "id": "<uuid>", "status": "pending", "token": "<32 hex>" }
```

Fehler: `400 {error}` (unvollständig/ungültig) · `429 {error}` (IP-Limit oder Tagesdeckel der Praxis) · `500 {error}`.
Ist die Praxis nicht als Owner buchbar, antwortet das Backend `400 Ungültige Praxis`.

## `GET /booking-request/status?request_id=<uuid>`

Header `Authorization: Bearer <token>` (Token aus `create`). Antwort `200`:

```json
{ "status": "pending | accepted | rejected",
  "confirmedSlot": "2026-10-20T09:30",
  "message": "Ihr Termin wurde bestätigt." }
```

- `confirmedSlot` nur bei `accepted`, Ortszeit Europe/Berlin.
- Nur diese drei Felder. Keine Namen, kein Geburtsdatum, keine Notizen.
- Unbekannte ID **und** falscher Token liefern gleichermaßen `404` (keine ID-Abtastung).
- Abbildung: `approved → accepted` · `declined`, `cancelled → rejected` · alles andere → `pending`.
- Rate-Limit 60 / 5 min je IP. Antwort mit `Cache-Control: no-store`.

## `GET /booking-request/praxis?owner_id=<uuid>`

Liefert, was das Widget für Praxisname und Datenschutzhinweis braucht (RPC `public_praxis_angaben`,
serverseitig — das Widget hat keinen Supabase-Client):

```json
{ "name": "…", "inhaber": "…", "anschrift": "Straße 1, 53721 Siegburg",
  "impressumUrl": null, "datenschutzUrl": null, "vollstaendig": true, "bereich": "podologie" }
```

`vollstaendig: false` (Name oder Anschrift fehlt) → das Widget bleibt gesperrt („noch nicht eingerichtet“).
`bereich` bestimmt, ob die Anliegen-Karten erscheinen (nur Podologie).

## Bekannte Grenzen

- Kein reCAPTCHA (S-06); Schutz = IP-Limit + Praxis-Tagesdeckel + Honeypot.
- `GET /api/patients/lookup` (bestehende Seite `booking-request.html`) verrät die Patienteneigenschaft
  bei bekanntem Nachnamen + Geburtsdatum — **nicht** Teil des Widgets, aber offen (legal-de 11.10.2026).
- Ein Status bleibt nur im selben Browserfenster abrufbar (`sessionStorage`). Danach informiert die
  Praxis per E-Mail/Telefon.
