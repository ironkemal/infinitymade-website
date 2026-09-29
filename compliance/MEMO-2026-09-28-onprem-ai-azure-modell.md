# Memo zur anwaltlichen Prüfung — On-Premise-Praxissoftware mit KI-OCR über ein Azure-Abonnement des Softwareherstellers („Modell B")

Stand: 28.09.2026 · Verfasser: interne Rechtsrecherche (KI-gestützt), **keine Rechtsberatung** — siehe Ziff. 5
Adressat: beauftragte Rechtsanwältin / beauftragter Rechtsanwalt (Medizin-/IT-/Datenschutzrecht)
Gewünschter Umfang der Prüfung: ca. 1–2 Stunden, Schwerpunkt F1, F2, F5 (siehe Ziff. 4)
Gesetzeswortlaute: § 393 SGB V, § 203 StGB, C5GleichwV am 28.09.2026 auf gesetze-im-internet.de abgerufen.

---

## 1. Sachverhalt

**Beteiligte.** Softwarehersteller ist ein Einzelunternehmen (Geschäftsbezeichnung *InfinityMade*, Sitz Siegburg/NRW; im Folgenden „Inhaber"). Produkt: *Praxura*, Praxisverwaltung für Heilmittelerbringer (Physio-, Ergotherapie, Logopädie, Podologie) — Termine, Patientenakte, Verordnungserfassung, Vorbereitung der Abrechnung nach § 302 SGB V. Kunden sind Heilmittelpraxen, also Leistungserbringer i. S. d. Vierten Kapitels SGB V und Berufsgeheimnisträger nach § 203 Abs. 1 Nr. 1 StGB. Derzeit gibt es keinen zahlenden On-Premise-Kunden; es geht um eine Vorab-Freigabe.

**Betriebsmodell.** Die Software läuft **on-premise** auf dem Server der Praxis (Softwaremiete mit Pflege). Patientendaten liegen ausschließlich dort. Einen Fernzugriff mit Datenzugriff gibt es nicht; Support läuft über ein von der Praxis heruntergeladenes Diagnosepaket ohne personenbezogene Daten.

**Die zu prüfende Funktion (Modell B).** Die optionale KI-Erkennung von Verordnungen (OCR des Rezeptbildes → strukturierte Felder, danach manuelle Prüfung durch die Praxis):

- Der Inhaber unterhält **ein** Microsoft-Azure-Abonnement. Darin legt er **je Praxis eine eigene Ressource** (eigene Resource Group, eigener API-Schlüssel) an: Azure OpenAI / Foundry, Region **Sweden Central**, Bereitstellungstyp **„Standard"** (nicht „Global"/„DataZone"), Modell gpt-4.1-mini.
- Der Schlüssel gelangt über den Lizenzkanal auf den Server der Praxis (bei der Lizenzaktivierung, Rotation über die nächtliche Lizenzverlängerung).
- Das Rezeptbild (enthält u. a. Name, Geburtsdatum, Versichertennummer, Diagnose/ICD) geht **direkt** vom Praxisserver an Azure. Es läuft **nicht** über Server des Inhabers; es gibt kein zentrales Gateway.
- Die Azure-Kosten stellt der Inhaber der Praxis über die Praxura-Rechnung in Rechnung. Die Praxis hat keinen eigenen Vertrag mit Microsoft.
- Geplante technische Begleitmaßnahmen: Kontingent (TPM) je Ressource, Anfragen mit `store:false`, Azure Policy gegen inhaltsspeichernde Funktionen (Stored Completions, Assistants/Files), Activity-Log-Alarm, optional IP-Beschränkung. Außerdem wurde **Modified Abuse Monitoring** bei Microsoft beantragt (Antwort steht aus).

```
  PRAXIS  (Verantwortliche, Art. 4 Nr. 7 DSGVO; Geheimnisträgerin § 203 Abs. 1 Nr. 1 StGB)
  ┌──────────────────────────────────────┐
  │ eigener Server: Praxura (on-prem)    │
  │ Patientendaten bleiben hier          │        (1) Rezeptbild, HTTPS, direkt
  │ Rezeptbild ─────────────────────────────────────────────────────────┐
  │ API-Key „Praxis X" ◄────┐            │                              │
  └─────────────────────────│────────────┘                              ▼
                            │ (2) Lizenzkanal: nur Schlüssel,   MICROSOFT AZURE, Sweden Central
                            │     keine Patientendaten          Abonnement des INHABERS
                 ┌──────────┴───────────┐                       ├─ Ressource Praxis X (eigener Key)
                 │ INHABER (Praxura)    │── verwaltet Abo ────► ├─ Ressource Praxis Y (eigener Key)
                 │ Lizenzserver         │   (3) Kosten → Praxura-Rechnung
                 └──────────────────────┘

  Vertragskette:  Praxis ──[Softwaremiete + AVV Art. 28 + Verpflichtung § 203]──► Inhaber
                  Inhaber ──[Microsoft-Kundenvertrag + Product Terms + Products and
                             Services DPA + ggf. Professional Secrecy Amendment]──► Microsoft
```

**Belegte Tatsachen zu Microsoft** (eigene Durchsicht der Dokumente):
- Microsofts C5:2020-Bericht *„Azure + Dynamics 365 + Online Services – Public & Government C5 Report (04-01-2025 to 3-31-2026)"*, Prüfer Deloitte, Berichtsdatum 07.07.2026: uneingeschränktes Urteil zu Angemessenheit **und Wirksamkeit** über den Zeitraum 01.04.2025–31.03.2026 (= Typ 2). „Azure OpenAI Service" ist im Scope, **aber Fußnote 6:** geprüft wurde nur der Zeitraum **01.04.–31.12.2025**. „Microsoft Foundry" ist für den ganzen Zeitraum im Scope, begrenzt auf „Azure Direct Models". Dass Azure OpenAI ab 2026 unter „Foundry" mitgeprüft ist, **steht nicht im Bericht; das ist unsere Schlussfolgerung**. Sweden Central steht in der Rechenzentrumsliste, eine Zuordnung von Diensten zu Regionen enthält der Bericht nicht. Der Bericht setzt komplementäre Kundenkontrollen (CUEC) voraus. Er darf nur unter Auflagen weitergegeben werden (Empfängerliste führen) und liegt deshalb nicht im öffentlichen Repository.
- Microsoft-Dokumentation, Stand 05/2026: Prompts und Antworten werden bei „Standard" in der Geografie der Ressource verarbeitet. Sie werden nicht zum Training genutzt. Für Ressourcen im EWR erfolgt die menschliche Prüfung im Abuse Monitoring durch Microsoft-Mitarbeiter im EWR.

---

## 2. Rechtsfragen

### F1 — Rolle nach § 393 SGB V: Braucht der Inhaber ein eigenes C5-Testat?

**Rechtsfrage.** Ist der Inhaber in Modell B „Auftragsdatenverarbeiter" i. S. d. § 393 Abs. 1 SGB V? Und wird Abs. 3 Nr. 2 durch das Testat des Unterauftragsverarbeiters (Microsoft) erfüllt, obwohl der Inhaber **selbst kein Cloud-System betreibt**?

**Normen (Wortlaut am 28.09.2026 geprüft).**
- § 393 Abs. 1 SGB V: „Leistungserbringer im Sinne des Vierten Kapitels … sowie ihre jeweiligen Auftragsdatenverarbeiter dürfen Sozialdaten und Gesundheitsdaten auch im Wege des Cloud-Computing-Dienstes verarbeiten, sofern die Voraussetzungen der Absätze 2 bis 4 erfüllt sind."
- Abs. 2: Verarbeitung nur im Inland/EU/gleichgestellten Staaten „und sofern die datenverarbeitende Stelle über eine Niederlassung im Inland verfügt".
- Abs. 3 Nr. 2: „ein aktuelles C5-Testat **der datenverarbeitenden Stelle** im Hinblick auf die C5-Basiskriterien **für die im Rahmen des Cloud-Computing-Dienstes eingesetzten Cloud-Systeme und die eingesetzte Technik** vorliegt"; Nr. 3: die „korrespondierenden Kriterien für Kunden" des Prüfberichts sind umgesetzt.
- Abs. 4 S. 4: Ersatzweise genügt ein gleichwertiges Testat oder Zertifikat „für die im Rahmen des Cloud-Computing-Dienstes eingesetzten Cloud-Systeme und die Cloud-Technik". Die Konkretisierung findet sich in der C5GleichwV (BGBl. 2025 I Nr. 91, rückwirkend ab 01.07.2024): ISO/IEC 27001, ISO 27001 auf Basis IT-Grundschutz oder CCM 4.0, jeweils mit Maßnahmenplan (Lückenschluss ≤ 12 Monate, C5 Typ 1 ≤ 18 Monate, Typ 2 ≤ 24 Monate).
- Art. 28 DSGVO (Rolle des Inhabers als Auftragsverarbeiter, siehe F3).

**Literatur/Quellen.**
- activeMind (RA David Weihbrecht), „C5-Testat: datenverarbeitende Stelle nach § 393 SGB V", 02.07.2026, https://www.activemind.de/magazin/c5-datenverarbeitende-stelle/ — Der „unmittelbar Cloud-betreibende Auftragsverarbeiter – also etwa ein SaaS-Anbieter" braucht ein eigenes Testat. Zitiert das BMG: Das Testat sei „für diejenigen Cloud-Systeme (Software) und die zugrundeliegende Technik (Hardware)" nötig; das BMG mache „keine Einschränkung dahingehend, dass das C5-Testat nicht notwendig sei, wenn ein Subunternehmer über ein eigenes Testat verfügt". Die BMG-Primärquelle haben wir **nicht** eingesehen. Den Fall eines Anbieters ohne eigenen Cloud-Betrieb behandelt der Beitrag **nicht**.
- Rödl & Partner (Jürgen Schwestka), „Die C5-Testatpflicht nach § 393 SGB V – Wen trifft es denn nun wirklich?", 30.10.2025, https://www.roedl.com/insights/c5-testatpflicht-nach-paragraph-393-sgb-v/ — Nach dem Wortlaut brauche „die datenverarbeitende Stelle und damit der Auftragsverarbeiter selber" ein C5-Testat. Den Fall ohne eigenen Betrieb behandelt der Beitrag nicht.
- Blackfort Technology (Christian Gebhardt), „§ 393 SGB V: Warum ein C5-Testat des Cloud-Anbieters bei Praxissoftware oft nicht reicht", 20.06.2026, https://blackfort-tec.de/insights/c5-testat-cloud-praxissoftware-paragraph-393-sgb-v — Anwendungsschicht versus Infrastruktur. Lokal installierte Software lasse die Testatfrage entfallen. Hybridmodelle werden nicht behandelt.
- DSN Group (Pia Lämmerhirt), Blogbeitrag vom 11.11.2024 mit Kommentarantwort vom 19.11.2024, https://www.dsn-group.de/datenschutz-notizen/verarbeitung-von-sozial-und-gesundheitsdaten-in-der-cloud-mehraufwand-durch-c5-testat-4050799 — Ein SaaS-Anbieter brauche ein eigenes Testat.
- SRD Rechtsanwälte (Dr. Johannes Gilch), 05.06.2025, https://www.srd-rechtsanwaelte.de/blog/cloud-nutzung-im-gesundheitswesen-393-sgb-v-und-c5-testat — Keine Aussage zu Unterauftragsverhältnissen.
- Simpliant Legal, Rechtsgutachten zu § 393 SGB V (laut Dateiname v. 10.12.2024), https://a.storyblok.com/f/183108/x/c8f02be602/simpliant-legal-rechtsgutachten-393-sgb-v-10-12-24-1-0-de.pdf — **Gefunden, aber technisch nicht auswertbar; Inhalt unbekannt.** Die Kanzlei sollte es lesen.
- BVMed-Infoblatt zu § 393 SGB V: gefunden, nicht ausgewertet. Kommentarliteratur (z. B. in beck-online/juris): **nicht zugänglich, nicht gefunden.**
- innFactory: Ein Beitrag speziell zu § 393 wurde **nicht gefunden** (zu § 203 siehe F4).

**Vorläufige Einschätzung: OFFEN, mit Tendenz zu „vertretbar, aber nicht gesichert".**
1. Rolle: Der Inhaber ist in Modell B für den OCR-Vorgang **Auftragsverarbeiter** der Praxis. Er bestimmt das Mittel (Azure, Region, Modell), schließt den Vertrag mit Microsoft und verwaltet die Ressource. Dass die Daten technisch nicht über seine Server laufen, ändert daran nichts: Die Verarbeitung durch Microsoft ist ihm als Unterauftragsverarbeitung zuzurechnen (Art. 28 Abs. 4 DSGVO). Damit fällt er unter „ihre jeweiligen Auftragsdatenverarbeiter" (Abs. 1).
2. Das Argument **für** das Microsoft-Testat: Abs. 3 Nr. 2 und Abs. 4 S. 4 knüpfen **objektbezogen** an „die eingesetzten Cloud-Systeme und die eingesetzte Technik" an. In Modell B ist das einzige Cloud-System Azure OpenAI/Foundry. Eine Anwendungsschicht, die ein Prüfer testieren könnte, betreibt der Inhaber nicht; sein Beitrag besteht aus Abonnement-Verwaltung, Schlüsselausgabe und Abrechnung. Das Schutzziel des C5 (Informationssicherheit des Cloud-Betriebs) wird durch das Microsoft-Testat abgedeckt. Die von der Literatur betonte Lücke (ungeprüfte SaaS-Anwendungsschicht) **besteht hier nicht**.
3. Das Argument **dagegen**: Der Wortlaut verlangt ein Testat „**der** datenverarbeitenden Stelle", und der Auftragsverarbeiter wird ausdrücklich genannt. Das BMG soll laut activeMind keine Ausnahme für Subunternehmer-Testate anerkennen. Die gesamte gefundene Literatur verlangt vom Auftragsverarbeiter ein eigenes Testat, allerdings stets für den Fall eines selbst betriebenen SaaS. Unseren Fall behandelt **keine** gefundene Quelle.
4. Folgerung: Die Ansicht „Microsoft-Testat genügt" ist unseres Erachtens gut begründbar. Sie ist aber eine Mindermeinung ohne Beleg. Bei strenger Lesart bräuchte der Inhaber ein eigenes Testat oder eine C5GleichwV-Alternative. Das wäre wirtschaftlich nicht darstellbar: ISO 27001 plus Maßnahmenplan geschätzt 15.000–40.000 € (Schätzung, kein Angebot eingeholt). Modell B wäre dann faktisch ausgeschlossen.
5. Zusätzlich zu Abs. 3 Nr. 3 (CUEC): Die Kundenkontrollen aus dem Microsoft-Bericht muss in Modell B der **Inhaber** als Abonnement-Inhaber umsetzen, nicht die Praxis. Das muss dokumentiert werden.
6. Zusätzlich zu Abs. 2 (Niederlassung im Inland): Die Anforderung erfüllt der Inhaber. Ob sie auch für Microsoft als Unterauftragsverarbeiter gilt und wer Vertragspartner des Inhabers ist (vermutlich eine irische Microsoft-Gesellschaft; **nicht geprüft**), ist offen.

**Offene Punkte für die Kanzlei.**
- (a) Genügt für einen Auftragsverarbeiter, der kein eigenes Cloud-System betreibt, das C5-Testat seines Unterauftragsverarbeiters? Gibt es dazu eine BMG-, BSI- oder Aufsichtsäußerung?
- (b) Wie ist „datenverarbeitende Stelle" in Abs. 2 und Abs. 3 Nr. 2 zu verstehen: subjekt- oder objektbezogen?
- (c) Trägt Abs. 4 S. 3 (18-Monats-Regel beim „erstmaligen Inverkehrbringen" eines Systems) für den Inhaber irgendetwas? Nach unserer Einschätzung nein, weil Azure OpenAI nicht neu ist.
- (d) Gibt es eine gesicherte Zuordnung von Heilmittelerbringern zu Abs. 5 oder 6 (TOM-Maßstab)? Von uns **nicht vertieft**.

### F2 — „Aktuelles Testat": Bericht mit Fußnote 6 und Bridge Letter

**Rechtsfrage.** Erfüllt der Microsoft-Bericht (Prüfzeitraum bis 31.03.2026; Azure OpenAI nur bis 31.12.2025; Foundry über den ganzen Zeitraum) zusammen mit einem Bridge Letter für die Zeit nach dem 31.03.2026 das Merkmal „aktuelles C5-Typ2-Testat"?

**Normen.** § 393 Abs. 4 S. 1–3 SGB V: Bis 30.06.2025 genügte Typ 1, seit 01.07.2025 ist „ein aktuelles C5-Typ2-Testat" nötig. Bei Systemen, die nach dem 30.06.2025 erstmals in Verkehr gebracht werden, genügt 18 Monate lang Typ 1. „Aktuell" ist **gesetzlich nicht definiert**.

**Quellen.** BSI, C5-FAQ (ohne Datum; abgerufen 28.09.2026), https://www.bsi.bund.de/…/C5-FAQ/kriterienkatalog-c5-faq_node.html: Testate „beziehen sich immer auf einen bereits vergangenen, abgeschlossenen Zeitraum", umfassen typischerweise 3–12 Monate, und Kunden sollen die jeweils neuen Berichte anfordern. Die FAQ erwähnt auch C5:2026; dessen Übergangsregeln haben wir **nicht geprüft**. Zu Bridge Letters: **nichts gefunden** (weder BSI noch Literatur).

**Vorläufige Einschätzung: OFFEN, eher positiv bei Vorliegen der Microsoft-Bestätigungen.**
- Der Bericht ist erst seit Juli 2026 veröffentlicht. Der Folgebericht wird für etwa Juli 2027 erwartet. Nach dem Jahresrhythmus des Marktes dürfte er bis dahin als „aktuell" gelten. Das ist eine Annahme, keine gesicherte Rechtslage.
- Die eigentliche Schwäche ist **Fußnote 6**. Für Azure OpenAI endet der geprüfte Zeitraum am 31.12.2025, die Lücke beträgt also schon heute neun Monate. Unsere Folgerung „ab 2026 unter Foundry mitgeprüft" ist bislang unbelegt. Nötig sind (i) eine schriftliche Bestätigung von Microsoft, dass Azure OpenAI mit Bereitstellungstyp Standard in Sweden Central ab 01.01.2026 unter dem Foundry-Scope geprüft wurde, und (ii) ein Bridge Letter für die Zeit ab 01.04.2026. Beides ist bei Microsoft angefragt; Antworten stehen aus.
- Ein Bridge Letter ist eine Managementerklärung, **kein Testat**. Ob er die Aktualität trägt, ist ungeklärt.

**Offene Punkte.** Reichen Bericht, Foundry-Bestätigung und Bridge Letter als „aktuelles Typ-2-Testat"? Wie lange nach Ende des Prüfzeitraums gilt ein Bericht noch als aktuell? Gibt es dazu Aufsichts- oder BSI-Äußerungen?

### F3 — DSGVO-Rollen, Dokumente, Information der Patienten, Meldekette, DSFA

**Normen.** Art. 28 Abs. 2 DSGVO (Unterauftragsverarbeiter nur mit vorheriger gesonderter oder allgemeiner schriftlicher Genehmigung; bei allgemeiner Genehmigung Information über Änderungen und Einspruchsrecht). Art. 28 Abs. 3 (Vertragsinhalte, insbesondere lit. f: Unterstützung bei Art. 32–36). Art. 28 Abs. 4 (gleiche Pflichten für den Unterauftragsverarbeiter; der erste Auftragsverarbeiter haftet gegenüber dem Verantwortlichen). Art. 28 Abs. 9 (schriftlich, auch elektronisch). Art. 13 Abs. 1 lit. e und f. Art. 33 Abs. 2. Art. 35. Wortlaute zu Art. 28 am 28.09.2026 über dsgvo-gesetz.de abgeglichen, Art. 13/33/35 nicht erneut abgerufen.

**Vorläufige Einschätzung: JA, lösbar mit Standarddokumenten.**
- **Rollen:** Die Praxis ist Verantwortliche. Der Inhaber ist Auftragsverarbeiter (nur für den OCR-Vorgang; für die übrige On-Premise-Nutzung hat er keine Rolle). Microsoft ist Unterauftragsverarbeiter des Inhabers auf Grundlage des Microsoft Products and Services DPA.
- **Dokumente:** AVV Praxis–Inhaber (nur OCR-Vorgang) mit Genehmigung des Unterauftragsverarbeiters Microsoft, Liste der Unterauftragsverarbeiter, Weisungsbindung, Löschung und Rückgabe. Außerdem eine TOM-Anlage: Microsoft-Testat als Nachweis plus eigene Maßnahmen des Inhabers (Schlüsselverwaltung, Policy, Protokollierung). Hinzu kommt die Durchreichung der Microsoft-Bedingungen, soweit Art. 28 Abs. 4 dies verlangt.
- **Art. 13 (Praxis → Patient):** Die Praxis muss mindestens die **Kategorie** der Empfänger angeben (Microsoft ist Empfänger nach Art. 4 Nr. 9). Die Aussage „die Praxis muss Azure nicht kennen" ist nicht haltbar, weil die Praxis Microsoft nach Art. 28 Abs. 2 genehmigen muss. Ob die namentliche Nennung gegenüber Patienten Pflicht ist oder eine Kategorie genügt, ist **offen**; wir empfehlen die Nennung. Serverstandort „EU (Schweden)". Ein Drittlandbezug (US-Mutter, Supportzugriffe) ist über das EU-US Data Privacy Framework gedeckt; das haben wir **nicht vertieft**. Der Inhaber liefert einen Textbaustein.
- **Art. 33:** Meldekette Microsoft → Inhaber → Praxis, jeweils „unverzüglich" (Art. 33 Abs. 2). Die 72-Stunden-Frist gegenüber der Aufsicht läuft bei der Praxis. Im AVV braucht es eine konkrete Frist (Vorschlag: 24 Stunden) und eine Kontaktstelle.
- **DSFA (Art. 35):** Sie ist Pflicht der **Praxis**; der Inhaber unterstützt (Art. 28 Abs. 3 lit. f). Ob eine DSFA für eine Einzelpraxis überhaupt verpflichtend ist, ist offen: „umfangreich" nach Art. 35 Abs. 3 lit. b ist für eine Einzelpraxis zweifelhaft, einschlägige Punkte der DSK-Muss-Liste haben wir **nicht geprüft**. Empfehlung: Der Inhaber stellt einen vorausgefüllten DSFA-Baustein bereit.

**Offene Punkte.** Reicht eine allgemeine Genehmigung mit Änderungsinformation, oder ist eine gesonderte Genehmigung von Microsoft empfehlenswert? Muss Microsoft in der Patienteninformation namentlich genannt werden? Welche Haftungsbegrenzung ist im AVV gegenüber der Praxis angemessen, wenn Microsoft selbst nur begrenzt haftet?

### F4 — § 203 StGB: Kette der mitwirkenden Personen

**Normen (Wortlaut am 28.09.2026 geprüft).**
- § 203 Abs. 3 S. 2 StGB: Die Geheimnisträger „dürfen fremde Geheimnisse gegenüber sonstigen Personen offenbaren, die an ihrer beruflichen … Tätigkeit mitwirken, soweit dies für die Inanspruchnahme der Tätigkeit der sonstigen mitwirkenden Personen erforderlich ist; das Gleiche gilt für sonstige mitwirkende Personen, wenn diese sich weiterer Personen bedienen …".
- Abs. 4 S. 2 Nr. 1: Strafbar macht sich der Geheimnisträger, der „nicht dafür Sorge getragen hat, dass eine sonstige mitwirkende Person … zur Geheimhaltung verpflichtet wurde". Diese Pflicht trifft die **Praxis** gegenüber dem Inhaber.
- Abs. 4 S. 2 Nr. 2: Strafbar macht sich auch, wer „als im Absatz 3 genannte mitwirkende Person sich einer weiteren mitwirkenden Person bedient und nicht dafür Sorge getragen hat, dass diese zur Geheimhaltung verpflichtet wurde". Diese Pflicht trifft den **Inhaber** gegenüber Microsoft. Einschlägig für das Verhältnis Inhaber–Microsoft ist also Nr. 2, nicht Nr. 1.
- Heilmittelerbringer mit staatlich geregelter Ausbildung fallen unter Abs. 1 Nr. 1 („Angehörigen eines anderen Heilberufs").

**Quellen.** innFactory (Tobias Jonas), „§ 203 StGB in der Public Cloud", 13.01.2026, aktualisiert 08/2026, https://innfactory.de/de/blog/138-berufsgeheimnis-203-stgb-public-cloud/ — Microsoft bietet ein „Professional Secrecy Amendment for Germany" bzw. eine „Datengeheimnis-Zusatzvereinbarung" (Stand 11/2021) als Ergänzung zum MCA an, nach der Darstellung dort **über den CSP-Partner**. § 393 SGB V wird nicht behandelt. Microsoft-Q&A-Threads (u. a. vom 07./09.04.2026, https://learn.microsoft.com/en-us/answers/questions/5853763/) — Antwort eines **Community-Moderators, keine verbindliche Microsoft-Aussage**: Anforderung per Support-Ticket „Privacy and compliance requests", Bearbeitung durch Microsoft CELA. Die Gesetzesbegründung von 2017 (BT-Drs. 18/11936) haben wir **nicht eingesehen**.

**Vorläufige Einschätzung: JA, wenn das Amendment erhältlich ist; sonst OFFEN.**
- Die Praxis verpflichtet den Inhaber schriftlich (Textform genügt nach h. M. vermutlich; **nicht verifiziert**). Der Inhaber hat keine Mitarbeitenden mit Datenzugriff. Bereits verpflichtete Personen (Mitgründer) sind dokumentiert.
- Der Inhaber muss Microsoft zur Geheimhaltung verpflichten (Abs. 4 S. 2 Nr. 2). Das geeignete Instrument ist das Professional Secrecy Amendment. **Offen ist, ob Microsoft es für das Abonnement des Inhabers (Vertragsart, kein CSP) abschließt** und ob es auch greift, wenn der Kunde selbst kein Geheimnisträger ist, sondern mitwirkende Person. Beides ist bei Microsoft angefragt.
- „Erforderlich": Für die OCR selbst ist die Erforderlichkeit vertretbar. Für das Abuse Monitoring, das Microsofts eigenen Zwecken dient, ist sie zweifelhaft (siehe F6).

**Offene Punkte.** Genügt Textform für die Verpflichtung? Ist das Amendment inhaltlich eine ausreichende Verpflichtung im Sinne von Abs. 4 S. 2 Nr. 2, auch wenn der Kunde mitwirkende Person ist? Ersatzweise: Reicht eine einseitige Zusage von Microsoft (DPA-Vertraulichkeitsklausel)?

### F5 — Microsoft-Lizenzbedingungen: „Customer Solution" oder unzulässiger Weiterverkauf?

**Quellen.** Microsoft Licensing Guidance „Azure Customer Solution" (ohne Datum; abgerufen 28.09.2026), https://www.microsoft.com/licensing/guidance/Azure-Customer-Solution. Das ist eine **Erläuterung, kein Vertragstext**. Die maßgebliche Stelle im Vertragstext der Product Terms (https://www.microsoft.com/licensing/terms/product/ForOnlineServices/all) haben wir **nicht gefunden**; die Kanzlei sollte sie selbst lesen.

**Zusammenfassung der Guidance.**
- *Customer Solution* ist eine Anwendung, die der Kunde seinen Endnutzern bereitstellt und die den Azure-Diensten „primary and significant functionality" hinzufügt. Sie darf kein bloßer Ersatz der Azure-Dienste sein.
- Anwendungen, die **nur** Abrechnung, Lizenzverwaltung oder Infrastruktur leisten, erfüllen das nicht.
- Dritten darf der Zugriff auf Azure-Dienste „solely in connection with the use of your Customer Solution" gestattet werden.
- Wer Azure ohne eigene Funktionalität weitergeben will, wird an das CSP-Programm verwiesen.
- Für Model-Inferencing-APIs (Foundry, ausdrücklich auch Azure OpenAI) gelten fünf Kriterien:
  1. „Resale is not allowed".
  2. Kein nur dünn umhülltes Modellergebnis.
  3. Einbettung in eigene Anwendungen und Workflows.
  4. Die eigene Leistung ist der Hauptgrund für den Kauf.
  5. Die APIs müssen „within the confines of your platform" bleiben und dürfen „not be distributed separately" werden.
- Weitergegebene Modellkosten sollen „less than half of the total cost of the solution" betragen.

**Vorläufige Einschätzung: vermutlich JA (Customer Solution), mit einem echten Risiko bei Kriterium 5.**
- Kriterien 1–4 und der Kostenanteil sind nach unserer Einschätzung erfüllt. Praxura ist eine vollständige Praxisverwaltung, die OCR ist in den Verordnungs-Workflow eingebettet (Validierung gegen Kataloge, manuelle Prüfung), und die KI-Kosten sind ein kleiner Teil des Gesamtpreises. Die Preise sind noch nicht festgelegt, deshalb ist die 50-%-Grenze vertraglich abzusichern.
- **Kriterium 5 ist das Risiko.** In Modell B liegt ein **roher API-Schlüssel** auf einem Server, den die Praxis administriert. Technisch kann die Praxis den Schlüssel auslesen und außerhalb von Praxura nutzen. Ob das schon „separate distribution" ist oder ob der Server der Praxis noch als „your platform" gilt, sagt die Guidance nicht; On-Premise-Topologien behandelt sie **nicht**.
- Gegenmaßnahmen: vertragliches Nutzungsverbot außerhalb der Software (Softwaremiete/EULA), TPM-Kontingent, IP-Beschränkung, Rotation. Diese Fragen sind bei Microsoft (Ticket) gestellt.
- Lehnt Microsoft ab, bleibt das CSP-Programm (Partnerstatus, Aufwand und Kosten **unbekannt, geschätzt 🟡**) oder Modell C.

**Offene Punkte.** Stellt die Übergabe eines ressourcengebundenen Schlüssels an eine On-Premise-Installation „separate distribution" dar? Ist die Weiterberechnung der Azure-Kosten über die eigene Rechnung zulässig (in der Guidance vorausgesetzt)? Welche Klausel in Softwaremiete/EULA ist nötig?

### F6 — Abuse Monitoring ohne Genehmigung der Modifikation

**Sachstand laut Microsoft-Dokumentation** („Data, privacy, and security…", ms.date 18.05.2026; „Abuse monitoring", ms.date 13.05.2026):
- Klassifikatoren prüfen jede Anfrage automatisiert.
- Auffällige Prompts und Antworten können in einem Datenspeicher **in der Geografie der Ressource** abgelegt und durch „authorized Microsoft employees" geprüft werden, bei EWR-Ressourcen durch Mitarbeiter **im EWR** (SAW, Just-in-Time-Freigabe).
- Mit genehmigtem *Modified Abuse Monitoring* entfallen Speicherung und menschliche Prüfung; die automatisierte Prüfung bleibt. Nachweis über `ContentLogging: false`.
- Die Modifikation steht nur „customers and partners managed by a Microsoft account team or under an eligible program" offen.
- Eine Speicherdauer nennen die heute abgerufenen Seiten **nicht**. Sekundärquellen (innFactory; Microsoft-Q&A-Moderator) nennen bis zu 30 Tage; **nicht amtlich verifiziert**.
- Ob **alle** Prompts gespeichert werden oder nur markierte, geht aus dem aktuellen Text nicht eindeutig hervor.

**Vorläufige Einschätzung: OFFEN. Ohne Genehmigung ist Modell B nicht freizugeben.**
- *§ 203:* Die Speicherung mit Zugriffsmöglichkeit für Microsoft-Personal ist ein Zugänglichmachen, also ein Offenbaren. Mit Professional Secrecy Amendment ist Microsoft verpflichtete mitwirkende Person. Die Erforderlichkeit (Abs. 3 S. 2) für einen Zweck, der Microsoft dient, ist aber zweifelhaft. Ohne Amendment besteht ein Strafbarkeitsrisiko für die Praxis (Abs. 1) und für den Inhaber (Abs. 4 S. 2 Nr. 2).
- *DSGVO:* Offen ist, ob Microsoft beim Abuse Monitoring als Auftragsverarbeiter handelt oder für eigene Zwecke (DPA: „legitimate business operations"). Im zweiten Fall bräuchte es für Gesundheitsdaten eine eigene Rechtsgrundlage nach Art. 9 Abs. 2, und die ist nicht ersichtlich. **Nicht abschließend geprüft.**
- *Praktisch:* Die Wahrscheinlichkeit, dass OCR-Anfragen zu Rezeptbildern als missbräuchlich markiert werden, halten wir für gering; das ist nicht belegt. Rechtlich trägt das nicht, weil schon die Möglichkeit der Einsichtnahme relevant sein kann.
- *Vorteil von Modell B gegenüber C:* Der Inhaber kann als ein Kunde **einmal** die Modifikation beantragen. Eine einzelne Praxis wäre regelmäßig kein „managed customer" und bekäme sie in Modell C voraussichtlich nicht.

**Nachtrag 29.09.2026:** Der Antrag des Inhabers auf Modified Abuse Monitoring wurde **abgelehnt**. Begründung laut Microsoft: „Unmanaged“; Anträge auf den Status als managed customer nimmt Microsoft derzeit nicht an. Damit ist die Voraussetzung für Modell B derzeit nicht erfüllbar, und der oben genannte Vorteil von B gegenüber C („einmal beantragen“) entfällt. Für die heutige SaaS-Nutzung (Rezept-OCR über Azure) gilt der Standard-Abuse-Monitoring-Sachstand unverändert. Die Frage nach § 203 und Art. 9 aus diesem Abschnitt stellt sich damit auch für den SaaS-Betrieb und sollte in den Anwaltsauftrag aufgenommen werden.

**Offene Punkte.** Welche Rolle hat Microsoft beim Abuse Monitoring nach dem Products and Services DPA? Genügt das Amendment ohne Modified Abuse Monitoring (F4), oder ist die Modifikation zwingend?

---

## 3. Vergleich Modell B und Modell C (Praxis hat ein eigenes Azure-Abonnement)

| | **Modell B** (Abo des Inhabers, Ressource je Praxis) | **Modell C** (eigenes Abo der Praxis, Inhaber liefert nur Software) |
|---|---|---|
| Rolle des Inhabers | Auftragsverarbeiter (OCR-Vorgang) | keine Rolle bei Patientendaten (reiner Softwarehersteller) |
| Rolle von Microsoft | Unterauftragsverarbeiter des Inhabers | Auftragsverarbeiter der Praxis |
| § 393 SGB V | Praxis und Inhaber im Anwendungsbereich; **F1 offen** (eigenes Testat?) | Nur die Praxis; Microsoft ist die datenverarbeitende Stelle; der Wortlaut passt unmittelbar. F2 (Fußnote 6) bleibt |
| § 203 StGB | Kette Praxis → Inhaber → Microsoft; Amendment durch den Inhaber (Verfügbarkeit offen) | Praxis → Microsoft; das Amendment müsste die Praxis selbst erlangen (Verfügbarkeit für Kleinstkunden fraglich) |
| Modified Abuse Monitoring | **ein** Antrag durch den Inhaber — **am 29.09.2026 abgelehnt („Unmanaged“)** | je Praxis; für Einzelpraxen voraussichtlich **nicht erreichbar** |
| Lizenzbedingungen (F5) | Customer Solution; Risiko bei Kriterium 5 | kein Thema |
| Dokumente beim Inhaber | AVV, Unterauftragsverarbeiter-Liste, Verpflichtung nach § 203, TOM, DSFA-Baustein, Meldekette | nur neutrale Einrichtungsanleitung und Checkliste; keine Anbieterempfehlung (Falschberatungsrisiko) |
| Hauptrisiko | Bei strenger Lesart von F1 eigenes Testat nötig, also wirtschaftlich ausgeschlossen | Praxis kann die Anforderungen aus § 203 und Abuse Monitoring faktisch nicht erfüllen, die Funktion ist dann ungenutzt |
| Rechtliche Sauberkeit | mittel, hängt von F1, F2 und F5 ab | hoch für den Inhaber, faktische Hürden bei der Praxis |

---

## 4. Checkliste — anwaltlich zu erstellen oder zu prüfen (nur falls Modell B freigegeben wird)

- [ ] **Stellungnahme zu F1, F2, F5** (Kernauftrag, ca. 1–2 h; Kostenrahmen geschätzt 300–600 €)
- [ ] **AVV-Muster** Praxis–Inhaber, beschränkt auf den OCR-Vorgang: Gegenstand und Dauer, Datenkategorien (Art. 9), Weisungen, Unterauftragsverarbeiter Microsoft (Genehmigungsform), Meldefrist nach Art. 33 (Vorschlag 24 h), Unterstützung bei Art. 32–36, Löschung, Kontrollrechte (Verweis auf das Microsoft-Testat samt Weitergabeauflagen des Berichts), Haftung
- [ ] **Verpflichtung nach § 203 Abs. 4 S. 2 Nr. 1 StGB** (Praxis → Inhaber), mit Belehrung über die Strafbarkeit
- [ ] **Prüfung des Professional Secrecy Amendment** (sobald von Microsoft erhalten) auf Eignung nach Abs. 4 S. 2 Nr. 2
- [ ] **TOM-Ergänzung**: Microsoft-Testat samt Umsetzung der CUEC durch den Inhaber, Schlüsselverwaltung, Azure Policy, Protokollierung, `store:false`, Bereitstellungstyp Standard in Sweden Central
- [ ] **Klausel in Softwaremiete/EULA**: Nutzung des Schlüssels nur innerhalb der Software, Weitergabeverbot, Sperre bei Missbrauch, Weiterberechnung der Kosten
- [ ] **Textbaustein Patienteninformation** (Art. 13) für die Praxis
- [ ] **DSFA-Baustein** für die Praxis (Prüfung, ob verpflichtend)

Voraussetzungen, die nicht bei der Kanzlei liegen (bei Microsoft angefragt): schriftliche Bestätigung des Foundry-Scopes ab 01.01.2026 für Sweden Central; Bridge Letter; Verfügbarkeit des Amendments; Genehmigung des Modified Abuse Monitoring; Antwort zur Einstufung als Customer Solution.

---

## 5. Grenzen dieses Memos

- Das Memo wurde **mit KI-Unterstützung** erstellt und ist **keine Rechtsberatung**. Es soll die anwaltliche Prüfung vorbereiten und abkürzen.
- **Nicht zugänglich:** beck-online, juris und Kommentarliteratur (u. a. zu § 393 SGB V und § 203 StGB), Gesetzesmaterialien (BT-Drs. 18/11936 zu § 203; Materialien zu § 393 SGB V), die BMG-Primärquelle hinter dem activeMind-Zitat, der Inhalt des Simpliant-Gutachtens, die maßgebliche Stelle im Vertragstext der Product Terms und der Text des Professional Secrecy Amendment.
- Rechtsprechung zu § 393 SGB V haben wir **nicht gefunden**.
- Microsoft-Angaben stammen aus öffentlicher Dokumentation (Stand Mai/Juni 2026) und aus dem C5-Bericht. Microsoft kann sie ändern. Aussagen von Community-Moderatoren sind nicht verbindlich.
- Kostenangaben sind Schätzungen ohne eingeholte Angebote.
- Sachverhaltsannahmen, die der Mandant bestätigen muss: Vertragsart des Azure-Abonnements (Direktkunde, kein CSP), Vertragspartner auf Microsoft-Seite, keine Datenweiterleitung über Infrastruktur des Inhabers.
