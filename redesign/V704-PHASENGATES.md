# V7.04 lokale Phasengates, 28.10.2026

## V7.04f: Geschlossener Doku-Roundtrip

Produktbasis c8b7dda1, keine Produktänderung. Neues reproduzierbares Werkzeug
`tools/redesign-doku-roundtrip.mjs` verwendet ursprüngliche HTML-Eingaben,
Original-Writer und Original-Lader. Nur anamnese/patient_notes/pat_fussbefund
erhalten ausdrücklich freigegebene In-Memory-Speicherung des tatsächlich
abgefangenen Payloads. Unpassende Owner-/Patientenbindung wirft; andere Writes
bleiben RS_READONLY. HTTP-Fence des Harness und WebSocket-Fence vor Page.
Keine Zahlungs-, Sende-, KI-, Druck- oder Löschaktion ausgeführt.

27/27Roundtrips grün: Podologie drei Formulare ×Alt/Neu ×Owner/Employee
×hell1440/dunkel390 =24, zusätzlich Anamnese Physio/Ergo/Logo je Neu/Owner/hell1440.
Neu-Einstieg über Akteaktion; Alt über bestehenden Panel-/Patientenweg.
Anamnese elf, Notizen acht, Fußbefund acht. Owner/Patient und bei Anamnese/Fußbefund
Autor im tatsächlichen Payload geprüft. Danach ungespeicherten Text eingetragen,
Panel verlassen, Patient neu gewählt, erneuten Tabellenread und Wiederherstellung
des gespeicherten Markers geprüft; Fußbefund über gespeicherten Listeneintrag
explizit geöffnet. Je Fall genau erwartete Doku-Schreibanzahl, keine zusätzlichen
Writes/Seitenfehler/Fremdhosts. Vier Bilder Alt/Neu hell/dunkel in Originalgröße
gesichtet; keine neue vollständige Layoutabnahme. R-23 bleibt real/offen.

Zwei anfängliche Harnessfehler korrigiert: Notizsuche wählte falschen synthetischen
Patienten, Fußbefund-Patientenfeld ist Suchfeld mit versteckter ID statt select.
Korrigiert auf eindeutige Erika/ID-Bindung und tatsächlichen Dropdown-Klick.
Kein Produktbefund daraus. Frühe 27Fälle ohne Überschreib-Gegenprobe nicht als
endgültiger Nachweis gezählt; finale Matrix mit zusätzlicher Gegenprobe erneut
27/27grün. Log `/tmp/praxura-v704f-final.log`, Bericht/Bilder
`/tmp/praxura-v704f-final-ui/bericht.json`.

64/64gezielte Dokuzugriff-/Akte-/Fußbefundkontext-/Abschlusstests selbst grün,
0Skip (`/tmp/praxura-v704f-gezielt.log`). Keine erneute Fullsuite ohne Produktänderung;
letzter vollständiger Produktnachweis bleibt c8b7dda1:4950pass/1bestehenderSkip.
Funktionskarte weiterhin frisch; keine neue Runtime-Funktion/Abfrage/Cacheänderung.

Beweisgrenzen: nur getestete Marker/Felder, keine vollständige Formularfeldmatrix.
IDs/Version/ist_aktuell im Speicher synthetisch, keine echten DB-Trigger oder
Persistenz über Browserneustart. Alle Employee-Fälle explizit mit bestehenden
Modulrechten einschließlich abrechnung injiziert; keine neue Rechtepolitik.
Keine Writer-Race-, RLS-, Live-, Register-, Mobil- oder Gesamt-V7-Freigabe.

Usermeldung auf c8b7dda1: separate native Sol-Podologie-/Guvenlik-Quellprüfungen
ohne neuen belegten Blocker,64Tests; e3d885e4 eng bestätigt. Podologie nennt zwei
Klicks ab Akte, PodoNotizen drei; kompletter Kalenderstart ungemessen. Guvenlik-
Definition gelesen, Register fehlt. Frühere technisch gescheiterte Kombiprüfung
liefert weiterhin kein Urteil; die neuen begrenzten Urteile schließen ausschließlich
ihren genannten Umfang.

Separate native Sol-Gegenprüfung dieses Harness-Nachweises abgeschlossen:
27 eindeutige Artefaktfälle und Matrix unabhängig bestätigt, eigener kurzer
Browserlauf 3/3 grün (`/tmp/praxura-v704f-review-ui/bericht.json`). Sechs eigene
VM-Proben prüfen Fremdtabelle/Delete/falschen Owner/falschen Patienten sowie
erlaubten Insert und Readback. Erste Delete-Fehlererwartung im Review-Harness
korrigiert; kein Produktbefund. Kein gefundener False Positive beim Speichern/
Wiederöffnen; HTTP-/WS-Fences und tatsächliche Überschreib-Gegenprobe bestätigt.
Notiz-Writer besitzt kein Autorenfeld; hierfür keine Autorenprüfung behauptet.
Restgrenze: Werkzeug nutzt bestehendes ruhe()/waitForTimeout mehrfach; grüne
Läufe beweisen keine Flakefreiheit. Nur erstmalige Inserts und ausgewählte
Markerfelder geprüft, kein vollständiger Update-/Feld-/Race-Nachweis. Wiederöffnen
auch bei Neu über bestehende Module. Kein Gesamt-V7-/Fach-/Releaseurteil daraus.

## Nachtrag V7.04e: Bildsichtung und Demo-Symbol

108vorhandene Neu-Aufnahmen von V7.04c in12Kontaktbögen grob gesichtet.
Quellen unverändert; kein neuer kompletter Bildlauf. Hohe Vollseiten-Aufnahmen
(insbesondere Startseite/Formulare/Einstellungen) im Kontaktbogen stark verkleinert:
keine vollständige Detail-, Kontrast-, Fokus- oder mobile Gestenabnahme daraus.
Anfragenbilder zeigen bekannte frühere Fixture-Fehlermeldung; gültige Antwort im
Harness bereits V7.04c ergänzt. R-23-Mobilreste weiter offen, Team-Karten sehr eng;
reservierte V8.03/V8.04 unverändert und weiterhin vor Abschluss gezielt abnehmen.

Konkreter Fund: Demo-Fallback zeigt dekoratives Lungen-Emoji auch Neu.
Bestehender Filter lässt unbekannte reine Emoji-Elemente absichtlich stehen,
um leere Bedienelemente zu vermeiden. Deshalb nur bestehendes
loadBeispielmodus-Template korrigiert: Neu nutzt vorhandenes ICON.services
als 3D-Würfel, Alt unverändert. Keine neue Funktion, Query, CSS oder Abhängigkeit;
Dashboard zeilenneutral, Cache248, Funktionskarte unverändert frisch.

Tatsächlicher Browserpfad zuerst rot: SVG fehlt. Danach8/8Fälle
Alt/Neu ×hell/dunkel ×1440/390 grün. Neu48px/currentColor/aria-hidden,
Alt weiterhin Emoji; Linkziel/target/rel erhalten,0Writes/Seitenfehler/Fremdhosts/
Überlauf. Neu hell390 und dunkel1440 in Originalgröße gesichtet.
Skript `/tmp/praxura-v704e-browser.mjs`, Logs `praxura-v704e-{rot,gruen}.log`
unter `/tmp`, Bericht/Bilder `/tmp/praxura-v704e-ui`.
Fullsuite erneut4950pass/1bestehenderSkip/0fail
(`/tmp/praxura-v704e-npm.log`); AltOverview1440hell1Bild pixelgleich,
107nicht geprüft. Eigener Diffcheck; keine unabhängige Fach-/Gesamtfreigabe.

## Nachtrag V7.04d: Anamnese-Folgeantworten

Basis1cdf3b31: Originalfunktionsregressionen zunächst10/20rot. Bestehende
Scope-/Rechte-/Ladenummer-Prüfung auf Ärzte-, Formular-, Podo-Vorschlagsantwort
und Verordnungskontext erweitert; keine neue Query, Funktion oder Schreibregel.
Danach20/20grün. Reale Modul-Kontexttests benötigten tatsächliche injizierte
Scope-/Rechtecallbacks: erste Fullsuite deshalb5Fixturefehler; nach Ergänzung
ohne geänderte Assertions30/30gezielt und Fullsuite2427+2152+371=4950pass,
1bestehenderSkip,0fail. Log `/tmp/praxura-v704d-npm-final.log`.

Synthetischer Browser mit HTTP-/WebSocket-Fence:12/12Fälle Alt/Neu,
hell1440/dunkel390, jeweils Scopewechsel/Rechteentzug/Normalpfad grün;
0Writes/Seitenfehler,4Bilder gesichtet. `/tmp/praxura-v704d-ui/bericht.json`,
Skript `/tmp/praxura-v704d-browser.mjs`. AltOverview1440hell gegenv801alt:
1Bild pixelgleich,107nicht geprüft; kein wiederholter kompletter Matrixnachweis.
CacheDashboard/Anamnese247; Funktionskarte erzeugt. Eigener Diffcheck nach
engineering:code-review ohne weiteren belegten Blocker im Reparaturumfang.

Kollegenmeldung unabhängig20vorhandeneTests+12Originalfunktionsproben über
Physio/Podo/Ergo/Logo grün;8Vorgänger-Gegenfälle akzeptierten veraltete Antworten.
Diese Meldung gilt nur für Folgeantworten. Kein Ersatz für ausgefallenen
Pflichtreview, Gesamt-V7-/Writer-/RLS-/Liveurteil. Bestehende Schreib-Races und
Doku-Rechtepolitik offen; keine neue Rechtefreigabe. V8.03/V8.04 unberührt.

## Vorheriger Phasennachweis V7.04c

Produktbasis: `f704d318`, Dokumentations-HEAD bei Beginn `03d4aa15`.
Keine Veröffentlichung, Live-DB, echten Profile oder Kundendaten verwendet.
V7.04 bleibt bis zur vollständigen Auswertung und Pflicht-Fachabnahme offen.

## Fehlgeschlagene Pflichtprüfung

Nach `cb3349e8` gestarteter kombinierter Sol6.1-Review endete am28.10.2026 um
07:17UTC mit `Selected model is at capacity. Please try a different model.`
Threadstatus `failed`, kein aktiver Lauf und kein abschließendes Urteil.
Zwischenmeldung nennt37gezielteTests grün und noch laufende Prüfung späterer
Anamnese-Abfragen; weder diese Meldung noch gelesene Quellen sind Fachfreigabe.
Kein Ersatzlauf oder Modell-/Providerwechsel gestartet. Bestehende lokale
Testergebnisse bleiben erhalten, Pflichtabnahme und V7.04 weiterhin offen.

## T2 und T3

- Letzte vollständige Produktsuite: 4937 bestanden, ein bestehender Skip, kein Fehler,
  `/tmp/praxura-v704b-npm.log`. Produkt seitdem unverändert.
- Alle 14 regulären Browserprobes dieses Pakets bestanden. Ausgaben unter
  `/tmp/praxura-v704c-probes/`; Zusammenfassungen in
  `/tmp/praxura-v704c-probes.log` und `...-probes-rest.log`.
- Temporäre Kopien der vorhandenen Probes verwenden lokale Playwright-Imports,
  sperren WebSockets vor der Seitenerzeugung und erlauben HTTP nur auf Loopback.
  Dev-Server 8081 wurde über PID 16079 und cwd diesem Worktree zugeordnet.
  Widget verwendet ausschließlich die eigenen Ports 18085/18086.
- Erster ICD-Lauf scheiterte am temporären Adapter: lokale Konstante `URL`
  verdeckte den Konstruktor. `globalThis.URL` korrigiert; Wiederholung bestanden.
  Keine Produktreparatur daraus.
- Einzige dauerhafte Werkzeugänderung: bestehender Harness beantwortet
  `/api/booking-request/list` mit `{requests:[]}`. Das bisherige `{}` war seit der
  F09-Formprüfung keine gültige erfolgreiche Leerantwort. Toolsuite 358/358 grün,
  `/tmp/praxura-v704c-tools.log`.

## T4

- Alt: 108 Aufnahmen, alle 27 Panels × hell/dunkel × 1440/390, Owner/voll.
  Erster Lauf `v704calt`: zwölf Unterschiede; Ursache fehlende Anfragen-Fixture
  und anderer Browser-Origin in Teamlinks/Einstellungen/QR. Keine Referenz ersetzt.
- Kontrolllauf `v704calt-canonical2`: gleicher sichtbarer Browser-Origin wie die
  Referenz, lokale Dateien direkt aus diesem Worktree beantwortet; kein Listener
  und kein Netzwerkrequest auf 18081. WebSocket-Fence vor Seitenerzeugung.
  Gültige synthetische Anfragen-Leerantwort. Temporäre Skripte:
  `/tmp/praxura-v704c-canonical-{harness,shots}.mjs`.
- Gegen unverändertes `v801alt`: **108 verglichen, 0 abweichend, 0 fehlen,
  0 API anders**, ein Rauschstreifen Fußbefund und ein bereits registrierter
  Statistik-Flake. Kein Anspruch auf 108 mathematisch identische PNGs.
  Log `/tmp/praxura-v704c-canonical-diff.log`.
- Neu: ebenfalls 108 Bilder in `v704cneu`. Tatsächlich gesichtet:
  Behandlung 390 dunkel, Fußbefund 1440 hell, Anamnese 390 dunkel, Notizen 390 hell.
  Das ist keine vollständige visuelle Einzelabnahme aller 108 Bilder.
- Konkreter offener V8.03-Befund: Anamnese 390 dunkel schneidet Medikament- und
  Allergieoptionen rechts ab. Bild:
  `.redesign-shots/v704cneu/owner-voll/neu-dunkel-390/14-anamnese.png`.
  Zusätzliche Geometrieprobe in beiden Themes: `mainArea.scrollWidth=455` bei
  Viewport390; Chemotherapie endet bei421,27px, Desinfektionsmittel und
  Metall/Nickel bei454,86px. Log `/tmp/praxura-v704c-anamnese.log`.
  Reservierte Formulardateien wurden nicht verändert; kein V7-Abschluss daraus.
- Vorlagen protokollieren gesperrtes synthetisches Auto-Seeding. Gleiche neun
  Meldungen bereits in `v801alt`; keine tatsächlichen Datenbankwrites.

## T5 und Abnahmegrenzen

Anfragen nach Fixturekorrektur: acht Owner-Fälle Alt/Neu × hell/dunkel × 1440/390,
null Funde (`/tmp/praxura-v704c-anfragen.log`).

Erster kombinierter Smoke überschritt sein 540-Sekunden-Limit, Exit 137. Er
schrieb keinen vollständigen JSON-Bericht und zählt nicht als Abnahme. Derselbe
Umfang läuft deshalb in vier getrennten Teilprozessen: Alt/Neu × Owner/Employee,
je hell/dunkel × 1440/390 × 27 Panels, vorhandene `switchPanel`- und ungefährliche
Aktionen. Jeder Teil erhält 360 Sekunden und einen eigenen Port/Ergebnisnamen
`v704c-{alt,neu}-{owner,employee}`. Ergebnisse und Rollenverweigerungen müssen
vor einer Freigabe ausgewertet werden.

Alle vier Teile vollständig: 432 Panelversuche, davon 408 erreicht und 24
verweigert (Employee ohne `abrechnung`: Behandlung/Fußbefund/Abrechnung in allen
acht Design-/Theme-/Breitenkombinationen). Keine Seitenfehler oder Fremdhosts.
Rohmeldungen: Alt/Neu jeweils Owner44, Employee56; zusammen200, kein Nullfundlauf.

- 144 Konsolenmeldungen: neun gesperrte Vorlagen-Seeds je Kontext; in beiden
  Designs und bereits in der Alt-Bildreferenz vorhanden.
- 16 zusammengefasste Meldungen zu abgefangenen synthetischen Schreibversuchen.
  Der Smoke kürzt diese Texte auf300Zeichen. Textvergleich zählt acht Neu-Texte
  als anders, weil Alt zusätzliche `user_preferences.upsert` voranstellt.
  Vollständige Operationslisten werden deshalb separat verglichen; keine
  Gleichheit der abgeschnittenen Listen behauptet.
- 16 Überlaufmeldungen bei390px: Anamnese Alt69/Neu65px, Leistungen Alt/Neu300px,
  jeweils beide Rollen/Themes. Keine Zunahme gegenüber Alt, aber konkrete offene
  Mobilrestpunkte für V8.03. Kein T5-Gesamtpass daraus.
- 24 erwartete Rollenverweigerungen wie oben. Vorhandene gesperrte Rechte werden
  nicht als erfolgreiche Fachabläufe gezählt.

Berichte `.redesign-shots/smoke-v704c-{alt,neu}-{owner,employee}.json`, Auswertung
`/tmp/praxura-v704c-smoke-auswertung.log`. Ergänzender vollständiger Write-Log
für Owner/hell/1440: Alt16, Neu13 abgefangene Operationen. Nach Entfernen der drei
zusätzlichen Alt-Preferences-Operationen sind die vollständigen Listen exakt
gleich: services.insert2, working_hours.upsert1, document_vorlagen.insert10.
Dateien `/tmp/praxura-v704c-writes-{alt,neu}-owner-hell-1440.json`, Laufprotokoll
`/tmp/praxura-v704c-writes.log`. Das löst die Textdifferenz für diese Kombination
auf; keine vollständigen Write-Listen der anderen sieben Kombinationen erhalten.
R-23 im zentralen Fehlerbuch enthält die beiden bereits vorbestehenden Mobilreste.

Die synthetische Fixture kennt mehrere Fachquellen nicht und beantwortet sie
vereinfacht. Dieser Smoke belegt Navigation und beobachtete UI-Grenzen, keine
vollständige klinische Datenbasis oder reale Schreib-/Berechtigungssemantik.

V7.04a und V7.04b belegen zusätzlich 40 Aktefälle und 24 Termin-/Behandlungseinstiege.
Diese Quellen-/Browsernachweise ersetzen keine unabhängige Fachprüfung. Kein
Gesamturteil über bestehende Writer, Speicher-Races, RLS, Live oder Kundenboxen.
Fußbefund bleibt am bestehenden `abrechnung`-Recht; alternative klinische
Rechtepolitik ist nicht belegt und wurde nicht erfunden.
