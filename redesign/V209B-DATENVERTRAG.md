# V2.09b: freigegebener Inhaberumfang

Stand 28.10.2026. Melih hat ausdrücklich „Zunächst nur Inhaber“ gewählt.
V2.09b setzt diesen vorläufigen Umfang um; Mitarbeiter behalten bestehende
Patientensuche. Mitarbeiter-Dokumentensuche bleibt bis belegter eigener
Patienten-/Dokumentenregel offen. V8.03/V8.04-Reservierungen bleiben unberührt.

## Belegt

- Gemeinsamen Picker `attachPatientSearch` weiterverwenden: konfigurierbare
  Quelle, Label, Matcher und Auswahl. Gemischte Treffer brauchen typisierte
  IDs, da patient-suche.js:166 ausschließlich `id` auswählt; Original-ID separat.
- `ladeAktiveVerordnungen` (module/verordnung-uebersicht.js:194,234) normalisiert
  bestehende VO-Daten, besitzt jedoch keinen Standort-/Employee-Scopevertrag.
  Ownerweite Abfrage und nachträglicher Filter sind keine ausreichende Grenze.
- Bestehenden privaten Öffner module/verordnung-liste.js:219 erreichbar machen,
  wenn Scope und Treffer erneut bestätigt sind; kein zweiter Detailrenderer.
- `loadRechnungen` (dashboard.js:13046) besitzt Ownerfilter und bizScope finance.
  `openInvView` (module/rechnung-ansicht.js:140) benötigt seinen Cache und lädt
  anschließend weitere Patienten-/VO-/Sitzungsdaten, ohne eigenen Rollenguard.
  Vor Quelle und Öffner müssen Rechte/Scope erneut bestätigt sein.
- `hasModuleAccess` (dashboard.js:574) erlaubt Owner ausdrücklich pauschal.
  `SIDEBAR_TO_MODULE` (dashboard.js:609) ordnet Verordnungen prescriptions zu,
  enthält jedoch kein rechnungen. Sidebar-Sichtbarkeit ersetzt keinen vollständigen
  Datensatzvertrag. nav-registry.js:103,113 sieht beide Bereiche auch für Employee vor.
- Employee Unknown/0Reads bei unbelegter Patientenzuständigkeit ist für F10
  dokumentiert; daraus keine allgemeine dauerhafte Owner-only-Suche ableiten.

Pflicht-Vorbauberatung fonksiyon-ustasi anhand Agentdefinition und INDEX,
zusätzlich Guvenlik-Perspektive anhand Definition im selben nativen Sol-Lauf.
Keine unabhängige Doppelabnahme und kein Sicherheitsveto behauptet. Belegte
technische Lücken sind reparierbar; fehlende Employee-Rechteentscheidung ist davon
getrennt. Keine Register-, Browser-, RLS- oder Livefreigabe.

## Konkrete Entscheidung

1. Vorläufig nur Inhaber-Dokumentensuche: bestehende Mitarbeiter-Patientensuche
   erhalten; neue VO-/Rechnungsquellen für Employee vor jedem Read sperren.
   Kein dauerhafter Ausschluss als Gesamtziel. Erst nach ausdrücklicher Auswahl bauen.
2. Dokumentensuche zurückstellen, bis Rechnungs-Modulrecht und zulässige
   Employee-VO-/Rechnungsdatensätze verbindlich bestimmt sind.

Entscheidung: Option1 ausdrücklich gewählt. Keine Veröffentlichungs-/Standardumschaltungsfreigabe.

## Umsetzung nach Rollenentscheidung

- Bestehende Loader/Öffner begrenzt erweitern, keine parallele Patienten- oder
  Rechnungsengine. Kontext über vorhandenes neuKontext; Alt unverändert.
- Aktuelle Rolle/UID/Owner, bekannte Standort-/Sharingantworten, Modulrecht und
  Requestgeneration vor Quelle, nach jedem await und vor Öffner prüfen. Veraltete
  Picker-Treffer beim Kontextwechsel verwerfen. Unbekannter Scope: keine Reads.
- VO-Quelle vor Query auf erlaubte Patientenmenge einschränken; finance-Scope
  vorhandener Rechnungsquelle erhalten. NULL-Altbestand nicht eigenmächtig anders
  behandeln. Ladefehler und begrenzter Bestand dürfen kein vollständiges Leerurteil
  erzeugen. Kein neuer Writer/Druck-/Zahlungs-/Sendeweg.
- Synthetische Tests: verweigerte/unbekannte Quelle0Reads, Scope-/Rollenwechsel
  während Load und vor Auswahl, typisierte IDs, korrekter Originalöffner, kein
  stiller Mitarbeiter-Finanzread. Browser hell/dunkel, Alt/Neu, Desktop und
  bestehende mobile Unsichtbarkeit; Tastatur/Fehler/Leerzustand, danach Paketgates.

## Implementierter lokaler Vertrag

- `module/kopf-dokumente.js`: Owner+UID-Bindung, erfolgreich geladener Standort-/Sharingkontext,
  vorhandener Navigationseintrag, Generation und gemeinsamer30s-Abbruch pro Operation.
  VO-Suche verwendet vorhandenen F10-Scope-Lader und bestehenden VO-Lader; erlaubte
  Patientenpakete vor beiden Quellen filtern. Rechnungen verwenden vorhandenes
  `loadRechnungen` mit unverändertem Finance-Standort-/NULL-Vertrag. Keine
  ownerweite Ersatzliste bei unbekanntem Scope.
- Dokumentnummer/Patientenname im gemeinsamen Picker, typisierte IDs. Neueste200
  Rechnungen beziehungsweise200 je VO-Zweig/Patientenpaket: ausdrücklich Teilbestand,
  keine vollständige Null-/Entwarnungsaussage. Kein Betrag in Suchtreffern.
- Auswahl bestätigt Scope erneut; Rechnung frisch per ID+Owner+Finance-Scope.
  Suchdialog verwendet vorhandene Detailrenderer als Leseansicht. Rechnungskopie
  besitzt lokale DOM-Ziele; bestehender Cache, Auswahl, Editor und Druckziel bleiben
  unangetastet. VO erhält zusätzlich Owner-/Patientenfilter und Folgeantwortguards;
  keine Änderungs-/Sprungaktionen im Suchdialog. Escape/Schließen und Fokusrückkehr.
- Employee: keine neue Dokumentquelle. Bestehender `ensureLeadsCache` bleibt erhalten;
  dieser liest schon vorher VO-Abrechnungsstatus als Patientenlisten-Beiwerk. Deshalb
  ausdrücklich NICHT „Employee erzeugt generell null prescriptions-Reads“ behaupten.
- Cache249 für Dashboard/Shell/Suche und geänderte Renderer; Modulgraph ohne doppelte
  Versionen. Neue Datei liegt unter bereits ausgeliefertem `module/`, keine neue Cloud.

## Nachweis und Grenzen

19 gezielte Rechner-/Originalquellenproben, acht geschlossene synthetische Browserfälle
Alt/Neu ×Rollen/Themes plus900/390px; NULL-Patientenbezug einer Altrechnung und normaler
Patientenbezug, isolierte Betrags-/Positionendarstellung, Fehlerzustand, Tastatur und0Writes.
HTTP-/WS-Fences vor Page. Querydouble-/Fixture-Nachweis ersetzt keine Live-RLS-/Auth-/DB-
oder vollständige Fachabnahme. Globale nachsichtige Fixture bleibt unverändert; nur dieser
Test korrigiert UUIDs, notwendige Rechnungsfelder und den exklusiven Therapiezweigfilter.
Impeccable-Dateidetektor `[]` ist Regex-/Quellprüfung, kein vollständiger A11y-Nachweis.
Kein neuer allgemeiner Reviewlauf; Pflichtberatung/Absichtsmeldung getrennt von eigenen
Tests halten. Aktuelle Paketgates und Messwerte stehen in STATUS.md. Kein Push/Deploy,
main/V10, Livezugriff oder Kundeninstallationsnachweis.

Pflichtberatung DB/onprem/mobil nach Bau vor Paketabschluss nachgeholt: vorhandene
Spalten/FKs und Box-Auslieferungsweg quellengeprüft, kein belegter Quellenblocker.
Mobilhinweis auf44px-Auswahlziel korrigiert; finale acht Browserfälle protokollieren
106×44px und Seitenbreite explizit. Drei aktuelle Dialogbilder gesichtet. Diese
Beratung ist keine unabhängige Dreifachabnahme und kein eigener Browser-/Livebeweis.
Fullsuite4967pass/1bestehenderSkip/0fail; AltOverviewhell1440 pixelgleich,107nicht
erneut geprüft. Reguläre Paketgates/Commit in STATUS.
