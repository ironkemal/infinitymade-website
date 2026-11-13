import { ladeHandlungsbedarfInput } from './startseite-handlungsbedarf-laden.js?v=20261113f602';
import { berechneHandlungsbedarf } from './startseite-handlungsbedarf.js?v=20261113f602';

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const KATEGORIEN = [['beginnVerpasst', 'Beginn verpasst', 'bad'], ['pauseDroht', 'Pause droht', 'warn'], ['pauseVerpasst', 'Pause überschritten', 'bad'],
  ['beginnBald', 'Beginn ohne Termin', 'warn'], ['ohneFolgetermin', 'Ohne Folgetermin', 'warn']];
const BEGINN_HINWEIS = 'Kein dokumentierter Behandlungsbeginn bis Fristende (HeilM-RL § 15) – bitte prüfen';
const PODO_KATEGORIEN = new Set(['pauseDroht', 'pauseVerpasst']);
const leer = () => ({ laden: false, fehler: false, daten: null });
const schluessel = k => JSON.stringify([k?.rolle, k?.uid, k?.ownerId, k?.businessId, k?.patientsGemeinsam, k?.bereit, k?.scope]);

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
  /** Laufende Ladung abbrechen und Karte leeren (Designwechsel auf alt, Abschalten). */
  const leeren = () => { nr++; controller?.abort(); state = leer(); stand = 0; aktiv = false; };
  return { lesen, laden, leeren };
}

/** Kein Personeninhalt, keine Beträge, keine Fallgesamtsumme: Kategorien können dieselbe VO enthalten.
 *  Liefert nur den Karteninhalt (Rumpf + Fuß); die Hülle mit Überschrift liegt in der Startansicht. */
export function handlungsbedarfHtml(state = {}, { erreichbar = false, eigene = false, ohnePodo = false } = {}) {
  let rumpf;
  if (state.laden) rumpf = '<div class="px-karte-zustand"><p>Handlungsbedarf wird geladen …</p></div>';
  else if (!state.daten || state.fehler) rumpf = `<div class="px-karte-zustand"><p>${eigene ? 'Eigener Verordnungsumfang noch nicht bestätigt.' : 'Handlungsbedarf gerade nicht verfügbar.'}</p></div>`;
  else {
    const kat = state.daten.kategorien || {};
    // Optional (Standard aus): Physio/Ergo/Logo ohne Podo-Kacheln, außer bei echtem Treffer.
    const sichtbar = KATEGORIEN.filter(([id]) => !ohnePodo || !PODO_KATEGORIEN.has(id) || kat[id]?.bekanntAnzahl > 0);
    const zahlOk = id => Number.isSafeInteger(kat[id]?.anzahl) && kat[id].anzahl >= 0;
    const alleNull = sichtbar.length > 0 && sichtbar.every(([id]) => zahlOk(id) && kat[id].anzahl === 0);
    const teilweise = sichtbar.some(([id]) => !zahlOk(id));
    // podoloji 13.11.: fünf Striche ohne einen einzigen bekannten Treffer sagen nichts und schieben auf dem Telefon
    // die Terminliste weg. Unbekannt bleibt sichtbar (nie 0), aber als eine Zeile.
    const nichtsBekannt = sichtbar.every(([id]) => !zahlOk(id) && !(kat[id]?.bekanntAnzahl > 0));
    if (alleNull) rumpf = '<div class="px-karte-zustand px-karte-zustand--ruhig"><p>Alles im Plan</p></div>';
    else if (nichtsBekannt) rumpf = '<div class="px-karte-zustand"><p>Verordnungsprüfung gerade nicht möglich: Quellen unvollständig.</p></div>';
    else {
      rumpf = `<div class="px-minis px-handlungsbedarf">${sichtbar.map(([id, label, ton]) => {
        const k = kat[id], teil = Number.isSafeInteger(k?.bekanntAnzahl) ? k.bekanntAnzahl : 0;
        const bekannt = zahlOk(id), n = bekannt ? k.anzahl : null;
        const klasse = !bekannt ? ' px-unbekannt' : n === 0 ? ' px-null' : ` px-ton-${ton}`;
        const sub = !bekannt && teil > 0 ? `<span class="teil">Teilmenge ${teil}</span>` : '';
        const titel = id === 'beginnVerpasst' ? ` title="${BEGINN_HINWEIS}"` : '';
        return `<div class="px-mini${klasse}"${titel}><span class="zahl">${bekannt ? String(n) : '–'}</span><span class="lbl">${label}</span>${sub}</div>`;
      }).join('')}</div>`;
      const verpasst = kat.beginnVerpasst;
      if (zahlOk('beginnVerpasst') ? verpasst.anzahl > 0 : verpasst?.bekanntAnzahl > 0) rumpf += `<div class="px-karte-zustand px-handlungsbedarf-hinweis"><p>${BEGINN_HINWEIS}</p></div>`;
      if (teilweise) rumpf += '<div class="px-karte-zustand px-handlungsbedarf-hinweis"><p>Teilweise ungeklärt: Quellen unvollständig, weitere Hinweise bleiben unbekannt.</p></div>';
    }
  }
  return `${rumpf}<div class="px-karte-fuss">${erreichbar ? '<button type="button" class="px-fuss-knopf" data-ziel="verordnungen">Alle Verordnungen</button>' : ''}<button type="button" class="px-fuss-knopf" data-aktion="bedarf-neu">Erneut prüfen</button></div>`;
}
