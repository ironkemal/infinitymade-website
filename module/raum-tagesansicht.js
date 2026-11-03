/**
 * raum-tagesansicht.js — Tagesansicht „Therapeut | Raum" (Physio P1, M2b).
 *
 * Im Raum-Modus steht je aktivem Raum eine Spalte, Termine nach bookings.room_id, Termine ohne Raum in
 * einer Spalte „Ohne Raum". Die Therapeutenansicht in dashboard.js bleibt unangetastet: Der Raum-Modus
 * legt ein eigenes Raster daneben und blendet die alte Ansicht nur per CSS aus. Fehlt etwas (keine Räume,
 * Lesefehler, Tabelle fehlt), erscheint der Umschalter nicht bzw. fällt die Ansicht zurück.
 *
 * Plätze > 1 oder Überschneidung: Termine stehen nebeneinander (Spuren). Überbelegung ist nur ein Hinweis,
 * nichts wird gesperrt (Ops #307). Patientennamen erscheinen wie in der Therapeutenansicht, dieselbe
 * Blockdarstellung (`blockHtml` kommt aus dashboard.js).
 */
import { DV_SLOT_MIN, DV_SLOT_PX, rasterStunden } from './kalender-raster.js?v=20261021p';
import { TERMIN_SELECT } from './termin-laden.js?v=20261103r';

// TERMIN_SELECT (Tagesliste) enthält room_id nicht; ohne sie landen alle Termine in „Ohne Raum“ (F5).
export const RAUM_TAGES_SELECT = `${TERMIN_SELECT},room_id`;
import { raeumeDesStandorts } from './raum-plan.js';
import { ladeRaumliste } from './raum-auswahl.js?v=20261103raum';
import { mitarbeiterKuerzel } from './raum-streifen.js';

export const OHNE_RAUM_ID = '__ohne_raum__';

const SPEICHER = 'praxura.tagesansicht';

function zeitMs(wert) {
  return Date.parse(wert);
}

/** Termin zählt für die Spalten: nicht abgesagt, kein Gruppenkind, gültige Zeit. */
function zaehlt(termin) {
  if (!termin || termin.status === 'cancelled' || termin.group_parent_id) return false;
  const von = zeitMs(termin.start_time);
  const bis = zeitMs(termin.end_time);
  return Number.isFinite(von) && Number.isFinite(bis) && bis > von;
}

/**
 * Verteilt Termine einer Spalte auf Spuren. Überlappende Termine bekommen verschiedene Spuren, alle in
 * einer zusammenhängenden Überlappungsgruppe teilen sich dieselbe Spurenzahl.
 * @returns {Array<{ termin: object, spur: number, spuren: number, gleichzeitig: number }>}
 */
export function spurenVerteilen(termine) {
  const sortiert = [...termine].sort((a, b) => zeitMs(a.start_time) - zeitMs(b.start_time) || zeitMs(a.end_time) - zeitMs(b.end_time));
  const ergebnis = [];
  let gruppe = [];
  let gruppenEnde = -Infinity;

  const abschliessen = () => {
    if (!gruppe.length) return;
    const spuren = Math.max(...gruppe.map(e => e.spur)) + 1;
    // Höchste Zahl gleichzeitig laufender Termine in dieser Gruppe (Grundlage für den Überbelegungshinweis).
    const punkte = gruppe.flatMap(e => [[zeitMs(e.termin.start_time), 1], [zeitMs(e.termin.end_time), -1]]);
    punkte.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let jetzt = 0;
    let hoechst = 0;
    for (const [, delta] of punkte) { jetzt += delta; hoechst = Math.max(hoechst, jetzt); }
    for (const e of gruppe) { e.spuren = spuren; e.gleichzeitig = hoechst; }
    ergebnis.push(...gruppe);
    gruppe = [];
  };

  const spurEnden = [];
  for (const termin of sortiert) {
    const von = zeitMs(termin.start_time);
    if (von >= gruppenEnde) { abschliessen(); spurEnden.length = 0; }
    let spur = spurEnden.findIndex(ende => ende <= von);
    if (spur === -1) spur = spurEnden.length;
    spurEnden[spur] = zeitMs(termin.end_time);
    gruppenEnde = Math.max(gruppenEnde, zeitMs(termin.end_time));
    gruppe.push({ termin, spur, spuren: 1, gleichzeitig: 1 });
  }
  abschliessen();
  return ergebnis;
}

/**
 * Reines Spaltenmodell: Räume + Termine → eine Spalte je Raum, dazu „Ohne Raum", wenn es solche Termine gibt.
 * Termine mit unbekannter room_id (anderer Standort, gelöschter Raum) zählen als „ohne Raum".
 * @returns {{ spalten: Array<{ id: string, name: string, plaetze: number, ohneRaum: boolean, eintraege: Array<object>, ueberbelegt: boolean }> }}
 */
export function spaltenModell(raeume, termine) {
  const liste = (termine || []).filter(zaehlt);
  const bekannt = new Set((raeume || []).map(r => r.id));
  const spalten = (raeume || []).map(raum => {
    const eintraege = spurenVerteilen(liste.filter(t => t.room_id === raum.id));
    const plaetze = raum.plaetze ?? 1;
    for (const e of eintraege) e.ueberbelegt = e.gleichzeitig > plaetze;
    return { id: raum.id, name: raum.name, plaetze, ohneRaum: false, eintraege, ueberbelegt: eintraege.some(e => e.ueberbelegt) };
  });
  const lose = liste.filter(t => !t.room_id || !bekannt.has(t.room_id));
  if (lose.length) {
    const eintraege = spurenVerteilen(lose).map(e => ({ ...e, ueberbelegt: false }));
    spalten.push({ id: OHNE_RAUM_ID, name: 'Ohne Raum', plaetze: 1, ohneRaum: true, eintraege, ueberbelegt: false });
  }
  return { spalten };
}

function esc(wert) {
  return String(wert ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Spaltenüberschrift als Text (reine Funktion, damit sie testbar ist). */
export function spaltenKopf(spalte) {
  if (spalte.ohneRaum || spalte.plaetze <= 1) return spalte.name;
  return `${spalte.name} (${spalte.plaetze} Plätze)`;
}

/** Geometrie eines Blocks in Prozent und Pixeln. Rein, damit die Spurenlogik prüfbar bleibt. */
export function blockGeometrie(eintrag, vonStunde) {
  const start = new Date(eintrag.termin.start_time);
  const ende = new Date(eintrag.termin.end_time);
  const sMin = start.getHours() * 60 + start.getMinutes();
  const eMin = ende.getDate() !== start.getDate() ? 24 * 60 : ende.getHours() * 60 + ende.getMinutes();
  const top = ((sMin - vonStunde * 60) / DV_SLOT_MIN) * DV_SLOT_PX;
  const hoehe = Math.max(((eMin - sMin) / DV_SLOT_MIN) * DV_SLOT_PX, 28);
  const breite = 100 / eintrag.spuren;
  return { top, hoehe, links: breite * eintrag.spur, breite };
}

/** Fügt den Raum-Modus-Stil einmal ein (nur Variablen, keine festen Farben). */
function stilEinfuegen(doc) {
  if (doc.getElementById('raumTagesansichtStil')) return;
  const stil = doc.createElement('style');
  stil.id = 'raumTagesansichtStil';
  stil.textContent = `
#dayViewGrid.raum-ausgeblendet { display: none !important; }
#raumTagGrid { display: none; }
#raumTagGrid.raum-sichtbar { display: flex; }
#calAnsichtUmschalter { flex: 0 1 auto; min-width: 0; }
#calAnsichtUmschalter[hidden] { display: none; }
#calAnsichtUmschalter .cal-view-btn { white-space: nowrap; }
#raumTagGrid .dv-col { min-width: 140px; }
#raumTagGrid .dv-booking-block { right: auto; box-sizing: border-box; }
#raumTagGrid .dv-booking-block.raum-ueberbelegt { outline: 2px solid var(--warning, var(--primary)); outline-offset: -2px; }
#raumTagGrid .raum-block-kuerzel { display: block; font-size: 10px; color: var(--text-muted); margin-top: 2px; }
#raumTagGrid .dv-col-header.raum-kopf-ueberbelegt::after { content: ' !'; color: var(--warning, var(--primary)); }
@media (max-width: 480px) {
  #calAnsichtUmschalter .cal-view-btn { padding: 5px 8px; }
  #raumTagGrid .dv-col { min-width: 120px; }
}`;
  doc.head.appendChild(stil);
}

function lesen() {
  try { return globalThis.localStorage?.getItem(SPEICHER) === 'raum' ? 'raum' : 'therapeut'; } catch { return 'therapeut'; }
}

function schreiben(modus) {
  try { globalThis.localStorage?.setItem(SPEICHER, modus); } catch { /* ohne Speicher: Standardansicht */ }
}

/**
 * Baut das Raster (DOM) aus einem Spaltenmodell.
 * @param {Document} doc
 * @param {HTMLElement} host   #raumTagGrid
 * @param {object} modell      Ergebnis von spaltenModell
 * @param {object} opts        { termine, heute, blockHtml, farbeFuer, kuerzelFuer, onTermin }
 */
export function rasterZeichnen(doc, host, modell, { termine, heute, blockHtml, farbeFuer, kuerzelFuer, onTermin }) {
  const { von, bis } = rasterStunden(termine);
  host.dataset.von = von;
  host.dataset.bis = bis;
  const jetzt = new Date();
  const nowMin = jetzt.getHours() * 60 + jetzt.getMinutes();

  const zeitSpalte = doc.createElement('div');
  zeitSpalte.className = 'dv-time-col';
  const spaltenHuelle = doc.createElement('div');
  spaltenHuelle.className = 'dv-cols-wrap';

  const slotZahl = (bis - von) * (60 / DV_SLOT_MIN);
  for (let i = 0; i < slotZahl; i++) {
    const minuten = von * 60 + i * DV_SLOT_MIN;
    const slot = doc.createElement('div');
    slot.className = 'dv-slot';
    const label = doc.createElement('div');
    label.className = 'dv-time-label';
    label.textContent = `${String(Math.floor(minuten / 60)).padStart(2, '0')}:${String(minuten % 60).padStart(2, '0')}`;
    slot.appendChild(label);
    zeitSpalte.appendChild(slot);
  }

  for (const spalte of modell.spalten) {
    const col = doc.createElement('div');
    col.className = 'dv-col';
    col.dataset.raumId = spalte.id;
    const kopf = doc.createElement('div');
    kopf.className = 'dv-col-header' + (spalte.ueberbelegt ? ' raum-kopf-ueberbelegt' : '');
    kopf.textContent = spaltenKopf(spalte);
    if (spalte.ueberbelegt) kopf.title = 'Zeitweise mehr Termine als Plätze';
    col.appendChild(kopf);

    const slots = doc.createElement('div');
    slots.className = 'dv-col-slots';
    for (let i = 0; i < slotZahl; i++) {
      const minuten = von * 60 + i * DV_SLOT_MIN;
      const slot = doc.createElement('div');
      slot.className = 'dv-slot';
      if (heute && minuten + DV_SLOT_MIN <= nowMin) slot.classList.add('dv-slot--past');
      slots.appendChild(slot);
    }

    for (const eintrag of spalte.eintraege) {
      const b = eintrag.termin;
      const g = blockGeometrie(eintrag, von);
      const block = doc.createElement('div');
      block.className = 'dv-booking-block' + (g.hoehe <= 28 ? ' dv-booking-block--compact' : '') + (eintrag.ueberbelegt ? ' raum-ueberbelegt' : '');
      block.dataset.terminId = b.id;
      block.style.top = `${g.top}px`;
      block.style.height = `${g.hoehe}px`;
      block.style.left = `calc(4px + (100% - 8px) * ${g.links / 100})`;
      block.style.width = `calc((100% - 8px) * ${g.breite / 100} - 2px)`;
      const farben = farbeFuer ? farbeFuer(b) : null;
      if (farben) {
        block.style.background = farben.hintergrund || '';
        block.style.borderColor = farben.flaeche || '';
        block.style.borderLeft = `3px solid ${farben.rand}`;
      }
      block.style.color = 'var(--text-main)';
      block.title = `${b.customer_name || b.services?.title || 'Termin'}${eintrag.ueberbelegt ? '\nRaum zu dieser Zeit überbelegt' : ''}`;
      block.innerHTML = blockHtml ? blockHtml(b) : esc(b.customer_name || '');
      const kuerzel = kuerzelFuer ? kuerzelFuer(b) : '';
      if (kuerzel) {
        const zeile = doc.createElement('span');
        zeile.className = 'raum-block-kuerzel';
        zeile.textContent = kuerzel;
        block.appendChild(zeile);
      }
      block.addEventListener('click', ev => { ev.stopPropagation(); onTermin?.(b.id); });
      slots.appendChild(block);
    }
    col.appendChild(slots);
    spaltenHuelle.appendChild(col);
  }
  host.replaceChildren(zeitSpalte, spaltenHuelle);
}

/**
 * Hängt Umschalter und Raster in den Kalender. Fällt still aus, wenn ein Anker im DOM fehlt.
 * @param {object} deps  supabase, getOwnerId, getBusinessId, getTagDatum, getTeam, oeffneTermin,
 *                       termineDesStandorts, blockHtml, farbeFuer
 * @returns {() => void} Abbau (für Tests)
 */
export function mountRaumTagesansicht(deps, doc = globalThis.document) {
  const panel = doc?.getElementById('panel-calendar');
  const leiste = doc?.getElementById('calViewToolbar');
  const tagGrid = doc?.getElementById('dayViewGrid');
  if (!panel || !leiste || !tagGrid) return () => {};
  stilEinfuegen(doc);

  const umschalter = doc.createElement('div');
  umschalter.className = 'cal-view-toggle';
  umschalter.id = 'calAnsichtUmschalter';
  umschalter.hidden = true;
  umschalter.setAttribute('role', 'group');
  umschalter.setAttribute('aria-label', 'Tagesansicht');
  umschalter.innerHTML = '<button type="button" class="cal-view-btn active" data-modus="therapeut">Therapeut</button>'
    + '<button type="button" class="cal-view-btn" data-modus="raum">Raum</button>';
  const vorhanden = leiste.querySelector('.cal-view-toggle');
  if (vorhanden) vorhanden.after(umschalter); else leiste.append(umschalter);

  const host = doc.createElement('div');
  host.id = 'raumTagGrid';
  host.className = 'day-view-grid';
  tagGrid.after(host);

  const stand = { modus: lesen(), raeume: [], lauf: 0, abgebaut: false, warte: null };

  const istTag = () => tagGrid.style.display !== 'none';
  const panelAktiv = () => panel.classList.contains('active');

  function anzeigen(raumAnsicht) {
    // Klassen liegen auf den Rastern selbst: weder das Panel (Beobachter) noch dashboard.js (setzt nur style.display) bemerken sie.
    tagGrid.classList.toggle('raum-ausgeblendet', raumAnsicht);
    host.classList.toggle('raum-sichtbar', raumAnsicht);
  }

  function knoepfe() {
    for (const knopf of umschalter.querySelectorAll('[data-modus]')) {
      knopf.classList.toggle('active', knopf.dataset.modus === stand.modus);
      knopf.setAttribute('aria-pressed', String(knopf.dataset.modus === stand.modus));
    }
  }

  async function zeichnen() {
    const lauf = ++stand.lauf;
    if (stand.abgebaut) return;
    if (!panelAktiv() || !istTag() || !stand.raeume.length) {
      umschalter.hidden = !(stand.raeume.length && istTag());
      anzeigen(false);
      return;
    }
    umschalter.hidden = false;
    knoepfe();
    if (stand.modus !== 'raum') { anzeigen(false); return; }
    try {
      const datum = deps.getTagDatum();
      const vonISO = new Date(`${datum}T00:00:00`).toISOString();
      const bisISO = new Date(`${datum}T23:59:59`).toISOString();
      const { data, error } = await deps.supabase.from('bookings').select(RAUM_TAGES_SELECT)
        .eq('owner_id', deps.getOwnerId()).gte('start_time', vonISO).lte('start_time', bisISO).neq('status', 'cancelled');
      if (error) throw error;
      if (lauf !== stand.lauf) return;
      const termine = (deps.termineDesStandorts ? deps.termineDesStandorts(data || [], deps.getBusinessId()) : data || []);
      const team = deps.getTeam?.() || [];
      const modell = spaltenModell(stand.raeume, termine);
      const heute = datum === new Date().toLocaleDateString('sv-SE');
      rasterZeichnen(doc, host, modell, {
        termine, heute,
        blockHtml: deps.blockHtml,
        farbeFuer: deps.farbeFuer,
        kuerzelFuer: b => mitarbeiterKuerzel(team.find(m => m.id === b.user_id)?.business_name || ''),
        onTermin: id => deps.oeffneTermin?.(id),
      });
      anzeigen(true);
    } catch {
      // Lesefehler: alte Ansicht bleibt oder kommt zurück, nichts werfen.
      if (lauf === stand.lauf) anzeigen(false);
    }
  }

  async function raeumeLaden() {
    try {
      const alle = await ladeRaumliste(deps.supabase, deps.getOwnerId());
      stand.raeume = raeumeDesStandorts(alle, deps.getBusinessId());
    } catch {
      stand.raeume = [];
    }
    return zeichnen();
  }

  const spaeter = () => { clearTimeout(stand.warte); stand.warte = setTimeout(zeichnen, 150); };

  umschalter.addEventListener('click', ev => {
    const knopf = ev.target.closest?.('[data-modus]');
    if (!knopf || knopf.dataset.modus === stand.modus) return;
    stand.modus = knopf.dataset.modus;
    schreiben(stand.modus);
    zeichnen();
  });

  const beobachter = [];
  const beobachte = (el, optionen) => {
    const o = new MutationObserver(spaeter);
    o.observe(el, optionen);
    beobachter.push(o);
  };
  // Panelwechsel (unten): Räume frisch lesen. Ansichtswechsel (Tag/Woche/Monat) und jedes Neuzeichnen der Tagesansicht
  // (Datum, Speichern, Realtime) setzen das Datumsetikett neu: darüber hängt sich das Raster an.
  beobachte(tagGrid, { attributes: true, attributeFilter: ['style'] });
  const datumsLabel = doc.getElementById('dayViewDateLabel');
  if (datumsLabel) beobachte(datumsLabel, { childList: true, characterData: true, subtree: true });
  let warAktiv = panelAktiv();
  const panelBeobachter = new MutationObserver(() => {
    const aktiv = panelAktiv();
    if (aktiv && !warAktiv) raeumeLaden();
    warAktiv = aktiv;
  });
  panelBeobachter.observe(panel, { attributes: true, attributeFilter: ['class'] });
  beobachter.push(panelBeobachter);

  if (warAktiv) raeumeLaden();

  return function abbauen() {
    stand.abgebaut = true;
    clearTimeout(stand.warte);
    beobachter.forEach(o => o.disconnect());
    tagGrid.classList.remove('raum-ausgeblendet');
    umschalter.remove();
    host.remove();
  };
}
