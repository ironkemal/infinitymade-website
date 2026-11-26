# §302-Abrechnung per E-Mail ohne dakota.le — Fix-Paket (Übergabe an Melih)

**Stand:** 26.11.2026 · **Verantwortlich:** Melih · **Ops-Karte:** „§302 E-Mail-Weg: 6 Pflicht-Fixes + E2E-Test" (Kategorie Teknik)
**Quelle:** Red-Team-Bericht (agy Orchestrator Neon) `Claude outputs/2026-11-26-abrechnung-risiko/BERICHT.md` (lokal bei Kemal, nicht im Repo).
Jede Zeile unten wurde danach in der Hauptsitzung **gegen Code und Spezifikation nachgeprüft**. Was nicht nachgeprüft ist, steht als „ungeprüft" da.

---

## 0. Worum es geht (Kurzfassung)

Produktentscheidung (Kemal, 26.11.2026): **Praxura sendet nie selbst an die Kassen.** Die Praxis schickt die Abrechnung
**selbst per E-Mail** an die Datenannahmestelle (DAS). Praxura erzeugt dafür alles: DTA, Signatur, Verschlüsselung,
Auftragsdatei, Begleitzettel. Kein dakota.le, kein Abrechnungszentrum, keine Provision. Kosten für die Praxis:
nur ihr ITSG-Zertifikat (79 € erstes Jahr, 49 € Verlängerung, 1 Jahr gültig).

**Ist der Weg grundsätzlich möglich?** Ja.
- Alle 28 Heilmittel-DAS-IKs in der Kostenträgerdatei Q4/2026 haben im `DFU`-Segment Protokoll `070` (E-Mail),
  zusammen 9 Adressen (z. B. `da@dta.aok.de`, `edi302@iqvia-hss.de`, `dta302@ddg-online.de`, `le@bitmarck-daten.de`,
  `inbox@tp5.arz-emmendingen.de`).
- dakota.le ist in keinem offiziellen Dokument Pflicht. Für TP5-Software gibt es keine Herstellerzertifizierung.
- AZE Emmendingen hat schriftlich bestätigt (03.11.2026): E-Mail für Test und Echtbetrieb, je Mail genau **eine** Nutzdatei
  und **eine** Auftragsdatei als getrennte Anhänge, kein ZIP, Betreff = 9-stellige Absender-IK, Auftragssatz exakt 348 Byte.
  Die Freigabe hängt an der **IK der Praxis**, nicht an der Software. Klass-68-IK (590537440) darf im **Test** Absender sein.

**Heute würde der erste echte Versand trotzdem abgewiesen.** Grund sind die Fehler F1–F4 unten. Alle sind lösbar.
Keiner ist ein rechtliches oder grundsätzliches Hindernis.

---

## 1. Pflicht-Fixes (Reihenfolge = Abhängigkeit)

### F1 — Signatur muss RSASSA-PSS sein (heute PKCS#1 v1.5) · 🔴 Showstopper
- **Ist:** `dashboard.js:14681` `forge.pkcs7.createSignedData()` mit `addSigner({ key, digestAlgorithm: sha256 })`.
  node-forge signiert dabei mit `rsaEncryption` (PKCS#1 v1.5). forge kann in PKCS#7 kein PSS.
- **Soll:** `wissensbank/gemeinsam/302-tp5/GGT_Anlage_16_Security_Schnittstelle_SECON.txt` §1.1 (Z. 183–185) und §2.1.2 (ab Z. 388):
  Signatur **RSASSA-PSS** (OID `1.2.840.113549.1.1.10`), SHA-256, MGF1-SHA256, saltLength 32. Gültig ab 01.01.2026.
- **Weg:** CMS SignedData mit WebCrypto `RSA-PSS` + `pkijs`/`asn1js` bauen (wie die OAEP-Verschlüsselung in
  `api-backend/billing/dta/verschluesselung.js`). Den privaten Schlüssel aus der `.p12` weiter im Browser halten (K2:
  Schlüssel verlässt den Rechner der Praxis nicht).
- **⚠️ Repo-Regel:** `dashboard.js` darf nicht wachsen (`tools/check-dashboard-size.sh`). Den Signaturcode nach
  `module/dta-signatur.js` (Name frei) auslagern und in `dashboard.js` nur noch aufrufen. Vendor-Libs lokal unter `vendor/`
  (kein CDN, Konsey 2026-08-13 S3).
- **Backend:** `api-backend/billing/dta/signed-original.js` (`pruefeSignedDta`) soll `signatureAlgorithm == 1.2.840.113549.1.1.10`
  prüfen und PKCS#1 v1.5 ablehnen. Test `signed-original.test.js` erzeugt heute selbst mit forge → Test-Fixture auf PSS umstellen.
- **Fertig, wenn:** eine signierte Datei mit `openssl cms -verify` geprüft PSS-Parameter zeigt; `npm test` grün.

### F2 — Auftragsdatei nach Verschlüsselung neu erzeugen (heute fest `00/00`) · 🔴 Showstopper
- **Ist:** `api-backend/billing/dta/auftragsdatei.js:209-210` schreibt fest `VERSCHLÜSSELUNGSART='00'`,
  `ELEKTRONISCHE_UNTERSCHRIFT='00'`; `DATEIGRÖSSE_ÜBERTRAGUNG` = Rohgröße. `upload-signed` (in
  `api-backend/billing/api/abrechnung.routes.js`) baut die `.auf` nach der Verschlüsselung **nicht** neu.
- **Soll:** `GGT_Anlage_02_Auftragsdatei.txt` §2.1: für signiert+verschlüsselt `03`/`03` und Übertragungsgröße =
  Bytegröße der **verschlüsselten** Datei. Kommentar im Code sagt selbst: „nur 00+00 oder 03+03 zulässig".
- **Weg:** `buildAuftragsdatei()` um `verschluesselungsart` und `elektronischeUnterschrift` erweitern; in `upload-signed`
  nach erfolgreicher Verschlüsselung `.auf` mit `03/03` und `encryptedBytes.length` neu erzeugen, speichern
  (`auftragsdatei_path`) und in der Artefakt-Historie versionieren (`abrechnung_artefakt_version`).
- **Fertig, wenn:** Test prüft Länge 348 Byte, Stelle 207–210 = `0303`, Größe = verschlüsselte Größe.

### F3 — Empfängerzertifikate der DAS müssen in der Box ankommen · 🔴 Showstopper
- **Ist:** Verschlüsselung liest `public.empfaenger_zertifikate` (`abrechnung.routes.js:1645`). Die Tabelle
  (Migration `0038`) wird in neuen Boxen von nichts befüllt; `tools/empfaenger-zertifikat-laden.mjs` ist ein Handwerkzeug.
  Ohne Eintrag: `verschluesselt:false` + Hinweis, Upload antwortet trotzdem 200 (Fall A, Kommentar ab Z. 1600).
- **Vorhanden:** `api-backend/billing/dta/trust-anchors/` enthält die ITSG-Liste `annahme-rsa4096.key` (65 Zertifikate:
  CA/PCA + 60 DAS-Blätter), wöchentlich aktualisiert durch `.github/workflows/itsg-trust-anchor-check.yml`.
- **Weg (eine Variante wählen, vorher `onprem` + `db-ustasi` fragen):** (a) beim Start/Update die DAS-Blätter aus
  `trust-anchors/` in `empfaenger_zertifikate` upserten (Abgleich über `OU=IK…`), oder (b) `berechneVerschluesselung()` liest
  direkt aus `trust-anchors/`, Tabelle nur noch Override. Danach: „kein Zertifikat" darf für keine der 26 `VKG 03`-DAS mehr auftreten.
- **Fertig, wenn:** frische Box ohne manuellen Schritt verschlüsselt für AZE (`107436557`) und DDG (`660510336`).

### F4 — Zertifikatsantrag ohne dakota.le: `.p10` erzeugen, `.p7c` → `.p12` · 🔴 Showstopper für Neukunden
- **Ist:** Praxura kann nur eine fertige `.p12` importieren (`dashboard.js:14631`, `:14654`). ITSG gibt aber keine `.p12` aus:
  Antrag = PKCS#10 (`.p10`) aus einem lokal erzeugten Schlüsselpaar; Antwort = `.p7c` (nur Zertifikatskette).
  Wer heute ohne dakota.le startet, kommt nicht an eine `.p12`.
- **Soll:** SECON §4.4.5 (Subject-DN: `C=DE, O=ITSG TrustCenter fuer sonstige Leistungserbringer, OU=<Praxisname>,
  OU=IK<9 Stellen>, CN=<Inhaber>`), §5.8–5.9 (Z. ~2648–3084). Schlüssel 4096 Bit, `.p10` selbst mit **RSASSA-PSS** signiert.
  Upload: `https://www.itsg-trust.de/zap/upload-request`, Identprüfung per POSTIDENT + Freischaltbrief (1–2 Wochen).
- **Weg:** Assistent im Browser (neues Modul unter `module/`): Schlüsselpaar mit WebCrypto erzeugen → `.p10` (DER) + SHA-256
  anzeigen → privaten Schlüssel passwortgeschützt sichern (Download, Hinweis „ohne diese Datei ist das Zertifikat wertlos")
  → später `.p7c` hochladen → mit Schlüssel zu `.p12` bündeln → in den bestehenden Import geben. Kein Schlüssel an unseren Server.
- **Ungeprüft:** exakte DN-Reihenfolge und Pflichtfelder gegen den aktuellen ITSG-Antrag prüfen (gkv-302 / wissensbank).
- **Fertig, wenn:** ein echter Antrag mit dem Klass-68-IK (590537440) durchläuft und eine funktionierende `.p12` ergibt.

### F5 — Physischer Dateiname der verschlüsselten Datei · 🟠 schwer
- **Ist:** `api-backend/billing/dta/filename.js:99` → `${stamm}.dta.enc.p7m`.
- **Soll:** SECON §3.2.3.1: verschlüsselte Binärdatei **ohne Endung**, 8 Zeichen `ESOL0nnn`/`TSOL0nnn`; Auftragsdatei gleicher
  Stamm + `.AUF`. Ungeprüft: `.AUF` vs `.auf` (GGT Anlage 7 liegt nicht in `wissensbank/` → herunterladen über `wissensbank`-Agent).
- **Weg:** Speichername darf intern bleiben, aber der **Download für den Versand** muss genau `ESOL0nnn` + `ESOL0nnn.AUF` liefern.

### F6 — Versandhilfe im UI (E-Mail statt Portal) · 🟠 schwer
- **Ist:** `dashboard.html:4590` `dasGuideModal` spricht vom Portal-Upload einer `.p7m`; `module/abrechnung-detail.js:~490-500`
  bietet „DTA herunterladen" (unverschlüsselt) und „Signierte Datei (unverschlüsselt)" gleichrangig an → Verwechslungsgefahr.
  `api-backend/billing/kostentraeger/parser.js:261` ignoriert `DFU` → die DAS-E-Mail-Adresse kennt die App gar nicht.
- **Weg:** `DFU` (Protokoll `070`) parsen und Adresse je DAS speichern (Schema → erst `db-ustasi`, Migration-Datei zuerst,
  dann Dump, CLAUDE.md „Şema dökümü protokolü"). Modal neu: Ziel-Adresse, Betreff (nur 9-stellige IK, kopierbar),
  genau zwei Dateien zum Download, Warnung „kein ZIP, keine Signatur-Grafik, keine vCard". Unverschlüsselte Downloads unter „Archiv".
  Optional `mailto:` mit Betreff (Anhänge kann mailto nicht).
- **Mit prüfen:** `waehleAnnahmestelle()` (`kostentraeger/annahmestelle.js:121`) bekommt in `abrechnung.routes.js` kein
  `bundeslandVkg` (laut Bericht Z. 370, 777, 1036, 5003 — ungeprüft) → landesspezifische DAS (z. B. `105810615`) werden nicht aufgelöst.

---

## 2. Nach dem Versand (wichtig, aber nach F1–F6)

- **F7 Absetzung → Korrektur (VKZ 04):** Kassen melden Absetzungen per **Brief**. `PATCH /verordnung/:id/abrechnungsstatus`
  (`api-backend/billing/api/verordnung-status.routes.js:322`) setzt nur `prescriptions`, nicht `abrechnung_zeile.status`.
  Die Korrektur verlangt aber `abrechnung_zeile.status IN ('abgesetzt','teilabgesetzt')` (`abrechnung.routes.js:4944`).
  → Status synchronisieren oder „Absetzung erfassen" direkt an der Zeile. Zusätzlich prüfen: `module/abrechnung-detail.js:456`
  schließt `therapie_bereich === 'podo'` aus — Absicht oder Lücke? (`podoloji` + `gkv-302` fragen.)
- **F8 Eingangsquittung:** `api-backend/billing/zaa/parser.js` — `CODE_REGEX = /^\d{1,3}$/` (Z. 39) erkennt 5/6-stellige
  Fehlercodes nicht; fehlerfreie Antwort → `valid:false` (Z. 234). → Knopf „Annahme bestätigt" (startet Zahlungsfrist) +
  Parser erweitern, sobald echte Quittungen vorliegen.
- **F9 Zahlungsfrist:** `module/abrechnung-detail.js:98` fest 28 Tage. Podologie-Vertrag §18 Abs. 14: **21 Tage** ab Eingang
  der vollständigen Unterlagen (Daten **und** Papier). Je Fachbereich aus dem Vertrag.
- **F10 Zertifikatsablauf:** Backend blockiert abgelaufene Zertifikate nicht (nur Browser `dashboard.js:14674`). Banner 45/30/14 Tage.
- **F11 Begleitzettel/Urbelege:** Liste „welche Verordnung bekommt welche Rechnungs-/Belegnummer, in welchen Umschlag" zum
  Ausdrucken; Hinweis Einwurfeinschreiben. Ausschlussfrist Podologie: 9 Monate (Vertrag §18 Abs. 5).

---

## 3. Abnahme: echter Ende-zu-Ende-Test (vor dem ersten zahlenden Kunden)

1. **Test mit eigener IK:** ITSG-Zertifikat für Klass-68-IK **590537440** über den neuen Assistenten (F4) beantragen.
   `TSOL0001` + `TSOL0001.AUF` (`03/03`) signiert + verschlüsselt per E-Mail an `inbox@tp5.arz-emmendingen.de`,
   Betreff `590537440`, UNB Testindikator **0**, Empfänger eine AZE-Kasse (z. B. mhplus BKK `108035612`, liegt im Testset
   `node api-backend/billing/dta/ta-validator-satz.mjs --aze <ordner>`). Ziel: automatische Quittung ohne Fehler.
   ⚠️ Kein echter Patient in Testdateien.
2. **Pilotpraxis:** eine echte Verordnung, Praxis sendet selbst (eigene IK, eigenes Postfach), Muster 13 + Begleitzettel an die
   Papierannahmestelle (VKG 09). Abnahme = Geld auf dem Konto der Praxis.
3. Offen klären: DAVASO/IQVIA — Absender-Adresse vorher registrieren? BITMARCK und einige AOK verlangen eine
   „Anmeldung als Kommunikationspartner" vor dem ersten Versand (Bericht B.3, ungeprüft) → Checkliste fürs Onboarding.

## 4. Regeln, die dabei gelten

- Vorher fragen (Pflicht, ohne Erlaubnis): `fonksiyon-ustasi` (gibt es das schon?), `db-ustasi` (Schema), `onprem` (Box-Verhalten,
  Updates der Trust-Anchors), `gkv-302` (Spezifikation). Nachher `fonksiyon-ustasi` Absicht melden, Karte aktualisieren.
- Schema: erst `api-backend/db/migrations/NNNN_*.sql`, dann `db/SCHEMA*.sql`, dann live.
- K2/K6: privater Schlüssel und Patientendaten verlassen nie die Praxis; Praxura-Server senden nichts an DAS.
- Direkt auf `main`, kleine Commits, Auto-Commit-Regel.

---

## 5. Prompt zum Kopieren (für Claude Code in Melihs Sitzung)

```
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
