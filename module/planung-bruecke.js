/**
 * planung-bruecke.js — einziger Anschluss der Raumplanung an dashboard.js (Physio/PILOT-PLAN.md M1/M2).
 *
 * dashboard.js darf nicht wachsen (Konsey 2026-08-13), deshalb hängt alles hier: Raumverwaltung im Panel
 * Verfügbarkeit, Raum-Streifen über dem Kalender, Raumwahl im Termin, Tagesansicht Therapeut | Raum.
 *
 * Nur über diese Datei importieren: raum-auswahl.js hält Zustand, ein zweiter Import mit anderem `?v=`
 * wäre eine zweite Instanz ohne Kontext.
 */
import {
  raumAuswahlVerdrahten, raumFelder, terminWarnungen, serieNachpruefen, raumAktionsTermin, ladeRaumliste, tagesgrenzen,
} from './raum-auswahl.js?v=20261103raum';
import { raeumeDesStandorts } from './raum-plan.js';
import { mountRaumVerwaltung } from './raum-verwaltung.js?v=20261103raum';
import { mountRaumStreifen } from './raum-streifen.js';
import { mountRaumTagesansicht } from './raum-tagesansicht.js?v=20261103raum';
import { mountWidgetEinbettung } from './widget-einbettung.js';
import { mountAnstellung, ladeAnstellung, ladeArbeitstage, urlaubsKennzahlen, arbeitstageImZeitraum } from './anstellung.js?v=20261101h';
import { setzeGrundSichtbar } from './abwesenheit.js?v=20261031';
import { mountStandortPlan } from './standort-plan.js?v=20261102a';
import { mountEhemalige } from './ehemalige-mitarbeiter.js?v=20261102a';
import { mountMitteilung } from './sondertag-mitteilung.js?v=20261102a';
import { mountMeinUrlaub } from './mein-urlaub.js?v=20261102a';
import { ladeSondertage, markiereSondertage, sondertagEtikett, sondertagArt, ladeBetroffene, betroffeneTermine, anruflisteHtml } from './sondertag.js';

export { raumFelder, terminWarnungen, serieNachpruefen, raumAktionsTermin, mountWidgetEinbettung, urlaubsKennzahlen, arbeitstageImZeitraum };

let verdrahtet = null;

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

/** Zeichnet die Anstellung im Reiter Urlaub und liefert, was die Urlaubsrechnung braucht. */
export async function anstellungFuerUrlaub(empId, container, nachSpeichern) {
  const { supabase, getOwnerId, istInhaber, showToast } = verdrahtet;
  let host = container.querySelector('.emp-anstellung');
  if (!host) {
    host = document.createElement('div');
    host.className = 'emp-anstellung';
    container.querySelector('.emp-urlaub-kpi')?.before(host);
  }
  mountAnstellung(host, { supabase, ownerId: getOwnerId(), empId, istInhaber: istInhaber(), showToast, nachSpeichern });
  const [anstellung, arbeitstage] = await Promise.all([ladeAnstellung({ supabase, empId }), ladeArbeitstage({ supabase, empId })]);
  return { anspruch: anstellung.urlaub_jahrestage, arbeitstage };
}

/** Etiketten folgen jedem Neuzeichnen des Kalenders, egal welcher Weg es ausgelöst hat. */
function mountSondertagAnzeige(deps) {
  const ansichten = [
    ['woche', document.getElementById('weekViewGrid')],
    ['monat', document.getElementById('monthViewWrap')],
    ['tag', document.getElementById('dayViewGrid')],
  ].filter(([, el]) => el);
  let warte = null;

  async function zeichnen() {
    try {
      const auftraege = [];
      for (const [ansicht, wurzel] of ansichten) {
        const daten = ansicht === 'tag'
          ? [deps.getTagDatum()]
          : [...wurzel.querySelectorAll('[data-datum]')].map(el => el.dataset.datum).sort();
        if (!daten.length || !daten[0]) continue;
        const tage = await ladeSondertage({ supabase: deps.supabase, ownerId: deps.getOwnerId(), von: daten[0], bis: daten[daten.length - 1] });
        auftraege.push({ ansicht, wurzel, tage, tag: daten[0] });
      }
      // Erst nach dem Laden trennen: Zeichnet der Kalender währenddessen neu, meldet der Beobachter das.
      beobachter.disconnect();
      auftraege.forEach(markiere);
    } catch { /* Anzeige darf den Kalender nicht stören */ }
    beobachte();
  }

  function markiere({ ansicht, wurzel, tage, tag }) {
    if (ansicht !== 'tag') { markiereSondertage({ wurzel, tage, ansicht }); return; }
    document.getElementById('sondertagTagEtikett')?.remove();
    const treffer = tage.find(t => t.date === tag);
    const label = document.getElementById('dayViewDateLabel');
    if (!treffer || !label || wurzel.style.display === 'none') return;
    const etikett = sondertagEtikett(document, treffer);
    etikett.id = 'sondertagTagEtikett';
    label.after(etikett);
  }

  const beobachter = new MutationObserver(() => { clearTimeout(warte); warte = setTimeout(zeichnen, 120); });
  function beobachte() {
    ansichten.forEach(([, el]) => beobachter.observe(el, { childList: true, subtree: true }));
  }
  beobachte();
}

/** Nach dem Speichern eines Schließtags: wen die Praxis anrufen muss. Kein Mailversand (M6b wartet auf E13). */
export async function zeigeAnrufliste({ von, bis, type, startTime, endTime }) {
  if (sondertagArt({ type, start_time: startTime || null, end_time: endTime || null }) !== 'geschlossen') return;
  const { supabase, getOwnerId } = verdrahtet;
  const termine = await ladeBetroffene({ supabase, ownerId: getOwnerId(), von, bis });
  const tage = [];
  for (let d = new Date(`${von}T12:00:00`), ende = new Date(`${bis}T12:00:00`); d <= ende; d.setDate(d.getDate() + 1)) {
    tage.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const abschnitte = tage.map(tag => ({ tag, liste: betroffeneTermine(termine, tag) })).filter(t => t.liste.length);
  if (!abschnitte.length) return;
  const dialog = document.createElement('div');
  dialog.id = 'sondertagAnrufliste';
  dialog.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  const karte = document.createElement('div');
  karte.style.cssText = 'background:var(--bg-card-solid);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:560px;width:100%;max-height:80vh;overflow:auto';
  karte.innerHTML = `<div id="sondertagMitteilung"></div>${abschnitte.map(a => anruflisteHtml(a.liste, a.tag)).join('')}<p class="form-hint" style="margin:12px 0">Diese Patienten bitte informieren. Termine werden nicht automatisch verschoben. Wer per E-Mail informiert wurde, muss nicht angerufen werden.</p>`;
  // M6c/S9: Mail-Abschnitt nur als Angebot; ohne Einwilligung/Versandweg bleibt die Anrufliste allein.
  mountMitteilung(karte.querySelector('#sondertagMitteilung'), {
    apiBase: verdrahtet.apiBase, getToken: verdrahtet.getToken, von, bis,
    showToast: verdrahtet.showToast, showConfirmModal: verdrahtet.showConfirmModal,
  }).catch(() => {});
  const zu = document.createElement('button');
  zu.type = 'button';
  zu.className = 'btn-primary';
  zu.textContent = 'Schließen';
  zu.addEventListener('click', () => dialog.remove());
  karte.append(zu);
  dialog.append(karte);
  document.body.append(dialog);
}

/** Einmal beim Start, nach dem Profil. Alle Werte als Getter, weil Standort und Team wechseln können. */
/**
 * Reiter „Standorte" im Team-Panel (M4c/S5). openEmpDetail klont die Reiterknöpfe bei jedem Öffnen,
 * deshalb hört ein delegierter Listener am Detailbereich; die Sichtbarkeit folgt dem Namensfeld, das
 * openEmpDetail bei jedem Öffnen setzt.
 */
function mountStandortplanReiter(deps) {
  const detail = document.getElementById('teamDetailView');
  const inhalt = document.getElementById('tab-standorte');
  const name = document.getElementById('empDetailName');
  if (!detail || !inhalt || !name || !deps.getDetailEmpId || !deps.getStandorte) return;
  const knopf = () => detail.querySelector('.tab-btn[data-tab="standorte"]');
  const sichtbar = () => {
    const k = knopf();
    if (k) k.hidden = !(deps.istInhaber() && (deps.getStandorte() || []).length > 1);
  };
  new MutationObserver(sichtbar).observe(name, { childList: true, characterData: true, subtree: true });
  sichtbar();
  detail.addEventListener('click', async (ereignis) => {
    if (!ereignis.target.closest?.('.tab-btn[data-tab="standorte"]')) return;
    const empId = deps.getDetailEmpId();
    if (!empId) return;
    let erlaubteIds = null;
    const { data } = await deps.supabase.from('employee_business_assignments').select('business_id').eq('employee_id', empId);
    if (Array.isArray(data) && data.length) erlaubteIds = data.map(z => z.business_id);
    mountStandortPlan(inhalt, {
      supabase: deps.supabase, ownerId: deps.getOwnerId(), empId,
      standorte: (deps.getStandorte() || []).map(b => ({ id: b.id, business_name: b.business_name })),
      erlaubteIds, showToast: deps.showToast, showConfirmModal: deps.showConfirmModal, oeffneTermin: deps.oeffneTermin,
    }).catch(() => { inhalt.innerHTML = '<p class="form-hint">Standortplan ist gerade nicht verfügbar.</p>'; });
  });
}

/** „Mein Urlaub“ in der Startübersicht: nur eigene Werte, nur lesend (F11). */
function mountMeinUrlaubAnzeige(deps) {
  const panel = document.getElementById('panel-overview');
  const willkommen = document.getElementById('welcomeOverview');
  if (!panel || !willkommen) return;
  const host = document.createElement('section');
  host.id = 'meinUrlaub';
  host.hidden = true;
  willkommen.after(host);
  const anzeige = mountMeinUrlaub(host, { supabase: deps.supabase, getProfil: () => ({ id: deps.getEigeneId(), role: deps.getRolle?.() }) });
  document.addEventListener('praxura:uebersicht', anzeige.laden);
  beiAktivemPanel(panel, { an: anzeige.laden, aus: anzeige.verwerfen });
}

/** „Ehemalige Mitarbeiter" unter der Teamliste: Löschfrist für Anstellung + Abwesenheiten (nur Inhaber). */
function mountEhemaligeAnzeige(deps) {
  const panel = document.getElementById('panel-team');
  const liste = document.getElementById('teamListView');
  if (!panel || !liste) return;
  const host = document.createElement('div');
  host.id = 'ehemaligeMitarbeiter';
  liste.append(host);
  beiAktivemPanel(panel, {
    an: () => {
      if (!deps.istInhaber()) { host.innerHTML = ''; return; }
      mountEhemalige(host, { supabase: deps.supabase, ownerId: deps.getOwnerId(), showToast: deps.showToast, showConfirmModal: deps.showConfirmModal })
        .catch(() => { host.innerHTML = ''; });
    },
  });
}

export function planungVerdrahten(deps) {
  verdrahtet = deps;
  setzeGrundSichtbar(empId => deps.istInhaber() || deps.getEigeneId() === empId);
  // Eine fehlende Stelle im DOM darf den Rest von dashboard.js nicht abbrechen.
  for (const schritt of [raumAuswahlVerdrahten, mountVerwaltung, mountStreifen, mountSondertagAnzeige, d => mountRaumTagesansicht({ ...d, termineDesStandorts }), mountStandortplanReiter, mountEhemaligeAnzeige, mountMeinUrlaubAnzeige]) {
    try {
      schritt(deps);
    } catch (fehler) {
      console.warn('[planung]', fehler);
    }
  }
}
