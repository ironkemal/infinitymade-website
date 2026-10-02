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
| `ner-test.mjs` | Lokales NER-Modell (transformers.js) obendrauf — **noch nicht gelaufen**, HuggingFace war aus dem Netz gesperrt |

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
(0 Leak), Freitext ist die Ausnahme und bekommt zusätzlich NER + Rückfrage.

Ausführen (Repo-Wurzel): `node spike/ki-maske/vergleich.mjs` · `node spike/ki-maske/effektiv.mjs`
NER: `cd spike/ki-maske && npm i @huggingface/transformers && node ner-test.mjs`
