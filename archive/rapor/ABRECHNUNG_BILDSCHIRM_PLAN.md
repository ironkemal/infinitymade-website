# §302-Abrechnung — ein Bildschirm für alle Fachbereiche

> Stand 08.09.2026 · Auftrag Kemal, 08.09.2026 · **Es wurde noch kein Code geändert.**
> Planung in Opus, Ausführung in Sonnet. Vorbefragt: `fonksiyon-ustasi`, `db-ustasi`, `gkv-302`.

## 0. Der Auftrag

> „Faturalandırmaya geldiğinde ilk başta sana iki seçenek sunacak. Yeni kes, eskilerini gör.
> Yeni kes deyince … krankenkasselere göre gösterecek, hepsinin yanında checkbox olacak …
> Eskilerine bak deyince … üstte maviler, altta yeşiller ve kırmızılar, sarı yarı reddedilmiş.
> Üst yarıda liste, alt yarıda tıklananın bilgileri." — Kemal, 08.09.2026

Dazu drei am selben Tag entschiedene Punkte:

1. **Podologie zieht um.** Der §302-Teil verlässt „Podologie-Abrechnung"; dieser Bildschirm
   heisst danach „Behandlungen" und trägt nur noch Tagesbehandlung + Verordnungsliste.
2. **Keine eigene Taxierungs-Stufe.** Positionswahl und Zuzahlung stehen in der aufklappbaren
   Kassenzeile, wie heute schon in der Podologie.
3. **Zahlungsverfolgung mit Teilbeträgen.** „Bezahlt" fragt nach dem Betrag; was offen bleibt,
   bleibt sichtbar. Und: ein einzelner abgesetzter Beleg muss erneut eingereicht werden können.

## 1. Was heute wirklich da ist

| | Physio / Ergo / Logo | Podologie |
|---|---|---|
| Bildschirm | `#panel-abrechnung`, 4-Stufen-Assistent | `#panel-podologie-billing` |
| Auswahl | je **Rezept** eine Checkbox, eine Kasse zur Zeit | je **Kasse** eine Checkbox, Mehrfachauswahl |
| Dateieinheit sichtbar | nein | ja (`module/podologie-dateieinheit.js`) |
| Aufklappbare Detailzeile | nein (Tabelle immer offen) | ja |
| Historie | Stufe 4, Tabelle | **gar nicht** |
| Datei herunterladen | ja | **nein** — der Podologe kommt an seine DTA-Datei nicht heran |
| Endpunkt | `POST /abrechnung/create` | `POST /abrechnung/create-podologie` |

Beide lesen dieselbe Tabelle (`prescriptions`, seit 04.09.2026 ein Topf), beide erzeugen dieselbe
Zeile in `abrechnung`. Die Trennung ist historisch, nicht fachlich.

**Drei Befunde, die den Plan geformt haben:**

- **Es gibt heute nirgends eine Zeilenliste einer Abrechnung.** Der Bildschirm liest nur
  `prescription_count`. Die untere Hälfte („welche Patienten stecken in dieser Datei") wird zum
  ersten Mal überhaupt gebaut — und würde aus `prescriptions.abrechnung_id` abgeleitet ab Tag eins
  falsch sein, sobald ein Beleg korrigiert und neu eingereicht wird. Siehe Phase 2.
- **Seit 07.09.2026 enthält EINE Datei mehrere Gesamtrechnungen** (je Karten-IK eine,
  `dta/builder.js:514`). Geld kommt also je Gesamtrechnung, nicht je Datei. Die Gruppierung wird
  erzeugt, in den Begleitzettel gedruckt und danach **weggeworfen** — sie steht in keiner Tabelle.
- **`abrechnung.status='paid'` und `paid_at` schreibt niemand.** Zahlungsverfolgung existiert nicht.

## 2. Harte Grenzen — `gkv-302`, drei Vetos

Diese drei sind nicht verhandelbar und formen die Oberfläche, nicht nur den Server.

### V1 ⛔ Ein abgesetzter Beleg geht mit **VKZ 04 + URI**, niemals still in die nächste Rechnung

Anlage 1 TP5 V21 Kap. 7.4.3 · Korrekturverfahren Nr. 3 (13.02.2025):
> „In diesen Fällen muss die Korrektur gegen die Rechnungskürzung **immer zwingend mit dem VKZ 4**
> eingereicht werden."

Heute macht `abrechnung.routes.js:1090-1101` das Gegenteil: das abgesetzte Physio-Rezept geht auf
`bereit` zurück und landet in der nächsten **Erstrechnung (VKZ 01)**. Für die Kasse ist das
derselbe Beleg zum zweiten Mal — Doppelabrechnung. Entweder Absetzung (kein Geld) oder Zahlung mit
späterer Rückforderung. Der Bildschirm darf diesen Weg nicht anbieten und nicht fortschreiben.

Zwei Ausnahmen, in denen **VKZ 01** richtig bleibt: die ganze Rechnung wurde wegen fehlender
Urbelege abgesetzt (Nr. 21), oder der Datensatz war nicht TA-konform und wurde abgewiesen (Nr. 22).

### V2 ⛔ Zwei Rot, nicht eines

| Was | Wo geprüft | Richtige Antwort |
|---|---|---|
| **Datei abgewiesen** — Syntax, Lesbarkeit, Schlüssel | Prüfstufe 1–3, Annahmestelle | Nichts gilt als eingereicht. Korrigieren, **VKZ 01** erneut. URI verboten. |
| **Beleg abgesetzt** — Inhalt | Prüfstufe 4, Kasse | Nur dieser Beleg, **VKZ 04 + URI**, eigene Datei. |

Anlage 1 V21 §7.2: Korrekturverfahren setzt voraus, dass die Ursprungsrechnung die Prüfstufen 1–3
fehlerfrei durchlaufen hat. Wer die beiden Rot verwechselt, holt entweder Geld nicht zurück oder
fordert doppelt.

### V3 ⛔ Eine Datei trägt genau ein Verarbeitungskennzeichen

Anlage 1 V21 Kap. 7.3, letzte zwei Sätze:
> „Innerhalb einer Datei dürfen nicht verschiedene Verarbeitungskennzeichen genutzt werden.
> Je Verarbeitungskennzeichen ist eine eigene Datei zu übermitteln."

Dazu §5.3 (5) eine Rechnungsart je Datei, (6) eine TA-Version je Datei, §5.3.2 kein Mischen von
Einzel- und Sammelrechnungen. **Folge für die Oberfläche:** „Ausgewählte erstellen" darf Neu- und
Korrekturrechnungen nie in denselben Lauf nehmen. Getrennte Listen, getrennte Knöpfe.

## 3. Weitere fachliche Festlegungen (`gkv-302`)

- **Soll = `total_eur − zuzahlung_total`** (Anlage 1 V21 §5.5.2, GES). Je **Gesamtrechnung**,
  nicht je Datei.
- **Absetzungen werden vom Soll NICHT abgezogen.** Sonst verschwindet das Geld, das mit VKZ 04
  zurückzuholen wäre, aus dem Bildschirm. Anzeige: `Eingereicht · Abgesetzt · Bezahlt · **Offen**`.
- **Die ZAA-Datei trägt keine Beträge.** In Anlage 1 V21 kommen `Zahlungsavis`, `Absetzung`,
  `Buchung` **kein einziges Mal** vor — Prüfstufe 4 ist kassenspezifisch, es gibt keinen Standard.
  Absetzungsbeträge und Zahlungen werden **von Hand** erfasst. Der bestehende Kommentar in
  `abrechnung.routes.js:1085-1089`, der genau davor warnt, bleibt gültig.
- **Zahlungsfrist 4 Wochen** ab Eingang der vollständigen Unterlagen (Richtlinien-Text 20.11.2006
  § 7 Abs. 2), sofern der Vertrag nichts anderes sagt → Fälligkeitsanzeige im Archiv.
- **Dateieinheit = Datenannahmestelle × Kassenart**, nicht Fachbereich. Alle vier Heilmittel sind
  Leistungsbereich `B`; der Abrechnungscode (22/23/26/71) steht am Beleg (`EHE`), nicht an der
  Datei. Physio und Podologie **dürften** technisch in einer Datei stehen; getrennt werden sie,
  weil die Abrechnungscode-Kette zu unterschiedlichen Annahmestellen auflöst.
- **Je Gesamtrechnung ein Begleitzettel** (Anlage 4 V2.0, Allgemeines (2)) — gilt auch für
  Physio/Ergo/Logo, nicht nur für die Podologie.
- **Belegnummer** muss nur *innerhalb einer Gesamtrechnung* eindeutig sein. Unser Einfrieren ist
  richtig und hilfreich (die URI braucht die ursprüngliche Nummer), aber die Begründung im Code
  (`abrechnung.routes.js:277-281`) zitiert die falsche Stelle: Kap. 7.3 spricht über den
  **URI-Inhalt**, nicht über `INV.Belegnummer`. Kommentar korrigieren, Verhalten behalten.

## 4. Datenmodell — `db-ustasi`

Zwei neue Tabellen. Die vollständige Migration (Spalten, CHECKs, Indizes, Trigger, RLS) liegt im
Bericht von `db-ustasi`; hier steht, **warum** sie so aussehen.

### `abrechnung_zeile` — was tatsächlich rausging, eingefroren

Nicht `abrechnung_position` nennen: „Position" heisst in diesem Code die **Positionsnummer/HPNR**
(`heilmittel_position`, `services.gkv_position_nr`, `GET /positions`). Der Name hat schon einmal
eine Suche in die Irre geführt.

Warum ein Schnappschuss und keine n:m-Verbindungstabelle: eine Verbindungstabelle zeigt die
**lebende** Zeile. Wird ein abgesetztes Rezept korrigiert (andere Position, andere Einheiten) und
neu eingereicht, zeigte die alte Datei rückwirkend die **heutigen** Zahlen unter dem Datum von
gestern. Das ist die teurere Lüge. Ausserdem:

| | Schnappschuss | Verbindungstabelle |
|---|---|---|
| Leser von `prescriptions.abrechnung_id` (6) | 0 Änderungen | alle |
| Schreiber (4) | +1 INSERT | 4 umschreiben |
| Hält den eingereichten Betrag fest | ✅ | ❌ |
| Quelle für VKZ 04 („nicht zuvor vergütete Positionen") | ✅ | ❌ |

`prescriptions.abrechnung_id` **bleibt** und heisst weiter „in welcher Datei liegt die Zeile
gerade" (Arbeitsachse). `abrechnung_zeile` ist die Geschichtsachse. Nicht zusammenlegen.

Die Zeile trägt zusätzlich `karten_ik` + `einzel_rechnungsnummer` — die Gesamtrechnungs-Gruppe,
die seit 07.09.2026 im DTA entsteht und bisher nur als HTML im Storage lag. Die Sitzungen kommen
als `leistungen jsonb` mit (`{datum, positionsnummer, anzahl, einzelbetrag}`), weil VKZ 04 auf
Positionsebene arbeitet. Gleiches Muster wie `invoices.line_items`.

GoBD: `trg_abrechnung_zeile_festschreibung` blockt DELETE ganz und jede Änderung an Identität und
Betrag. Offen bleiben `status`, `absetzung_*` — und das **Nullen** (nicht Ändern) von
`patient_name`/`versichertennummer`. Diese Ausnahme ist Absicht: bei `invoices` blockiert die
Festschreibung die Anonymisierung und hält damit die ganze DSGVO-Löschkette an
(Kopf von `api/dsgvo.js`). Dieser Fehler wird hier nicht wiederholt.

### `abrechnung_zahlung` — Geldeingang, append-only

Zwei Spalten auf `abrechnung` reichen nicht, aus vier Gründen: die Kasse zahlt in Raten; eine Datei
trägt mehrere Gesamtrechnungen; ein UPDATE auf einen Summenwert löscht den vorherigen Stand
(§ 146 Abs. 4 AO); und „noch nicht da" ist nicht dasselbe wie „kommt nie".

Dritte Tabelle dieser Familie nach `belegliste` und `zuzahlung_korrekturen` — gleiches Muster,
gleiche Sperre. Korrektur = neue Zeile mit `art='korrektur'` und negativem Betrag.

⛔ **Kein Beleg in `belegliste`.** Kassengeld ist eine Bankbewegung, kein Kassenbuchvorgang.
`belegliste.type` ist patientenseitig (`zuzahlung, barverkauf, storno, ausfall`), und
`statistik.routes.js:188-205` summiert die Belegliste **ungefiltert** in die Umsatzreihe, während
der GKV-Umsatz dort bereits aus `abrechnung.total_eur` kommt — ein Beleg hier zählt den Umsatz
doppelt. Und ein `prescription_id` daran liesse die Zuzahlung des Patienten als bezahlt gelten und
das Mahnwesen verstummen.

`status='paid'` setzt **nur** der Trigger, wenn `bezahlt >= (Soll − Absetzung) − 0,005`. Die
Toleranz stammt wörtlich aus `istZuzahlungBezahlt()` — „bezahlt" hat in diesem Projekt eine
Definition. `paid_at` ist das **Datum der Zahlung** (Wertstellung), nicht `now()`.

Der Knopf „abschliessen" ist kein Status-Flip, sondern eine Zeile mit `art='abschreibung'` und
Pflichtbegründung. So bleibt der Grund für fehlendes Geld erhalten.

## 5. Zielbild

```
§302-Abrechnung
├── Einstieg (Standardansicht)
│   ├── [ Neue Abrechnung ]         23 Rezepte bereit · 4.120,00 €
│   └── [ Bisherige Abrechnungen ]  2 offen · 1 abgesetzt · 860,00 € offen
│
├── Ansicht „Neu"
│   ├── Sammelleiste: „5 Kassen · 5 Dateien · 5 Begleitzettel · an 2 Annahmestellen"
│   └── je Kostenträger eine Zeile:
│       [x] AOK Rheinland/Hamburg  [Kassenart · DAV-IK]  118 Verordnungen · 12.480,00 €  [Erstellen]
│           └─ aufgeklappt: Beleg · Patient · Mittel (Positionswähler) · Einheiten ·
│                           Zuzahlung · Kassenanteil
│       [x] BKK Mercedes           …                       2 Verordnungen ·    240,00 €  [Erstellen]
│       └── Fehlerhafte Rezepte (eigener Block, je Zeile „Trotzdem übernehmen" mit Begründung)
│
└── Ansicht „Bisherige"  (obere Hälfte / untere Hälfte, wie `panel-verordnungen`)
    ├── oben: Dateiliste, sortierbar, „offen zuerst"
    │     🔵 offen        gesendet, wartet auf Antwort   (+ Fälligkeit: Eingang + 28 Tage)
    │     ⚪ zu tun       erstellt / heruntergeladen, noch nicht eingereicht
    │     🟢 angenommen   ZAA sauber   → Zahlung: eingegangen ✓ / teilweise / offen
    │     🟡 teilweise    rejected_count 1 … n-1
    │     🔴 abgesetzt    rejected_count = n            (Beleg-Absetzung, Prüfstufe 4)
    │     🔴 abgewiesen   Datei abgewiesen              (Prüfstufe 1–3) — anderes Rot, anderer Weg
    └── unten: die gewählte Datei
          Kopf:  Rechnungsnummer · Rechnungsdatum · Annahmestelle · Zeitraum · Belege
          Geld:  Eingereicht 1.240,00 € · Abgesetzt 138,00 € · Bezahlt 1.102,00 € · Offen 0,00 €
          Zeilen: je Gesamtrechnung (Karten-IK) eine Gruppe, darin die Belege
          Aktionen: DTA · Begleitzettel · Signieren · ZAA hochladen · Zahlung erfassen
                    je abgesetzter Zeile: „Korrekturrechnung erstellen (VKZ 04)"
```

## 6. Phasen

Jede Phase ist für sich fertig und einzeln auslieferbar (`main` direkt, keine halben Bildschirme).

> **Ausführungsreihenfolge: 0 → 1 → 2 → 3 → 5 → 4** (Kemal, 08.09.2026). Das Korrekturverfahren
> kommt vor der Zahlungsverfolgung — siehe Abschnitt 8. Die Abschnittsnummern unten bleiben
> unverändert, damit Verweise gültig bleiben.

### Phase 0 — Unterbau, kein sichtbares Verhalten

| # | Was | Warum |
|---|---|---|
| 0.1 | `module/geld.js` — `fmtEur`, `parseEur` | Heute **5 Definitionen**, davon eine (`formatEur`, `dashboard.js:14877`) **ohne Tausenderpunkt**: `1234,50 €` statt `1.234,50 €`. Auf einem Rechnungsbildschirm nicht hinnehmbar. Neuer Code speist sich ausschliesslich hieraus; die alten wandern beim Anfassen mit, nicht auf einmal. |
| 0.2 | `module/abrechnung-status.js` — Rosette der **Datei**achse | `abrechnungsstatus.js` kennt nur die **Verordnungs**achse und lässt unbekannte Schlüssel still auf `aktiv` = rotes „In Behandlung" fallen (`statusInfo()`, Zeile 133). `erstellt`/`gesendet`/`paid` würden alle rot. Innere Wortliste nach Anlage 3 TP5 V21 §8.1.9 (`01 bezahlt · 02 zurückgewiesen · 03 berichtigt · 04 gekürzt · 05 wird geprüft`) — ⚠️ als **eigenes** Vokabular, dieser Schlüssel wird von der Kasse nicht geliefert. Kopfkommentar muss die Abgrenzung zu `abrechnungsstatus.js` benennen. |
| 0.3 | kleiner Ansichtsumschalter (Einstieg / Neu / Bisherige) | `setWizardStep()` **nicht** benutzen — hängt am 4-Stufen-Assistenten und schreibt in `_abState`. Es gibt bereits **sechs** handgeschriebene Umschalter im Projekt; dies wird nicht der siebte, sondern ein Helfer in `module/`. |

### Phase 1 — Einstieg + Ansicht „Neu", beide Fachbereiche

- `module/abrechnung-auswahl.js`: **eine** gruppierte Auswahlliste für beide Zweige.
  Parameter `granularitaet: 'kasse' | 'rezept'` — die Podologie hakt Kassen an, Physio Rezepte;
  beides muss erhalten bleiben, sonst verliert eine Seite eine Funktion.
- Bestandteile werden **mitgenommen, nicht neu geschrieben**:
  `podologie-dateieinheit.js` (Dateieinheit-Abzeichen, „wie viele Dateien und Umschläge"),
  `abrechnung-freigabe.js` (Therapiebericht-Prüfung, harter Riegel),
  `belegnummer.js`, `zuzahlung-rechnen.js`, `standort-zuschnitt.js`.
- Der Dateieinheit-Hinweis gilt ab jetzt **auch für Physio/Ergo/Logo** — dort fehlte er.
- **Beide alten Auswahllisten werden abgeklemmt**, sobald die neue steht. Kein dritter Weg, der
  „später" aufgeräumt wird; genau so ist die Doppelung `prescriptions`/`verordnungen` entstanden.
- `nav-registry.js`: Podologie bekommt `abrechnung`; `podologie-billing` heisst „Behandlungen".
- Endpunkte bleiben unangetastet: `/abrechnung/create` bzw. `/create-podologie`, Auswahl per
  `therapie_bereich`.

**Fertig, wenn:** Podologe und Physiotherapeut denselben Bildschirm sehen, beide mehrere Kassen
auf einmal abrechnen können, beide vor dem Klick lesen, wie viele Dateien und Umschläge entstehen.

### Phase 2 — Schema + Server, noch ohne neue Oberfläche

Bewusst **vor** dem Archiv: die untere Hälfte aus `prescriptions.abrechnung_id` zu bauen hiesse,
einen Bildschirm auszuliefern, von dem wir wissen, dass er Zeilen verschwinden lässt.

1. Migration `abrechnung_zeile_und_zahlung` (Entwurf liegt vor) — danach **im selben Commit**:
   `db/SCHEMA.sql` + `SCHEMA-RLS.sql` neu erzeugen, `db/REGISTER.md` (Texte liegen vor),
   `node tools/tabellenkarte.mjs`.
2. `/abrechnung/create` (~842) und `/create-podologie` (~2680): `abrechnung_zeile` einfügen —
   **als letzter Schritt**, nach allen Rollback-Punkten. Die Daten liegen schon ausgerichtet vor
   (`rxRows` + `dta.gruppen[]` + `belege[]`, gleicher Index, siehe Kommentar bei `:795-800`).
3. `/abrechnung/:id/upload-zaa`: über die bestehende `belegToRxId`-Karte auch `status` und
   `absetzung_grund`/`absetzung_am` der Zeile setzen. **Betrag nicht** — die ZAA kennt keine.
4. Neu: `GET /abrechnung/:id/zeilen`, `GET/POST /abrechnung/:id/zahlung`.
   VPS-Backend, das Vercel-Limit (12/12) bleibt unberührt.
5. `api/dsgvo.js`: beide Tabellen in `USER_TABLES` (`owner_id`); `abrechnung_zeile` zusätzlich in
   `ANONYMIZE_TABLES` (`patient_name`, `versichertennummer` nullen). **Nicht** in `DELETE_TABLES`
   (§302/§304 SGB V) — mit Begründung im Kommentar.
6. Rückstand: für bestehende Dateien lassen sich Zeilen aus `prescriptions` rekonstruieren, aber
   das ist **nicht das eingefrorene Original** → `herkunft='rekonstruiert'`, Stichtag in REGISTER.
   Vorher `count(*)` messen.

**Fertig, wenn:** eine neu erzeugte Abrechnung ihre Zeilen in `abrechnung_zeile` hat, ein
ZAA-Upload sie als abgesetzt markiert, und `node --test module/*.test.js` grün ist.

### Phase 3 — Ansicht „Bisherige" (obere/untere Hälfte)

- `module/abrechnung-verlauf.js` (Liste) + `module/abrechnung-detail.js` (untere Hälfte).
  Muster: `panel-verordnungen` (`verordnung-liste.js` + `verordnung-detail.js`, Kopplung über
  `module/signal.js`). Es gibt keine wiederverwendbare Hülle — entweder dem Muster folgen oder
  eine Hülle herausziehen, aber **keine dritte Handschrift**.
- Sortierung: Vorgabe „offen zuerst, dann Datum absteigend"; Klick auf eine Spaltenüberschrift
  schaltet auf reine Spaltensortierung. Einziges Vorbild im Projekt: `docSortCity`
  (`dashboard.js:13665`) — Muster übernehmen, `.sortable` hat noch nicht einmal CSS.
- **Zwei Rot** (V2) müssen in Farbe, Text und angebotener Aktion unterscheidbar sein.
- Untere Hälfte gruppiert nach Gesamtrechnung (Karten-IK), darin die Belege.
- `downloadAbrechnungFile()` zieht mit um, wird nicht neu geschrieben — damit bekommt die
  Podologie ihren Datei-Download zum ersten Mal.

**Fertig, wenn:** eine Datei anklickbar ist und unten Kopf, Geldzeile und alle Belege stehen; die
Podologie ihre DTA-Datei herunterladen kann.

### Phase 4 — Zahlungsverfolgung

- „Zahlung erfassen" → Betrag + Datum (Wertstellung) + optional Gesamtrechnung + Notiz.
  Umsetzung über `showHtmlModal` (`dashboard.js:22030`, `afterRender` + `onConfirm` mit Prüfung).
  **Kein neues Modal-Gerüst** und kein weiteres handgebautes Overlay wie in
  `abrechnungsstatus.js:485`.
- Absetzungsbetrag je Zeile von Hand aus dem Absetzungsschreiben — mit Pflichtbegründung.
- Anzeige immer vierteilig: `Eingereicht · Abgesetzt · Bezahlt · Offen`.
- Fälligkeit: Einreichung + 28 Tage (Richtlinien § 7 Abs. 2), überfällig hervorheben.

**Fertig, wenn:** „10 eingereicht, 1 abgesetzt, 9 bezahlt" als vier Zahlen ablesbar ist und ein
zweiter Teilbetrag die erste Zahlung nicht überschreibt.

### Phase 5 — Korrekturverfahren (VKZ 04 + URI)

Die eigentliche Antwort auf „wie schicken wir den Patienten nochmal". Grösster Brocken, eigener
Schritt, eigener Test.

1. `abrechnung` um die URI-Felder erweitern: `rechnungsdatum`, `einzel_rechnungsnummer`,
   `absender_ik`, `empfaenger_ik`, `kassenart`, `verarbeitungskennzeichen`,
   `datenaustauschreferenz`, `zeitraum_von/bis`. **Drei der fünf URI-Felder fehlen heute
   vollständig** — ohne sie ist eine Korrekturrechnung nicht erzeugbar.
2. `POST /abrechnung/korrektur`: nimmt `abrechnung_zeile`-IDs, baut **eine eigene Datei** mit
   `vkz='04'` und URI-Segment. `dta/builder.js:139-146` kann die URI bereits — es fehlt nur der
   aufrufende Weg.
3. `upload-zaa`: den stillen Rücksprung auf `bereit` (Zeile 1090-1101) **entfernen**. Stattdessen
   wie in der Podologie `abgesetzt` + Grund + Datum, und die Korrektur ist eine bewusste Handlung.
4. Oberfläche: je abgesetzter Zeile „Korrekturrechnung erstellen (VKZ 04)"; getrennte Liste,
   getrennter Lauf (V3).
5. Die beiden VKZ-01-Ausnahmen (Nr. 21 Urbelege fehlten, Nr. 22 Datei abgewiesen) brauchen einen
   eigenen, benannten Weg — nicht denselben Knopf.

**Fertig, wenn:** eine abgesetzte Zeile eine eigene VKZ-04-Datei mit korrekter URI erzeugt, und der
alte stille Retry im Code nicht mehr existiert.

## 7. Nebenbefunde — nicht dieser Bildschirm, aber dieselbe Datei

| Was | Fundstelle | Warum es zählt |
|---|---|---|
| `Datenaustauschreferenz` springt jeden 1. Januar auf 1 zurück und stammt aus `COUNT(*)` | `abrechnung.routes.js:664-670` | Anlage 1 V21 §5.4 (UNB 0020) verlangt eine durchlaufende Nummer je Absender/Empfänger, Rücksprung nur bei 99999. §7.2 hängt die Reihenfolge der Korrekturen daran. Lösung: dauerhafter Zähler (Muster `nummernkreise`). |
| `buildSammelRechnungsnummer` zählt Zeilen statt einen Zähler zu führen | `abrechnung.routes.js:61-63` | §5.5.2 REC verlangt Eindeutigkeit **über alle Jahre**. Eine gelöschte Zeile erzeugt dieselbe Nummer erneut. Mit dem Zähler oben gemeinsam zu lösen. |
| Kommentar zur Belegnummer zitiert die falsche Stelle | `abrechnung.routes.js:277-281` | Kap. 7.3 spricht über den URI-Inhalt, nicht über `INV.Belegnummer`. Verhalten richtig, Begründung falsch. |
| `abrechnung.owner_id → auth.users` **ON DELETE CASCADE** | `db/SCHEMA.sql:155` | `db/REGISTER.md` sagt, `abrechnung` stehe bewusst nicht in der Löschliste (§302/§304). Das schützt sie nicht: `api/dsgvo.js:373` löscht am Ende den Auth-Benutzer, und die Kaskade nimmt die gesamte §302-Historie mit. → `legal-de` + `guvenlik`. |
| Planschranke | `dashboard.js:1035` | `abrechnung` hängt an `has302Access()` (Professional+), `podologie-billing` **nicht**. Nach dem Umzug verliert ein Podologe im Starter-Tarif den §302-Zugang. Offene Entscheidung, siehe unten. |

## 8. Entscheidungen (Kemal, 08.09.2026)

1. ✅ **Planschranke gilt auch für die Podologie.** Eine Regel, kein Sonderweg: §302 ist
   Professional+ (`has302Access()`), und das gilt nach dem Umzug für alle vier Fachbereiche.
   **Geprüft (08.09.2026, live DB):** genau ein Podologie-Profil steht auf `plan='starter'`
   (von 2 Podologie-Owners insgesamt). Es ist unkritisch: `plan_status='pending'` (Onboarding/
   Zahlung nie abgeschlossen, angelegt 25.06.2026), 12 Verordnungen, **0 Abrechnungen** — die
   §302-Funktion wurde von diesem Konto nie genutzt. Der Umzug nimmt niemandem etwas weg, das
   er heute tatsächlich tut.
2. ✅ **Reihenfolge: 0 → 1 → 2 → 3 → 5 → 4.** Korrekturverfahren **vor** der Zahlungsverfolgung.
   Sonst entsteht ein Bildschirm, der offenes Geld anzeigt, ohne einen Weg anzubieten, es zu holen —
   und der stille VKZ-01-Retry (V1) bliebe eine Phase länger scharf.
   Die Nummerierung der Abschnitte bleibt wie sie ist; nur die Ausführung tauscht 4 und 5.
3. ✅ **Alte Dateien werden rekonstruiert**, sichtbar als `herkunft='rekonstruiert'` markiert.
   **Geprüft (08.09.2026, live DB):** 12 Zeilen in `abrechnung` insgesamt, alle bereits
   eingereicht (keine einzige nur `status='erstellt'`), zusammen 27 Verordnungen,
   Zeitraum 05.01.2026 – 03.06.2026. Klein genug, um risikolos in Phase 2 mitzulaufen —
   keine gesonderte Migration nötig.

## 9. Regeln, die für jede Phase gelten

- `dashboard.js` wächst nicht. Neuer Code nach `module/` (Torwächter: `.githooks/pre-commit`).
- Kein neuer Vercel-Endpunkt (12/12 belegt), kein neuer n8n-Ablauf, kein neues CDN (G8).
- Texte dreisprachig — `ab_*` liegt in `dashboard.js` de/en/tr, ~15 neue Schlüssel.
- Keine festen Farben; `--bg-card-solid`, `--text-main`.
- Kein `<datalist>`; die gemeinsamen Wähler benutzen.
- Nach jeder Phase: `node --test module/*.test.js`, `npm run probe`, dann `canli-test`.
- Nach jeder Phase: `fonksiyon-ustasi` bekommt **warum + wo** gemeldet, danach „harita güncelle".
- Schema anfassen heisst: Dump im selben Commit erneuern, REGISTER schreiben, Tabellenkarte neu.

---

# Anhang A — Migration `abrechnung_zeile_und_zahlung`

Entwurf von `db-ustasi`, 08.09.2026. **Noch nicht angewendet.** Vor dem Anwenden Phase 2 lesen:
der INSERT gehört ans Ende der beiden create-Routen, nach allen Rollback-Punkten.

```sql
-- ─────────────────────────────────────────────────────────────────────────
-- 1) Eingereichte Zeilen — Schnappschuss, kein Zeiger auf lebende Daten.
-- ─────────────────────────────────────────────────────────────────────────
create table public.abrechnung_zeile (
  id                     uuid primary key default gen_random_uuid(),
  abrechnung_id          uuid not null references public.abrechnung(id)    on delete restrict,
  owner_id               uuid not null references public.profiles(id)      on delete restrict,
  business_id            uuid          references public.businesses(id)    on delete set null,
  prescription_id        uuid          references public.prescriptions(id) on delete set null,

  -- Gesamtrechnungs-Gruppe innerhalb der Datei (dta/builder.js -> gruppen[])
  kostentraeger_ik       text not null,
  karten_ik              text,
  einzel_rechnungsnummer text not null,
  sort_order             smallint not null default 0,

  -- eingefrorener Urbeleg
  belegnummer            text,
  patient_name           text,
  versichertennummer     text,
  verordnungsdatum       date,
  therapie_bereich       text,
  heilmittel_position    text,
  anzahl_einheiten       integer,
  leistungen             jsonb not null default '[]'::jsonb,  -- [{datum,positionsnummer,anzahl,einzelbetrag}]
  brutto_eur             numeric(10,2) not null default 0,
  zuzahlung_eur          numeric(10,2) not null default 0,
  netto_eur              numeric(10,2) not null default 0,     -- = Soll gegen die Kasse

  -- Rueckmeldeachse: bleibt offen
  status                 text not null default 'eingereicht',
  absetzung_eur          numeric(10,2) not null default 0,
  absetzung_grund        text,
  absetzung_am           date,

  herkunft               text not null default 'einreichung',
  created_at             timestamptz not null default timezone('utc', now()),
  updated_at             timestamptz not null default timezone('utc', now()),

  constraint abrechnung_zeile_status_check
    check (status in ('eingereicht','akzeptiert','abgesetzt','teilabgesetzt','nachgereicht')),
  constraint abrechnung_zeile_herkunft_check
    check (herkunft in ('einreichung','rekonstruiert')),
  constraint abrechnung_zeile_absetzung_betrag
    check (absetzung_eur >= 0 and absetzung_eur <= netto_eur),
  constraint abrechnung_zeile_absetzung_grund
    check (absetzung_eur = 0 or btrim(coalesce(absetzung_grund,'')) <> '')
);

create unique index abrechnung_zeile_uniq
  on public.abrechnung_zeile (abrechnung_id, prescription_id) where prescription_id is not null;
create index idx_abrechnung_zeile_datei
  on public.abrechnung_zeile (abrechnung_id, einzel_rechnungsnummer, sort_order);
create index idx_abrechnung_zeile_rx
  on public.abrechnung_zeile (prescription_id) where prescription_id is not null;
create index idx_abrechnung_zeile_beleg
  on public.abrechnung_zeile (owner_id, belegnummer);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Zahlungseingaenge — append-only, wie belegliste / zuzahlung_korrekturen.
-- ─────────────────────────────────────────────────────────────────────────
create table public.abrechnung_zahlung (
  id                     uuid primary key default gen_random_uuid(),
  abrechnung_id          uuid not null references public.abrechnung(id) on delete restrict,
  owner_id               uuid not null references public.profiles(id)   on delete restrict,
  business_id            uuid          references public.businesses(id) on delete set null,
  einzel_rechnungsnummer text,                       -- NULL = Zahlung fuer die ganze Datei
  art                    text not null default 'zahlung',
  betrag_eur             numeric(10,2) not null,     -- negativ erlaubt (Ruecklastschrift/Korrektur)
  datum                  date not null,              -- Wertstellung laut Kontoauszug
  zahlungsavis           text,
  notiz                  text,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default timezone('utc', now()),

  constraint abrechnung_zahlung_art_check
    check (art in ('zahlung','ruecklastschrift','abschreibung','korrektur')),
  constraint abrechnung_zahlung_betrag_check check (betrag_eur <> 0),
  constraint abrechnung_zahlung_grund_check
    check (art = 'zahlung' or length(btrim(coalesce(notiz,''))) >= 3)
);

create index idx_abrechnung_zahlung_datei on public.abrechnung_zahlung (abrechnung_id, datum);
create index idx_abrechnung_zahlung_owner on public.abrechnung_zahlung (owner_id, datum desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) GoBD-Sperren. Eigene Funktionen je Tabelle, damit die Fehlermeldung
--    den richtigen Korrekturweg nennt (Muster: prevent_belegliste_mod()).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.fn_abrechnung_zeile_festschreibung()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Eine eingereichte Abrechnungszeile kann nicht geloescht werden (GoBD, §302 SGB V). Korrektur: neue Einreichung (VKZ 04).';
  end if;

  if new.abrechnung_id          is distinct from old.abrechnung_id
  or new.prescription_id        is distinct from old.prescription_id
  or new.kostentraeger_ik       is distinct from old.kostentraeger_ik
  or new.karten_ik              is distinct from old.karten_ik
  or new.einzel_rechnungsnummer is distinct from old.einzel_rechnungsnummer
  or new.belegnummer            is distinct from old.belegnummer
  or new.verordnungsdatum       is distinct from old.verordnungsdatum
  or new.heilmittel_position    is distinct from old.heilmittel_position
  or new.anzahl_einheiten       is distinct from old.anzahl_einheiten
  or new.leistungen             is distinct from old.leistungen
  or new.brutto_eur             is distinct from old.brutto_eur
  or new.zuzahlung_eur          is distinct from old.zuzahlung_eur
  or new.netto_eur              is distinct from old.netto_eur
  or new.herkunft               is distinct from old.herkunft
  then
    raise exception 'Eingereichte Abrechnungszeile ist festgeschrieben (GoBD). Offen bleiben nur status, absetzung_* und die Anonymisierung.';
  end if;

  -- DSGVO Art. 17: Klarname darf GENULLT, aber nie geaendert werden.
  -- Bewusst anders als invoice_festschreibung(), das die Anonymisierung
  -- blockiert und damit die ganze Loeschkette anhaelt (api/dsgvo.js Kopf).
  if new.patient_name is not null and new.patient_name is distinct from old.patient_name then
    raise exception 'patient_name darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;
  if new.versichertennummer is not null and new.versichertennummer is distinct from old.versichertennummer then
    raise exception 'versichertennummer darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end $$;

create trigger trg_abrechnung_zeile_festschreibung
  before update or delete on public.abrechnung_zeile
  for each row execute function public.fn_abrechnung_zeile_festschreibung();

create or replace function public.prevent_abrechnung_zahlung_mod()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  raise exception 'Zahlungseingaenge sind unveraenderlich (GoBD). Korrektur: neue Zeile mit art=''korrektur'' und negativem Betrag.';
end $$;

create trigger trg_prevent_abrechnung_zahlung_mod
  before update or delete on public.abrechnung_zahlung
  for each row execute function public.prevent_abrechnung_zahlung_mod();

-- ─────────────────────────────────────────────────────────────────────────
-- 4) „bezahlt" hat EINE Definition. Toleranz 0,005 stammt aus
--    billing/zuzahlung/bezahlt.js -> istZuzahlungBezahlt().
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.fn_abrechnung_zahlung_status()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_soll numeric; v_abg numeric; v_bez numeric;
begin
  select coalesce(sum(netto_eur),0), coalesce(sum(absetzung_eur),0)
    into v_soll, v_abg from public.abrechnung_zeile where abrechnung_id = new.abrechnung_id;
  if v_soll = 0 then
    select coalesce(total_eur,0) - coalesce(zuzahlung_total,0)
      into v_soll from public.abrechnung where id = new.abrechnung_id;
    v_abg := 0;
  end if;
  select coalesce(sum(betrag_eur),0)
    into v_bez from public.abrechnung_zahlung where abrechnung_id = new.abrechnung_id;

  if v_bez >= (v_soll - v_abg) - 0.005 then
    update public.abrechnung
       set status = 'paid', paid_at = new.datum::timestamptz
     where id = new.abrechnung_id and status <> 'paid';
  end if;
  return new;
end $$;

create trigger trg_abrechnung_zahlung_status
  after insert on public.abrechnung_zahlung
  for each row execute function public.fn_abrechnung_zahlung_status();

-- ─────────────────────────────────────────────────────────────────────────
-- 5) RLS — belegliste-Muster: SELECT + INSERT, KEIN UPDATE/DELETE.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.abrechnung_zeile   enable row level security;
alter table public.abrechnung_zahlung enable row level security;

create policy abrechnung_zeile_select on public.abrechnung_zeile
  for select to authenticated
  using (auth.uid() = owner_id
      or auth.uid() in (select id from public.profiles where owner_id = abrechnung_zeile.owner_id));
create policy abrechnung_zeile_insert on public.abrechnung_zeile
  for insert to authenticated
  with check (auth.uid() = owner_id
      or auth.uid() in (select id from public.profiles where owner_id = abrechnung_zeile.owner_id));

create policy abrechnung_zahlung_select on public.abrechnung_zahlung
  for select to authenticated
  using (auth.uid() = owner_id
      or auth.uid() in (select id from public.profiles where owner_id = abrechnung_zahlung.owner_id));
create policy abrechnung_zahlung_insert on public.abrechnung_zahlung
  for insert to authenticated
  with check (auth.uid() = owner_id
      or auth.uid() in (select id from public.profiles where owner_id = abrechnung_zahlung.owner_id));
```

**Kein `abrechnung_saldo`-View in v1.** In Postgres läuft ein View standardmässig mit den Rechten
des Erstellers; wird `with (security_invoker = true)` vergessen, ist die Mandantengrenze offen.
Im Repo benutzt heute **kein** View `security_invoker`. Die Liste ist auf 50 Dateien begrenzt —
die Summe in der Route oder im Browser zu rechnen ist billiger und sicherer. Falls doch ein View:
vorher `guvenlik`.

# Anhang B — Texte für `db/REGISTER.md`

Von `db-ustasi` vorbereitet, **noch nicht eingetragen**. Beim Anwenden der Migration im selben
Commit einfügen und `TT.MM.2026` durch das echte Datum ersetzen.

```markdown
### `abrechnung_zeile`
- **Warum:** Was in EINER Datei tatsächlich an die Kasse ging — eingefroren. Vorher wurde die
  Zeilenliste aus `prescriptions.abrechnung_id` abgeleitet; sobald ein abgesetztes Rezept korrigiert
  und neu eingereicht wurde, wanderte die id mit und die Zeile verschwand aus der alten Datei.
  Der Anwender sah in „10 eingereicht" neun Zeilen, ohne Hinweis. Dieselbe Lücke machte eine
  Kassenprüfung („zeigen Sie die 4. Sitzung zu Beleg X") und eine Korrekturrechnung nach VKZ 04
  („nicht zuvor vergütete Positionen", Anlage 1 TP5 V21 §7.4.3) unmöglich — der einzige interne
  Zeilennachweis war die lebende Verordnung. Trägt zusätzlich die Gesamtrechnungs-Gruppe
  (`karten_ik` + `einzel_rechnungsnummer`), die seit 07.09.2026 im DTA entsteht und bisher nur im
  Begleitzettel-HTML im Storage stand, also nicht abfragbar war.
- **Seit:** TT.MM.2026 · `abrechnung_zeile_und_zahlung`
- **Status:** aktiv
- **Wer:** geschrieben von `/abrechnung/create` und `/abrechnung/create-podologie` (letzter Schritt,
  nach allen Rollback-Punkten) sowie `/abrechnung/:id/upload-zaa` (nur Rückmeldeachse). Gelesen vom
  §302-Bildschirm.
- **Achtung:** ⚠️ Festgeschrieben. `trg_abrechnung_zeile_festschreibung` blockt DELETE ganz und
  jede Änderung an Identität und Betrag; offen bleiben `status`, `absetzung_*` und das **Nullen**
  (nicht Ändern) von `patient_name`/`versichertennummer`. Diese Ausnahme ist Absicht: bei `invoices`
  blockiert die Festschreibung die Anonymisierung und hält damit die ganze DSGVO-Löschkette an
  (siehe Kopf von `api/dsgvo.js`) — dieser Fehler wird hier nicht wiederholt.
  `prescription_id` ist `ON DELETE SET NULL`, sonst scheitert die Löschkette bei `prescriptions`.
  ⚠️ NICHT `abrechnung_position` nennen/verwechseln: „Position" heisst in diesem Code die
  Positionsnummer (HPNR) — `heilmittel_position`, `gkv_position_nr`, `GET /positions`.
  ⚠️ `prescriptions.abrechnung_id` bleibt bestehen und bedeutet weiter „in welcher Datei liegt die
  Zeile GERADE" (Arbeitsachse). Diese Tabelle ist die Geschichtsachse. Nicht zusammenlegen.
- **Quelle:** `funktionen/GKV-SORULAR-2026-08-12.md` (Befund) · Anlage 1 TP5 V21 §5.5.2, §7.4.3

### `abrechnung_zahlung`
- **Warum:** Geldeingang je Sammelabrechnung, tranchenweise. Bis dahin gab es `abrechnung.paid_at`
  und `status='paid'` — beide hat nie jemand geschrieben, Zahlungsverfolgung existierte faktisch
  nicht. Zwei Spalten hätten nicht gereicht: die Kasse zahlt in Raten, eine Datei kann seit
  07.09.2026 mehrere Gesamtrechnungen (je Karten-IK eine) enthalten, und ein UPDATE auf einen
  Summenwert löscht den vorherigen Stand — genau das, was § 146 Abs. 4 AO verbietet.
- **Seit:** TT.MM.2026 · `abrechnung_zeile_und_zahlung`
- **Status:** aktiv
- **Wer:** §302-Bildschirm über `POST /abrechnung/:id/zahlung`.
- **Achtung:** ⚠️ Unveränderlich, dritte Tabelle dieser Familie nach `belegliste` und
  `zuzahlung_korrekturen`. Korrektur = neue Zeile mit `art='korrektur'` und negativem Betrag.
  ⚠️ **Kein Beleg in `belegliste`.** Kassengeld ist eine Bankbewegung, kein Kassenbuchvorgang;
  `belegliste.type` ist patientenseitig, und `statistik.routes.js:188-205` summiert die Belegliste
  ungefiltert in die Umsatzreihe, während der GKV-Umsatz dort bereits aus `abrechnung.total_eur`
  kommt — ein Beleg hier zählt den Umsatz doppelt.
  ⚠️ `status='paid'` setzt NUR `fn_abrechnung_zahlung_status()`, wenn die Forderung
  (Soll − Absetzung) gedeckt ist; `paid_at` ist das `datum` der schliessenden Zahlung, nicht `now()`.
  Toleranz 0,005 € stammt aus `istZuzahlungBezahlt()` — „bezahlt" hat in diesem Projekt eine Definition.
  ⚠️ Eine Absetzung ist keine Zahlung: sie steht auf der Zeile (`abrechnung_zeile.absetzung_eur`),
  wird vom Anwender aus dem Absetzungsschreiben eingetragen und NIE aus der ZAA-Datei geraten —
  die kennt laut Anlage 1 TP5 V21 keine Beträge.
```

# Anhang C — Was `wissensbank/SPEC-RULES.md` bekommt

Sieben Regeln, von `gkv-302` mit Fundstellen formuliert, **noch nicht eingetragen**. Kurzfassung
der Titel; die Volltexte stehen im Bericht des Agenten und werden bei Phase 5 übernommen:

1. Reddedilen Beleg VKZ 04 ile gider, sessiz VKZ 01 tekrarı yasaktır (Kap. 7.4.3 · Nr. 3/21/22)
2. Bir dosyada tek VKZ, tek Rechnungsart, tek TA-Version (Kap. 7.3 · 5.3 (5)(6) · 5.3.2)
3. URI'nin beş alanı gönderimde saklanmalıdır (Kap. 7.3 · 5.5.3.1)
4. Belegnummer'ın teklik kapsamı bir Gesamtrechnung'dur (Richtlinien § 4 Abs. 1 · Kap. 7.5.1.1)
5. Datenaustauschreferenz kalıcı ve monotondur (Kap. 5.4 UNB 0020 · Kap. 7.2)
6. Dosya birimi = Datenannahmestelle × Kassenart, Fachbereich ayrımı yoktur (Kap. 5.3.1 · 5.4 · 5.5.3.3)
7. Ödeme süresi 4 hafta; makine okunur Zahlungsavis YOKTUR (Richtlinien § 7 Abs. 2 · Kap. 6.4)
