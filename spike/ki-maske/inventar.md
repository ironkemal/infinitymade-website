# Lückenloses Inventar aller KI-Aufrufe (InfinityMade / Praxura)

> **Zweck:** Vorbereitung einer zentralen Maskierungsschicht (DSGVO Art. 25, 32 / DSFA) vor jedem externen KI-Aufruf.  
> **Untersuchte Codebasis:** Repo-Wurzel (Frontend Vanilla JS / ES-Module, Backend Express in `api-backend/`).  
> **Stand:** 02.10.2026

---

## 1. Executive Summary & Architektur-Überblick

Aktuell existieren im System **5 aktive Aufrufpfade zu Azure OpenAI** (`api-backend/ai/azureClient.js:86`), **1 legacy externer Webhook-Aufruf** an n8n sowie **1 regelbasierter Validator**, der historisch im KI-Verzeichnis liegt, aber kein LLM anspricht:

1. **`b2c-draft`**: E-Mail-Entwurf an Patienten/Kunden aus Freitext-Auftrag (via Azure Gateway).
2. **`appointment-confirm-draft`**: Terminbestätigungs-E-Mail nach Serienerstellung (via Azure Gateway).
3. **`series-scheduler`**: Intelligente Reihenfolge-/Slot-Auswahl für Terminserien (direkter Aufruf in `server.js`).
4. **`rezept-ocr`**: Muster 13 / Blankoverordnung OCR via Vision-Modell (direkter Aufruf in `server.js`).
5. **`rezept-normalize`**: Freitext-Abgleich von OCR-Ergebnissen gegen Katalogwerte (direkter Aufruf in `server.js`).
6. *(Legacy)* **`B2B_AGENT_URL`**: Zuweiser-Mailentwurf via n8n-Webhook (Frontend-Direktaufruf).
7. *(Regelbasiert, KEIN KI-Aufruf)* **`rezept-validate`**: G-BA / KBV Regelsystem (kein LLM).

### Übersichtstabelle aller Aufrufpfade

| # | Task / Zweck | Datei:Zeile `chat()` | Route & Controller | Aufrufendes Frontend | Eingabeart | Maskierung heute | Unmasking | Echter Personenbezug nötig? |
|---|---|---|---|---|---|---|---|---|
| **1** | **B2C Mail-Entwurf** (`b2c-draft`) | [`api-backend/ai/tasks/b2c-draft.js:78`](../../api-backend/ai/tasks/b2c-draft.js#L78) | `POST /api/ai/b2c-draft`<br>([`router.js:19`](../../api-backend/ai/router.js#L19)) | [`dashboard.js:11378`](../../dashboard.js#L11378) | Text (JSON) | **Teilweise** (nur `contacts[]`-Objekte via `entitiesFromContacts`) | **Ja** (`b2c-draft.js:86`) | **Nein** (generische Platzhalter genügen) |
| **2** | **Terminbestätigung Mail** (`appointment-confirm-draft`) | [`api-backend/ai/tasks/appointment-confirm-draft.js:87`](../../api-backend/ai/tasks/appointment-confirm-draft.js#L87) | `POST /api/ai/appointment-confirm-draft`<br>([`router.js:22`](../../api-backend/ai/router.js#L22)) | [`dashboard.js:6868`](../../dashboard.js#L6868) | Text (JSON) | **Minimal** (nur `patient.name`, `patient.email`) | **Ja** (`appointment-confirm-draft.js:95`) | **Nein** (Template/Platzhalter genügen) |
| **3** | **Serientermin-Planung** (`series-scheduler`) | [`api-backend/ai/tasks/series-scheduler.js:119`](../../api-backend/ai/tasks/series-scheduler.js#L119) | `POST /api/booking/ai-suggest-series`<br>([`server.js:1639`](../../api-backend/server.js#L1639), Aufruf `:2061`) | [`dashboard.js:6028`](../../dashboard.js#L6028), [`:6266`](../../dashboard.js#L6266) | Text (JSON) | **NEIN (0%)** | **Nein** | **Nein** (reine Slot-Optimierung) |
| **4** | **Rezept-OCR** (`rezept-ocr`) | [`api-backend/ai/tasks/rezept-ocr.js:185`](../../api-backend/ai/tasks/rezept-ocr.js#L185) | `POST /api/rezept/upload`<br>([`server.js:2314`](../../api-backend/server.js#L2314), Aufruf `:2351`) | [`dashboard.js:15847`](../../dashboard.js#L15847) | Bild (Base64 JPEG/PNG via Vision) | **NEIN (0%)** (Bild wird unmaskiert an Azure gesendet) | **Nein** | **Bedingt** (OCR braucht Bildinhalt, aber Identifikatoren könnten vorab geschwärzt werden) |
| **5** | **Rezept-Katalog-Normalisierung** (`rezept-normalize`) | [`api-backend/ai/tasks/rezept-normalize.js:131`](../../api-backend/ai/tasks/rezept-normalize.js#L131) | Intern in `POST /api/rezept/upload`<br>([`server.js:2401`](../../api-backend/server.js#L2401)) | Indirekt via [`dashboard.js:15847`](../../dashboard.js#L15847) | Text (JSON) | **NEIN (0%)** | **Nein** | **Nein** (reines Begriffs-Mapping) |
| **6** | *(Legacy)* **B2B Zuweiser-Mail** (`B2B_AGENT_URL`) | Extern in n8n (nicht im Repo) | Direct Webhook `https://n8n.infinitymade.de/webhook/b2b-mail-agent` | [`dashboard.js:11292`](../../dashboard.js#L11292) (URL in [`:11072`](../../dashboard.js#L11072)) | Text (JSON) | **NEIN (0%)** | **Nein** | **Nein** |
| **7** | *(Kein KI-Aufruf)* **Rezept-Validierung** (`rezept-validate`) | Keiner (`model: null`) | `POST /api/ai/rezept-validate`<br>([`router.js:20`](../../api-backend/ai/router.js#L20)) & [`server.js:2468`](../../api-backend/server.js#L2468) | Indirekt nach OCR / Speichern | Text (JSON) | Entfällt | Entfällt | Entfällt (lokale JS-Regel-Engine) |

---

## 2. Detaillierte Analyse jedes Aufrufpfads

### 2.1 Pfad 1: B2C E-Mail-Entwurf (`b2c-draft`)

* **Datei:Zeile `chat()`-Aufruf:** [`api-backend/ai/tasks/b2c-draft.js:78`](../../api-backend/ai/tasks/b2c-draft.js#L78)
* **Backend-Route:** `POST /api/ai/b2c-draft` registriert in [`api-backend/ai/router.js:19`](../../api-backend/ai/router.js#L19), gemountet in [`api-backend/server.js:501`](../../api-backend/server.js#L501) (`app.use('/api/ai', aiRouter);`).
* **Aufrufendes Frontend:** [`dashboard.js:11378`](../../dashboard.js#L11378) in Funktion `runMailDraftViaGateway(intent, contactsCache, containerId, mapContactFn)`.
  * Auslöser: Button `#b2cAiSendBtn` ([`dashboard.js:11407-11415`](../../dashboard.js#L11407-L11415)) und Spracheingabe `#b2cAiVoiceBtn` ([`dashboard.js:11437-11439`](../../dashboard.js#L11437-L11439)).
* **Eingabeart:** Text (JSON).
* **Tatsächlich in den Prompt einfließende Felder:**
  * `intent`: Freitext-Auftrag des Nutzers (z.B. *"Erinnere Herrn Müller an seinen Termin morgen"*).
  * `contacts[]` (max. 30 Kontakte):
    * `c.id`
    * `c.name` bzw. `c.contact_name` (im Frontend aus `c.title` gemappt)
    * `c.email`
    * `c.notes` (wird bis 120 Zeichen abgeschnitten: `(c.notes || '').slice(0, 120)`)
  * `owner_info`:
    * `owner_info.business_name` (Praxisname)
    * `owner_info.sender_name` (Absendername des Inhabers)
    * `owner_info.city` (Stadt)
    * `owner_info.sector` (Branche, z.B. Physiotherapie)
    * `owner_info.extra_context` (Freitext aus `currentProfile.system_prompt`)
* **Personenbezug nach Kategorien:**
  * *Patient/Kunde:* Name (`contacts[].name`), E-Mail (`contacts[].email`), Notizen (`contacts[].notes`), potenziell beliebige Identifikatoren im Freitext `intent`.
  * *Praxisinhaber / Mitarbeiter:* Absendername (`owner_info.sender_name`), Praxisname (`owner_info.business_name`), Stadt (`owner_info.city`), `extra_context`.
* **Aktuelle Maskierung:**
  * **Vorhanden:** Ruft `entitiesFromContacts(payload?.contacts || [])` auf ([`b2c-draft.js:75`](../../api-backend/ai/tasks/b2c-draft.js#L75)) und übergibt die Entitäten an `maskMessages()` ([`b2c-draft.js:76`](../../api-backend/ai/tasks/b2c-draft.js#L76)).
  * **Was rutscht durch (Sicherheitslücken):**
    1. **Namen im Freitext `intent`:** Wenn der Nutzer tippt *"Schreib Thomas, dass er..."* und Thomas in der Kontaktliste als *"Thomas Schmidt"* geführt wird, matcht `split('Thomas Schmidt')` nicht! Der Vorname *"Thomas"* geht unmaskiert an Azure.
    2. **Freitext-Notizen (`contacts[].notes`):** Enthalten oft Diagnosen, Telefonnummern, Geburtsdaten oder Familienverhältnisse. Diese werden nicht durchsucht oder maskiert.
    3. **Telefonnummern im `intent`:** Mangels Regex für Telefonnummern in `AUTO_PATTERNS` rutscht jede im Auftrag erwähnte Telefonnummer durch.
    4. **Inhaber- und Praxisdaten (`owner_info.*`):** Werden überhaupt nicht maskiert.
* **Entmaskierung (Unmask):** **Ja**, in [`b2c-draft.js:86`](../../api-backend/ai/tasks/b2c-draft.js#L86) (`const unmaskedContent = unmask(result.content);`).
* **Erforderlichkeit des Personenbezugs:** **Nein**. Die KI muss lediglich den Wortlaut der E-Mail formulieren. Platzhalter wie `Sehr geehrte/r Herr/Frau <<NAME_1>>` genügen vollkommen.

---

### 2.2 Pfad 2: Terminbestätigung E-Mail (`appointment-confirm-draft`)

* **Datei:Zeile `chat()`-Aufruf:** [`api-backend/ai/tasks/appointment-confirm-draft.js:87`](../../api-backend/ai/tasks/appointment-confirm-draft.js#L87)
* **Backend-Route:** `POST /api/ai/appointment-confirm-draft` registriert in [`api-backend/ai/router.js:22`](../../api-backend/ai/router.js#L22), gemountet in [`api-backend/server.js:501`](../../api-backend/server.js#L501).
* **Aufrufendes Frontend:** [`dashboard.js:6868`](../../dashboard.js#L6868) in `maybeOfferAppointmentConfirmEmail(...)`.
  * Auslöser: Nach Buchung einer Terminserie fragt das System den Therapeuten via Modal (`#mailOfferModal`), ob dem Patienten eine Bestätigung geschickt werden soll.
* **Eingabeart:** Text (JSON).
* **Tatsächlich in den Prompt einfließende Felder:**
  * `patient.name`: Name des Patienten (`custName`).
  * `patient.email`: E-Mail-Adresse des Patienten.
  * `service.title`: Bezeichnung der Leistung (z.B. *"Krankengymnastik ZNS"*, *"Manuelle Therapie"*).
  * `slots[]`:
    * `s.date`: Datum (YYYY-MM-DD).
    * `s.time`: Uhrzeit (HH:MM).
    * `s.employeeName`: Name des behandelnden Therapeuten (`empMap[sl.employeeId]`).
  * `owner_info`:
    * `owner_info.business_name`: Praxisname.
    * `owner_info.sender_name`: Name des Absenders.
    * `owner_info.city`: Stadt.
    * `owner_info.phone`: Praxis-Telefonnummer.
* **Personenbezug nach Kategorien:**
  * *Patient:* Name, E-Mail.
  * *Gesundheitsdaten (Art. 9 DSGVO):* `service.title` (offenbart Behandlungsart und Indikation).
  * *Mitarbeiter:* Name des Therapeuten (`s.employeeName`).
  * *Praxis:* Name, Absender, Stadt, Telefonnummer.
  * *Kalenderdaten:* Genaue Behandlungstage und Uhrzeiten.
* **Aktuelle Maskierung:**
  * **Vorhanden:** In [`appointment-confirm-draft.js:84`](../../api-backend/ai/tasks/appointment-confirm-draft.js#L84) wird `entitiesFromContacts([payload.patient || {}])` ausgeführt.
  * **Was rutscht durch (Sicherheitslücken):**
    1. **Therapeuten- / Mitarbeiternamen (`slots[].employeeName`):** Werden im Klartext in den Prompt eingebaut (`formatSlot(s)`: line 27: `parts.push('(' + s.employeeName + ')')`). Sie werden **nicht** in `entities` aufgenommen und gehen unmaskiert an Azure!
    2. **Leistungsbezeichnung (`service.title`):** Medizinische Behandlungsinformation geht im Klartext an Azure.
    3. **Praxisdaten:** Telefon, Absendername, Praxisname bleiben unmaskiert.
* **Entmaskierung (Unmask):** **Ja**, in [`appointment-confirm-draft.js:95`](../../api-backend/ai/tasks/appointment-confirm-draft.js#L95) (`unmask(result.content)`).
* **Erforderlichkeit des Personenbezugs:** **Nein**. Ein vorgegebenes E-Mail-Gerüst mit Platzhaltern `[PATIENT]`, `[TERMINE]`, `[THERAPEUT]` reicht völlig aus.

---

### 2.3 Pfad 3: KI-Serientermin-Planung (`series-scheduler`)

* **Datei:Zeile `chat()`-Aufruf:** [`api-backend/ai/tasks/series-scheduler.js:119`](../../api-backend/ai/tasks/series-scheduler.js#L119)
* **Backend-Route & Controller:**
  * Route: `POST /api/booking/ai-suggest-series` in [`api-backend/server.js:1639`](../../api-backend/server.js#L1639).
  * Direkter Aufruf des Tasks in [`api-backend/server.js:2061`](../../api-backend/server.js#L2061) (`aiResult = await seriesSchedulerRun(aiPayload);`).
  * *(Wichtiger Befund: Läuft NICHT über `router.js`, sondern ist direkt in `server.js` verdrahtet!)*
* **Aufrufendes Frontend:**
  * [`dashboard.js:6028`](../../dashboard.js#L6028) bei Klick auf `#aiPrefSubmit` im Serienplanungs-Modal.
  * [`dashboard.js:6266`](../../dashboard.js#L6266) bei Klick auf `#aiSuggestRetry` oder `#aiFeedbackApply` (`aiRetryRequest`).
* **Eingabeart:** Text (JSON).
* **Tatsächlich in den Prompt einfließende Felder:**
  * `customer.name`: Klarname des Patienten (`customerName` aus `leads.first_name` + `last_name` bzw. `title`).
  * `customer.id`: UUID des Patienten.
  * `service.title`: Behandlungsleistung (z.B. *"Krankengymnastik 6x"*).
  * `service.duration`: Behandlungsdauer.
  * `count`: Anzahl Termine.
  * `recurrence`: Intervall (wöchentlich, zweiwöchentlich, täglich).
  * `sector`: Fachbereich (`physiotherapy`, `barber`, `beauty`).
  * `genderFilterApplied`: Geschlechterfilter (`female` / `male`).
  * `preferences.sameEmployee`: 'always' | 'preferred' | 'any'.
  * `preferences.preferredEmployee`: Name des gewünschten Therapeuten (`empMap[...]`).
  * `preferences.timeOfDay`: 'morning' | 'afternoon' | 'any'.
  * `preferences.notes`: **Freitext-Präferenzen des Patienten** ([`series-scheduler.js:75`](../../api-backend/ai/tasks/series-scheduler.js#L75): *"Besondere Wünsche des Patienten: ..."*).
  * `userFeedback`: **Freitext-Änderungswunsch des Nutzers** ([`series-scheduler.js:76`](../../api-backend/ai/tasks/series-scheduler.js#L76): *"ÄNDERUNGSWUNSCH DES NUTZERS zu den vorherigen Vorschlägen..."*).
  * `feedbackApplied`: Liste vom Server bereits erkannter Filter-Änderungen.
  * `previousSelected[]`: Vorherige Termine mit Datum, Zeit und Therapeutenname ([`series-scheduler.js:79`](../../api-backend/ai/tasks/series-scheduler.js#L79)).
  * `employees[]`: Liste aller Therapeuten mit ID, Anrede und Name ([`series-scheduler.js:67`](../../api-backend/ai/tasks/series-scheduler.js#L67): `e.anrede + ' ' + e.name`).
  * `candidates[]`: Bis zu 120+ freie Slots mit Datum, Zeit, Therapeutenname und Therapeutenanrede ([`series-scheduler.js:62`](../../api-backend/ai/tasks/series-scheduler.js#L62)).
  * `targetDates`: Liste der Wunschtage.
  * `emptyDates`: Liste der Tage ohne freie Slots.
* **Personenbezug nach Kategorien:**
  * *Patient:* Vollständiger Klarname (`customer.name`).
  * *Mitarbeiter:* Vollständige Namen aller Therapeuten (`employees[].name`, `empMap[...]`), Anrede (Herr/Frau).
  * *Gesundheitsdaten (Art. 9 DSGVO):* `service.title` (Art der physiotherapeutischen/medizinischen Behandlung).
  * *Freitext (Hochrisiko):* `preferences.notes` und `userFeedback` (können beliebige medizinische Details enthalten, z.B. *"Patientin hatte Schlaganfall, braucht ebenerdigen Raum und Therapeutin Frau Müller"*).
  * *Arbeitszeiten & Belegungsdaten:* Gesamte Verfügbarkeit und Arbeitszeiten der Mitarbeiter.
* **Aktuelle Maskierung:**
  * **KEINE (0%).** In `series-scheduler.js` wird weder `maskPII` noch `maskMessages` aufgerufen. Alle Daten gehen vollständig im Klartext an Azure OpenAI!
* **Entmaskierung (Unmask):** **Nein** (da keine Maskierung stattfand).
* **Erforderlichkeit des Personenbezugs:** **Nein**. Für eine Slot-Reihenfolge-Optimierung benötigt das LLM lediglich anonyme Identifikatoren (z.B. `Patient_1`, `Therapeut_A`, `Therapeut_B`). Die mathematisch-logische Auswahl funktioniert mit Pseudonymen exakt identisch.

---

### 2.4 Pfad 4: Rezept-OCR (`rezept-ocr`)

* **Datei:Zeile `chat()`-Aufruf:** [`api-backend/ai/tasks/rezept-ocr.js:185`](../../api-backend/ai/tasks/rezept-ocr.js#L185)
* **Backend-Route & Controller:**
  * Route: `POST /api/rezept/upload` in [`api-backend/server.js:2314`](../../api-backend/server.js#L2314).
  * Task-Aufruf in [`api-backend/server.js:2351`](../../api-backend/server.js#L2351) (`ocrResult = await rezeptOcrRun({ image_base64: dataUri });`).
  * *(Hinweis: Ist auch in `router.js:21` registriert, der primäre Datenstrom läuft jedoch über `/api/rezept/upload` in `server.js`)*.
* **Aufrufendes Frontend:** [`dashboard.js:15847`](../../dashboard.js#L15847) in `uploadRezeptImage(dataUri)`.
  * Auslöser: Kamera-Scan (`#rxScanShotBtn`, [`dashboard.js:15743`](../../dashboard.js#L15743)) oder Bilddatei-Auswahl (`#rxScanFileInput` / `#rxScanCameraInput`, [`dashboard.js:15741-15742`](../../dashboard.js#L15741-L15742)).
* **Eingabeart:** **Bild (Base64 JPEG/PNG)** via Vision-Block (`{ type: 'image_url', image_url: { url: imageUrl } }`) + Text-Instruktion.
* **Tatsächlich in den Prompt einfließende Felder:**
  * System-Prompt mit Muster-13-Extraktionsregeln ([`rezept-ocr.js:11-93`](../../api-backend/ai/tasks/rezept-ocr.js#L11-L93)).
  * User-Prompt: Text *"Extrahiere die Felder aus dieser Verordnung..."* und das Base64-kodierte Bild des Rezepts.
* **Personenbezug nach Kategorien (Volles Spektrum nach Art. 9 DSGVO):**
  * *Patient:* Name, Vorname, Geburtsdatum, Anschrift (Straße, PLZ, Ort), Krankenversichertennummer (KVNR), Krankenkasse, Geschlecht, Zuzahlungsstatus.
  * *Gesundheit / Befund:* ICD-10-Codes (Haupt- und Zweitdiagnose), ausgeschriebener Diagnose-Freitext (z.B. *"Lumbago mit Ischialgie"*), Diagnosegruppe, Leitsymptomatik (Kästchen a, b, c, d), patientenindividuelle Leitsymptomatik (Freitext), verordnete Heilmittel, Einheiten, Frequenz, Therapieziele/Befunde (Freitext), Hausbesuch, Dringlichkeit.
  * *Arzt / Praxis:* Arztname, Arztstempel, LANR (Lebenslange Arztnummer), BSNR (Betriebsstättennummer), Praxisadresse, Fachrichtung, Ausstellungsdatum, handschriftliche Unterschrift.
* **Aktuelle Maskierung:**
  * **KEINE (0%).** Das Bild wird direkt und unmaskiert an Azure OpenAI geschickt.
  * *Begründung im Quellcode ([`rezept-ocr.js:159-165`](../../api-backend/ai/tasks/rezept-ocr.js#L159-L165)):*
    `// DSGVO note: this task sends an image containing patient PII (name, KVNR, geburtsdatum, ICD-10) to Azure. We cannot text-mask the image.`
    Schutzmechanismen basieren aktuell ausschließlich auf:
    1. Geografischer Bindung an EU Data Boundary (`azureClient.js`).
    2. Microsoft Zero-Data-Retention (ZDR).
    3. Verwerfen der Bildbytes im flüchtigen Speicher (Bild wird nicht in DB abgelegt, nur im Supabase-Storage unter Mandantentrennung).
* **Entmaskierung (Unmask):** **Nein**. Das Modell extrahiert die echten Daten im Klartext.
* **Erforderlichkeit des Personenbezugs:**
  * **Bedingt / Zweigeteilt:** Für die Übernahme der Patientendaten in die Praxisverwaltung muss der Name gelesen werden. Für die Prüfung der Heilmittel-Konformität (G-BA) wären Patientendaten irrelevant. Eine Bildschwärzung (Redaction von Name, Adresse, KVNR) vor dem LLM-Aufruf wäre technisch nur über eine vorgeschaltete lokale OCR (z.B. Tesseract / lokales Modell) mit anschließender Schwärzung der Koordinaten möglich.

---

### 2.5 Pfad 5: Rezept-Katalog-Normalisierung (`rezept-normalize`)

* **Datei:Zeile `chat()`-Aufruf:** [`api-backend/ai/tasks/rezept-normalize.js:131`](../../api-backend/ai/tasks/rezept-normalize.js#L131)
* **Backend-Route & Controller:**
  * Wird serverintern direkt in `POST /api/rezept/upload` aufgerufen ([`api-backend/server.js:2401`](../../api-backend/server.js#L2401)):
    `const normResult = await rezeptNormalizeRun({ rezept: parsed.rezept, heilmittel_positionen: ... });`
  * *(Hinweis: Ist in `router.js` gar nicht gelistet!)*
* **Aufrufendes Frontend:** Indirekt via [`dashboard.js:15847`](../../dashboard.js#L15847) (`/api/rezept/upload`).
* **Eingabeart:** Text (JSON).
* **Tatsächlich in den Prompt einfließende Felder:**
  * `rez.frequenz`: Rohtext aus Verordnung (z.B. *"2x wtl."*, *"1-2x/Woche"*).
  * `rez.diagnosegruppe`: Rohtext (z.B. *"WS2"*, *"EX"*).
  * `rez.heilmittel`: Rohtext (z.B. *"KG"*, *"Krankengymnastik"*).
  * `rez.ergaenzendes_heilmittel`: Rohtext (z.B. *"Fango"*).
  * `rez.heilmittel_feld_text`: **Kompletter Freitext des Heilmittelfeldes** ([`rezept-normalize.js:64`](../../api-backend/ai/tasks/rezept-normalize.js#L64)).
  * `rez.therapiebereich`: Therapiebereich (`physio`, `podo` etc.).
  * `positionen[]`: Erlaubte Katalogwerte (X-Code, Label, Kategorie).
* **Personenbezug nach Kategorien:**
  * *Patientenname, KVNR, Geburtsdatum, Arzt:* Werden **nicht** übergeben (nur `parsed.rezept` wird übergeben).
  * *Risiko:* `rez.heilmittel_feld_text` ist ein OCR-Freitextfeld vom Arzt, in dem Ärzte gelegentlich handschriftlich Patientennamen oder spezielle Diagnosen notieren (z.B. *"KG für Fr. Müller nach Schenkelhalsfraktur"*).
  * *Gesundheitsdaten:* Diagnosegruppe und Heilmittelart.
* **Aktuelle Maskierung:** **KEINE (0%).** Es wird weder `maskPII` noch `maskMessages` aufgerufen.
* **Entmaskierung (Unmask):** **Nein** (Antwort enthält feste Katalog-Codes).
* **Erforderlichkeit des Personenbezugs:** **Nein (0%)**. Reines String-Matching / Normalisierung.

---

### 2.6 Pfad 6: Legacy B2B Zuweiser-Mail-Agent (`B2B_AGENT_URL`)

* **Datei:Zeile des Aufrufs:** [`dashboard.js:11292`](../../dashboard.js#L11292) in `runMailDraft(...)`.
  * URL definiert in [`dashboard.js:11072`](../../dashboard.js#L11072):
    `const B2B_AGENT_URL = 'https://n8n.infinitymade.de/webhook/b2b-mail-agent';`
* **Backend-Route:** **Keine**. Umgeht das Express-Backend und ruft direkt einen n8n-Webhook auf.
* **Aufrufendes Frontend:** [`dashboard.js:11319-11325`](../../dashboard.js#L11319-L11325) (Button `#aiSendBtn`) und [`:11338-11340`](../../dashboard.js#L11338-L11340) (`#aiVoiceBtn`) im B2B-Zuweiser-Panel.
* **Eingabeart:** Text (JSON).
* **Tatsächlich gesendete Felder:**
  * `action`: `'draft'`
  * `intent`: Freitext des Nutzers
  * `contacts[]` (bis zu 30 Kontakte aus `b2bCache`):
    * `c.id`, `c.company_name`, `c.contact_name`, `c.email`, `c.phone`, `c.notes`
  * `owner_info`:
    * `business_name`, `sender_name`, `city`, `sector`, `extra_context`
* **Personenbezug:** Namen von Ärzten/Zuweisern, Telefonnummern, E-Mails, geschäftliche Notizen, Praxisinhaber-Daten.
* **Aktuelle Maskierung:** **KEINE (0%).**
* **Entmaskierung (Unmask):** **Nein.**
* **Erforderlichkeit des Personenbezugs:** **Nein.**

---

### 2.7 Nicht-KI-Pfade (Klarstellung)

* **`rezept-validate`:**
  * Datei: [`api-backend/ai/tasks/rezept-validate.js:9`](../../api-backend/ai/tasks/rezept-validate.js#L9).
  * Wird über `POST /api/ai/rezept-validate` ([`router.js:20`](../../api-backend/ai/router.js#L20)) oder intern in [`server.js:2468`](../../api-backend/server.js#L2468) aufgerufen.
  * **Führt KEINEN KI-Aufruf aus.** Reines JavaScript-Regelwerk für KBV/G-BA Konformitätsprüfung. Gibt `model: null`, `usage: { total_tokens: 0 }` zurück.
* **`/api/rezept/confirm`:**
  * Datei: [`api-backend/server.js:2487-2650`](../../api-backend/server.js#L2487-L2650).
  * **Führt KEINEN KI-Aufruf aus.** Schreibt nach Bestätigung durch den Nutzer die validierten Daten in Postgres (`prescriptions`, `leads`, `aerzte`).

---

## 3. Analyse von `api-backend/ai/pii-mask.test.js`

In [`api-backend/ai/pii-mask.test.js`](../../api-backend/ai/pii-mask.test.js) existieren exakt **12 Tests**:

### 3.1 Liste der Tests

1. **`auto-detects KVNR`** ([Zeile 15](../../api-backend/ai/pii-mask.test.js#L15)):
   Prüft `\b[A-Z]\d{9}\b` an `"Patient A123456789 hat einen Termin."` -> Ersetzt durch `<<KVNR_1>>`, unmask stellt Original wieder her.
2. **`auto-detects IBAN`** ([Zeile 22](../../api-backend/ai/pii-mask.test.js#L22)):
   Prüft `\b[A-Z]{2}\d{2}[A-Z0-9]{12,30}\b` an `"IBAN DE89... für Überweisung."` -> Ersetzt durch `<<IBAN_1>>`.
3. **`masks explicit name entity`** ([Zeile 28](../../api-backend/ai/pii-mask.test.js#L28)):
   Prüft explizite Entität `{ value: 'Max Mustermann', type: 'NAME' }` -> Ersetzt durch `<<NAME_1>>`, unmask erfolgreich.
4. **`same value gets same placeholder (dedupe)`** ([Zeile 38](../../api-backend/ai/pii-mask.test.js#L38)):
   Prüft, dass wiederholte Nennung desselben Namens denselben Platzhalter `<<NAME_1>>` erhält und `map` nur 1 Eintrag hat.
5. **`multiple entities get unique placeholders`** ([Zeile 47](../../api-backend/ai/pii-mask.test.js#L47)):
   Prüft zwei verschiedene Namen ("Max Mustermann", "Anna Schmidt") -> erhalten `<<NAME_1>>` und `<<NAME_2>>`.
6. **`unmask reverses model output`** ([Zeile 60](../../api-backend/ai/pii-mask.test.js#L60)):
   Simuliert Modell-Antwort mit `<<NAME_1>>` und `<<DATE_1>>` -> `unmask()` setzt Originalwerte wieder ein.
7. **`longest-first ordering avoids substring collisions`** ([Zeile 71](../../api-backend/ai/pii-mask.test.js#L71)):
   Prüft "Anna Schmidt" vs. "Anna" – längere Entität wird zuerst maskiert, damit nicht `<<NAME_2>> Schmidt` entsteht.
8. **`handles empty input`** ([Zeile 85](../../api-backend/ai/pii-mask.test.js#L85)):
   Prüft leeren String `''` -> bleibt unverändert, wirft keinen Fehler.
9. **`masks across system+user messages with shared placeholders`** ([Zeile 93](../../api-backend/ai/pii-mask.test.js#L93)):
   Prüft `maskMessages()` über System- und User-Turns hinweg -> einheitliche Platzhalter über Message-Grenzen.
10. **`preserves multi-part content (vision) — masks text part only`** ([Zeile 108](../../api-backend/ai/pii-mask.test.js#L108)):
    Prüft Vision-Array mit `text` und `image_url` -> Text wird maskiert, Bild-URL bleibt unberührt.
11. **`extracts names + emails + phones from contacts`** ([Zeile 124](../../api-backend/ai/pii-mask.test.js#L124)):
    Prüft Hilfsfunktion `entitiesFromContacts()` bei Objekten mit `name`, `first_name`, `last_name`, `email`, `phone`.
12. **`end-to-end: mask contacts list, unmask response`** ([Zeile 137](../../api-backend/ai/pii-mask.test.js#L137)):
    Prüft vollständigen Zyklus: Kontakte übergeben -> Intent maskieren -> Modellantwort simulieren -> unmaskieren.

### 3.2 Was die Tests abdecken
* Exakte String-Ersetzung explizit übergebener Entitäten.
* KVNR- und IBAN-Regex-Erkennung.
* Konsistente Platzhalter-Vergabe (Deduplizierung).
* Kollisionsvermeidung bei Substrings (Sortierung nach Länge absteigend).
* Rekonstruktion via `unmask()`.
* Message-Array-Formatierung inklusive Multi-Part Vision Payload.

### 3.3 Was die Tests NICHT abdecken (Kritische Lücken)
* **Keine Case-Insensitivity-Tests:** "Müller" vs. "müller".
* **Keine Teilnamens- / Vornamentests:** Wenn nur der Vorname im Freitext steht, schlägt die Erkennung fehl.
* **Keine Prüfung von Telefonnummern im Fließtext:** Werden ohne explizite Entität nicht erkannt.
* **Keine Adress- / Datums- / PLZ-Erkennung im Freitext.**
* **Keine LANR / BSNR Erkennung:** Im Dateikopf von `pii-mask.js:20` versprochen, aber weder implementiert noch getestet.
* **Keine Prompt-Injection- oder Platzhalter-Kollisionstests:** Was passiert bei echtem Nutzertext wie `"Überweise an <<NAME_1>>"`?
* **Keine Formatting-Robustheit beim Unmasking:** Wenn das LLM Leerzeichen, Markdown-Fettung oder typografische Anführungszeichen um den Platzhalter setzt (z.B. `**<<NAME_1>>**` oder `«NAME_1»`).

---

## 4. Schwächen und Verwundbarkeiten von `pii-mask.js`

Die aktuelle Implementierung in [`api-backend/ai/pii-mask.js`](../../api-backend/ai/pii-mask.js) weist fundamentale Schwächen auf, die im produktiven Betrieb zu Re-Identifikation und Datenlecks führen:

1. **Exakte Schreibweise via `split(v).join(...)` ([`pii-mask.js:72`](../../api-backend/ai/pii-mask.js#L72)):**
   * Es findet eine strikte, case-sensitive String-Ersetzung statt.
   * Schreibt der Nutzer *"termin für herrn müller"* oder *"dr. schmidt"*, aber in der Kontaktdatenbank steht *"Müller"* bzw. *"Dr. Schmidt"*, wird der Name **nicht** ersetzt und gelangt im Klartext an die KI.
2. **Vorname vs. Nachname allein:**
   * `entitiesFromContacts` generiert als Entität ausschließlich den vollen Namen (`c.first_name + ' ' + c.last_name`).
   * Im Praxisalltag schreiben Nutzer im Intent typischerweise: *"Schreib Thomas, dass sein Termin ausfällt"* oder *"Frau Meier bitte anrufen"*. Weder *"Thomas"* noch *"Meier"* wird maskiert, weil die Entität *"Thomas Meier"* lautet.
3. **Teilstrings ohne Wortgrenzen (`\b`):**
   * Da `split().join()` keine Wortgrenzen beachtet, werden kurze Namen oder Initialen mitten in deutschen Wörtern ersetzt.
   * Beispiel: Heißt ein Patient *"Ott"*, wird aus dem Wort *"Flott"* plötzlich `Fl<<NAME_1>>`. Heißt jemand *"Mai"*, wird aus *"Termin im Mai"* der Satz *"Termin im <<NAME_1>>"*.
4. **Fehlende Auto-Erkennung für Telefonnummern, Adressen und Geburtsdaten:**
   * `AUTO_PATTERNS` ([`pii-mask.js:25-28`](../../api-backend/ai/pii-mask.js#L25-L28)) enthält **nur** KVNR und IBAN.
   * **Telefonnummern** variieren stark (`+49 170 123456`, `0170/1234567`, `069 - 123 45`). Steht eine Telefonnummer im Freitext des Nutzers, wird sie unmaskiert übertragen.
   * **Geburtsdaten** (`12.04.1985`, `12. April 1985`) und **Adressen** (`Musterstraße 12, 60313 Frankfurt`) werden im Freitext ignoriert.
5. **Versprochene, aber fehlende LANR/BSNR-Erkennung:**
   * Laut Kommentar ([`pii-mask.js:20`](../../api-backend/ai/pii-mask.js#L20)) sollen 9-stellige LANR/BSNR automatisch erkannt werden. Im Code existiert dafür jedoch gar kein Eintrag in `AUTO_PATTERNS`!
6. **Platzhalter-Injection durch Nutzertext:**
   * Gibt ein Nutzer im Freitext böswillig oder zufällig `<<NAME_1>>` ein, verarbeitet `pii-mask.js` dies unkritisch. Beim anschließenden `unmask()` wird dieser Text fälschlicherweise durch den Namen einer anderen Person ersetzt (Cross-Contamination).
7. **Modell verändert Platzhalter (Unmasking schlägt fehl):**
   * LLMs neigen dazu, Tokens leicht abzuändern:
     * Ergänzung von Leerzeichen: `<< NAME_1 >>`
     * Markdown-Formatierung: `**<<NAME_1>>**`
     * Typografische Klammern: `«NAME_1»` oder `<NAME_1>`
     * Übersetzung ins Englische: `<<PATIENT_1>>`
   * Da `unmask()` mit `out.split(p).join(map[p])` exakt nach `<<NAME_1>>` sucht, wird ein modifizierter Platzhalter nicht ersetzt. Die versendete E-Mail enthält dann unbemerkt den rohen Platzhalter-Code.
8. **Grammatikalische Beugung (Deklination):**
   * Im Deutschen werden Namen gebeugt: *"Herrn Müllers Befund"*, *"an Herrn Müller"*.
   * Wird nur *"Herr Müller"* maskiert, bleibt *"Herrn Müllers"* als *"Herrn <<NAME_1>>s"* oder ganz unmaskiert stehen.

---

## 5. Zukünftige KI-Einsatzstellen im Produkt (Text-Aufgaben)

Im Codebase existieren mehrere manuelle, zeitintensive Text-Aufgaben, an denen künftig eine KI mit zentraler Maskierungsschicht erheblichen Mehrwert bietet:

1. **Arztbericht / Verlaufsbericht an den verordnenden Arzt generieren:**
   * **Datei-Bezug:** [`module/abrechnung-freigabe.js:27`](../../module/abrechnung-freigabe.js#L27) (`istBerichtOffen`, `frageBerichtFreigabe`), [`api-backend/ai/tasks/rezept-ocr.js:22`](../../api-backend/ai/tasks/rezept-ocr.js#L22) (`bericht_angefordert`), [`module/sitzungen-ansicht.js`](../../module/sitzungen-ansicht.js).
   * **Konzept:** Der Therapeut dokumentiert Stichpunkte zu den Behandlungseinheiten. Die KI formuliert den formalen Therapiebericht gemäß § 125 SGB V für den Arzt (Zusammenfassung der Befunde, Therapieverlauf, Erreichen des Therapieziels, Empfehlung zur Fortführung).
2. **Kassen-Absetzungen übersetzen & Widerspruchsschreiben entwerfen:**
   * **Datei-Bezug:** [`module/abrechnung-detail.js:728`](../../module/abrechnung-detail.js#L728) (`/billing/abrechnung/zeile/${zeilenId}/absetzung`), [`dashboard.js:164`](../../dashboard.js#L164) (`lf_teilabsetzung`, `lf_abgesetzt`).
   * **Konzept:** Krankenkassen setzen Rechnungszeilen mit kryptischen DTA-Fehlerschlüsseln (z.B. Taxierungsdifferenz, Fristfehler, fehlender ICD) ab. KI übersetzt den Ablehnungsgrund in verständliche Handlungsschritte und generiert auf Knopfdruck ein formelles Widerspruchsschreiben unter Nennung der Heilmittel-Richtlinien.
3. **Mahnwesen: Mehrstufige Mahnungen & Zahlungserinnerungen personalisieren:**
   * **Datei-Bezug:** [`api-backend/billing/api/mahnwesen.routes.js`](../../api-backend/billing/api/mahnwesen.routes.js), [`module/rechnung-ansicht.js`](../../module/rechnung-ansicht.js).
   * **Konzept:** Aktuell existieren statische Vorlagentexte. Eine KI kann je nach Mahnstufe (freundliche Erinnerung, 1. Mahnung, letzte Frist vor Inkasso) patienten- und situationsgerechte Mahnschreiben mit konkreter Zuzahlungs- oder Privatrechnungshistorie formulieren.
4. **Anamnese-Befundung & Verlaufsdokumentation strukturieren:**
   * **Datei-Bezug:** [`module/anamnese.js:82`](../../module/anamnese.js#L82) (`initAnamnese`, `loadAnamnese`), [`module/fussbefund.js:38`](../../module/fussbefund.js#L38) (Podologie-Befund).
   * **Konzept:** Aus ungeordneten Sprachnotizen oder Stichpunkten des Therapeuten wird ein strukturierter Anamnesebogen (SOAP-Format: Subjektiv, Objektiv, Assessment, Plan) generiert.
5. **Automatisierte Terminanfragen- & WhatsApp-Verarbeitung (Warteliste / Nachrücker):**
   * **Datei-Bezug:** [`api-backend/server.js:3029`](../../api-backend/server.js#L3029) (`/api/prescription/lookup-by-phone`), [`module/warteliste-nachruecker.js`](../../module/warteliste-nachruecker.js).
   * **Konzept:** Wenn Patienten per E-Mail oder Messenger absagen ("Kann morgen leider nicht kommen, habe Fieber"), erkennt die KI Absagegrund und Terminbezug, storniert den Slot und bietet ihn automatisch dem nächsten passenden Patienten auf der Warteliste an.

---

## 6. Empfehlungen für die zentrale Maskierungsschicht

1. **Zentralisierung vor `azureClient.chat()`:**
   * Die Maskierung darf nicht in den einzelnen Task-Dateien (`b2c-draft.js`, etc.) liegen, wo sie wie bei `series-scheduler.js` oder `rezept-normalize.js` vergessen werden kann.
   * Sie muss als zwingende Middleware direkt in `api-backend/ai/azureClient.js:86` vor dem HTTP-Dispatch integriert sein.
2. **Namens-Tokenisierung (Vor- und Nachnamen separat erfassen):**
   * Entitäten müssen in Vor- und Nachnamen zerlegt werden, inklusive Case-Insensitive-Regex mit Wortgrenzen (`\b`).
3. **Erweiterung der automatischen Regex-Muster (`AUTO_PATTERNS`):**
   * Deutsche Telefonnummern-Formate (`/(?:\+49|0049|0)\s*(?:\d[\s\-\/]*){6,14}\d/g`).
   * Kalenderdaten im Freitext (`/\b\d{1,2}\.\d{1,2}\.(?:\d{2}|\d{4})\b/g`).
   * LANR / BSNR 9-stellige IDs (`/\b\d{9}\b/g`).
   * ICD-10 Codes (`/\b[A-Z]\d{2}(?:\.\d{1,2})?\b/g`).
4. **Fuzzy-Unmasking:**
   * `unmask()` muss robuste Regex-Ersetzungen für modifizierte Modellantworten unterstützen (z.B. `/<<\s*NAME_1\s*>>/gi`, `/\*\*<<NAME_1>>\*\*/g`, `/«NAME_1»/g`).
5. **Schutz gegen Platzhalter-Injection:**
   * Roher Nutzertext muss vor der Zuweisung von Platzhaltern auf bestehende `<<...>>` Strings gescannt und temporär escaped werden.
