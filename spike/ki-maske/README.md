# KI-Maskierung — Spike-Material (02.10.2026)

Grundlage für Sprint-Aufgabe **M4** in `KUTU_HAZIRLIK_SPRINT.md`. Kein Produktionscode:
wird zur Laufzeit nirgends geladen, ist nicht im Docker-Image (`api-backend/Dockerfile`
kopiert nur `ai/`, nicht `spike/`) und steht in `.vercelignore`.

Alle Namen, Adressen und Nummern in den Korpora sind **erfunden** (KI-generiert).

| Datei | Was |
|---|---|
| `inventar.md` | Alle KI-Aufrufpfade: welche Felder in den Prompt gehen, was heute maskiert wird (agy, 02.10.) |
| `korpus.json` | 60 Fälle, mit Ground-Truth `pii_truth` — **der Prototyp v2 hat diesen Korpus gesehen** |
| `korpus2.json` | 50 Fälle, unabhängig erzeugt, v2 kannte ihn **nicht**; 7 Negativfälle ohne Personenbezug |
| `messen.mjs` | Messskript: `messe(maskFn, {corpusPath})` → Leak-Quote je Typ, Roundtrip |
| `maske-v2.mjs` | Prototyp v2 (Regeln + Mandanten-Namensliste + Restscanner). **Referenz, nicht ungeprüft übernehmen** |
| `vergleich.mjs` | v1 (`api-backend/ai/pii-mask.js`) gegen v2 auf beiden Korpora + Negativfälle |
| `effektiv.mjs` | Leak, der *trotz* fail-closed (Restscanner blockiert) noch rausgeht |
| `ner-test.mjs` | Lokales NER-Modell (transformers.js) obendrauf — am 08.10. lokal offline gemessen, Entscheidung unten |

## Messergebnis 02.10.2026

| | Korpus 1 (gesehen) | Korpus 2 (unbekannt) |
|---|---|---|
| v1 heute (`pii-mask.js`) | 114/151 geleakt (75,5 %) | 108/139 (77,7 %) |
| v2 nur Maskierung | 1/151 (0,7 % — nur Quasi-Identifikator) | 35/139 (25,2 %) |
| v2 + fail-closed (geblockt zählt nicht) | 1/151 | **18/139 (12,9 %)** |
| Fehlalarm auf 7 Negativfällen | — | 1 (`Ulcus` als Name maskiert, harmlos) |

Was in Korpus 2 trotz allem durchkommt: Personen, die **nicht in der Datenbank stehen und
keine Anrede haben** („Oma Lisbeth“, „Marco“, „Hausarzt Lindner“), Einrichtungen
(„MVZ Regensburg Nord“), `geb. 03/1950`. Folgerung, die den Plan trägt: **Freitext ist mit
Regeln allein nicht dicht** → strukturierte Felder werden per Konstruktion ersetzt
(0 Leak im damaligen synthetischen Strukturtest). Damals geplant: Freitext als Ausnahme
mit zusätzlichem NER und Rückfrage. **Entscheidung 08.10.: NER nicht übernehmen;
Freitextqualität bleibt FAIL und Freitext standardmäßig gesperrt.**

Ausführen (Repo-Wurzel): `node spike/ki-maske/vergleich.mjs` · `node spike/ki-maske/effektiv.mjs`
NER: isoliertes, versionsfestes Setup und Offline-Befehl unten; keine Installation ins Projekt.

## M4.2 — reproduzierbare Entscheidung 08.10.2026

**NER nicht übernehmen.** Der feste Kandidat verfehlt das Qualitätsgate und das unveränderte Alpine-Betriebsgate. Sichere Fortsetzung gemäß Plan2: B standardmäßig blockieren; Regeln/Rückfrage ausschließlich innerhalb zulässiger direkt-Taskregeln. Jeton bleibt A-only. Kein Runtime-AI-Code, Provider, Token, DB oder Cold-Korpus wurde verwendet/geändert.

Nachweis: `2026-10-08-m4-2-messbericht.json` (nur Fall-IDs/Typen/Zähler, keine Korpustexte), `model-manifest.json`, `ner-package.json` und `ner-package-lock.json`.

| Korrigierte Pipeline | Korpus1 | Korpus2 |
|---|---|---|
| Regeln v2, Rohlecks | 1/151 | 36/139 |
| Regeln v2, effektive Restlecks | 1/151 (0,66 %) | 19/139 (13,67 %) |
| Regeln v2, blockierte Fälle | 0/60 | 11/50 (22 %) |
| Regeln + lokales NER, Rohlecks | 0/151 | 5/139 |
| Regeln + lokales NER, effektive Restlecks | 0/151 | **4/139 (2,88 %, FAIL)** |
| Regeln + NER, Lecks unter gesendeten Truth-Items | 0/151 | 4/129 (3,10 %) |
| Regeln + NER, blockierte Fälle | 0/60 | 2/50 (4 %) |
| Gesamtpipeline, negative Fehlalarme | keine Negativen vorhanden | **6/7 (FAIL, maximal 1 erlaubt)** |

Alle 110 Fälle haben vollständigen Roundtrip; keine Verarbeitungsfehler. Drei wiederholte NER-Läufe nach Streaming-Hashprüfung, darunter zwei parallel, ergeben identische Qualitätszähler. Keine Modell-/Regeljustierung anhand des Ergebnisses. Das gilt ausschließlich für diese synthetischen Korpora; sieben Negative sind kein statistischer Nachweis allgemeiner Präzision.

### Messvertrag und korrigierte Fehler

- Exaktes Korpus2-Gate: maximal zwei Restlecks aus 139 Truth-Items, höchstens ein unbegründet veränderter **oder blockierter** negativer Fall. Rohleck, effektives Leck, tatsächlich gesendeter Nenner und Blockquote separat. Alle positiven Fälle blockieren kann kein PASS liefern.
- Null/fehlformatige/leere Maskierung, unbekannte/nicht zuordenbare Tokens, Trunkierung und Roundtripfehler blockieren und invalidieren die Messung. Fehlercodes bleiben inhaltsfrei. Keine stillschweigende Null-Leak-Ausgabe.
- NER arbeitet auf vollständiger raw Tokenfolge einschließlich O. Bestehende Platzhalter werden positionsgleich ausgeblendet. Da Transformers keine Zeichenoffsets liefert, werden Tokens strikt und sequentiell mit dem Original abgeglichen; ausschließlich zusammengehörige PER/ORG/LOC-Spans ersetzt. Keine globale Wortersetzung. Restscanner wird **nach** NER neu ausgeführt.
- Oracle: NFKC, case-insensitive; auch kurze Namen und Unicode-Wortgrenzen. Harmlose Substrings zählen nicht mehr als Namen. Deshalb sind die historischen Zähler oben nicht unverändert vergleichbar: v2 Korpus2 jetzt 19 statt 18 effektive Lecks. `vergleich.mjs` zeigt zusätzlich eine vorhandene v1-Roundtripverletzung auf Korpus1 und endet dann mit Exit 2; keine Runtime-Reparatur im Spike.
- `benchmark.test.mjs` + `oracle.test.mjs`: **13 Tests, zehn aufeinanderfolgende lokale Läufe grün**. CI nicht ausgeführt. Die spätere Runtime-Regressionsverdrahtung mit drei gepinnten Korpora ist inzwischen Teil der lokalen Root-Suite; NER-Benchmark bleibt gesonderter Spike-Test.

### Modell, Ressourcen und Betrieb

Kandidat: `Xenova/bert-base-multilingual-cased-ner-hrl`, Revision `263e82c06569c8c2ac46238a7ae5107598934234`, q8 (`model_quantized.onnx`), alle Download-Dateien SHA-256-geprüft. Transformers **4.3.1**, ONNX Runtime **1.30.0**; Lockfile enthält Registry-Integritäten. Bibliothek Apache-2.0, ONNX Runtime MIT; Basismodellkarte deklariert **AFL-3.0** (Revision im Manifest). Das konvertierte Modell besitzt keine eigenständige Lizenzdeklaration in seiner Modellkarte; Auslieferungs-/Lizenzprüfung ist nicht als bestanden zu werten.

Native Messung: macOS arm64, Node v24.12.0, ein ONNX-Thread, Node-Heapgrenze 256 MB. Laden 440 ms, Peak-RSS 503632 KiB (491,8 MiB), Korpus2 p50 40,9 ms / p95 114,4 ms. Hashprüfung erfolgt gestreamt; der erste verworfene RAM-Probelauf las das gesamte Modell in einen Buffer. Werte sind hostabhängig, keine Box-SLOs. Zwei parallele native Prozesse: Laden 628/634 ms; Peak-RSS 481008/486048 KiB. Summe der einzelnen Peaks ist lediglich obere Summenabschätzung, kein gemessener simultaner Containerpeak.

Unverändertes Zielimage `node:22-alpine`, Manifestdigest `sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402`, Node v22.23.3, 1200m/1,5 CPU: **ARM64 und emuliertes AMD64 scheitern beim ONNX-Import** (`ERR_DLOPEN_FAILED`, fehlender `ld-linux-aarch64.so.1` bzw. `ld-linux-x86-64.so.2`). Native ONNX erwartet glibc, Alpine nutzt musl. PM2-Zweiworkerprüfung daher **nicht ausführbar**, Betriebsgate nicht bestanden. Kein Basisimage/Limit geändert, kein Modell ins Produktimage aufgenommen. Kein weiterer Kandidat oder Architekturwechsel nötig, da Qualitätsgate bereits scheitert.

### Reproduktion (Repo-Wurzel)

```sh
sh spike/ki-maske/setup-ner.sh /tmp/praxura-m4-ner-20261008
node --test spike/ki-maske/benchmark.test.mjs spike/ki-maske/oracle.test.mjs
node spike/ki-maske/effektiv.mjs
M4_MODEL_DIR=/tmp/praxura-m4-ner-20261008/model \
M4_TRANSFORMERS_ENTRY=/tmp/praxura-m4-ner-20261008/node_modules/@huggingface/transformers/dist/transformers.node.mjs \
M4_REPORT=/tmp/praxura-m4-ner-20261008/report.json \
node --max-old-space-size=256 spike/ki-maske/ner-test.mjs
```

`setup-ner.sh` ist der explizite Download-/Buildschritt, mit `npm ci` und festen Modellhashes. Benchmark hat `allowRemoteModels=false`; fehlende/falsche Assets brechen ab. Exit 0 bedeutet durchgeführte Messung, **nicht** Qualitätsfreigabe; Entscheidung steht im Report. Exit 2 bedeutet ungültige Verarbeitung/Restaurierung. Dateien auf Basis von `import.meta.url`, keine unbeabsichtigte Ergebnisdatei aus Vergleich/effektiv.

Kontext-/Codingprovider für den ursprünglichen NER-Auftrag getrennt: erster Gemini-Worker an headless Command-Permission gescheitert; korrigierter Lauf mit eng begrenztem Dateiauftrag an Google-Netzwerk-Timeout gescheitert, keine Edits geliefert. Harness danach direkt umgesetzt. Spätere Gesamtumsetzung/Cold nutzte nach offengelegter Gemini-Kontingenterschöpfung das Codex-Team; keine gemessene Netto-Tokenersparnis behauptet. Der NER-Bearbeiter erzeugte keinen Cold-Satz, weil er Implementierung und alte Korpora kannte.

## Finale Runtime und Cold — 08.10.2026

Diese Messung betrifft den späteren Produkt-Maskierungskern; sie ersetzt die oben datierte NER-Entscheidung nicht. Nur synthetische Daten und Fake-Gateway, **0 echte Anbieteraufrufe**. Runtime eingefroren unter Digest `1eb8c0ebe1f88852c4d21abf8a76a5a49d054af827e7118e2d2682155702f5bb`, nach Cold unverändert geprüft.

Nachweise: `2026-10-08-m4-runtime-korpora.json`, `2026-10-08-m4-cold-messbericht.json` und vollständiger QA-Bericht `wissensbank/sitzungen/2026-10-08_m4-qa-bericht.md`.

| Finale Runtime | Korpus1 | Korpus2 | Cold |
|---|---:|---:|---:|
| Fälle / Truth-Items | 60 / 151 | 50 / 139 | 42 / 156 |
| Rohlecks | 0 | 31 | 40 |
| Effektive Lecks | 0/151 | **15/139 (10,79 %)** | **36/156 (23,08 %)** |
| Unter gesendeten Truth-Items | 0/150 | 15/89 (16,85 %) | 36/151 (23,84 %) |
| Blockierte Fälle | 1/60 | 14/50 | 1/42 |
| Negative Fehlalarme | keine Negativfälle | 1/7 | 0/14 |
| Verarbeitungs-/Roundtripfehler | 0 | 0 | 0 |
| Freitextgate ≤2 % | PASS | FAIL | FAIL |

„Gesendet“ bezeichnet den Benchmark-/Fake-Transportnenner, keinen externen Versand. Blockquote und Restlecks bleiben getrennt. Korpus2 und Cold widerlegen ausreichende allgemeine Freitextqualität. Freitext bleibt standardmäßig aus; Rückfragen und Opt-in ändern diesen Befund nicht. Cold-A-Gateway: **42/42 PASS**, 0 Roh-PII-Lecks; Jeton-B-Sperre: **42/42 PASS**, 0 Transportaufrufe. Diese technischen PASS verwandeln Freitext-FAIL nicht in Qualitätsfreigabe.

Cold-Herkunft: unabhängiger Codex-Agent ohne Runtime-/Alt-Korpus-/Quellenzugriff, weil Gemini-Kontingent erschöpft war; Providerabweichung offengelegt. Ursprünglicher Gemini-Cold-Satz ging beim Umgebungsneustart vor Auswertung verloren. 28 positive und 14 negative Fälle, vier lange Texte; SHA-256 `34909b0efe921e065c841b344a99a7e2e77fa91ed5e75fe4beaf2fb7b594f90b`.

Methodische Grenze: Bericht enthält `evaluationExecution=2`, `firstEvaluation=false`. Erste Maskenmessung lief; falsche nachgelagerte Harness-Erwartung beim korrekt mit `KI_SCHEMA` blockierten zu langen B-Payload verhinderte Speicherung. Zweiter Lauf auf identischer eingefrorener Runtime, **kein Cold-Fit**. Formatadapter für `{version,cases}` bereits vor erster Maskenmessung korrigiert. Kein vorgetäuschter einmaliger Erstlauf. Der nun bekannte Cold-Satz ist künftig Regression; nächste Qualitätsfreigabe braucht neuen unabhängigen Satz.

Drei gepinnte Korpora jetzt als Runtime-Regression in lokaler Testsuite verdrahtet. Finale Root-Suite **3117/3117 PASS** prüft unter anderem Grenzen und bewahrt bekannte Qualitätsbefunde; dies ist keine bestandene Freitextfreigabe. Typecheck, M4-Probe 22/22 und M3-Probe 39/39 lokal bestanden. CI, physische Box, reale Azure-/Hat-K-Eigenschaften und externe Freigaben nicht geprüft.
