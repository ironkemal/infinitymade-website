# Konsey Kararı — Ops #301: `krankenkassen.ik_number` (18 von 94 NULL)

Tarih: 2026-09-21 · Oturan üyeler: gkv-302 (⛔ veto hakkı), db-ustasi, guvenlik, podoloji, muhalif, deger-mi, fonksiyon-ustasi
Oturmayanlar: legal-de (ON-PREM ETKİSİ: hayır — Referenzdaten, keine PHI), mobil-ui (kein UI-Layout), onprem (Agent-Datei fehlt in `.claude/agents/`), dış göz (`agy` kurulu değil)
Not: 2. Tur (Kör nokta) gerekmedi — kimse birbiriyle çelişmedi; ⛔ yalnız C'ye verildi, C'yi kimse savunmadı.

Ausgangslage: Live 94 Zeilen, 76 gefüllt, 18 NULL (öffentliche Route `GET /api/krankenkassen`, 21.09.2026). Nutzer-Vorgabe war „alle 94 belegt". `gkv-302` (Runde davor): Karten-IK (Muster 13) und Kostenträger-IK (per VKG 01 aufgelöst) sind zwei Pflichtfelder; AOK BW hat 14 gleichrangige Bezirks-IKs, keine zentrale.

## KARAR

**#301 wird als Paket A + Auflösungsfix umgesetzt — reine Datenbereinigung, kein „alle 94 belegt", kein Modellwechsel, keine Standard-IK.**

1. **4 Einzelkassen nachtragen (per `id`):** AOK Hessen `105313145`, DIE BERGISCHE KRANKENKASSE `104926702`, BKK firmus `102529638`, Krones BKK `108934142`. `gkv-302`: alle sicher (je `VKG+01`-Selbstverweis in `AO05Q326_KE3` bzw. `BK05Q326_KE1`, kein Storno, kein „gültig bis"); vom Chairman gegen die Dateien gegengeprüft.
2. **5 Mock-IKs auf NULL** (nicht ersetzen): AOK Nordost `101000016`, IKK classic `107708612`, Mobil `107300000`, AOK Niedersachsen `108310401`, AOK Rheinland/Hamburg `107436001` — nicht in der Kostenträgerdatei (0 Treffer, Chairman + `gkv-302`). Schlimmer als NULL: NULL blockiert sichtbar, eine erfundene IK wird gesendet.
3. **Bleiben NULL, begründet:** 12 Mehr-IK-Zeilen (AOK BW, AOK NordWest, IKK - Die Innovationskasse, IKK Brandenburg und Berlin, IKK gesund plus, Koenig & Bauer BKK, mhplus, mkk, SBK, SECURVITA, vivida bkk, ZF BKK — Auswahl hängt an der Karte, nicht ratbar) + „Andere" + „Privatversicherung" (nicht GKV, §302 gilt nicht).
4. **⛔-Auflage von `gkv-302` (Bedingung für A), am 21.09.2026 nachgemessen und korrigiert:** im selben Schritt wird `kostentraegerIkAufloesen` (`api-backend/lib/rezept-felder.js:58-65`, aufgerufen in `POST /api/rezept/confirm` server.js:2630 und `PATCH /api/rezept/:id` server.js:2840, nur wenn das Formular keine IK mitschickt) deterministisch. Der Resolver sucht per `ilike '%<Kassenname>%'` in der Spalte `kostentraeger.name` (das `NAM`-Segment) mit `.limit(1)` ohne `order`. **Gemessen gegen den Seed `0006` (1.043 Zeilen) mit den 94 Dropdown-Namen: 58 → kein Treffer (`null`), 8 → genau ein Treffer, 28 → mehrere Treffer = stiller Zufall** (u. a. DAK 36, BARMER 31, TK 28, AOK NordWest 14, mkk 4, SBK 3, IKK gesund plus 2, vivida 3). Regel: Menge der Treffer auf `abrechnender_kt_ik ?? ik` normalisieren; genau **eine** IK → nehmen, sonst `null` (Fehler statt Treffer). Nur `ist_abrechnender_kt` zu filtern reicht **nicht** (auch `105110220`, die Papierannahmestelle, steht dort auf `t`). Damit lösen 14 Namen eindeutig auf, 22 werden `null`. Fix vor der Migration ausliefern; `api-backend/lib/rezept-felder.test.js` (Stub) muss mit.
5. **Migration `api-backend/db/migrations/0041_krankenkassen_ik_nachtrag.sql (0039 = Ops #302, 0040 = Ops #300 View)`:** Datei zuerst, per `id`, nie per Name; Füllen `WHERE ik_number IS NULL`, Leeren `WHERE ik_number = '<mock>'`; Selbstprüfung relativ, nicht „exakt 75 Zeilen" (Kundenbox hat überall NULL, 0009): die 4 geschriebenen IKs existieren in `kostentraeger` mit `datensatz_status='echt'`, keine Mock-IK bleibt übrig. Rollback = neue Datei (SHA-Verriegelung); die 5 Alt-Werte als Kommentar in der Datei. Dump im selben Commit, dann live. Prod-Write nur nach ausdrücklichem OK.
6. **Neues Fertig-Kriterium (ersetzt „alle 94 belegt"):** jede Zeile trägt eine in `kostentraeger` existierende IK **oder** ein begründetes NULL (Mehr-IK / Nicht-GKV); keine Mock-IK; kein Rezept verlässt das Haus mit geratener IK. Erwartung nach Umsetzung: 75 gefüllt, 19 NULL (12 + 2 + 5).
7. **NOT NULL: nein** (19 NULL sind legitim). Nur Vorschlag, nicht gebaut: Format-CHECK `ik_number IS NULL OR ik_number ~ '^[0-9]{9}$'`. Register: `krankenkassen.ik_number` wird auf „Vorbelegung, nur wenn eindeutig" herabgestuft; „zentral oder regional" = **weder noch** — Karten-IK + VKG-01-Auflösung.
8. **Nicht in #301 (eigene Tickets):**
   - **P1 „Mehr-IK-Kassen entblocken"** — AOK BW ist für Beta-1 heute **nicht abrechenbar** (`abrechnung-auswahl.js:473`). Kleinste Version: das vorhandene Feld `rzPatKasseIk` (wird in `kostentraeger_ik` gespeichert, `verordnung-an-backend.js:81`) bei Mehr-IK-Kassen beim Erfassen als Pflicht mit klarer Meldung (nicht erst bei „Prüfen"), Wert = Karten-IK; bei AOK BW ist Karten-IK = Kostenträger-IK. Stufe 2: OCR-Feld `kassen_ik`.
   - **Karten-IK-Modell** (`prescriptions.krankenkasse_ik` schreiben, `builder.js:124`-Fallback korrigieren) — kein #301-Blocker, Auslöser: erste echte §302-Einreichung / ITSG-Zertifikat.

## Gerekçe

`gkv-302` bindet die Sicherheit an die Datei (Selbstverweis `VKG+01` = Kostenträger; Papierannahmestelle ohne) und legt ⛔ gegen C — eine Standard-IK für 14 AOK-BW-Bezirke erzeugt still falsche Kostenträger. `deger-mi`/`db-ustasi`/`muhalif` treffen sich bei A und beim falschen Fertig-Kriterium („alle 94" erzwingt genau die Mock-IKs, die weg sollen). Den Auflösungsfix macht `gkv-302` zur Bedingung; ohne ihn wäre der Eintrag der 4 Einzelkassen nur halb wirksam. `guvenlik`: kein Veto, Mock-IK→NULL ohne GoBD-Risiko (die 4 Rezepte tragen ihre IK als eigenen Wert).

## Ödün verilenler

- AOK BW bleibt bis zum P1-Ticket NULL: Beta-1s AOK-BW-Rezepte bleiben nicht abrechenbar (heute schon so, jetzt bewusst).
- „Alle 94 belegt" wird nicht erreicht (19 NULL bleiben, begründet).
- Die 4 bestehenden Rezepte auf Mock-IKs bleiben unverändert falsch, bis sie einzeln korrigiert werden.

## Uzlaşma

C ⛔ (gkv-302 Veto, muhalif, deger-mi, podoloji); A freigegeben (guvenlik: kein Veto); NULL ist sichtbar, falsch ist unsichtbar; Auflösungsfix nötig; `builder.js:124` kein #301-Blocker; „alle 94 belegt" ist das falsche Kriterium; die Spalte bleibt, keine dritte Wahrheitsquelle `krankenkassen_ik`.

## Anlaşmazlık

Form der AOK-BW-Entblockung (Folgeticket): `podoloji` OCR-Feld + Erfassungsmaske (einmal je Patient), `deger-mi` Pflicht-Auswahl der echten IKs der Kasse (1–2 Tage), `gkv-302` Karten-IK-Pflicht nur für Mehr-IK-Kassen mit Auflösung über VKG 01. Kern gleich (patientenbezogene Karten-IK statt Kassen-IK), Umsetzungsform entscheidet das Folgeticket. `muhalif`: #300 falsch gestellt — die IK-Suche solle `kostentraeger` durchsuchen, nicht `krankenkassen.ik_number`.

## Kör noktalar

- Der `ilike … limit(1)`-Zufall im Resolver ist **heute schon aktiv** (nicht Teil der Fragestellung; `muhalif`, `gkv-302`, `deger-mi`). ⚠️ **Korrektur des Chairmans:** Das Beispiel „AOK Hessen trifft zufällig 105313145 oder 105110220" war **falsch** — es beruhte auf den IDK-Namen der Datei statt auf der Spalte `name`; dort heißen die Zeilen „AOK-Die Gesundheitskasse in Hessen" und „AOK Rechnungsbelege", `ilike '%AOK Hessen%'` trifft keine. Das reale Ausmaß ist größer (28 von 94 Dropdown-Namen mehrdeutig, siehe Punkt 4) und trifft gerade die Kassen, die wir auf NULL lassen: AOK NordWest, mkk, SBK, vivida bkk, IKK - Die Innovationskasse, IKK gesund plus, Koenig & Bauer BKK bekommen beim Speichern ohne IK **still eine zufällige** der Regional- oder Karten-IKs. „NULL blockiert sichtbar" gilt damit nur, solange der Resolver deterministisch ist — der Fix ist keine Nebensache, sondern die Voraussetzung für die NULL-Strategie. `muhalifs` Behauptung für AOK BW war falsch (0 Treffer, also `null`, kein Zufall).
- Das Feld `rzPatKasseIk` sieht aus wie „Karten-IK", schreibt aber `kostentraeger_ik` (`fonksiyon-ustasi`); `prescriptions.krankenkasse_ik` wird nirgends geschrieben, der OCR-Zweig `verordnung-aus-ocr.js:154` ist tot.
- „IK-Suche aus #300" existiert im Code nicht als eigene Suche; einziger Name→IK-Auflöser ist `rezept-felder.js:55` gegen `kostentraeger` (`fonksiyon-ustasi`).
- Kundenbox: 0009 lässt `ik_number` überall NULL, SaaS hat 71 gefüllte Werte — Dropdown-IK ist in der Box leer (größere Lücke, nicht Teil dieser Runde).
- `db/REGISTER.md` Zeilen ~681 und ~830 sind veraltet („16 von 94", „in jeder Zeile NULL").

## Uygulama — builder'a

- [ ] Schritt 3: Kandidatentabelle abschließen; `gkv-302` prüft dabei zusätzlich Mobil (`101520078`) und AOK Niedersachsen (`102114819`) auf Selbstverweis — nur bei „sicher" Kandidaten für den Nachtrag statt NULL, Entscheidung Melih — K1
- [ ] `db-ustasi`: Semantik `ist_abrechnender_kt` gegen die Q3/2026-Daten bestätigen — K1
- [ ] `rezept-felder.js:58-65` deterministisch machen (+ Test) — K2
- [ ] Migration 0041 schreiben, Dry-Run + Rollback-Plan zeigen — K2
- [ ] Nach ausdrücklichem OK: live anwenden (MCP-Token fehlt: Nutzer autorisiert selbst), Dump tazeln, Nachprüfung aller 75 gefüllten IKs gegen `kostentraeger` (Bericht, kein Abbruch) — K2
- [ ] `db/REGISTER.md` `krankenkassen` (~681, ~828–843) aktualisieren inkl. Begründung „zentral oder regional" — K1
- [ ] P1-Folgeticket „Mehr-IK-Kassen entblocken" anlegen (Ops-Dashboard) — K3

## Backlog (karara dahil DEĞİL)

- Karten-IK-Modell + `builder.js:124` (Auslöser: erste echte §302-Einreichung)
- „Andere"/„Privatversicherung" aus der Kassenliste nehmen (`podoloji`, PRODUKT-ENTSCHEIDUNGEN §91)
- `GET /api/krankenkassen` ohne Rate-Limiter (`guvenlik`, niedrig)
- 4 bestehende Rezepte auf Mock-IKs einzeln korrigieren (`db-ustasi`); `kostentraeger`-Mock-Zeilen dürfen dafür nicht gelöscht werden
- Kundenbox: `ik_number`-Divergenz zu SaaS
- Optionaler Format-CHECK auf `ik_number`

## Sert veto varsa

`gkv-302`: ⛔ gegen C (Standard-IK für Mehr-IK-Kassen). Umgehung: C wird nicht umgesetzt; Mehr-IK-Kassen bleiben NULL, Entblockung über patientenbezogene Karten-IK (P1-Ticket). Zusätzlich Auflage für A: deterministische Namensauflösung im selben Schritt (Punkt 4).

## Nachtrag 21.09.2026 (Chairman, Schritt 3 „Kandidatentabelle", nur gelesen)

Vollprüfung aller 76 gefüllten Dropdown-IKs gegen die 7 Dateien der Kostenträgerdatei (Skript `kt-check`/`audit76`, Scratchpad):
- **9 statt 5 IKs existieren in der Datei nicht:** die 5 bekannten (AOK Nordost 101000016, IKK classic 107708612, Mobil 107300000, AOK Niedersachsen 108310401, AOK Rheinland/Hamburg 107436001) **plus** AOK PLUS 101000026, BAHN-BKK 101317994, BIG direkt gesund 107636345, Landwirtschaftliche Krankenkasse 109006429 (je 0 Treffer in allen 7 Dateien). Das Prinzip aus Punkt 2 („nicht in der Datei → NULL") gilt für alle 9; vermutlich sind es die „9 Mock-Zeilen" aus `db/REGISTER.md` (im Live-Check zu bestätigen). Erwartung damit: **67 → +4 = 71 gefüllt, 23 NULL** (statt 75/19). Prüfung „gehört die IK zur richtigen Kasse" (Namensabgleich, 67 verbleibende): kein Widerspruch.
- **Mobil (`101520078`) und AOK Niedersachsen (`102114819`) sind sichere Ersatz-Kandidaten**, kein NULL nötig: je genau ein Kostenträger-Satz (`VKG+01`-Selbstverweis; Mobil: 2 Karten-IKs verweisen hierher, AOK Niedersachsen: 52; `FKT+04` = „Unverändert", §8.13). Beide stehen im Seed `0006` (`echt`, `ist_abrechnender_kt = t`). Entscheidung Melih: ersetzen statt NULL — dann 73 gefüllt, 21 NULL.
- **BKK firmus:** `102529638` (heißt in der Datei „firmus/Ost") ist der einzige Kostenträger; die anderen zwei Sätze (`103121137`, `107729631`) verweisen per `VKG+01` darauf → n:1, wie AOK Bayern.

### Nachtrag 2 — Entscheidung Melih (21.09.2026) und Suche der IKs für die 4 weiteren Zeilen
- **Melih: Mobil und AOK Niedersachsen werden ersetzt** (nicht NULL): Mobil → `101520078`, AOK Niedersachsen → `102114819`.
- **Melih: für AOK PLUS, BAHN-BKK, BIG direkt gesund, LKK die echten IKs suchen** (statt pauschal NULL). Ergebnis aus der Kostenträgerdatei (Skript `byname.mjs`, Scratchpad):
  - **AOK PLUS → ein Kostenträger `107299005`** (`VKG+01`-Selbstverweis; „AOK Plus" `105998018` verweist darauf; `107799614` „Bereich Dokumentenverarbeitung" hat gar kein `VKG`). Der Satz heißt „DAV AOK Plus Sachsen" — dasselbe Muster wie AOK Bayern `108310400` („DAV AOK Bayern - kubus IT"), das `gkv-302` als „als Kostenträger-IK im DTA korrekt" bestätigt hat. ⚠️ Selbstverweis allein beweist nicht „kein reiner DAS": von 30 VKG+03-Zielen haben 15 einen Selbstverweis. Bei AOK PLUS trägt die Aussage also das Präzedenzurteil zu AOK Bayern; Bestätigung durch `gkv-302` empfohlen. → **ersetzen**.
  - **BAHN-BKK → zwei Kostenträger** `109938503` (9 Karten-IKs) und `109920569` „/OST" (11) → Mehr-IK → **NULL**.
  - **BIG direkt gesund → zwei Kostenträger** `103501080` („Haupt IK") und `103501091` → Mehr-IK → **NULL**. ⚠️ In den Daten stehen **Verweisketten** (`109531476 → 104229606 → 103501080`; `abrechnender_kt_ik` im Seed zeigt nur eine Stufe): der Resolver-Fix muss die Kette bis zum Selbstverweis verfolgen, nicht nur eine Stufe normalisieren.
  - **Landwirtschaftliche Krankenkasse (SVLFG) → acht** regionale Kostenträger, je Selbstverweis, keine Karten-IK verweist hierher (Datei `LK05Q226_KE0`) → Mehr-IK → **NULL**.
- **Endbild:** 4 nachtragen (Hessen, BERGISCHE, firmus, Krones) · 3 ersetzen (Mobil, AOK Niedersachsen, AOK PLUS) · 6 auf NULL (AOK Nordost, IKK classic, AOK Rheinland/Hamburg, BAHN-BKK, BIG, LKK) · **74 gefüllt, 20 NULL** — alle 20 begründet (18 Mehr-IK, 2 nicht GKV).

### Nachtrag 3 — Schritt 4: Migration 0041 + Resolver-Fix (21.09.2026, nur lokal, nicht committet)
- **Migration `0041_krankenkassen_ik_nachtrag.sql`** (Nummer 0041, weil 0039 = Ops #302 und 0040 = Ops #300 (View kostentraeger_auswahl) belegt sind). Erzeugt per Skript aus dem Live-Stand, 13 Zeilen per `id`, drei Selbstprüfungen, Zähler-Marker gemäß README Kural 6. Dry-Run (Simulation, kein SQL-Lauf: kein lokales Postgres, MCP ohne Token): SaaS 76 → 74 gefüllt / 20 NULL; Kundenbox 0 → 7; Störfall (Mobil von Hand geändert) → Selbstprüfung schlägt an. Review `cavecrew-reviewer`: LGTM. `gkv-302`: alle 7 IKs ohne Veto, AOK PLUS sicher (Beleg `AO05Q326_KE3.txt:1551-1568`, `Anlage_1_TP5_V21` :1440-1445).
- **Resolver `kostentraegerIkAufloesen` umgeschrieben** (`api-backend/lib/rezept-felder.js`, Test `rezept-felder.test.js`: 19 grün, ganze Backend-Suite 344 grün): alle Treffer holen (kein `limit(1)`), jeden über `abrechnender_kt_ik` **bis zum Endpunkt** (Ketten, max. 3 Sprünge, Ziel muss aktiv in `kostentraeger` stehen) auf seinen Kostenträger zurückführen, genau ein Kostenträger → IK, sonst `null`. Gegen den vollständigen Seed `0006` mit den 94 Kassennamen gemessen: **14 eindeutig, 80 `null`** (vorher: 28 stiller Zufall). AOK NordWest, mkk, SBK, vivida, IKK IK/gp/BB, Koenig & Bauer, AOK BW, BAHN-BKK, BIG, LKK, AOK Nordost, IKK classic, AOK Rheinland/Hamburg, DAK, TK, BARMER → `null`.
- **⚠️ Restschwäche (nicht durch diesen Fix gelöst):** Die Teilstring-Suche auf `kostentraeger.name` kann eine ANDERE Kasse treffen, wenn deren NAM-Text den Namen enthält: „BKK Salzgitter" → `101931440` („Betriebskrankenkasse Public - Partner der BKK Salzgitter" = BKK Public). Die Auswahlliste trägt für Salzgitter korrekt `101922757` und schickt sie im Normalfall mit, der Resolver ist nur Rückfall. Mögliche Härtung (Folge-Ticket, Entscheidung offen): nur Präfix-/Ganznamen-Treffer zulassen. Zusätzlich: BKK Salzgitter hat neben `101922757` einen Ost-Kostenträger `101921814` → im Audit (Schritt „belegt ≠ richtig") als möglicher Mehr-IK-Fall prüfen.
- **Entscheidung Melih (21.09.2026): Resolver-Härtung = Folge-Ticket, nicht in #301.** Inhalt: Namenssuche nur auf Präfix-/Ganznamen-Treffer einschränken (gegen Fremdtreffer wie „BKK Salzgitter" → BKK Public); Kosten: weniger eindeutig auflösende Namen (z. B. „BERGISCHE KRANKENKASSE" gegen „DIE BERGISCHE KRANKENKASSE" würde `null`). Auslöser/Entlastung: sobald die Auswahlliste die IK verlässlich mitschickt, entfällt die Namenssuche ohnehin (Vorrangpfad `patient.kostentraeger_ik`).
- **Entscheidung Melih (21.09.2026): Resolver-Fix lokal committen, kein Push; Prod-Write „noch nicht"** (MCP-Token nicht gesetzt). Migration 0041 bleibt außerhalb des Repos (~/praxura-ops301-backup), nicht im Repo.
- **Nicht getan, bewusst:** `funktionen/INDEX.json` nicht neu erzeugt (ein paralleler Prozess mit Ops #302 arbeitet im selben Arbeitsverzeichnis) — beim Commit `node tools/funktionskarte.mjs`; `erwartete-zaehler.json` (`bis_version` → 0041, `_hinweis_0040` — erst nachdem die 0040 der anderen Sitzung committet ist) nicht angefasst, gleiche Begründung.

### Nachtrag 4 — Migration 0041 im Repo, Prod steht noch aus (21.09.2026, ~22:50)
- **Committet: `fe0b44f`** (lokal, nicht gepusht) — `api-backend/db/migrations/0041_krankenkassen_ik_nachtrag.sql` (SHA-256 `dcbae796…`), `erwartete-zaehler.json` (`bis_version` 0041 + `_hinweis_0040`, Kural 6), `db/REGISTER.md` (Eintrag `krankenkassen` neu, Kundenbox-Notiz), `db/SCHEMA.sql` (Kommentar). Alle sechs Pre-Commit-Gates bestanden. Reihenfolge eingehalten: Ops #300 (`0040`, `a2d8e68`) war zuvor committet.
- **⏳ Nicht auf Prod angewandt.** Es fehlen (1) der MCP-Token in der Sitzung (Cursor lieferte nur den Platzhalter `${SUPABASE_ACCESS_TOKEN}`; `.mcp.json` ist auf `zsh -c "exec npx …"` umgestellt, ein Reload der Sitzung steht aus) und (2) das ausdrückliche OK von Melih — erst Dry-Run (Transaktion mit ROLLBACK), dann echtes Anwenden. Das Register führt den Eintrag bis dahin als „vorbereitet“.
- **Technik gegen die Race-Condition im geteilten Arbeitsverzeichnis:** Commit über privaten Index (`GIT_INDEX_FILE`), Gates darauf, `HEAD` per Compare-and-Swap (`git update-ref`), danach gemeinsamer Index nur für die eigenen Pfade angeglichen. Anlass: `fa86f5b` hatte am 21.09. durch einen fremd gestagten Index auch #300-Dateien mitgenommen (Git-Notiz am Commit).

### Nachtrag 5 — Umnummerierung vor dem Push (22.09.2026)
- **Anlass:** Kemal hatte auf `origin/main` eine `0038_empfaenger_zertifikate.sql` (§302, Adım 1.3) gepusht, lokal existierte schon eine andere `0038`. Zwei verschiedene 0038 bringen den Runner der Kundenbox zum Stehen; Kemals Datei ist öffentlich, also wurden die **drei lokalen Migrationen umnummeriert**: `0038_seed_heilmittel_katalog_podo_komplex_suche` → **0039**, `0039_kostentraeger_auswahl_view` → **0040**, `0040_krankenkassen_ik_nachtrag` → **0041**. Keine der drei war auf Prod angewandt oder in einer Kundenbox-Version ausgeliefert (SHA-Verriegelung nicht berührt).
- **Lesehilfe:** Alle Nennungen „0038/0039/0040" in den Nachträgen 1–4 oben, in `KARARLAR.md`, `fortschritte/2026-09-21.md` und den Sitzungsnotizen der Tickets #300/#301/#302 wurden mechanisch auf die neuen Nummern verschoben. **Die Begründung „weil 0038/0039 belegt sind" in Nachtrag 3 stammt aus der Zeit davor** — die 0041 ergibt sich heute aus Kemals 0038 plus unseren zwei Vorgängern.
- Commit-Hashes wurden bewusst **nicht** umgeschrieben (Merge statt Rebase): `fa86f5b`, `fe0b44f` u. a. bleiben gültig.

### Nachtrag 6 — gepusht (22.09.2026, ~23:08)
- **`origin/main` = `ff39026`** (Fast-Forward von `9a01bd2`). Der Merge vereint Kemals §302-Verschlüsselung (Adım 1.3, `0038_empfaenger_zertifikate`), die von der #302-Sitzung veröffentlichte Fassung von #302 (`6e30ff0`, `9a01bd2`) und die lokalen Stände von #300, #301 und #303. Merge statt Rebase — `fa86f5b`, `fe0b44f`, `06fb6d7` bleiben gültig. Im Merge-Stand: Frontend 1030, Backend 373, Tools 25 Tests grün.
- **Damit ist live:** der Resolver-Fix (`fa86f5b`, Backend via Image-Build + Watchtower) und die IK-Suche im Kassenfeld (`4078c8c`, Frontend). Die View `kostentraeger_auswahl` (Migration 0040) ist **nicht** auf Prod — das Frontend liefert dann eine leere Trefferliste und eine Konsolenwarnung, die Namenssuche ist unberührt (gemessen: die View liefert auf Prod `PGRST205`).
- **Migrationen 0039, 0040 und 0041 sind gepusht, aber auf Prod nicht angewandt** (das echte Anwenden fehlt noch; MCP-Token in der Sitzung, ausdrückliches OK). Reihenfolge: erst die View (0040), dann prüfen, dass die IK-Suche etwas findet; 0041 nach Dry-Run.
