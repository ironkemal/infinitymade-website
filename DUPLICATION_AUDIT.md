# Duplication Audit — Praxura

**Stand:** 2026-07-25
**Methode:** automatischer Scan (agy) + **manuelle Verifikation jedes Befunds im Code.**

> Der automatische Durchlauf hat mehrere Befunde als „HOCH" gemeldet, die sich im
> Code **nicht bestätigen ließen** (siehe „Nicht bestätigt" unten). Diese Fassung
> enthält nur, was Zeile für Zeile gegengelesen wurde. Zeilennummern: Stand
> 2026-07-25 nach dem ICD-/Diagnosegruppen-Refactor.

---

## Zusammenfassung

| Thema | Kopien | Widersprüchlich? | Risiko |
| :--- | :---: | :---: | :--- |
| `fmtEur` Währungsformat | 10 in 7 Dateien | **JA** | **HOCH** — `NaN €` vs `''` vs `0,00 €` |
| `escapeHtml` / `escHtml` | 9 in 9 Dateien | **JA** | **HOCH** — `dashboard.js` wirft TypeError bei Zahlen |
| `formatDateDE` | 2 | **JA** | **MITTEL** — inkompatible Signaturen (String vs Date) |
| KVNR-Prüfung | 3 | **JA** | **MITTEL** — Frontend lax, Backend streng |
| Kalender-Widget umgangen | 3 | nein | **MITTEL** — `mountCalendar` wird 2× nicht genutzt |
| PDF-Template-Helper | 6 identische Paare | nein | **MITTEL** — jede Änderung 6× nachziehen |
| Diagnose-Suche (ICD/DG) | ~~5~~ → **1** | ~~JA~~ | ✅ **in diesem Durchlauf behoben** |
| `stripe-live-setup.cjs` / `.js` | 2 | fast identisch | **NIEDRIG** |

---

## ✅ Bereits behoben (dieser Durchlauf)

Die Diagnose-Suche war der schlimmste Fall des Musters — **fünf** getrennte
Implementierungen derselben Sache, die sich gegenseitig widersprachen:

| Ort | Was es war | Jetzt |
| :--- | :--- | :--- |
| `icd10-autocomplete.js` | gemeinsames Modul, nur ICD, min. 2 Zeichen | **die einzige Implementierung** |
| `dashboard.js` — `ICD_SECTORS`, `initIcdSearch`, `populateIcdDatalist` | eigene Datalist-Suche mit eigenen Kapitelbereichen | gelöscht → ruft das Modul |
| `dashboard.js` — `PODOLOGIE_ICD_MAP` | hartkodierte ICD-Liste je Diagnosegruppe | gelöscht → `diagnosegruppen.icd_prefixes` |
| `Podoloji/podologie-hpnr-reference.js` | dritte ICD-Liste, wieder abweichend | als „nicht autoritativ" markiert + korrigiert |
| `api-backend/ai/validators/diagnosegruppen.json` | 12 **sachlich falsche** Bezeichnungen | gegen HeilM-RL korrigiert |

Neue Einzelquelle: Postgres-RPC **`search_diagnosen()`** + **`icd10-autocomplete.js`**.
Wer künftig eine Diagnose-Eingabe baut, ruft `attachDiagnoseSearch()` — sonst nichts.

---

## P0 — Kopien, die sich bereits widersprechen

### 1. `fmtEur` — drei verschiedene Ergebnisse für denselben Input

| Datei:Zeile | bei `null` | bei `undefined` |
| :--- | :--- | :--- |
| `dashboard.js:18843` | `0,00 €` | `0,00 €` |
| `dashboard.js:20760` | `0,00 €` | **`NaN €`** — `Number(n)` ungeschützt |
| `dashboard.js:20882` | `0,00 €` | **`NaN €`** — `Number(n)` ungeschützt |
| `dashboard.js:20960` | `0,00 €` | `0,00 €` |
| `api-backend/billing/pdf/ausfallrechnung.template.js:15` | `` (leer) |
| `api-backend/billing/pdf/begleitzettel.template.js:12` | `` (leer) |
| `api-backend/billing/pdf/rechnung.template.js:10` | ` €` (nur Einheit) | ` €` |
| `api-backend/billing/pdf/rzg-quittung.template.js:10` | ` €` | ` €` |
| `api-backend/billing/pdf/zuzahlungsrechnung.template.js:13` | ` €` | ` €` |
| `api-backend/billing/pdf/mahnung.template.js:5` | `0,00 €` | `0,00 €` |

**Auswirkung:** je nachdem welche Kopie greift, steht auf einer Patientenrechnung
`0,00 €`, nur `€`, oder `NaN €`. Live nachvollziehbar auf
`komponenten.html` → „Geldbeträge formatieren".

**Ziel:** `lib/format.js` (Frontend) + `api-backend/lib/format.js` (Backend).

---

### 2. `escapeHtml` — die Dashboard-Kopie stürzt bei Zahlen ab

```js
// dashboard.js:538  ← BUG
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;') /* … */;   // Zahlen haben kein .replace
}

// booking-request.js:1159  ← korrekt
function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;') /* … */;
}
```

`dashboard.js:538` wirft `TypeError: str.replace is not a function`, sobald ein
Zahlenwert durchgereicht wird, und liefert `''` für die Zahl `0`.
Die sechs PDF-Templates (`String(s ?? '')`) sind korrekt.

**Betroffen:** `dashboard.js:538` · `booking-request.js:1159` ·
`icd10-autocomplete.js:71` (bereits auf `String(str)` gezogen) ·
`api-backend/billing/pdf/{ausfallrechnung,begleitzettel,rechnung,rezeptvorderseite,rzg-quittung,zuzahlungsrechnung}.template.js`

---

### 3. `formatDateDE` — gleicher Name, inkompatible Signaturen

```js
// booking-request.js:177 — erwartet ISO-STRING
function formatDateDE(isoStr) { const [y,m,d] = isoStr.split('-'); return `${d}.${m}.${y}`; }

// dashboard.js:2311 — erwartet DATE-OBJEKT
function formatDateDE(d) { return d.toLocaleDateString('de-DE', opts); }
```

Jede wirft bei der Eingabeart der anderen einen TypeError, und die Ausgabe
unterscheidet sich (`01.05.2026` vs `1. Mai 2026`). Code zwischen den Dateien
zu kopieren baut still einen Absturz ein.

> Korrektur zum Auto-Scan: **zwei** Kopien, nicht acht. `fmtDate` (DTA-Format
> `DDMMYYYY`) und die `Intl.DateTimeFormat`-Instanzen tun bewusst etwas anderes.

---

### 4. KVNR-Prüfung: Frontend lax, Backend streng

- `api-backend/billing/dta/preflight.js:57` — `isValidKvnr()`, die einzige echte Prüfung
- `booking-request.js:1180` — nur `/^[A-Z]\d{9}$/` inline
- `dashboard.js:15500` — prüft nur „nicht leer"

**Auswirkung:** eine KVNR wird bei der Aufnahme akzeptiert und fällt erst
Wochen später beim §302-DTA-Preflight durch — dann muss der Patient
nachträglich kontaktiert werden.

> Korrektur zum Auto-Scan: `isValidKvnr` prüft **Format**, keine
> Modulus-11-Prüfziffer — `preflight.test.js:31` akzeptiert `A123456789`.

---

## P1 — echte Duplikation, Kopien noch einig

### 5. `mountCalendar` wird zweimal umgangen
- `calendar-widget.js:68` — `export function mountCalendar()`, die gepflegte Komponente
- `dashboard.js:2230` — nutzt sie korrekt
- `booking-request.js:572` — `function renderCalendar()`, eigene Monatslogik
- `booking.js:373` — `async function renderBookingCalendar()`, dritte Variante

Feiertags-Markierung, Locale- und Slot-Fixes an `calendar-widget.js` erreichen die
beiden anderen nicht.
⚠ `booking.js` gehört zur **entfernten** öffentlichen Buchung (Stand 2026-06-11) —
vor dem Refactor prüfen, ob die Datei überhaupt noch ausgeliefert wird.

### 6. PDF-Template-Helper 6× identisch
`escapeHtml` **und** `fmtEur` sind in allen sechs Templates unter
`api-backend/billing/pdf/` byte-gleich dupliziert. Noch harmlos, weil identisch —
aber jede Korrektur muss sechsmal passieren, und genau so ist Befund 1 entstanden.
→ `api-backend/billing/pdf/_helpers.js`

### 7. `stripe-live-setup.cjs` / `stripe-live-setup.js`
Fast identisch (4445 vs 4447 Bytes, unterschiedliche Prüfsumme). Eine davon ist
tot → feststellen welche, die andere löschen.

---

## Nicht bestätigt (Auto-Scan meldete, Code belegt es nicht)

Diese standen im Rohbericht als „HOCH" und ließen sich **nicht** verifizieren:

| Behauptung | Prüfung |
| :--- | :--- |
| Plan-Namen `pro`/`free` vs `professional` widersprüchlich | Kein Vorkommen von `'pro'`/`'free'` als Plan-Wert außerhalb `node_modules`. |
| `patients`-Query: `dob` vs `geburtsdatum` Drift | Keine Fundstelle — `dob` existiert nur als lokaler Variablenname (`dashboard.js:3259`). |
| `invoices.patient_name` existiert nicht | Die Spalte wird in `api/dsgvo.js:93` als zu anonymisierendes Feld geführt. |
| HPNR `78100` fehlt in der Referenz | Steht in `dashboard.js:22510`, `podologie-hpnr-reference.js:178` **und** in `heilmittel_catalog`. |
| `booking-request.js` baut eigene ICD-Autocomplete | Nein — `booking-request.html` importiert das gemeinsame Modul. |
| `showToast` 3× dupliziert | 2 Definitionen (`admin.js:22`, `dashboard.js:943`), getrennte Anwendungen. Legitim. |
| `getOwnerId` 4× dupliziert | 2 — `dashboard.js:542` (sync, Frontend) vs `lib/supabase.js:264` (async, Backend). Unterschiedlicher Zweck. |
| `stripe-live-setup.*` „100 % identisch" | Prüfsummen unterscheiden sich. |

**Lehre:** automatische Duplikat-Scans melden Namensgleichheit, nicht
Verhaltensgleichheit. Jeder Befund gehört vor dem Refactor gegengelesen.

---

## Empfohlene Reihenfolge

| # | Maßnahme | Zielmodul | Aufwand |
| :-: | :--- | :--- | :--- |
| 1 | `escapeHtml` vereinheitlichen (echter Absturz) | `lib/format.js` + `api-backend/lib/format.js` | ~1 h |
| 2 | `fmtEur` vereinheitlichen (falsche Rechnungsbeträge) | dito | ~1 h |
| 3 | PDF-Helper extrahieren | `api-backend/billing/pdf/_helpers.js` | ~30 min |
| 4 | `formatDateDE` auf eine Signatur (ISO-String) ziehen | `lib/format.js` | ~1 h |
| 5 | KVNR-Prüfung ins Frontend spiegeln | `lib/validate-kvnr.js` | ~1 h |
| 6 | Kalender: `booking.js` prüfen, dann `mountCalendar` erzwingen | `calendar-widget.js` | ~3 h |
| 7 | tote `stripe-live-setup`-Datei löschen | — | ~10 min |

Schritte 1–3 sind reine Extraktion ohne Verhaltensänderung und lassen sich in
einem Durchgang erledigen.
