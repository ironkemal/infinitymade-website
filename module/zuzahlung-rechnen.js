/**
 * zuzahlung-rechnen.js — die Zuzahlung EINMAL rechnen, im Browser.
 *
 * Warum es diese Datei gibt (31.08.2026)
 * ──────────────────────────────────────
 * Die Zuzahlung wurde im Frontend an zwei Stellen ausgerechnet, mit denselben
 * vier Zeilen, doppelt hingeschrieben: in der Auswahlliste des §302-Assistenten
 * und noch einmal in der Taxierung. Beide rechneten mit `rx.anzahl_einheiten` —
 * der VERORDNETEN Menge.
 *
 * Der Backend-Weg (`api-backend/billing/zuzahlung/calculator.js`, und damit die
 * gedruckte Zuzahlungsrechnung wie die DTA-Datei) rechnet dagegen mit den
 * tatsächlich ERBRACHTEN Sitzungen (`prescription_sessions.status = 'done'`).
 *
 * Solange der Patient alle sechs Einheiten wahrnimmt, fällt das nicht auf.
 * Bricht er nach der dritten ab, zeigen Assistent und Rechnung verschiedene
 * Beträge für dieselbe Verordnung — und Beta-1 rechnet den richtigen von Hand
 * aus. Genau das ist die Ops-Karte „Zuzahlung bei Abbruch anpassbar machen".
 *
 * Diese Datei ist ab jetzt die einzige Zuzahlungsrechnung im Browser.
 *
 * Warum trotzdem zwei Implementierungen im Repo
 * ─────────────────────────────────────────────
 * Das Backend läuft in einem eigenen Container. Dessen Dockerfile listet die
 * kopierten Verzeichnisse einzeln auf (`COPY billing ./billing` …, es gibt kein
 * `COPY . .`), `module/` ist nicht dabei und kann es nicht sein — der Ordner
 * gehört zum Vercel-Frontend. Ein gemeinsames Modul ist also nicht möglich,
 * ohne eines der beiden Deployments umzubauen.
 *
 * Statt das zu verstecken, ist die Doppelung ANGENAGELT: `zuzahlung-rechnen.test.js`
 * importiert beide Implementierungen und vergleicht sie Fall für Fall. Läuft eine
 * der beiden weg, fällt `npm test` um. Eine Doppelung, die ein Test bewacht, ist
 * etwas anderes als eine Doppelung, die niemand kennt.
 *
 * ⚠️ Diese Datei ist bewusst eine SPIEGELUNG, keine Verbesserung. Wo der
 * Calculator eine offene Frage hat, hat sie diese Datei auch — siehe die
 * Anmerkung zur Pauschale unten. Zwei Antworten auf dieselbe Frage wären
 * schlimmer als eine ungeklärte.
 */

/** Kaufmännische Rundung auf zwei Stellen — identisch zu calculator.js `r2`. */
const r2 = (v) => Math.round((+v + Number.EPSILON) * 100) / 100;

/**
 * Welche Einheitenzahl geht in die Rechnung ein?
 *
 * Die Reihenfolge ist die Antwort auf den Abbruch-Fall und bildet den
 * Backend-Rückfall nach (`abrechnung.routes.js`: liegt keine erbrachte Sitzung
 * vor, wird mit `anzahl_einheiten` gerechnet):
 *
 *   1. Eine erfasste Korrektur schlägt alles — ein Mensch hat hingesehen.
 *      Auch die 0 gilt hier: „gar nichts erbracht" ist eine Aussage.
 *   2. Sonst die erbrachten Sitzungen, sobald welche dokumentiert sind.
 *   3. Sonst die verordnete Menge. Das ist die Schätzung, mit der eine frisch
 *      angelegte Verordnung startet, bevor die erste Sitzung gelaufen ist.
 *
 * @param {object} opts
 * @param {number} opts.verordnet        prescriptions.anzahl_einheiten
 * @param {number|null} [opts.erbracht]  Anzahl Sitzungen mit status = 'done'
 * @param {number|null} [opts.korrektur] Von Hand gesetzte Einheitenzahl
 * @returns {number}
 */
export function wirksameEinheiten({ verordnet, erbracht = null, korrektur = null }) {
  if (Number.isFinite(korrektur) && korrektur >= 0) return Math.floor(korrektur);
  if (Number.isFinite(erbracht) && erbracht > 0) return Math.floor(erbracht);
  const v = Number(verordnet);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/**
 * Zuzahlung einer Verordnung.
 *
 * Regel (§ 32 Abs. 2 i. V. m. § 61 SGB V, HeilM-RL):
 *   10 % je Heilmitteleinheit + 10,00 € Verordnungspauschale JE VERORDNUNG.
 *
 * Die Pauschale hängt an der Verordnung, nicht an der Sitzung — sie wird beim
 * Abbruch also NICHT anteilig gekürzt. Weniger Sitzungen senken nur den
 * prozentualen Teil. Gedeckelt ist sie auf das, was vom Bruttobetrag nach dem
 * Prozentanteil übrig bleibt; der Patient zahlt nie mehr als die Leistung wert
 * ist.
 *
 * @param {object} opts
 * @param {number} opts.einheiten             Wirksame Einheiten (s. wirksameEinheiten)
 * @param {number} opts.preisProEinheit       Bruttopreis je Einheit
 * @param {number|null} [opts.zuzahlungProEinheit] Katalogbetrag je Einheit.
 *        `null` ⇒ Position unbekannt, Ersatzrechnung mit 10 % vom Brutto.
 * @param {boolean} [opts.positionFrei]       Position ist zuzahlungsfrei (KG-ZNS
 *        Kinder, Bericht, 78220/78530 …) ⇒ kein Prozentanteil.
 * @param {boolean} [opts.befreit]            Befreiung / unter 18 / privat ⇒ alles 0.
 * @returns {{brutto:number, prozent:number, pauschale:number, gesamt:number, befreit:boolean}}
 */
export function berechneZuzahlung({
  einheiten,
  preisProEinheit,
  zuzahlungProEinheit = null,
  positionFrei = false,
  befreit = false,
}) {
  const n = Math.max(0, Math.floor(Number(einheiten) || 0));
  const preis = Number(preisProEinheit) || 0;

  // n gleiche Posten — das ist der Sonderfall der allgemeinen Rechnung unten.
  // Vorher stand die Formel hier ein zweites Mal; sie steht jetzt nur noch an
  // einer Stelle, damit die Podologie (mehrere verschiedene Positionen je
  // Verordnung) nicht ihren eigenen Rechenweg bekommt.
  const posten = Array.from({ length: n }, () => ({
    preis,
    zuzahlung: positionFrei ? null : zuzahlungProEinheit,
    frei: positionFrei,
  }));

  return berechneZuzahlungAusPosten({ posten, befreit });
}

/**
 * Zuzahlung aus einer Liste einzelner Posten.
 *
 * Spiegelt `calcAbrechnungsfallZuzahlung` aus dem Backend-Calculator: dort ist
 * ein „Posten" ein Eintrag in `sessions` mit eigenem Preis und eigener
 * Positions-Zuzahlung. Für Physio ist das n-mal dieselbe Position; in der
 * Podologie stehen an einem Behandlungstag mehrere VERSCHIEDENE Positionen
 * (78010 Behandlung + 78030 Befundung), jede mit eigenem Katalogbetrag.
 * Genau deshalb reicht dort „Preis × Einheiten" nicht.
 *
 * Anlass: Beta-1, 31.08.2026 — „dass er die Summe schon automatisch ausrechnet".
 *
 * @param {object} opts
 * @param {Array<{preis:number, zuzahlung:number|null, frei?:boolean}>} opts.posten
 *        `zuzahlung: null` heisst NICHT „frei", sondern „unbekannt" ⇒ 10 %
 *        Ersatzrechnung. Zuzahlungsfrei wird über `frei: true` gesagt — dieselbe
 *        Dreiteilung wie in `resolvePositionZuzahlung` (Position gefunden mit
 *        Betrag · gefunden und frei · gar nicht gefunden).
 * @param {boolean} [opts.befreit]
 * @returns {{brutto:number, prozent:number, pauschale:number, gesamt:number, befreit:boolean}}
 */
export function berechneZuzahlungAusPosten({ posten, befreit = false }) {
  const liste = Array.isArray(posten) ? posten : [];
  const brutto = r2(liste.reduce((s, p) => s + (Number(p?.preis) || 0), 0));

  if (befreit) {
    return { brutto, prozent: 0, pauschale: 0, gesamt: 0, befreit: true };
  }

  // Je Posten runden und dann summieren — nicht summieren und dann runden.
  // Der Calculator tut es genauso (`sessions.reduce(… calcSessionZuzahlung)`);
  // bei halben Cents je Einheit laufen die beiden Reihenfolgen auseinander.
  const prozent = r2(liste.reduce((s, p) => {
    if (p?.frei) return s;
    const preis = Number(p?.preis) || 0;
    return s + (p?.zuzahlung != null ? r2(p.zuzahlung) : r2(preis * 0.10));
  }, 0));

  // ⚠️ Offen (aus calculator.js übernommen, nicht hier entschieden): ob eine
  // ausschliesslich zuzahlungsfreie Verordnung die 10-€-Pauschale trotzdem
  // auslöst. Beide Wege sagen heute „ja". Wer das ändert, ändert BEIDE Dateien
  // und fragt vorher `gkv-302` — es ist bares Geld je Verordnung.
  const pauschale = Math.max(0, Math.min(10.00, r2(brutto - prozent)));

  return { brutto, prozent, pauschale, gesamt: r2(prozent + pauschale), befreit: false };
}

/**
 * Adapter für die Oberfläche: eine `prescriptions`-Zeile plus die aufgelöste
 * Katalogposition ergeben den anzuzeigenden Betrag.
 *
 * Der Sinn liegt in der Zeile mit `status === 'done'`: dieselbe Bedingung, die
 * das Backend für die gedruckte Rechnung und die DTA-Datei benutzt. Solange
 * jeder Aufrufer sie selbst hinschrieb, stand es einmal richtig und zweimal
 * falsch im Code.
 *
 * Erwartet die Zeile mit eingebetteten `prescription_sessions` — ohne sie ist
 * `erbracht` null und es gilt die verordnete Menge, wie im Backend auch.
 *
 * @param {object} rx        prescriptions-Zeile
 * @param {object|null} position  Katalogtreffer ({preis, zuzahlung, zuzahlung_frei})
 * @returns {{brutto:number, prozent:number, pauschale:number, gesamt:number,
 *           befreit:boolean, einheiten:number, erbracht:number, verordnet:number}}
 */
export function zuzahlungFuerRezept(rx, position) {
  const erbracht = (rx?.prescription_sessions || []).filter(s => s?.status === 'done').length;
  const einheiten = wirksameEinheiten({ verordnet: rx?.anzahl_einheiten, erbracht });
  const betrag = berechneZuzahlung({
    einheiten,
    preisProEinheit: position?.preis || 0,
    zuzahlungProEinheit: position?.zuzahlung ?? null,
    positionFrei: !!position?.zuzahlung_frei,
    befreit: !!rx?.zuzahlung_befreit,
  });
  return { ...betrag, einheiten, erbracht, verordnet: Number(rx?.anzahl_einheiten) || 0 };
}

/**
 * Adapter für den Podologie-Topf: eine `verordnungen`-Zeile plus ihre
 * dokumentierten Behandlungen ergeben Summe und Zuzahlung.
 *
 * Beta-1, 31.08.2026: „so hinbekommen, dass die Daten direkt auch mit dieser
 * Datenbank verbunden sind und dass er die Summe schon automatisch ausrechnet."
 * Gemeint ist der Kontrollblick VOR der Abrechnung: kommen an einem Tag
 * podologische Behandlung und Befundung zusammen, stand der Gesamtbetrag
 * bisher nirgends.
 *
 * Anders als im Physio-Topf wird hier NICHT über Einheiten gerechnet, sondern
 * über die tatsächlich dokumentierten Positionen — `podologie_behandlungen`
 * entsteht erst beim Behandeln und trägt die erbrachten HPNR-Codes. Das ist
 * derselbe Weg, den das Backend beim Aufbau der DTA-Positionen geht
 * (`mapVerordnungToDtaShape`: Behandlung × `hpnr_codes` flachklopfen).
 *
 * @param {object} vord   Zeile aus `verordnungen` (gelesen wird `zuzahlung_befreit`)
 * @param {Array}  behandlungen  Zeilen aus `podologie_behandlungen`
 * @param {(code:string, datum:string) => ({preis:number, zuzahlung:number|null, label?:string}|null)} findePosition
 *        Katalogauflösung zum Behandlungsdatum. Der Katalog wird bewusst NICHT
 *        hier geladen: diese Datei bleibt rein rechnend und damit testbar gegen
 *        den Backend-Calculator.
 * @returns {{brutto:number, prozent:number, pauschale:number, gesamt:number,
 *           befreit:boolean, zeilen:Array, unbekannt:Array<string>}}
 */
export function zuzahlungFuerPodoVerordnung(vord, behandlungen, findePosition) {
  const behs = Array.isArray(behandlungen) ? behandlungen : [];
  const posten = [];
  const proCode = new Map();
  const unbekannt = new Set();

  for (const b of behs) {
    const codes = Array.isArray(b?.hpnr_codes) ? b.hpnr_codes.filter(Boolean) : [];
    for (const rohCode of codes) {
      const code = String(rohCode);
      const pos = findePosition ? findePosition(code, b?.behandlungsdatum) : null;
      if (!pos) unbekannt.add(code);

      const preis = Number(pos?.preis) || 0;
      // `zuzahlung: null` bei GEFUNDENER Position heisst zuzahlungsfrei
      // (78220, 78530). Bei nicht gefundener Position heisst es „unbekannt"
      // und die 10-%-Ersatzrechnung greift — die Unterscheidung stammt aus
      // `resolvePositionZuzahlung` und ist bares Geld für den Patienten.
      posten.push({ preis, zuzahlung: pos ? pos.zuzahlung : null, frei: !!pos && pos.zuzahlung == null });

      const vorher = proCode.get(code) || { code, label: pos?.label || '', anzahl: 0, einzelpreis: preis, summe: 0, unbekannt: !pos };
      vorher.anzahl += 1;
      vorher.summe = r2(vorher.summe + preis);
      proCode.set(code, vorher);
    }
  }

  const betrag = berechneZuzahlungAusPosten({ posten, befreit: !!vord?.zuzahlung_befreit });
  return { ...betrag, zeilen: [...proCode.values()], unbekannt: [...unbekannt] };
}

/**
 * Was ist nach einer Korrektur zu viel bezahlt?
 *
 * `ist` ist der Kassenbuch-Saldo (Zuzahlungen positiv, Stornos negativ,
 * `saldoJeRezept()` im Backend). Wird das Soll gesenkt, nachdem der Patient
 * schon gezahlt hat, entsteht die Differenz als Guthaben.
 *
 * Bewusst kein Vorzeichenspiel: ein negatives Ergebnis ist kein Guthaben,
 * sondern eine Restforderung, und die gehört ins Mahnwesen, nicht hierher.
 *
 * @param {object} opts
 * @param {number} opts.soll  Neuer geforderter Betrag
 * @param {number} opts.ist   Bereits gebuchter Betrag
 * @returns {number} Guthaben in EUR, nie negativ
 */
export function guthabenAus({ soll, ist }) {
  const diff = r2((Number(ist) || 0) - (Number(soll) || 0));
  return diff > 0 ? diff : 0;
}

/**
 * Darf der Zuzahlungsbetrag dieser Verordnung noch geändert werden?
 *
 * Zwei Signale, und das erste ist das härtere:
 *
 *   1. `belegnummer` — wird bei der DTA-Erzeugung EINMAL vergeben und danach nie
 *      wieder angefasst (Anlage 1 TP5 V21 Kap. 7.3). Leer heisst: war noch nie
 *      in einer Kassendatei. Statusfelder lassen sich zurücksetzen, diese Nummer
 *      nicht — deshalb ist sie das verlässlichere Signal.
 *   2. `abrechnung_status` — dasselbe Tor, das schon der Positionswechsel
 *      benutzt (`abrechnung.routes.js`, 409 „bereits in einer Abrechnung").
 *
 * `abrechnung_id` ist ABSICHTLICH nicht dabei: bei einer Kassenabsetzung wird
 * der Status auf 'bereit' zurückgesetzt, die `abrechnung_id` aber stehen
 * gelassen. Ein Riegel darauf würde genau die Rezepte sperren, die man nach
 * einer Absetzung korrigieren muss.
 *
 * `zuzahlung_kassiert_am` ist ebenfalls KEIN Riegel — dass der Patient schon
 * gezahlt hat, ist der Normalfall des Abbruchs und der Grund, warum es
 * überhaupt Guthaben gibt.
 *
 * @param {object} rx  prescriptions-Zeile ({belegnummer, abrechnung_status})
 * @returns {{erlaubt:boolean, grund:string|null}}
 */
export function korrekturErlaubt(rx) {
  if (!rx) return { erlaubt: false, grund: 'Verordnung nicht gefunden.' };
  if (rx.belegnummer) {
    return {
      erlaubt: false,
      grund: 'Diese Verordnung wurde bereits an die Kasse übermittelt '
        + `(Beleg ${rx.belegnummer}). Der Betrag ist festgeschrieben; `
        + 'eine Änderung läuft über das Korrekturverfahren.',
    };
  }
  const st = rx.abrechnung_status;
  if (st && st !== 'bereit') {
    return {
      erlaubt: false,
      grund: 'Diese Verordnung steckt bereits in einer Abrechnung '
        + `(Status „${st}"). Bitte zuerst aus der Abrechnung nehmen.`,
    };
  }
  return { erlaubt: true, grund: null };
}
