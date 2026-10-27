import { alsBerlinDatum } from './berlin-datum.js';
import { behandlungsbeginnFrist, pruefeBehandlungsbeginn } from './heilmittel-fristen.js';
import { pauseLage, PODO_PAUSE_MAX_TAGE } from './podo-unterbrechung.js';

const KATEGORIEN = ['beginnVerpasst', 'beginnBald', 'pauseDroht', 'pauseVerpasst', 'ohneFolgetermin'];
const BEREICHE = ['podologie', 'physiotherapie', 'ergotherapie', 'logopaedie'];
const tag = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && alsBerlinDatum(x) === x;
const tagesabstand = (a, b) => (Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000;
const quelleOk = q => q?.status === 'ok' && q.vollstaendig === true && Array.isArray(q.daten);

function historienstand(r, heute) {
  const q = r.behandlungen;
  const daten = Array.isArray(q?.daten) ? q.daten : [];
  let gueltig = true;
  const erfolgt = [];
  for (const b of daten) {
    if (!b || typeof b !== 'object' || !(b.storniert_am === null || typeof b.storniert_am === 'string')) { gueltig = false; continue; }
    if (b.storniert_am) { if (!alsBerlinDatum(b.storniert_am)) gueltig = false; continue; }
    if (!tag(b.behandlungsdatum) || b.behandlungsdatum > heute) { gueltig = false; continue; }
    erfolgt.push(b);
  }
  const beginnGueltig = r.behandlungsbeginn === null || (tag(r.behandlungsbeginn) && r.behandlungsbeginn <= heute);
  const vollstaendig = quelleOk(q) && gueltig && beginnGueltig;
  // Ein bestätigter Treffer genügt als positiver Nachweis, nicht als vollständige Historie.
  const begonnen = (beginnGueltig && r.behandlungsbeginn !== null) || erfolgt.length > 0;
  return { erfolgt, begonnen, vollstaendig, beginnBekannt: begonnen || vollstaendig };
}

function terminstand(q, heute) {
  let gueltig = true, geplant = false;
  for (const t of Array.isArray(q?.daten) ? q.daten : []) {
    if (!t || !tag(t.tag) || !['geplant', 'abgesagt'].includes(t.status)) { gueltig = false; continue; }
    if (t.status === 'geplant' && t.tag >= heute) geplant = true;
  }
  return { geplant, bekannt: geplant || (quelleOk(q) && gueltig) };
}

/**
 * Reiner Hinweisrechner für Startseite und spätere Verordnungsliste. Keine Rechteprüfung,
 * Datenabfrage, HTML-Ausgabe oder neue Gültigkeitsregel. Loader muss den zulässigen
 * Mandanten-/Mitarbeiterumfang herstellen und Vollständigkeit tatsächlich nachweisen.
 * Nur aktive, für diese Heilmittelregeln belegbar geeignete VO normalisieren; dieser
 * Rechner entscheidet weder Rezeptart/GKV-Anwendbarkeit noch Archiv-/Abschlussstatus.
 *
 * Input v1: { version:1, heute:'YYYY-MM-DD', verordnungen:Quelle<Verordnung> }.
 * Quelle = { status:'ok'|'laden'|'fehler', vollstaendig:boolean, daten:Array }.
 * Auch unvollständige Quellen dürfen bestätigte Einzelzeilen enthalten. Keine implizite
 * Leerquelle: fehlende/fehlerhafte Quellen bleiben Unknown. Vollständigkeit muss für
 * jede VO und alle benötigten vergangenen Behandlungen/zukünftigen Termine gelten.
 *
 * Verordnung = { id:string, bereich:'podologie'|'physiotherapie'|'ergotherapie'|
 * 'logopaedie', ausstellungsdatum:Tag|null, dringend:boolean,
 * behandlungsbeginn:Tag|null, restbedarf:boolean|null,
 * behandlungen:Quelle<{behandlungsdatum:Tag,storniert_am:null|string}>,
 * termine:Quelle<{tag:Tag,status:'geplant'|'abgesagt'}> }.
 * Behandlung bedeutet tatsächlich erfolgt, einschließlich Podo-Kontrollterminen;
 * Zukunftsbehandlung ist ungültige Evidenz. NULL-Beginn beweist allein keinen Nichtbeginn.
 * Restbedarf ist bestätigter Organisationsbedarf, keine medizinische Frequenzberechnung.
 *
 * Output je Kategorie: {bekanntAnzahl,anzahl:number|null,ids,unbekanntAnzahl,gruende}.
 * IDs sind interne Auswahlzeugen, kein Name/Patiententext. Unbekannte Teile ergeben
 * anzahl:null, bestätigte Treffer bleiben separat erhalten. entwarnung nur bei vollständig
 * bekannten Nullmengen; unabhängige Unbekanntheiten werden nicht als Fallgesamtzahl addiert.
 * Pause77..84 ist E15-Warnung, >84 bestehende Grenze. Keine Schreib-/Buchungssperre.
 * Geplanter Ersttermin nach Frist ist kein erfolgter Beginn; vor Ablauf wird daraus im
 * engen Umfang keine eigene Aufgabe erzeugt. Beginn-bald zählt nur fehlende Termine.
 * @param {object} input normalisierter, bereits berechtigungsgefilterter Vertrag v1
 * @returns {object} versionierter Hinweisstand, keine vollständige Akten-/Klinikbewertung
 */
export function berechneHandlungsbedarf(input) {
  if (input?.version !== 1 || !tag(input.heute)) throw new TypeError('HANDLUNGSBEDARF_VERTRAG_UNGUELTIG');
  const { heute, verordnungen: q } = input;
  const kategorien = Object.fromEntries(KATEGORIEN.map(n => [n, { ids: new Set(), unbekannt: [], gruende: new Set() }]));
  const unbekannt = (namen, refId, code) => {
    for (const n of namen) { kategorien[n].unbekannt.push({ refId, code }); kategorien[n].gruende.add(code); }
  };
  const treffer = (n, id) => kategorien[n].ids.add(id);
  if (!quelleOk(q)) unbekannt(KATEGORIEN, null, 'VERORDNUNGEN_UNVOLLSTAENDIG');
  const daten = Array.isArray(q?.daten) ? q.daten : [];
  const counts = new Map();
  for (const r of daten) if (typeof r?.id === 'string' && r.id.trim()) counts.set(r.id, (counts.get(r.id) || 0) + 1);
  const gesehen = new Set();
  for (const r of daten) {
    const id = typeof r?.id === 'string' && r.id.trim() ? r.id : null;
    if (!id || !BEREICHE.includes(r.bereich)) { unbekannt(KATEGORIEN, id, 'VERORDNUNG_UNGUELTIG'); continue; }
    if (gesehen.has(id)) continue;
    gesehen.add(id);
    if (counts.get(id) !== 1) { unbekannt(KATEGORIEN, id, 'VERORDNUNG_MEHRDEUTIG'); continue; }
    const h = historienstand(r, heute), t = terminstand(r.termine, heute);
    if (!h.beginnBekannt) unbekannt(['beginnVerpasst', 'beginnBald'], id, 'BEHANDLUNGSBEGINN_UNBEKANNT');
    else if (!h.begonnen) {
      if (!tag(r.ausstellungsdatum) || r.ausstellungsdatum > heute || typeof r.dringend !== 'boolean') {
        unbekannt(['beginnVerpasst', 'beginnBald'], id, 'BEGINNFRIST_UNBEKANNT');
      } else {
        // Mittag verhindert eine Tagesverschiebung durch lokale setDate/DST-Arithmetik
        // des bestehenden Helfers; dessen 14/28-Tage-Regel bleibt einzige Fristformel.
        const ausstellung = r.ausstellungsdatum + 'T12:00:00Z';
        const frist = behandlungsbeginnFrist(ausstellung, r.dringend);
        if (!tag(frist)) unbekannt(['beginnVerpasst', 'beginnBald'], id, 'BEGINNFRIST_UNBEKANNT');
        else if (frist < heute) {
          const pruefung = pruefeBehandlungsbeginn({ ersterTermin: heute, ausstellungsdatum: ausstellung, istDringend: r.dringend, behandlungsbeginn: null });
          if (!pruefung.ok) treffer('beginnVerpasst', id);
          else unbekannt(['beginnVerpasst'], id, 'BEGINNFRIST_WIDERSPRUCH');
        } else if (tagesabstand(heute, frist) <= 7) {
          if (!t.bekannt) unbekannt(['beginnBald'], id, 'TERMINE_UNVOLLSTAENDIG');
          else if (!t.geplant) treffer('beginnBald', id);
        }
      }
    }
    if (r.bereich === 'podologie') {
      if (!h.vollstaendig) unbekannt(['pauseDroht', 'pauseVerpasst'], id, 'BEHANDLUNGEN_UNVOLLSTAENDIG');
      else if (!h.erfolgt.some(b => b.behandlungsdatum === heute)) {
        const p = pauseLage(h.erfolgt, heute);
        if (p.tage !== null) {
          if (p.ungueltig) treffer('pauseVerpasst', id);
          else if (p.tage >= PODO_PAUSE_MAX_TAGE - 7) treffer('pauseDroht', id);
        } else if (h.begonnen) unbekannt(['pauseDroht', 'pauseVerpasst'], id, 'LETZTE_BEHANDLUNG_UNBEKANNT');
      }
    }
    if (r.restbedarf === false || (h.beginnBekannt && !h.begonnen)) continue;
    if (!h.beginnBekannt) unbekannt(['ohneFolgetermin'], id, 'BEHANDLUNGSBEGINN_UNBEKANNT');
    else if (r.restbedarf !== true) unbekannt(['ohneFolgetermin'], id, 'RESTBEDARF_UNBEKANNT');
    else if (!t.bekannt) unbekannt(['ohneFolgetermin'], id, 'TERMINE_UNVOLLSTAENDIG');
    else if (!t.geplant) treffer('ohneFolgetermin', id);
  }
  const result = {};
  for (const n of KATEGORIEN) {
    const k = kategorien[n], ids = [...k.ids].sort();
    result[n] = { bekanntAnzahl: ids.length, anzahl: k.unbekannt.length ? null : ids.length, ids,
      unbekanntAnzahl: k.unbekannt.length, gruende: [...k.gruende].sort() };
  }
  const vollstaendig = Object.values(result).every(k => k.anzahl !== null);
  return { version: 1, heute, vollstaendig, entwarnung: vollstaendig && Object.values(result).every(k => k.anzahl === 0), kategorien: result };
}
