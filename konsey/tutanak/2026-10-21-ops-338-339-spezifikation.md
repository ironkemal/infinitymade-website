# Ops #338 / #339: Fachspezifikation (VKZ-02-Nachforderung · „VO folgt“)

Datum: 21.10.2026 · Verfasser: gkv-302 · Status: **geplant** (nur Spezifikation; kein Code, keine DB, kein Git)
Grundlage: `konsey/tutanak/2026-10-21-ops-umsetzungsplan.md:70-71` (Tabellenzeilen #338, #339).
Spezifikationsstand: Anlage 1 TP5 **V21** (anzuwenden ab 01.10.2025, Stand 15.01.2026) ·
Anlage 3 TP5 **V21** (anzuwenden ab 01.10.2025, Stand 19.09.2025) · Gemeinsame
Umsetzungsempfehlungen Korrekturverfahren Heilmittel (Stand 13.02.2025, in Kraft 01.10.2025) ·
HeilM-RL i. d. F. 15.05.2025 (iK 05.08.2025) · Podologie Anlage 3 i. d. F. 16.06.2025.
Leistungserbringergruppe: **Podologie zuerst**; Aussagen zu anderen Bereichen sind markiert.

> **Grenzen dieses Dokuments.** Es erteilt keine Rechts- oder Kassenfreigabe. Es legitimiert
> keine Behandlung ohne Verordnung nachträglich. Der Kartentext auf dem Ops-Board lag nicht
> im Repo vor; Grundlage ist ausschließlich die Planzeile. Beispieldaten sind synthetisch.
> Keine Patientendaten, keine Secrets.

Kennzeichnung: **[Q]** = wörtlich belegt aus dem wissensbank-Original (Pfad:Zeile) ·
**[A]** = Ableitung aus belegten Sätzen, kein Einzelsatz im Original · **[U]** = unbelegt.

---

## Teil A: #338 VKZ-02-Nachforderung

### A1 Fachlicher Sachverhalt mit Quelle

| # | Aussage | Beleg |
|---|---|---|
| A1.1 | VKZ-Werte: `01` Abrechnung ohne Besonderheiten, `02` Nachforderung, `03` Zuzahlungsforderung, `04` Korrekturrechnung, `10` Wiederaufnahme. „Die Anwendbarkeit der Schlüsselwerte (außer "01") ergeben sich aus der Tabelle in Anlage 1, Abschnitt 7.1.“ | **[Q]** Anlage 3 TP5 V21 §8.1.7, `wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919.txt:819-834` |
| A1.2 | Heilmittel: zulässige VKZ `02, 03, 04`, verpflichtend ab 01.07.2020. `10` nur „Heilmittel (Physiotherapie)“. Für Podologie gibt es also **kein VKZ 10**. | **[Q]** Anlage 1 TP5 V21 §7.1, `…/Anlage_1_TP5_V21_20260115.txt:8015-8022` |
| A1.3 | Inhalt einer Nachforderung: „Inhaltlich dürfen nur die Abrechnungspositionen, Mengen- und/oder Preisdifferenzen aufgeführt werden, die bei der Erstrechnung (Verarbeitungskennzeichen '01') oder bei der Wiederaufnahme (Verarbeitungskennzeichen '10') nicht abgerechnet wurden.“ Anlass: Leistungen „durch den Rechnungssteller nicht berücksichtigt (z. B. Menge, falsche oder fehlende Positionen, zu niedrige Einzelpreise)“. | **[Q]** Anlage 1 V21 §7.4.1, `:8138-8149` |
| A1.4 | **Anspruch zum Zeitpunkt der Ursprungsrechnung:** VKZ 2 ist zulässig, „wenn bei einer Ursprungsrechnung (VKZ 1) Leistungen nicht berechnet worden sind, für die jedoch bereits ein Anspruch auf Vergütung bestand. Dies schließt eine Ergänzung/Änderung rechnungsbegründender Unterlagen im Rahmen einer Nachforderung aus.“ | **[Q]** UE Korrekturverfahren Frage 1, `…/Gemeinsame_Umsetzungsempfehlungen_zum_Korrekturverfahren_Heilmittel_20250213.txt:77-91` |
| A1.5 | Typisches Beispiel: „Hausbesuch wurde bei der Erstrechnung versehentlich vergessen“. | **[Q]** UE Grundsatz, `:17` |
| A1.6 | Kein Urbeleg nötig: Die Originalverordnungen liegen der Kasse aus der Ursprungsrechnung vor, „die Nachforderung (VKZ 2) [kann] alleine über den Datensatz wieder eingereicht werden“. | **[Q]** UE Frage 2, `:93-103` |
| A1.7 | Vorrang der Ursprungsrechnung: Geht VKZ 2 vor der VKZ-1-Rechnung ein, wird sie „abgesetzt oder bereits von der Datenannahmestelle abgewiesen“. | **[Q]** UE Frage 18, `:488-497` |
| A1.8 | Voraussetzung jedes Korrekturverfahrens: „erfolgreiche[r] Dateneingang der … Ursprungsrechnung beim Kostenträger“, d. h. Prüfstufen 1–3 fehlerfrei durchlaufen. | **[Q]** Anlage 1 V21 §7.2, `:8045-8055` |
| A1.9 | URI ist Pflicht: „Hierbei sind stets die Informationen der Ursprungsrechnung (vgl. Segment „URI“) anzugeben.“ Die fünf URI-Felder (Ursprungs-IK, Sammel-/Einzelrechnungsnummer, Rechnungsdatum, Belegnummer) „dürfen nicht verändert werden“. | **[Q]** Anlage 1 V21 §7.2 `:8038-8042`, §7.3 `:8082-8131`; Segmenttabelle §5.5.3.1 `:1807-1818` (URI für 02/03/04) |
| A1.10 | Pro Datei nur **ein** VKZ: „Je Verarbeitungskennzeichen ist eine eigene Datei zu übermitteln.“ | **[Q]** Anlage 1 V21 §7.3, `:8133-8135`; UE Grundsatz `:22-24` |
| A1.11 | Mehrere VKZ-02-Rechnungen zu einer Erstrechnung sind zulässig. VKZ 03/04 dürfen sich auch auf eine VKZ 02 beziehen. | **[Q]** Anlage 1 V21 §7.2, `:8062-8068`; §7.3 Nr. 3, `:8101-8102` |
| A1.12 | Preisdifferenz: Nachberechnung „der Differenzbeträge mit dem Verarbeitungskennzeichen „2““. Es werden **nur Differenzbeträge** pro Termin im Feld „Einzelbetrag der Abrechnungsposition“ angegeben. | **[Q]** UE Frage 14 `:366-376`, Frage 19 `:507-525` |
| A1.13 | Mischkorrektur: Zu wenig Berechnetes läuft über VKZ 2 (nur Differenz, korrekte Positionsnummer). Zu viel Berechnetes meldet der LE der Kasse; das ist **kein** VKZ-02-Fall. | **[Q]** UE Frage 6, `:160-180`; Frage 5 (siehe SPEC-RULES „LE'nin kendi keşfettiği aşırı faturalama“) |
| A1.14 | Absetzung durch die Kasse wird angefochten → **VKZ 4**, nicht VKZ 2. Eine Nachforderung zu einem anderen Sachverhalt auf demselben Beleg bleibt VKZ 2. Der VKZ-4-Einspruch geht „vor bzw. zeitgleich“ mit der VKZ-02-Nachforderung ein. | **[Q]** UE Frage 3 `:105-120`, Frage 16 `:404-440`, Frage 17 `:442-486` |
| A1.15 | Nicht betragsrelevante Felder (z. B. Diagnosegruppe, Ausstellungsdatum) dürfen in VKZ 2 abweichen, „wenn dies für die Nachforderung … entscheidend ist“. | **[Q]** UE Frage 15, `:378-400` |
| A1.16 | Podologie: Abrechnung „nach Beendigung der entsprechenden Verordnung“. Bestätigungsfeld: „Die Unterschrift des Versicherten muss vor Einreichung der Abrechnung erfolgt sein.“ | **[Q]** Podologie Anlage 3 lit. p, `wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:689-694` (via SPEC-RULES); lit. o, `:633-660` |
| A1.17 | **Folgerung:** Eine Sitzung, die **nach** dem Rechnungsdatum der Ursprungsrechnung erbracht wurde, hatte zu diesem Zeitpunkt keinen Vergütungsanspruch und ist über VKZ 2 nicht abrechenbar. Ihr nachträglich unterschriebenes Bestätigungsfeld wäre eine Ergänzung rechnungsbegründender Unterlagen und ist damit ausgeschlossen. | **[A]** aus A1.4 + A1.16; bereits als Kursregel in `wissensbank/SPEC-RULES.md:949-1003` |
| A1.18 | GES-Beträge: Für VKZ 01/02/04 ist Gesamtrechnungsbetrag = Gesamtbruttobetrag − Zuzahlung. | **[Q]** über SPEC-RULES `:1091-1100` (Anlage 1 V21 §5.5.2) |
| A1.19 | Zuzahlung auf nachgeforderte Positionen (z. B. vergessener Hausbesuch): Ist sie in VKZ 2 regulär abzuziehen? | **[U]** In §7.4.1 und in der UE nicht ausdrücklich geregelt (UE Frage 13 betrifft VKZ 3) |
| A1.20 | Ausschlussfrist für Nachforderungen (wie lange nach VKZ 01 noch zulässig) | **[U]** im Archiv nicht gefunden; Rahmenvertrag Podologie § 125 **Haupttext fehlt im Archiv** (SPEC-RULES `:991-995`) |

### A2 Vorhandene Funktionen und Felder zur Wiederverwendung

| Baustein | Fundstelle | Verwendung für VKZ 02 |
|---|---|---|
| VKZ-Schlüsselliste + Validator | `api-backend/billing/codes/anlage3_v22.js:20-26`, `:237` | unverändert; ⚠️ lässt `10` für jeden Bereich zu (A1.2), Allowlist je Bereich fehlt |
| DB-Spalte VKZ je Datei | `db/SCHEMA.sql:171` `abrechnung.verarbeitungskennzeichen`, CHECK `:215` (`01`–`04`, `02` bereits erlaubt) | Datei als VKZ 02 kennzeichnen, keine Schemaänderung dafür |
| Unveränderlicher Belegschnappschuss | `db/SCHEMA.sql:411-440` `abrechnung_zeile` (`belegnummer`, `einzel_rechnungsnummer`, `leistungen` jsonb, `brutto/zuzahlung/netto_eur`, `status`) | **Ursprungsposition** = `leistungen` der VKZ-01-Zeile. Erzeugt von `api-backend/billing/utils/abrechnung-zeilen.js:69-76` (`leistungenAusSessions`: datum, positionsnummer, anzahl, einzelbetrag) und `:98` (`zeilenAusDta`) |
| URI-Segment-Builder | `api-backend/billing/dta/segments.js:185-199` (`buildSLLA_URI`) | unverändert |
| URI-Einbau im Builder | `api-backend/billing/dta/builder.js:410-474` (VKZ 03 mit Pflichtprüfung), `:475-483` (VKZ ≠ 01 **nur falls `urspruenglich` gesetzt**) | ⚠️ Für VKZ 02 fehlt die Pflichtprüfung: ohne `urspruenglich` entsteht **stillschweigend eine Datei ohne URI**. Folge: Verstoß gegen §7.2 (A1.9), die Datei lässt sich nicht zuordnen, Absetzung droht. Die Prüfungen aus `:410-466` müssen für `02` (und `04`) gelten. |
| Preflight-URI-Prüfung | `api-backend/billing/dta/preflight.js:527-531` (nur VKZ 03) | auf 02 ausdehnen |
| Vorlage einer Korrekturroute | `api-backend/billing/api/abrechnung.routes.js:4509-4945` (`POST /abrechnung/korrektur`, VKZ 04): Mandantenprüfung, Ursprungszeile+Abrechnung laden, URI-Vollständigkeit `:4605-4612`, eine Kasse/ein Bereich je Datei `:4614-4626`, Nummernvergabe `:139` `vergebeNummern` | **Aufbau übernehmen, Inhalt NICHT:** VKZ 04 baut aus der **lebenden** Verordnung alle nicht stornierten Behandlungen (`:4659-4662`, `:4695-4702`). Für VKZ 02 würde genau das die bereits bezahlten Positionen **doppelt** abrechnen. |
| Ursprungsdatei-Parser | `api-backend/billing/dta/zuzahlungsforderung-ursprung.js:497-509` (prüft Ursprungs-VKZ aus FKT) | Gegenprobe: `leistungen`-Schnappschuss gegen die tatsächlich übermittelte EDIFACT-Datei |
| Ursprungsverweis je Datei | `db/SCHEMA.sql:221-224` `abrechnung.zuzahlungsforderung_ursprung_id` → `abrechnung_zeile` (nur VKZ 03, CHECK erzwingt) | Muster für einen VKZ-02-Ursprungsverweis; heute **kein** Feld für 02 |
| Empfangsnachweise Podologie | `api-backend/billing/utils/podo-empfangsnachweis.js:55` (`pruefePodologieEmpfangsnachweise`); Tabelle `db/SCHEMA.sql:2570` (`geprueft_am`, `behandlungsdatum`, `hpnr_code`) | Nachweis, dass die nachgeforderte Leistung vor der Einreichung bestätigt war (A1.16) |
| Übermittlungsprotokoll | `db/SCHEMA.sql:302-330` `abrechnung_uebermittlung` (`fehlerstatus`, `verarbeitungskennzeichen`) | Gate „Ursprungsrechnung Prüfstufe 1-3 bestanden“ (A1.8) |
| VKZ-01-Ausnahmeweg | `abrechnung.routes.js:4949-5025` | Abgrenzung: Datei abgewiesen bzw. Urbelege fehlten → VKZ 01, nicht 02 |
| Podo-DTA-Mapping | `abrechnung.routes.js:3613` (`mapVerordnungToDtaShape`) | Positionen aus Behandlungen. Für VKZ 02 nur auf die **Differenzmenge** anwenden |

Bestandsaufnahme: In `api-backend/billing` und `module/` gibt es **keinen** Produktivpfad, der VKZ `02` erzeugt
(grep `vkz`/`Nachforderung`). Gesetzte Werte im Code: `'01'` (`abrechnung.routes.js:986`, `:4141`), `'04'` (`:4779`), `'03'` (eigene Route `:5107`).

### A3 Zulässige und unzulässige Fälle

**Zulässig (VKZ 02):**
1. Eine Position wurde in der VKZ-01-Rechnung vergessen, obwohl die Leistung **am oder vor dem Rechnungsdatum der Ursprungsrechnung** erbracht war und ihre Bestätigung auf der eingereichten Verordnung stand. Standardbeispiel: Hausbesuch. (A1.4, A1.5)
2. Die Menge war zu niedrig: Eine dokumentierte und bestätigte Einheit fehlte in der Datei. (A1.3)
3. Der Preis war zu niedrig: Es wird nur die Differenz je Termin nachgefordert. (A1.12)
4. Eine zu günstige Position wurde abgerechnet: Nachgefordert wird die Differenz unter der korrekten Positionsnummer. (A1.13)
5. Weitere Nachforderung auf eine Erstrechnung, die schon eine VKZ 02 hatte, sofern die Position in **keiner** früheren 01/02-Datei enthalten ist. (A1.11)
6. Nachforderung auf einen teilweise abgesetzten Beleg zu einem **anderen** Sachverhalt. Abgesetzte Termine werden ausgenommen, oder es wird die Reihenfolge 04 vor/zeitgleich mit 02 eingehalten. (A1.14)

**Unzulässig:**
1. Eine Sitzung, die **nach** dem Rechnungsdatum der Ursprungsrechnung erbracht wurde. Das gilt auch für weitere Einheiten derselben Verordnung. (A1.17)
2. Eine Leistung, deren Bestätigung (Unterschrift) erst nach der Einreichung eingeholt wurde. (A1.4, A1.16)
3. Jede Position oder Teilmenge, die bereits in der VKZ-01-Datei oder einer früheren VKZ-02-Datei zu demselben Beleg steht. Das ist Doppelabrechnung. (A1.3)
4. Eine Nachforderung ohne URI oder mit veränderten URI-Werten. (A1.9)
5. Eine Nachforderung, bevor die Ursprungsrechnung Prüfstufe 1–3 bestanden hat. (A1.7, A1.8)
6. Eine VKZ-02-Datei, die Belege mit anderem VKZ enthält. (A1.10)
7. Einspruch gegen eine Absetzung der Kasse. Das ist VKZ 04. (A1.14)
8. Selbst entdeckte Überzahlung. Das ist kein VKZ-Fall; der LE meldet sie der Kasse. (A1.13)
9. Podologie mit VKZ 10. (A1.2)
10. Nicht-GKV-Verordnungen (`rezeptart ≠ 'kassen'`). Das bestehende Gate dafür steht in `abrechnung.routes.js:4687-4693`.

### A4 Doppelabrechnungsschutz (Sollregel, fachlich)

Die nachforderbare Menge für einen Beleg wird so ermittelt:
`nachforderbar = dokumentiert_und_bestätigt(Leistungsdatum ≤ Ursprungs-Rechnungsdatum) − Σ leistungen(VKZ-01-Zeile) − Σ leistungen(alle VKZ-02-Zeilen mit derselben URI)`.
Vergleichsschlüssel: (Leistungsdatum, Positionsnummer, Anzahl). Preisdifferenzen laufen gesondert über (Leistungsdatum, Positionsnummer, Einzelbetrag-Differenz).
Die VKZ-01-Zeile bleibt unverändert: Kein Update auf `leistungen`. Jede Nachforderung erhält eine **eigene** `abrechnung_zeile` mit Verweis auf die Ursprungszeile.

### A5 Offene Fragen

| # | Frage | Zuständig |
|---|---|---|
| F338-1 | Wird die Zuzahlung auf nachgeforderte Positionen regulär abgezogen, und welches Zuzahlungskennzeichen gilt in VKZ 02, wenn die Ursprungsrechnung KZ „3“ hatte? (A1.19) | gkv-302 (Quelle fehlt; ggf. Kasse/GKV-SV-Anfrage, Melih entscheidet über Anfrage) |
| F338-2 | Gibt es eine Ausschlussfrist für Nachforderungen? Der Rahmenvertrag Podologie § 125 (Haupttext i. d. F. 30.11.2020) muss beschafft werden. (A1.20) | gkv-302 + wissensbank |
| F338-3 | Woraus wird der Zeitpunkt „Anspruch bestand“ abgeleitet? Vorschlag: Leistungsdatum ≤ `abrechnung.created_at` der Ursprungsdatei (laut Code-Kommentar `abrechnung.routes.js:4542-4543` = Rechnungsdatum) **und** Empfangsnachweis `geprueft_am` ≤ Einreichung. `geprueft_am` ist der Prüfzeitpunkt der Praxis, nicht das Unterschriftsdatum des Versicherten. Reicht das als Nachweis? | podoloji (Praxisablauf) + gkv-302 |
| F338-4 | Ursprungsverweis für VKZ 02: Neue Spalte, Verallgemeinerung von `zuzahlungsforderung_ursprung_id` oder Verweis auf Zeilenebene? Und die Unique-Regel gegen Doppelpositionen: DB-Constraint oder Prüfung in der Anwendung? | db-ustasi (Schemaentscheidung vor Code laut Plan) |
| F338-5 | Woran erkennt man den Nachweis „Prüfstufe 1–3 bestanden“? Ist `abrechnung_uebermittlung.fehlerstatus` belastbar, solange die Annahmebestätigung (Ops #31) offen ist? | gkv-302 + db-ustasi |
| F338-6 | Alt-Zeilen `herkunft='rekonstruiert'` bzw. Dateien vor 09.09.2026 ohne vollständige URI-Daten: Gilt dafür wie bei VKZ 04 Papier/Kassenportal (`abrechnung.routes.js:4605-4612`)? | gkv-302 + Melih |
| F338-7 | Die Praxis-IK wird für die URI abgeleitet statt gespeichert (`:4538-4541`). Nach einem IK-Wechsel trägt die URI das neue IK, verlangt sind aber „nicht verändert“ (A1.9). Ist eine eigene Spalte nötig? | db-ustasi + gkv-302 |
| F338-8 | Wie wird bedient, dass eine Podologie-Verordnung nur „nach Beendigung“ abgerechnet wird (A1.16)? Konkret: Wie sieht die Praxis überhaupt, dass in VKZ 01 etwas fehlte (Abgleich Dokumentation ↔ `leistungen`)? | podoloji + Melih (Produkt) |
| F338-9 | Allowlist für VKZ je Leistungserbringergruppe (10 nur Physio) im Validator | gkv-302 → builder |

### A6 Synthetische Testfälle (#338)

Alle Daten erfunden. Ursprungsrechnung U: VKZ 01, Sammel-RNr `TEST-A1`, Einzel-RNr `1`, Rechnungsdatum 01.09.2026, Belegnummer `7`, Prüfstufe 1–3 bestanden. Position `78010` (Podologie, Positionsnummer laut SPEC-RULES `:151-175`). `HB` steht als Platzhalter für die Hausbesuchsposition aus Podologie Anlage 2. **Keine** Nummer ist hier erfunden.

| ID | Eingabe | Erwartung |
|---|---|---|
| T338-01 | Behandlung 20.08.2026 mit HB dokumentiert und bestätigt (vor 01.09.). U enthält nur 78010 am 20.08. | VKZ-02-Datei mit genau 1× HB am 20.08. URI = (IK, TEST-A1, 1, 01.09.2026, 7). Belegnummer bleibt 7. |
| T338-02 | Wie T338-01, die Nachforderung wird ein zweites Mal ausgelöst | Abgelehnt: Position schon in einer VKZ-02-Zeile mit derselben URI. Es entsteht keine Datei. |
| T338-03 | Behandlung 10.09.2026 (nach dem Rechnungsdatum) derselben Verordnung | Abgelehnt mit Verweis auf UE Frage 1 / A1.17. Es entsteht keine Datei. |
| T338-04 | 78010 am 20.08. steht in U bereits mit Anzahl 1 | Nachforderbar: 0. Abgelehnt. |
| T338-05 | U mit Einzelbetrag 10,00 abgerechnet, vertragsgültig 11,50 (fiktive Werte) | VKZ 02 mit Einzelbetrag **1,50** je betroffenem Termin, keine Vollbeträge |
| T338-06 | Ursprungsdatei `fehlerstatus` = abgewiesen (Prüfstufe 2) | VKZ 02 gesperrt; Hinweis auf den VKZ-01-Ausnahmeweg |
| T338-07 | Builder-Aufruf `vkz='02'` ohne `urspruenglich` | Harter Fehler (heute: stille Datei ohne URI, `builder.js:475`) |
| T338-08 | Zwei Belege aus verschiedenen Kassen in einer Nachforderung | Abgelehnt (eine Kasse je Datei, analog `:4614-4620`) |
| T338-09 | Beleg Status `abgesetzt`, Wunsch „vergessenen HB nachfordern“ für den abgesetzten Tag | Kein reines VKZ 02. Erst VKZ 04 vor oder zeitgleich (A1.14); für die anderen Tage ist VKZ 02 zulässig |
| T338-10 | Bestätigung (Empfangsnachweis `geprueft_am`) liegt nach dem Einreichungszeitpunkt von U | Abgelehnt (A1.16), bis F338-3 entschieden ist |
| T338-11 | `rezeptart='privat'` | Abgelehnt (§302 nur GKV) |
| T338-12 | Podologie mit `vkz='10'` | Abgelehnt (A1.2) |
| T338-13 | Erfolgreiche VKZ-02-Datei | `abrechnung_zeile` von U ist byte-gleich zu vorher (`leistungen`, Beträge, Status) |

---

## Teil B: #339 „VO folgt“

> ⚠️ **Namenskollision:** `vo_folgt` existiert bereits als **DSGVO-Aufbewahrungskategorie**
> („folgt der Verordnung“) in `api-backend/dsgvo/klassifikation.js:104,110,116`. Das ist eine
> andere Bedeutung. Für #339 darf der Begriff weder als Spalten- noch als Statuswert verwendet
> werden. Vorschlag: „Verordnung ausstehend“.

### B1 Fachlicher Sachverhalt mit Quelle

| # | Aussage | Beleg |
|---|---|---|
| B1.1 | „Die Behandlung kann nur durchgeführt werden, wenn auf dem Verordnungsvordruck die erforderlichen Angaben gemäß § 13 Absatz 2 enthalten oder die Voraussetzungen des § 13a Absatz 1 erfüllt sind.“ | **[Q]** HeilM-RL § 16 Abs. 1, `wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt:683-686` |
| B1.2 | „Ein Vergütungsanspruch des zugelassenen Leistungserbringers gegenüber der Krankenkasse setzt voraus, dass die Heilmittelbehandlung auf der Grundlage einer gemäß § 16 Absatz 1 HeilM-RL ordnungsgemäßen vertragsärztlichen Verordnung durchgeführt wurde.“ Beginn ist möglich, wenn Personalienfeld, Diagnose, konkretes Heilmittel sowie Stempel und Unterschrift vorliegen. | **[Q]** Podologie Anlage 3 Ziffer 3, `wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:70-85` |
| B1.3 | Fehlen Versicherten- oder Kostenträgerangaben, die Arzt-Nr. oder das Ausstellungsdatum, „kann die Behandlung nicht begonnen werden“. | **[Q]** Podologie Anlage 3 Ziffer 5 a, `:270-280` |
| B1.4 | „Die Behandlung hat innerhalb von 28 Kalendertagen nach Verordnung zu beginnen“, bei dringlichem Bedarf innerhalb von 14 Tagen. Sonst „verliert die Verordnung ihre Gültigkeit“. | **[Q]** HeilM-RL § 15 Abs. 1-2, `:677-682` |
| B1.5 | **Leistungen vor dem Ausstellungsdatum sind nicht zulasten der GKV abrechenbar.** | **[A]** aus B1.1 + B1.2 („auf der Grundlage einer … Verordnung“) + B1.4 („nach Verordnung“). Einen Einzelsatz „Leistung vor Ausstellungsdatum ist ausgeschlossen“ habe ich im Archiv **nicht gefunden**. `regel-schwere.js:132` nennt als Quelle nur „HeilM-RL“ ohne Paragraf. |
| B1.6 | Eine nachgereichte Verordnung legitimiert vorher erbrachte Termine nicht rückwirkend. | **[A]** wie B1.5. Eine ausdrückliche Gegenregel (etwa „nachträgliche Ausstellung deckt Vorbehandlung“) habe ich nicht gefunden. Fehlt der Rahmenvertrag-Haupttext, bleibt die Aussage **unbestätigt**. |
| B1.7 | Korrekturen an der Verordnung bis zur Abrechnung, je nach Feld nur arztseitig. Bei Muster 13E ist für Versicherten-, Kostenträger- und Arztangaben „eine nachträgliche Korrektur nicht möglich, es ist eine neue Verordnung auszustellen“. | **[Q]** Podologie Anlage 3 Ziffer 4 Abs. 1 `:89-93`, Ziffer 5 a `:293-301` |
| B1.8 | Produktentscheidung: „GKV bleibt bei ‚ohne Rezept‘ draußen: ohne Verordnung keine Kassenleistung. Wer das Rezept ‚bald‘ hat, wählt die Rezept-Karte“ mit dem Hinweis „Rezept liegt vor oder wird vom Arzt noch ausgestellt — bitte zum Termin mitbringen“. | Produktentscheidung, keine Normquelle: `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md:573-574, 589-591`; `module/anfrage-anliegen.js:17` |
| B1.9 | Ob eine Praxis einen Termin **planen** darf, bevor die Verordnung vorliegt | **[U]**, keine Norm gefunden. Die Terminplanung ist keine Abrechnung; die Grenze liegt erst bei der **Erbringung** (B1.1). |

**Fachliche Trennung (Kern von #339):**
- *Planungsvorgang* „Verordnung ausstehend“ = Termin mit Absicht Kasse, noch ohne gebundene Verordnung. Er erzeugt **keinen** Abrechnungsanspruch, startet keine Frist und setzt keinen `behandlungsbeginn`.
- *Abrechenbare Verordnung* = Datensatz `prescriptions` mit Ausstellungsdatum und Pflichtangaben. Erst ab hier gelten B1.2 bis B1.4.

### B2 Vorhandene Funktionen und Felder zur Wiederverwendung

| Baustein | Fundstelle | Bewertung |
|---|---|---|
| Zuordnung Termin → Verordnung | `bookings.verordnung_id`, `bookings.rezeptart` (`db/SCHEMA.sql`, Tabelle bookings; **kein CHECK** auf `rezeptart`) | Zustand „ausstehend“ ableitbar: `rezeptart='kassen' AND verordnung_id IS NULL` (F339-1) |
| Rezeptart in der Maske | `module/termin-verordnung.js:474` `setzeRezeptartInMaske`, `:484` `rezeptartAusMaske` | wiederverwenden |
| Binden/Lösen | `module/verordnung-termine.js:194` `bindeTermin`, `:205` `loeseTermin`. Speichern: `module/termin-verordnung.js:427` `aktualisiereBindungBeimSpeichern`. Serie: `module/podo-einheiten.js:198`, `:261` (Kappung an der verordneten Menge `:276-286`) | ⚠️ `bindeTermin` prüft **kein Datum**: Ein Termin vor dem Ausstellungsdatum lässt sich binden |
| Kandidatenliste | `module/verordnung-termine.js:67-96` `ladePodoTermine` (offene Termine ohne `verordnung_id`, kein Datumsfilter). UI: `module/verordnung-detail.js:433` „Termine ohne Verordnung“ mit Knopf „zuordnen“ | ⚠️ Zeigt auch vergangene Termine, die **vor** dem Ausstellungsdatum liegen, als zuordenbar an. Das ist genau der Legitimierungspfad, den der Plan ausschließt. |
| Fristprüfung Erstbeginn | `module/heilmittel-fristen.js:52`, `:80` `pruefeBehandlungsbeginn`; `module/frequenz-pruefung.js:361-374` `pruefeErsttermin` (nur Podo, Block) | ⚠️ prüft nur **zu spät**; `terminTag < ausstellungsdatum` ergibt `ok:true` (`heilmittel-fristen.js:84`) |
| Beginn-vor-Ausstellung (Verordnungsebene) | `module/verordnung-pruefung.js:376-380` `BEGINN_VOR_AUSSTELLUNG` (Blocker); `api-backend/ai/validators/standardRules.js:118-123` `START_BEFORE_AUSSTELLUNG` | wiederverwenden; prüft `behandlungsbeginn`, nicht jeden Termin |
| Letztes Gate vor der Datei | `api-backend/billing/dta/preflight.js:619-621` `S:01004` „Leistungsdatum liegt vor Ausstellungsdatum“ (hart, `regel-schwere.js:132`). Podo-Pfad: `ausstellungsdatum` aus `abrechnung.routes.js:3714` | ✅ verhindert die Abrechnung, greift aber erst bei der Dateierzeugung |
| Behandlung ohne Verordnung starten | `module/podo-behandlungen-oeffnen.js:123-135` (keine laufende VO → Warnung, nichts wird geöffnet) | ✅ es entsteht keine Podo-Behandlung ohne Verordnung |
| Behandlungsbeginn ableiten | `module/behandlungsbeginn.js:29` `leiteBehandlungsbeginnAb` | Sollregel: nur aus gebundenen Terminen ≥ Ausstellungsdatum |
| Selbstzahler-Weg | `module/leistungen-liste.js:40` („Ohne Verordnung, Patient zahlt selbst“), `module/eingangsbefundung-regel.js:177` | Für Leistungen vor der Verordnung der einzige saubere Weg, **nur nach Patientenvereinbarung**; das ist keine GKV-Umbuchung (F339-4) |

### B3 Zulässige und unzulässige Fälle

**Zulässig:**
1. Ein Termin wird als „Verordnung ausstehend“ (Kasse) geplant. Er erscheint nicht in der Abrechnungsliste, und es wird kein `behandlungsbeginn` gesetzt.
2. Die Verordnung trifft **vor** dem Termin ein, und Ausstellungsdatum ≤ Termin ≤ Beginnfrist. Bindung mit der bestehenden Zuordnung; Fristprüfung wie heute.
3. Die Verordnung trifft ein, und es wird nur ein Teil der Serie gebunden, zeitlich die ersten Termine bis zur verordneten Menge (Bestand `podo-einheiten.js:276-286`).
4. Die Verordnung kommt nicht: Der Termin wird abgesagt oder **nach ausdrücklicher Vereinbarung mit dem Patienten** als Selbstzahler geführt. Der Selbstzahlerstatus wird nicht automatisch gesetzt.

**Unzulässig:**
1. Einen Termin binden, der **vor** dem Ausstellungsdatum liegt (B1.5). Das gilt auch, wenn er bereits erbracht wurde.
2. Das Ausstellungsdatum an einen früheren Termin anpassen, damit er passt. Das wäre eine Verfälschung; das Datum ist ein arztseitiges Feld (B1.7).
3. Einen „ausstehenden“ Termin als Behandlung zulasten der GKV dokumentieren (B1.1–B1.3).
4. Aus einem „ausstehenden“ Termin automatisch `behandlungsbeginn` setzen oder eine Beginnfrist rechnen.
5. Abrechnung oder VKZ 02 für Leistungen vor der Verordnung, auch nicht als „vergessene Position“ (A3 unzulässig 1–2).
6. Ein Termin, der nach Ablauf der Beginnfrist gebunden wird, als ersten Termin behandeln (Bestand blockiert, B1.4).

### B4 Offene Fragen

| # | Frage | Zuständig |
|---|---|---|
| F339-1 | Reicht der abgeleitete Zustand (`rezeptart='kassen'` + `verordnung_id IS NULL`), oder braucht es ein eigenes Feld bzw. einen CHECK auf `bookings.rezeptart`? Was ist mit Physio, wo Sitzungen über `prescription_sessions` laufen? | db-ustasi |
| F339-2 | Ist ein **harter Block** beim Binden eines Termins vor dem Ausstellungsdatum richtig, oder nur eine Warnung mit Pflichtbestätigung (vgl. Memory „warnen statt blockieren“ für Buchungen)? Fachlich empfiehlt gkv-302 den Block, weil `preflight S:01004` die Datei später ohnehin hart stoppt. | Melih (Produkt) + gkv-302 |
| F339-3 | Gibt es podologisch Praxisfälle, in denen vor dem Ausstellungsdatum behandelt wird, etwa ein ärztlicher Hausbesuch mit handschriftlicher Verordnung am selben Tag (Anlage 3 Ziffer 3 `:84-85`)? Datum gleich ist zulässig, Datum früher nicht. | podoloji |
| F339-4 | Umgang mit bereits erbrachten Terminen ohne Verordnung: Absage, Selbstzahler nach Vereinbarung oder nicht abrechenbar. Welche Patienteninformation ist rechtlich nötig? | legal-de + Melih |
| F339-5 | Muss die Kandidatenliste (`ladePodoTermine`) nach Ausstellungsdatum filtern oder Termine davor nur ausgegraut mit Grund zeigen? | podoloji + Melih |
| F339-6 | Gibt es eine Norm, die Behandlung vor dem Ausstellungsdatum ausdrücklich ausschließt? Sonst `regel-schwere.js:132` auf eine konkrete Fundstelle präzisieren (B1.5). Im Rahmenvertrag Podologie, Haupttext, suchen. | gkv-302 + wissensbank |
| F339-7 | Darf ein „ausstehender“ Termin einen Hausbesuch tragen, ohne dass Fahrten bzw. Wegegeld vor der Verordnung abrechenbar werden? | gkv-302 + podoloji |

### B5 Synthetische Testfälle (#339)

Verordnung V: Ausstellungsdatum 10.10.2026, nicht dringlich, 3 Einheiten, `rezeptart='kassen'`.

| ID | Eingabe | Erwartung |
|---|---|---|
| T339-01 | Termin 05.10. „Verordnung ausstehend“ angelegt | gespeichert; keine `verordnung_id`, kein `behandlungsbeginn`, nicht in Abrechnungsliste |
| T339-02 | V wird erfasst, Termin 05.10. soll gebunden werden | abgelehnt bzw. nicht als Kandidat angeboten (B3 unzulässig 1) |
| T339-03 | Termine 12.10., 19.10., 26.10., 02.11. ausstehend, dann V binden | 12./19./26.10. gebunden, 02.11. bleibt ungebunden mit Hinweis Folgeverordnung (Bestand) |
| T339-04 | Erster Termin 09.11. (> 28 Tage nach 10.10.) | Block wie heute (`pruefeErsttermin`) |
| T339-05 | Termin am 10.10. (gleicher Tag) | zulässig |
| T339-06 | Preflight mit Podo-Behandlung am 05.10. und V vom 10.10. | `S:01004` hart, keine Datei (Regression des Bestands) |
| T339-07 | Ausstehender Termin, „Termin starten“, keine laufende VO | Warnung, keine Behandlung geöffnet (Bestand `podo-behandlungen-oeffnen.js:129`) |
| T339-08 | Nach dem Binden: Ausstellungsdatum von V nachträglich auf 01.10. ändern | Nicht still möglich. Die Änderung erfordert eine arztseitige Korrektur (B1.7); Prüfmeldung |
| T339-09 | Ausstehender Termin wird zu Selbstzahler umgestellt | Nur über eine explizite Nutzeraktion; kein automatischer Wechsel und keine GKV-Position |
| T339-10 | DSGVO-Klassifikation | Kein neuer Wert `vo_folgt` in Booking-Kontext; `klassifikation.test.js` bleibt grün |

---

## Nebenbefunde (nicht Teil der Karten, nur gemeldet)

- `api-backend/billing/dta/preflight.js:622-624`: Kommentar „Verordnung ist max. 12 Wochen (84 Tage) gültig“. Diese Regel ist hier nicht belegt geprüft. Sie sollte beim nächsten Preflight-Review gegen HeilM-RL § 15/§ 16 Abs. 4 abgeglichen werden.
- `api-backend/billing/codes/anlage3_v22.js:20-26`: Der Validator akzeptiert VKZ `10` ohne Bereichsprüfung. Der DB-CHECK `db/SCHEMA.sql:215` erlaubt `10` gar nicht, was für Podologie korrekt ist; für Physio kollidiert er künftig.

## Doğrulanamayanlar
A1.19, A1.20, B1.5 (nur Ableitung), B1.6, B1.9. Den Rahmenvertrag Podologie § 125, Haupttext, gibt es nicht im Archiv. Den Ops-Kartentext habe ich nicht gesehen.

## SPEC-RULES
Nicht geändert, weil der Auftrag nur diese Datei umfasst. Kandidat nach Klärung von F339-6: „Leistung vor Ausstellungsdatum nicht GKV-abrechenbar“, Kodda `preflight.js:619-621`.
