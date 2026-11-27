---
titel: Kemal-Übergabe — §302-Abrechnung per E-Mail ohne dakota.le (Fix-Paket F1–F11 & AZE-Abgleich)
typ: sitzungsnotiz
angelegt: 2026-11-26
quelle: E-Mail Kemal (26.11.2026) + origin/main:ABRECHNUNG_EMAILWEG_FIXPAKET.md (Commit 98da5452)
tags: [sitzung, 302, abrechnung, emailweg, dakota, secon, aze, uebergabe, itsg]
---

# §302-Abrechnung per E-Mail ohne dakota.le — Übergabe & Fix-Paket (26.11.2026)

> ⚠️ **Hinweis:** Dies ist eine interne Sitzungs- und Übergabenotiz, keine amtliche Quelle (siehe [[README]] und [[SITZUNGEN]]). Verbindliche Spezifikations- und Rechtsaussagen stützen sich ausschließlich auf die Originale in `wissensbank/` (geführt in [[REGISTER]] und [[SPEC-RULES]]).

**Quelle:** E-Mail von Kemal an Melih (26.11.2026) sowie die zugehörige Übergabedatei `ABRECHNUNG_EMAILWEG_FIXPAKET.md` auf `origin/main` (Commit `98da5452`, Stand 26.11.2026).  
**Ops-Karte:** „§302 E-Mail-Weg ohne dakota.le: 6 Pflicht-Fixes + E2E-Test“ (Kategorie: Teknik, Priorität: hoch, zugewiesen an: Melih).  
**Hintergrund:** Vorab per Red-Team-Analyse (Gemini Neon, lokal bei Kemal unter `Claude outputs/2026-11-26-abrechnung-risiko/BERICHT.md`, nicht im Repo) untersucht; kritische Punkte danach gegen Code und amtliche Spezifikation in `wissensbank/` nachgeprüft.

---

## 1. Strategische Produktentscheidung

- **Praxura übermittelt niemals selbst an die Krankenkassen.**
- Die Praxis sendet die Abrechnungsdateien **über ihr eigenes E-Mail-Postfach** direkt an die jeweilige Datenannahmestelle (DAS).
- **Kein dakota.le**, **kein Abrechnungszentrum**, **keine Provision**.
- Praxura erzeugt lokal alle benötigten Artefakte: §302-DTA (`SLGA`/`SLLA`), Signatur, Verschlüsselung, Auftragsdatei (`.AUF`) und Begleitzettel.
- **Einzige laufende Kosten für die Praxis:** das eigene **ITSG-Zertifikat** (79 € im ersten Jahr, 49 €/Jahr bei Verlängerung, 1 Jahr Gültigkeit).
- **Datenschutz-/On-Prem-Grenze (K2/K6):** Private Schlüssel und Patientendaten verlassen niemals den Rechner bzw. die Box der Praxis; Praxura-Server senden nichts an Datenannahmestellen.

---

## 2. Machbarkeitsnachweis (Stand 26.11.2026)

- **E-Mail-Abdeckung:** Alle **28 Heilmittel-Datenannahmestellen (DAS-IKs)** in der Kostenträgerdatei Q4/2026 führen im `DFU`-Segment das Protokoll `070` (E-Mail). Zusammen ergeben sich **9 Ziel-E-Mail-Adressen** (u. a. `da@dta.aok.de`, `edi302@iqvia-hss.de`, `dta302@ddg-online.de`, `le@bitmarck-daten.de`, `inbox@tp5.arz-emmendingen.de`).
- **Keine dakota-Pflicht:** dakota.le ist in keinem amtlichen Dokument vorgeschrieben; für TP5-Abrechnungssoftware existiert keine Herstellerzertifizierung.
- **Schriftliche Bestätigung AZE Emmendingen (03.11.2026):**
  - E-Mail-Einreichung gilt für Test- und Echtbetrieb.
  - Je E-Mail genau **eine Nutzdatei** und **eine Auftragsdatei** als getrennte Anhänge (**kein ZIP**).
  - Betreff = exakt die **9-stellige Absender-IK**.
  - Auftragssatz exakt **348 Byte**.
  - Freigabe hängt an der **IK der Praxis**, nicht an der Software.
  - Die eigene Software-Hersteller-IK (Klass-68-IK `590537440`) darf im **Testverfahren** als Absender verwendet werden.

---

## 3. Pflicht-Fixes F1–F6 (Abschnitt 1 — Reihenfolge = Abhängigkeit)

Aktuell würde der erste echte (signierte und verschlüsselte) Versand von der Annahmestelle sicher abgewiesen. Ursache sind vier kritische Showstopper (F1–F4) sowie zwei schwere Versand-Lücken (F5–F6):

### F1 — Signatur muss RSASSA-PSS sein (heute PKCS#1 v1.5) · 🔴 Showstopper
- **Ist:** `dashboard.js:14681` nutzt `forge.pkcs7.createSignedData()` mit `addSigner({ key, digestAlgorithm: sha256 })`. `node-forge` signiert dabei mit `rsaEncryption` (PKCS#1 v1.5) und unterstützt in PKCS#7 kein PSS.
- **Soll:** `wissensbank/gemeinsam/302-tp5/GGT_Anlage_16_Security_Schnittstelle_SECON.txt` §1.1 (Z. 183–185) und §2.1.2 (ab Z. 388): Signatur **RSASSA-PSS** (OID `1.2.840.113549.1.1.10`), SHA-256, MGF1-SHA256, `saltLength: 32`. Pflicht seit 01.01.2026.
- **Umsetzung:** CMS SignedData mit WebCrypto `RSA-PSS` + `pkijs`/`asn1js` bauen (analog zur OAEP-Verschlüsselung in `api-backend/billing/dta/verschluesselung.js`). Privater Schlüssel aus `.p12` bleibt im Browser (K2).
- **Repo-Regeln:** `dashboard.js` darf nicht wachsen (`tools/check-dashboard-size.sh`) → Signaturcode nach `module/dta-signatur.js` (Name frei) auslagern und in `dashboard.js` nur noch aufrufen. Bibliotheken lokal unter `vendor/` (kein CDN).
- **Backend:** `api-backend/billing/dta/signed-original.js` (`pruefeSignedDta`) muss `signatureAlgorithm == 1.2.840.113549.1.1.10` prüfen und PKCS#1 v1.5 ablehnen. Test `signed-original.test.js` von `forge` auf PSS-Fixture umstellen.
- **Fertig-Kriterium:** Signierte Datei zeigt unter `openssl cms -verify` korrekte PSS-Parameter; `npm test` grün.

### F2 — Auftragsdatei nach Verschlüsselung neu erzeugen (heute fest `00/00`) · 🔴 Showstopper
- **Ist:** `api-backend/billing/dta/auftragsdatei.js:209-210` schreibt fest `VERSCHLÜSSELUNGSART='00'`, `ELEKTRONISCHE_UNTERSCHRIFT='00'` und `DATEIGRÖSSE_ÜBERTRAGUNG` = Rohgröße. `upload-signed` (`api-backend/billing/api/abrechnung.routes.js`) erzeugt die `.auf` nach der Verschlüsselung nicht neu.
- **Soll:** `GGT_Anlage_02_Auftragsdatei.txt` §2.1: für signiert + verschlüsselt `03`/`03` und Übertragungsgröße = Bytegröße der **verschlüsselten** Datei (nur `00+00` oder `03+03` zulässig).
- **Umsetzung:** `buildAuftragsdatei()` um `verschluesselungsart` und `elektronischeUnterschrift` erweitern; in `upload-signed` nach erfolgreicher Verschlüsselung `.auf` mit `03/03` und `encryptedBytes.length` neu bauen, unter `auftragsdatei_path` speichern und in `abrechnung_artefakt_version` versionieren.
- **Fertig-Kriterium:** Test prüft exakt 348 Byte Länge, Stelle 207–210 = `0303`, Größe = verschlüsselte Bytegröße.

### F3 — Empfängerzertifikate der DAS in der Box verfügbar machen · 🔴 Showstopper
- **Ist:** Verschlüsselung liest `public.empfaenger_zertifikate` (`abrechnung.routes.js:1645`, Migration `0038`). In neuen Boxen ist die Tabelle leer; `tools/empfaenger-zertifikat-laden.mjs` ist nur ein manuelles Werkzeug. Fehlt der Eintrag, liefert Upload trotzdem `200` mit `verschluesselt: false` (Fall A, ab Z. 1600).
- **Vorhanden:** `api-backend/billing/dta/trust-anchors/` enthält die ITSG-Liste `annahme-rsa4096.key` (65 Zertifikate: CA/PCA + 60 DAS-Blätter), wöchentlich aktualisiert via `.github/workflows/itsg-trust-anchor-check.yml`.
- **Umsetzung (Entscheidung mit `onprem` + `db-ustasi` vorab klären):**
  - **Variante (a):** Beim Start/Update die DAS-Blätter aus `trust-anchors/` per `OU=IK…`-Abgleich in `empfaenger_zertifikate` upserten.
  - **Variante (b):** `berechneVerschluesselung()` liest direkt aus `trust-anchors/`, Tabelle dient nur noch als Override.
  - Ziel: Für keine der 26 `VKG 03`-DAS darf „kein Zertifikat“ mehr auftreten.
- **Fertig-Kriterium:** Frische Box verschlüsselt ohne manuellen Schritt für AZE (`107436557`) und DDG (`660510336`).

### F4 — Zertifikatsantrag ohne dakota.le (`.p10` erzeugen, `.p7c` → `.p12`) · 🔴 Showstopper für Neukunden
- **Ist:** Praxura kann bisher nur fertige `.p12`-Dateien importieren (`dashboard.js:14631`, `:14654`). Die ITSG liefert aber keine `.p12`, sondern erwartet einen PKCS#10-Antrag (`.p10`) aus einem lokal erzeugten Schlüsselpaar und liefert eine `.p7c`-Zertifikatskette zurück.
- **Soll:** SECON §4.4.5 (Subject-DN: `C=DE, O=ITSG TrustCenter fuer sonstige Leistungserbringer, OU=<Praxisname>, OU=IK<9 Stellen>, CN=<Inhaber>`), §5.8–5.9 (Z. ~2648–3084). 4096-Bit-RSA-Schlüssel, `.p10` selbst mit **RSASSA-PSS** signiert. Upload bei `https://www.itsg-trust.de/zap/upload-request`, Identprüfung per POSTIDENT + Freischaltbrief (1–2 Wochen).
- **Umsetzung:** Browser-Assistent (neues Modul unter `module/`): Schlüsselpaar lokal mit WebCrypto erzeugen → `.p10` (DER) + SHA-256-Hash anzeigen → privaten Schlüssel passwortgeschützt zum Download sichern (mit Warnhinweis „ohne diese Datei ist das Zertifikat wertlos“) → später `.p7c` hochladen → lokal mit dem privaten Schlüssel zu `.p12` bündeln → an bestehenden Import übergeben. Privater Schlüssel geht niemals an den Server.
- **Noch ungeprüft:** Exakte DN-Reihenfolge und Pflichtfelder gegen den aktuellen ITSG-Antrag prüfen (`gkv-302` / `wissensbank`).
- **Fertig-Kriterium:** Echter Antrag mit Klass-68-IK (`590537440`) läuft durch und ergibt eine funktionierende `.p12`.

### F5 — Physischer Dateiname der verschlüsselten Datei · 🟠 schwer
- **Ist:** `api-backend/billing/dta/filename.js:99` erzeugt `${stamm}.dta.enc.p7m`.
- **Soll:** SECON §3.2.3.1: verschlüsselte Binärdatei **ohne Dateiendung**, 8 Zeichen (`ESOL0nnn` / `TSOL0nnn`); Auftragsdatei gleicher Stamm + `.AUF`.
- **Noch ungeprüft:** Groß-/Kleinschreibung `.AUF` vs. `.auf` (GGT Anlage 7 fehlt in `wissensbank/` → über `wissensbank`-Agent herunterladen).
- **Umsetzung:** Interner Speichername kann bleiben, aber der **Versand-Download** muss exakt `ESOL0nnn` und `ESOL0nnn.AUF` (bzw. `TSOL0nnn` / `TSOL0nnn.AUF`) liefern.

### F6 — Versandhilfe im UI (E-Mail statt Portal) · 🟠 schwer
- **Ist:** `dashboard.html:4590` (`dasGuideModal`) beschreibt noch einen Portal-Upload einer `.p7m`; `module/abrechnung-detail.js:~490-500` bietet „DTA herunterladen“ und „Signierte Datei (unverschlüsselt)“ gleichrangig an (Verwechslungsgefahr). `api-backend/billing/kostentraeger/parser.js:261` ignoriert `DFU` → App kennt die DAS-E-Mail-Adresse nicht.
- **Umsetzung:**
  - `DFU` (Protokoll `070`) parsen und Adresse je DAS speichern (Schema: erst `db-ustasi`, Migrationsdatei unter `api-backend/db/migrations/`, dann `db/SCHEMA*.sql` + `db/SCHEMA-RLS.sql`, danach live).
  - Modal neu: Ziel-E-Mail-Adresse, kopierbarer Betreff (nur 9-stellige IK), genau zwei Versanddateien zum Download, Warnhinweis „kein ZIP, keine Signatur-Grafik, keine vCard“. Unverschlüsselte Downloads in Bereich „Archiv“ verschieben. Optional `mailto:`-Link mit Betreff (Anhänge gehen nicht über `mailto:`).
  - **Mit prüfen (ungeprüft):** `waehleAnnahmestelle()` (`kostentraeger/annahmestelle.js:121`) erhält laut Bericht in `abrechnung.routes.js` (Z. 370, 777, 1036, 5003) kein `bundeslandVkg` → landesspezifische DAS (z. B. `105810615`) werden ggf. nicht aufgelöst.

---

## 4. Folge-Fixes F7–F11 (Abschnitt 2 — nach F1–F6)

- **F7 — Absetzung → Korrektur (VKZ 04):** Kassen senden Absetzungen per Brief. `PATCH /verordnung/:id/abrechnungsstatus` (`api-backend/billing/api/verordnung-status.routes.js:322`) aktualisiert nur `prescriptions`, nicht `abrechnung_zeile.status`. Die Korrektur verlangt aber `abrechnung_zeile.status IN ('abgesetzt','teilabgesetzt')` (`abrechnung.routes.js:4944`). Status synchronisieren oder „Absetzung erfassen“ direkt an der Zeile. Zusätzlich prüfen: `module/abrechnung-detail.js:456` schließt `therapie_bereich === 'podo'` aus (Absicht oder Lücke? `podoloji` + `gkv-302` fragen).
- **F8 — Eingangsquittung:** `api-backend/billing/zaa/parser.js` nutzt `CODE_REGEX = /^\d{1,3}$/` (Z. 39) → erkennt 5-/6-stellige Fehlercodes nicht; fehlerfreie Antwort ergibt `valid: false` (Z. 234). Button „Annahme bestätigt“ (startet Zahlungsfrist) + Parser erweitern, sobald echte Quittungen vorliegen.
- **F9 — Zahlungsfrist:** `module/abrechnung-detail.js:98` setzt fest 28 Tage. Podologie-Vertrag §18 Abs. 14 schreibt **21 Tage** ab Eingang der vollständigen Unterlagen (Daten **und** Papier) vor → je Fachbereich aus dem Vertrag ableiten.
- **F10 — Zertifikatsablauf:** Backend blockiert abgelaufene Zertifikate nicht (nur Browser-Prüfung in `dashboard.js:14674`). Backend-Sperre + Warnbanner bei 45 / 30 / 14 Tagen Restlaufzeit.
- **F11 — Begleitzettel / Urbelege:** Druckbare Umschlagliste („welche Verordnung bekommt welche Rechnungs-/Belegnummer, in welchen Umschlag“) + Hinweis auf Einwurfeinschreiben. Ausschlussfrist Podologie: 9 Monate (Vertrag §18 Abs. 5).

---

## 5. Abnahmeziele (2 reale E2E-Tests vor dem ersten zahlenden Kunden)

1. **Test mit eigener Klass-68-IK (`590537440`):**
   - ITSG-Zertifikat für `590537440` über den neuen Assistenten (F4) beantragen.
   - `TSOL0001` + `TSOL0001.AUF` (`03/03`), signiert (RSASSA-PSS) und verschlüsselt, per E-Mail an `inbox@tp5.arz-emmendingen.de`, Betreff `590537440`, UNB Testindikator `0`, Empfänger eine AZE-Kasse (z. B. mhplus BKK `108035612`, aus `node api-backend/billing/dta/ta-validator-satz.mjs --aze <ordner>`).
   - Ziel: automatische Empfangsbestätigung ohne Fehler. ⚠️ **Keine echten Patientendaten in Testdateien.**
2. **Pilotpraxis (Echtbetrieb):**
   - Eine echte Verordnung: Praxis sendet selbst (eigene IK, eigenes E-Mail-Postfach), Muster 13 + Begleitzettel an die Papierannahmestelle (VKG 09).
   - Abnahmekriterium: **Geld geht auf dem Konto der Praxis ein.**
3. **Offene Onboarding-Klärungen (ungeprüft):**
   - Muss bei DAVASO/IQVIA die Absender-E-Mail vorab registriert werden?
   - BITMARCK und einige AOKs verlangen ggf. eine vorherige „Anmeldung als Kommunikationspartner“ → Onboarding-Checkliste erstellen.

---

## 6. Abgleich mit bisherigen AZE-Arbeiten im Repo (Stand 26.11.2026)

Die Codebase- und Log-Recherche zeigt, dass ein wichtiger Teil der Vorarbeit für den AZE-Test bereits von Melih erledigt wurde:

1. **Software-Hersteller-IK (`590537440`) bereits im Code (`21.10.2026`):**
   - `api-backend/billing/dta/software-hersteller-ik.js` (Z. 26) enthält `SOFTWARE_HERSTELLER_IK = '590537440'` (von ARGE·IK erteilt) inkl. Sicherheitsgitter: `kind: 'echt'` wird hart blockiert, `test` und `erprobung` sind erlaubt (`software-hersteller-ik.test.js`).
2. **AZE Emmendingen (`107436557`) in Kostenträger-Seed-Migrationen:**
   - Enthalten in `api-backend/db/migrations/0006_seed_kostentraeger.sql`, `0045_seed_kostentraeger_q4_2026.sql`, `0132_seed_kostentraeger_q4_2026_nachlieferung.sql` und `0040_kostentraeger_auswahl_view.sql`.
3. **Testdatensatz-Generatoren bereits vorhanden & getestet (`19.11.2026`):**
   - Podologie: `api-backend/billing/dta/ta-validator-satz.mjs` (`--aze` für Nutzdatei + `.AUF`, repariert nach strengerer KVNR-Prüfung → 8/8 bzw. AZE 7/7).
   - Physiotherapie: `api-backend/billing/dta/ta-validator-satz-physio.mjs` (5 synthetische Fälle `TSOL0101`–`TSOL0105`, ab 101 nummeriert zur Kollisionsvermeidung mit Podologie `TSOL0001`).
   - Test-Guard: `api-backend/billing/dta/ta-validator-satz.test.js`.
4. **Erster realer AZE-E-Mail-Testlauf bereits erfolgreich angenommen (`19.–20.11.2026`, siehe `fortschritte/2026-11-19.md` und [[2026-11-19_physio-launch-stufe1-sitzung-auth-raeume-ueberblick]]):**
   - Am 19.11. (~20:40) wurden 5 Test-Mails (`TSOL0101–0105` + 348-Byte-`.AUF`) aus Melihs Gmail an `inbox@tp5.arz-emmendingen.de` gesendet.
   - Erstes Learning (20:45): Automatische Ablehnung wegen Zusatztext im Betreff → nach Korrektur auf **reinen Betreff `590537440`** erfolgte am 19.11. um 22:25 die **formale Annahmebestätigung für alle 5 Physio-Testdateien** (z. B. Referenz `590537440_20261119210004_85`) und Weiterleitung an nachgelagerte Prüfverfahren. Das finale inhaltliche Prüfergebnis war zuletzt (21.11.) noch als offen markiert.
5. **Zusammenhang mit Kemals Nachricht:**
   - Der Lauf vom 19.11. hat den **Transportweg (E-Mail an AZE), die Betreff-Konvention (`590537440`), den 348-Byte-Auftragssatz und die EDIFACT-Struktur im unverschlüsselten Testmodus (`00/00`)** bereits erfolgreich bewiesen.
   - Kemals Fix-Paket (F1–F6) baut direkt darauf auf, um vom unverschlüsselten Test (`00/00`) auf den **echtbetriebsfähigen, SECON-signierten (RSASSA-PSS) und verschlüsselten (`03/03`) Versand** ohne dakota.le zu kommen.

---

## 7. Aufgabenverteilung: Agent vs. Melih

### Kann der Agent (autonom im Repo) erledigen
- Git-Stand sauber synchronisieren (nach Melihs Entscheidung zu den offenen gestagten `0134`/Schema-Dateien).
- Pflichtberatung einholen (`fonksiyon-ustasi`, `db-ustasi`, `onprem`, `gkv-302`, `wissensbank`, `podoloji`).
- Fehlende GGT Anlage 7 (`.AUF` vs. `.auf`) und ITSG-DN-Vorgaben gegen `wissensbank/` prüfen.
- Alle Code-, Schema-, UI- und Test-Fixes **F1 bis F6** sowie anschließend **F7 bis F11** einzeln, lokal getestet (`npm test`, `openssl cms -verify`, `typecheck`, `funktionskarte.mjs`) als saubere Commits auf `main` umsetzen.
- Testdateien (`TSOL0001` + `TSOL0001.AUF`, `03/03`, PSS-signiert & verschlüsselt) lokal erzeugen und prüfen.
- Onboarding-Checkliste für Datenannahmestellen (DAVASO/IQVIA, BITMARCK, AOK) aus den Dokumenten/Quellen vorbereiten.

### Muss Melih selbst übernehmen (bzw. explizit freigeben)
1. **Git-Klärung & Push-/Deploy-GO:** Entscheidung über die aktuell lokal gestagten Dateien (`0134_booking_raum_leistung_standort.sql`, `db/SCHEMA*.sql`) sowie ausdrückliches GO für `git push` / Live-Schema-Anwendung.
2. **Architektur-Entscheidungen bei Stopppunkten:** z. B. F3 Variante (a) DB-Upsert vs. (b) direktes Lesen aus `trust-anchors/` (nach Empfehlung von `onprem` + `db-ustasi`).
3. **Echter ITSG-Zertifikatsantrag (F4-Abnahme):** `.p10` mit dem neuen Assistenten für IK `590537440` erzeugen, bei `https://www.itsg-trust.de/zap/upload-request` hochladen, **POSTIDENT** durchführen, Freischaltbrief abwarten (1–2 Wochen) und `.p7c` → `.p12` abschließen.
4. **Echter E-Mail-Versand an AZE (`inbox@tp5.arz-emmendingen.de`) & Prüfung der Antwort-Mails:** Versand der signierten+verschlüsselten `TSOL0001` + `TSOL0001.AUF` aus dem eigenen Postfach (und Nachschauen, ob für `TSOL0101–0105` vom 19.11. inzwischen die finale Prüfantwort eingetroffen ist).
5. **Externe Rückfragen bei DAS:** Klärung bei DAVASO/IQVIA, BITMARCK und AOK wegen Absender-Registrierung / Anmeldung als Kommunikationspartner.
6. **Pilotpraxis-Abnahme:** Koordination mit der Pilotpraxis für den ersten echten Rezeptversand (Daten per Praxis-E-Mail + Muster 13/Begleitzettel per Post) und Bestätigung des Zahlungseingangs.

---

## 8. Kopier-Prompt aus Kemals Übergabe (unverändert)

```text
Lies zuerst CLAUDE.md und dann ABRECHNUNG_EMAILWEG_FIXPAKET.md im Repo-Wurzelverzeichnis vollständig.
Aufgabe: Setze die Pflicht-Fixes F1 bis F6 aus Abschnitt 1 um, in dieser Reihenfolge, jeden als eigenen,
getesteten Commit auf main. Danach F7 bis F11 aus Abschnitt 2.

Arbeitsweise:
- Vor jedem Fix: fonksiyon-ustasi fragen, ob es die Funktion schon gibt; bei Schema db-ustasi; bei allem,
 was die Box betrifft (Trust-Anchors, Updates, Startlogik) onprem; bei Spezifikationsfragen gkv-302.
 Diese Agenten darfst du ohne Rückfrage aufrufen.
- Prüfe jede Angabe in der Datei selbst gegen Code und wissensbank/ (Zeilennummern können verrutscht sein).
 Wenn etwas nicht stimmt, schreibe es in die Datei unter dem Fix als "Korrektur (Datum)".
- dashboard.js darf nicht wachsen: neuer Code nach module/. Keine CDN-Skripte, Libraries nach vendor/.
- Private Schlüssel und Patientendaten verlassen nie den Rechner/Server der Praxis.
- Schema: erst Migrationsdatei, dann db/SCHEMA*.sql aktualisieren, dann live anwenden.
- Nach jedem Fix: npm test, node tools/funktionskarte.mjs ("harita güncelle"), Commit.
- Wenn ein Fix größer ist als gedacht oder du an eine Entscheidung kommst (z. B. F3 Variante a oder b),
 stoppe und frag mich mit zwei Optionen und deiner Empfehlung.
Am Ende: kurzer Bericht, was erledigt ist, was offen ist, und was für den E2E-Test (Abschnitt 3) noch fehlt.
```

---

## 9. Umsetzungsstand (26.11.2026 — lokal umgesetzt & getestet, Push wartet auf GO)

- **Pflichtberatung eingeholt:** `gkv-302`, `onprem` + `db-ustasi`, `fonksiyon-ustasi` (alle Spezifikations-, Schema-, On-Prem- und Zeilennummern-Prüfungen abgeschlossen).
- **Pflicht-Fixes F1–F6 lokal umgesetzt, getestet & einzeln auf `main` committed:**
  - **F1 (`0d1b9dd4`):** `module/dta-signatur.js` (WebCrypto RSASSA-PSS, SHA-256, MGF1-SHA256, `saltLength: 32`, OpenSSL-3.5.6-verifiziert), Backend-Pflichtprüfung in `api-backend/billing/dta/signed-original.js` (lehnt PKCS#1 v1.5 ab), `dashboard.js` um 36 Zeilen geschrumpft (`17461 → 17425`).
  - **F2 (`4b3d33d0`):** `buildAuftragsdatei` + `aktualisiereAuftragsdateiFuerVerschluesselung` (`03/03` + verschlüsselte Bytegröße), automatische Neu-Erzeugung & Versionierung in `abrechnung.routes.js`.
  - **F3 (`1fc7edc6` + `cbd8d335`):** Variante (b) / O-132 (`findeEmpfaengerZertifikatInTrustAnchors` + DB als Override); **kritischer Fund behoben:** 60/60 echte ITSG-DAS-Zertifikate in `annahme-rsa4096.key` tragen keine `keyUsage`-Extension (`2.5.29.15`) → `empfaenger-zertifikat-pruefung.js` korrigiert; E2E-Verschlüsselung für AZE (`107436557`) und DDG (`660510336`) ohne DB-Eintrag bewiesen.
  - **F4 (`fe618778`):** `module/itsg-zertifikat-assistent.js` (4096-Bit-Keygen, SECON-Subject-DN `PrintableString`, RSASSA-PSS `.p10` OpenSSL-verifiziert, `subjectPublicKey` SHA-256-Hash, lokaler verschlüsselter Key-Download, `.p7c` → `.p12`-Bündelung) in `module/abrechnung-einstellungen.js` eingehängt; `www.itsg-trust.de` in `tools/fremde-hosts.mjs` registriert.
  - **F5 (`166c2c2d`):** `buildVersandDateinamen` (`ESOL0nnn`/`TSOL0nnn` ohne Endung + `.AUF`), Download-Namen in `module/abrechnung-detail.js` und `artefakt-historie.js` korrigiert.
  - **F6:** `DFU`-Protokoll `070` im `kostentraeger/parser.js`, fertiger Migrationsentwurf `db/entwuerfe/0135_kostentraeger_dfu_email.sql` (35 IKs aus Q4/2026), E-Mail-Versandhilfe im `dasGuideModal` (`dashboard.html`, `module/abrechnung-empfaenger.js`, `module/abrechnung-detail.js`: unverschlüsselte Downloads ins zugeklappte Archiv verschoben).
- **Folge-Fixes F7–F11 lokal umgesetzt & getestet:**
  - **F7:** Absetzung/Teilabsetzung in `verordnung-status.routes.js` synchronisiert auf `abrechnung_zeile` (`teilabgesetzt`/`abgesetzt`, Betrag gedeckelt auf `netto_eur`). (`abrechnung-detail.js:456` ist laut `gkv-302` absichtlich für Physio/Ergo/Logo — kein Bug.)
  - **F8:** `zaa/parser.js` akzeptiert jetzt 5-/6-stellige GKV-Fehlercodes (1–3 oder 5–6 Stellen).
  - **F9:** Zahlungsfrist in `module/abrechnung-detail.js` und `module/abrechnung-verlauf.js` auf **21 Kalendertage** (Podologie-Vertrag §18 Abs. 14 & Physio-Vertrag §18 Abs. 12) umgestellt.
  - **F10:** Backend `upload-signed` blockiert abgelaufene Zertifikate (`422 CERT_EXPIRED`); Ablauf-Banner bereits ab **45 Tagen** (45/30/14 Tage).
  - **F11:** `begleitzettel.template.js` auf E-Mail-Versand (`dateiname` + `.AUF`), Hinweis Einwurfeinschreiben und 9-Monate-Ausschlussfrist (§18 Abs. 5) aktualisiert.
- **Audit-Härtung (`1213aac0`, 26.11.2026 — Security- & SECON-Audit + Gap-Check):**
  - **[KRITISCH F1/F4]:** `node-forge` zerstörte bei `certificateToAsn1()` die CA-Signatur aller 65/65 echten ITSG RSASSA-PSS-Zertifikate (`roundtripEqual: 0/65`). Umstellung auf unveränderte Roh-DER-Bytes in `module/dta-signatur.js` (`extrahiereRohCertDerAusForgeBag`) und `module/itsg-zertifikat-assistent.js` (`extrahiereRohCertsAusP7c` + Roh-DER-Erhaltung beim `.p12`-Bau); Byte-Identität am echten AZE-Zertifikat bewiesen.
  - **[KRITISCH F10]:** `pruefeSignedDta({ checkCertValidity: true })` prüft jetzt serverseitig `notBefore <= now <= notAfter` direkt gegen das X.509-Signaturzertifikat im CMS (`422 CERT_EXPIRED`/`CERT_NOT_YET_VALID`) statt blindem Vertrauen auf `req.body.certValidTo`.
  - **[KRITISCH F6]:** `DAS_DFU_EMAIL_FALLBACK` in `module/abrechnung-empfaenger.js` deterministisch auf alle 35 Q4/2026-IKs ohne Fehlzuordnung aktualisiert; doppelter Cache-Buster in `module/abrechnung-detail.js:46` behoben.
  - **[MITTEL F2/F3/F9]:** Fail-Closed bei `.auf`-Neuerzeugung; explizite CA-Sperre (`x509Cert.ca` + `keyCertSign`) in `empfaenger-zertifikat-pruefung.js`; SHA-256-Zuordnung in `itsg-trust-anchor.js`; letzte 28-Tage-Stelle (`geldstand` in `abrechnung.routes.js:2648`) + Tooltip auf 21 Kalendertage umgestellt.
- **Nacharbeiten F6/F8/F11 (`f2118b7c`, 27.11.2026 — inkl. `review-bugbot`-Gegenprüfung & Fix aller 9 Befunde):**
  - **F6 (`bundeslandVkg`):** `bundeslandVkgFuerPlz()` (`01`..`16` nach Anhang 3 § 8.4) in `api-backend/billing/codes/plz-bundesland.js` und Durchreichen an alle 6 `ladeAnnahmestelle()`/`ladePapierannahmestelle()`-Aufrufe in `abrechnung.routes.js`.
  - **F8 (`✓ Annahme bestätigt`):** Neuer Endpoint `POST /api/billing/abrechnung/:id/annahme-bestaetigen` (Inhaber, direkter atomarer CAS, Datum-Validierung, setzt `status = 'accepted'` + startet 21-Tage-Frist) + UI-Button in `module/abrechnung-detail.js` (`?v=20261127f8`).
  - **F11 (Umschlag-Übersichtsliste):** `renderUmschlagListe()` in `api-backend/billing/pdf/begleitzettel.template.js` als druckbares Deckblatt im Bundle (Umschlag-Nr., Gesamtrechnung, Papierannahmestelle, Belegnummern + `patient_nachname, patient_vorname`, Einwurfeinschreiben & 9-Monate-Frist).
- **AZE-E2E-Pipeline-Test (`api-backend/billing/dta/aze-e2e-pipeline.test.js`, 27.11.2026):** Vollständiger lokaler Dry-Run am realen AZE-Fall (`590537440` → `107436557`, mhplus BKK `108035612`): `buildDtaFile` → RSASSA-PSS-Signatur → `pruefeSignedDta(checkCertValidity: true)` → Trust-Anchor-Verschlüsselung (echtes AZE-Zertifikat) → `03/03`-Auftragsdatei (348 Byte) → Versand-Dateinamen (`TSOL0001` + `TSOL0001.AUF`).
- **Offen (wartet auf Melih):** Push-GO, Live-Anwendung `db/entwuerfe/0135_kostentraeger_dfu_email.sql`, echter ITSG-`.p10`-Antrag für `590537440` + POSTIDENT (inkl. einmaligem SHA-256-Hash-Vergleich im ITSG-Portal), AZE-E2E-Versand (`TSOL0001` + `.AUF` `03/03`), Rückfragen DAVASO/BITMARCK/AOK, Pilotpraxis-Echtversand.
