import { ladeMandantenZeilen } from './finanzadapter.js';
import { ladeOffeneForderungen } from '../offene-forderungen.js';

const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const MAX_CENT = BigInt(Number.MAX_SAFE_INTEGER);
const MAHNSTATUS = new Set(['offen', 'bezahlt', 'abgeschrieben']);
const AUSFALL_TERMINAL = new Set(['bezahlt', 'storniert', 'abgeschrieben']);
const uuid = value => typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null;

function sichereCent(wert) {
  if (wert < 0n || wert > MAX_CENT) throw new RangeError('Mahnsumme überschreitet sichere Centzahl');
  return Number(wert);
}

// Exakte Dezimalumwandlung gespeicherter numeric(10,2)-Werte. Kein Float*100,
// keine Rundung, kein Tarif, keine Toleranz: Subcent bleibt unbekannt.
function exactDecimal(raw) {
  if (!['number', 'string'].includes(typeof raw) || (typeof raw === 'number' && !Number.isFinite(raw))) return null;
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(raw));
  if (!match) return null;
  const [, sign, ganz, bruch = ''] = match;
  if (bruch.length > 2 && /[1-9]/.test(bruch.slice(2))) return null;
  const cent = BigInt(ganz) * 100n + BigInt(bruch.slice(0, 2).padEnd(2, '0'));
  if (cent > MAX_CENT) throw new RangeError('Mahnbetrag überschreitet sichere Centzahl');
  return sign === '-' ? -cent : cent;
}

function gruppiereHistorie(rows) {
  const gruppen = new Map();
  for (const row of rows) {
    const rezept = uuid(row.prescription_id), ausfall = uuid(row.ausfallrechnung_id);
    // Nicht zuordenbare Herkunft/Stufe könnte jede Stufe verfälschen: ganzer
    // Block unavailable, niemals eine scheinbar vollständige Nullantwort.
    if ((row.prescription_id != null && rezept === null) || (row.ausfallrechnung_id != null && ausfall === null)
      || Number(rezept !== null) + Number(ausfall !== null) !== 1
      || !Number.isInteger(row.level) || row.level < 1 || row.level > 3 || !MAHNSTATUS.has(row.status)) {
      throw new Error('MAHNUNGEN_QUELLE_NICHT_VERFUEGBAR');
    }
    const art = rezept ? 'zuzahlung' : 'ausfall';
    const refId = rezept || ausfall;
    const key = `${art}:${refId}`;
    const gruppe = gruppen.get(key);
    if (!gruppe || row.level > gruppe.stufe) {
      gruppen.set(key, { art, refId, stufe: row.level, status: new Set([row.status]) });
    } else if (row.level === gruppe.stufe) gruppe.status.add(row.status);
  }
  return [...gruppen.values()];
}

function ausfallRest(rows) {
  if (!rows || rows.length !== 1) return { cent: null, grund: 'AUSFALL_REST_NICHT_ZUORDENBAR' };
  const row = rows[0];
  // Original Bildschirmvertrag: mahnwesen.routes.js:195ff; SCHEMA.sql
  // ausfallrechnungen/belegliste: keine AF-FK. Kein Freitext-Journalabzug.
  if (AUSFALL_TERMINAL.has(row.status)) return { cent: 0 };
  if (row.status !== 'offen') return { cent: null, grund: 'AUSFALL_STATUS_UNBEKANNT' };
  const wert = exactDecimal(row.amount_eur);
  if (wert === null || wert <= 0n) return { cent: null, grund: 'AUSFALL_BETRAG_UNGUELTIG' };
  return { cent: sichereCent(wert) };
}

/**
 * B06: bereits gemahnte Forderungen je Mandant, jede Forderungsart/FK einmal
 * auf höchster Stufe. Keine neue Mahnberechtigung, kein Fälligkeits-/Monatsfilter.
 * Umfang: KEINE beweisbar vollständige Privat-/BG-/Selbstzahlerforderung;
 * Rezeptreste nur bei eindeutiger B03-Patientenzuordnung. Nach VKZ03-Übertragung
 * verweist B03 auf den Kopf: kein Rezeptposten bedeutet Unknown, keine erneute
 * Patientenforderung. B03-Gesamtsummen werden niemals übernommen/nachgerechnet.
 * Terminale Mahnstatus schließen nur die Mahngruppe, beweisen weder Zahlung
 * noch Schuldänderung. Widersprüchliche Höchststatus machen Count/Summe unbekannt.
 * Feste Gründe: B03_REST_NICHT_ZUORDENBAR (kein eindeutiger Patientenposten),
 * B03_REST_UNBEKANNT (B03-Rest unbekannt), AUSFALL_REST_NICHT_ZUORDENBAR,
 * AUSFALL_STATUS_UNBEKANNT, AUSFALL_BETRAG_UNGUELTIG, MAHNSTATUS_WIDERSPRUCH.
 * B03_ANOMALIE zählt ausschließlich B03-Anomalien zu verwendeten Rezeptposten;
 * weder refId noch fremde Codes/Freitexte verlassen diesen Adapter.
 * Reads sind kein Transaktionssnapshot. Lade-/Owner-/Keysetfehler werfen;
 * B04 maskiert sie. Sichere Integer-Cent, Überlauf wirft statt Rundung/Null.
 * Zweck/erste Verwendung: Startseiten-Mahnkarte über explizite Factory-Injektion;
 * zuerst synthetisch in mahnungen.test.js inklusive echter B04-Routergrenze.
 * @param {{supabase:object,tenantId:string,jetzt?:Date}} opts Nur injizierte Quellen.
 * @returns {Promise<object>} Ausschließlich Aggregate, keine Personen/Forderungs-IDs.
 */
export async function ladeMahnungen({ supabase, tenantId, jetzt = new Date() } = {}) {
  const mandant = uuid(tenantId);
  if (!mandant) throw new TypeError('Gültige tenantId erforderlich');
  if (!supabase || typeof supabase.from !== 'function') throw new TypeError('supabase erforderlich');
  if (!(jetzt instanceof Date) || !Number.isFinite(jetzt.getTime())) throw new TypeError('Gültige Uhr erforderlich');
  const rows = await ladeMandantenZeilen({ supabase, tenantId: mandant, tabelle: 'mahnungen',
    spalten: 'id,owner_id,prescription_id,ausfallrechnung_id,level,status' });
  const gruppen = gruppiereHistorie(rows);
  const offen = gruppen.filter(g => g.status.size === 1 && g.status.has('offen'));
  const rezeptIds = new Set(offen.filter(g => g.art === 'zuzahlung').map(g => g.refId));
  const patienten = new Map(), ausfaelle = new Map(), anomalien = new Map();
  const anomalie = code => anomalien.set(code, (anomalien.get(code) || 0) + 1);
  if (rezeptIds.size) {
    const b03 = await ladeOffeneForderungen({ supabase, tenantId: mandant });
    for (const p of b03.posten) {
      const refId = uuid(p.refId);
      if (p.quelle !== 'patient' || !rezeptIds.has(refId)) continue;
      if (!patienten.has(refId)) patienten.set(refId, []);
      patienten.get(refId).push(p);
    }
    for (const a of b03.anomalien) if (rezeptIds.has(uuid(a.refId))) anomalie('B03_ANOMALIE');
  }
  if (offen.some(g => g.art === 'ausfall')) {
    const rows = await ladeMandantenZeilen({ supabase, tenantId: mandant, tabelle: 'ausfallrechnungen',
      spalten: 'id,owner_id,status,amount_eur' });
    for (const row of rows) {
      const refId = uuid(row.id);
      if (!ausfaelle.has(refId)) ausfaelle.set(refId, []);
      ausfaelle.get(refId).push(row);
    }
  }
  const stufen = [1, 2, 3].map(stufe => ({ stufe, bekanntAnzahl: 0, anzahl: 0,
    rest: { bekanntCent: 0, gesamtCent: 0, unbekanntAnzahl: 0, gruende: [] } }));
  for (const g of gruppen) {
    const stufe = stufen[g.stufe - 1];
    let cent, grund;
    if (g.status.size > 1) {
      stufe.anzahl = null;
      cent = null; grund = 'MAHNSTATUS_WIDERSPRUCH';
    } else {
      if (!g.status.has('offen')) continue;
      stufe.bekanntAnzahl++;
      if (stufe.anzahl !== null) stufe.anzahl++;
      if (g.art === 'ausfall') ({ cent, grund } = ausfallRest(ausfaelle.get(g.refId)));
      else {
        const posten = patienten.get(g.refId);
        if (!posten || posten.length !== 1) { cent = null; grund = 'B03_REST_NICHT_ZUORDENBAR'; }
        else {
          cent = posten[0].restCent;
          if (cent === null) grund = 'B03_REST_UNBEKANNT';
          else if (!Number.isSafeInteger(cent) || cent < 0) throw new Error('MAHNUNGEN_QUELLE_NICHT_VERFUEGBAR');
        }
      }
    }
    if (cent === null) {
      stufe.rest.unbekanntAnzahl++;
      stufe.rest.gesamtCent = null;
      if (!stufe.rest.gruende.includes(grund)) stufe.rest.gruende.push(grund);
      anomalie(grund);
    } else {
      stufe.rest.bekanntCent = sichereCent(BigInt(stufe.rest.bekanntCent) + BigInt(cent));
      if (stufe.rest.gesamtCent !== null) stufe.rest.gesamtCent = stufe.rest.bekanntCent;
    }
  }
  for (const stufe of stufen) stufe.rest.gruende.sort();
  return {
    scope: 'mandant', umfang: 'Bereits gemahnte Forderungen; höchste Stufe; aktueller belegter Rest', stufen,
    anomalien: [...anomalien].sort(([a], [b]) => a.localeCompare(b)).map(([code, anzahl]) => ({ code, anzahl })),
  };
}
