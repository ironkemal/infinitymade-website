/**
 * raum-auswahl.js — Raum im Termin wählen, nachtragen, vor Überschneidung warnen (Physio/PILOT-PLAN.md M1/M2).
 *
 * Das Dashboard kennt nur `raumFelder()` und `terminWarnungen()`. Beides fällt weich: ohne Tabelle, ohne Räume
 * oder bei Lesefehler liefert `raumFelder()` {}, der Termin wird also wie bisher gespeichert (O-222, :stable/:beta).
 *
 * Der Raum bestimmt den Standort des Termins. Ohne `business_id` im Payload leitet die Datenbank den Standort aus
 * der Mitarbeiterzuordnung ab, meist den Standard-Standort; ein Raum an Standort B würde dann abgewiesen.
 */
import { raeumeDesStandorts, raumAuswahl, raumKonflikt } from './raum-plan.js';
import { ladeAbwesenheiten } from './abwesenheit.js?v=20261031';
import { ladeSondertage, warnungFuerTag } from './sondertag.js?v=20261104sondertag';

const NICHT_VERFUEGBAR = 'Therapeut:in ist an diesem Tag nicht verfügbar.';
const RAUM_SPALTEN = 'id,owner_id,business_id,name,plaetze,aktiv,sort';
const BELEGUNG_SPALTEN = 'id,room_id,status,start_time,end_time,group_parent_id';

/** Union der Anforderungen aller Haupt- und Zusatzleistungen; null bei unbekannter Leistung. */
export function terminRaumAnforderungen(zeilen, services) {
  const ids = [...new Set((zeilen || []).map(z => z.serviceId).filter(Boolean))];
  if (!ids.length) return null;
  const erforderlich = [];
  for (const id of ids) {
    const service = (services || []).find(s => s.id === id);
    if (!service || !Array.isArray(service.raum_ausstattung)) return null;
    erforderlich.push(...service.raum_ausstattung);
  }
  return [...new Set(erforderlich)];
}

export function keinPraxisraumNoetig(zeilen, services, hausbesuch = false) {
  if (hausbesuch) return true;
  const ids = [...new Set((zeilen || []).map(z => z.serviceId).filter(Boolean))];
  return ids.length > 0 && ids.every(id => (services || []).find(s => s.id === id)?.is_online_meeting === true);
}

export function raumVorschlag(raeume, termine, start, ende, { businessId = null, anforderungen, ohneTerminId = null } = {}) {
  if (!Array.isArray(anforderungen) || !start || !ende || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(ende)) || Date.parse(ende) <= Date.parse(start)) return null;
  const geeignet = (raeume || []).filter(r => r.aktiv !== false && (r.business_id ?? null) === (businessId ?? null)
    && Array.isArray(r.ausstattung) && anforderungen.every(text => r.ausstattung.includes(text)));
  geeignet.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, 'de') || String(a.id).localeCompare(String(b.id)));
  return raumAuswahl(geeignet, termine, start, ende, { ohneTerminId }).find(e => !e.voll)?.raum || null;
}

export function optionenFuerAuswahl(raeume, termine, start, ende, optionen = {}) {
  const liste = start && ende
    ? raumAuswahl(raeume, termine, start, ende, optionen)
    : raeume.map(raum => ({ raum, voll: false, belegt: 0 }));
  return [
    { wert: '', text: 'Kein Raum' },
    ...liste.map(({ raum, voll, belegt }) => {
      if (voll) return { wert: raum.id, text: `${raum.name} (belegt)` };
      if (belegt) return { wert: raum.id, text: `${raum.name} (${belegt} von ${raum.plaetze} Plätzen belegt)` };
      return { wert: raum.id, text: raum.name };
    }),
  ];
}

/**
 * Hinweiszeile unter der Raumwahl: welche Räume zur gewählten Zeit noch Platz haben. Nur Anzeige, sperrt nichts.
 * Ohne Zeit oder ohne Räume: leerer Text.
 */
export function freieRaeumeHinweis(raeume, termine, start, ende, optionen = {}) {
  if (!start || !ende || !raeume?.length) return '';
  const frei = raumAuswahl(raeume, termine, start, ende, optionen).filter(e => !e.voll).map(e => e.raum.name);
  if (!frei.length) return 'Zu dieser Zeit ist kein Raum frei.';
  return `Frei zu dieser Zeit: ${frei.join(', ')}`;
}

export function felderAusWahl(wahl, raeume) {
  if (!wahl) return { room_id: null };
  const raum = raeume.find(r => r.id === wahl);
  if (!raum) return {};
  return raum.business_id ? { room_id: raum.id, business_id: raum.business_id } : { room_id: raum.id };
}

export async function ladeRaumliste(supabase, ownerId) {
  try {
    let { data, error } = await supabase.from('rooms').select(`${RAUM_SPALTEN},ausstattung`).eq('owner_id', ownerId);
    if (error && ['42703', 'PGRST204'].includes(String(error.code))) ({ data, error } = await supabase.from('rooms').select(RAUM_SPALTEN).eq('owner_id', ownerId));
    return error ? [] : data || [];
  } catch {
    return [];
  }
}

export async function ladeBelegungsstand(supabase, ownerId, vonISO, bisISO) {
  try {
    const { data, error } = await supabase.from('bookings').select(BELEGUNG_SPALTEN)
      .eq('owner_id', ownerId).not('room_id', 'is', null).lt('start_time', bisISO).gt('end_time', vonISO);
    return { termine: error ? [] : data || [], fehler: !!error };
  } catch { return { termine: [], fehler: true }; }
}

export async function ladeBelegungen(supabase, ownerId, vonISO, bisISO) {
  return (await ladeBelegungsstand(supabase, ownerId, vonISO, bisISO)).termine;
}

export function tagesgrenzen(zeitpunkt) {
  const d = new Date(zeitpunkt);
  const von = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const bis = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  return { vonISO: von.toISOString(), bisISO: bis.toISOString() };
}

function lokaleTage(zeitpunkt) {
  const d = new Date(zeitpunkt);
  const text = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { vonDatum: text, bisDatum: text };
}

/** Warntext für den Raum, oder null. Sperrt nichts (Ops #307). */
export function raumWarnung(raum, termine, startIso, endIso, optionen = {}) {
  if (!raum || !raumKonflikt(raum, termine, startIso, endIso, optionen).voll) return null;
  return `Raum „${raum.name}" ist zu dieser Zeit belegt. Möchten Sie den Termin trotzdem eintragen?`;
}

let kontext = null;

function ladezustand() {
  return kontext?.modal;
}

/** Zum Einfrieren vor dem ersten await im Speichern: {} heißt „Raum nicht anfassen". */
export function raumFelder() {
  const modal = ladezustand();
  const id = typeof document === 'undefined' ? null : document.getElementById('bk-id')?.value || null;
  if (!kontext) return {};
  const zeilen = kontext?.getLeistungen?.() || [{ serviceId: document.getElementById('bkService')?.value }];
  const services = kontext?.getServices?.() || [];
  const snapshot = terminRaumAnforderungen(zeilen, services) !== null
    ? { raum_service_ids: [...new Set(zeilen.map(z => z.serviceId).filter(Boolean))] } : {};
  if (!modal?.bereit || modal.huelle.hidden) return snapshot;
  if (!id && Object.hasOwn(snapshot, 'raum_service_ids')) {
    if (keinPraxisraumNoetig(zeilen, services, document.getElementById('bkHausbesuch')?.checked)) return { ...snapshot, room_id: null };
    return { ...snapshot, ...felderAusWahl(modal.manuell ? modal.auswahl.value : '', modal.raeume), ...(modal.manuell ? { room_automatisch: false } : {}) };
  }
  const schemaDa = terminRaumAnforderungen(zeilen, services) !== null;
  if (modal.auswahl.value === modal.anfang && !modal.manuell) return snapshot;
  return { ...snapshot, ...felderAusWahl(modal.auswahl.value, modal.raeume), ...(schemaDa ? { room_automatisch: false } : {}) };
}

/**
 * Sperrt am geschlossenen Sondertag, warnt vor Abwesenheit und Raumüberschneidung. true = weiter speichern.
 * `raumId` undefined: Raum aus dem gespeicherten Termin (Verschieben), sonst der gewählte.
 */
export async function terminWarnungen({ id = null, empId, startIso, endIso, raumId }) {
  if (!kontext) return true;
  const { supabase, getOwnerId, showConfirmModal } = kontext;
  const frage = meldung => showConfirmModal({
    title: 'Hinweis zum Termin', message: meldung, confirmText: 'Trotzdem eintragen', cancelText: 'Abbrechen', variant: 'warning',
  });
  try {
    const { vonDatum, bisDatum } = lokaleTage(startIso);
    const tage = await ladeSondertage({ supabase, ownerId: getOwnerId(), von: vonDatum, bis: bisDatum });
    const geschlossen = warnungFuerTag(tage, vonDatum);
    if (geschlossen) { kontext.showToast(geschlossen, 'error'); return false; } // 0106: Sperre, die DB lehnt ohnehin ab (Kemal 31.10.)
    const abwesend = await ladeAbwesenheiten(supabase, { empIds: [empId], vonISO: startIso, bisISO: endIso });
    if (abwesend.length && !await frage(NICHT_VERFUEGBAR)) return false;
  } catch { /* Lesefehler darf das Speichern nicht aufhalten */ }
  try {
    let gewaehlt = raumId;
    if (gewaehlt === undefined && id) {
      const { data } = await supabase.from('bookings').select('room_id').eq('id', id).maybeSingle();
      gewaehlt = data?.room_id ?? null;
    }
    if (!gewaehlt) return true;
    const ownerId = getOwnerId();
    const raum = (await ladeRaumliste(supabase, ownerId)).find(r => r.id === gewaehlt);
    const { vonISO, bisISO } = tagesgrenzen(startIso);
    const termine = await ladeBelegungen(supabase, ownerId, vonISO, bisISO);
    const warnung = raumWarnung(raum, termine, startIso, endIso, { ohneTerminId: id });
    if (warnung && !await frage(warnung)) return false;
  } catch { /* wie oben */ }
  return true;
}

/** Nach einer Serie: Sammelhinweis statt Dialog je Termin. */
export async function serieNachpruefen({ raumId, empId, termine: neue }) {
  if (!kontext || !neue?.length) return;
  const { supabase, getOwnerId, showToast } = kontext;
  try {
    const zeiten = neue.map(t => t.start_time).sort();
    const vonISO = zeiten[0];
    const bisISO = new Date(Date.parse(zeiten[zeiten.length - 1]) + 864e5).toISOString();
    const abwesend = await ladeAbwesenheiten(supabase, { empIds: [empId], vonISO, bisISO });
    if (abwesend.length) showToast(`${NICHT_VERFUEGBAR} Bitte die Serientermine prüfen.`, 'warning');
    if (!raumId) return;
    const ownerId = getOwnerId();
    const raum = (await ladeRaumliste(supabase, ownerId)).find(r => r.id === raumId);
    if (!raum) return;
    const belegt = await ladeBelegungen(supabase, ownerId, vonISO, bisISO);
    const treffer = belegt.filter(t => t.room_id === raumId
      && raumKonflikt(raum, belegt, t.start_time, t.end_time, { ohneTerminId: t.id }).voll);
    if (treffer.length) showToast(`Raum „${raum.name}" ist bei ${treffer.length} Terminen doppelt belegt.`, 'warning');
  } catch { /* Hinweis, keine Pflicht */ }
}

function fuelleAuswahl(select, optionen, wert) {
  select.replaceChildren(...optionen.map(({ wert: value, text }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
  }));
  select.value = optionen.some(o => o.wert === wert) ? wert : '';
}

function mountTerminmaske() {
  const gruppe = document.getElementById('bkEmployeeGroup');
  const modal = document.getElementById('bookingModal');
  if (!gruppe || !modal) return null;
  const huelle = document.createElement('div');
  huelle.className = 'form-group';
  huelle.id = 'bkRaumGroup';
  huelle.hidden = true;
  huelle.innerHTML = '<label class="form-label" for="bkRaum">Raum</label><select id="bkRaum" class="form-select"></select><div class="form-hint" id="bkRaumFrei" aria-live="polite"></div>';
  gruppe.after(huelle);
  const auswahl = huelle.querySelector('select');
  const hinweis = huelle.querySelector('#bkRaumFrei');
  const stand = { huelle, auswahl, raeume: [], termine: [], bereit: false, lauf: 0, rechnen: 0, manuell: false, anfang: '', tag: '' };
  auswahl.addEventListener('change', () => { stand.manuell = true; zeichne(auswahl.value); });

  function zeitraum() {
    const startText = document.getElementById('bkStart')?.value;
    if (!startText) return {};
    const start = new Date(startText);
    if (Number.isNaN(start.getTime())) return {};
    const dauer = Number(kontext.getDauerMin?.()) || 30;
    return { startIso: start.toISOString(), endIso: new Date(start.getTime() + dauer * 60000).toISOString() };
  }

  function zeichne(wert) {
    const { startIso, endIso } = zeitraum();
    const id = document.getElementById('bk-id')?.value || null;
    const zeilen = kontext.getLeistungen?.() || [{ serviceId: document.getElementById('bkService')?.value }];
    const anforderungen = terminRaumAnforderungen(zeilen, kontext.getServices?.() || []);
    const ohneRaum = keinPraxisraumNoetig(zeilen, kontext.getServices?.() || [], document.getElementById('bkHausbesuch')?.checked);
    auswahl.disabled = ohneRaum;
    const vorschlag = stand.belegungsFehler ? null : raumVorschlag(stand.raeume, stand.termine, startIso, endIso, { businessId: kontext.getBusinessId(), anforderungen, ohneTerminId: id });
    if (!id && !stand.manuell && anforderungen !== null) wert = ohneRaum ? '' : vorschlag?.id || '';
    const optionen = optionenFuerAuswahl(stand.raeume, stand.termine, startIso, endIso, { ohneTerminId: id });
    if (!id && anforderungen !== null) optionen[0].text = 'Automatisch zuweisen';
    fuelleAuswahl(auswahl, optionen, wert);
    const gewaehlt = stand.raeume.find(r => r.id === auswahl.value);
    if (ohneRaum) hinweis.textContent = 'Kein Praxisraum erforderlich.';
    else if (stand.belegungsFehler) hinweis.textContent = 'Raumbelegung konnte nicht geladen werden. Beim Speichern wird erneut geprüft.';
    else if (anforderungen === null) hinweis.textContent = freieRaeumeHinweis(stand.raeume, stand.termine, startIso, endIso, { ohneTerminId: id });
    else if (gewaehlt && !anforderungen.every(text => (gewaehlt.ausstattung || []).includes(text))) hinweis.textContent = 'Gewählter Raum besitzt nicht alle benötigten Ausstattungen.';
    else if (!vorschlag) hinweis.textContent = 'Kein freier geeigneter Raum zu dieser Zeit. Bitte Raum oder Terminzeit prüfen.';
    else hinweis.textContent = `Raumvorschlag: ${vorschlag.name}${anforderungen.length ? ` · Benötigt: ${anforderungen.join(', ')}` : ''}`;
  }

  async function oeffnen() {
    const lauf = ++stand.lauf;
    stand.bereit = false;
    stand.manuell = false;
    stand.rechnen++;
    huelle.hidden = true;
    const ownerId = kontext.getOwnerId();
    const id = document.getElementById('bk-id')?.value || null;
    const alleRaeume = await ladeRaumliste(kontext.supabase, ownerId);
    const raeume = raeumeDesStandorts(alleRaeume, kontext.getBusinessId());
    let wert = '';
    if (id) {
      const { data, error } = await kontext.supabase.from('bookings').select('room_id').eq('id', id).maybeSingle();
      if (error) return; // Ohne bekannten Raum nichts überschreiben: `bereit` bleibt false.
      wert = data?.room_id || '';
      const bisherig = alleRaeume.find(r => r.id === wert);
      if (bisherig && !raeume.includes(bisherig)) raeume.push(bisherig); // deaktiviert oder anderer Standort: sichtbar lassen
    }
    const { startIso } = zeitraum();
    const { vonISO, bisISO } = tagesgrenzen(startIso || Date.now());
    const belegung = await ladeBelegungsstand(kontext.supabase, ownerId, vonISO, bisISO);
    if (lauf !== stand.lauf) return;
    if (tagesgrenzen(zeitraum().startIso || Date.now()).vonISO !== vonISO) return oeffnen();
    const termine = belegung.termine;
    stand.belegungsFehler = belegung.fehler;
    stand.raeume = raeume;
    stand.termine = termine;
    stand.tag = vonISO;
    if (!raeume.length) return;
    stand.anfang = wert;
    zeichne(wert);
    huelle.hidden = false;
    stand.bereit = true;
  }

  new MutationObserver(() => {
    if (!modal.hidden) oeffnen().catch(() => {});
    else stand.lauf += 1;
  }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  // Zeit oder Leistung (Dauer) geändert: Auswahl und Hinweis neu rechnen. Anderer Tag: Belegungen dieses Tages nachladen.
  const neuRechnen = async () => {
    if (!stand.bereit) return;
    const lauf = stand.lauf;
    const rechnen = ++stand.rechnen;
    const { startIso } = zeitraum();
    if (startIso) {
      const { vonISO, bisISO } = tagesgrenzen(startIso);
      if (vonISO !== stand.tag) {
        const belegung = await ladeBelegungsstand(kontext.supabase, kontext.getOwnerId(), vonISO, bisISO);
        if (lauf !== stand.lauf || rechnen !== stand.rechnen) return;
        stand.termine = belegung.termine;
        stand.belegungsFehler = belegung.fehler;
        stand.tag = vonISO;
      }
    }
    zeichne(auswahl.value);
  };
  const planen = () => { queueMicrotask(() => { neuRechnen().catch(() => {}); }); };
  modal.addEventListener('change', event => { if (event.target.id !== 'bkRaum') planen(); });
  modal.addEventListener('input', event => { if (event.target.id !== 'bkRaum') planen(); });
  const extra = document.getElementById('bkLeistungExtra');
  if (extra) new MutationObserver(planen).observe(extra, { childList: true, subtree: true });
  return stand;
}

function mountAktionspanel() {
  const ziel = document.querySelector('#bkActionModal .modal-body');
  if (!ziel) return null;
  const huelle = document.createElement('div');
  huelle.className = 'form-group';
  huelle.id = 'bkActRaum';
  huelle.hidden = true;
  huelle.innerHTML = '<label class="form-label" for="bkActRaumAuswahl">Raum</label>'
    + '<select id="bkActRaumAuswahl" class="form-select"></select>'
    + '<button type="button" class="btn-ghost" id="bkActRaumSpeichern" style="margin-top:6px">Raum zuweisen</button>';
  ziel.append(huelle);
  const stand = { huelle, auswahl: huelle.querySelector('select'), termin: null, raeume: [] };
  huelle.querySelector('button').addEventListener('click', async () => {
    const { termin, raeume, auswahl } = stand;
    if (!termin) return;
    const felder = felderAusWahl(auswahl.value, raeume);
    if (!Object.keys(felder).length) return;
    const weiter = await terminWarnungen({
      id: termin.id, empId: termin.user_id, startIso: termin.start_time, endIso: termin.end_time, raumId: felder.room_id,
    });
    if (!weiter) return;
    const { error } = await kontext.supabase.from('bookings').update(felder).eq('id', termin.id);
    if (error) kontext.showToast('Raum konnte nicht gespeichert werden.', 'error');
    else kontext.showToast('Raum gespeichert.', 'success');
  });
  return stand;
}

/** Aus dem Aktionspanel: zeigt die Raumwahl für diesen Termin, oder blendet sie aus. */
export async function raumAktionsTermin(termin) {
  const stand = kontext?.aktion;
  if (!stand) return;
  stand.termin = null;
  stand.huelle.hidden = true;
  const lauf = (stand.lauf = (stand.lauf || 0) + 1);
  if (!termin?.id) return;
  const { supabase, getOwnerId, getBusinessId } = kontext;
  const raeume = raeumeDesStandorts(await ladeRaumliste(supabase, getOwnerId()), termin.business_id || getBusinessId());
  if (!raeume.length) return;
  const { data, error } = await supabase.from('bookings').select('room_id').eq('id', termin.id).maybeSingle();
  if (error || lauf !== stand.lauf) return;
  stand.raeume = raeume;
  stand.termin = termin;
  fuelleAuswahl(stand.auswahl, optionenFuerAuswahl(raeume, [], null, null), data?.room_id || '');
  stand.huelle.hidden = false;
}

/** Einmal beim Start. `getDauerMin` liefert die Dauer aus der Maske. */
export function raumAuswahlVerdrahten(deps) {
  kontext = { ...deps };
  kontext.modal = mountTerminmaske();
  kontext.aktion = mountAktionspanel();
}
