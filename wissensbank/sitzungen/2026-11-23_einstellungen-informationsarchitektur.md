# Einstellungen — Informationsarchitektur (Phase 7b, Stufe A)

**Stand 23.11.2026 · Konzept, kein Code.** Auftrag Melih (`prompt-einstellungen-v2.md`): Gruppierung, Platzierung
und Benennung der Einstellungen durchdenken, Lücken schließen, KI-Konfiguration klären. Grundlage:
Bestandsaufnahme aller 28 Abschnitte (Code gelesen, Datei:Zeile in den Agentenberichten), Befragung `physio`,
`podoloji`, `fonksiyon-ustasi`, KI-Bewertung `guvenlik` → `legal-de` → `onprem`, Skills `impeccable shape`,
`design:design-critique`, `design:ux-copy`. Alles Physio-/Podologie-Fachliche ist **Annahme ohne Praxispartner**
(neue Partnerfragen #24/#25 in `Physio/PARTNER-FRAGEN.md`).

Modus nach `impeccable`: **Operate** — Erfolg heißt „finden, ändern, sicher sein, dass es gespeichert ist“.
Wiedererkennbare Muster (Claude Desktop, Linear, Stripe) schlagen Originalität.

---

## 1. Kritik am heutigen Stand (design-critique)

**Gesamteindruck:** Technisch sauber (Bereiche links, Suche, Deep-Link), aber die Bereiche folgen der
*Code-Herkunft* der Abschnitte, nicht dem *Denken der Praxis*. „Allgemein“ ist eine Abstellkammer.

| Befund | Schwere | Empfehlung |
|---|---|---|
| „Allgemein“ mischt Praxisdaten, Branding, Terminerinnerung, Ausfallgebühr, Fußgrafik-Legende, Google | 🔴 | nach Aufgabe trennen: Praxis · Termine · Behandlung · Mein Konto |
| Persönliches und Praxis-Einstellungen vermischt (Passwort neben Paket; Google-Kalender unter „Allgemein“) | 🔴 | Obergruppe **Persönlich** vs. **Praxis** wie Linear/Stripe/Claude |
| „Mitarbeiter & Rechte“ ohne eigenen Abschnitt (nur Sprungknopf) | 🟡 | als Verweis kennzeichnen (↗), nicht als Bereich tarnen |
| „Abrechnung“ enthält Selbstzahler-Preise, „Rechnung“ steht getrennt daneben | 🟡 | Preise zu **Leistungen & Preise**; Kasse/Rechnung/DATEV unter Obergruppe **Abrechnung** |
| „Konto“ = Stripe-Abo + Paket + Passwort; „Konto löschen“ in „Impressum & Datenschutz“ | 🟡 | **Mein Konto** (persönlich) ≠ **Paket & Abo** (Praxis); Löschen in eine Gefahrenzone |
| Mitarbeiter sehen 3 Bereiche mit je einem Abschnitt | 🟡 | ein Bereich **Mein Konto** |
| Viele echte Einstellungen liegen außerhalb (Öffnungszeiten, Räume, Leistungen, Vorlagen, Termin-Anfrage-Automatik, Patientenpost-Absender) | 🟡 | im passenden Bereich verlinken (↗), nicht doppelt bauen |
| Was gut ist | — | eine Navigation, Rollen-/Box-Filter zentral, Suche, Deep-Link, 44-px-Ziele |

### Gefundene Fehler (unabhängig von der Neuordnung, in Stufe B mit beheben)

| # | Fehler | Beleg | Risiko |
|---|---|---|---|
| F1 | **Sprünge landen im ausgeblendeten Bereich** — „Was fehlt noch?“ (Branding) und Einrichtungsring scrollen nur, öffnen den Bereich nicht. **Regression aus meiner Navigation (75c28550), live.** | `branding-ui.js:46`, `dashboard.js:10611` (springe) | Knopf scheint tot |
| F2 | „Rechnungsdaten speichern“ schreibt `ik_number` aus einem Feld eines anderen Abschnitts — ohne Praxis-Fachbereich nicht vorbelegt → IK wird auf leer gesetzt | `dashboard.js:11419`, `abrechnung-einstellungen.js:90` | Datenverlust (praktisch nur Nicht-Heilmittel-Sektor) |
| F3 | KIM-Adresse/Telematik-ID von **drei** Knöpfen gespeichert (Profil, Rechnung, TI) | `dashboard.js:11398/11420/11433` | stille Überschreibung |
| F4 | IK-Sprungziel falsch (`settingsBillingSection` statt `settingsAbrechnungSection`) | `branding.js:124` | Sprung ins Leere |
| F5 | Systemstatus zeigt im Netzwerkfehler „nicht abrufbar“ auch auf SaaS | `systemstatus.js:100` | Verwirrung |
| F6 | Fax-Versand und „App für Mitarbeiter“ ohne Box/SaaS-Prüfung (Fax geht laut eigenem Text nur auf der Box) | `fax-einstellungen.js:97` | toter Abschnitt im SaaS |
| F7 | Ärzteregister doppelt (Panel „Ärzte“ + Einstellungen) | `dashboard.js:12896–12900` | zwei Einstiege |

---

## 2. Vorbilder (Muster, aus Produktkenntnis, Stand 2026)

| Produkt | Gruppierung | Was wir übernehmen |
|---|---|---|
| **Claude Desktop / claude.ai** | Allgemein · Konto · Datenschutz · Abrechnung · Funktionen/Konnektoren | flache Liste, ein Bereich = eine Seite; Konnektoren/Integrationen dort, wo sie wirken |
| **Linear** | Obergruppen **Account** (Profil, Einstellungen, Benachrichtigungen, Sicherheit) vs. **Workspace** (Allgemein, Mitglieder, Abrechnung, Integrationen, API) | **Persönlich ↔ Praxis** als erste Trennung; Rolle bestimmt, ob Workspace sichtbar ist |
| **Stripe Dashboard** | Persönlich · Konto/Unternehmen · Produkt-Einstellungen (Zahlungen, Billing …) · Team & Sicherheit | Abrechnung als eigene Obergruppe; Gefährliches (Konto schließen) abgesetzt am Ende |
| **Notion** | My account · My settings · Workspace (General, Members, Billing, Security) | „Mein Konto“ zuerst, für jede Rolle gleich |
| **Doctolib / Praxissoftware** | Praxis · Kalender & Online-Buchung · Team · Abrechnung | Termine & Online-Buchung als eigener Bereich — dort denkt die Empfangskraft |

**Gemeinsame Regeln:** 1) Persönlich vor Organisation. 2) Bereiche nach Aufgabe, nicht nach Technik.
3) Rolle blendet ganze Obergruppen aus statt leerer Seiten. 4) Gefahrenzone (Löschen, Kündigen) rot, am Ende
des Bereichs, mit Bestätigung. 5) Verweise in andere Programmteile als Verweis erkennbar (↗).

---

## 3. Zielstruktur

Obergruppen erscheinen in der Navigation als kleine Überschrift, Bereiche als Einträge.
Namen nach `ux-copy`: kurz, Praxissprache, Substantiv, keine Technikbegriffe („KI“ ist inzwischen Alltagswort).

### PERSÖNLICH
| Bereich (Deep-Link) | Abschnitte | Begründung des Namens |
|---|---|---|
| **Mein Konto** (`konto`) | Anmeldung & Passwort · Mein Google-Kalender · *neu:* Mein Profil (Anzeigename, Foto) | „Mein“ macht klar: gilt nur für mich, auch für Mitarbeiter |

### PRAXIS
| Bereich | Abschnitte | Begründung |
|---|---|---|
| **Praxisdaten** (`praxis`) | Praxisname & Anschrift (heute „Profil“) · Standorte (heute „Geschäfte“) · Datenfreigabe zwischen Standorten | „Profil“ klang persönlich, „Geschäfte“ ist Fremdbegriff aus der KOBI-Zeit |
| **Termine & Online-Buchung** (`termine`) | Terminerinnerung · Ausfallgebühr & Absagefrist · Online-Terminseite: Impressum & Datenschutz · ↗ Öffnungszeiten & Räume · ↗ Termin-Anfragen automatisch annehmen | dort sucht die Empfangskraft (physio, podoloji, Doctolib-Muster) |
| **Leistungen & Preise** (`leistungen`) | Selbstzahler-Preisstufen · ↗ Leistungen verwalten | Preise sind bei Privatpatienten eine Preis-, keine Kassenfrage (podoloji) |
| **Behandlung & Dokumentation** (`dokumentation`) | Eigene Formulare · Legende der Fußgrafik *(nur Podologie)* | podoloji: man sucht nach Tätigkeit; kein Abstellraum „Podologie“ |
| **Briefkopf & Belege** (`briefkopf`) | Logo, Fußzeile, Inhaber/in, Stempel (heute „Praxis-Branding“) · ↗ Dokument-Vorlagen | „Branding“ ist Marketingwort; Praxis denkt „Briefkopf“ |
| **Team** (`team`) | ↗ Mitarbeiter & Berechtigungen · App für Mitarbeiter | Verweis klar als Verweis; „Rechte“ steckt im Verweistext |

### ABRECHNUNG
| Bereich | Abschnitte | Begründung |
|---|---|---|
| **Krankenkasse** (`kasse`) | Kassenabrechnung (§ 302): IK, Zertifikat, Betriebsart · Telematikinfrastruktur (TI) | trennt GKV klar von Privatrechnung |
| **Rechnung** (`rechnung`) | Bank & Steuer (heute „Rechnungsdaten“) | Pflichtangaben für jede Rechnung |
| **Buchhaltung** (`buchhaltung`) | DATEV-Export · Buchungskonten | „DATEV“ als Name schließt Praxen ohne DATEV aus |

### KOMMUNIKATION
| Bereich | Abschnitte | Begründung |
|---|---|---|
| **E-Mail & Fax** (`kommunikation`) | E-Mail-Versand · Fax-Versand *(nur Box)* · ↗ Absender für Patientenpost | beides „Post an Patienten/Ärzte“ |

### SYSTEM & DATENSCHUTZ
| Bereich | Abschnitte | Begründung |
|---|---|---|
| **KI-Unterstützung** (`ki`) | siehe Kapitel 6 | eigener Bereich, weil rechtlich und technisch eigen |
| **Datenschutz** (`datenschutz`) | Daten exportieren · Datenquellen · **Gefahrenzone:** Konto & Daten löschen | Löschen gehört nicht neben „Impressum“ |
| **Paket & Abo** (`abo`) | Paket, Status, Abo verwalten · Paketinhalt *(nur SaaS; Box: Lizenzhinweis)* | Abo ist Praxissache, nicht „mein Konto“ |
| **System** (`system`) | Systemstatus *(nur Inhaber + Box)* | unverändert |

**Ärzteregister:** aus den Einstellungen herausnehmen und durch ↗ Ärzte ersetzen (Arbeitsbereich laut
physio/fonksiyon-ustasi, F7). **Entscheidung Melih** (Frage 3).

### Zuordnung alt → neu (jeder heutige Abschnitt)

| Heute (Gruppe · Titel · ID) | Neu (Bereich · Titel) |
|---|---|
| allgemein · Profil · `settingsProfileSection` | Praxisdaten · Praxisname & Anschrift |
| allgemein · Praxis-Branding · `settingsBrandingSection` | Briefkopf & Belege · Briefkopf & Logo |
| allgemein · Terminerinnerung · `settingsTerminerinnerungSection` | Termine & Online-Buchung · Terminerinnerung |
| allgemein · Ausfallgebühr · `settingsAusfallSection` | Termine & Online-Buchung · Ausfallgebühr & Absagefrist |
| allgemein · Legende der Fußgrafik · `settingsLegendeSection` | Behandlung & Dokumentation (nur Podologie) |
| allgemein · Integrationen (ohne ID) | Mein Konto · Mein Google-Kalender (bekommt ID `settingsGoogleSection`) |
| recht · Datenschutz (DSGVO) · `settingsDsgvoSection` | Datenschutz · Daten exportieren + Gefahrenzone |
| recht · Datenquellen · `settingsQuellenSection` | Datenschutz · Datenquellen |
| recht · Impressum & Datenschutz Ihrer Online-Terminseite · `settingsRechtslinksSection` (JS) | Termine & Online-Buchung · Online-Terminseite: Impressum & Datenschutz |
| team · App für Mitarbeiter · `settingsMitarbeiterAppSection` (JS) | Team · App für Mitarbeiter |
| team · Mitarbeiter & Berechtigungen · `settingsTeamLinkSection` (JS) | Team · ↗ Mitarbeiter & Berechtigungen |
| standorte · Geschäfte · `settingsBusinessesSection` | Praxisdaten · Standorte |
| standorte · Datenfreigabe · `settingsDataSharingSection` | Praxisdaten · Datenfreigabe zwischen Standorten |
| dokumente · Ärzte · `aerzteSection` | ↗ Ärzte (Frage 3) — Abschnitt bleibt bis zur Entscheidung, nur verschoben nach Kommunikation |
| dokumente · Fax-Versand · `settingsFaxSection` (JS) | E-Mail & Fax · Fax-Versand (nur Box, F6) |
| dokumente · Eigene Formulare · `settingsFormulareSection` (JS) | Behandlung & Dokumentation · Eigene Formulare |
| dokumente · E-Mail-Versand · `settingsMailversandSection` (JS) | E-Mail & Fax · E-Mail-Versand |
| datev · DATEV-Export · `settingsDatevSection` | Buchhaltung · DATEV-Export |
| datev · Buchungskonten · `settingsKontenSection` | Buchhaltung · Buchungskonten |
| abrechnung · Abrechnung (Krankenkasse) · `settingsAbrechnungSection` | Krankenkasse · Kassenabrechnung (§ 302) |
| abrechnung · TI · `settingsTiSection` | Krankenkasse · Telematikinfrastruktur (TI) |
| abrechnung · Selbstzahler-Preisstufen · `settingsPreisstufenSection` | Leistungen & Preise · Selbstzahler-Preisstufen |
| rechnung · Rechnungsdaten · `settingsBillingSection` | Rechnung · Bank & Steuer |
| ki · KI-Unterstützung · `settingsKiSection` | KI-Unterstützung |
| system · System · `settingsSystemSection` | System |
| konto · Konto · `settingsAccountSection` | Paket & Abo · Paket & Status |
| konto · Paketinhalt (ohne ID) | Paket & Abo · Paketinhalt (bekommt ID `settingsPaketSection`) |
| konto · Passwort (ohne ID) | Mein Konto · Anmeldung & Passwort (bekommt ID `settingsPasswortSection`) |

28 von 28 zugeordnet. IDs bleiben; drei Abschnitte ohne ID bekommen eine (nur Attribut, Handler unverändert).
**Alte Deep-Links:** `allgemein→praxis`, `recht→datenschutz`, `standorte→praxis`, `dokumente→kommunikation`,
`datev→buchhaltung`, `abrechnung→kasse`, `ki/system/konto/team/rechnung` bleiben.

---

## 4. Neue Abschnitte (Lücken)

| Abschnitt | Zweck | Felder | Speicherort | Sichtbar | Aufwand | Stufe |
|---|---|---|---|---|---|---|
| Mein Profil | Anzeigename, Foto für Mitarbeiter selbst | Name, Foto | eigene `profiles`-Zeile (Avatar-Weg existiert im Team-Detail) | alle | S | B |
| Verweise ↗ | Öffnungszeiten & Räume, Leistungen, Vorlagen, Termin-Anfrage-Automatik, Patientenpost-Absender, Ärzte | Knopf + 1 Satz | — | je Zielrecht | S | B |
| Gefahrenzone | Konto & Daten löschen abgesetzt | — | bestehende DSGVO-Logik | Inhaber, SaaS | S | B |
| Terminraster / Takt | 20/30-Min-Raster, Puffer | Takt, Puffer | **neue Spalte** (`db-ustasi`, Migration) | Inhaber | M | später, Partnerfrage #24 |
| Recall-Standard | Wiederbestellintervall 4–6 Wo. (Podologie, PE-008 beachten) | Wochen | neue Spalte | Inhaber | M | später |
| Serien-Vorgaben | gleiche Therapeut:in/Uhrzeit, 2×/Woche | 3 Schalter | neue Spalte | Inhaber | M | später |
| Fahrtpuffer Hausbesuch | Kalenderblock vor/nach HB | Minuten | neue Spalte | Inhaber | M | später (`gkv-302` zur Pauschale) |
| Nummernkreise | Rechnungs-/Quittungsnummer sehen/startwert | Präfix, nächste Nr. | `nummernkreise` (vorhanden, nur Trigger) | Inhaber | M | später |

Nicht neu bauen: **Zertifikate je Therapeut:in** gibt es schon im Team-Reiter (`loadEmpCertificates`,
`dashboard.js:9826`) — nur verlinken. Hygiene-Dokumentation ist ein Ablauf, keine Einstellung (podoloji).

---

## 5. Sichtbarkeitsmatrix

✓ sichtbar · – ausgeblendet · P = nur Podologie · B = nur Box · S = nur SaaS · E = Enterprise/mehrere Standorte

| Bereich / Abschnitt | Inhaber SaaS | Inhaber Box | Mitarbeiter SaaS | Mitarbeiter Box |
|---|---|---|---|---|
| Mein Konto: Passwort, Profil | ✓ | ✓ | ✓ | ✓ |
| Mein Konto: Google-Kalender | ✓ | – | ✓ | – |
| Praxisdaten: Name & Anschrift | ✓ | ✓ | – | – |
| Praxisdaten: Standorte, Datenfreigabe | E | ✓ (Box = E) | – | – |
| Termine & Online-Buchung | ✓ | ✓ | – | – |
| Leistungen & Preise | ✓ | ✓ | – | – |
| Behandlung: Formulare | ✓ | ✓ | – | – |
| Behandlung: Legende Fußgrafik | P | P | – | – |
| Briefkopf & Belege | ✓ | ✓ | – | – |
| Team | ✓ | ✓ | – | – |
| Krankenkasse | Heilmittel-Sektor | Heilmittel-Sektor | – | – |
| Rechnung, Buchhaltung | ✓ | ✓ | – | – |
| E-Mail-Versand | ✓ | ✓ | – | – |
| Fax-Versand | – | ✓ | – | – |
| KI-Unterstützung | ✓ | ✓ | – | – |
| Datenschutz: Export, Quellen | ✓ | ✓ | Quellen | Quellen |
| Datenschutz: Gefahrenzone | ✓ | – (Box löscht anders) | – | – |
| Paket & Abo | ✓ | Lizenzhinweis | – | – |
| System | – | ✓ | – | – |

Physio-only und Podologie unterscheiden sich nur bei der Fußgrafik-Legende (und künftig Recall). Mitarbeiter
sehen genau **einen** Bereich (Mein Konto) plus Datenquellen — die Obergruppen Praxis/Abrechnung/… entfallen ganz.
Die Rollensperre bleibt zusätzlich auf Formular-/Serverseite zu prüfen (Bestand F: Profil- und Rechnungs-Handler
haben keine eigene Rollenprüfung, schreiben aber nur in die eigene Zeile — kein Leck, nur Verwirrung).

---

## 6. KI-Unterstützung — gestufte Lösung

Bewertet nacheinander von `guvenlik` (bedingtes Veto 1+4), `legal-de` (⚠/VETO SaaS) und `onprem`
(Ergebnis unten). Beide ersten sind sich in der Stufung einig.

**Stufe 1 — sofort, ohne Veto, ohne Migration (Teil von Stufe B):**
- Status verständlich: „aus — weil …“ (`AI_MODE_AUS`, `AI_INVALID_REGION`, `AI_OCR_DISABLED` in Klartext).
- Aufgaben einzeln an/aus (Serienplanung, Mailentwurf …) — **nur zusätzlich sperren, nie freischalten**;
  Betreiber-Schalter `AI_ACTIVATION_READY`/`AI_MAIL_READY` bleiben unantastbar (`ki-config.js:12`).
- Anbieter und Region **nur lesend** anzeigen („Microsoft Azure, Region Schweden-Mitte, EU“).
- „Einwilligung des Praxisinhabers“ → **„Freischaltung durch den Praxisinhaber“** (legal-de: keine
  Rechtsgrundlage, `ki-einstellungen.js:54/98`).
- Hinweis „KI-Vorschlag — vor Verwendung prüfen“.

**Stufe 2 — erst nach `/konsey` + Melihs GO (Migration, neues Secret):**
- **nur Box**, nur **Datenklasse A** (strukturierte Felder ohne Freitext); B/C und OCR bleiben gesperrt
  (pii-mask lässt 23 % durch, M4-SEC-03).
- Reihenfolge laut legal-de: **lokales Modell** zuerst (keine Übermittlung, nur Apache-2.0-Modelle), dann
  **Azure EU BYOK** (Standard-Deployment EU-Region; Praxis schließt AVV + § 203-Verpflichtung selbst).
  Mistral erst mit C5-Nachweis und § 203-Klausel. US-Anbieter direkt: nein.
- Anbieter aus **fester Liste**, Praxis gibt nur Ressourcennamen ein (`RE_SAFE_SEGMENT`), Regionsangabe mit
  Bestätigung. **Kein Freitext-Endpunkt** (SSRF/Ausleitung, guvenlik ⛔).
- Schlüssel: `encryptPHI` (AES-256-GCM) in **eigener Tabelle ohne Client-Lese-Policy**, nie in `profiles`
  (anon lesbar bei `booking_slug`), nie im Browser, nie in Logs/Sentry/ki-audit (vorher Test). Nur schreiben,
  Anzeige `••••1234`, ersetzen/löschen jederzeit.
- „Verbindung testen“: nur Backend, fester synthetischer Ping, Antwort nur ok/Fehlercode, eigenes Rate-Limit.
- Nur Inhaber, serverseitig geprüft, Re-Auth beim Ändern, Audit (wer, wann, Host, letzte 4 Zeichen), Mail an
  Inhaber. Hinweistexte beim Aktivieren (AVV selbst, § 203, § 393/C5, pseudonymisiert ≠ anonym).
- Praxis-Bausteine: Art.-13-Text, DSFA-Baustein, Checkliste (legal-de, 1–2 Tage). Anwaltsfrage (~0,5 h).

**Gesperrt (kein Plan):** BYOK im SaaS (Praxura würde wieder Auftragsverarbeiter), Freitext-Endpunkt,
Nicht-EU-Anbieter, Schlüssel im Browser/`profiles`, KI-Vorschläge zu Frequenz/Heilmittel (MDR IIa).

**onprem (kein Sofort-Veto, G2 + Freitext-Endpunkt ⛔):**
- BYOK = bestehender Modus `direkt`, nur Quelle DB statt `.env` — **Zusatz** zum Jeton-Weg (O-169), kein Ersatz.
  Vorrang: Box-Standard `aus` → `jeton` (Produktweg) → `direkt`/BYOK nur mit Betreiber-Schalter (z. B.
  `AI_BYOK_ALLOWED=1`). **Env gilt vor DB** (Notabschaltung per `.env`). Unser eigener Schlüssel nie in die DB (G2).
- G8 ✅ (lokales Postgres + Express). Neue Tabelle = Typ D (Migration, `klassifikation.js` Klasse Geheimnis,
  abwärtskompatibel zu `:stable`). Backup enthält den Schlüssel verschlüsselt mit `DATA_ENCRYPTION_KEY`;
  `phi-encrypt.js` kann nicht rotieren → nach Schlüsselwechsel Neueingabe nötig.
- Eigene Host-Regel `<ressource>.openai.azure.com` + `RE_SAFE_SEGMENT` + EU-Region, darf nie auf den Jeton-Weg
  durchschlagen (`VERIFIED_AZURE_HOSTS` bleibt fix). Backend-Ruf: Caddy-CSP und Firewall unberührt.
- **Lokales Modell: schwach realistisch** (7–8B Q4 ≈ 5 GB, 8 GB+ RAM, CPU langsam; Freitext-Korpus fiel schon mit
  GPT durch 36/156; Modelllizenzen prüfen; nur als optionales Compose-Profil) → eigene spätere Phase.
- **Achtung Stufe 1:** „Aufgaben an/aus“ braucht eine Owner-Spalte in `profiles` → kleine Migration über die
  Kette (Datei → Dumps → live nur mit GO). Reine Anzeige (Modus, Region, Grund) geht ohne Migration.

**Widerspruch → `/konsey` vor Stufe 2:** `legal-de` will das **lokale Modell zuerst** (rechtlich sauberste
Lösung, keine Übermittlung), `onprem` hält es auf heutigen Boxen für **kaum tragfähig** und sieht Azure-EU-BYOK
als nächsten realistischen Schritt. Das ist eine Richtungsentscheidung (Recht vs. Betrieb/Hardware/Qualität).

---

## 7. Mockups

### Desktop (1280 px, Inhaber Box)

```
┌ Einstellungen ───────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────┐  ┌───────────────────────────────────────────┐ │
│ │ 🔍 Einstellungen durchs… │  │ Termine & Online-Buchung                  │ │
│ │                          │  │ Wie Termine erinnert, abgesagt und online │ │
│ │ PERSÖNLICH               │  │ gebucht werden.                           │ │
│ │   Mein Konto             │  │ ┌───────────────────────────────────────┐ │ │
│ │ PRAXIS                   │  │ │ TERMINERINNERUNG                 [an] │ │ │
│ │   Praxisdaten            │  │ └───────────────────────────────────────┘ │ │
│ │ ▌ Termine & Online-Buch. │  │ ┌───────────────────────────────────────┐ │ │
│ │   Leistungen & Preise    │  │ │ AUSFALLGEBÜHR & ABSAGEFRIST           │ │ │
│ │   Behandlung & Doku      │  │ │ Frist [24] Std · Betrag [25,00 €]     │ │ │
│ │   Briefkopf & Belege     │  │ │                          [Speichern]  │ │ │
│ │   Team                 ↗ │  │ └───────────────────────────────────────┘ │ │
│ │ ABRECHNUNG               │  │ ┌───────────────────────────────────────┐ │ │
│ │   Krankenkasse           │  │ │ ONLINE-TERMINSEITE: IMPRESSUM & DS    │ │ │
│ │   Rechnung               │  │ └───────────────────────────────────────┘ │ │
│ │   Buchhaltung            │  │ Auch hier einstellen:                     │ │
│ │ KOMMUNIKATION            │  │  ↗ Öffnungszeiten & Räume                 │ │
│ │   E-Mail & Fax           │  │  ↗ Termin-Anfragen automatisch annehmen   │ │
│ │ SYSTEM & DATENSCHUTZ     │  └───────────────────────────────────────────┘ │
│ │   KI-Unterstützung       │                                                │
│ │   Datenschutz            │                                                │
│ │   Paket & Abo            │                                                │
│ │   System                 │                                                │
│ └──────────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Handy (390 px, Mitarbeiter)

```
┌──────────────────────────────┐
│ ☰  Einstellungen             │
│ ┌──────────────────────────┐ │
│ │ 🔍 Einstellungen durchs… │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Mein Konto            ▾  │ │   ← Auswahlliste (nur „Mein Konto“,
│ └──────────────────────────┘ │      „Datenschutz“ für Mitarbeiter)
│ ┌──────────────────────────┐ │
│ │ MEIN PROFIL              │ │
│ │ Anzeigename [A. Muster]  │ │
│ │ Foto  (◯)  [Ändern]      │ │
│ ├──────────────────────────┤ │
│ │ ANMELDUNG & PASSWORT     │ │
│ │ Neues Passwort [••••••]  │ │
│ │            [Speichern]   │ │
│ ├──────────────────────────┤ │
│ │ MEIN GOOGLE-KALENDER     │ │
│ │ Nicht verbunden [Verbin.]│ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

---

## 8. Offene Fragen an Melih

1. Zielstruktur mit 5 Obergruppen und 15 Bereichen so freigeben? (Alternative: ohne Obergruppen, flache Liste
   wie Claude Desktop — einfacher, aber bei 15 Einträgen unübersichtlicher.)
2. Verlinken statt umhängen für Öffnungszeiten/Räume, Leistungen, Vorlagen, Team (die bleiben Arbeitsbereiche,
   auch für Mitarbeiter mit Recht)?
3. Ärzteregister aus den Einstellungen nehmen (nur ↗ zum Panel „Ärzte“)?
4. Neue Felder mit Migration (Takt, Recall, Serien-Vorgaben, Fahrtpuffer, Nummernkreise) erst nach
   Partnerfrage #24/#25 — einverstanden?
5. KI: Stufe 1 in Stufe B — Anzeige ohne Migration sofort, „Aufgaben an/aus“ mit kleiner Migration (GO nötig)?
   Stufe 2 (lokales Modell zuerst [legal-de] vs. Azure-EU-BYOK zuerst [onprem], nur Box) als `/konsey`-Thema?
6. F1 (Sprung in ausgeblendeten Bereich) ist eine **live Regression** — als Sofort-Fix vor Stufe B erlaubt?
