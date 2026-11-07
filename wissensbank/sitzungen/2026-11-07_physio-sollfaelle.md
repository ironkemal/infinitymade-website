# Physiotherapie — unabhängige Sollfälle (Paket 0)

Stand: 07.11.2026. Fachlicher Entwurf aus Original-TXT; keine externe Abnahme. Nur synthetische Daten. Kein Produktionscode und kein vorhandener Test liefert einen Sollwert. Diese Datei dokumentiert Testvorgaben; sie beweist keine implementierte oder live geprüfte Funktion.

## Bedeutung der Ergebnisse

- **REGEL-PASS**: ausschließlich die in der Zeile bezeichnete Regel erfüllt. Keine allgemeine Abrechnungsfreigabe.
- **REGEL-STOP**: fachlich belegte Sperre der betroffenen Verordnung/Leistung; bereits rechtmäßig erbrachte andere Leistungen werden dadurch nicht pauschal entwertet.
- **PRÜFSPERRE**: für dieses Detail fehlt ein belastbarer, unabhängig geprüfter Sollwert. Kein produktiver Ersatzwert, kein grünes Testergebnis.
- Beträge sind ganzzahlige Cent. Synthetisch vorgegebene Leistungswerte prüfen Rechenregeln, niemals einen realen Vertragspreis. Datum ist deutsches Kalenderdatum, keine Millisekunden-/UTC-Dauer. In jeder Zeile sind alle übrigen Voraussetzungen als erfüllt vorausgesetzt.

## Originalregister und Quellenaktualität

Die Kürzel lösen sich zu Original-TXT relativ zu `wissensbank/` auf. Angegebene TXT-Zeilen enthalten gegebenenfalls den dreizeiligen Quellenkopf. Maßgebend bleiben Original, Abschnitt und Fassung.

| Kürzel | Original-TXT | Fassung / Abschnittsweg |
|---|---|---|
| V125 | `physiotherapie/20220331_Vertrag__Lesefassung_Stand_04.04.2022_telemedizinische_Leistungen_Physiotherapie.txt` | Lesefassung 04.04.2022; §6(3–4) Z.515–539; §7(3a–4) Z.571–618; §8(1–4) Z.746–782 |
| HMR | `gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt` | geändert 15.05.2025, in Kraft 05.08.2025; §7(6–7) Z.428–446; §8(2–3) Z.450ff.; §16a(2–3) Z.751–763 |
| DL | `gemeinsam/heilmittel-richtlinie/heilmittel-diagnoseliste.txt` | KBV Stand 01.01.2026; G35.-/ZN Z.190–202; R26.0/WS,EX,SO3/70 Jahre Z.1247–1251; Tabellenklassifikation siehe Sperren |
| V125a | `physiotherapie/20240830_Vertrag_nach__125a_SGB_V_Physiotherapie.txt` | i.d.F. 01.11.2024; §1(5) Z.103–107; §2(1–5) Z.118–159; §3 Z.173–183 |
| BA1 | `physiotherapie/20240830_Anlage_1_Vertrag_nach__125a_SGB_V_Physiotherapie.txt` | i.d.F. 01.11.2024; §3.1.2/3.2 Z.274–315, Seiten 7/7 |
| BA2 | `physiotherapie/20251211_Physiotherapie_Vertrag_125a_Anlage_2_barrierefrei.txt` | Lesefassung gültig ab 01.01.2026; Teil A S.2 (Diagnostik/Pauschale), Teil B Nr.3/5/6 S.6–7 |
| BA | `physiotherapie/20240830_Anhang_A_Vertrag_nach__125a_SGB_V_Physiotherapie.txt` | Formular zum Vertrag i.d.F. 01.11.2024; Originalrechnungsbezug Z.20–22; Rezidivbestätigung/16 Wochen Z.34–36; kein eigener Gültigkeitsbeginn angegeben |
| KOR | `gemeinsam/302-tp5/Gemeinsame_Umsetzungsempfehlungen_zum_Korrekturverfahren_Heilmittel_20250213.txt` | Stand 13.02.2025; Anpassungen ab 01.10.2025; Allgemeines S.1–2; Fragen 1–4 S.5–6 |
| TA3 | `gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919.txt` | Version 21, Stand 19.09.2025, anzuwenden ab 01.10.2025; §8.1.7 Z.819–836 |

Herausgeberabgleich am 07.11.2026: [GKV-SV Physiotherapie-Vertragsseite](https://www.gkv-spitzenverband.de/krankenversicherung/ambulante_leistungen/heilmittel/125_physio/125_physiotherapie.jsp) führt die oben genannten V125-/V125a-Fassungen sowie Standard-/Blankovergütung ab 01.01.2026; [G-BA HeilM-RL](https://www.g-ba.de/richtlinien/12/) nennt weiterhin Änderung 15.05.2025 und Inkrafttreten 05.08.2025. [KBV Heilmittel](https://www.kbv.de/praxis/verordnungen/heilmittel) führt die Diagnoseliste mit Datum 01.01.2026. Dies ist ein Veröffentlichungsabgleich, kein vollständiger Inhalts-/Hashvergleich aller Dateien. Keine neuen Originale heruntergeladen. TA/KOR wurden lokal anhand des Deckblatts geprüft; heutiger vollständiger TP5-Publisherabgleich bleibt offen und sperrt eine behauptete Gesamtaktualität.

## Tragende Originalaussagen

- V125 §7(3a): „Eine Verordnung mit bis zu 6 verordneten Behandlungseinheiten verliert 3 Monate“ nach dem ersten Behandlungstag ihre Gültigkeit; bei mehr als sechs: sechs Monate.
- V125 §8(4): „Für die Zahlung der Verordnungsblattgebühr ist der erste Behandlungstag der Verordnung maßgebend.“
- HMR §7(6): „behält die Verordnung unter Beachtung des § 16 Absatz 4 ihre Gültigkeit.“ Dies betrifft innerhalb der zwölf Wochen nicht vollständig erbrachte Einheiten.
- V125a §2(3): „Eine Begründung der Unterbrechungen, die länger als 14 Kalendertage dauern, ist nicht erforderlich.“ Die Unterbrechung verlängert die 16-Wochen-Frist nicht.
- KOR Allgemeines: „Innerhalb einer Rechnung dürfen nicht verschiedene Verarbeitungskennzeichen genutzt werden.“

## Standard und Entlassmanagement

Prüfer für fachliche Interpretation: **gkv-302**; unabhängige Umsetzungskontrolle: **qa-tests/qa-realitaetscheck**. Die Zeilen S01–S10/E01–E05 sind Quellen-Sollfälle; ausführbare Nachweise stehen aus.

| ID | Synthetischer Input | Erwartung | Original / Abschnitt / Fassung | Offene Regel / Prüfer |
|---|---|---|---|---|
| S01 | Standard; Ausstellung 01.09.2026; erster Termin 29.09.2026; nicht dringlich | REGEL-PASS Beginn: Abstand 28 Kalendertage | V125 §6(3–4), 04.04.2022 | keine für diese Frist; gkv-302 |
| S02 | Wie S01; erster Termin 30.09.2026 | REGEL-STOP: Beginn Tag29, Verordnung ungültig | V125 §6(3–4), 04.04.2022 | keine; gkv-302 |
| S03 | Ausstellung 01.09.2026; dringlich; Beginn 15.09.2026 | REGEL-PASS Beginn Tag14 | V125 §6(3–4), 04.04.2022 | keine; gkv-302 |
| S04 | Wie S03; Beginn 16.09.2026; Dringlichkeit unverändert | REGEL-STOP Beginn Tag15 | V125 §6(3–4), 04.04.2022 | nachträgliche Änderung nach Frist kein automatischer Heilungsweg; gkv-302 |
| S05 | Standard; 6 verordnete Einheiten; erster Termin 15.01.2026; letzte Leistung 16.04.2026 | REGEL-STOP dieser späten Leistung: mehr als 3 Kalendermonate | V125 §7(3a), 04.04.2022 | exakter letzte Gültigkeitstag separat S10; gkv-302 |
| S06 | Standard; 7 verordnete Einheiten; erster Termin 15.01.2026; Leistung 16.04.2026; gültige Zwischenbehandlungen | REGEL-PASS der 6-Monats-Regel, keine Ablehnung allein wegen 3 Monaten | V125 §7(3a), 04.04.2022 | andere Fristen bleiben separat; gkv-302 |
| S07 | Standard; Termine 01.09./15.09.2026; keine Unterbrechungsgründe | REGEL-PASS Unterbrechungsregel (14 Tage Abstand) | V125 §7(3a), 04.04.2022 | keine; gkv-302 |
| S08 | Standard; Termine 01.09./16.09.2026; kein T/K/F dokumentiert | REGEL-STOP verbleibender Einheiten bei Überschreitung von 14 Kalendertagen | V125 §7(3a), 04.04.2022 | keine; gkv-302 |
| S09 | Wie S08; jeweils Variante T/K/F dokumentiert; Therapieziel laut Leistungserbringer nicht gefährdet | REGEL-PASS ausschließlich Unterbrechung; 3/6-Monats-Frist läuft weiter | V125 §7(3a), 04.04.2022 | keine automatische Verlängerung; Behandler bestätigt Zielbeurteilung |
| S10 | Erster Termin 31.01.2026; 6 Einheiten; weitere Leistung 30.04.2026 bzw.01.05.2026 | PRÜFSPERRE des exakten Grenztags; niemals pauschal 90 Tage einsetzen | V125 §7(3a), 04.04.2022 | Tagesende/Monatsende und Fristberechnung ausdrücklich fachlich bestätigen; gkv-302 |
| E01 | Entlassung 01.09.2026; Ausstellung 31.08.2026; Beginn 08.09.2026 | REGEL-PASS Beginn Tag7 ab Entlassung; Ausstellung ist nicht Fristanker | HMR §16a(3), 05.08.2025; V125 §7(4), 04.04.2022 | keine; gkv-302 |
| E02 | Wie E01; Beginn 09.09.2026 | REGEL-STOP ganze Verordnung wegen Beginn Tag8 | dieselben Quellen | keine; gkv-302 |
| E03 | E01 rechtzeitig begonnen; weitere Leistung 13.09.2026 | REGEL-PASS Abschlussfrist Tag12 | HMR §16a(3), 05.08.2025; V125 §7(4), 04.04.2022 | keine; gkv-302 |
| E04 | E01 rechtzeitig begonnen; weitere Leistung 14.09.2026 | REGEL-STOP dieser Einheit (Tag13); noch nicht erbrachte Einheiten verfallen | dieselben Quellen | keine pauschale Stornierung vorheriger gültiger Einheiten; gkv-302 |
| E05 | Entlassprofil markiert; Entlassdatum fehlt; Ausstellungsdatum vorhanden | REGEL-STOP bis Entlassdatum geklärt; kein Ersatz durch Ausstellungsdatum | HMR §16a(2–3), 05.08.2025 | zulässiger Ergänzungsweg separat Anlage3a; gkv-302 |

## LHB und BVB

Hier werden **Mengenermittlung** und **Diagnoseklassifikation** getrennt geprüft. „LHB fachlich bestätigt“ bedeutet als synthetische Vorbedingung eine vollständig geprüfte ICD-/Diagnosegruppen-Kombination oder gültige Einzelfallgenehmigung; ein frei gesetztes UI-Flag ersetzt diese Vorbedingung nicht.

| ID | Synthetischer Input | Erwartung | Original / Abschnitt / Fassung | Offene Regel / Prüfer |
|---|---|---|---|---|
| L01 | LHB fachlich bestätigt; Frequenz 2/Woche; Menge24 | REGEL-PASS Mengenregel: 12×2=24; Standardhöchstmenge nicht als Ablehnungsgrund anwenden | HMR §7(6), §8, 05.08.2025 | Diagnosebeleg im konkreten Fall erforderlich; gkv-302 |
| L02 | LHB fachlich bestätigt; Frequenzspanne1–3/Woche; Menge36 | REGEL-PASS Mengenregel: oberer Frequenzwert3 maßgebend, 12×3=36 | HMR §7(6), 05.08.2025 | keine für Mengenrechnung; gkv-302 |
| L03 | Wie L02; Menge37 | REGEL-STOP Mengenregel: überschreitet36 | HMR §7(6), 05.08.2025 | Verordnungskorrekturweg separat; gkv-302 |
| L04 | LHB fachlich bestätigt; Restmenge aus rechtmäßig verordneten24; Termin85 Tage nach erstem Termin; Unterbrechungen höchstens7 Tage | Keine REGEL-STOP allein wegen Ablauf12 Wochen; andere Vertragsfristen gesondert prüfen | HMR §7(6) Satz5, 05.08.2025 | kein pauschales84-Tage-Enddatum; gkv-302 |
| L05 | ICD G35.1, DG ZN, Frequenz2/Woche; Antrag/Genehmigung fehlt | PRÜFSPERRE nur des abschließenden Klassifikationsnachweises; DL zeigt Kombination, HMR §8(2) sieht bei gelisteter Kombination kein Antragsverfahren vor | DL Stand01.01.2026 Z.190–202; HMR §8(2), 05.08.2025 | Originalliste Anlage2/Tabellenlayout unabhängig gegenprüfen; wissensbank + gkv-302 |
| B01 | BVB-Kombination fachlich bestätigt; Frequenz2/Woche; Menge24; etwaiger Akutereignis-Hinweis nicht erfüllt | REGEL-PASS nur der 12-Wochen-Mengenbemessung; aus Akutereignis allein kein Mengen-STOP | HMR §7(7), 05.08.2025 | keine Aussage zur ärztlichen Wirtschaftlichkeitsprüfung; gkv-302 |
| B02 | Synthetische BVB-Listenzeile erfordert70 Jahre; Geburtstag02.09.1956; Ausstellung01.09.2026; Beginn03.09.2026 | Alterskriterium bei Ausstellung nicht erfüllt; keine12-Wochen-Ausnahme aus diesem Merkmal. Standardprofil separat bewerten | HMR §7(7), 05.08.2025 | konkrete DL-Zuordnung separat B04; gkv-302 |
| B03 | Wie B02; Ausstellung02.09.2026 | Alterskriterium70 erfüllt; bei sonst bestätigter Kombination REGEL-PASS des Alterskriteriums | HMR §7(7), 05.08.2025 | konkrete DL-Zuordnung separat B04; gkv-302 |
| B04 | ICD R26.0, DG EX, Alter70 bei Ausstellung | PRÜFSPERRE abschließender BVB-Klassifikation; lesbare Kandidatenkombination, keine Freigabe aus verlorener Tabellenformatierung | DL S.19, Stand01.01.2026, Z.1247–1251 | DL-Farb-/Tabellenspalten und zugrunde liegende BVB-Vereinbarung prüfen; wissensbank + gkv-302 |

## Zuzahlung: zeitlicher Status unabhängig vom Tarif

| ID | Synthetischer Input | Erwartung in Cent / Status | Original / Abschnitt / Fassung | Offene Regel / Prüfer |
|---|---|---|---|---|
| Z01 | Geburtstag10.09.2008; Leistungen09.09./10.09.2026; jeweils vorgegebener zuzahlungspflichtiger Leistungswert2000 Cent; keine Befreiung | Prozentanteile0 +200=200 Cent. Blattgebühr entfällt, da erster Termin minderjährig | V125 §8(2/4), 04.04.2022 | tatsächliche Tarife außerhalb dieses Rechenfalls; gkv-302 |
| Z02 | Volljährig; Leistungen01.09./15.09.2026 je2000 Cent; gültige Bescheinigung ab10.09.; Rezept markiert pflichtig | Prozentanteile200 +0=200 Cent; erster Termin bleibt für Blattgebühr maßgebend | V125 §8(2/4), 04.04.2022 | keine Gesamtsumme ohne separat belegte Blattgebühr; gkv-302 |
| Z03 | Volljährig; Bescheinigung bis31.12.2026; Leistung31.12.2026 und02.01.2027 je2000 Cent; kein neuer Nachweis | Für Januar erneute Statusprüfung erforderlich; kein automatisches Fortschreiben der alten Befreiung | V125 §8(3), 04.04.2022 | 2027-Tarif nicht geprüft; Summe PRÜFSPERRE; gkv-302 |
| Z04 | Kosten einer vollständig erbrachten synthetischen Therapie800 Cent; berechnete Forderung darüber | REGEL-STOP Forderung oberhalb800 Cent (Kostendeckel) | V125 §8(1), 04.04.2022 | fixe Gebühr und Rundung unabhängig belegen; gkv-302 |

## Blankoverordnung

| ID | Synthetischer Input | Erwartung | Original / Abschnitt / Fassung | Offene Regel / Prüfer |
|---|---|---|---|---|
| BL01 | Fachlich bestätigtes Blankoprofil; Ausstellung01.09.2026; rechtzeitiger Beginn; Termine15.09./20.10.2026; Therapieziel nicht gefährdet; kein T/K/F | REGEL-PASS Unterbrechungsregel trotz35 Tagen; keine Begründungspflicht allein wegen14-Tage-Überschreitung | V125a §2(3), 01.11.2024 | Fristbeginn exakt separat BL03; gkv-302 |
| BL02 | Wie BL01; Leistung01.01.2027 nach Unterbrechung | REGEL-STOP: außerhalb16 Wochen; Pause verlängert nicht | V125a §2(3), 01.11.2024 | keine; gkv-302 |
| BL03 | Ausstellung01.09.2026; Leistung21./22./23.12.2026 (112-Tage-Grenzbereich) | PRÜFSPERRE des exakten letzten Gültigkeitstags; Festwert112 ohne fachlich bestätigte Inklusivität ist kein vollständiger Sollwert | V125a §2(3), 01.11.2024 | Fristberechnung/Tagesinklusion prüfen; gkv-302 |
| BL04 | Bestätigte Blankoverordnung, ohne Wiederaufnahme | Datensatz-Verordnungsart05; LEGS2200502; kein Standard-LEGS | V125a §2(5), 01.11.2024; BA2 TeilA, 01.01.2026 | übrige DTA-Segmente separat; gkv-302 |
| BL05 | Entlassmanagement und Blankoverantwortung gleichzeitig angefordert | REGEL-STOP dieser Profilkombination; ärztliche Standard-Entlassverordnung gesondert prüfen | V125a §1(5), 01.11.2024 | zulässige Standardverordnung ist Alternative, kein automatischer Datenumbau; gkv-302 |
| BL06 | Tatsächlich zulässige/erbrachte physiotherapeutische Diagnostik20522 am15.09.2026; 1 Einheit; Patient befreit | Vergütung3661 Cent, Zuzahlung0. Eindeutige Tabellenzeile als einzelner Tarif-Sollfall | BA2 TeilA S.2, gültig01.01.2026 | Leistungsberechtigung/Einmaligkeit separat; gkv-302 + unabhängiger Preisprüfer |
| BL07 | Zulässige/erbrachte versorgungsbezogene Pauschale20524, 1×; volljährig/pflichtig | Vergütung5863 Cent; leistungsbezogene Zuzahlung0, keine10% auf diese Pauschale | BA2 TeilA S.2 + TeilB Nr.3, gültig01.01.2026 | Gesamtrezept inkl.Blattgebühr separat; gkv-302 + unabhängiger Preisprüfer |
| BL08 | Ampelgruppe Tabelle1 fachlich bestätigt, kein LHB/BVB; vorrangige Einheiten18/19, ergänzende6/7 | 18/6 grün; 19/7 rot. Nur Einheiten in roter Phase erhalten9% Vergütungsabschlag; kein kompletter Mengen-STOP aus Ampel allein | BA1 §3.1.2/3.2, 01.11.2024 | konkreten ICD zur aktuellen Anhang1-Tabelle zuordnen; gkv-302 |
| BL09 | Ampelgruppe Tabelle2 fachlich bestätigt, kein LHB/BVB; vorrangig26/27, ergänzend8/9 | 26/8 grün; 27/9 rot; gleiche Abschlagslogik | BA1 §3.1.2/3.2, 01.11.2024 | aktuelle ICD-Zuordnung wie BL08; gkv-302 |
| BL10 | Zulässiges Blankoprofil, LHB/BVB fachlich bestätigt gemäß EX/Anhang1; mehr als26 Einheiten | Keine Ampelabschläge allein wegen Einheitenzahl; keine Übertragung der Standard-Ampel auf diese Ausnahme | BA1 §3.2 Schlussabsatz, 01.11.2024 | konkrete Kombination und aktuelle Anhang1-Zuordnung prüfen; gkv-302 |
| BL11 | Rote Einheit mit vorgegebenem abschlagsfähigem Basiswert10000 Cent | Vergütungsanteil9100 Cent nach9% Abschlag; keine Aussage zum Kassen-Netto oder Patientenzuzahlungsanteil | BA1 §3.1.2, 01.11.2024 | echte Preise und Rundung nicht durch diesen synthetischen glatten Wert geprüft; gkv-302 |
| BL12 | Zwei Hausbesuchspositionen20554+20555 für dieselbe Behandlung | REGEL-STOP der Kombination, nicht beide abrechnen | BA2 TeilB Nr.5, 01.01.2026 | zulässige einzelne Position anhand Ort bestimmen; gkv-302 |
| BL13 | Diagnostik/Pauschale wiederholt; tatsächlicher Preisfensterwechsel31.12.2025/01.01.2026 oder Rundung9% bei unglatten Centwerten | PRÜFSPERRE der nicht belegten Wiederholungs-/Altpreis-/Rundungsdetails | BA2 TeilA/B, 01.01.2026; BA1 §2/3, 01.11.2024 | vorab Originalbedingungen/Altvertrag/Rundungsquelle lesen und unabhängig prüfen; gkv-302 + Preisprüfer |

## Korrektur und Wiederaufnahme

| ID | Synthetischer Input | Erwartung | Original / Abschnitt / Fassung | Offene Regel / Prüfer |
|---|---|---|---|---|
| K01 | Ursprungsrechnung synthetischR-001, VKZ01; bereits anspruchsberechtigter Hausbesuch versehentlich nicht berechnet; Unterlagen unverändert | Nachforderung VKZ02; Ergänzung/Änderung rechnungsbegründender Unterlagen über diesen Weg ausgeschlossen | KOR Fragen1–2, 13.02.2025/ab01.10.2025; TA3 §8.1.7 V21 | konkrete BES-/Referenzfelder extra prüfen; gkv-302 |
| K02 | Rechtmäßige Absetzung wegen falscher Daten; korrigierter Datensatz und erforderlicher Urbeleg vorhanden | Korrektur gegen Rechnungskürzung VKZ04, Urbeleg zusätzlich zum DTA; kein erneutes VKZ01 | KOR Allgemeines/Fragen3–4, 13.02.2025/ab01.10.2025 | vertragliche Korrekturfähigkeit konkreten Fehlers vorausgesetzt; gkv-302 |
| K03 | Eine Rechnung enthält Positionen aus Nachforderung02 und Korrektur04 | REGEL-STOP Mischrechnung; je VKZ eigene Rechnung bilden | KOR Allgemeines S.1, 13.02.2025/ab01.10.2025 | keine; gkv-302 |
| K04 | Blanko01.09.2026; Therapiebeendigung und Ursprungsabrechnung bereits erfolgt; bestätigtes Rezidiv20.10.2026; OriginalR-001 referenziert; unterschriebener AnhangA vorhanden | Wiederaufnahme VKZ10 innerhalb16 Wochen; AnhangA als rechnungsbegründende Unterlage; Originalbezug erhalten | V125a §2(4), 01.11.2024; BA Formular; TA3 §8.1.7 V21 | genaue BES-/Rechnungsnummern-/Positionswerte gegen TA1 §7.1 prüfen; gkv-302 |
| K05 | Wie K04, AnhangA fehlt | REGEL-STOP Wiederaufnahme-Abrechnung bis erforderlicher Unterlage | V125a §2(4), 01.11.2024 | keine; gkv-302 |
| K06 | Wie K04; Leistung01.01.2027 | REGEL-STOP VKZ10 auf diese Ursprungsverordnung außerhalb16 Wochen | V125a §2(3–4), 01.11.2024 | ggf.neue ärztliche Verordnung als eigener Vorgang; gkv-302 |
| K07 | Rechnung allein wegen unbezahlter Zuzahlung; ohne weitere Sachverhaltsmerkmale | PRÜFSPERRE konkreter Felder/Beträge. Schlüssel03 bezeichnet Zuzahlungsforderung, reicht allein nicht als fertiger Datensatz | TA3 §8.1.7 V21; KOR Stand13.02.2025 | konkreten Fall aus KOR-Zuzahlungsfragen + TA1 §7 vollständig ableiten; gkv-302 |

## Verbleibende Sperren und Übergabe

1. **Keine Volltaxierungsfreigabe:** Die beiden eindeutigen Blanko-Preiszeilen BL06/07 sind Stichproben. Standard-TXT zeigt verschobene Zuordnungen von Position/Leistung/Preis. Vollständiger Tarifabgleich verlangt deterministische Extraktion plus unabhängige Originalgegenprüfung; keine KI-Tabellenkonvertierung.
2. **Offene Profilbelege:** konkrete LHB/BVB-Klassifikation, aktuelle Blanko-Diagnose-/Ampeltabelle, Grenztage/Monatsende, Rundung und Zuzahlungsgesamtbetrag sind an den bezeichneten Stellen gesperrt. Fachprüfer: gkv-302; Originalbeschaffung/Provenienz: wissensbank; Preis-/Rechennachweis: unabhängiger Prüfer. Ein synthetisch bestätigtes Merkmal darf in Produktion nicht ungeprüft übernommen werden.
3. **DTA ist gesonderter Nachweis:** KOR-Schlüssel und zwei Profilwerte beweisen keine vollständigen TA1-V21-Segmentketten, Routing, Verschlüsselung, DAS-Annahme oder Zahlungswirkung. Fehlender konkreter DAS-Profilnachweis bleibt offen.
4. **Ausführung noch offen:** Diese Vorgaben sind geschrieben und quellenbasiert geprüft. Keine Tests ausgeführt, keine DB angefasst, keine echten Patientendaten, kein Versand, kein Deploy und kein Commit.
5. **SPEC-RULES:** In diesem Paket keine Einträge vorgenommen (Dateibesitz ausschließlich diese Sitzungsnotiz). Dauerhafte Übernahme durch Integrator erst mit geprüftem Codebezug/Zeile; besonders HMR §7(6–7) und V125a §2(3–5).
