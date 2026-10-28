# V2.09b: Vorbauvertrag, noch keine Produktfreigabe

Stand 28.10.2026, Produkt/HEAD99def44e unverändert. V2.09b ist ein offenes
Hauptrollenpaket außerhalb der reservierten V8.03/V8.04-Dateien. Diese Notiz
bereitet die Rollenentscheidung vor; keine implementierte Dokumentensuche.

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

Frage in dieser Sitzung gestellt, Antwort offen. Keine Freigabe aus Wartezeit ableiten.

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

Keine Produktdatei, Runtimefunktion, Cacheversion, Datenbank oder Reservierung
geändert. Impeccable context für bestehende Oberfläche geladen; kein UI-Edit,
deshalb kein Craft-/Render-/Detector-Nachweis behauptet. Kein Providerwechsel,
Push/Deploy/main/V10 oder Livezugriff.
