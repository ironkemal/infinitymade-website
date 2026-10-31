# Konsey — Physio-Cloud-Pilot: Planungsentwurf

Stand: 25.10.2026. Interne Empfehlung, keine beschlossene Produktänderung, kein Angebot und keine Implementierungs-/Betriebsfreigabe. K1/K12 bleiben bestehen. Kundenname und Originalmail bewusst nicht abgelegt.

Beratung: fonksiyon-ustasi, gkv-302, legal-de, deger-mi, muhalif; Sicherheitsberatung ergänzend. Keine Liveprüfung, keine DB-Zugriffe. Lokaler Checkout enthält umfangreiche fremde Änderungen; keine Integrationsfreigabe daraus ableiten.

## Empfehlung

Kundenchance verfolgen, zuerst begrenzte Qualifizierung und Demo, danach einvernehmlich abgegrenzter Pilot. Kein Vollumfang zum Beginn des achtwöchigen Tests versprechen. Ein Standort, 3–5 Therapeuten zuerst; Teamgröße und zweiter Standort werden anschließend kontrolliert erweitert. Produktentwicklung bleibt wiederverwendbar, keine exklusive Kundenvariante.

Mail beschreibt Physiotherapie; mündliche Einordnung als Ergotherapie ist ungeklärt. Standort zwei ist eine Perspektive, kein zugesagter Vertragsumfang. Kundenwunsch ist Softwaretest, keine Zusage zur Entwicklungsfinanzierung.

## Quellen und Anforderungen

| Anforderung | Belegter lokaler Stand | Vor Angebot/Abnahme klären |
|---|---|---|
| Cloud, standortübergreifend | Playbook K1/K12: kein eigenes SaaS; praxis-eigene Cloud als Weg vorgesehen | Akzeptiert Kunde diese Betriebsform? Wer patcht, überwacht, sichert und stellt wieder her? Vertrags-/Dienstumfang prüfen |
| Patientenakte/Dokumente | dashboard.js:7202 ff. Akteninhalte; module/akte-podo.js:48–59 blendet Dokumentenreiter außerhalb Podologie aus | Physio-Dokumentenablage mit Upload, Abruf, Rechten, Versionierung und Export abnehmen |
| Befund/Therapiedoku/Berichte | Verordnungsmaske enthält Berichtsanforderung/-status | Physio-Vorlagen, Verlauf, Berichtserstellung und vollständige Versandstrecke nicht nachgewiesen |
| Patientenkommunikation/Fax | Akte enthält E-Mail-Verlauf; Faxfelder belegen keinen Versand | Termine vs. Gesundheitsdokumente trennen; Versand, Empfängerprüfung, Fehler und Datenschutz; Fax optional separat |
| Unterschriften | module/patienten-einwilligung.js:366–385,440–467: Pointer-Signatur und Einwilligungsspeicherung | Keine allgemeine Vertragsunterzeichnung daraus ableiten; Textversion, Identität, Zeit, Integrität, Kopie und Export prüfen |
| Rezeptcontrolling | Verordnungsübersicht/Prüfung existieren | Konkrete Filter und Sollberichte mit Praxis definieren; keine pauschale BI-Zusage |
| Scan/Rezeptprüfung | OCR-/Prüfcode existiert | Physio-Fälle, Fehlerquoten, manuelle Prüfung und freigegebene AI-Betriebsstrecke abnehmen |
| Kalender und 15–30 Therapeuten | Buchungs-/Verordnungsgrundlagen vorhanden | Patient/Verordnung/Therapeut/Standort, Paralleländerungen, Rechte, Vertretung, Konflikte, echte Geräte prüfen |
| §302 Selbstabrechnung | abrechnung.routes.js:515,1397 ff.: Mapping, Signatur/Verschlüsselung; module/abrechnung-detail.js:816 ff.: Download | Transport, Zertifikate, Annahme, Originalbelege, Rückmeldung, Korrektur und Zahlung nachweisen; mark-sent:2197 ist kein Zustellnachweis |
| Privat/Zuzahlung/Verkäufe | Rechnungsrouten :2644,3000; Finanzgrundlagen | Ende-zu-Ende-Abnahme; Verkaufsumfang, Steuern und ggf. Kassenanforderungen gesondert definieren |
| DATEV | module/buchungskonten.js:8 nennt späteren Export | Exportformat oder direkte Anbindung? Mit Steuerberater abgestimmter Importtest erforderlich |

Praxisinterne elektronische Akte ist nicht automatisch gematik/TI-ePA. Die Mail verlangt zunächst Dokumentenablage; keine zusätzliche TI-Anbindung hineininterpretieren.

## Cloud-Grenze

§393 SGB V verlangt passende Nachweise für eingesetzte Cloud-Systeme und Technik sowie Umsetzung der Kundenkriterien. Provider-C5 allein bestätigt kein darauf aufgebautes Praxura-SaaS. Aktuelle Fassung enthält begrenzte Typ1-Regel für neu eingeführte Systeme; keine pauschale Ausnahme. Praxis-eigenes Konto ändert Pflichten nicht automatisch, insbesondere bei tatsächlichem Praxura-Administrations-/Supportzugriff. AVV und §203-Verpflichtungen anhand realer Rollen klären.

Erste Demo ausschließlich synthetisch. Echtpatienten erst nach dokumentierter Betriebs-, Datenschutz- und Sicherheitsprüfung. Acht Wochen kostenlos sind keine rechtliche Ausnahme.

Quelle: https://www.gesetze-im-internet.de/sgb_5/__393.html

## Aufwand: Annahmen und Korridor

Vom Nutzer bestätigt am 25.10.2026: zwei Vollzeitpersonen; beide übernehmen Entwicklung, Praxistests sowie Betrieb/Support. Rechenannahme: 40 Stunden/Woche je Person, keine parallele große Roadmap; technische Erfahrung und Umsetzungsgeschwindigkeit sind nicht erhoben. Fachfeedback der Praxis bleibt notwendige, noch nicht vereinbarte Mitwirkung. AI-Agenten zählen nicht als zusätzliche menschliche Vollzeitkapazität. Keine gemessene Velocity; Korridore sind Risikoplanung, kein Festangebot.

Kapazitätsbudget als Arbeitsannahme: von zusammen 80 Wochenstunden etwa 50–60 für Entwicklung und technische Verifikation; 20–30 für Einrichtung/Betrieb, Kundengespräche, Schulung, Praxistests und Support. Verteilung wöchentlich anhand tatsächlicher Zeiten korrigieren; Supportspitzen verringern Entwicklungszeit. Aufwandsschätzungen enthalten bereits Test-/Einrichtungsanteile: dieses Budget nicht als zusätzlichen pauschalen Aufschlag doppelt berechnen. Beide bleiben beteiligt, pro Arbeitspaket jedoch eine verantwortliche Person bestimmen: eine führt Produkt/Kundenabnahme, die andere Technik/Betrieb; gegenseitige Vertretung und Review.

| Etappe | Aufwand / Kalender |
|---|---|
| Qualifizierung, Demo, Sollfälle, Betriebs- und Lückenprüfung | 5–10 Personentage / 1–2 Wochen |
| Begrenzten Pilot vorbereiten, Physio-Kernabläufe schließen, Einrichtung/Restore/Rollen testen | weitere 20–40 Personentage / 3–5 Wochen |
| Betreuter Praxistest | 8 Kalenderwochen; 10–20 Personentage Betreuung/Fehlerbehebung einplanen, schwere Fehler zusätzlich |
| Voller Mailumfang einschließlich Integrationen und Abnahme | insgesamt grob 120–220 Personentage; etwa 4–7 Monate Kalender einschließlich Koordination/Reserve; externe Wartezeiten können verlängern |

Begrenzter Teststart damit etwa 4–7 Wochen nach verbindlicher Abgrenzung. Achtwöchiger Testabschluss etwa 12–15 Wochen danach. Bestehende Abläufe, Betriebsnachweise und Integrationsergebnisse können Korridor verkürzen oder verlängern. Eine Vollzeitperson eher 7–12+ Monate für Vollumfang; drei erfahrene Personen ggf. 3–5+ Monate, nicht linear skalierbar. Ergo ist nicht eingerechnet.

Mit bestätigter gemeinsamer Betriebs-/Supportverantwortung intern eher am oberen Teil des Korridors planen: Zielgröße rund sechs Monate für den Vollumfang; kein Viermonatsversprechen nach außen. Noch keine belastbare Lieferzusage vor Bestandsaufnahme. Acht Wochen Pilot sind Beobachtungszeit nach vereinbartem Einstiegstest, keine Frist zur Fertigstellung aller Funktionen.

§302 separat: Fachberater nennt 1–2 Wochen gezielte Fachprüfung plus 2–6+ Wochen externe Kanal-/Zertifikats-/Annahmestellenabhängigkeiten; mindestens vollständigen Abrechnungszyklus beobachten. Diese Zeiten teilweise parallel, nicht pauschal addieren. Automatischen Versand erst nach Festlegung des zulässigen Transportwegs kalkulieren.

## Preisstrategie — Vorschläge, keine bestehenden Tarife

Softwarepreis, Einführung und individuelle Entwicklung getrennt anbieten. Ein Neukunde schuldet nicht automatisch Finanzierung unserer Produktlücken.

- Standardnahe Nutzung nach Abnahme: Orientierung 299 € netto/Monat für einen Standort bis 15 Therapeuten; 499 € für zwei Standorte bis insgesamt 30. Rollenbezogene persönliche Konten für Empfang/Verwaltung eingeschlossen; spätere Vertragsgrenzen definieren. Hosting ist damit nicht automatisch vollständig betriebenes SaaS.
- Einrichtung/Schulung/abgegrenzter Import: 1.000–2.500 € netto, erst nach Aufwandserhebung verbindlich. Schmutzige Altdaten, komplexe Migration separat.
- Acht Wochen Standardtest: keine Lizenzkosten als mögliche Akquiseinvestition. Einrichtung/Betreuung ausdrücklich vereinbaren; keine stillschweigend kostenlose Individualentwicklung.
- Verbindliche Entwicklungspartnerschaft: z.B. 3.000–7.500 € netto Beitrag in konkrete, abgenommene Meilensteine. Nur bei Bereitschaft zu Beta-Mitarbeit, Vorlagen/Sollfällen und regelmäßiger Rückmeldung. Beitrag deckt Entwicklung nicht vollständig.
- Kunde will alle Lücken individuell und termingebunden geschlossen: eigener Projektvertrag. Zunächst 2–3 Tage bezahlte technische Spezifikation, danach Angebot. Kein belastbarer Festpreis aus dieser Analyse.
- Infrastruktur, SMS/Fax, Zertifikate/Transport, optionale Drittleistungen und besondere Betriebs-/Supportleistungen transparent separat oder mit klarer Inklusivmenge kalkulieren. Keine 24/7-Zusage ohne Personal und Budget.

Marktanker: thevea Plus nennt 99,90 € netto/Monat; zusätzliche persönliche Accounts optional 9,90 €. 15 Zusatzaccounts ergeben zusammen 248,40 €, 30 ergeben 396,90 €. Nicht gleichwertiger Vergleich: Abrechnungsmodell/Benutzerbedarf/Standortkonditionen prüfen. Quelle: https://thevea.de/preise/ (abgerufen 25.10.2026).

Wirtschaftlichkeitsbeispiel, keine ermittelten Istkosten: 160 Personentage × 500 € interne Vollkosten = 80.000 €. Bei 499 € Monatsumsatz und angenommenen 150 € direkten monatlichen Betriebs-/Supportkosten bleiben 349 € vor Entwicklungskosten; 80.000/349 ≈ 229 Kundenmonate. Ein Kunde amortisiert Entwicklung so erst nach rund 19 Jahren, zehn vergleichbare Kunden theoretisch nach rund 23 Monaten, vor weiteren Fixkosten/Akquise/Abwanderung. Individueller Vollauftrag müsste diese Finanzierung anders tragen; Wiederverwendbarkeit und eigener Investitionsrahmen sind entscheidend.

## Pilotabnahme und Exit

Vor Beginn: feste Funktionsliste mit bewusst ausgeschlossenen Prozessen, Betriebsverantwortung, Schulung, Supportfenster, Datenexport und Rückkehrweg. Testuhr beginnt erst bei nutzbarer vereinbarter Version.

Woche 1–2: kleiner Nutzerkreis und ein Standort. Woche 3–4: kontrollierter Team-/Rechteausbau. Woche 5–6: zweiter Standort nur nach bestandener erster Abnahme und tatsächlichem Bedarf. Woche 7–8: Sollfälle wiederholen, Fehler und Nutzbarkeit bewerten, Kaufentscheidung. Kein zweites zwingendes Produktivsystem ohne geklärte Datenhoheit/Doppelerfassung; bisherigen verbindlichen Abrechnungsweg erhalten, Doppelabrechnung verhindern.

Abnahmefälle: Dokument wiederfinden/exportieren; unverändert gespeicherte unterschriebene Fassung nachweisen; keine unberechtigten Team-/Standortzugriffe; keine verlorenen parallelen Kalenderänderungen; Restore praktisch beweisen; Rezept bis Rechnung und Zahlung nachvollziehen; DATEV-Datei beim Steuerberater importieren. Keine offenen kritischen Datenschutz-, Datenverlust- oder Abrechnungsfehler.

## Offene Fragen für Qualifizierung

Physio oder auch Ergo? Wie viele Personen tatsächlich zum Start und wann Standort zwei? Rechtseinheiten/IK? Eröffnungstermin und aktuelle Software? Muss §302 ab Tag eins funktionieren? Bedeutet DATEV Datei oder direkte Schnittstelle? Welche Dokument-/Befundvorlagen und Filter sind unverzichtbar? Fax zwingend oder Wunsch? Erwartetes Budget? Akzeptiert Praxis kundeneigene Cloud mit klar vereinbartem Betrieb? Wer übernimmt fachliche Pilotabnahme?

## Konsens und Grenzen

Alle Beratungen stützen gestuften Pilot statt Vollversprechen. deger-mi schätzt engen Pilot niedriger (15–30 Personentage) als vorliegender Korridor, weil nur zwei vorhandene Kernabläufe vorausgesetzt sind; hier sind Physio-Dokumentlücken und Betriebsprüfung zusätzlich berücksichtigt. Kein Widerspruch zur Abrechnungs-/Cloud-Grenze. Kein Beschluss zum Umsetzen oder Wiedereröffnen von SaaS. Bei Wunsch nach vollständig betriebenem SaaS und sämtlichen Funktionen ab sofort: gegenwärtige Anfrage in dieser Form nicht annehmen; späteren Termin oder begrenzte Demo anbieten.

Kontextbrücke: Hauptabfrage und GKV-Abfrage fehlgeschlagen, kein verwertbares Provider-Ergebnis; Funktionsberater nutzte lokale Brücke ohne Provider-Aufruf. Gezielte Quellprüfung als Fallback. Keine gemessene Netto-Tokenersparnis behauptet.
