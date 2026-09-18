/**
 * termin-panel.js — der Seitenbereich rechts, EIN Aufbau für beide Wege.
 *
 * Warum es das gibt
 * ─────────────────
 * Der Seitenbereich (#bkActionModal) ist ein einziger Kasten im HTML, wurde aber
 * von zwei voneinander unabhängigen Zeichnern befüllt: `openBookingActionModal()`
 * beim Klick auf einen Termin, und `zeigePatientOhneTermin()` bei der Suche nach
 * einem Patienten ohne kommenden Termin. Der zweite zeichnete gar nichts — er
 * versteckte vierzehn von Hand gepflegte Block-Ids. Wer einen Block ergänzte und
 * die Liste vergass, bekam ihn im Patientenmodus zu sehen, obwohl er einen Termin
 * behauptete, den es nicht gab; wer einen Block umbenannte, bekam ihn nie wieder
 * weg. Ergebnis war das, was Ops #308 meldet: „Das rechte Termin-Panel sieht bei
 * jedem Patienten anders aus."
 *
 * Die Regel steht jetzt an einer Stelle:
 *
 *   PANEL_BLOECKE    — was IMMER steht. Mit Termin wie ohne, gleiche Reihenfolge.
 *                      Fehlt der Inhalt, zeigt der Block seinen Grund an; er
 *                      verschwindet nicht.
 *   TERMIN_AKTIONEN  — was einen konkreten Termin voraussetzt (Fahrt, Angekommen,
 *                      Termin starten, No-Show, Bearbeiten/Löschen, Terminzettel).
 *                      Das sind Handlungen, keine Blöcke — ohne Termin bleiben sie zu.
 *
 * Was hier NICHT passiert
 * ───────────────────────
 * Kein Schreiben in die Datenbank. Der Verlauf kommt aus module/patientenkarte.js
 * — dieselbe Liste wie in der Patientenakte, nicht eine zweite Zusammenstellung
 * derselben Ereignisse.
 */

import { ladeVerlauf, renderVerlauf } from './patientenkarte.js?v=20260914';

function escapeHtml(x) {
  return String(x ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const el = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);

// ── Die zwei Listen ────────────────────────────────────────────────────────

/**
 * Handlungen, die einen konkreten Termin voraussetzen. Ohne Termin bleiben sie
 * zu — sie würden sonst auf einen Termin zeigen, den es nicht gibt.
 */
export const TERMIN_AKTIONEN = [
  'bkBookingNotesCard',        // Notiz AM Termin
  'bkActionHbInfo',            // Hausbesuch-Adresse
  'bkActionFahrtStartedGroup',
  'bkActionArrivedGroup',
  'bkActionStartTerminGroup',  // „Termin Starten"
  'bkActionFahrtEndGroup',
  'bkActionDoneGroup',
  'bkActionFussbefundBtn',
  'bkActionTerminButtons',     // Bearbeiten / Löschen
  'bkActionNoShowGroup',       // „Patient nicht erschienen" + Ausfallrechnung
  'bkActionTerminzettelWrap',  // Termine drucken
  'bkActionAuswahlZeile',
  'bkDetailEditBtn',           // der Stift oben in der Terminkarte
];

/**
 * Die Informationsblöcke des Seitenbereichs, in der Reihenfolge, in der sie
 * stehen. Diese Liste ist die Zusage: in BEIDEN Zuständen dieselben Blöcke.
 * Der Kapitest (termin-panel.test.js) prüft genau das.
 */
export const PANEL_BLOECKE = [
  'bkDetailCard',       // oben: Termin oder „kein kommender Termin"
  'bkPatientCard',
  'bkVerlaufCard',
  'bkAnamneseCard',
  'bkPatNotesCard',
  'bkVeroPanelWrap',    // Aktive Verordnungen
  'bkRxInfoCard',       // Rezeptinfo der gewählten Verordnung
  'bkRxSessionsPanel',  // Einheiten: vergeben / offen
];

/**
 * Terminbezogene Handlungen auf- oder zuschliessen.
 *
 * Bewusst asymmetrisch: zugemacht wird alles, aufgemacht nur das, was DIESE
 * Funktion selbst zugemacht hat (`dataset.ohneTermin`). Welche Gruppe danach
 * wirklich sichtbar ist, entscheidet weiterhin `openBookingActionModal`
 * (Hausbesuch ja/nein, eigener Termin ja/nein, No-Show ja/nein). Würde hier
 * pauschal alles geöffnet, stünde jede Fahrtenbuch-Stufe gleichzeitig da.
 *
 * @param {boolean} hatTermin
 */
export function setzeAktionsSichtbarkeit(hatTermin) {
  for (const id of TERMIN_AKTIONEN) {
    const node = el(id);
    if (!node) continue;
    if (!hatTermin) {
      if (!node.hidden) { node.hidden = true; node.dataset.ohneTermin = '1'; }
    } else if (node.dataset.ohneTermin === '1') {
      node.hidden = false;
      delete node.dataset.ohneTermin;
    }
  }
}

// ── Terminkarte oben ───────────────────────────────────────────────────────

/**
 * Die Karte ganz oben. Sie ist der einzige Block, der in den beiden Zuständen
 * etwas anderes sagt — und genau deshalb steht sie in beiden.
 *
 * Ohne Termin trug sie früher Datum und Uhrzeit des ZULETZT geöffneten Termins
 * weiter: ein fremder Termin unter dem Namen des gesuchten Patienten.
 *
 * @param {object|null} args.booking
 * @param {string} args.patientName
 */
export function zeichneTerminkarte({ booking, patientName = '' } = {}) {
  const svc = el('bkDetailService');
  const dt = el('bkDetailDateTime');
  const ther = el('bkDetailTherapist');
  const dauer = el('bkDetailDuration');

  if (!booking) {
    if (svc) svc.textContent = 'Kein kommender Termin';
    if (dt) dt.textContent = patientName;
    if (ther) ther.textContent = 'Patientendaten, Verlauf und Notizen';
    if (dauer) dauer.textContent = '';
    return;
  }

  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time || (start.getTime() + 30 * 60000));
  const durationMin = Math.round((end - start) / 60000);
  const dateStr = start.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    + ' – ' + end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const empName = booking.employee_name || booking.employee?.name || '';

  if (svc) svc.textContent = booking.services?.title || booking.title || '';
  if (dt) dt.textContent = `${dateStr}, ${timeStr}`;
  if (ther) ther.textContent = empName ? `Therapeut: ${empName}` : '';
  if (dauer) dauer.textContent = `${durationMin} Min.`;
}

// ── Abzeichen an der Patientenkarte ────────────────────────────────────────

/**
 * Zuzahlungsbefreiung und Versicherungsart als Abzeichen.
 *
 * Beides haengt am Patienten, nicht am Termin — und beides gehoert damit in
 * beide Zustaende des Panels. Vorher stand die Zeichnung mitten in
 * `openBookingActionModal` und war im Patientenmodus schlicht nicht da.
 *
 * `onclick` statt `addEventListener`: das Panel fuellt sich bei jedem Termin
 * neu, Zuhoerer wuerden sich stapeln und das Formular mehrfach oeffnen.
 *
 * @param {object} args
 * @param {object} args.lead
 * @param {object|null} args.befreiung  Zeile aus `zuzahlung_befreiung`
 * @param {function} args.aufBefreiung  oeffnet das Befreiungsformular
 */
export function zeichnePatientAbzeichen({ lead, befreiung, aufBefreiung }) {
  const zb = el('bkZuzahlungBadge');
  if (zb) {
    const bis = befreiung?.befreit_bis
      ? new Date(befreiung.befreit_bis).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    zb.innerHTML = befreiung
      ? `${bis ? `Zuzahlungsbefreit bis ${escapeHtml(bis)}` : 'Zuzahlungsbefreit'} <span style="cursor:pointer;color:var(--accent,#b1891b);font-size:11px;margin-left:6px;text-decoration:underline;" data-zb-edit="1">ändern</span>`
      : '<span style="cursor:pointer;color:var(--text-muted);font-size:12px;text-decoration:underline;" data-zb-edit="1">+ Befreiungsnachweis eintragen</span>';
    zb.hidden = false;
    const knopf = zb.querySelector?.('[data-zb-edit]');
    if (knopf) knopf.onclick = () => aufBefreiung?.();
  }

  const ins = el('bkInsuranceBadge');
  if (!ins) return;
  const art = lead?.insurance_type;
  if (art !== 'gkv' && art !== 'privat') { ins.hidden = true; return; }
  const gkv = art === 'gkv';
  ins.textContent = gkv ? 'GKV' : 'Privat';
  ins.style.cssText = 'font-size:10px;font-weight:600;padding:1px 7px;border-radius:10px;'
    + (gkv ? 'background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);'
           : 'background:rgba(177,137,27,0.15);color:#b1891b;border:1px solid rgba(177,137,27,0.3);');
  ins.hidden = false;
}

// ── Anamnese ───────────────────────────────────────────────────────────────

/**
 * Die Anamnese-Zusammenfassung. Sie gehört zum Patienten, nicht zum Termin —
 * darum zeichnet sie in beiden Zuständen dieselbe Funktion.
 *
 * @param {HTMLElement} karte    #bkAnamneseCard
 * @param {HTMLElement} inhalt   #bkAnamneseContent
 * @param {HTMLElement} datumEl  #bkAnamneseDatum
 * @param {object|null} daten    Zeile aus `anamnese`
 */
export function zeichneAnamnese(karte, inhalt, datumEl, daten) {
  if (!karte || !inhalt) return;
  if (!daten) { karte.hidden = true; inhalt.innerHTML = ''; return; }

  const aRow = (label, val) => val
    ? `<div><div style="color:var(--text-muted);font-size:10px;text-transform:uppercase;letter-spacing:.04em;">${label}</div><div style="color:var(--text-main);font-weight:500;">${escapeHtml(String(val))}</div></div>`
    : '';
  const skalaBadge = daten.schmerz_skala != null
    ? `<span style="background:${daten.schmerz_skala >= 7 ? 'rgba(239,68,68,0.15)' : daten.schmerz_skala >= 4 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)'};color:${daten.schmerz_skala >= 7 ? '#f87171' : daten.schmerz_skala >= 4 ? '#fbbf24' : '#4ade80'};border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700;">${daten.schmerz_skala}/10</span>`
    : '';

  inhalt.innerHTML = [
    daten.hauptbeschwerde ? `<div style="grid-column:1/-1;"><div style="color:var(--text-muted);font-size:10px;text-transform:uppercase;letter-spacing:.04em;">Hauptbeschwerde</div><div style="color:var(--text-main);font-weight:500;">${escapeHtml(daten.hauptbeschwerde)}</div></div>` : '',
    daten.diagnose ? `<div style="grid-column:1/-1;"><div style="color:var(--text-muted);font-size:10px;text-transform:uppercase;letter-spacing:.04em;">Diagnose</div><div style="color:var(--text-main);font-weight:500;">${escapeHtml(daten.diagnose)}</div></div>` : '',
    daten.schmerz_skala != null ? `<div><div style="color:var(--text-muted);font-size:10px;text-transform:uppercase;letter-spacing:.04em;">Schmerzskala</div><div>${skalaBadge}${daten.schmerz_art ? ' · ' + escapeHtml(daten.schmerz_art) : ''}</div></div>` : '',
    aRow('Arzt', daten.arzt_name),
    aRow('Medikamente', daten.medikamente),
    aRow('Allergien', daten.allergien),
    aRow('Vorerkrankungen', daten.vorerkrankungen),
    daten.besondere_wuensche ? `<div style="grid-column:1/-1;">${aRow('Besondere Wünsche', daten.besondere_wuensche)}</div>` : '',
    daten.notizen ? `<div style="grid-column:1/-1;">${aRow('Notizen', daten.notizen)}</div>` : '',
  ].filter(Boolean).join('');

  if (datumEl && daten.updated_at) {
    datumEl.textContent = new Date(daten.updated_at)
      .toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  karte.hidden = false;
}

// ── Notizen ────────────────────────────────────────────────────────────────

/**
 * Arzt-, Therapeuten- und KI-Notizen zeichnen.
 *
 * Steht hier und nicht in dashboard.js, weil beide Zustaende des Panels sie
 * brauchen. Zwei Abschriften derselben drei Bloecke waeren nach dem ersten
 * Umbau verschieden.
 *
 * @param {HTMLElement} karte   #bkPatNotesCard
 * @param {HTMLElement} inhalt  #bkPatNotesContent
 * @param {object|null} notizen Zeile aus `patient_notes`
 */
export function rendereNotizen(karte, inhalt, notizen) {
  if (!karte || !inhalt) return;
  const hatWas = notizen && (notizen.doctor_notes || notizen.therapist_notes || notizen.ai_summary);
  if (!hatWas) { karte.hidden = true; inhalt.innerHTML = ''; return; }

  const block = (label, text, farbe) => text
    ? '<div><div style="font-size:10px;font-weight:600;color:' + farbe + ';text-transform:uppercase;'
      + 'letter-spacing:.04em;margin-bottom:3px;">' + label + '</div>'
      + '<div style="color:var(--text-main);font-size:12px;line-height:1.5;white-space:pre-wrap;">'
      + escapeHtml(text) + '</div></div>'
    : '';

  inhalt.innerHTML = [
    block('Arztnotizen', notizen.doctor_notes, 'var(--accent,#b1891b)'),
    block('Therapeutennotizen', notizen.therapist_notes, '#60a5fa'),
    block('KI-Zusammenfassung', notizen.ai_summary, 'var(--text-muted)'),
  ].filter(Boolean).join('');
  karte.hidden = false;
}

// ── Verlauf ────────────────────────────────────────────────────────────────

/**
 * Verlauf laden und zeichnen — in BEIDEN Zuständen.
 *
 * Bis 18.09.2026 versteckte `zeigeTerminModus()` diese Karte bei jedem
 * Terminklick und nur der Patientenmodus zeigte sie. Damit war der Verlauf das
 * sichtbarste Unterscheidungsmerkmal zwischen zwei Ansichten, die dasselbe
 * zeigen sollten (Ops #308, Kemal: „in beiden Modi offen lassen").
 *
 * Bewusst ohne `await` beim Aufrufer: der Rest des Panels soll nicht auf diese
 * Abfrage warten. Fehler landen in der Karte, nicht in der Konsole allein.
 */
export async function zeichneVerlauf({ sb, ownerId, leadId, aufSprung }) {
  const karte = el('bkVerlaufCard');
  const inhalt = el('bkVerlaufContent');
  if (!karte || !inhalt) return;
  if (!leadId) { karte.hidden = true; inhalt.innerHTML = ''; return; }

  inhalt.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--text-muted);">Wird geladen …</div>';
  karte.hidden = false;
  try {
    const zeilen = await ladeVerlauf(sb, ownerId, leadId);
    renderVerlauf(inhalt, zeilen, aufSprung);
  } catch (e) {
    console.error('[termin-panel:verlauf]', e);
    inhalt.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--text-muted);">Verlauf konnte nicht geladen werden.</div>';
  }
}

// ── Verordnung im Patientenmodus ───────────────────────────────────────────

/**
 * Welche Verordnung zeigt der Seitenbereich, wenn es keinen Termin gibt?
 *
 * Die neueste nicht abgesagte des Patienten. Ohne diese Vorwahl blieben
 * Rezeptinfo und Einheitenliste im Patientenmodus leer, obwohl der Patient eine
 * laufende Verordnung hat — genau die Ungleichheit, die Ops #308 meldet.
 *
 * ⚠️ Podologie ausgeschlossen: dieses Panel füttert ein Einheiten-Hauptbuch,
 * das die Podologie bewusst NICHT führt (module/verordnung-topf.js). Dieselbe
 * Bremse sitzt in `waehleVerordnungFuerPanel` und in `loadRxSessionsPanel`.
 * `.or()` statt `.neq()`, weil `therapie_bereich` bei physio/ergo/logo meist
 * NULL ist und `col <> 'podo'` NULL-Zeilen aus dem Ergebnis fallen liesse.
 *
 * @returns {Promise<string|null>} prescriptions.id
 */
export async function standardVerordnung(sb, leadId) {
  if (!sb || !leadId) return null;
  const { data, error } = await sb.from('prescriptions').select('id')
    .eq('patient_id', leadId)
    .not('status', 'in', '("cancelled")')
    .or('therapie_bereich.is.null,therapie_bereich.neq.podo')
    .order('ausstellungsdatum', { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle();
  if (error) { console.error('[termin-panel:standardVerordnung]', error); return null; }
  return data?.id || null;
}

// ── „Aktive Verordnung": der Grund, wenn nichts zu zeigen ist ──────────────

/**
 * Die fünf Gründe, aus denen der Einheitenblock nichts anzeigen kann. Bis
 * 18.09.2026 führte jeder davon zu einem stummen `return` mit `hidden = true`:
 * der Block war einfach weg, und niemand konnte sagen warum.
 */
export const SITZUNGEN_LEER_KEYS = {
  keinTermin:     'sitz_leer_kein_termin',
  keineVo:        'sitz_leer_keine_vo',
  ladefehler:     'sitz_leer_fehler',
  podologie:      'sitz_leer_podo',
  keineSitzungen: 'sitz_leer_keine_sitzungen',
};

/** Rückfall, falls kein Übersetzer gereicht wird (Tests, früher Aufruf). */
const SITZUNGEN_LEER_DE = {
  keinTermin:     'Keine Verordnung zugeordnet.',
  keineVo:        'Für diesen Patienten ist keine aktive Verordnung hinterlegt.',
  ladefehler:     'Verordnung konnte nicht geladen werden.',
  podologie:      'Podologie führt kein Einheiten-Hauptbuch — die erbrachten Leistungen stehen in den Behandlungen.',
  keineSitzungen: 'Noch keine Sitzungen erfasst.',
};

/**
 * Die bedienbaren Teile des Blocks. Im Leerzustand haben sie nichts zu bedienen.
 *
 * `bkRxSerieBtn` und `bkRxLeistungenBtn` stehen bewusst NICHT in der Liste, die
 * wieder geöffnet wird: über ihre Sichtbarkeit entscheidet `loadRxSessionsPanel`
 * nach eigenen Regeln (weniger als zwei offene Einheiten / nicht Podologie).
 */
const SITZUNGEN_ARBEIT_ZU = ['bkRxSessionsBadge', 'bkRxSerieBtn', 'bkRxLeistungenBtn',
  'bkRxSitzungTabs', 'bkRxUnvergebeneBox', 'bkRxVergebeneBox'];
const SITZUNGEN_ARBEIT_AUF = ['bkRxSessionsBadge', 'bkRxSitzungTabs',
  'bkRxUnvergebeneBox', 'bkRxVergebeneBox'];

/**
 * Den Einheitenblock mit seinem Grund stehen lassen statt ihn zu verstecken.
 *
 * @param {keyof SITZUNGEN_LEER_KEYS} art
 * @param {object} [opts]
 * @param {function} [opts.t]               Übersetzer aus dashboard.js
 * @param {function} [opts.aufBehandlungen] nur bei `podologie`: Sprung in die
 *   Behandlungsdokumentation. Ein Hinweis ohne Weg wäre eine Sackgasse.
 */
export function zeichneSitzungenLeer(art, { t, aufBehandlungen } = {}) {
  const panel = el('bkRxSessionsPanel');
  if (panel) panel.hidden = false;
  for (const id of SITZUNGEN_ARBEIT_ZU) { const n = el(id); if (n) n.hidden = true; }

  const text = el('bkRxSessionsLeerText');
  if (text) {
    const key = SITZUNGEN_LEER_KEYS[art];
    const uebersetzt = (typeof t === 'function' && key) ? t(key) : null;
    // t() gibt bei unbekanntem Schlüssel den Schlüssel zurück — dann lieber Deutsch.
    text.textContent = (uebersetzt && uebersetzt !== key) ? uebersetzt
      : (SITZUNGEN_LEER_DE[art] || '');
  }

  const btn = el('bkRxSessionsLeerBtn');
  if (btn) {
    const mitWeg = art === 'podologie' && typeof aufBehandlungen === 'function';
    btn.hidden = !mitWeg;
    // Zuweisung statt addEventListener: das Panel füllt sich bei jedem Termin
    // neu, Zuhörer würden sich stapeln.
    btn.onclick = mitWeg ? aufBehandlungen : null;
    if (mitWeg) btn.textContent = '→ Behandlungen dokumentieren';
  }

  const kasten = el('bkRxSessionsLeer');
  if (kasten) kasten.hidden = false;
}

/** Zurück in den Arbeitszustand — der Leerkasten geht zu, die Listen auf. */
export function zeigeSitzungenArbeit() {
  const kasten = el('bkRxSessionsLeer');
  if (kasten) kasten.hidden = true;
  const btn = el('bkRxSessionsLeerBtn');
  if (btn) { btn.hidden = true; btn.onclick = null; }
  for (const id of SITZUNGEN_ARBEIT_AUF) { const n = el(id); if (n) n.hidden = false; }
}
