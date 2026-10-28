import { ladeHandlungsbedarfInput } from './startseite-handlungsbedarf-laden.js?v=20261028s242';
import { berechneHandlungsbedarf } from './startseite-handlungsbedarf.js?v=20261028s242';

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const KATEGORIEN = [['beginnVerpasst', 'Beginn verpasst'], ['beginnBald', 'Beginn ≤ 7 Tage ohne Termin'],
  ['pauseDroht', 'Podo-Pause droht'], ['pauseVerpasst', 'Podo-Pause überschritten'], ['ohneFolgetermin', 'Ohne Folgetermin']];
const leer = () => ({ laden: false, fehler: false, daten: null });
const schluessel = k => JSON.stringify([k?.rolle, k?.uid, k?.ownerId, k?.businessId, k?.patientsGemeinsam, k?.bereit]);

/** Scope ausschließlich aus erfolgreich geladenem Dashboard-Kontext. Keine Employee-Zuordnung erfinden. */
export async function ladeHandlungsbedarfScope({ supabase, kontext: k, signal, istAktuell }) {
  if (!k?.bereit || k.rolle !== 'owner' || !UUID.test(k.uid || '') || k.uid !== k.ownerId
      || typeof k.patientsGemeinsam !== 'boolean' || !istAktuell() || signal.aborted) return null;
  if (k.businessId !== null && !UUID.test(k.businessId || '')) return null;
  const basis = { rolle: k.rolle, uid: k.uid, ownerId: k.ownerId, vollstaendig: true };
  if (k.patientsGemeinsam || k.businessId === null) return { ...basis, umfang: 'mandant' };
  if (!UUID.test(k.businessId || '')) return null;
  const ids = []; let cursor = null;
  while (istAktuell() && !signal.aborted) {
    let q = supabase.from('leads').select('id,owner_id,business_id').eq('owner_id', k.ownerId)
      .or(`business_id.eq.${k.businessId},business_id.is.null`).order('id', { ascending: true }).limit(200).abortSignal(signal);
    if (cursor !== null) q = q.gt('id', cursor);
    const r = await q;
    if (!istAktuell() || signal.aborted || r?.error || !Array.isArray(r?.data) || r.data.length > 200) return null;
    if (!r.data.length) return { ...basis, umfang: 'patienten', patientIds: ids };
    for (const row of r.data) {
      if (!UUID.test(row?.id || '') || row.owner_id !== k.ownerId || (row.business_id !== null && row.business_id !== k.businessId)
          || (cursor !== null && row.id <= cursor)) return null;
      ids.push(row.id); cursor = row.id;
    }
  }
  return null;
}

/** Ein 30s-Abbruch für Scope und Loader zusammen; alter Scope wird auch beim Lesen synchron verworfen. */
export function createHandlungsbedarfKarte({ kontext, heute, zeichne, lader = ladeHandlungsbedarfInput, scopeLader = ladeHandlungsbedarfScope }) {
  let state = leer(), key = '', nr = 0, controller = null, stand = 0, aktiv = false;
  const lesen = () => {
    if (key !== schluessel(kontext())) { nr++; controller?.abort(); key = schluessel(kontext()); state = leer(); stand = 0; aktiv = false; }
    return state;
  };
  const laden = async ({ erzwingen = false } = {}) => {
    lesen();
    const k = kontext();
    if ((aktiv && !erzwingen) || (!erzwingen && stand && Date.now() - stand < 60000)) return;
    if (aktiv) { nr++; controller?.abort(); aktiv = false; }
    if (!k?.bereit || k.rolle !== 'owner') { state = leer(); return; }
    const lauf = ++nr, startKey = key;
    const abbruchController = new AbortController(); controller = abbruchController; const signal = controller.signal;
    const istAktuell = () => lauf === nr && startKey === schluessel(kontext()) && !signal.aborted;
    const timer = setTimeout(() => abbruchController.abort(), 30000);
    aktiv = true; state = { laden: true, fehler: false, daten: null }; zeichne();
    try {
      // Promise-Race begrenzt auch fehlerhafte/nie auflösende Transportadapter.
      const abbruch = new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('HANDLUNGSBEDARF_ABBRUCH')), { once: true }));
      const arbeit = (async () => {
        const scope = await scopeLader({ supabase: k.supabase, kontext: k, signal, istAktuell });
        if (!istAktuell()) return null;
        if (!scope) return berechneHandlungsbedarf({ version: 1, heute: heute() });
        const input = await lader({ supabase: k.supabase, heute: heute(), scope, signal, istAktuell });
        return istAktuell() ? berechneHandlungsbedarf(input) : null;
      })();
      const daten = await Promise.race([arbeit, abbruch]);
      if (istAktuell()) { state = { laden: false, fehler: false, daten }; stand = Date.now(); }
    } catch {
      if (lauf === nr && startKey === schluessel(kontext())) state = { laden: false, fehler: true, daten: null };
    } finally {
      clearTimeout(timer);
      if (lauf === nr) { aktiv = false; zeichne(); }
    }
  };
  return { lesen, laden };
}

/** Kein Personeninhalt, keine Fallgesamtsumme: Kategorien können dieselbe VO enthalten. */
export function handlungsbedarfHtml(state = {}, { erreichbar = false, eigene = false } = {}) {
  let rumpf;
  if (state.laden) rumpf = '<div class="px-karte-zustand"><p>Handlungsbedarf wird geladen …</p></div>';
  else if (!state.daten || state.fehler) rumpf = `<div class="px-karte-zustand"><p>${eigene ? 'Eigener Verordnungsumfang noch nicht bestätigt.' : 'Handlungsbedarf gerade nicht verfügbar.'}</p></div>`;
  else {
    const kat = state.daten.kategorien || {};
    rumpf = `<div class="px-minis px-handlungsbedarf">${KATEGORIEN.map(([id, label]) => {
      const k = kat[id], n = k?.anzahl, teil = Number.isSafeInteger(k?.bekanntAnzahl) ? k.bekanntAnzahl : 0;
      const zahl = Number.isSafeInteger(n) && n >= 0 ? String(n) : teil > 0 ? `Teilmenge ${teil}` : 'Unbekannt';
      return `<div class="px-mini"><span class="zahl">${zahl}</span><span class="lbl">${label}</span></div>`;
    }).join('')}</div><div class="px-karte-zustand"><p>${state.daten.entwarnung === true ? 'Kein Handlungsbedarf in den geprüften Kategorien.' : state.daten.vollstaendig === true ? 'Hinweise zu aktiven Standard-GKV-Verordnungen.' : 'Unvollständige Quellen: weitere Hinweise bleiben unbekannt.'}</p></div>`;
  }
  return `<section class="px-karte px-k-vo" aria-labelledby="pxVoTitel"><div class="px-karte-kopf"><div><h2 id="pxVoTitel">Verordnungen – Handlungsbedarf</h2><p>${eigene ? 'Eigener Umfang' : 'Aktiver Patientenbereich'} · Kategorien können sich überschneiden</p></div></div>${rumpf}<div class="px-karte-fuss">${erreichbar ? '<button type="button" class="px-fuss-knopf" data-ziel="verordnungen">Alle Verordnungen</button>' : ''}<button type="button" class="px-fuss-knopf" data-aktion="bedarf-neu">Erneut prüfen</button></div></section>`;
}
