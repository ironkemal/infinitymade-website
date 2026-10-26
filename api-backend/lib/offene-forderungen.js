import { verordnungFestschreiben } from '../billing/api/betriebsart.js';

const NULL_EURO = { n: 0n, s: 0 };
const HALBCENT = { n: 5n, s: 3 };
const MAX_CENT = BigInt(Number.MAX_SAFE_INTEGER);
const ZEILENSTATUS = new Set(['eingereicht', 'akzeptiert', 'abgesetzt', 'teilabgesetzt', 'nachgereicht']);
const UEBERTRAGEN = new Set(['gesendet', 'accepted', 'paid', 'rejected']);
const LEDGERARTEN = new Set(['zahlung', 'ruecklastschrift', 'abschreibung', 'korrektur']);

// Dezimale Addition erhält Subcentreste bis zur abschließenden Toleranzprüfung.
// Keine Tarifberechnung: ausschließlich gespeicherte Beträge, keine Kataloge.
function euro(raw) {
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()))) return null;
  const wert = Number(raw);
  if (!Number.isFinite(wert)) return null;
  // DB-numeric kommt häufig als String. Number(raw) dient nur der endlichen
  // Werteprüfung; seine gerundete Darstellung darf keinen Cent unterschlagen.
  const [mantisse, exponent = '0'] = String(raw).trim().toLowerCase().split('e');
  const [ganz, nachkomma = ''] = mantisse.split('.');
  let n = BigInt(ganz + nachkomma);
  if (n === 0n) return NULL_EURO;
  if (wert === 0 || !Number.isSafeInteger(Number(exponent))) return null;
  let s = nachkomma.length - Number(exponent);
  if (s < 0) { n *= 10n ** BigInt(-s); s = 0; }
  const betrag = { n, s };
  return cent(betrag) === null ? null : betrag;
}

function cent({ n, s }) {
  const nenner = 10n ** BigInt(s);
  const abs = n < 0n ? -n : n;
  const gerundet = (abs * 200n + nenner) / (nenner * 2n);
  return gerundet > MAX_CENT ? null : Number(n < 0n ? -gerundet : gerundet);
}

function summe(werte) {
  if (werte.some(w => w === null)) return null;
  const s = werte.reduce((max, w) => Math.max(max, w.s), 0);
  const n = werte.reduce((sum, w) => sum + w.n * 10n ** BigInt(s - w.s), 0n);
  const wert = { n, s };
  return cent(wert) === null ? null : wert;
}
const minus = wert => wert === null ? null : { n: -wert.n, s: wert.s };
const differenz = (a, b) => summe([a, minus(b)]);
const gleich = (a, b) => a !== null && b !== null && differenz(a, b)?.n === 0n;
const gkv = rx => rx.rezeptart === null || rx.rezeptart === 'kassen';
const idOk = id => typeof id === 'string' && id.length > 0;

function gruppiere(rows, feld) {
  const map = new Map();
  for (const row of rows) {
    const key = row[feld];
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}
const eindeutig = (map, id) => map.get(id)?.length === 1 ? map.get(id)[0] : null;
const doppelteIds = rows => new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => !idOk(row.id));
const unbekannt = grundCode => ({ restCent: null, grundCode });

function restbetrag(soll, abzug, saldo, refId, praefix, anomalien) {
  const rest = summe([soll, minus(abzug), minus(saldo)]);
  if (rest === null) return unbekannt(`${praefix}_BETRAG_UNGUELTIG`);
  const abs = { ...rest, n: rest.n < 0n ? -rest.n : rest.n };
  if (differenz(abs, HALBCENT).n <= 0n) return { restCent: 0, grundCode: `${praefix}_AUSGEGLICHEN` };
  if (rest.n < 0n) {
    anomalien.push({ refId, code: `${praefix}_UEBERZAHLUNG` });
    return { restCent: 0, grundCode: `${praefix}_UEBERZAHLUNG` };
  }
  return { restCent: cent(rest), grundCode: `${praefix}_OFFEN` };
}

function journalSaldo(rows, ownerId, ledger = false) {
  if (doppelteIds(rows) || rows.some(row => row.owner_id !== ownerId)) return null;
  const werte = rows.map(row => {
    const wert = euro(ledger ? row.betrag_eur : row.amount_eur);
    if (ledger) return LEDGERARTEN.has(row.art) ? wert : null;
    if (wert === null || (row.type === 'zuzahlung' && wert.n < 0n) || (row.type === 'storno' && wert.n > 0n)) return null;
    return wert;
  });
  return summe(werte);
}

function podoSnapshot(rx, soll, zeilenJeRezept, koepfeJeId) {
  // Festschreibung: abrechnung.routes.js:4603–4635; Herkunft: db/REGISTER.md
  // → abrechnung_zeile. Live-podoZuzahlungSoll zieht Alt bereits ab und darf
  // hier weder benutzt noch durch eine eigene Leistungsformel ersetzt werden.
  if (!idOk(rx.abrechnung_id) || !idOk(rx.belegnummer)) return 'PODO_SNAPSHOT_ZUORDNUNG_FEHLT';
  const kandidaten = (zeilenJeRezept.get(rx.id) || []).filter(z => z.abrechnung_id === rx.abrechnung_id);
  if (kandidaten.length !== 1) return 'PODO_SNAPSHOT_FEHLT_ODER_MEHRDEUTIG';
  const z = kandidaten[0];
  const kopf = eindeutig(koepfeJeId, z.abrechnung_id);
  if (!kopf || kopf.owner_id !== rx.owner_id || kopf.verarbeitungskennzeichen === '03'
    || kopf.status === 'verworfen' || !verordnungFestschreiben(kopf.betriebsart)) return 'PODO_SNAPSHOT_KOPF_UNKLAR';
  if (z.owner_id !== rx.owner_id || z.herkunft !== 'einreichung' || !ZEILENSTATUS.has(z.status)) return 'PODO_SNAPSHOT_HERKUNFT_UNKLAR';
  if (z.belegnummer !== rx.belegnummer || !gleich(euro(z.zuzahlung_eur), soll)) return 'PODO_SNAPSHOT_WIDERSPRUCH';
  return null;
}

function patientenRest(rx, belege, zeilenJeRezept, koepfeJeId, anomalien) {
  const journal = belege.filter(b => b.type === 'zuzahlung' || b.type === 'storno');
  const saldo = journalSaldo(journal, rx.owner_id);
  const alt = rx.zuzahlung_altsystem_eur == null ? NULL_EURO : euro(rx.zuzahlung_altsystem_eur);
  const empfangen = alt === null || alt.n < 0n ? null : summe([alt, saldo]);
  if (saldo?.n < 0n) {
    anomalien.push({ refId: rx.id, code: 'PATIENT_NEGATIVSALDO' });
    return { ...unbekannt('PATIENT_NEGATIVSALDO'), empfangen };
  }
  if (rx.zuzahlung_kassiert_am && journal.length > 0 && saldo?.n === 0n) {
    anomalien.push({ refId: rx.id, code: 'PATIENT_NULLJOURNAL_KASSIERVERMERK' });
    return { ...unbekannt('PATIENT_NULLJOURNAL_KASSIERVERMERK'), empfangen };
  }
  // Befreiung setzt das Soll auf null Euro, ersetzt aber keine Journalprüfung.
  const befreit = rx.zuzahlung_befreit === true;
  const soll = befreit ? NULL_EURO : euro(rx.zuzahlung_eur);
  if (soll === null || soll.n < 0n) return unbekannt('PATIENT_SOLL_UNBEKANNT');
  if (alt === null || alt.n < 0n) return unbekannt('PATIENT_ALTSYSTEM_UNGUELTIG');
  if (saldo === null) return { ...unbekannt('PATIENT_JOURNAL_UNGUELTIG'), empfangen };
  if (empfangen === null) return { ...unbekannt('PATIENT_BETRAG_UNGUELTIG'), empfangen };
  if (befreit) {
    const rest = restbetrag(soll, alt, saldo, rx.id, 'PATIENT', anomalien);
    return { ...rest, grundCode: rest.grundCode === 'PATIENT_UEBERZAHLUNG' ? rest.grundCode : 'PATIENT_BEFREIT', empfangen };
  }
  if (rx.therapie_bereich === 'podo') {
    const fehler = podoSnapshot(rx, soll, zeilenJeRezept, koepfeJeId);
    if (fehler) return { ...unbekannt(fehler), empfangen };
  }
  // bezahlt.js beschreibt signed Saldo + Altvermerk. Sein Boolean kann weder
  // Teilreste noch vorhandenes Nulljournal unterscheiden; deshalb hier streng.
  if (rx.zuzahlung_kassiert_am && journal.length === 0) return { restCent: 0, grundCode: 'PATIENT_ALTBESTAND_BEZAHLT', empfangen: soll };
  return { ...restbetrag(soll, alt, saldo, rx.id, 'PATIENT', anomalien), empfangen };
}

function pruefeForderung(kopf, ursprung, rx, eigeneZeilen, koepfeJeId) {
  if (kopf.verarbeitungskennzeichen !== '03') return 'VKZ03_KENNZEICHEN_WIDERSPRUCH';
  if (!ursprung) return 'VKZ03_URSPRUNG_FEHLT';
  if (!rx || !gkv(rx)) return 'VKZ03_REZEPT_FEHLT';
  const originalKopf = eindeutig(koepfeJeId, ursprung.abrechnung_id);
  if (!originalKopf || ![null, '01'].includes(originalKopf.verarbeitungskennzeichen)
    || originalKopf.status === 'verworfen' || !verordnungFestschreiben(originalKopf.betriebsart)) return 'VKZ03_URSPRUNGSKOPF_UNKLAR';
  if (ursprung.herkunft !== 'einreichung' || ursprung.status !== 'akzeptiert') return 'VKZ03_URSPRUNGSSNAPSHOT_UNKLAR';
  if ([rx, ursprung, originalKopf].some(row => row.owner_id !== kopf.owner_id)) return 'VKZ03_MANDANT_WIDERSPRUCH';
  if (!verordnungFestschreiben(kopf.betriebsart)) return 'VKZ03_BETRIEBSART_UNKLAR';
  if (eigeneZeilen.length !== 1) return 'VKZ03_ZEILE_FEHLT_ODER_MEHRDEUTIG';
  const z = eigeneZeilen[0];
  if (z.owner_id !== kopf.owner_id || z.prescription_id !== rx.id
    || !idOk(ursprung.belegnummer) || ursprung.belegnummer !== rx.belegnummer || z.belegnummer !== ursprung.belegnummer
    || z.herkunft !== 'einreichung' || !ZEILENSTATUS.has(z.status)) return 'VKZ03_SNAPSHOT_WIDERSPRUCH';
  const soll = euro(z.netto_eur);
  const ursprungSoll = euro(ursprung.zuzahlung_eur);
  if (soll === null || soll.n < 0n || ursprungSoll === null || ursprungSoll.n < 0n
    || differenz(soll, ursprungSoll)?.n > 0n || !gleich(euro(z.zuzahlung_eur), NULL_EURO)) return 'VKZ03_SOLL_UNGUELTIG';
  return null;
}

function kassenRest(kopf, zeile, zahlungen, anomalien) {
  const soll = euro(zeile.netto_eur);
  const absetzung = euro(zeile.absetzung_eur);
  if (absetzung === null || absetzung.n < 0n || differenz(absetzung, soll)?.n > 0n) return unbekannt('VKZ03_ABSETZUNG_UNKLAR');
  const abgesetzt = ['abgesetzt', 'teilabgesetzt'].includes(zeile.status);
  const dokumentiert = absetzung.n > 0n && /^\d{4}-\d{2}-\d{2}$/.test(zeile.absetzung_am || '');
  // ZAA liefert keinen Betrag. Erst der gespeicherte Betrag samt Datum der
  // Erfassung (abrechnung.routes.js:5236) ist ein rechenbarer Abzug.
  if ((abgesetzt || absetzung.n > 0n || zeile.absetzung_am) && !dokumentiert) return unbekannt('VKZ03_ABSETZUNG_UNKLAR');
  if (kopf.status === 'rejected' && !dokumentiert) return unbekannt('VKZ03_ABLEHNUNG_UNGEKLAERT');
  const saldo = journalSaldo(zahlungen, kopf.owner_id, true);
  if (saldo === null) return unbekannt('VKZ03_LEDGER_UNGUELTIG');
  // Auch Abschreibung und signed Korrektur tilgen Rest. paid allein ist kein
  // Beweis für Zahlung (fn_abrechnung_zahlung_status in SCHEMA-RLS.sql:2830).
  return restbetrag(soll, absetzung, saldo, kopf.id, 'VKZ03', anomalien);
}

/**
 * Reine B03-Auswertung für spätere Startseiten-Zuzahlungsblöcke, zuerst Tests.
 * Umfang: GKV-Patientenzuzahlungen + zugeordnete VKZ03, keine gewöhnlichen
 * Kassen-, Privat-, Ausfall- oder sonstigen Praxisforderungen. Keine Tarife.
 * `quelle` = patient | kasse | klaerung; refId = Rezept-ID bzw. VKZ03-Kopf-ID.
 * Ein betroffener Posten mit unzureichendem Nachweis bleibt null; bekannte
 * Teilsummen bleiben separat. Ein unsafe Gesamt-/Teilbetrag wirft.
 * Eingaben müssen vollständig geladen sein; keine Mutation, keine IO.
 * @param {{prescriptions: object[], belege: object[], koepfe: object[], zeilen: object[], zahlungen: object[]}} daten
 * @returns {{patientBekanntCent:number,kasseBekanntCent:number,klaerungBekanntCent:number,gesamtCent:number|null,unbekanntAnzahl:number,posten:Array<{quelle:string,refId:string,restCent:number|null,grundCode:string}>,anomalien:Array<{refId:string,code:string}>}}
 */
export function berechneOffeneForderungen({ prescriptions = [], belege = [], koepfe = [], zeilen = [], zahlungen = [] } = {}) {
  for (const rows of [prescriptions, belege, koepfe, zeilen, zahlungen]) if (!Array.isArray(rows)) throw new TypeError('Vollständige Zeilenlisten erforderlich');
  const rxJeId = gruppiere(prescriptions, 'id');
  const kopfJeId = gruppiere(koepfe, 'id');
  const zeileJeId = gruppiere(zeilen, 'id');
  const zeilenJeKopf = gruppiere(zeilen, 'abrechnung_id');
  const zeilenJeRezept = gruppiere(zeilen, 'prescription_id');
  const belegeJeRezept = gruppiere(belege, 'prescription_id');
  const zahlungenJeKopf = gruppiere(zahlungen, 'abrechnung_id');
  const posten = [];
  const anomalien = [];
  const patienten = new Map();
  for (const [id, rows] of rxJeId) {
    if (!rows.some(gkv)) continue;
    patienten.set(id, rows.length !== 1 || !idOk(id)
      ? unbekannt('PATIENT_REZEPT_MEHRDEUTIG')
      : patientenRest(rows[0], belegeJeRezept.get(id) || [], zeilenJeRezept, kopfJeId, anomalien));
  }

  const forderungen = koepfe.filter(k => (k.verarbeitungskennzeichen === '03' || k.zuzahlungsforderung_ursprung_id != null)
    && k.status !== 'verworfen' && k.betriebsart !== 'test');
  const gruppen = new Map();
  const gesperrt = new Set();
  for (const kopf of forderungen) {
    const quellen = zeileJeId.get(kopf.zuzahlungsforderung_ursprung_id) || [];
    const ursprung = quellen.length === 1 ? quellen[0] : null;
    // Keine Ersatzzuordnung über eigene Zeile oder Belegnummer. Nur die
    // Ursprungs-FK bestimmt, welche Patientenzuzahlung gesperrt wird.
    for (const q of quellen) if (patienten.has(q.prescription_id)) gesperrt.add(q.prescription_id);
    const key = ursprung?.prescription_id ? `rezept:${ursprung.prescription_id}`
      : idOk(kopf.zuzahlungsforderung_ursprung_id) ? `ursprung:${kopf.zuzahlungsforderung_ursprung_id}` : `kopf:${kopf.id}`;
    if (!gruppen.has(key)) gruppen.set(key, []);
    gruppen.get(key).push({ kopf, ursprung });
  }
  for (const gruppe of gruppen.values()) {
    const { kopf, ursprung } = gruppe[0];
    const rx = ursprung ? eindeutig(rxJeId, ursprung.prescription_id) : null;
    const eigeneZeilen = zeilenJeKopf.get(kopf.id) || [];
    let fehler = gruppe.length !== 1 || (kopfJeId.get(kopf.id)?.length !== 1)
      ? 'VKZ03_MEHRDEUTIG' : pruefeForderung(kopf, ursprung, rx, eigeneZeilen, kopfJeId);
    const patient = rx ? patienten.get(rx.id) : null;
    const istUebertragen = UEBERTRAGEN.has(kopf.status);
    if (!fehler && istUebertragen && patient?.empfangen?.n > 0n) fehler = 'VKZ03_PATIENTENZAHLUNG_KONFLIKT';
    if (!fehler && istUebertragen && patient?.empfangen === null) fehler = 'VKZ03_PATIENTENSALDO_UNKLAR';
    if (!fehler && patient?.restCent === null) fehler = patient.grundCode;
    const quelle = istUebertragen ? (kopf.status === 'rejected' ? 'klaerung' : 'kasse') : 'patient';
    if (fehler) {
      anomalien.push({ refId: kopf.id, code: fehler });
      posten.push({ quelle: 'klaerung', refId: kopf.id, ...unbekannt(fehler) });
    } else if (['erstellt', 'heruntergeladen'].includes(kopf.status)) {
      posten.push({ quelle, refId: rx.id, restCent: patient.restCent, grundCode: patient.grundCode });
    } else if (istUebertragen) {
      posten.push({ quelle, refId: kopf.id, ...kassenRest(kopf, eigeneZeilen[0], zahlungenJeKopf.get(kopf.id) || [], anomalien) });
    } else {
      posten.push({ quelle: 'klaerung', refId: kopf.id, ...unbekannt('VKZ03_STATUS_UNKLAR') });
    }
  }
  for (const [refId, patient] of patienten) if (!gesperrt.has(refId)) {
    posten.push({ quelle: 'patient', refId, restCent: patient.restCent, grundCode: patient.grundCode });
  }
  const summen = { patient: 0n, kasse: 0n, klaerung: 0n };
  let unbekanntAnzahl = 0;
  for (const p of posten) {
    if (p.restCent === null) unbekanntAnzahl++;
    else summen[p.quelle] += BigInt(p.restCent);
  }
  const gesamt = summen.patient + summen.kasse + summen.klaerung;
  if (Object.values(summen).some(n => n > MAX_CENT) || gesamt > MAX_CENT) throw new RangeError('Forderungssumme überschreitet sichere Centzahl');
  return {
    patientBekanntCent: Number(summen.patient), kasseBekanntCent: Number(summen.kasse), klaerungBekanntCent: Number(summen.klaerung),
    gesamtCent: unbekanntAnzahl ? null : Number(gesamt), unbekanntAnzahl, posten, anomalien,
  };
}

const SPALTEN = {
  prescriptions: 'id,owner_id,therapie_bereich,rezeptart,belegnummer,abrechnung_id,zuzahlung_eur,zuzahlung_befreit,zuzahlung_altsystem_eur,zuzahlung_kassiert_am',
  belegliste: 'id,owner_id,prescription_id,type,amount_eur',
  abrechnung: 'id,owner_id,status,betriebsart,verarbeitungskennzeichen,zuzahlungsforderung_ursprung_id',
  abrechnung_zeile: 'id,owner_id,abrechnung_id,prescription_id,belegnummer,herkunft,status,zuzahlung_eur,netto_eur,absetzung_eur,absetzung_am',
  abrechnung_zahlung: 'id,owner_id,abrechnung_id,art,betrag_eur',
};

async function ladeSeiten(supabase, tenantId, tabelle, feld, ids) {
  const rows = [];
  let letzteId = null;
  while (true) {
    let query = supabase.from(tabelle).select(SPALTEN[tabelle]).eq('owner_id', tenantId);
    if (feld) query = query.in(feld, ids);
    query = query.order('id', { ascending: true });
    if (letzteId !== null) query = query.gt('id', letzteId);
    const { data, error } = await query.limit(1000);
    if (error || !Array.isArray(data)) throw new Error(`Offene Forderungen: ${tabelle} laden fehlgeschlagen`, { cause: error });
    if (data.length === 0) return rows;
    for (const row of data) {
      if (row.owner_id !== tenantId) throw new Error('Offene Forderungen: Mandant der Antwort widerspricht Filter');
      if (!idOk(row.id) || (letzteId !== null && row.id <= letzteId)) throw new Error('Offene Forderungen: ungültige Keyset-Seite');
      letzteId = row.id;
      rows.push(row);
    }
    // Auch nach exakt voller oder serverseitig gekappter Seite weiter bis leer.
  }
}

async function ladeChunks(supabase, tenantId, tabelle, feld, ids) {
  const rows = [];
  const eindeutigIds = [...new Set(ids.filter(idOk))];
  for (let i = 0; i < eindeutigIds.length; i += 200) {
    rows.push(...await ladeSeiten(supabase, tenantId, tabelle, feld, eindeutigIds.slice(i, i + 200)));
  }
  return rows;
}

/**
 * Vollständige, rein lesende B03-Datenbasis je Owner, ohne Standort-/Datumsfilter.
 * Jede Seite und jeder max. 200-ID-Chunk trägt owner_id; keine Personendaten,
 * Freitexte oder Leistungs-JSON. Jeder Ladefehler wirft statt Teilwert-Erfolg.
 * Mehrere Reads sind kein DB-Transaktionssnapshot; Auswertung ist keine Freigabe
 * zum Kassieren. Bestehende Statistik und Schreibwege bleiben unabhängig.
 * @param {{supabase:object,tenantId:string}} opts Injizierter Client; kein eigener Client/Env.
 * @returns {Promise<ReturnType<typeof berechneOffeneForderungen>>}
 */
export async function ladeOffeneForderungen({ supabase, tenantId } = {}) {
  if (typeof tenantId !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(tenantId)) throw new TypeError('Gültige tenantId erforderlich');
  tenantId = tenantId.toLowerCase();
  if (!supabase || typeof supabase.from !== 'function') throw new TypeError('supabase erforderlich');
  const prescriptions = await ladeSeiten(supabase, tenantId, 'prescriptions');
  const koepfe = await ladeSeiten(supabase, tenantId, 'abrechnung');
  const belege = await ladeChunks(supabase, tenantId, 'belegliste', 'prescription_id', prescriptions.map(r => r.id));
  const kopfIds = koepfe.map(k => k.id);
  const zeilen = await ladeChunks(supabase, tenantId, 'abrechnung_zeile', 'abrechnung_id', kopfIds);
  const vorhanden = new Set(zeilen.map(z => z.id));
  const fehlendeUrspruenge = koepfe.map(k => k.zuzahlungsforderung_ursprung_id).filter(id => idOk(id) && !vorhanden.has(id));
  zeilen.push(...await ladeChunks(supabase, tenantId, 'abrechnung_zeile', 'id', fehlendeUrspruenge));
  const zahlungen = await ladeChunks(supabase, tenantId, 'abrechnung_zahlung', 'abrechnung_id', kopfIds);
  return berechneOffeneForderungen({ prescriptions, belege, koepfe, zeilen, zahlungen });
}
