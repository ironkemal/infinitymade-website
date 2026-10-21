# Ops #290-0 — Quellen- und Datenvertrag

Datum: 21.10.2026. Status: **Vorbereitung dokumentiert; Implementierung blockiert**.
Kein Schema-, Produkt-, Rechte-, Integrations- oder Release-GO. Übergeordneter Plan:
[Ops-Plan](2026-10-21-ops-umsetzungsplan.md). C-Versionsabgleich ist abgeschlossen;
HEAD `4e107c9a`, gepinnter Tracking-Stand `37a611b97fbd97a6585d46d9436c14f5c6f9f59e`.
Keine automatische Übernahme upstream. Beratung in drei lesenden Rollenreviews:
GKV/Wissensbank, Daten/Funktionen, Recht/Sicherheit/Onprem. Kein Veto gegen
Dokumentationsvorbereitung; alle nachfolgenden Implementierungsgates bleiben bestehen.

## 1. Quellenbasis und Reichweite

Archivierte Original-TXT, nach INDEX/REGISTER gezielt gelesen:

- **A1:** `wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt`,
  V21, Stand 15.01.2026, anzuwenden ab 01.10.2025. SLLA B/Heilmittel:
  ZHE :3352–3383; SKZ :3013–3015,3506–3539, Seiten 72–73.
- **A3:** `wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919.txt`,
  V21, Stand 19.09.2025, anzuwenden ab 01.10.2025. Schlüssel
  §8.1.2 :316–327, §8.1.2.1 :329–343, §8.1.11 :1009–1032,
  §8.1.17 :1279–1305. Abschnittsnummern aus dem Haupttext, nicht Inhaltsverzeichnis.
- **HMR:** `wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt`,
  Änderung 15.05.2025, iK 05.08.2025; §8 Abs.2/3 :453–461.

Original-TXT-SHA-256 als Identifikation der tatsächlich gelesenen lokalen Fassung:

```text
A1  b0b8f5c4c9e27ce612112c82ebdff1688b4a0cae7467ad61b4bcbbb47ae6ff69
A3  9e663c219a9651cc561bdecb36c40b4a779d338edd5a309ff05a80f74518c53d
HMR 773d031b014e893ffd0cd65eb8786c6bcc4fd7cedec59ee894d379621b99b308
```

Öffentliche Veröffentlichungsindizes am 21.10.2026 gelesen:
[GKV-Datenaustausch](https://www.gkv-datenaustausch.de/leistungserbringer/sonstige_leistungserbringer/sonstige_leistungserbringer.jsp)
bestätigt A1/A3 V21 als heutige Basis; V22 ab 01.02.2027, Übergang bis 30.04.2027.
Dortige A3 V22 inzwischen Stand 23.09.2026; lokale V22-Kopie vom Februar ist
kein aktueller Nachfolgernachweis. [G-BA](https://www.g-ba.de/richtlinien/12/)
führt HMR mit obiger Änderung/iK. Kein Download, kein vollständiger Online-PDF-
Bytevergleich, keine automatische Versionsumschaltung. Neuere Anhänge wurden auf
Veröffentlichungsseite sichtbar, aber nicht in #290-0 importiert oder geprüft.

SPEC-RULES wurde gezielt korrigiert: frühere A1-Stelle :2876–2881 gehört zu
Hilfsmitteln. Heilmittel-SKZ steht :3506–3535. Außerdem keine unbelegte Gleichsetzung
von SKZ mit BVB, ausschließlich ärztlichem §8 Abs.3 oder stets Verordnungsart `04`.
Das ist Quellenbereinigung, keine neue Freigabe zusätzlicher Produktfälle.

## 2. Logischer Feldvertrag: Quelle → Ausgabe

Schlüssel bleiben **Strings**, keine numerische Umwandlung. Folgende normativen
Schlüsselmengen sind von künftig bestätigten Produktfällen zu unterscheiden.

1. **`verordnungsbesonderheiten` → ZHE-Feld 7:** einstelliger numerischer Kannwert;
   bei zutreffendem Sachverhalt verpflichtend. A3 nennt `1`, `2`, `4`, `7`, `9`;
   `3` unbelegt, `8` ausdrücklich Hilfsmittel. A1/A3 wie oben. Kein erfundenes `0`.
   Bisheriger enger Produktvorschlag `1/2/4` ist keine vollständige normative Menge.
   Unterstützung `7/9` und mehrere gleichzeitig zutreffende Besonderheiten: **B1**.
2. **`unfallkennzeichen` → ZHE-Feld 8:** einstelliger numerischer Kannwert;
   dokumentierte Verordnungsangabe übertragen. Normativ `1`, `2`, `3` laut A3.
   Produktentscheidung hält Arbeits-/Wegeunfall/Berufskrankheit (`1`) aus diesem
   GKV-Ablauf heraus; `3` ebenfalls bislang nicht unterstützt. `2` bezeichnet
   sonstige Unfallfolgen. Quelle ist nicht gleich Produktzulassung. Kein stilles
   Umschreiben `1` nach `2`, kein Ableiten aus Diagnose oder BG-Feld. Umfang: **B1**.
3. **`bvgSonstigesSer` → ZHE-Feld 9:** einstelliger numerischer Kannwert;
   `6` für bestätigten BVG-/SER-Sachverhalt, sonst leer. A3 §8.1.2.1.
4. **`genehmigung.kennzeichen` → SKZ-Feld 1:** bestätigtes Krankenkassenkennzeichen/
   Aktenzeichen, 1–20 AN. Keine Kürzung überlanger Eingaben, keine erfundene Nummer.
5. **`genehmigung.datum` → SKZ-Feld 2:** API-Vertragsvorschlag echtes Kalenderdatum
   `YYYY-MM-DD`, weder Timestamp noch durch JS normalisiertes ungültiges Datum;
   Writer überträgt `YYYYMMDD` (acht numerische Stellen). Keine Zeitzonenverschiebung.
6. **`genehmigung.art` → SKZ-Feld 3:** zwei AN. Für Heilmittel ist `B2` belegt;
   `B1` unbelegt. B2 umfasst ärztlichen §8 Abs.3 **oder** zahnärztlichen §7 Abs.1.
   Anderer nicht abgebildeter Genehmigungsfall: **B1**, keine Ersatzkodierung.

**SKZ-Gesamtbedingung:** Liegt Kostenzusage/Genehmigung vor, einmal je ZHE übertragen,
alle drei Felder vollständig. Kein SKZ ohne entsprechenden Sachverhalt. HMR §8 Abs.2
kennt Fälle ohne Antrags-/Genehmigungsverfahren. LHB-/BVB-Flag oder Dokumenttyp allein
belegt keine Genehmigung. Keine allgemeine fehlendes-SKZ-Sperre für alle LHB/BVB.
Explizit erfasste Genehmigung mit Teilangaben ist vor Speicherung/DTA gezielt ungültig.
ZHE-Feld 10 bleibt leer; bestehende Positionen nicht verschieben.

## 3. Zustände und API-Semantik — vorgeschlagen, noch nicht implementiert

- **unbekannt:** Original noch nicht bestätigt; Neuanlage ohne Feld erhält diesen
  Zustand. Kein automatisch bestätigtes Nein und kein aus Diagnose ermittelter Wert.
- **bestätigt vorhanden:** Originalwert plus überprüfte Herkunft. Nur validierte,
  im bestätigten Produktumfang unterstützte Werte sind für DTA verwendbar.
- **bestätigt nicht vorhanden:** NULL-Wert mit ausdrücklich bestätigtem Zustand;
  ZHE-Kannfeld leer, kein SKZ. Unbekannt bleibt hiervon unterscheidbar.
- **PATCH-Schlüssel fehlt:** bisherige Werte und Herkunft erhalten. Altclient darf
  neue Werte nicht durch Weglassen löschen. Explizites Leeren erfordert begründeten
  Zustandswechsel; vollständige SKZ-Gruppe konsistent behandeln.
- **Ungültig:** unbekannter/reservierter Schlüssel, falscher Typ, Überlänge,
  unmögliches Datum, Teil-SKZ oder nicht zugehörige Quelle → vorgeschlagen 422 ohne
  Teiländerung. Kodierter, aber produktseitig ungeklärter Fall → eigener Prüf-/Fehlerfall,
  niemals stilles Verwerfen oder als quellenwidriger Schlüssel darstellen.
- **Legacy/ungeklärt:** keine erfundenen Werte nachtragen. Prüfhinweis und bestehendes
  leeres Ausgabeformat erhalten, solange kein belegter verpflichtender Sachverhalt
  erfasst ist. Vollständige Freigabepolitik für ungeklärte Originale bleibt **B1/B3**.

## 4. Speichergrenze und vorhandene Pfade

**Einziger Pool bleibt `prescriptions`.** Vorschlag von db-ustasi, **keine
Schemaentscheidung**: additive Spalten `verordnungsbesonderheiten text`,
`unfallkennzeichen text`, `bvg_sonstiges_ser text`, `genehmigungskennzeichen text`,
`genehmigungsdatum date`, `genehmigungsart text`; zusätzlich feldbezogene Herkunft
etwa `dta_quellen jsonb`, ohne zweite Kopie der fachlichen Werte. Form/Constraints:
**B2**. BG-Spalten, ersetzbares `computed`, Artefaktdateien und zweite
Verordnungstabelle sind ausgeschlossen. `computed` wird bei Neuberechnung ersetzt
(`api-backend/server.js:2903–2904`).

Herkunftsvorschlag: Status, Quellentyp, vorhandene Dokument-/Seitenreferenz,
Bestätiger, Zeitpunkt, Änderungsgrund, Spezifikationsfassung/Abschnitt. Dokument
muss derselben Praxis **und Verordnung** gehören; vorhandenen
`prescription_documents`-Bezug verwenden (`db/SCHEMA.sql:2654–2685`). Keine Dokument-
oder Wertkopie und keine Verordnungsinhalte in technischen Logs. Audit-/Aufbewahrungs-
vertrag noch nicht festgelegt (**B2/B4**); aus Herkunftsmetadaten folgt kein neuer
unbefristeter Aufbewahrungsanspruch.

**Sollkette aller sechs logischen Werte:** Original → `parsed.rezept` in vorhandenen
Confirm/PATCH-Pfaden → validierte autoritative Spalten plus Herkunft → beide Mapper
→ bestehendes `verordnung`-Shape → bestehende ZHE-/SKZ-Writer. Neue SQL-/API-Namen
erst nach B2 finalisieren; interne Herkunft nicht an DTA-Writer weiterreichen.

Gezielte Pfadkarte, aktuelle Arbeitskopie → gepinnter Tracking-Stand:

- Confirm: `api-backend/server.js:2469` → :2478; PATCH :2748 → :2753.
  Eingangsobjekt `parsed.rezept` :2489/:2763. Validierungsanschluss :2820–2837
  muss künftig die sechs Werte und Herkunft abdecken. Bestehendes `/rezept/save`
  (:2952 → :2957) aktualisiert Patienten-Arzt/Hausbesuch; kein Ersatz-Speicherweg
  für diese Verordnungswerte.
- Standardmapper: `api-backend/billing/api/abrechnung.routes.js:513` → :514,
  Ausgabe :623–677; Podologiemapper :3613 → :3756, Ausgabe lokal :3715–3753.
  Beide liefern Felder bislang nicht. Beide sollen dieselben autoritativen Werte
  lesen; kein neuer paralleler Abrechnungspfad.
- Persistenzzuordnung: `bvg_sonstiges_ser` → `.bvgSonstigesSer`;
  drei Genehmigungsspalten → `.genehmigung.{kennzeichen,datum,art}`;
  Besonderheit/Unfall → gleichnamige Shape-Felder.
- Writer: `api-backend/billing/dta/builder.js:529–543,583–589` und
  `segments.js:284–330,349–358`. Wiederverwenden; kein zweiter Serializer.
- Korrektur erzeugt aus beiden Mappern erneut Daten (`abrechnung.routes.js:4733`
  → :4876); historische Referenzen :4741–4752. Wiederöffnung
  `billing/api/verordnung-status.routes.js:325` entfernt nur `abrechnung_id`.

## 5. Rechte, Festschreibung, Korrektur und Onprem

**Rechtevorschlag, B3:** Tenant serverseitig aus JWT; Owner oder aktiver Mitarbeiter
mit ausdrücklich wirksamem Verordnungsbearbeitungsrecht am Standort. Fachliche
Bearbeitung und Abrechnungs-/Korrekturrechte getrennt. Standort-NULL-/Altfallsemantik
und exakte bestehende Rechtekennungen erst verbindlich beschließen. `requireAuthAI`
allein belegt keine Modulrechte (`api-backend/ai/auth.js:25–58`). Fremdmandant und
fremdes Dokument verweigern, direkte Browser-Schreibwege mitprüfen/sperren.

**Festschreibung, B4:** neue Werte **und Herkunft** müssen ausdrücklich in
verwendeten Sperren erfasst werden. Bestehende Spaltenlisten schließen neue Spalten
nicht automatisch ein (`db/SCHEMA-RLS.sql:3617–3682,4407–4478`). Upstream 0080
entfernt nur die verwaiste Funktion `verordnung_festschreibung()`, nicht die aktive
Prescription-Festschreibung; deren gezielt verglichene Funktionskörper sind identisch.
Neue Spalten müssen trotzdem ausdrücklich in aktive Sperren aufgenommen werden.
Wiederöffnung darf Werte nicht still entsperren; heutige PATCH-Belegsperre bleibt
auch danach relevant (`server.js:2791–2801`). Faktische Korrektur braucht kontrollierte
Version-/Originalverknüpfung; bestehenden VKZ01-Ausnahmeweg nicht pauschal aufweiten.
Original-DTA, Hash, ausgestellte Snapshots und Rechnungen unverändert erhalten;
Dateierhalt allein ist noch kein vollständiger Werte-/Auditvertrag.

**Onprem, B5:** keine neuen zentralen PHI-Aufrufe, Cloud-Dienste, Endpunkte oder
Runtime-Quellenabfragen. Additive DB-Erweiterung muss Altclient, alte/neue API und
alte/neue Box berücksichtigen. Vor Migration reale Ledger-/Versionsbasis autorisiert
klären; lokale Sicherheitszusätze und upstream 0085-Leadbindung erhalten. Keine
Migrationsnummer vergeben. Zähler, Constraints, Sperren, Schemaexport und Auskunft/
Löschung bestehender Datenstrukturen nach festgelegtem Projektverfahren prüfen.

## 6. Synthetische Sollfälle — Spezifikation, keine ausgeführten Tests

Alle Daten erfunden, feste Uhr/IDs für Bytevergleiche; für Standard- und
Podologiemapper separat ausführen, anschließend semantisch gleiche Felder prüfen.

- **S01 Altfall:** keine neuen Werte → ZHE7/8/9/10 leer, kein SKZ; bestehende
  vollständige DTA bei identischen Eingaben/Uhr/IDs bytegleich.
- **S02 bestätigte Felder:** unterstützte Einzelbesonderheit `4`, Unfall `2`,
  BVG/SER `6` jeweils isoliert → genau zugehöriges ZHE-Feld, andere Felder unverändert.
  Kombinationen nur nach bestätigter Anwendbarkeit; keine künstliche Sammelverordnung.
- **S03 Genehmigung:** `AZ-123`, `2026-10-21`, `B2` → genau
  `SKZ+AZ-123+20261021+B2'`. Kein SKZ-Duplikat, Datum unverändert. Segmentzähler und
  abhängige Hashes regulär durch bestehenden Builder, nicht auf alte Werte festhalten.
- **S04 ohne Genehmigung:** LHB/BVB allein oder bloßer Dokumenttyp → keine
  erfundene SKZ-Zusage; Prüfhinweis nach Vertrag, kein pauschaler Ablehnungsfehler.
- **S05 ungültig:** ZHE7=`3`/`8`, ZHE9=`1`, SKZ-Art=`B1`, 21 Zeichen Kennzeichen,
  `2026-02-30`, Objekt statt String, Teil-SKZ → passende Ablehnung ohne Schreiben.
  Normativ vorhandene, produktseitig nicht freigegebene Fälle gesondert gemäß B1.
- **S06 Zustand/Altclient:** Confirm fehlt → unbekannt; PATCH fehlt → erhalten;
  explizites Leeren nur mit Zustand/Grund; Save→Reload→Recalculate erhält Werte
  und Herkunft. Keine Änderung durch OCR-Neuberechnung oder altformatiges Payload.
- **S07 Rechte:** fremder Tenant/Patient/Dokument, Mitarbeiter ohne effektives
  Recht oder falscher Standort → keine Änderung, keine zusätzliche Dokumentauskunft.
  Owner und ausdrücklich berechtigter Mitarbeiter positiv gegenprüfen.
- **S08 Festschreibung:** neue Werte/Herkunft nach Ausstellung nicht frei änderbar;
  Wiederöffnung kein Umgehungsweg. Freigegebene Korrektur bewahrt Originalbytes,
  Hash-/Snapshotkette und Rechnungssperren; beide Mapper verwenden korrekte Version.
- **S09 Box/Upgrade:** frische DB, Upgrade, erneuter Start, alte/neue API und
  Altclient; keine doppelte Version, Checksum-/Downgradefehler bleiben Fehler,
  Fehler rollt atomar zurück. Nicht unterstützte Kombination vor Schreibzugriff
  eindeutig stoppen. Noch keine tatsächliche DB- oder Boxprüfung.

## 7. Blocker, Zuständigkeit und Abschlussgrenze

- **B1 — GKV/Produkt:** freigegebene Sonderfälle, `7/9`, Mehrfachbesonderheiten,
  nicht zuordenbare Genehmigung und Freigabepolitik unbekannter Sachverhalte.
  Vorhandene Produktausschlüsse nicht still aufheben.
- **B2 — db-ustasi/fonksiyon-ustasi:** endgültige Spalten/API-/Herkunftsform,
  atomare Zustandswechsel, referenzielle Integrität und Rundlauf.
- **B3 — Produkt/Sicherheit/Backend:** genaue effektive Rechte und Standort-/NULL-Grenzen.
- **B4 — Recht/GKV/db-ustasi:** Werte-/Herkunfts-Freeze und kontrollierte Korrektur
  einschließlich konkreter Audit-/Aufbewahrungsentscheidung. Keine rechtliche
  Gesamtfreigabe aus dieser technischen Vorbereitung ableiten.
- **B5 — db-ustasi/onprem:** tatsächliche Versions-/Ledgerbasis, kompatible
  Migrationsfolge, Zähler-/Schemaexport und spätere Betriebsabnahme.

- [x] ~~Archivierte Originalfelder und Veröffentlichungsindex gezielt geprüft.~~
- [x] ~~SKZ-Quellenfehler und unbelegte Verallgemeinerungen dokumentarisch korrigiert.~~
- [x] ~~Alle sechs Werte durch API-/Speicherentwurf, beide Mapper und Writer verfolgt.~~
- [x] ~~Synthetische Sollfälle und jeder noch offene Entscheidungsblock zugeordnet.~~
- [ ] Blocker B1–B5 verbindlich entscheiden; dann vertikale Implementierung eigens beauftragen.
- [ ] Implementierung, echter Persistenz-Roundtrip, Release und Kassenannahme nachweisen.

**#290-0-Vorbereitung abgeschlossen; #290 insgesamt offen.** Keine Migration,
Funktions-/Schema-/UI-Änderung, Testausführung, produktive Datenprüfung oder Sendung.

## 8. Konsey-Zielentscheid: kleine Podologie-v1, Umsetzung weiter zurückgestellt

21.10.2026, Folgerunde. Fragestellung: A voller Umfang mit Mitarbeitern und
historischen Korrekturen; B begrenzte neue/unberechnete Verordnungen mit Owner-
Bearbeitung; C bestehende Zurückstellung beibehalten. Anlass: B1–B5 aus Vorbereitung
konkretisieren. Onprem-Effekt: keine neuen Datenziele/Cloud-Abhängigkeiten.
Rückbau von Schema und ausgestellten Daten teuer, Zielvertrag noch reversibel.

Beratung: drei lesende T3-Aufträge mit getrennten Perspektiven GKV/Podologie/Wert/
Gegenposition, Daten/Funktionen, Recht/Sicherheit/Onprem. Das sind Rollenreviews,
keine unabhängigen Gutachten je Rolle. Kontext und frühere Quellenbefunde wurden
übergeben; geschlossene Produkt-/Prioritätsentscheidungen nicht erneut geöffnet.

**Entscheid:** B als späterer technischer Zielumfang; C bleibt für den jetzigen
Umsetzungszeitpunkt. A entfällt aus v1. #290 bleibt nach bestehendem Podologie-
Meilenstein oder bei konkret belegtem früherem Bedarfsfall; keine neue Nachfrage
behauptet und keine erfundene Kundeninterview-Pflicht eingeführt. Zielwahl ist weder
Implementierungsauftrag noch SQL-/Schemaanwendung. Nur technische Zielentscheidungen
innerhalb dieser Vorbereitung sind nachfolgend festgelegt.

### Festgelegter Zielumfang B1–B3

- **B1 / Produktziel:** ausschließlich durch v1 neu angelegte, bisher nie
  abgerechnete GKV-Podologie-Verordnungen innerhalb bereits unterstützter Fachregeln.
  Bestätigtes Entlassmanagement ZHE7=`4`, sonstige Unfallfolgen ZHE8=`2`, BVG/SER
  ZHE9=`6`, vollständige bestätigte ärztliche Genehmigung SKZ/B2 als Einzelanlässe.
  Keine allgemeine Zulassung eines Falles allein wegen Schlüsselmitgliedschaft.
  ZHE7 `1/2/7/9`, ZHE8 `1/3`, zahnärztliche Fälle, BG/Privat, Podologie-Blanko,
  Mitarbeiterbearbeitung, historische Ergänzungen/Korrekturen außerhalb v1.
  Normativ gültig, aber außerhalb Produktumfang → „nicht unterstützt“, kein Ersatzwert.
  ZHE7 `3/8` und SKZ/B1 bleiben für diesen Heilmittelvertrag ungültig.
  Mehrere Besonderheiten für dasselbe einstellige Feld: keine erfundene Priorität
  oder Verkettung; betroffenen Fall stoppen und klären. Verschiedene ZHE-Felder
  sind nicht automatisch Mehrfachbelegung desselben Feldes; fachlich zulässige
  Kombinationen erst ausdrücklich prüfen, keine pauschale Unvereinbarkeit erfinden.
- **Quellenprüfung:** unbekannt darf Entwurf bleiben. Für neue v1-Fälle vor DTA
  ausdrückliche Originalprüfung; kein automatisch bestätigtes Nein. LHB/BVB/04
  bleibt ohne automatische Genehmigungsableitung. Legacy-Bestand unverändert;
  Altclients deklarieren keine v1-Eignung durch frei gesetztes Clientflag.
- **B2 / Speichertarget:** sechs nullable Fachspalten wie §4 plus interne
  feldbezogene Herkunft auf `prescriptions`, vorhandene Dokumentreferenz. Keine
  Werte doppelt in Herkunft speichern. Neue Defaults oder Backfill bleiben aus.
  Zustand, Wert und Herkunft müssen in einer atomaren Änderung zusammenpassen.
  Kein einfacherer vorhandener autoritativer Ersatzspeicher nachgewiesen.
  Das legt Zielmodell fest, nicht fertige SQL-Constraints oder Migrationsnummer.
- **B3 / Rechtetarget:** ausschließlich verifizierter Owner für neue Werte und
  Herkunft, serverseitige Rolle und Tenant; kein aus Client-Body übernommener Actor.
  Keine Ausweitung oder Neudefinition bestehender Mitarbeiterrechte. Direkte Browser-
  Änderungen aller sechs Felder, Herkunft und serverbestimmter v1-Eignung auch für
  Owner blockieren; vorhandenen Client-Schreibschutz erweitern. Fehlender PATCH-
  Schlüssel erhält Bestand, `proceed_anyway` umgeht keine strukturellen Prüfungen.

### B4 konkretisiert: zwei technische Voraussetzungen, eine Workflowentscheidung

**Eignung:** serverbestimmt und nur neue v1-Verordnung; keine aktuelle/historische
Abrechnungsbindung, kein Claim, keine Belegnummer, kein ausgestellter Rechnungsbezug,
kein billed/final-Zustand. Statusprüfung allein genügt nicht: Wiederöffnung/Storno
darf v1-Bearbeitbarkeit nicht wiederherstellen. Fachwerte, Herkunft und Eignung
gemeinsam gegen alle Schreiber schützen.

**B4a, technisch offen:** atomare Änderung von Fachwerten und Quellenrevision.
Heutiger Validierungssnapshot wird nach UPDATE separat geschrieben
(`server.js:2913–2935`). Bestehender Audittrigger speichert geänderte Spaltennamen,
keine alten/neuen Werte und toleriert Logfehler (`0021_audit_write_trigger.sql:105–135`).
Das ist kein Beleg vollständiger, unveränderlicher Wertehistorie.

**B4b, technisch offen:** Erzeugung/Publikation von Abrechnung muss dieselbe bestätigte
Werte-/Quellenrevision atomar beanspruchen bzw. vergleichen und festschreiben.
Vorläufiges Lesen und spätere Sperrprüfung reichen bei paralleler Bearbeitung nicht.
Standardpfad erzeugt derzeit Dateien vor nachgelagerter Bindung/Sperre, deren Fehler
teilweise nur gewarnt werden (`abrechnung.routes.js:1162–1190`). Kein behaupteter
heutiger TOCTOU-Nachweis oder Patch; konkrete Ausführungsplanung/Test für v1 erforderlich.
Originaldatei/-Hash und ausgestellte Snapshots/Rechnungen bleiben unverändert.

**B4c, noch Produktentscheidung:** reicht einmalige bestätigte Quellenübernahme nach
editierbarem Entwurf, oder muss wiederholte Korrektur vor Abrechnung möglich sein?
Option einmalig begrenzt v1, benötigt aber definierten Fehler-/Korrekturweg für
Fehlbestätigung; keine stillschweigend unrettbar falsche Verordnung erzeugen.
Bei wiederholter Bearbeitung braucht Herkunft append-only Revisionen statt
überschriebenem Zustand. Keine Behauptung juristischer Vollständigkeit oder
Aufbewahrungsfreigabe. Historische Korrektur bleibt in beiden Varianten außerhalb v1.

### B5 eingegrenzt: Ausführungs-/Releasebasis, kein Hindernis der Zielwahl

Nullable Erweiterungen allein beweisen keine Altversionsverträglichkeit. Feature
erst aktivieren, wenn Spalten, Browser-Schreibschutz und Freeze-/Revisionsschutz
gemeinsam vorhanden sind; neue API ohne Schema stoppt vor Mutation statt Werte
still zu verlieren. Tatsächliches Ledger und Checksummen autorisiert feststellen,
neue Sicherheitszusätze und upstream 0085 erhalten, echte Install-/Upgrade-/
Rollbackfehlerpfade synthetisch prüfen. Keine Nummer, Anwendung oder Freigabe heute.

### Abwägung, Übereinstimmung und Folgehandlung

Übereinstimmung: B als kleineres Ziel; C für aktuelle Umsetzung. GKV nennt B fachlich
begrenzbar, Podologie/deger-mi befürworten bestehende Zurückstellung, Daten/Recht/
Sicherheit/Onprem tragen begrenzten Zielvertrag mit Bedingungen. Kein unaufgelöster
Widerspruch über diese Kombination; deshalb keine zweite Meinungsrunde. Keine harten
Vetos gegen Vorbereitung. Harte Grenzen bleiben: keine Pflichtwerte verschweigen,
keine Ersatzkodierung/unvollständige SKZ, keine gelockerten Mandanten-/Belegsperren,
kein neuer zentraler Patiententransit.

Abwägung: #290 liefert jetzt keinen Produktnutzen; dafür keine unnötige Erweiterung
von Mitarbeiterrechten, Altfällen oder historischen Korrekturen vor Podologie-Abschluss.
Konkreter Wiederanlauf bei bestehendem Auslöser: B4c entscheiden, B4a/B4b technisch
festlegen und B5-Basis autorisiert klären; danach zusammenhängende Implementierung
von Capture→Validierung→Persistenz→beide Mapper→DTA samt S01–S09 eigens beauftragen.

- [x] ~~B1–B3 als begrenzten technischen Zielumfang festgelegt.~~
- [x] ~~B4 auf zwei atomare Voraussetzungen und konkrete Workflowfrage reduziert.~~
- [x] ~~B5 als spätere Ausführungs-/Releasegrenze zugeordnet.~~
- [x] ~~Bestehende Priorisierung erhalten; A und sofortige Implementierung ausgeschlossen.~~
- [ ] B4c, B4a/B4b und tatsächliche B5-Basis vor Umsetzung abschließen.
