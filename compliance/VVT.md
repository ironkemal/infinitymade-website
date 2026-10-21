# Verzeichnis von Verarbeitungstätigkeiten (VVT)

**Art. 30 DSGVO — Verzeichnis nach Verarbeitungstätigkeiten des Verantwortlichen / Auftragsverarbeiters**

| | |
|---|---|
| **Verantwortliche Stelle** | Yavuz Kemal Demir – InfinityMade (Einzelunternehmer) |
| **Inhaber / DSB** | Yavuz Kemal Demir, ironkemal5@gmail.com |
| **Adresse** | Industriestraße 33, 53721 Siegburg, Deutschland |
| **Aufsichtsbehörde** | Landesbeauftragter für Datenschutz NRW |
| **Letzte Aktualisierung** | 2026-10-21 (Nachtrag Verarbeitung 7, Entwurf) |
| **Version** | 1.2 + Nachtrag 2026-10-21 |

Yavuz Kemal Demir – InfinityMade tritt **doppelt** in Erscheinung:
- als **Verantwortlicher** für eigene Geschäftskunden-Daten (B2B-Stammdaten, Login, Abrechnung)
- als **Auftragsverarbeiter** im Auftrag der angeschlossenen Praxen für deren Patient*innen-Daten

---

## Verarbeitung 1 — B2B Kundenkonto (Praxisinhaber)

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Kontoverwaltung & Vertragsabwicklung Praxiskunden |
| **Rolle** | Verantwortlicher |
| **Zwecke** | Vertragserfüllung, Rechnungsstellung, Support, Produktverbesserung |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertrag); lit. f (berechtigtes Interesse — Produktstats) |
| **Datenkategorien** | Name, E-Mail, Telefon, Geschäftsname, Adresse, Sektor, IK-Nummer, Stripe-Kunden-ID, IP, Login-Zeitstempel |
| **Betroffene** | Geschäftsinhaber, Mitarbeiter mit eigenem Login |
| **Empfänger** | Stripe Payments Europe (EU, AVV), Vercel (DPF-zertifiziert, EU-Region), Supabase Frankfurt; DNS-Hosting: Cloudflare (nur DNS, kein Proxy) — Zuordnung Box-Subdomain ↔ Praxis (K-18, ab K2b.2) |
| **Drittland-Übermittlung** | Stripe verarbeitet primär in EU; Sub-Prozessoren in USA über SCC |
| **Speicherdauer** | Vertragslaufzeit + 10 Jahre (§ 147 AO Buchhaltungspflicht) |
| **Löschkonzept** | Nach Vertragsende: Stammdaten anonymisiert; Buchhaltungsrelevante Daten 10 Jahre archiviert |
| **TOM-Verweis** | siehe TOM.md §1, §2, §4 |

## Verarbeitung 2 — Patient*innen-Stammdaten (im Auftrag)

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Patientenverwaltung & Terminbuchung |
| **Rolle** | Auftragsverarbeiter (gem. AVV mit Praxis) |
| **Zwecke** | Terminbuchung, Behandlungsdokumentation, Rezept-Verwaltung — ausschließlich nach Weisung des Verantwortlichen |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b + Art. 9 Abs. 2 lit. h DSGVO (Gesundheitsversorgung) — durch den Verantwortlichen |
| **Datenkategorien** | Name, Geburtsdatum, Kontakt, **Versichertennummer (KVNR)**, **Versichertenstatus**, Adresse |
| **Besondere Kategorien (Art. 9)** | ja — Gesundheitsdaten (siehe Verarbeitung 3) |
| **Betroffene** | Patient*innen der angeschlossenen Praxen |
| **Empfänger** | Keine — Daten verbleiben in der Mandantenisolation des Verantwortlichen |
| **Drittland-Übermittlung** | Keine |
| **Speicherdauer** | Nach Weisung des Verantwortlichen, max. gesetzliche Aufbewahrung Heilberufe (10 Jahre) |
| **Löschkonzept** | Praxis löscht über Dashboard; Auftragsverarbeiter führt Löschung binnen 30 Tagen aus |
| **TOM-Verweis** | siehe TOM.md §3, §5, §6 |

## Verarbeitung 3 — Gesundheitsdaten (Rezepte / Verordnungen / Abrechnung)

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Heilmittel-Abrechnung nach § 302 SGB V |
| **Rolle** | Auftragsverarbeiter |
| **Zwecke** | EDIFACT-Dateierstellung für DMRZ, OCR-gestützte Datenerfassung aus Verordnungen, Diagnose-Plausibilitätsprüfung |
| **Rechtsgrundlage** | Art. 9 Abs. 2 lit. h + § 22 Abs. 1 Nr. 1 lit. b BDSG (Gesundheitsvorsorge) |
| **Datenkategorien** | ICD-10-Diagnose, Diagnosetext, Diagnosegruppe, Heilmittel-Positionsnummern, Verordnungsart, Leitsymptomatik, Therapiefrequenz, Behandlungssitzungen mit Datum |
| **Betroffene** | Patient*innen |
| **Zugriff innerhalb der Praxis** | Inhaber*in vollständig; angestellte Therapeut*innen derselben Praxis **lesend** auf Verordnungen und Behandlungsdokumentation, im Umfang der Behandlungsdurchführung (Art. 9 Abs. 3 DSGVO — Personal unter Geheimhaltungspflicht; § 203 Abs. 1 Nr. 1 und Abs. 3 StGB). Technisch über RLS erzwungen, nicht über die Oberfläche. Entscheidung 03.09.2026, siehe LEGAL_DECISIONS.md. **Ergänzung 17.09.2026:** ebenfalls **lesend** freigegeben sind die Patientennotizen (`patient_notes`) — Schreiben bleibt beim Inhaber, solange die Tabelle keine Verfasserspalte und keine Versionierung führt (§ 630f Abs. 1 S. 2 BGB); die Warteliste (`warteliste`, Terminorganisation) ist für Angestellte **lesend und schreibend** freigegeben, **ohne Löschrecht** (Art. 5 Abs. 1 lit. d — Stornieren über `status`). Entscheidung 17.09.2026, siehe LEGAL_DECISIONS.md |
| **Empfänger** | Microsoft Azure OpenAI (Region Sweden Central, EU) — nur für OCR/Strukturierung; Verarbeitung bei Microsoft Azure in Schweden (EU), Unterauftragsverarbeiter gemäß AVV; Datenannahmestelle (DMRZ o.ä.) als gesetzlich vorgesehener Empfänger |
| **Drittland-Übermittlung** | Keine (Azure Sweden Central = EU) |
| **Speicherdauer** | Behandlung + 10 Jahre (Heilberufe-Aufbewahrung); EDIFACT-Rohfiles 90 Tage nach Annahme-Bestätigung durch DMRZ, dann automatisch gelöscht |
| **TOM-Verweis** | siehe TOM.md §3, §5, §7 |

## Verarbeitung 4 — Server-Logs / Audit

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Sicherheits- und Zugriffsprotokollierung |
| **Rolle** | Verantwortlicher (Server-Logs) bzw. Auftragsverarbeiter (Patient-Access-Logs) |
| **Zwecke** | Missbrauchserkennung, Datensicherheit, Nachweispflicht (Art. 5 Abs. 2 DSGVO Rechenschaftspflicht) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. f DSGVO; Art. 32 DSGVO |
| **Datenkategorien** | IP, User-Agent, User-ID, Endpunkt, Zeitstempel, HTTP-Status |
| **Betroffene** | Alle Systemnutzer |
| **Speicherdauer** | Server-Access-Logs 14 Tage; Audit-Trail Patient-Zugriff 12 Monate; AI-Aufrufprotokoll 24 Monate |

## Verarbeitung 5 — Einwilligungserfassung (digitale Patienten-Einwilligung)

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Erfassung und Nachweis von Patienten-Einwilligungen mit elektronischer Unterschrift |
| **Rolle** | Auftragsverarbeiter (im Auftrag der Praxis) |
| **Zwecke** | Nachweis der Behandlungs-Einwilligung (§ 630d BGB) und der datenschutzrechtlichen Einwilligung (Art. 7 Abs. 1 DSGVO Nachweispflicht) |
| **Rechtsgrundlage** | Behandlungsteil: Art. 6 Abs. 1 lit. b i. V. m. Art. 9 Abs. 2 lit. h DSGVO, § 630d BGB. Datenschutzteil: Art. 6 Abs. 1 lit. a i. V. m. Art. 9 Abs. 2 lit. a DSGVO. Nachweisspeicherung: Art. 7 Abs. 1 DSGVO, § 630f BGB |
| **Datenkategorien** | Patienten-ID, unterschriebener Name, Unterschrift als **Rasterbild (PNG)**, Volltext-Snapshot der Erklärung, Textversion, SHA-256-Prüfsumme, Zeitstempel, erfassender Nutzer, grobe Gerätebezeichnung (Plattform + Bildschirmauflösung), ggf. Widerrufszeitpunkt und -grund |
| **Ausdrücklich NICHT erhoben** | **IP-Adresse** — bei einer Unterschrift von Angesicht zu Angesicht auf dem Praxis-Tablet ist die IP der Praxisrouter; der Beweiswert ist null, die Erhebung daher ein Verstoß gegen Art. 5 Abs. 1 lit. c (Datenminimierung). Das Muster aus `consent_log` wird bewusst nicht übernommen. — **Signaturdynamik** (Druck, Geschwindigkeit, Strichzeiten): nicht erhoben, damit das Rasterbild kein biometrisches Datum i. S. v. Art. 4 Nr. 14 DSGVO wird |
| **Betroffene** | Patient*innen der angeschlossenen Praxen |
| **Empfänger** | Keine externen Empfänger. Speicherung Supabase Frankfurt (Tabelle `patient_consents`, privater Storage-Bucket `patient-documents`) |
| **Drittland-Übermittlung** | Keine |
| **Speicherdauer** | 10 Jahre ab Unterschrift (§ 630f Abs. 3 BGB, zusammen mit der Behandlungsdokumentation) |
| **Löschkonzept** | Löschung vor Fristablauf ist per DB-Trigger `trg_patient_consents_immutable` blockiert; derselbe Trigger verhindert nachträgliche Änderungen am Nachweis. Nach Fristablauf Löschung zusammen mit der Patientenakte |
| **Widerruf** | Art. 7 Abs. 3 DSGVO: die Datenschutz-Einwilligung ist jederzeit formlos widerruflich, der Widerrufsweg steht im unterschriebenen Text. Ein Widerruf **löscht den Nachweis nicht**, er markiert ihn (`revoked_at`). Die Behandlungs-Einwilligung nach § 630d BGB ist davon getrennt erfasst — Kopplung beider Wäre ein Verstoß gegen das Koppelungsverbot |
| **TOM-Verweis** | siehe TOM.md § 1.2, § 1.3, § 2.1 |

> **Verarbeitung 6** ist für die Privatliquidation reserviert (offener Punkt, LEGAL_DECISIONS.md 08.09.2026; erscheint mit Version 1.3).

## Verarbeitung 7 — Begleitete Datenübernahme („Datenübernahme-Paket", Box)

> **Entwurf legal-de 21.10.2026** — wirksam mit dem ersten verkauften Paket. Grundlage:
> LEGAL_DECISIONS.md 20.10.2026, Vertrag `compliance/AVV-DATENUEBERNAHME.md`.
> Eintrag nach **Art. 30 Abs. 2 DSGVO** (Verzeichnis des Auftragsverarbeiters). Die Box selbst
> bleibt rollenlos; diese Tätigkeit ist die einzige im Box-Modell, bei der Praxura Patientendaten
> zu sehen bekommt.

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Begleitung der Praxis bei der Übernahme von Daten aus ihrer bisherigen Praxissoftware in Praxura (CSV-/Excel-Import) per Bildschirmfreigabe |
| **Rolle** | Auftragsverarbeiter (Art. 28 DSGVO), je gebuchter Sitzung; zugleich mitwirkende Person nach § 203 Abs. 3 S. 2 StGB |
| **Verantwortliche (Art. 30 Abs. 2 lit. a)** | Die jeweils beauftragende Praxis. Die Liste der Auftraggeber mit Datum der Vereinbarung und der Sitzung(en) wird **außerhalb dieses öffentlichen Repositorys** geführt (gemeinsamer Ablageordner, `vertraege/`) und ist Bestandteil dieses Verzeichnisses. Ein Datenschutzbeauftragter ist bei Praxura nicht benannt (DSB_PRUEFVERMERK.md) |
| **Kategorien von Verarbeitungen (lit. b)** | Ausschließlich **Einsehen** (Abfragen, Art. 4 Nr. 2) des von der Praxis freigegebenen Bildschirminhalts in Echtzeit. Kein Erheben, Speichern, Kopieren, Übermitteln, Eingeben oder Löschen durch Praxura; die Praxis bedient ihre Systeme selbst |
| **Datenkategorien (sichtbar)** | Patientenstamm (Name, Geburtsdatum, Anschrift, Kontakt, Krankenkasse/IK, Versichertennummer, Versichertenstatus, Zuzahlungsbefreiung); offene und teilweise erbrachte, nicht abgerechnete Verordnungen (Ausstellungsdatum, LANR/BSNR/Arztname, ICD-10, Diagnose, Diagnosegruppe, Leitsymptomatik, Heilmittel, Anzahl, Frequenz; Podologie zusätzlich Nagel, Wagner-Grad); bereits erbrachte Behandlungstage (Datum, Leistung); Vorgeschichte (Daten früherer Leistungen); Zuzahlungs-Vermerk (Betrag, Datum, Beleg-Nr. des Altsystems); beiläufig sichtbare Inhalte der bisherigen Software |
| **Besondere Kategorien (Art. 9)** | ja — Gesundheitsdaten |
| **Betroffene** | Patient*innen der Praxis; verordnende Ärzt*innen; Beschäftigte der Praxis, soweit sichtbar |
| **Empfänger** | Keine Empfänger von Inhalten. Fernsitzungswerkzeug: TeamViewer über Praxura-Lizenz — **Unterauftragsverarbeiter nur für Verbindungsdaten** (Geräte-IDs, IP-Adressen, Zeitpunkte, Konto des Praxura-Teilnehmers): TeamViewer Germany GmbH, Bahnhofsplatz 2, 73033 Göppingen; Auftragsverarbeitungsvertrag des Anbieters (Stand 02.02.2026, gilt mit der Nutzung, EULA A.4) mit Anlagen 1–3 abgelegt im gemeinsamen Ordner (`vertraege/`). Bildschirminhalte Ende-zu-Ende verschlüsselt, für den Anbieter nicht lesbar. Nutzt die Praxis ausnahmsweise ihr eigenes Werkzeug, ist dessen Anbieter ihr Dienstleister |
| **Drittland-Übermittlung (lit. c)** | Inhalte: keine (Ende-zu-Ende-Verschlüsselung). Verbindungsdaten: Standort der Vermittlungsserver vom Anbieter nicht auf die EU festgelegt; Übermittlung in Drittländer nach dessen Auftragsverarbeitungsvertrag (Ziff. 2.13, 3.3) nur unter den Voraussetzungen der Art. 44 ff. DSGVO. Keine US-Konferenzdienste |
| **Speicherdauer** | Patientendaten: keine Speicherung bei Praxura. Sitzungsprotokoll (enthält keine Patientendaten): bis Ende des dritten Jahres nach dem Jahr der Sitzung. Versehentlich eingegangene Dateien: unverzügliche Löschung, Vermerk im Protokoll |
| **TOM (lit. d, Art. 32)** | Nur-Ansicht-Modus, im Praxura-Client fest eingestellt (Zugriffssteuerung ausgehend „View and show"); Verbindung nur mit Sitzungs-ID und Einmal-Kennwort der Praxis (QuickSupport), kein unbeaufsichtigter Zugang, Gerät der Praxis nicht gespeichert; keine Aufzeichnung, keine Dateiübertragung, keine Zwischenablage; KI-Zusatzfunktionen des Werkzeugs aus; Endgerät mit Festplattenverschlüsselung, Bildschirmsperre, ohne Hintergrund-Aufzeichnung; geschlossener Raum, Kopfhörer; nur schriftlich verpflichtete Teilnehmende (§ 203 Abs. 4 S. 2 Nr. 2 StGB, Art. 28 Abs. 3 lit. b); Sitzung auf gebuchte Dauer begrenzt; Protokoll je Sitzung (`compliance/vorlagen/SITZUNGSPROTOKOLL-DATENUEBERNAHME.md`). Einzelheiten: AVV-DATENUEBERNAHME.md § 6 Abs. 3 |
| **DSFA** | Nicht gesondert erforderlich: keine Speicherung, kein neuer Empfänger, zeitlich eng begrenzt; Bewertung liegt beim Verantwortlichen (Praxis) |

---

## Verarbeitung 6 — Online-Terminanfragen (Widget und Anfrageseite)

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Online-Terminanfrage von Patient*innen und Interessent*innen (`booking-request.html`, einbettbares Widget `widget/`) |
| **Rolle** | Auftragsverarbeiter (SaaS) · in der Kundenbox keine Rolle des Herstellers |
| **Zwecke** | Entgegennahme einer Terminanfrage, Terminvereinbarung, Vorbereitung der Behandlung |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO; Gesundheitsbezug (Anliegen, Freitext): Art. 9 Abs. 2 lit. h, Abs. 3 DSGVO i. V. m. § 22 Abs. 1 Nr. 1 lit. b BDSG. Keine Einwilligung (legal-de 09.10.2026, K2b.15) |
| **Datenkategorien** | Vor- und Nachname, Geburtsdatum, Telefon und/oder E-Mail, Versicherungsart, Anliegen (feste Auswahl), Hausbesuch ja/nein, Wochentage und Tageszeiten der Verfügbarkeit, Dringlichkeit, Erstbesuch ja/nein, zwei freiwillige Kurztexte (höchstens 140 und 80 Zeichen), Hinweis „für andere Person" |
| **Betroffene** | Anfragende Personen (Patient*innen, Interessent*innen), ggf. gesetzliche Vertreter; Besucher von Webseiten der Praxis mit eingebettetem Formular (Verbindungsdaten) |
| **Empfänger** | Die Praxis. Benachrichtigungs-E-Mail an die Praxis enthält bei Widget-Anfragen keinen Freitext, nur einen Hinweis auf das Dashboard |
| **Drittland-Übermittlung** | Keine. Das Widget lädt keine Drittanbieter-Inhalte, setzt keine Cookies, nutzt keinen Tracker |
| **Speicherdauer** | Nicht angenommene Anfragen: so lange erforderlich, spätestens 6 Monate (`api-backend/dsgvo/fristen.js`). Kommt eine Behandlung zustande: Patientendokumentation, 10 Jahre (§ 630f Abs. 3 BGB). Im Browser nur Anfrage-ID und Token in `sessionStorage` bis zum Schließen des Fensters |
| **TOM-Verweis** | siehe TOM.md; guvenlik S-52 bis S-56 (Header, Mail-Escaping, Tagesdeckel, Token) |
| **Offen** | Ob der Löschjob auf dem Produktivsystem läuft, ist nicht geprüft (legal-de 12.10.2026) |

## Auftragsverarbeiter / Sub-Prozessoren

| Anbieter | Zweck | Sitz / Region | AVV vorhanden | Drittland |
|---|---|---|---|---|
| Supabase Inc. | Datenbank, Auth, Storage | EU (Frankfurt) | ✅ | nein |
| Microsoft Azure | OCR, KI-Strukturierung Verordnungen | EU (Sweden Central) | ✅ (EU-Region, Unterauftragsverarbeiter gemäß AVV) | nein |
| Hetzner Online GmbH | VPS für Calendar-API & n8n | DE (Falkenstein) — ISO 27001 | ✅ | nein |
| Vercel Inc. | Frontend-Hosting | EU + DPF-zertifiziert | ✅ | (USA via DPF) |
| Stripe Payments Europe | Zahlungsabwicklung | EU (Irland) | ✅ | (USA via SCC + DPF) |
| GoDaddy (Mailhosting `praxura.de`) | Transaktions-E-Mails über SMTP (nodemailer) sowie Supabase-Auth-Mails | ⚠️ **offen** | ⚠️ **offen** | ⚠️ **zu prüfen** |
| Google LLC | OAuth + Calendar (nur opt-in) | DPF-zertifiziert | (Google Workspace DPA) | (USA via DPF) |
| TeamViewer Germany GmbH | Verbindungsaufbau Bildschirmfreigabe — **nur** Verarbeitung 7 (Datenübernahme-Paket), nur Verbindungsdaten, Inhalte E2E | DE (Göppingen); Vermittlungsserver nicht auf EU festgelegt | ⚠️ mit Lizenzkauf (DPA Stand 02.02.2026, gilt mit Nutzung) | nur nach Art. 44 ff. (DPA Ziff. 2.13, 3.3) |

> **Korrektur 14.08.2026:** In diesem Verzeichnis stand bis dahin „Resend (geplant) — Transaktions-E-Mails". **Resend wird nicht eingesetzt und ist nicht vorgesehen.** Der Versand läuft über `nodemailer` gegen den SMTP-Server des Mailhostings (`SMTP_HOST`/`SMTP_USER`, siehe `api/contact.js`); belegt in `ONPREM_MIGRATION_PLAYBOOK.md` und `ON_PREMISE_ANALYSE.md`. Ein Verzeichnis, das einen nicht existierenden Auftragsverarbeiter nennt und den tatsächlichen verschweigt, ist nach Art. 30 unvollständig — deshalb korrigiert.
>
> **Offener Punkt:** Für das Mailhosting liegen AVV-Status, Sitz der vertragspartnerischen Gesellschaft und Drittlandbewertung noch nicht geprüft vor. Das ist vor Go-Live zu klären und im AVV (DPA.html) nachzuführen.

### Nicht-Auftragsverarbeiter: entfallene CDN-Abrufe (14.08.2026)

`esm.sh` und `cdn.jsdelivr.net` lieferten bis 14.08.2026 **Programmbibliotheken** an den Browser der Praxis (kein Zugriff auf Patientendaten, aber Übermittlung der IP-Adresse und potenzieller Codeausführungskontext). Sie waren **nie** als Auftragsverarbeiter geführt.

Die richtige Antwort war nicht, sie nachzutragen, sondern die Abrufe **abzustellen**: Die Bibliotheken werden seit 14.08.2026 von der eigenen Domain ausgeliefert, die Content-Security-Policy sperrt beide Hosts. Damit entfällt der Übermittlungsvorgang; ein AVV bzw. Garantien nach Art. 44 ff. werden für sie gegenstandslos. Einzelheiten: TOM.md § 2.3, DSFA.md R14/R15.

Verbleibende externe Abrufe im Anwendungskontext — Sentry-Loader, Cropper.js (cdnjs), Google Fonts — sind als Aufgaben erfasst; Stripe (`js.stripe.com`) bleibt aus PCI-DSS-Gründen bewusst extern.

Alle Sub-Prozessoren sind im AVV (DPA.html) aufgeführt; Änderungen werden 30 Tage vor Inkrafttreten kommuniziert.

### Textvorschlag (legal-de 30.09.2026) — Anwesenheitserfassung mit Standortabgleich

> **Status: Vorschlag, noch nicht übernommen.** Wirksam erst, wenn die Funktion im Browser
> freigeschaltet ist (`Permissions-Policy` für `/dashboard.html`/`/attendance.html`,
> Sicherheitsregister A-19, Kemals Freigabe offen). Technik seit 30.09.2026 bereit
> (Migration 0047, `api-backend/lib/gps-checkin.js`).

„Anwesenheitserfassung: Standortabgleich zum Zeitpunkt des Check-ins; gespeichert wird
ausschließlich das Ergebnis (innerhalb/außerhalb 150 m), keine Koordinaten. Funktion
standardmäßig deaktiviert, Aktivierung durch den Auftraggeber."

Ergänzend für die Verarbeitungsbeschreibung: ohne Standort (Funktion aus, Einwilligung im
Gerät verweigert, keine Praxiskoordinate) wird der Check-in trotzdem erfasst und als
„nicht geprüft" gekennzeichnet — die Zeiterfassung hängt nicht am Standort.

### Interner Ergänzungsbedarf für das Praxis-VVT — Hausbesuchsroute (18.10.2026)

**Status: technische Bestandsaufnahme für die Kundenbox.** Die Praxis entscheidet
über den Einsatz des Kartenanbieters. Dieser Abschnitt ist keine zusätzliche
Verarbeitungstätigkeit von InfinityMade als Verantwortlichem und ergänzt nicht
die Hersteller-Subprozessorenliste. Er ist kein fertiger Datenschutzhinweis.

Bei „Route öffnen“ öffnet erst der Klick des Praxisnutzers eine externe Google-Maps-Seite.
Die Zieladresse wird dabei als URL-Parameter übertragen. Das Modul ergänzt weder
Patientenname noch Diagnose oder Startpunkt. Vor dem Klick stellt dieses Modul keine
Verbindung zu Google Maps her. Kilometer werden weiterhin manuell im Fahrtenbuch erfasst.

Technische Nachweise: `module/hausbesuch-route.js`, `routeLink()` und Klick-Handler;
bestehende Produktentscheidung K-19(c), KHS §5 ORG. Der frühere Codekommentar
„Die Adresse verlässt die Box nicht“ wurde berichtigt; das Laufzeitverhalten blieb gleich.

Vor Nutzung mit echten Patientenadressen bleibt durch die Praxis mit ihrer
Datenschutzberatung zu klären: Rechtsgrundlage und Gesundheitsbezug, Empfänger und
Drittlandbezug, Information der Betroffenen und Anpassung des Praxis-VVT.
Die technische Dokumentation schließt diese Prüfung nicht ab.
