/**
 * termin-aktionsleiste.js — die Handlungen im Seitenbereich (#bkActionModal).
 *
 * Warum es das gibt
 * ─────────────────
 * Der Seitenbereich hatte 17 Knöpfe. Konsey 30.09.2026 (Podologie-Reform S0/S4):
 * höchstens SECHS sichtbar — Statusknopf (Fahrt starten / Angekommen / Termin
 * starten / Fahrt beenden, der eine Primärknopf, steht in seiner eigenen
 * Gruppe), Verordnung, Patientenakte, Folgetermin, Verschieben, Nicht
 * erschienen. Alles Seltene und Zerstörende steht hinter „Weitere Aktionen …":
 * Absagen, Terminzettel, Adresse kopieren, Fußbefund.
 *
 * Die Knöpfe behalten ihre alten ids — die bestehende Verdrahtung in
 * dashboard.js (Termin starten, Nicht erschienen, Ausfallrechnung, „Doch
 * behandelt", Verschieben, Terminzettel, Absagen) bleibt unangetastet. Neu
 * verdrahtet werden hier nur: „Verordnung", „Folgetermin" und das Menü.
 *
 * Aufbau: HTML in dashboard.html (#bkAktionsleiste), Stil in dashboard.css
 * (.bk-akt-*), Sichtbarkeit nach Termin/ohne Termin in module/termin-panel.js
 * (TERMIN_AKTIONEN).
 */

import { oeffneFolgetermin } from './termin-folge.js?v=20261003a';

/** Die sechs sichtbaren Handlungen — der Kapitest prüft genau diese Liste gegen dashboard.html. */
export const SICHTBARE_AKTIONEN = [
  'bkActionVeroBtn', 'bkOpenPatientBtn', 'bkActionFolgeBtn', 'bkActionEditBtn', 'bkActionNoShowGroup',
];

/** Was hinter „Weitere Aktionen …" steckt. */
export const MENUE_AKTIONEN = [
  'bkActionDeleteBtn', 'bkActionTerminzettelBtn', 'bkActionHbCopyBtn', 'bkActionFussbefundBtn',
];

/**
 * Wohin springt „Verordnung"?
 *
 * Reine Entscheidung ohne DOM: steht im Panel schon ein Verordnungsblock, geht
 * es dorthin; sonst wird eine neue Verordnung angelegt (Wahl Scan/Hand).
 *
 * @param {Array<{id:string, sichtbar:boolean}>} bloecke  in Panelreihenfolge
 * @returns {{art:'springen', id:string}|{art:'anlegen'}}
 */
export function verordnungsZiel(bloecke) {
  const treffer = (bloecke || []).find(b => b && b.sichtbar);
  return treffer ? { art: 'springen', id: treffer.id } : { art: 'anlegen' };
}

const el = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);

// Diese Blöcke zeigen eine Verordnung des Patienten; der Einheitenblock zählt
// nicht — er zeigt auch den Leerzustand „keine Verordnung".
const VERORDNUNGS_BLOECKE = ['bkVeroPanelWrap', 'bkRxInfoCard'];

function schliesseMenue() {
  const menue = el('bkAktionsMenue');
  const knopf = el('bkActionMehrBtn');
  if (menue) menue.hidden = true;
  if (knopf) knopf.setAttribute('aria-expanded', 'false');
}

function oeffneMenue() {
  const menue = el('bkAktionsMenue');
  const knopf = el('bkActionMehrBtn');
  if (!menue || !knopf) return;
  // Adresse kopieren gibt es nur bei einem Hausbesuch — dort steht die Adresse.
  const hbKarte = el('bkActionHbInfo');
  const kopieren = el('bkActionHbCopyBtn');
  if (kopieren) kopieren.hidden = !hbKarte || hbKarte.hidden;
  menue.hidden = false;
  knopf.setAttribute('aria-expanded', 'true');
}

/**
 * Hängt „Verordnung", „Folgetermin" und das Menü an.
 *
 * @param {object} deps
 * @param {function} deps.getBooking      () => Termin oder null
 * @param {function} deps.getLeadId       () => Patienten-id oder null
 * @param {function} deps.oeffneAnlegenWahl (leadId)
 * @param {function} deps.toast
 * @param {object}   deps.folge           Zugriffe für `oeffneFolgetermin` (siehe dort)
 */
export function verdrahteAktionsleiste(deps) {
  const { getBooking, getLeadId, toast } = deps;
  const leiste = el('bkAktionsleiste');
  if (!leiste || leiste.dataset.verdrahtet === '1') return;
  leiste.dataset.verdrahtet = '1';

  // Folgetermin gibt es nur in der Podologie (Konsey-Beschluss S0). Ob der
  // Knopf steht, entscheidet `setzeAktionsSichtbarkeit(hatTermin, podologie)`
  // in module/termin-panel.js — die Fachrichtung steht beim Laden dieses Moduls
  // noch nicht fest.
  const folgeBtn = el('bkActionFolgeBtn');

  el('bkActionVeroBtn')?.addEventListener('click', () => {
    const ziel = verordnungsZiel(VERORDNUNGS_BLOECKE.map(id => {
      const n = el(id);
      return { id, sichtbar: !!n && !n.hidden };
    }));
    if (ziel.art === 'springen') {
      const n = el(ziel.id);
      n?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      n?.classList.add('bk-akt-blitz');
      setTimeout(() => n?.classList.remove('bk-akt-blitz'), 1200);
      return;
    }
    const leadId = getLeadId();
    if (!leadId) { toast?.('Bitte zuerst einen Patienten wählen.', 'warning'); return; }
    deps.oeffneAnlegenWahl(leadId);
  });

  folgeBtn?.addEventListener('click', async () => {
    try { await oeffneFolgetermin(getBooking(), { ...deps.folge, toast }); }
    catch (e) {
      console.error('[folgetermin]', e);
      toast?.('Folgetermin konnte nicht vorbelegt werden.', 'error');
    }
  });

  el('bkActionMehrBtn')?.addEventListener('click', () => {
    const menue = el('bkAktionsMenue');
    if (!menue) return;
    if (menue.hidden) oeffneMenue(); else schliesseMenue();
  });
  // Ein Klick auf einen Menüpunkt führt ihn aus (eigene Verdrahtung) und schliesst das Menü.
  el('bkAktionsMenue')?.addEventListener('click', (e) => {
    if (e.target.closest('button')) setTimeout(schliesseMenue, 0);
  });
  // Escape bei offenem Menü schliesst NUR das Menü, nicht das Seitenpanel (canli-test 30.09, P3).
  // Capture-Phase + stopImmediatePropagation: der Escape-Zuhörer in dashboard.js (Panel schliessen)
  // hängt am selben document, aber in der Bubble-Phase und kommt danach nicht mehr dran.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const menue = el('bkAktionsMenue');
    if (!menue || menue.hidden) return;
    schliesseMenue();
    e.stopImmediatePropagation();
  }, true);
}
