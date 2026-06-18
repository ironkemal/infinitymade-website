# Datenpannen-Runbook — Incident Response Plan

**gemäß Art. 33, 34 DSGVO**

> **ENTWURF — Rechtliche Prüfung erforderlich**
> Dieses Dokument ist ein internes Arbeitsdokument. Vor Einsatz empfiehlt sich
> eine Prüfung durch einen auf Datenschutzrecht spezialisierten Rechtsanwalt.

| Feld | Inhalt |
|---|---|
| **Verantwortlicher** | Yavuz Kemal Demir, InfinityMade, Industriestraße 33, 53721 Siegburg |
| **Produkt** | Praxura — Praxisverwaltungs-SaaS |
| **Version** | 1.0 |
| **Stand** | 2026-06-10 |
| **Zuständige Behörde** | LDI NRW (Landesbeauftragte für Datenschutz und Informationsfreiheit NRW) |
| **Interner Ansprechpartner** | Yavuz Kemal Demir (Geschäftsführer + DSB-Interim) |

---

## 1. Was ist eine meldepflichtige Datenpanne?

Eine **Verletzung des Schutzes personenbezogener Daten** im Sinne von Art. 4 Nr. 12
DSGVO liegt vor, wenn die Sicherheit personenbezogener Daten auf eine Weise verletzt
wird, die zur Vernichtung, zum Verlust, zur Veränderung oder zur unbefugten Offenlegung
personenbezogener Daten führt oder führen kann.

### 1.1 Konkrete Auslösebeispiele für Praxura

| Szenario | Eingestuft als Datenpanne? |
|---|---|
| Supabase-RLS-Bypass: Praxis A liest Buchungen von Praxis B | Ja — Vertraulichkeitsverletzung |
| Service-Role-Key im öffentlichen git-Repository geleakt | Ja — potenzieller vollständiger DB-Zugriff |
| Buchungs-Bestätigungs-E-Mail mit Patientenname an falsche Adresse | Ja — unbefugte Offenlegung |
| VPS kompromittiert, Angreifer hat Zugriff auf Supabase-Credentials in `.env` | Ja — sehr hohes Risiko |
| Google-OAuth-Token aus Supabase Vault extrahiert | Ja — Vertraulichkeitsverletzung |
| Mitarbeiter-Konto nach Kündigung nicht gesperrt, ehemaliger Mitarbeiter nutzt es | Ja — unbefugter Zugriff |
| Accidental delete: Buchungstabelle gelöscht, Backup verfügbar | Ja — Verfügbarkeitsverletzung (meldepflichtig zu prüfen) |
| Sentry erfasst KVNR im Fehlerprotokoll, Sentry-Zugriff kompromittiert | Ja — potenzieller Gesundheitsdatenverlust |
| Stripe-Webhook ohne Signaturprüfung akzeptiert → gefälschte Subscription | Nein als Datenpanne, aber sicherheitsrelevant |
| Praxisinhaber vergisst Logout auf öffentlichem PC | Situationsabhängig — dokumentieren, nicht melden |
| Testdaten im Staging-System (keine echten Patienten) verloren | Nein |

### 1.2 Erkennungsquellen (Detection Triggers)

- **Sentry-Alarm:** Unerwartete Ausnahmen mit Datenbankzugriff, 5xx-Fehler-Häufung,
  ungewöhnliche Abfragemengen
- **Supabase Logs:** Ungewöhnliche SELECT-Volumen über `postgres`-Logs, Auth-Anomalien
  (viele Login-Fehler, Login aus unbekannter IP)
- **Nutzermeldung:** Praxisinhaber berichtet, fremde Patientendaten im Dashboard sichtbar
- **E-Mail-Bounce / Rückmeldung:** Bestätigungs-E-Mail kam beim falschen Empfänger an
- **Hetzner-Alarm:** Unerwartete Netzwerkaktivität auf dem VPS
- **GitHub-Sicherheitswarnung:** Secret im Code-Repository erkannt (Dependabot / Secret Scanning)
- **Eigene Entdeckung:** Entwickler findet Konfigurationsfehler (z.B. öffentlicher Bucket)

---

## 2. Zeitplan und 72-Stunden-Frist (Art. 33 DSGVO)

> Die 72-Stunden-Frist beginnt mit **Kenntniserlangung**, nicht mit dem Zeitpunkt
> des Vorfalls. Auch wenn Details unklar sind: **fristgerechte Erstmeldung ist
> Pflicht — Nachreichungen sind zulässig.**

| Zeit ab Kenntniserlangung | Pflichtaktion |
|---|---|
| **0 h** | Vorfall erkennen und Zeitpunkt notieren; Incident-Log öffnen |
| **0–1 h** | Notfall-Containment: betroffenes System absichern / isolieren |
| **1–4 h** | Forensik-Phase 1: Was wurde betroffen? Welche Daten? Wie viele Personen? |
| **4–24 h** | Risikobewertung: Meldepflicht Art. 33 und Art. 34 prüfen |
| **bis 48 h** | Mitigation implementieren; internen Bericht erstellen |
| **bis 72 h** | **Meldung an LDI NRW** — auch mit Teilinformationen; Folgemeldung ankündigen |
| **bei hohem Risiko** | **Betroffene informieren (Art. 34)** — unverzüglich, spätestens gleichzeitig mit Behördenmeldung |
| **innerhalb 1 Woche** | Post-Incident-Review; TOM/DSFA ggf. anpassen |

**Beispielberechnung:** Entdeckung am Mittwoch um 14:00 Uhr → Meldung spätestens
Samstag um 14:00 Uhr.

---

## 3. Interner Eskalationsweg

Da InfinityMade derzeit ein Einzelunternehmen ohne weitere Mitarbeiter ist,
liegt alle Verantwortung bei Yavuz Kemal Demir.

```
Erkennung (Sentry / Nutzer / eigene Entdeckung)
        |
        v
Yavuz Kemal Demir — Bewertung und Entscheidung
        |
        +--- Kein Risiko für Betroffene?
        |        → Intern dokumentieren (compliance/incidents/), kein Melden
        |
        +--- Risiko für Betroffene (Score > 0)?
        |        → Meldung an LDI NRW (innerhalb 72 h)
        |
        +--- Hohes Risiko (Gesundheitsdaten, KVNR, Diagnosen)?
                 → Zusätzlich: Betroffene informieren (Art. 34) + Auftraggeber (Praxen) informieren
```

**Externer Notfall-Support:**
- Supabase: support.supabase.com (für DB-Isolierung, Key-Rotation, Logs)
- Hetzner: hetzner.com/support (für VPS-Snapshot, Netzwerk-Block)
- Rechtsbeistand (bei schwerwiegenden Vorfällen): Datenschutz-Anwalt hinzuziehen

---

## 4. Sofortmaßnahmen (Containment nach Vorfalltyp)

### 4.1 Supabase-Datenbankvorfall (RLS-Bypass, Service-Role-Key-Leak)

```bash
# 1. Service-Role-Key sofort rotieren
# Supabase Dashboard → Settings → API → "Reset service role key"

# 2. Neuen Key in alle Systeme einpflegen
# Vercel: Dashboard → Settings → Environment Variables → SUPABASE_SERVICE_ROLE_KEY
# VPS: nano /opt/calendar-api/.env → Key ersetzen
# VPS: docker compose restart calendar-api

# 3. Alle aktiven Benutzer-Sessions invalidieren (bei Verdacht auf Account-Übernahme)
# Supabase Dashboard → Auth → Users → "Sign out all users" (nicht produktiv ohne Analyse!)

# 4. Audit-Logs sichern
# Supabase Dashboard → Logs → Postgres (letzte 7 Tage) → als CSV exportieren
# Supabase Dashboard → Logs → Auth → exportieren
```

### 4.2 VPS-Kompromittierung (n8n.infinitymade.de)

```bash
# WICHTIG: Zuerst Snapshot ziehen, dann erst eingreifen (Forensik-Sicherung!)
# Hetzner Cloud Dashboard → Server → Snapshots → "Snapshot jetzt erstellen"

# 2. Netzwerk isolieren (Traffic sperren bis Analyse abgeschlossen)
# Hetzner Firewall: alle eingehenden Verbindungen außer SSH sperren

# 3. Watchtower stoppen (kein automatisches Update während Analyse)
docker compose stop watchtower

# 4. Laufende Prozesse prüfen
ps aux | grep -v "\[" | sort -rk3 | head -20
netstat -tulpn

# 5. Alle SSH-Keys rotieren nach Abschluss der Forensik
# ~/.ssh/authorized_keys ersetzen
```

### 4.3 Falsche E-Mail / Datenweitergabe an falschen Empfänger

1. Falschen Empfänger umgehend telefonisch kontaktieren und zur Löschung auffordern
2. Telefonische Bestätigung der Löschung notieren (Datum, Uhrzeit, Name des Anrufenden)
3. Schriftliche Löschbestätigung per E-Mail anfordern
4. **Achtung:** Eigenes E-Mail-Postfach leeren reicht nicht — die E-Mail liegt
   beim Empfänger und ggf. in Mail-Backups

### 4.4 Google-OAuth-Token-Diebstahl

```bash
# 1. Betroffenes Token aus Supabase Vault löschen
# SQL: DELETE FROM vault.secrets WHERE name = 'google_token_<user_id>';

# 2. Praxisinhaber informieren: soll Google-Konto-Aktivitäten prüfen und
#    ggf. alle App-Zugriffe unter myaccount.google.com/permissions widerrufen

# 3. Google OAuth-Client-Credentials in Google Cloud Console prüfen,
#    ggf. rotieren (Client Secret)
```

---

## 5. Forensik-Checkliste

Folgende Fragen müssen vor der Behördenmeldung so weit wie möglich beantwortet sein.
Bei Unklarheiten: Meldung trotzdem innerhalb 72 h absetzen, Antworten nachreichen.

- [ ] Wann wurde der Vorfall entdeckt? (Datum, Uhrzeit, Zeitzone UTC)
- [ ] Wer hat den Vorfall entdeckt? (Sentry / Nutzermeldung / eigene Entdeckung / Behörde)
- [ ] Wann ist der Vorfall vermutlich eingetreten? (ggf. Zeitfenster aus Logs)
- [ ] Welche Art der Verletzung? (Zugriff / Verlust / Manipulation / unbeabsichtigte Offenlegung)
- [ ] Welche personenbezogenen Daten sind betroffen?
  - [ ] Buchungsdaten (Name, Kontakt, Termin)
  - [ ] Gesundheitsdaten (KVNR, Diagnosen, Heilmittelverordnungen) — **automatisch hohes Risiko**
  - [ ] Zahlungsdaten (Stripe Customer ID, Aboplan)
  - [ ] Mitarbeiterdaten (Profile, Arbeitszeiten)
  - [ ] OAuth-Tokens / Credentials
- [ ] Wie viele Personen sind betroffen? (Kategorie: 1–9 / 10–99 / 100–999 / ≥ 1.000)
- [ ] Wurden Daten tatsächlich exfiltriert oder nur potenziell zugänglich?
- [ ] Ist Mitigation bereits implementiert? (Patch eingespielt / Key rotiert / System isoliert)
- [ ] Handelt es sich um externen Angriff, internen Fehler oder Konfigurationsfehler?
- [ ] Sind andere Auftragsverarbeiter betroffen oder haben beigetragen (Sub-Prozessoren)?

---

## 6. Meldung an die Aufsichtsbehörde (Art. 33 DSGVO)

**Zuständige Behörde (Siegburg liegt in NRW):**

> **LDI NRW — Landesbeauftragte für Datenschutz und Informationsfreiheit NRW**
> Online-Meldeformular: https://www.ldi.nrw.de/datenpanne
> E-Mail: poststelle@ldi.nrw.de
> Telefon: 0211 38424-0
> Postanschrift: Kavalleriestr. 2–4, 40213 Düsseldorf

**Bevorzugter Kanal:** Online-Meldeformular (strukturierte Eingabe, automatisch protokolliert).
Als Backup: E-Mail mit nachfolgendem Formular-Inhalt.

### 6.1 Meldevorlage an LDI NRW

```
Betreff: Meldung einer Datenschutzverletzung gemäß Art. 33 DSGVO — Praxura / InfinityMade

An: Landesbeauftragte für Datenschutz und Informationsfreiheit NRW
    poststelle@ldi.nrw.de

---

MELDUNG EINER DATENSCHUTZVERLETZUNG (Art. 33 DSGVO)

1. VERANTWORTLICHER

Name: Yavuz Kemal Demir
Unternehmen: InfinityMade (Einzelunternehmen)
Anschrift: Industriestraße 33, 53721 Siegburg
E-Mail: kontakt@infinitymade.de
Telefon: [Telefonnummer eintragen]
Datenschutzbeauftragter: Yavuz Kemal Demir (DSB-Interim, kein externer DSB bestellt)

2. ART DER VERLETZUNG

[Zutreffendes ankreuzen / beschreiben:]
[ ] Vertraulichkeitsverletzung (unbefugter Zugriff / Offenlegung)
[ ] Integritätsverletzung (unbefugte Veränderung)
[ ] Verfügbarkeitsverletzung (Verlust / Zerstörung)

Konkrete Beschreibung:
[Sachverhalt in 3–5 Sätzen — was ist passiert, wie wurde es entdeckt, welche Systeme]

Zeitpunkt des Vorfalls (soweit bekannt): [Datum + Uhrzeit UTC]
Zeitpunkt der Kenntniserlangung: [Datum + Uhrzeit UTC]

3. KATEGORIEN UND UNGEFÄHRE ANZAHL BETROFFENER PERSONEN

Betroffene Personengruppen:
[ ] Patienten von Praxen (Kunden unserer Auftraggeber) — Anzahl ca.: ______
[ ] Praxisinhaber (direkte Vertragspartner) — Anzahl ca.: ______
[ ] Mitarbeiter von Praxen — Anzahl ca.: ______

4. KATEGORIEN UND UNGEFÄHRE ANZAHL BETROFFENER DATENSÄTZE

[ ] Buchungsdaten (Name, Termin, Serviceart)
[ ] Gesundheitsdaten: KVNR, Diagnose (ICD-10), Heilmittelverordnungen
[ ] Kontaktdaten (E-Mail, Telefon)
[ ] Authentifizierungs-Credentials (Tokens, Passwort-Hashes)
[ ] Zahlungsdaten

Ungefähre Anzahl Datensätze: ______

5. VORAUSSICHTLICHE FOLGEN

[Beschreiben: z.B. Identitätsmissbrauch durch gestohlene KVNR, Offenlegung
Gesundheitszustand ggü. unbefugten Dritten, finanzieller Schaden durch
Missbrauch von Zahlungsdaten, Reputationsschaden für Praxis]

6. ERGRIFFENE ODER GEPLANTE MASSNAHMEN

Bereits umgesetzt:
- [Maßnahme 1, Datum]
- [Maßnahme 2, Datum]

Geplant:
- [Maßnahme, geplantes Datum]

7. KONTAKTPERSON FÜR RÜCKFRAGEN

Yavuz Kemal Demir
E-Mail: kontakt@infinitymade.de
Telefon: [Telefonnummer]

---
[Hinweis: Bei Unvollständigkeit der Informationen folgt eine Ergänzungsmeldung
innerhalb von [X] Tagen — Referenznummer der Erstmeldung bitte mitteilen.]
```

---

## 7. Beurteilung: Wann ist Art. 34 DSGVO (Benachrichtigung der Betroffenen) erforderlich?

Art. 34 DSGVO verlangt die direkte Benachrichtigung der betroffenen Personen, wenn die
Verletzung **voraussichtlich ein hohes Risiko** für deren Rechte und Freiheiten zur Folge hat.

### 7.1 Praxura-spezifische Risikobeurteilung

| Vorfall | Risiko | Art. 34 erforderlich? |
|---|---|---|
| KVNR oder Diagnose(n) an Unbefugte gelangt | **Sehr hoch** (Gesundheitsdaten Art. 9) | **Ja — immer** |
| ICD-10-Diagnose, Heilmittelverordnung offengelegt | **Sehr hoch** | **Ja — immer** |
| Nur Name + Termin (kein Gesundheitsbezug) an Unbefugte | Mittel | Einzelfallprüfung |
| Praxisinhaber-E-Mail + Praxisname offengelegt | Niedrig–Mittel | Wahrscheinlich nicht |
| Passwort-Hash (Argon2id) ohne KVNR/Diagnose | Niedrig | Wahrscheinlich nicht |
| Vollständiger DB-Dump mit Patientendaten | **Sehr hoch** | **Ja — immer** |

**Faustregel für Praxura:** Sobald Gesundheitsdaten (KVNR, Diagnosen, Verordnungen)
betroffen sind, ist Art. 34 DSGVO **immer** anzuwenden. Keine Ausnahme.

### 7.2 Ausnahmen von Art. 34 (Art. 34 Abs. 3 DSGVO)

Eine Benachrichtigung der Betroffenen ist nicht erforderlich, wenn:
- Die Daten für Unbefugte unlesbar waren (z.B. vollständige Verschlüsselung mit sicherem Key)
- Nachträgliche Maßnahmen das hohe Risiko vollständig beseitigt haben
- Die Benachrichtigung einen unverhältnismäßigen Aufwand erfordern würde → dann
  stattdessen öffentliche Bekanntmachung (in der Praxis bei > 1.000 Betroffenen relevant)

---

## 8. Benachrichtigung der Betroffenen (Art. 34 DSGVO)

**Kanal:** E-Mail (bevorzugt, mit Lesebestätigung) — bei fehlender E-Mail: postalisch.
**Sprache:** Deutsch.
**Ton:** Klar, verständlich, keine Fachbegriffe ohne Erklärung, keine Verharmlosung.

### 8.1 Benachrichtigungsvorlage an Betroffene

```
Betreff: Wichtige Information zum Schutz Ihrer Daten — Praxura / InfinityMade

Sehr geehrte(r) [Vorname Nachname],

wir informieren Sie hiermit über einen Vorfall, der personenbezogene Daten
betreffen kann, die Ihre Praxis ([Praxisname]) über die Praxura-Plattform
verwaltet.

WAS IST PASSIERT?

Am [Datum] haben wir festgestellt, dass [kurze, klare Beschreibung des
Vorfalls in 2–3 Sätzen — z.B. "aufgrund eines Konfigurationsfehlers
Buchungsdaten, die Ihren Namen und Ihre Kassenzugehörigkeit enthielten,
für einen begrenzten Zeitraum für unberechtigte Personen einsehbar waren"].

WELCHE DATEN SIND BETROFFEN?

Möglicherweise betroffen sind folgende Daten von Ihnen:
- [z.B. Ihr Name und Ihre Kassenzugehörigkeit]
- [z.B. Ihre KVNR — dies erlaubt potenziell Identitätsmissbrauch bei Ihrer Krankenkasse]
- [ggf. weitere Angaben]

WELCHE FOLGEN KANN DAS HABEN?

[Ehrliche, konkrete Beschreibung — z.B.: "Mit Ihrer KVNR könnten Unbefugte
versuchen, Ihrer Identität bei Abrechnungsvorgängen zu missbrauchen.
Ihr Behandlungsverhältnis mit der Praxis könnte offengelegt worden sein."]

WAS HABEN WIR UNTERNOMMEN?

Wir haben unmittelbar folgende Maßnahmen ergriffen:
- [Maßnahme 1, z.B. "den Konfigurationsfehler behoben"]
- [Maßnahme 2, z.B. "alle Zugangsdaten zurückgesetzt"]
- [Maßnahme 3, z.B. "den Vorfall der Datenschutzbehörde NRW gemeldet"]

WAS SOLLTEN SIE TUN?

- Bitte informieren Sie Ihre Krankenkasse, falls Sie einen Missbrauch
  Ihrer Krankenversichertennummer vermuten.
- [Ggf.: Bitte ändern Sie Ihr Passwort auf der Praxura-Plattform umgehend.]
- Falls Sie Fragen haben oder weitere Vorfälle bemerken, kontaktieren
  Sie uns bitte unter: datenschutz@infinitymade.de

Wir bedauern diesen Vorfall aufrichtig und haben alle notwendigen
Maßnahmen ergriffen, um eine Wiederholung zu verhindern.

Mit freundlichen Grüßen

Yavuz Kemal Demir
InfinityMade — Betreiber von Praxura
Industriestraße 33, 53721 Siegburg
E-Mail: kontakt@infinitymade.de
```

---

## 9. Benachrichtigung der Auftraggeber (Praxen)

Die betroffenen Praxen (Verantwortliche im Sinne der DSGVO) sind **unverzüglich**
zu informieren, damit diese ihrer eigenen Informationspflicht gegenüber Patienten
und ggf. ihrer eigenen Meldepflicht nachkommen können.

**Inhalt der Praxis-Information:**
- Sachverhalt und betroffene Daten (mandantenbezogen, nur die relevante Praxis erhält Auskunft über ihre Daten)
- Bereits ergriffene Maßnahmen
- Empfehlung, ob Praxis ihrerseits Patienten informieren muss (Art. 34 DSGVO)
- Kontaktdaten für Rückfragen und weitere Weisungen

---

## 10. Interne Vorfallsdokumentation

Auch wenn **keine Meldepflicht** besteht, ist **jeder** Sicherheitsvorfall intern
zu dokumentieren (Art. 33 Abs. 5 DSGVO: Dokumentationspflicht).

Datei anlegen: `compliance/incidents/YYYY-MM-DD-kurzname.md`

```markdown
# Incident YYYY-MM-DD — [Kurzname des Vorfalls]

## Grunddaten
- **Entdeckt:** [Datum, Uhrzeit UTC, durch wen / was]
- **Eingetreten (geschätzt):** [Datum, Uhrzeit UTC oder Zeitfenster]
- **Geschlossen:** [Datum, Uhrzeit UTC]

## Beschreibung
[2–5 Sätze: Was ist passiert, wie wurde es entdeckt]

## Betroffene Systeme
[ ] Supabase (Datenbank / Auth)
[ ] Hetzner VPS (calendar-api, n8n)
[ ] Vercel (Frontend / Serverless)
[ ] Stripe
[ ] Google / OAuth
[ ] Sentry

## Betroffene Personen
- **Anzahl:** [Zahl oder Kategorie]
- **Gruppen:** [ ] Patienten  [ ] Praxisinhaber  [ ] Mitarbeiter

## Datenkategorien
[ ] Kontaktdaten (Name, E-Mail, Telefon)
[ ] Gesundheitsdaten (KVNR, Diagnose, Verordnung)
[ ] Zahlungsdaten
[ ] Credentials / Tokens

## Risikobewertung
- **Wahrscheinlichkeit Schaden:** [ ] keine  [ ] gering  [ ] mittel  [ ] hoch
- **Meldepflicht Art. 33:** [ ] Ja (Meldung erfolgt am _____)  [ ] Nein
- **Informationspflicht Art. 34:** [ ] Ja (Information erfolgt am _____)  [ ] Nein

## Ergriffene Maßnahmen
- [Maßnahme 1, Datum]
- [Maßnahme 2, Datum]

## Meldungen
- **Behörde:** [ ] LDI NRW, Datum: _____, Aktenzeichen: _____
- **Auftraggeber (Praxen):** [ ] Informiert, Datum: _____
- **Betroffene Personen:** [ ] Informiert, Datum: _____, Kanal: _____

## Lessons Learned
[Was war die Ursache? Was hätte es verhindert? Was wird geändert?]
```

Audit-Trail (alle Incident-Dateien) mindestens **3 Jahre** aufbewahren (Art. 33 Abs. 5 DSGVO).

---

## 11. Post-Incident-Review (innerhalb 1 Woche nach Schließung)

Folgende Fragen sind schriftlich zu beantworten und im Incident-Dokument zu ergänzen:

1. **Ursache:** Welcher technische oder organisatorische Mangel hat den Vorfall ermöglicht?
2. **Erkennung:** Hätte der Vorfall früher erkannt werden können? Welcher Detective-Control hat versagt?
3. **Reaktion:** War das Containment ausreichend schnell? Was hat die 72-h-Frist beeinträchtigt?
4. **Wiederholung:** Welche konkreten Maßnahmen verhindern Wiederholung?
5. **Dokumentationsanpassung:**
   - `TOM.md` anpassen falls Sicherheitsmaßnahme versagt hat
   - `DSFA.md` Risikomatrix aktualisieren falls neues Risiko identifiziert
   - `PRE_LAUNCH_CHECKLIST.md` ergänzen falls Maßnahme vor Go-Live fehlte

---

## 12. Kontaktverzeichnis

| Rolle | Person / Organisation | Kontakt |
|---|---|---|
| Verantwortlicher / DSB-Interim | Yavuz Kemal Demir | kontakt@infinitymade.de |
| Datenschutz (extern, bei Bedarf) | [Anwalt eintragen] | [Kontakt eintragen] |
| Aufsichtsbehörde | LDI NRW | poststelle@ldi.nrw.de · 0211 38424-0 |
| Melde-Formular LDI NRW | — | https://www.ldi.nrw.de/datenpanne |
| Supabase Support | — | https://supabase.com/support |
| Hetzner Support | — | https://www.hetzner.com/support |
| Stripe Support | — | https://support.stripe.com |
| Google Cloud Support | — | https://console.cloud.google.com/support |
| Sentry Support | — | https://sentry.io/contact/support/ |

---

*Version 1.0 — Stand 2026-06-10 — Nächste Überprüfung: 2027-06-10 oder nach Vorfall*
