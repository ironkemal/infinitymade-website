/**
 * planung-bruecke.js — einziger Anschluss der Raumplanung an dashboard.js (Physio/PILOT-PLAN.md M1/M2).
 *
 * dashboard.js darf nicht wachsen (Konsey 2026-08-13), deshalb hängt alles hier: Raumverwaltung im Panel
 * Verfügbarkeit, Raum-Streifen über dem Kalender, Raumwahl im Termin.
 *
 * Nur über diese Datei importieren: raum-auswahl.js hält Zustand, ein zweiter Import mit anderem `?v=`
 * wäre eine zweite Instanz ohne Kontext.
 */
import {
  raumAuswahlVerdrahten, raumFelder, terminWarnungen, serieNachpruefen, raumAktionsTermin, ladeRaumliste, tagesgrenzen,
} from './raum-auswahl.js';
import { raeumeDesStandorts } from './raum-plan.js';
import { mountRaumVerwaltung } from './raum-verwaltung.js';
import { mountRaumStreifen } from './raum-streifen.js';

export { raumFelder, terminWarnungen, serieNachpruefen, raumAktionsTermin };

const STREIFEN_SPALTEN = 'id,room_id,user_id,business_id,status,start_time,end_time,group_parent_id';

/** Termine ohne Standort sind Altzeilen und zählen überall mit. */
export function termineDesStandorts(termine, businessId) {
  if (!businessId) return termine;
  return termine.filter(t => !t.business_id || t.business_id === businessId);
}

function beiAktivemPanel(panel, { an, aus = () => {} }) {
  let aktiv = false;
  const pruefen = () => {
    const jetzt = panel.classList.contains('active');
    if (jetzt === aktiv) return;
    aktiv = jetzt;
    if (jetzt) an(); else aus();
  };
  new MutationObserver(pruefen).observe(panel, { attributes: true, attributeFilter: ['class'] });
  pruefen();
}

function mountVerwaltung(deps) {
  const panel = document.getElementById('panel-hours');
  if (!panel) return;
  const host = document.createElement('section');
  host.className = 'card';
  host.id = 'raumVerwaltung';
  panel.append(host);
  beiAktivemPanel(panel, {
    an: () => mountRaumVerwaltung(host, {
      supabase: deps.supabase,
      ownerId: deps.getOwnerId(),
      businessId: deps.getBusinessId(),
      istInhaber: deps.istInhaber(),
      showToast: deps.showToast,
      showConfirmModal: deps.showConfirmModal,
    }).catch(() => {}),
  });
}

function mountStreifen(deps) {
  const panel = document.getElementById('panel-calendar');
  const leiste = document.getElementById('calViewToolbar');
  if (!panel || !leiste) return;
  const host = document.createElement('div');
  host.id = 'raumStreifen';
  host.hidden = true;
  leiste.before(host);

  async function holeDaten() {
    const ownerId = deps.getOwnerId();
    const businessId = deps.getBusinessId();
    const raeume = raeumeDesStandorts(await ladeRaumliste(deps.supabase, ownerId), businessId);
    if (!raeume.length) return { raeume };
    const { vonISO, bisISO } = tagesgrenzen(Date.now());
    const { data, error } = await deps.supabase.from('bookings').select(STREIFEN_SPALTEN)
      .eq('owner_id', ownerId).gte('start_time', vonISO).lte('start_time', bisISO).neq('status', 'cancelled');
    if (error) throw error; // Letzten Stand behalten statt „alles frei" zu melden.
    return { raeume, termine: termineDesStandorts(data || [], businessId), mitarbeiter: deps.getTeam() };
  }

  let stop = null;
  beiAktivemPanel(panel, {
    an: () => { stop = mountRaumStreifen(host, { holeDaten, onTerminKlick: id => deps.oeffneTermin(id) }); },
    aus: () => { stop?.(); stop = null; },
  });
}

/** Einmal beim Start, nach dem Profil. Alle Werte als Getter, weil Standort und Team wechseln können. */
export function planungVerdrahten(deps) {
  raumAuswahlVerdrahten(deps);
  mountVerwaltung(deps);
  mountStreifen(deps);
}
