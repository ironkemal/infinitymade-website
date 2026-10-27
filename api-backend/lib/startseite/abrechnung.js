import { ladeMandantenZeilen } from './finanzadapter.js';
import { flacheBehandlungen } from '../../billing/zuzahlung/erbrachte-sitzungen.js';
import { resolvePreis } from '../../billing/preise/resolver.js';
import { betraegeFuerVerordnung } from '../../billing/utils/abrechnung-zeilen.js';
import { legsFuer, abrechnungscodeAusLegs } from '../../billing/codes/legs.js';
import { verordnungFestschreiben } from '../../billing/api/betriebsart.js';
import { berlinHeute, istStichtag } from '../berlin-tag.js';

const MAX_CENT = BigInt(Number.MAX_SAFE_INTEGER);
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const BEREICHE = { podo: ['podologie', 'podologie'], physio: ['physiotherapie', 'physiotherapy'] };
const KOPFSTATUS = new Set(['erstellt', 'heruntergeladen', 'gesendet', 'accepted', 'paid']);
const ZEILENSTATUS = new Set(['eingereicht', 'akzeptiert', 'nachgereicht']);
const idOk = value => typeof value === 'string' && value.length > 0 && value.trim() === value;

// DB numeric(10,2): exakte Cent, keine Exponenten, Subcent oder stille Rundung.
// Overflow ist ein Blockfehler, niemals Unknown oder ein gekürzter Teilbetrag.
function cent(raw) {
  if (!['string', 'number'].includes(typeof raw)) return null;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(raw));
  if (!match || (match[2]?.length > 2 && /[1-9]/.test(match[2].slice(2)))) return null;
  const value = BigInt(match[1]) * 100n + BigInt((match[2] || '').slice(0, 2).padEnd(2, '0'));
  sichereCent(value);
  return value;
}
function sichereCent(value) {
  if (value > MAX_CENT || value < 0n) throw new RangeError('Startseitensumme überschreitet sichere Centzahl');
  return Number(value);
}
function gruppiere(rows, feld) {
  const result = new Map();
  for (const row of rows) {
    const key = row[feld];
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
  }
  return result;
}

/**
 * prescription_sessions besitzt KEIN owner_id. Parentjoin und Ownerfilter auf
 * JEDER Keysetseite; Antwort gegen Parentowner, Chunk-IDs und done prüfen.
 * 200 IDs je Chunk (B03-Muster), eigener Cursor je Chunk, bis LEERE Schlussseite.
 * Kein Personenjoin, keine abhängigen unbeschränkten Session-Relationen.
 */
async function ladePhysiositzungen({ supabase, tenantId, ids }) {
  const result = [];
  const gesehen = new Set();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200);
    const erlaubt = new Set(chunk);
    let letzteId = null;
    while (true) {
      let query = supabase.from('prescription_sessions')
        .select('id,prescription_id,status,done_at,heilmittel_index,prescriptions!inner(owner_id)')
        .eq('prescriptions.owner_id', tenantId).in('prescription_id', chunk).eq('status', 'done')
        .order('id', { ascending: true });
      if (letzteId !== null) query = query.gt('id', letzteId);
      const { data, error } = await query.limit(1000);
      if (error || !Array.isArray(data)) throw new Error('STARTSEITE_QUELLE_NICHT_VERFUEGBAR');
      if (!data.length) break;
      for (const row of data) {
        if (!row || row.prescriptions?.owner_id !== tenantId || !erlaubt.has(row.prescription_id)
          || row.status !== 'done') throw new Error('STARTSEITE_SESSION_ZUORDNUNG_WIDERSPRUCH');
        if (!idOk(row.id) || (letzteId !== null && row.id <= letzteId) || gesehen.has(row.id)) {
          throw new Error('STARTSEITE_KEYSET_UNGUELTIG');
        }
        gesehen.add(row.id);
        letzteId = row.id;
        result.push(row);
      }
    }
  }
  return result;
}

function snapshot(rx, zeilen, koepfe, belegRezepte) {
  const gruende = new Set();
  if (!idOk(rx.abrechnung_id) || !idOk(rx.belegnummer)) gruende.add('SNAPSHOT_ZUORDNUNG_UNKLAR');
  if (zeilen.length !== 1) gruende.add('SNAPSHOT_FEHLT_ODER_MEHRDEUTIG');
  if (idOk(rx.belegnummer) && belegRezepte.get(rx.belegnummer)?.length !== 1) gruende.add('SNAPSHOT_ZUORDNUNG_UNKLAR');
  for (const z of zeilen) {
    if (z.prescription_id !== rx.id || z.abrechnung_id !== rx.abrechnung_id || z.belegnummer !== rx.belegnummer) {
      gruende.add('SNAPSHOT_ZUORDNUNG_UNKLAR');
    }
    if (z.herkunft !== 'einreichung') gruende.add('SNAPSHOT_HERKUNFT_UNKLAR');
    if (!ZEILENSTATUS.has(z.status)) gruende.add('SNAPSHOT_ABSETZUNG_UNGEKLAERT');
    const kopf = koepfe.get(z.abrechnung_id);
    if (!kopf || !KOPFSTATUS.has(kopf.status) || !verordnungFestschreiben(kopf.betriebsart)
      || kopf.verarbeitungskennzeichen !== '01') gruende.add('SNAPSHOT_KOPF_UNKLAR');
    // Keine Absetzung schätzen: Status/Betrag ohne vollständigen Nachweis sperrt.
    if (cent(z.absetzung_eur) !== 0n) gruende.add('SNAPSHOT_ABSETZUNG_UNGEKLAERT');
    const brutto = cent(z.brutto_eur);
    const zuzahlung = cent(z.zuzahlung_eur);
    const netto = cent(z.netto_eur);
    if ([brutto, zuzahlung, netto].includes(null) || zuzahlung > brutto || brutto - zuzahlung !== netto) {
      gruende.add('SNAPSHOT_BETRAG_UNGUELTIG');
    }
  }
  return { gruende, wert: gruende.size ? null : cent(zeilen[0].netto_eur) };
}

function leistungsdatum(raw) {
  if (istStichtag(raw)) return raw;
  // done_at ist timestamptz: explizite Zone, echtes Kalenderdatum, Berlin-Tag.
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)
    || !istStichtag(raw.slice(0, 10))) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? berlinHeute(date) : null;
}

function ausLeistungen(rx, behandlungen, physiositzungen) {
  const gruende = new Set();
  let sitzungen;
  if (rx.therapie_bereich === 'podo') {
    const aktiv = behandlungen.filter(b => b.storniert_am === null);
    if (behandlungen.some(b => b.storniert_am === undefined)
      || aktiv.some(b => !Array.isArray(b.hpnr_codes) || !b.hpnr_codes.length
        || b.hpnr_codes.some(code => typeof code !== 'string' || !code.trim()))) {
      gruende.add('LEISTUNGEN_UNGEKLAERT');
    }
    // Erst validieren: flacheBehandlungen würde NULL/Leerwerte still auslassen.
    sitzungen = flacheBehandlungen(aktiv.filter(b => Array.isArray(b.hpnr_codes)));
  } else {
    // NULL ist laut bestehendem Kombi-Index der historische Hauptindex 0.
    // Zusatzheilmittel haben eine eigene Zuordnung, die hier nicht geladen wird.
    // Ohne diese Quelle niemals mit der Hauptposition bepreisen.
    if (physiositzungen.some(s => s.heilmittel_index !== null && s.heilmittel_index !== 0)) {
      gruende.add('HEILMITTEL_ZUORDNUNG_UNGEKLAERT');
    }
    sitzungen = physiositzungen.map(s => ({ done_at: s.done_at, code: rx.heilmittel_position }));
  }
  if (!sitzungen.length) gruende.add('LEISTUNGEN_UNGEKLAERT');
  const [bereich, fachbereich] = BEREICHE[rx.therapie_bereich];
  const abrechnungscode = abrechnungscodeAusLegs(legsFuer(fachbereich));
  const sessions = [];
  let bruttoCent = 0n;
  for (const s of sitzungen) {
    const datum = leistungsdatum(s.done_at);
    if (!datum) { gruende.add('LEISTUNGSDATUM_UNGEKLAERT'); continue; }
    if (!idOk(s.code)) { gruende.add('PREIS_UNBEKANNT'); continue; }
    const preis = resolvePreis({ bereich, code: s.code, datum, abrechnungscode });
    // Preisfenster allein beweist nicht, dass die Position noch zulässig ist.
    // Deprecated bleibt für historische Leistungen vor ungueltig_ab zulässig.
    const ungueltigAb = preis.katalogPosition?.ungueltig_ab;
    if (ungueltigAb != null && (!istStichtag(ungueltigAb) || datum >= ungueltigAb)) {
      gruende.add('POSITION_UNGUELTIG');
      continue;
    }
    // Resolver macht raw preis NULL zu 0. Nur mit echtem Rohpreis akzeptieren.
    const rawCent = cent(preis.katalogPosition?.preis);
    const preisCent = cent(preis.preis_eur);
    const zuCent = cent(preis.zuzahlung_eur);
    if (!preis.gefunden || preis.ausserhalb_preisfenster || rawCent === null || preisCent !== rawCent
      || zuCent === null || zuCent > rawCent) { gruende.add('PREIS_UNBEKANNT'); continue; }
    bruttoCent += rawCent;
    sichereCent(bruttoCent);
    sessions.push({ einzelbetrag: preis.preis_eur, anzahl: 1, zuzahlungProPos: preis.zuzahlung_eur });
  }
  if (gruende.size) return { gruende, wert: null };
  // Einziger Betragspfad: bestehende DTA-Formel. Keine Erwachsenenannahme.
  const betrag = betraegeFuerVerordnung({ sessions, verordnung: { zuzahlungskennzeichen: '1' } });
  const netto = cent(betrag.netto);
  if (cent(betrag.brutto) !== bruttoCent || cent(betrag.zuzahlung) !== 0n || netto !== bruttoCent) {
    gruende.add('LEISTUNGSBETRAG_UNGUELTIG');
  }
  return { gruende, wert: gruende.size ? null : netto };
}

/**
 * B06 Bereit-Karte, nur Aggregat für Inhaber über explizite Factory-Injection.
 * niye: VO einmal zählen, Kassenanteil belegbar schätzen statt Null/Teilpreis.
 * nerede: createFinanzlader({lader:{abrechnung:ladeAbrechnung}}), B04 liefert
 * Blockfehler maskiert; keine Defaultverdrahtung/Router-/Serveränderung hier.
 *
 * Quelle des Counts ausschließlich prescriptions.abrechnung_status. GKV NULL
 * ist Altbestand; rejected/teilabsetzung sind eigene Rezeptstatus, NICHT die
 * Zeilencodes abgesetzt/teilabgesetzt. istEinreichbar ist keine Bereitregel.
 *
 * Snapshot bevorzugt nur bei eindeutiger Rezept/Kopf/Belegzuordnung, echter
 * Einreichung, VKZ01 und plausiblen exakten Cent. Jeder Konflikt sperrt Fallback.
 * Ohne Snapshot: nur Podo/Physio + explizite Befreiung; Leistungsdatum ist
 * Preistag. Keine Altersannahme/Geburtsdaten, keine Rekonstruktion von Belegen.
 * Sämtliche Owner-Reads praxisweit/keyset-vollständig; mehrere Reads sind kein
 * Transaktionssnapshot. Abhängige Tabellen ausschließlich bei tatsächlichem
 * Bedarf. Query-/Mandanten-/Cursorfehler werfen, feste Unknowncodes je VO.
 * @param {{supabase:object,tenantId:string,jetzt?:Date}} opts
 * @returns {Promise<object>} Sichere Integercent, feste sortierte Gründe, keine IDs/PII.
 */
export async function ladeAbrechnung({ supabase, tenantId, jetzt = new Date() } = {}) {
  if (typeof tenantId !== 'string' || !UUID.test(tenantId)) throw new TypeError('Gültige tenantId erforderlich');
  if (!supabase || typeof supabase.from !== 'function') throw new TypeError('supabase erforderlich');
  if (!(jetzt instanceof Date) || !Number.isFinite(jetzt.getTime())) throw new TypeError('Gültige Uhr erforderlich');
  tenantId = tenantId.toLowerCase();
  const lesen = (tabelle, spalten) => ladeMandantenZeilen({ supabase, tenantId, tabelle, spalten });
  const prescriptions = await lesen('prescriptions', 'id,owner_id,rezeptart,abrechnung_status,therapie_bereich,heilmittel_position,zuzahlung_befreit,abrechnung_id,belegnummer');
  if (prescriptions.some(p => ![null, 'kassen', 'privat', 'selbstzahler', 'bg'].includes(p.rezeptart))) {
    throw new Error('STARTSEITE_REZEPTART_WIDERSPRUCH');
  }
  const gkv = prescriptions.filter(p => p.rezeptart === 'kassen' || p.rezeptart === null);
  const bereit = gkv.filter(p => p.abrechnung_status === 'bereit');
  const abgesetzt = { anzahl: gkv.filter(p => p.abrechnung_status === 'rejected').length };
  const teilabgesetzt = { anzahl: gkv.filter(p => p.abrechnung_status === 'teilabsetzung').length };
  const auswertungen = new Map();
  if (bereit.length) {
    const zeilen = await lesen('abrechnung_zeile', 'id,owner_id,abrechnung_id,prescription_id,belegnummer,herkunft,status,brutto_eur,zuzahlung_eur,netto_eur,absetzung_eur');
    const nachRezept = gruppiere(zeilen, 'prescription_id');
    const nachBeleg = gruppiere(zeilen, 'belegnummer');
    const belegRezepte = gruppiere(prescriptions.filter(p => idOk(p.belegnummer)), 'belegnummer');
    const kandidaten = new Map(bereit.map(p => [p.id, [...new Set([
      ...(nachRezept.get(p.id) || []), ...(idOk(p.belegnummer) ? nachBeleg.get(p.belegnummer) || [] : []),
    ])]]));
    const kopfNoetig = bereit.some(p => kandidaten.get(p.id).length);
    const koepfe = new Map((kopfNoetig ? await lesen('abrechnung', 'id,owner_id,status,betriebsart,verarbeitungskennzeichen') : []).map(k => [k.id, k]));
    const fallback = [];
    for (const p of bereit) {
      const zeilen = kandidaten.get(p.id);
      if (zeilen.length || p.abrechnung_id != null || p.belegnummer != null) {
        auswertungen.set(p.id, snapshot(p, zeilen, koepfe, belegRezepte));
      } else {
        const gruende = new Set();
        if (!Object.hasOwn(BEREICHE, p.therapie_bereich)) gruende.add('PREISBEREICH_NICHT_BELEGT');
        if (p.zuzahlung_befreit !== true) gruende.add('BEFREIUNG_UNGEKLAERT');
        if (gruende.size) auswertungen.set(p.id, { gruende, wert: null });
        else fallback.push(p);
      }
    }
    const podo = fallback.filter(p => p.therapie_bereich === 'podo');
    const physio = fallback.filter(p => p.therapie_bereich === 'physio');
    const behandlungen = podo.length ? await lesen('podologie_behandlungen', 'id,owner_id,verordnung_id,behandlungsdatum,hpnr_codes,storniert_am') : [];
    const sitzungen = physio.length ? await ladePhysiositzungen({ supabase, tenantId, ids: physio.map(p => p.id) }) : [];
    const nachVo = gruppiere(behandlungen, 'verordnung_id');
    const nachRx = gruppiere(sitzungen, 'prescription_id');
    for (const p of fallback) auswertungen.set(p.id, ausLeistungen(p, nachVo.get(p.id) || [], nachRx.get(p.id) || []));
  }
  let bekannt = 0n;
  let unbekanntAnzahl = 0;
  const gruende = new Map();
  for (const { wert, gruende: codes } of auswertungen.values()) {
    if (wert === null) {
      unbekanntAnzahl++;
      for (const code of codes) gruende.set(code, (gruende.get(code) || 0) + 1);
    } else { bekannt += wert; sichereCent(bekannt); }
  }
  const bekanntCent = sichereCent(bekannt);
  return {
    bereit: { anzahl: bereit.length, bekanntCent, gesamtCent: unbekanntAnzahl ? null : bekanntCent,
      unbekanntAnzahl, gruende: [...gruende].sort(([a], [b]) => a.localeCompare(b)).map(([code, anzahl]) => ({ code, anzahl })) },
    abgesetzt, teilabgesetzt, quelle: 'prescriptions.abrechnung_status',
    umfang: 'praxisweit; Kassenanteil-Schätzung; kein Transaktionssnapshot', scope: 'mandant', ungefaehr: true,
  };
}
