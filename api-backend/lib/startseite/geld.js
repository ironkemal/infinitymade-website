import { berlinMonatsgrenzen } from '../berlin-tag.js';
import { ladeOffeneForderungen } from '../offene-forderungen.js';

const MAX_CENT = BigInt(Number.MAX_SAFE_INTEGER);
const EINNAHMETYPEN = new Set(['zuzahlung', 'rechnung', 'ausfall', 'barverkauf']);

function mandant(tenantId) {
  if (typeof tenantId !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(tenantId)) {
    throw new TypeError('Gültige tenantId erforderlich');
  }
  return tenantId.toLowerCase();
}

/**
 * Gemeinsamer Owner-Keysetreader für Startseitenadapter, ohne Fachformel.
 * Export auch über finanzadapter.js. Jeder Requery baut Owner/Zeitraum neu auf;
 * bis zur LEEREN Seite lesen (auch bei Servercap < 1000). Kein Teilerfolg.
 * Spalten müssen id und owner_id enthalten; keine Wildcards/Freitextprojektion.
 * Keine abhängigen ID-Listen in diesem Reader; B03 behält seinen 200-ID-Reader.
 * @param {{supabase:object,tenantId:string,tabelle:string,spalten:string,zeitraum?:{feld:string,von:string,bisExklusiv:string}}} opts
 * @returns {Promise<object[]>} Vollständige mandantengeprüfte Zeilen, nur intern nutzen.
 */
export async function ladeMandantenZeilen({ supabase, tenantId, tabelle, spalten, zeitraum } = {}) {
  tenantId = mandant(tenantId);
  if (!supabase || typeof supabase.from !== 'function') throw new TypeError('supabase erforderlich');
  if (typeof tabelle !== 'string' || !/^[a-z][a-z_]*$/.test(tabelle)
    || typeof spalten !== 'string' || !/^[a-z_]+(?:,[a-z_]+)*$/.test(spalten)
    || !['id', 'owner_id'].every(feld => spalten.split(',').includes(feld))) {
    throw new TypeError('Explizite Tabelle und Owner-/ID-Projektion erforderlich');
  }
  if (zeitraum !== undefined && (!zeitraum || typeof zeitraum.feld !== 'string' || !/^[a-z_]+$/.test(zeitraum.feld)
    || typeof zeitraum.von !== 'string' || typeof zeitraum.bisExklusiv !== 'string'
    || !zeitraum.von || zeitraum.von >= zeitraum.bisExklusiv)) throw new TypeError('Gültiger Zeitraum erforderlich');
  const rows = [];
  let letzteId = null;
  while (true) {
    let query = supabase.from(tabelle).select(spalten).eq('owner_id', tenantId);
    if (zeitraum) query = query.gte(zeitraum.feld, zeitraum.von).lt(zeitraum.feld, zeitraum.bisExklusiv);
    query = query.order('id', { ascending: true });
    if (letzteId !== null) query = query.gt('id', letzteId);
    const { data, error } = await query.limit(1000);
    if (error || !Array.isArray(data)) throw new Error('STARTSEITE_QUELLE_NICHT_VERFUEGBAR');
    if (data.length === 0) return rows;
    for (const row of data) {
      if (!row || row.owner_id !== tenantId) throw new Error('STARTSEITE_MANDANT_WIDERSPRUCH');
      if (typeof row.id !== 'string' || !row.id || row.id.trim() !== row.id
        || (letzteId !== null && row.id <= letzteId)) throw new Error('STARTSEITE_KEYSET_UNGUELTIG');
      letzteId = row.id;
      rows.push(row);
    }
  }
}

// numeric(10,2) aus beiden Journalen: exakt in Cent, niemals Number(raw)*100.
// Subcent/Exponenten/Überlauf bleiben Unknown, keine Rundungs- oder Tarifformel.
function cent(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  if (typeof raw === 'number' && !Number.isFinite(raw)) return null;
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(raw));
  if (!match) return null;
  const [, sign, ganz, bruch = ''] = match;
  if (bruch.length > 2 && /[1-9]/.test(bruch.slice(2))) return null;
  const wert = BigInt(ganz) * 100n + BigInt(bruch.slice(0, 2).padEnd(2, '0'));
  if (wert > MAX_CENT) return null;
  return sign === '-' ? -wert : wert;
}

function sichereCent(wert) {
  if (wert > MAX_CENT || wert < -MAX_CENT) throw new RangeError('Startseitensumme überschreitet sichere Centzahl');
  return Number(wert);
}

function cashSumme(rows, kasse, anomalien) {
  let bekannt = 0n;
  let unbekanntAnzahl = 0;
  const gruende = new Set();
  for (const row of rows) {
    let grund;
    const wert = cent(kasse ? row.betrag_eur : row.amount_eur);
    if (kasse) {
      // Schema/Routenschreibweg kennt keine Ursprungs-FK für Korrekturen.
      // Abschreibung tilgt Forderung, belegt aber keinen Geldfluss.
      if (row.art === 'abschreibung') continue;
      if (row.art === 'korrektur') grund = 'KASSE_KORREKTUR_UNGEKLAERT';
      else if (!['zahlung', 'ruecklastschrift'].includes(row.art)) grund = 'KASSE_ART_UNBEKANNT';
      else if (wert === null) grund = 'KASSE_BETRAG_UNGUELTIG';
      else if ((row.art === 'zahlung' && wert <= 0n) || (row.art === 'ruecklastschrift' && wert >= 0n)) grund = 'KASSE_VORZEICHEN_UNGUELTIG';
    } else {
      // db/SCHEMA.sql belegliste_type_check + billing/belegliste/helper.js:
      // rechnung/ausfall/zuzahlung = Einnahmen, barverkauf = lesbarer Altbestand.
      // SCHEMA-RLS.sql rechnung_zahlung_buchen schreibt ALLE Zahlarten ins
      // Journal; Ausbuchung bleibt ohne Beleg. rechnung_zahlungen nie addieren.
      if (!EINNAHMETYPEN.has(row.type) && row.type !== 'storno') grund = 'PATIENT_TYP_UNBEKANNT';
      else if (wert === null) grund = 'PATIENT_BETRAG_UNGUELTIG';
      else if ((row.type === 'storno' && wert >= 0n) || (row.type !== 'storno' && wert <= 0n)) grund = 'PATIENT_VORZEICHEN_UNGUELTIG';
    }
    if (grund) {
      unbekanntAnzahl++;
      gruende.add(grund);
      anomalien.set(grund, (anomalien.get(grund) || 0) + 1);
    } else bekannt += wert;
  }
  const bekanntCent = sichereCent(bekannt);
  return { bekanntCent, gesamtCent: unbekanntAnzahl ? null : bekanntCent, unbekanntAnzahl, gruende: [...gruende].sort() };
}

/**
 * B05a: spätere Startseiten-Geldkarte, Scope ganzer Mandant, keine Standortfilter.
 * E13: Patienteneingänge aus belegliste.created_at im Berliner Erfassungsmonat,
 * Kasseneingänge getrennt aus abrechnung_zahlung.datum (DATE). Kein Zahlungsdatum
 * für Patienten behauptet, Stornos bleiben im jeweiligen Erfassungsmonat.
 * B03 unverändert: nur GKV-Zuzahlung/VKZ03; keine Personen-/Posten-IDs ausliefern.
 * Privat/Ausfall NICHT geladen: bekannte Teilsumme 0, Gesamt und Anzahl unbekannt.
 * Keine übergreifende Offen-Summe, kein Transaktionssnapshot/Kassierfreigabe.
 * Lade-/Mandanten-/Keysetfehler werfen; B04 maskiert Blockfehler ohne Rohdetails.
 * Summe.gruende und anomalien.code sind feste Codes; Quelle/Umfang erklären sie.
 * @param {{supabase:object,tenantId:string,jetzt?:Date}} opts Client/Uhr injiziert, kein Env/eigener Client.
 * @returns {Promise<object>} Nur JSON-Aggregate, Cent stets sichere Ganzzahlen.
 */
export async function ladeGeld({ supabase, tenantId, jetzt = new Date() } = {}) {
  tenantId = mandant(tenantId);
  const grenzen = berlinMonatsgrenzen(jetzt);
  if (!grenzen) throw new TypeError('Gültige Uhr erforderlich');
  const { monat, von, bisExklusiv } = grenzen;
  // DATE-Feld aus Berliner Monat ableiten, nicht aus UTC-Starttag (oft Vortag).
  const [jahr, nummer] = monat.split('-').map(Number);
  const folge = `${String(nummer === 12 ? jahr + 1 : jahr).padStart(4, '0')}-${String(nummer === 12 ? 1 : nummer + 1).padStart(2, '0')}-01`;
  const belege = await ladeMandantenZeilen({ supabase, tenantId, tabelle: 'belegliste',
    spalten: 'id,owner_id,type,amount_eur', zeitraum: { feld: 'created_at', von, bisExklusiv } });
  const zahlungen = await ladeMandantenZeilen({ supabase, tenantId, tabelle: 'abrechnung_zahlung',
    spalten: 'id,owner_id,art,betrag_eur', zeitraum: { feld: 'datum', von: `${monat}-01`, bisExklusiv: folge } });
  const b03 = await ladeOffeneForderungen({ supabase, tenantId });
  const anomalien = new Map();
  const patient = cashSumme(belege, false, anomalien);
  const kasse = cashSumme(zahlungen, true, anomalien);
  for (const { code } of b03.anomalien) anomalien.set(code, (anomalien.get(code) || 0) + 1);
  const bekanntCent = sichereCent(BigInt(b03.patientBekanntCent) + BigInt(b03.kasseBekanntCent) + BigInt(b03.klaerungBekanntCent));
  const zuzahlung = {
    bekanntCent, gesamtCent: b03.gesamtCent, unbekanntAnzahl: b03.unbekanntAnzahl,
    gruende: [...new Set(b03.posten.filter(p => p.restCent === null).map(p => p.grundCode))].sort(),
    patientBekanntCent: b03.patientBekanntCent, kasseBekanntCent: b03.kasseBekanntCent, klaerungBekanntCent: b03.klaerungBekanntCent,
  };
  return {
    scope: 'mandant', monat,
    quelle: { patient: 'belegliste.created_at', kasse: 'abrechnung_zahlung.datum', zuzahlung: 'B03_GKV_VKZ03',
      privat: 'NICHT_GELADEN', ausfall: 'NICHT_GELADEN' },
    umfang: {
      patient: 'Kassiert diesen Monat (erfasst im Kassenbuch)',
      kasse: 'Kasseneingänge diesen Monat nach Zahlungsdatum im Kassenjournal',
      zuzahlung: 'Offene GKV-Zuzahlungen einschließlich VKZ 03, gesamter Bestand nach B03',
      privat: 'Offene Privatforderungen nicht geladen', ausfall: 'Offene Ausfallforderungen nicht geladen',
      erklaerung: 'Alle Standorte und Zahlarten. Patienteneingänge nach Erfassungsdatum, kein Nachweis des Zahlungsdatums. '
        + 'Stornos zählen im Erfassungsmonat. Kasse: Zahlung und negative Rücklastschrift; Abschreibung ist kein Geldfluss. '
        + 'Korrektur ohne Ursprungsbezug, unbekannte Arten, ungültige Beträge oder Vorzeichen bleiben unbekannt; '
        + 'bekannte Teilsummen bleiben erhalten. Privat/Ausfall: Gesamtbetrag und Anzahl unbekannt. Mehrere Reads sind kein Transaktionssnapshot.',
    },
    kassiert: { patient, kasse },
    offen: { zuzahlung,
      privat: { bekanntCent: 0, gesamtCent: null, unbekanntAnzahl: null, gruende: ['PRIVAT_NICHT_GELADEN'] },
      ausfall: { bekanntCent: 0, gesamtCent: null, unbekanntAnzahl: null, gruende: ['AUSFALL_NICHT_GELADEN'] } },
    anomalien: [...anomalien].sort(([a], [b]) => a.localeCompare(b)).map(([code, anzahl]) => ({ code, anzahl })),
  };
}
