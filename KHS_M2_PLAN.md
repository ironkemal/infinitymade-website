# KHS M2 — Bauplan (Rezeptarten · Rechnung · Branding)

> Stand: 03.10.2026, **aktualisiert 05.10.2026 (siehe Abschnitt 0)** · Erstellt als **reiner Lese-Plan** (es wurde kein Code und keine Datei außer dieser geändert).
> Gehört zu `KUTU_HAZIRLIK_SPRINT.md` §4 (Hat M, Aufgaben M2.1–M2.8). Wo dieser Plan dem Sprint-Text
> widerspricht, gilt **dieser Plan** (Begründung in §2), weil er gegen den echten Code geprüft wurde.
> Repo ist PUBLIC: keine Namen, IPs, Schlüssel, keine echten Patientendaten in diese Datei.

**Gate:** M2 startet erst, wenn M1 komplett fertig und gepusht ist (**erfüllt: M1 ✅* am 05.10.2026, M2 freigegeben**) und
`git status` (eigene Dateien) sauber ist. Grund: gleiche Dateien (`dashboard.js`, `api-backend/billing/**`, `module/verordnung-*`).

---

## 0. AKTUALISIERUNG 05.10.2026 (nach M1-Abnahme) — hat Vorrang vor älteren Stellen dieses Plans

**Freigabe:** M1 ist abgenommen (Sprint §0 „✅*", Einschränkungen E1–E4: positiver Verschlüsselungsfall, Box-Prüfung, Schema-Export, M1.16b/DAS — nichts davon blockiert M2). **M2 ist von Melih am 05.10.2026 freigegeben.** Phase 0 Punkt 1 ist damit erfüllt.

Geprüft gegen den heutigen Code (Stichproben): `prescriptions_rezeptart_check` erlaubt weiter nur `kassen|privat|selbstzahler` (kein `bg`); der §302-Guard `rezeptart !== 'kassen'` steht in `abrechnung.routes.js` (heute um Z.3731 und Z.4546); `profiles` hat `praxis_logo_url`, `invoice_footer_text`, `iban`, `steuernummer`, `tax_exempt_note`; ein Stempel existiert im Code nicht; `setup.html` hat weiter 4 Schritte. Die Ist-Tabelle in §1 gilt unverändert.

**Was sich seit 03.10. geändert hat (neu beachten):**
1. **Migrationen:** `0060`–`0066` sind vergeben und auf SaaS (Registry, ZAA atomar, VKZ03-Trigger, Nachregistrierung, Client-Sperren). Nächste freie Nummer **0067** — trotzdem erst zum Schreibzeitpunkt aus `api-backend/db/migrations/` lesen. Ablauf unverändert (Sprint §2 Punkt 3): schreiben → per MCP live → `-- SaaS: angewandt` → Dumps → commit → `pull --rebase` → push; `erwartete-zaehler.json` mitziehen (Zähler lokal als Delta messen, README Kural 6).
2. **Neue Browser-Schreibsperren (0064–0066):** Der Browser (Rollen `authenticated`/`anon`) darf `abrechnung` nur `erstellt→heruntergeladen` ändern und dort weder INSERT noch DELETE; `abrechnung_zeile`, `abrechnung_zahlung`, `zaa_fehler` sind für den Browser komplett schreibgesperrt; auf `prescriptions` sind Abrechnungs-/Storno-/Mandantenfelder, `abrechnung_id`, `belegnummer` und `status='billed'` Browser-gesperrt, `abrechnung_status` nur NULL↔`bereit`, und abgerechnete Verordnungen sind für ALLE Rollen nicht löschbar. **Folge für M2:** Alles, was Rechnungen/Abrechnung/BG-Felder schreibt, läuft über das Backend (service_role); jede neue abrechnungsrelevante Spalte auf `prescriptions` bewusst entscheiden, ob sie in `pruefe_prescriptions_clientrechte()` aufgenommen wird (per `CREATE OR REPLACE` in derselben Migration, mit Test, dass die bisherigen Sperren bleiben). Schreibzugriffe aus Modulen vorher per Grep belegen (`.from('<tabelle>').update/insert`).
3. **Live-Abnahme funktioniert jetzt** (Falle 14/Offene Frage 1 sind erledigt): Backend `n8n.infinitymade.de/api` liefert JSON. Bewährter Weg: QA-Praxis „Podologie Nord" (siehe Memory `praxura-qa-testdaten`), Testdaten per `db-ustasi` seeden, Live-Tester = Claude in Chrome mit Prompt (Teil Bedienung + Teil Sperren/Regression), **PIN/Datei/zweiter Login macht Melih selbst** (der Tester darf keine PIN tippen und bekommt keine Dateien). Synthetische Zertifikate/Zugänge liegen lokal unter `~/praxura-qa/` (nie ins Repo). Echte Verschlüsselung ist live nicht testbar (kein ITSG-Empfängerzertifikat).
4. **Deploy-Wege und Cache (Lehren aus M1):** Backend = GitHub-Actions-Build `publish-calendar-api` → Watchtower (~1 min nach grünem Build; `gh run list --workflow publish-calendar-api.yml`; bei GitHub-Störung bleiben Runs „queued"/werden abgebrochen → `gh run rerun`). Frontend = Vercel. **Jede JS-Änderung braucht `?v=` hochgezählt** — am Import in `dashboard.js` UND (wenn `dashboard.js` selbst geändert wurde) `dashboard.js?v=` in `dashboard.html`; Tester immer „hart neu laden" (Cmd+Shift+R) sagen — ein offener Tab behält alte Module (hat bei M1 zu einem Fehlalarm geführt).
5. **Azure/STACKIT (M2.8):** Mit **K-20 (05.10.)** läuft KI wieder über **ein Praxura-Azure-Konto** (kurzlebige Jetons, Box → Azure direkt, kein Relay); `compliance/LEGAL_DECISIONS.md` Nachtrag (4) und `konsey/tutanak/2026-10-05-ki-tek-hesap-jeton.md` sind maßgeblich. F6 geht an `legal-de` mit diesem Stand (Azure/Microsoft als Empfänger, Region EU/Schweden lt. LEGAL_DECISIONS, „pseudonymisiert" nie „anonymisiert"); der alte STACKIT-Widerspruch ist damit **überholt**, kein Blocker mehr.
6. **Test-Baseline (05.10. abends):** `npm test`: Frontend 1593, Backend 898, Tools 98 — alle grün; `npm run probe` komplett grün (9 Proben + Layout-Probe Abrechnungsliste); `dashboard.js` = 19.180 Zeilen (Baseline `tools/.dashboard-baseline`), wächst nicht.
7. **Arbeitsbaum:** Fremde, nicht zu committende Dateien (z. B. `AGENTS.md`, `Claude outputs/`, `legal-de.md`, `wissensbank/conflict/`, `db/NUTZUNG.*`, `funktionen/README.md`) nie mit stagen; immer `git commit -- <eigene Dateien>`; Funktionskarte nach Änderungen neu erzeugen. `KHS_M2_PLAN.md` selbst ist ab jetzt eingecheckt.
8. **Agenten:** Ohne `agy` (Gemini) kann die Sitzung genauso arbeiten (so lief M1): Claude liest gezielt, Fachagenten (`db-ustasi`, `gkv-302`, `podoloji`, `legal-de`, `guvenlik`, `onprem`, `fonksiyon-ustasi`) beraten vor dem Schreiben und werden danach informiert; schwere Umsetzung optional über `builder`/`agy`. Kalte Zweitprüfung und eigene Diff-Lektüre bleiben Pflicht bei K4 (Geld/DB/Patientendaten).
9. **Bekannte offene Produktfragen, die M2 NICHT lösen muss** (nicht anfassen ohne Auftrag): Standort-Löschen kaskadiert über 27 FKs (M16-4), Kartenansicht der Abrechnungsliste auf dem Telefon, `ARTEFAKT_DTA_ENTFERNEN` für Echt-Dateien.

---

## 1. Ist-Aufnahme — was der Sprint behauptet, was der Code sagt

| Sprint-Annahme | Befund im Code (03.10.2026) | Folge für M2 |
|---|---|---|
| M2.1: Maske hat `rezeptart` fest `kassen` (`verordnung-maske.js:149,392`) | Stimmt. `lesenMuster13()` in `verordnung-pruefen-knopf.js:86` setzt zusätzlich **`'gkv'`** hart (DB und Rest sagen `kassen`). `verordnung-pruefung.js:185` akzeptiert beides. `nutzlastAusMaske()` (`verordnung-maske.js:628`) schreibt `rezeptart` beim Anlegen **nicht**. | Ein Wert für „Kasse" festlegen (`kassen`) und `gkv` überall mappen. Umschalter ist **neu zu bauen**. |
| M2.1: „GKV-Pflichtfelder werden **ausgeblendet**" | **Widerspruch:** `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md` (10.08.2026) entscheidet: Abrechnungsfelder werden **eingeklappt, nicht versteckt**; Diagnosegruppe wird bei nicht-Kasse **NULL** (nie leerer String, FK `verordnungen_diagnosegruppe_fkey`); Wagner/Fußbefund bleiben **immer** sichtbar. | Entscheidung 10.08 gilt. Sprint-Wortlaut „gizlenir" wird als „katlanır" umgesetzt. |
| M2.1: Quelle „PE-006" | `PE-006` steht **nirgends** in `PRODUKT-ENTSCHEIDUNGEN.md`. | Neuer Eintrag in `PRODUKT-ENTSCHEIDUNGEN.md` (Konsey-Ergebnis) anlegen und im Sprint auf ihn verweisen. |
| M2.2: BG-Verordnung speichern | `prescriptions.rezeptart` hat `CHECK IN (kassen, privat, selbstzahler)` — **`bg` ist verboten**. (Der alte DB-Kommentar „kassen \| privat \| bg \| selbstzahler" gilt für die Vorgänger-Tabelle.) `rechnung-bruecke.js` kennt `bg` schon als „privat-Art". Es gibt **keine** BG-Spalten (Unfalltag, Aktenzeichen, UV-Träger). | Migration nötig: CHECK erweitern + BG-Felder (nur nach Fachklärung, s. M2.2). |
| M2.2: DGUV-Felder sind bekannt | **Nicht verifiziert.** `PRODUKT-ENTSCHEIDUNGEN.md:128`: „BG şimdilik yarım kova"; `wissensbank/SPEC-RULES.md:~1289`: BG/DGUV hat eigenes Vertrags- und Rechnungswesen, **nicht** §302. | Erst Fachagenten, dann bauen. **Keine Felder erfinden.** |
| M2.3: „`podologie_behandlungen` hat keine Patientenbindung → neue Brücke bauen" | **Veraltet.** Die Brücke existiert: `invoice_id` an `podologie_behandlungen` (16.08.2026), `module/rechnung-bruecke.js`, `rechnung-steuer.js` (USt 19 % / §4 Nr. 14a, Wahl wird eingefroren), `selbstzahler_stufen` (3 Preisstufen), `rechnung_nr` per Trigger (Baseline). Patient hängt über `verordnung_id → prescriptions.patient_id`. | M2.3 wird **„verifizieren + Lücken schließen"**, nicht „neu bauen". Lücken-Liste entsteht aus Gemini-Analyse A2. |
| M2.4: Branding-Seite „neu" | **Größtenteils vorhanden.** `profiles` hat `praxis_logo_url`, `invoice_footer_text`, `iban`, `bic`, `bank_name`, `steuernummer`, `ust_id`, `tax_exempt_note`, Adresse, `ik_number`, `phone`. Einstellungen-UI für Logo/Fußzeile liegt in `dashboard.js` (~Z.11500–11690, Logo-Upload in Bucket `avatars`). **Fehlt:** digitaler Stempel (Spalte, Upload, Verwendung), eine **gebündelte** Ansicht, Nachweis welche Dokumente welche Felder lesen. | M2.4 = **Bündeln + Stempel + Quellen-Prüfung**, kein Neubau von Null. Neuer Code in `module/branding.js`. |
| M2.5: `setup.html:239` Text korrigieren | Zeilen sind verschoben. `setup.html` hat 4 Schritte (Token → Owner → **SMTP** → Fertig); der Text steht im SMTP-Schritt („…Einladungs-, Passwort-Reset- oder Terminmails…"). Nach **O-142** (`onprem/REGISTER.md`) gibt es keine Auth-Mails mehr; SMTP ist optional und nur für **Patienten-/Termin-/Mahnungs-Mails**. | Text über den **Inhalt** finden, nicht über die Zeilennummer. Neuer Wortlaut aus O-142 (s. M2.5). Branding-Schritt vor „Fertig". |
| M2.6: Fortschrittsring | Kein bestehender Ring gefunden. | Neu: reine Funktion + Test + schmale UI. |
| M2.7: „Podologische Behandlung groß" | Katalog-Name steht in `Podoloji/podologie-hpnr-reference.js:131` und in mehreren Tests/Seeds. Offizieller Katalogname darf nicht still verändert werden (DTA/Prüfregeln). | Nur **Anzeigename** ändern, falls `podoloji` + `gkv-302` zustimmen. |
| M2.8: Azure/Microsoft in der Praxis-DSE nennen (EuGH C-413/23 P) | **Widerspruch:** `compliance/LEGAL_DECISIONS.md` (29.09.2026): KI-Rezept-OCR läuft über **STACKIT**, Azure wurde abgelöst. Sprint M4.10/K-17 (02.10.) spricht weiter von „Azure EU + AVV". | **Vor** M2.8 `legal-de` fragen: welcher Empfänger gilt aktuell? Nicht ohne Antwort schreiben. |

---

## 2. Fallen, die ein Builder sonst übersieht (müssen vor dem Bauen im Kopf sein)

1. **Veralteter Migrations-Hinweis im Sprint-Prompt.** Der M2-Startprompt (Sprint §6) sagt „numara için önce rezerve et, ayrı push".
   Das gilt **seit 02.10.2026 nicht mehr** (§2 Punkt 3 des Sprints, O-129): Eine unangewendete `.sql` darf **nie** auf `main`.
   Richtig: pull → Datei schreiben (nächste freie Nummer) → per MCP live anwenden → in die ersten 40 Zeilen
   `-- SaaS: angewandt TT.MM.JJJJ` → Dumps auffrischen → commit → `git pull --rebase` → Nummer ggf. mit `git mv` verschieben → push.
   `tools/check-onprem.sh` lehnt Migrationen ohne diese Zeile ab. **Nutze den korrigierten Startprompt in §11.**
2. **Migrationsnummer:** `0059_podologie_empfangsnachweise.sql` liegt aktuell untracked (M1/Codex). Nächste freie Nummer erst **zum Zeitpunkt des Schreibens** aus `api-backend/db/migrations/` lesen, nicht aus diesem Plan.
3. **Zeilennummern im Sprint sind veraltet** (`verordnung-maske.js:149,392`, `setup.html:239`, `dashboard.js:16134` …). Immer über **Funktions-/Textanker** suchen, nie über Zeile.
4. **`dashboard.js` darf nicht wachsen** (Hook `tools/check-dashboard-size.sh`, Baseline `tools/.dashboard-baseline`). Neuer Code → `module/*.js` + Import. In `dashboard.js` nur kleine, bereichsgebundene Verdrahtung. Bei Änderung der Baseline verlangt der Hook eine mechanische Aktualisierung (siehe M1.4).
5. **K1-Sperre auf `profiles` (S-39)** sperrt nur `owner_id, role, plan, plan_status, stripe_*`. Neue Branding-Spalten müssen für den Owner **schreibbar** bleiben → nach jeder Migration mit Owner-Konto testen (und Employee darf **nicht** schreiben).
6. **Neue Spalte = auch Kutu-Box:** Jede Schema-Änderung läuft über `api-backend/db/migrations/` und muss auf der Box ankommen → `onprem`-Agent vorher/nachher; `tools/check-onprem.sh` muss grün sein.
7. **Personenbezug:** Neue Spalten/Tabellen mit Personenbezug → Express-DSGVO-Route (`api/dsgvo.js`-Nachfolger) und `compliance/VVT.md` nachziehen (Sprint §2 Punkt 5).
8. **Stempel/Logo-Speicherort:** Logo liegt im **öffentlichen** Bucket `avatars`. Ein Praxisstempel mit Name/Anschrift/ggf. Berufsnummer ist fälschbar, wenn er unter einer öffentlichen URL liegt. → `guvenlik` + `legal-de` entscheiden vor dem Bau: privater Bucket + signierte URL, oder Einbettung beim Druck. **Nicht** still in `avatars` ablegen.
9. **GoBD:** Rechnungsnummer läuft über den bestehenden Trigger (`rechnung_nr`); Steuerwahl und Texte werden **eingefroren** (Snapshot-Spalten). Nichts davon neu erfinden, nichts nachträglich ändern. Festschreibung in `podologie_behandlungen` (Migration 0026) beachten: Änderungen = Storno + Neu.
10. **Kein Auto-Befreiungsvorschlag:** Die Software nimmt §4 Nr. 14a UStG **nie** von selbst an (Konsey 10.08.2026). Vorauswahl sichtbar, Wahl wird geloggt.
11. **Nur deutsche Texte** in der UI; Dark-Theme-Variablen statt fester Farben (bekannter Fehler in M1.6); Cache-Bust `?v=` bei jeder geänderten JS/CSS (siehe M1.4: `dashboard cachebust …`).
12. **`gkv` vs. `kassen`:** nur **ein** Wert in neuen Schreibwegen (`kassen`); Lesewege bleiben tolerant (`verordnung-pruefung.js:185`).
13. **Festschreibung `prescriptions` (0020):** `rezeptart`, `diagnosegruppe`, `behandlungsanlass`, IK-Felder u. a. sind nach gesetzter `belegnummer` unveränderbar. Jede neue abrechnungsrelevante Spalte bewusst entscheiden: in die Sperre oder bewusst offen (mit Begründung im Register).
14. **Live-API-Blocker** (`wissensbank/sitzungen/2026-10-03_live-api-liefert-html-statt-json.md`): Solange offen, ist `canli-test` nicht möglich. Dann Abnahme nur mit lokalen Tests + `npm run probe`, und im Fortschrittslog **ehrlich** „Live nicht abgenommen" eintragen.

---

## 3. Arbeitsweise — Rollen, damit nichts doppelt oder ungeprüft läuft

| Rolle | Wer | Darf | Darf nicht |
|---|---|---|---|
| Orchestrator | Claude (Hauptsitzung) | planen, Aufträge schreiben, Diffs lesen, ≤10-Zeilen-Fixes, Agenten fragen | große Features selbst schreiben; Gemini-Arbeit duplizieren |
| Analyse/Lesen | **Gemini** via `agy` (Mac) | Code **nur lesen** und Fundstellen liefern (Datei:Zeile) | Dateien ändern; „nicht gefunden" als „gibt es nicht" melden |
| Bauen | `builder` → `agy` Worker (Gemini) | Code schreiben nach Auftragsdatei | Entscheidungen treffen; über Auftrag hinausgehen |
| Soll-Prüfung | zweiter, **kalter** Gemini-Worker | Diff Zeile für Zeile prüfen (ohne `--conversation`) | den eigenen Code prüfen |
| Fach | `gkv-302`, `podoloji`, `legal-de`, `db-ustasi`, `fonksiyon-ustasi`, `onprem`, `guvenlik`, `canli-test` | beraten, Register pflegen | Code im Produkt ändern (nur `mobil-ui` darf CSS) |
| Entscheidung | Skill `konsey` (+ `muhalif`, `deger-mi`) | A-oder-B-Fragen mit echten Kosten | triviale Entscheidungen, Bestätigung suchen |
| Codex | Melihs zweite Spur | nur auf **getrennten** Dateien/Bereichen | gleiche Datei parallel zu einem anderen Schreiber |

**Gemini zuerst, Token sparen:** Alle großen Lesearbeiten (CLAUDE.md 58 KB, `dashboard.js` ~890 KB, SCHEMA, Pläne) laufen
als **schreibgeschützte Analyse-Aufträge** (§7) an Gemini. Claude liest danach nur die gelieferten Fundstellen **gezielt**
(je 20–60 Zeilen) und das, was für die Entscheidung kritisch ist. Hinweise aus dem Log von heute:
- Modellnamen am Tag prüfen (`agy models`). Heute Morgen waren Flash und Pro zeitweise `RESOURCE_EXHAUSTED`; wenn Quota leer ist, **nicht** auf Claude-Modelle in `agy` ausweichen (verbrennt dasselbe Anthropic-Kontingent), sondern warten oder gezielt selbst lesen.
- Eine Gemini-Antwort mit zu wenig Fundstellen ist **keine Vollprüfung** (Erfahrung 03.10.). Jede Analyse muss „nicht geprüft" ausweisen.
- Leere `SUCCESS`-Antworten oder Tool-denied-Ergebnisse zählen **nicht** als Bestanden.

**Klassen nach `builder.md`:** M2.1/M2.2/M2.3 und alles mit Geld/Rechnung/DB/Patientendaten = **K4** (Autor + kalter Zweitprüfer + eigene Diff-Lektüre).
M2.4/M2.6 = K3. M2.5/M2.7/M2.8 = K1/K2 (aber Texte gehen immer durch `legal-de`/`podoloji`).

---

## 4. Phase 0 — Startprüfung (alles muss „ja" sein, sonst nicht anfangen)

1. M1 in Sprint-§0 ✅, `fortschritte/…` sagt „M1 temiz"; Codex arbeitet nicht mehr an gemeinsamen Dateien.
2. `git pull --rebase`, `git status` sauber (fremde Staging-Reste dokumentieren, nicht mitcommitten).
3. `npm test` Baseline grün (zuletzt: Frontend 1530+, Backend 640+, Tools 53). Zahlen **vor** M2 notieren.
4. `node tools/funktionskarte.mjs` („harita güncelle"), damit `fonksiyon-ustasi` mit frischer Karte arbeitet; `db/REGISTER.md`/`SCHEMA.sql` frisch (`db-ustasi` §2).
5. Drei Fragen an Kemal/Melih beantwortet (§10).
6. Neuer Eintrag in `fortschritte/<Datum>.md`: „M2 gestartet, Ist-Aufnahme = KHS_M2_PLAN.md".

---

## 5. Phase 1 — Fachklärung zuerst (parallel möglich, nur lesen/beraten)

Alle Antworten werden **schriftlich** abgelegt (sonst geht Wissen mit dem Kontext verloren):
Entscheidungen → `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md`; Rechtliches → `compliance/LEGAL_DECISIONS.md`; GKV-Regeln → `wissensbank/SPEC-RULES.md`.

| # | Frage | Agent | Ergebnis |
|---|---|---|---|
| F1 | Welche Angaben braucht eine **BG-Behandlung/Rechnung** wirklich (Unfalltag, Aktenzeichen, UV-Träger, Rechnungsweg, Abrechnung außerhalb §302)? Quelle nennen, Unsicheres als „nicht verifiziert" | `gkv-302` (liest zuerst `wissensbank/INDEX.md`), dann `podoloji` (Praxisalltag), dann `legal-de` | Entscheidungseintrag „BG-Scope M2" — **Minimalumfang**, Rest ausdrücklich vertagt |
| F2 | Bis wann darf `rezeptart` umgestellt werden? **Teilantwort (gelesen):** Der Trigger `prescriptions_festschreibung` (Migration `0020`) sperrt `rezeptart` und die Abrechnungsfelder **erst, wenn `belegnummer` gesetzt ist** (Einfrieren bei DTA-Erzeugung). Offen: Gilt das auch für BG/Privat (die nie eine DTA bekommen)? Soll die Maske die Umstellung schon bei `abrechnung_status ≠ bereit` sperren? | `gkv-302` + `db-ustasi` | Regel für den Umschalter, belegt; UI-Sperre und DB-Sperre nutzen dieselbe Bedingung |
| F3 | ~~Gibt es einen Guard „nicht-Kasse nie in §302-DTA"?~~ **Beantwortet (gelesen, 03.10.):** Ja. `api-backend/billing/api/abrechnung.routes.js` lehnt `rezeptart !== 'kassen'` an zwei Stellen ab (um Z.3644 und Z.4354). Die Warnung in der Entscheidung vom 10.08. („`rezeptart` kommt gar nicht vor") ist damit **überholt**. Offen: NULL-`rezeptart` wird durchgelassen (gewollt?); um Z.3702 wird `rezeptart: 'kassen'` fest gesetzt — Bedeutung klären. | `gkv-302` (kurz bestätigen) | nur Bestätigung; kein Neubau des Guards |
| F4 | Stempel/Logo: wo speichern (privat vs. öffentlich), was steht darauf, wer sieht es? | `guvenlik` + `legal-de` | Entscheidung für M2.4 |
| F5 | Welcher Anzeigename ersetzt „Podologische Behandlung (groß)" auf Bildschirm/Rechnung, ohne Katalog/DTA zu berühren? | `podoloji`, Gegencheck `gkv-302` | Name + Liste der Stellen |
| F6 | Praxis-DSE: Welche Empfänger/Drittland-Hinweise gelten jetzt (STACKIT vs. Azure; Microsoft?) | `legal-de` | Wortlaut-Entwurf, „pseudonymisiert" nie „anonymisiert" |
| F7 | Gibt es eine Pflicht-/Soll-Angabe auf Rechnungen (§14 UStG, Kleinunternehmer-Hinweis, Stempel optional)? Was ist für M2.4-Pflichtfeld vs. Soll? | `legal-de` | Feldliste für den Fortschrittsring (M2.6) |

**`konsey`-Einsatz (Skill):** nur für F1-Scope-Streit (zu groß/zu klein?) und F4 (Speicherort), falls die Fachagenten widersprüchlich antworten.
`muhalif` fragt „wo bricht das", `deger-mi` „lohnt jetzt das Größere?". Ergebnis als Konsey-Kurzbeschluss (nicht ausufern).

---

## 6. Phase 2 — Bauen (empfohlene Reihenfolge und Begründung)

Reihenfolge: **M2.1 → M2.2 → M2.3 → M2.7 → M2.4 → M2.5 → M2.6 → M2.8 → Abschluss.**
Warum: M2.1 schafft den Umschalter und die `bg`-Basis, M2.2 hängt daran. M2.3 prüft die bestehende Brücke gegen beides. Branding (M2.4) liefert die Felder, die M2.5 (Assistent) und M2.6 (Ring) brauchen. M2.8 ist reiner Text und kommt zuletzt, weil F6 oft länger dauert.
Jede Stufe endet mit Commit + Push + Fortschrittslog (Sprint §6). **Nach jedem Teilschritt prüfen, ob der Kontext voll wird → dann neue Sitzung.**

### M2.1 — Rezeptart-Umschalter (K4)
- **Ziel:** In der Muster-13-Maske kann der Nutzer Kasse / Privat / Selbstzahler / BG wählen. Bei nicht-Kasse: Block „GKV-Angaben" (Krankenkasse, Diagnosegruppe, ICD-10, Zuzahlung-Befreiung) **eingeklappt, nicht versteckt**; DG wird `NULL`; `behandlungsanlass` (Vorgabe „Podologische Komplexbehandlung") erscheint nur bei nicht-Kasse (Entscheidung 28.09.). Wagner/Fußbefund bleiben sichtbar.
- **Dateien:** `module/verordnung-maske.js` (Maske lesen/schreiben, `nutzlastAusMaske()`), `module/verordnung-podo.js` (Funktion `rezeptart()`, Anlass-Block), `module/verordnung-pruefen-knopf.js` (`lesenMuster13()` Z.~86: `'gkv'` → Wert aus Maske), `module/verordnung-pruefung.js` (Kasse-Erkennung), `module/verordnung-an-backend.js`. **Neue** Logik in `module/rezeptart.js` (+ `rezeptart.test.js`): Werteliste, Mapping, „welche Felder sind Pflicht bei welcher Art" als **reine Funktionen**.
- **Backend/DB:** Prüfen, ob die API `rezeptart` beim Anlegen/Ändern annimmt und speichert (Pfad über `verordnung-an-backend.js`). Der Guard „nicht-Kasse nie in §302" **existiert schon** (F3) — nicht neu bauen, nur einen Test ergänzen. `bg` in den bestehenden CHECK `prescriptions_rezeptart_check` aufnehmen. Einen CHECK „Kasse ⇒ Diagnosegruppe Pflicht" (Entscheidung 10.08.) **nicht blind einführen**: `prescriptions` gilt für **alle** Fachbereiche und für Altzeilen mit `rezeptart IS NULL` (z. B. Blanko/Physio). Vorher `db-ustasi` mit `count(*)` auf der Live-DB prüfen lassen und ggf. `NOT VALID` verwenden oder auf Podologie begrenzen.
- **Festschreibung beachten:** Der Trigger `prescriptions_festschreibung` (0020) verbietet nach gesetzter `belegnummer` Änderungen an `rezeptart`, `diagnosegruppe`, `behandlungsanlass`, `kostentraeger_ik` u. a. Der Umschalter darf solche Zeilen deshalb **nicht anbieten** (UI-Sperre mit klarer deutscher Meldung, gleiche Bedingung wie der Trigger).
- **Migration** (Datei + Live-Anwendung nach §2.3; `db-ustasi` vorher): CHECK erweitern; keine Daten löschen; bestehende Zeilen bleiben gültig.
- **Tests (zuerst schreiben):** Werteliste/Mapping; Maske für jede Art → erwartete sichtbare/geklappte Felder; DG-Leerwert → `NULL` (nicht `''`); bestehende Kasse-Verordnung unverändert; Bearbeiten einer vorhandenen privaten Verordnung zeigt die Art; abgerechnete Verordnung nicht umschaltbar (F2).
- **Abnahme:** Lokale Tests + `npm run probe`; `canli-test` (wenn Live wieder geht): je Art eine Verordnung anlegen, speichern, neu laden.
- **Fehlerfallen:** (1) Wert `gkv` vs `kassen`; (2) leerer String an FK; (3) Maske wird beim „Neue Verordnung" nicht zurückgesetzt (Kommentar `verordnung-maske.js:146`); (4) Prüfung `verordnung-pruefung.js` meldet für Privat fälschlich Pflichtfehler; (5) `abrechnung-auswahl.js` zählt nur `kassen` — Privat darf nie in die Kassenabrechnung rutschen.

### M2.2 — BG-Verordnung (K4, **nur nach F1**)
- **Vorab-Stopp:** Ohne Entscheidungseintrag aus F1 wird **nichts gebaut**. Der Eintrag legt den Minimalumfang fest (z. B. Unfalltag, Aktenzeichen, UV-Träger als einfache Felder + Rechnungsweg über die bestehende private Rechnungsstrecke, **nicht** §302).
- **Dateien:** Maske (Zusatzblock nur bei `bg`), `module/bg-angaben.js` (+Test; Validierung), `module/rechnung-bruecke.js` (BG-Zeilen/Empfänger statt Patient?), Rechnungsvorlage/`beleg-druck.js`. Backend: Speichern der Felder.
- **DB:** Spalten auf `prescriptions` (nur was F1 bestätigt) + Migration; `db-ustasi` vorher (Eintrag in `db/REGISTER.md`, „warum" Pflicht); Personenbezug → DSGVO-Route/VVT. **Festschreibung:** Neue BG-Spalten stehen nicht in der Sperrliste von `prescriptions_festschreibung` (alles Nicht-Genannte bleibt offen). Mit `gkv-302`/`db-ustasi` entscheiden: abrechnungsrelevant → Trigger-Funktion in **derselben** Migration per `CREATE OR REPLACE` erweitern (mit Test, dass bestehende Sperren unverändert bleiben); sonst bewusst offen lassen und im Register begründen.
- **Tests:** Pflichtfelder bei `bg`, nicht bei anderen Arten; BG-Rechnung enthält die Felder; BG nie in DTA.
- **Fehlerfallen:** Felder erfinden; BG als „Privat mit Zusatz" verkaufen, obwohl der Zahler die Berufsgenossenschaft ist (Empfänger der Rechnung!); Aktenzeichen ohne Format-Validierung → später unbrauchbar.

### M2.3 — Selbstzahler/Privat-Kette: verifizieren, Lücken schließen (K4)
- **Schritt 1 (nur Lesen, Gemini A2):** Vom Speichern einer Behandlung bis zur gedruckten Rechnung die Kette beschreiben: `podologie-abrechnung.js` (Z.~773 INSERT) → `rechnung-bruecke.js` → `rechnung-editor.js` → `rechnung-steuer.js` → `rechnung-druck.js`/`beleg-druck.js` → `invoices`. Für jede Station: vorhanden / teilweise / fehlt, mit Fundstelle.
- **Bekannte Kandidaten für Lücken** (nur prüfen, nicht annehmen): Vorauswahl der Rezeptart nach Patiententyp (`insurance_type`, Entscheidung 10.08.: nur einseitige Vorauswahl + Hinweis); `employee_id` wird beim INSERT noch nicht gefüllt (Kommentar im Schema); BG-Empfänger auf der Rechnung; Preisstufe am Patienten (`standard_preisstufe`/zuletzt benutzter Betrag, Entscheidung 05.09.).
- **Schritt 2:** Pro bestätigter Lücke ein kleiner Auftrag (K4). Keine Umbauten an `rechnung_nr`, Snapshot-Spalten, Festschreibung.
- **Tests:** vorhandene Tests (`rechnung-bruecke`, `rechnung-steuer`, `selbstzahler-stufen`) müssen **unverändert grün** bleiben; neue Tests nur für die Lücken.
- **Fehlerfallen:** GKV-Preis still für Privatrechnung (Kopfkommentar `rechnung-bruecke.js`); Steuerbefreiung automatisch; Doppelabrechnung derselben Sitzung (`invoice_id IS NULL`-Bedingung).

### M2.7 — Anzeigename „Podologische Behandlung groß" (K1, nach F5)
- Nur Anzeigetexte (Bildschirm, Rechnungszeile), **nicht** `leistung` im Katalog und nicht Prüf-/DTA-Regeln. Gemini-Suche (A4) listet alle Stellen; `gkv-302` bestätigt, dass kein Anzeigename in DTA/Prüfung einfließt. Tests, die den alten Namen prüfen (`rechnung-verordnung.test.js`, `verordnung-pruefung.test.js`, `heilmittel-suche-komplex.test.js`, `selbstzahler-stufen.test.js`), bewusst und einzeln anpassen — nicht per Massenersetzung.

### M2.4 — Branding bündeln + Stempel (K3)
- **Ziel:** Eine Ansicht „Praxis-Erscheinungsbild" (Logo, Name/Anschrift, Bank, Fußzeile, Stempel). Alle Belege lesen **aus einer Quelle** (`module/branding.js`: `ladeBranding(profile)` → einheitliches Objekt).
- **Schritt 1 (Lesen, Gemini A1):** Liste aller Dokumente/Druckfunktionen und welche Profilfelder sie lesen (`beleg-druck`, `rechnung-ansicht`, `rechnung-druck`, `termin-druck`, `behandlungsbestaetigung`, Ausfallrechnung, Vorlagen). Abweichungen (manche lesen `currentProfile`, manche eigene Felder) sind die Hauptarbeit.
- **Schritt 2:** `module/branding.js` + Test; bestehende Einstellungen-UI (in `dashboard.js`) nur **umhängen** (Verdrahtung), Logik raus nach `module/`.
- **Stempel:** neue Spalte (z. B. `praxis_stempel_url` bzw. Pfad) **nach F4**; Upload mit Typ-/Größenprüfung; Verwendung auf Rechnung/Beleg optional. `tax_exempt_note` und Pflichtangaben (F7) nicht verändern.
- **UI:** Skills `frontend-design` (Aufbau), `design:ux-copy` (deutsche Texte), `design:accessibility-review` (Kontrast, Tastatur, Labels), `mobil-ui` (Handy/Tablet, nur CSS). Dark-Theme-Variablen.
- **Tests:** Branding-Objekt für leere/volle Profile; fehlendes Logo → kein kaputtes Bild; XSS-sicheres Rendern von Namen/Fußzeile (`esc`); Owner darf schreiben, Employee nicht (RLS prüfen).
- **Fehlerfallen:** Öffentlicher Bucket für Stempel; Bild-URL mit Fremdquelle in CSP (`vercel.json`: `img-src`); Cache zeigt altes Logo; Druck-Layout bricht bei langen Fußzeilen.

### M2.5 — Assistent: Branding-Schritt + Textkorrektur (K2)
- Neuer **überspringbarer** Schritt vor „Fertig" in `setup.html`/`setup.js`; Schrittzähler (aktuell „von 4") mitziehen; Text im SMTP-Schritt nach O-142: Mails betreffen nur Patienten-/Termin-/Mahnungsnachrichten, SMTP ist optional und wird vom Techniker eingerichtet; **keine** Aussage mehr zu Einladungs-/Passwort-Reset-Mails (`legal-de`/`onprem` kurz gegenlesen).
- Branding-Schritt nutzt dieselbe `module/branding.js`-Logik wie M2.4 (nicht doppelt bauen). `setup.*` hat keine Supabase-Session wie das Dashboard → prüfen, welchen Auth-Weg der Assistent für das Speichern hat (Gemini A1/A4).
- **Tests:** vorhandene Setup-Tests; Schrittfolge mit/ohne Überspringen; Text-Tests.

### M2.6 — Fortschrittsring „Einrichtung X % abgeschlossen" (K3)
- Reine Funktion `module/einrichtung-fortschritt.js`: Eingabe Profil + Zähler (Mitarbeiter, Annahmestelle/IK); Ausgabe `{prozent, fehlend:[{schluessel,label,zielAnsicht}]}`. Pflicht-/Sollfelder laut F7.
- UI: kleiner Ring im Dashboard-Kopf/Einstellungen, Klick springt zur passenden Einstellung; **blockiert nie**.
- **Tests:** 0 %, 100 %, Einzelfelder fehlen, nur Leerzeichen zählen als leer, Reihenfolge der Hinweise.
- **Fehlerfall:** Falsche 100 % bei Whitespace; „Annahmestelle" hat keinen Fundort im Dashboard-Code gefunden → Quelle erst klären (Gemini A1), nicht raten.

### M2.8 — Praxis-DSE-Vorlage (K1, nur Text, nach F6)
- Fundort der „Praxis-Datenschutz-Vorlage" im Code ist **noch unbekannt** (`datenschutz.html` ist die Praxura-eigene Seite). Gemini A4 sucht ihn; ohne Fundort nicht anfangen.
- Wortlaut kommt komplett von `legal-de`; Konsistenz mit M4.10 („pseudonymisiert"). `compliance/LEGAL_DECISIONS.md` ein Eintrag.

---

## 7. Gemini-Analyseaufträge (nur Lesen) — fertig zum Einfügen

Ablauf: Auftrag in eine Datei schreiben (`builder.md` §2 nutzt Windows-Pfade — auf dem Mac stattdessen z. B. `~/agy-tasks/<name>.md`), dann:

```bash
agy -p "$(cat ~/agy-tasks/a1-branding.md)" --model gemini-3.8-flash-high --effort high \
    --output-format json --print-timeout 20m > ~/agy-tasks/ergebnisse/a1.json
```

`builder.md` führt zusätzlich `--dangerously-skip-permissions`. **Für reine Lese-Aufträge nur verwenden, wenn der Lauf sonst mit „Tool-Befehl auto-denied" und leerem `SUCCESS` endet (so geschehen am 03.10.).** Dann den Auftrag in einer **Wegwerf-Kopie** ausführen (`git worktree add ../agy-lesekopie`) und danach prüfen, dass im echten Repo `git status` unverändert ist. `status` und `usage` aus dem JSON in den Fortschrittslog übernehmen. **Gemeinsamer Kopf für alle Aufträge:**

```
ROLLE: Schreibgeschützter Code-Leser. Du darfst KEINE Datei ändern, nichts committen, nichts installieren.
REPO: infinitymade-website (öffentlich: keine Geheimnisse, keine Personendaten ausgeben).
REGELN:
1. Jede Aussage braucht eine Fundstelle "datei:zeile" (aktuelle Zeilen, selbst gelesen).
2. Kannst du etwas nicht finden, schreibe "NICHT GEFUNDEN (gesucht: <Suchbegriffe>, <Pfade>)". Das heißt NICHT "gibt es nicht".
3. Trenne strikt: GELESEN (belegt) / VERMUTET (nicht belegt) / NICHT GEPRÜFT.
4. Keine Verbesserungsvorschläge, keine Umbauten. Nur Ist-Zustand.
5. Antworte kompakt auf Deutsch in der Tabelle unten. Keine Codeblöcke über 10 Zeilen.
FORMAT: Markdown-Tabelle | Frage | Befund | Fundstelle | Status (GELESEN/VERMUTET/NICHT GEPRÜFT) |
```

- **A1 — Branding-Quellen:** Welche Funktionen erzeugen Rechnung, Beleg, Terminzettel, Behandlungsbestätigung, Ausfallrechnung, Rezept-Vorderseite? Welche `profiles`-Felder lesen sie (Logo, Fußzeile, Bank, Steuer, Adresse, IK, Telefon)? Wo wird `praxis_logo_url` hochgeladen/gelöscht (Bucket, Pfad)? Was prüft `vercel.json` für `img-src`? Wo gibt es „Annahmestelle"/IK-Einstellungen? Welchen Auth-Weg nutzt `setup.js` zum Speichern?
- **A2 — Rechnungskette:** Beschreibe Station für Station von `podologie-abrechnung.js` (INSERT `podologie_behandlungen`) bis `invoices`: welche Felder werden übergeben, wo wird `invoice_id` gesetzt, wo Steuer/Snapshots, wo `rechnung_nr`. Wo wird `employee_id` gefüllt? Wo `insurance_type`/Patiententyp gelesen? Gibt es Vorauswahl der Rezeptart?
- **A3 — Rezeptart-Pfad und Guards** (der Guard in `abrechnung.routes.js` und der Trigger 0020 sind bereits gelesen; Gemini liefert nur die **restlichen** Stellen): Alle Stellen, an denen `rezeptart` gelesen/geschrieben wird (Frontend, Backend `api-backend/**`, SQL-Migrationen, Triggers). Welche Werte kommen vor (`gkv`, `kassen`, `privat`, `selbstzahler`, `bg`)? Gibt es serverseitig einen Guard, der nicht-Kasse aus der §302-DTA hält (`abrechnung.routes.js`, Auswahl)? Gibt es einen CHECK zwischen `rezeptart` und `diagnosegruppe`?
- **A4 — Textstellen:** (a) Alle Vorkommen „Podologische Behandlung" (groß/klein) in Anzeigetexten vs. Katalog/Tests; (b) Fundort der Praxis-Datenschutz-Vorlage/Patienteneinwilligung; (c) alle Texte „Einladungs", „Passwort-Reset", „SMTP" in `setup.*`.
- **A5 (optional, wenn Zeit):** `npm test` Dateiliste: welche Tests decken `verordnung-maske`, `rechnung-*`, `beleg-druck`, `setup` ab; wo sind Lücken?

Claude liest danach **nur die gelieferten Fundstellen**, stichprobenartig 5 pro Auftrag gegen den echten Code (Gemini-Befunde sind bekannt fehleranfällig: „nicht gefunden" wurde schon als „gibt es nicht" gemeldet).

---

## 8. Fehlerschutz — damit die KI beim Bauen möglichst keine Fehler macht

**Auftrags-Vertrag für jeden Worker** (Auftragsdatei, `builder.md` folgen):
1. Ziel in **einem** Satz; erlaubte Dateien **namentlich**; verbotene Dateien (`dashboard.js` nur falls ausdrücklich erlaubt, `api-backend/db/migrations/*` nur im Migrationsauftrag, `vercel.json` nur nach Prüfung).
2. **Erst Tests schreiben/anpassen, rot sehen, dann Code.** Testbefehl im Auftrag: `node --test module/<datei>.test.js`.
3. Genauer Vertrag (Eingabe/Ausgabe/Randfälle) und Verweis auf die Entscheidung, die gilt (Datum + Datei).
4. „Ausdrücklich NICHT tun"-Liste (kein Refactoring, keine Umbenennung, keine Formatierung fremder Zeilen, kein neues Paket, keine Zeitzonen-Neuerfindung — `berlinHeute`/`istStichtag` benutzen).
5. Feld **„Nicht umgesetzt / unsicher"** (damit der Worker Misserfolg melden kann statt zu erfinden).
6. Diff-Budget (z. B. ≤ 150 geänderte Zeilen pro Auftrag); größer → zerlegen.
7. Kein Schreiben in `dashboard.js` über das vereinbarte Maß; kein Commit durch den Worker.

**Prüfkette pro Teilschritt (K4):**
Autor-Worker → **Root liest den Diff selbst** → kalter Gemini-Prüfer (frische Sitzung, nur Diff + Vertrag) → Root-Tests (`node --test` fokussiert, dann `npm test`) → bei Geld/DB: `engineering:code-review` (Skill) und `guvenlik` → erst dann Commit.
- „Bestanden" zählt nur mit **ausgeführten** Tests und genannten Zahlen; leere `SUCCESS`-Antworten sind kein Beleg.
- **Zwei-Vuruş-Regel:** zwei Fehlversuche desselben Auftrags → nicht dritte Wiederholung, sondern kleiner schneiden oder höhere Modellstufe nach Rückfrage.
- Skills: `engineering:testing-strategy` (Testlücken je Teilschritt), `engineering:debug` (jeder reproduzierbare Fehler zuerst reproduzieren), `engineering:deploy-checklist` (vor jedem Push mit Migration), `legal:compliance-check` (bei neuen personenbezogenen Feldern, mit `legal-de`).
- Optional, **nur lokal**: Qualitäts-Agenten aus dem Synotix-Team (`qa-realitaetscheck`, `dev-minimal-fix`, `qa-tests`, `qa-code-review`, `qa-security`, `web-barrierefreiheit`) als **angepasste Praxura-Fassungen ohne Synotix-Kontext**, nicht im öffentlichen Repo.

**Stop-Bedingungen (dann aufhören und Melih fragen):** F-Antwort widerspricht einer gespeicherten Entscheidung · Test, der vor M2 grün war, wird rot und die Ursache ist unklar · Migration lässt sich nicht idempotent/rückwärtskompatibel schreiben · Live-DB-Zahlen weichen von `db/SCHEMA.sql` ab (→ `db-ustasi` Refresh) · Gemini-Quota leer.

---

## 9. Abschluss M2 (Sprint §6, ergänzt)

1. `npm test` grün (Zahlen mit Baseline vergleichen) · `npm run probe` · `canli-test` für geänderte Ansichten (oder ehrlich „Live nicht abgenommen", s. Fallen 14).
2. „Harita güncelle" (`node tools/funktionskarte.mjs`) + `fonksiyon-ustasi` Niyet-Bildirimi; Schema geändert → Dumps, `db/REGISTER.md`, `db-ustasi`.
3. `onprem` informieren (neue Spalten/Dateien auf der Box); `guvenlik` bei Stempel/Bucket; `tools/check-onprem.sh` grün.
4. `fortschritte/<Datum>.md`; Sprint §0 M2 → ✅ mit Commit-Liste; `VERSION` nach Regel der Migrationen (mechanischer Manifest-Bump laut `onprem`).
5. Aufräumen: Entscheidungen in `PRODUKT-ENTSCHEIDUNGEN.md` / `LEGAL_DECISIONS.md` vollständig.
6. Satz an Melih: „Aşama M2 temiz bitti. Bağlam dolu — yeni oturum + M3-Prompt."

---

## 10. Entscheidungen — der Sprint hat Vorrang (Melih, 03.10.2026)

**Regel:** Steht etwas in `KUTU_HAZIRLIK_SPRINT.md`, gilt es so und wird so umgesetzt. Dieser Plan ergänzt nur das Wie.

| Frage | Antwort aus dem Sprint | Folge |
|---|---|---|
| BG nötig? Minimal? | **K-8:** Kutu-Test = Podologie komplett, ausdrücklich **inkl. BG**. **K-10:** `gkv-302` + `legal-de` + `podoloji` recherchieren, bauen, anwenden. | BG ist Pflicht. Umfang bestimmt die Fachrecherche (F1), nicht eine Vorab-Verkleinerung. Was belegbar ist, wird gebaut; Unbelegtes wird als „nicht verifiziert" markiert, nicht erfunden. |
| Stempel? | **K-9 / M2.4:** „dijital kaşe yükleme" gehört zur Branding-Seite. | Stempel ist Pflicht. Nur der **Speicherort** wird technisch entschieden (F4, `guvenlik`/`legal-de`), nicht ob. |
| Azure oder STACKIT? | **M2.8:** Microsoft/Azure als Empfänger (EuGH C-413/23 P), Text durch `legal-de`. **K-17:** Azure EU + AVV. | Wie im Sprint umsetzen. `legal-de` bekommt als Hinweis, dass `compliance/LEGAL_DECISIONS.md` (29.09.) STACKIT für KI-Rezept-OCR nennt; er formuliert den Text und ergänzt, falls beides gilt. Kein Blocker. |
| Wer baut? | **Sprint §6 + `builder`:** KI-Sitzungen, schwere Arbeit an `agy`-Worker (Gemini), kalter zweiter Worker, eigene Diff-Lektüre. | Gemini-Builder-Weg. Codex nur als Ausweichlösung wie bei M1 (Quota), und immer nur **ein** Schreiber pro Datei. |
| Reihenfolge, neue Sitzung? | **§0/§6:** M1 → M2 → M3 → M4; je Stufe neue Sitzung mit Prompt. | M2 beginnt nach M1. Startprompt aus §11 dieses Plans. |
| GKV-Felder „ausblenden" oder „einklappen"? | Sprint M2.1: „gizlenir". Entscheidung 10.08.: „katlanır". | Beides vereinbar: bei nicht-Kasse sind die GKV-Angaben **standardmäßig zu** und keine Pflicht (Sprint), aber auffindbar und reversibel (Entscheidung). |
| Migration vorab reservieren? | **Sprint §2 Punkt 3 (O-129)** verbietet es; der Prompt in §6 ist veraltet. | Regel aus §2 Punkt 3 gilt. |
| M2.3 „keine Patientenbindung"? | Sprint: `db-ustasi` fragen, bevor Tabellen/Spalten geändert werden. | Genau das tun; der Code zeigt, dass `invoice_id` und die Brücke schon da sind. `db-ustasi` bestätigt, dann nur Lücken schließen. |

**Wirklich offen (nicht vom Sprint beantwortet):**
1. **Live-API / `canli-test`:** Sprint §6 verlangt Live-Abnahme. Das Backend liefert aktuell HTML statt JSON (siehe Wissensbank-Notiz vom 03.10.). Das ist kein Entscheidungsfall, sondern eine Voraussetzung: Server-Zugang und Fingerprint über Kemal. Bis dahin Abnahme lokal und im Log ehrlich „Live nicht abgenommen".
2. **Wo läuft die Bauphase?** `agy` (Gemini) existiert nur auf Melihs Mac. Die Bauphase gehört in eine Claude-Code-Sitzung **auf dem Mac**, in der `agy` aufrufbar ist.

---

## 11. Startprompt für die M2-Sitzung (freigegeben 05.10.2026; ersetzt den im Sprint §6)

```
Lies KUTU_HAZIRLIK_SPRINT.md (§0, §1, §2, §6) und KHS_M2_PLAN.md vollständig — besonders Abschnitt 0 „AKTUALISIERUNG 05.10.2026", der älteren Stellen vorgeht.
Du bist Hat M. M1 ist abgenommen (✅*, Einschränkungen E1–E4 blockieren M2 nicht); M2 ist von Melih freigegeben. Aufgabe: Aşama M2 (M2.1 → M2.8) nach KHS_M2_PLAN.md.
Start: git pull --rebase; git status (fremde Dateien nie stagen); npm test Baseline notieren (Soll: 1593 / 898 / 98); node tools/funktionskarte.mjs; fortschritte/<Datum>.md „M2 gestartet".
Dann Phase 1: Fachklärung F1–F7 durch gkv-302, podoloji, legal-de, db-ustasi, guvenlik (F4 Stempel-Speicherort) — Antworten schriftlich in Podoloji/PRODUKT-ENTSCHEIDUNGEN.md, compliance/LEGAL_DECISIONS.md bzw. wissensbank/SPEC-RULES.md ablegen, nichts erfinden (BG-Felder nur belegt, K-8/K-10: BG ist Pflicht, Umfang bestimmt die Recherche). Erst danach Phase 2 bauen: M2.1 → M2.2 → M2.3 → M2.7 → M2.4 → M2.5 → M2.6 → M2.8.
Regeln: dashboard.js wächst nicht (neuer Code in module/*.js, Tests zuerst); Zeilennummern im Sprint sind veraltet — Funktions-/Textanker suchen; nur deutsche UI-Texte, Dark-Theme-Variablen; Cache-Bust ?v= (Modul-Import UND dashboard.html wenn dashboard.js geändert).
Migrationen: nächste freie Nummer erst beim Schreiben lesen (heute 0067); NICHT vorab reservieren; Ablauf Sprint §2 Punkt 3; db-ustasi vorher, onprem + guvenlik nachher; Zähler messen; neue abrechnungsrelevante prescriptions-Spalten gegen die Client-Sperre 0066 entscheiden. Browser darf Rechnungs-/Abrechnungsdaten nicht schreiben — Backend-Weg.
Fachagenten VOR dem Schreiben fragen, NACHHER informieren: fonksiyon-ustasi, db-ustasi, gkv-302, podoloji, legal-de, onprem, guvenlik.
Je Teilschritt: Tests → Commit (pull --rebase, nur eigene Dateien) → Push → Fortschrittslog; Backend-Deploy mit gh run list prüfen. Live-Abnahme geänderter Ansichten wie bei M1 (QA-Praxis Podologie Nord, db-ustasi-Seed, Claude-in-Chrome-Prompt; PIN/Datei macht Melih; Tester hart neu laden lassen).
Kontext voll? Teilschritt-Grenze, Devir-Notiz in fortschritte/ + Sprint §0, neue Sitzung.
Am Ende §9 des Plans abarbeiten (inkl. Sprint §0 M2 ✅ mit Commit-Liste) und den M3-Prompt aus dem Sprint ausgeben.
```

---

## 12. Selbstbewertung des Plans (03.10.2026, nach Durchsicht)

**Wie der Plan entstanden ist (ehrlich):** Gemini (`agy`) läuft auf Melihs Mac und war aus der Plan-Sitzung nicht erreichbar. Statt Gemini habe ich gezielt gelesen (Sprint §2/§4/§6, `builder.md`, Agenten-Überschriften, `PRODUKT-ENTSCHEIDUNGEN.md`, `db/SCHEMA.sql`, Migrationen 0020, Module `verordnung-maske`, `rechnung-bruecke`, `rechnung-steuer`, `setup.html`, `abrechnung.routes.js`). Die Fachagenten selbst wurden **nicht** gestartet — nur ihre Regeln gelesen. Deshalb enthält der Plan Aufträge (§5, §7), die diese Lücke schließen.

**Was die Durchsicht verbessert hat:**
- F3 war falsch eingeschätzt (Guard existiert) → korrigiert, verhindert unnötigen Neubau.
- Festschreibungs-Trigger (0020) fehlte → neue Falle 13, Auswirkung auf Umschalter und BG-Spalten ergänzt.
- Vorgeschlagenen DB-CHECK „Kasse ⇒ Diagnosegruppe" entschärft (würde Physio/Blanko/Altzeilen brechen können).
- `agy`-Aufruf an die echte Vorgabe in `builder.md` angeglichen (`--effort`, JSON-Ausgabe, Lesekopie statt Schreibrechte im echten Repo).

**Sicherheit der Aussagen:**
| Aussage | Stand |
|---|---|
| Rezeptart-Umschalter fehlt, `gkv`/`kassen`-Mischung, `bg` im CHECK verboten | **gelesen** (Code + Migration) |
| Guard gegen nicht-Kasse in §302 existiert | **gelesen** |
| Festschreibung 0020 sperrt `rezeptart` erst ab `belegnummer` | **gelesen** (Triggerfunktion) |
| Branding-Felder in `profiles` vorhanden, Logo/Fußzeile-UI existiert | **gelesen** (Schema + `dashboard.js`) |
| Stempel fehlt | **gesucht, nicht gefunden** (Suchbegriffe: stempel, stamp, kase) — keine Garantie |
| Rechnungskette M2.3 vollständig | **nicht geprüft** → Auftrag A2 |
| „Annahmestelle"-Einstellung im Dashboard | **nicht gefunden** → Auftrag A1 |
| Fundort der Praxis-DSE-Vorlage | **unbekannt** → Auftrag A4 |
| Live-DB entspricht `db/SCHEMA.sql` | **nicht geprüft** (`db-ustasi` Refresh in Phase 0) |

**Restrisiken:**
1. M1 ist noch offen und ändert gleiche Dateien → Plan kann sich verschieben (Phase 0 prüft das).
2. BG-Anforderungen sind fachlich unbelegt → bewusst als Minimalumfang geplant, kein Raten.
3. Gemini-Quota war heute zeitweise leer → Zeitplan kann sich dehnen.
4. Der Live-Betrieb ist blockiert → Abnahmen eventuell nur lokal (ehrlich kennzeichnen).
5. Schätzung 4–5 Tage (Sprint) wirkt eher **knapp**, wenn BG tief gehen muss; realistisch mit Fachklärung eher 5–7 Tage verteilt auf mehrere Sitzungen.
