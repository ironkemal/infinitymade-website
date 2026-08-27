/**
 * verordnung-uebersicht.js — die aktiven Verordnungen eines Patienten,
 * nebeneinander, jede mit eigenem Sitzungszähler.
 *
 * Warum es das gibt
 * ─────────────────
 * Stefan Suleiman (Beta, Podologe · 08.08.2026):
 *
 *   „Wir machen für den einen Patienten zwei Akten auf — einmal die
 *    Nagelspange, einmal die Komplexbehandlung."
 *
 * Zwei Akten für einen Patienten sind ein Behelf, kein Wunsch. Der Grund ist
 * fachlich: eine Nagelspangenbehandlung (Diagnosegruppe UI2) und eine
 * podologische Komplexbehandlung (DF/NF/QF) laufen beim selben Patienten
 * GLEICHZEITIG — das sind zwei getrennte Verordnungen mit getrennten
 * Behandlungseinheiten, getrennten Fristen und getrennter Abrechnung. Parallele
 * Verordnungen sind zulässig (Fragen-Antworten-Katalog Podologie Nr. 33).
 *
 * In der Abrechnung war das nie das Problem: `verordnungen` und
 * `podologie_behandlungen` hängen ohnehin je Verordnung zusammen, jede Datei
 * geht getrennt zur Kasse. Gefehlt hat allein die ANZEIGE. Die Patientenakte
 * zeigte im Reiter „Rezepte" nur den Physio-Topf (`prescriptions`) — bei einem
 * Podologen also eine leere Seite, obwohl zwei Verordnungen liefen. Wer sehen
 * wollte, wie viele Einheiten der Nagelspange schon erbracht sind, musste in
 * die Podologie-Abrechnung wechseln und dort in einer Liste ALLER Patienten
 * suchen. Daher der Behelf mit den zwei Akten.
 *
 * Diese Datei zeigt beide Verordnungen dort, wo der Anwender ohnehin steht:
 * in der Akte des Patienten, nebeneinander, jede mit ihrem eigenen Zähler
 * `erbracht / verordnet`.
 *
 * Beide Töpfe, nicht einer
 * ────────────────────────
 *   Fachbereich            | Verordnung     | Behandlung
 *   ─────────────────────  | ────────────── | ──────────────────────
 *   Physio · Ergo · Logo   | prescriptions  | prescription_sessions
 *   Podologie              | verordnungen   | podologie_behandlungen
 *
 * Hier wird bewusst NICHT nach `profiles.sector` unterschieden, sondern immer
 * beides geladen. Eine interdisziplinäre Praxis führt denselben Patienten in
 * beiden Töpfen, und genau dann ist das Nebeneinander am nötigsten. Die Töpfe
 * bleiben getrennt (db/README.md §2) — zusammengelegt wird nur die Ansicht.
 *
 * Warum nicht `verordnungenLaden` aus module/rechnung-verordnung.js
 * ────────────────────────────────────────────────────────────────
 * Das ist der nächste Verwandte und normalisiert dieselben zwei Töpfe. Für die
 * Akte passt es trotzdem nicht:
 *   • Es liefert je nach `sector` genau EINEN Topf — hier werden beide gebraucht.
 *   • Es löst Preise auf (Podologie-Katalog, `bookings → services`) — für einen
 *     Zähler sind das zwei überflüssige Abfragen und eine Katalog-Abhängigkeit.
 *   • Es filtert nicht auf „aktiv" — die Akte soll die LAUFENDEN zeigen.
 * Die Feldnamen sind absichtlich von dort übernommen (`id · quelle · datum ·
 * titel · nummer · einheiten`), damit beide Listen zusammenpassen, falls sie
 * später doch eine Datei werden.
 *
 * Was hier NICHT passiert
 * ───────────────────────
 * Kein Schreiben, keine Statusänderung, keine Abrechnung. Diese Datei liest,
 * zählt und zeigt. Der Klick auf eine Karte springt in das zuständige Panel;
 * das Springen selbst kennt nur `dashboard.js` (`pdSpringeZu`).
 */

'use strict';

import { belegnummerRosette } from './belegnummer.js?v=20260817';

/** Physio-Sitzungen mit diesem Status gelten als erbracht. */
const PHYSIO_ERBRACHT = ['done', 'completed'];

/**
 * Physio-Verordnungen, die nicht mehr laufen. Gleiche Liste wie im
 * Termin-Seitenbereich (dashboard.js, `loadBkVerordnungen`) — eine Verordnung
 * darf nicht an der einen Stelle als aktiv und an der anderen als erledigt
 * gelten.
 */
const PHYSIO_ABGESCHLOSSEN = ['completed', 'billed', 'cancelled'];

/**
 * Podologie-Verordnungen, die noch Arbeit sind. Gleiche Liste wie in der
 * Podologie-Abrechnung (dashboard.js, `loadPodologieBilling`): `abgesetzt` und
 * `teilabsetzung` gehören dazu, weil ausgefallenes Geld sichtbar bleiben muss.
 */
const PODO_AKTIV = ['aktiv', 'abrechenbar', 'abgesetzt', 'teilabsetzung'];

const DE = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('de-DE');
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Zählen
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Der Zähler einer Physio-Verordnung.
 *
 * `verordnet` kommt aus `anzahl_einheiten` und nicht aus der Zahl der
 * Sitzungszeilen: `saveRezept` legt die Zeilen zwar passend an, aber eine
 * nachträglich gelöschte Zeile würde den Nenner still verkleinern und die
 * Verordnung sähe vollständig aus, obwohl Einheiten fehlen.
 *
 * @param {object} rx  Zeile aus `prescriptions` inkl. `prescription_sessions`
 * @returns {{erbracht:number, verordnet:number}}
 */
export function physioZaehler(rx) {
  const sessions = Array.isArray(rx?.prescription_sessions) ? rx.prescription_sessions : [];
  const erbracht = sessions.filter(s => PHYSIO_ERBRACHT.includes(s.status)).length;
  const verordnet = Number(rx?.anzahl_einheiten) || sessions.length || 0;
  return { erbracht, verordnet };
}

/**
 * Der Zähler einer Podologie-Verordnung.
 *
 * Anders als im Physio-Topf gibt es hier keine vorab angelegten Platzhalter:
 * eine Zeile in `podologie_behandlungen` entsteht erst, wenn wirklich behandelt
 * wurde. Gezählt wird also schlicht, wie viele Zeilen an der Verordnung hängen.
 *
 * @param {object} vord   Zeile aus `verordnungen`
 * @param {Array}  behs   die zugehörigen `podologie_behandlungen`
 * @returns {{erbracht:number, verordnet:number}}
 */
export function podoZaehler(vord, behs) {
  return {
    erbracht: Array.isArray(behs) ? behs.length : 0,
    verordnet: Number(vord?.behandlungseinheiten) || 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Laden
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Alle laufenden Verordnungen eines Patienten — aus BEIDEN Töpfen.
 *
 * @param {object} sb        Supabase-Client
 * @param {object} opts
 * @param {string} opts.ownerId
 * @param {string} opts.leadId   Patient (`leads.id`)
 * @returns {Promise<Array>} normalisierte Liste, neueste zuerst:
 *   [{ id, quelle:'physio'|'podologie', datum, titel, diagnose, nummer,
 *      erbracht, verordnet, status, dringend, hausbesuch, ziel, _row }]
 */
export async function ladeAktiveVerordnungen(sb, { ownerId, leadId } = {}) {
  if (!sb || !ownerId || !leadId) return [];

  const frag = async (q) => {
    const { data, error } = await q;
    if (error) { console.error('[verordnung-uebersicht]', error.message); return []; }
    return data || [];
  };

  // Beide Töpfe parallel. `patientennummer` kommt mit, weil die Belegnummer
  // (<Patienten-Nr.>-<Verordnungs-Nr.>) sonst nicht zusammengesetzt werden kann
  // — sie steht bis zur ersten Abrechnung nicht in der Zeile.
  const [rxs, vords, lead] = await Promise.all([
    frag(sb.from('prescriptions')
      .select('id, ausstellungsdatum, gueltig_bis, diagnosegruppe, icd10, heilmittel, ' +
              'anzahl_einheiten, frequenz, status, is_dringend, hausbesuch, ' +
              'belegnummer, verordnungsnummer, prescription_sessions(id, status)')
      .eq('owner_id', ownerId)
      .eq('patient_id', leadId)
      .not('status', 'in', `(${PHYSIO_ABGESCHLOSSEN.map(s => `"${s}"`).join(',')})`)
      .order('ausstellungsdatum', { ascending: false })),
    frag(sb.from('verordnungen')
      .select('id, ausstellungsdatum, diagnosegruppe, icd10, behandlungseinheiten, ' +
              'therapiefrequenz, status, dringend, hausbesuch, rezeptart, behandlungsanlass, ' +
              'heilmittel_items, belegnummer, verordnungsnummer')
      .eq('owner_id', ownerId)
      .eq('lead_id', leadId)
      .in('status', PODO_AKTIV)
      .order('ausstellungsdatum', { ascending: false })),
    (async () => {
      const { data } = await sb.from('leads').select('patientennummer').eq('id', leadId).maybeSingle();
      return data || null;
    })(),
  ]);

  // Behandlungen erst jetzt, denn sie hängen an der Verordnung und nicht am
  // Patienten — `podologie_behandlungen` führt kein lead_id.
  let behsProVord = new Map();
  if (vords.length) {
    const behs = await frag(sb.from('podologie_behandlungen')
      .select('id, verordnung_id, behandlungsdatum')
      .eq('owner_id', ownerId)
      .in('verordnung_id', vords.map(v => v.id)));
    for (const b of behs) {
      if (!behsProVord.has(b.verordnung_id)) behsProVord.set(b.verordnung_id, []);
      behsProVord.get(b.verordnung_id).push(b);
    }
  }

  const patientennummer = lead?.patientennummer ?? null;

  const ausPhysio = rxs.map(rx => {
    const { erbracht, verordnet } = physioZaehler(rx);
    return {
      id: rx.id,
      quelle: 'physio',
      ziel: 'verordnungen',
      datum: rx.ausstellungsdatum,
      titel: rx.heilmittel || rx.diagnosegruppe || 'Verordnung',
      diagnose: [rx.icd10, rx.diagnosegruppe].filter(Boolean).join(' · '),
      frequenz: rx.frequenz || '',
      nummer: belegnummerRosette(rx, { patientennummer, escapeHtml: esc, titel: BELEG_TITEL }),
      erbracht, verordnet,
      status: rx.status,
      dringend: !!rx.is_dringend,
      hausbesuch: !!rx.hausbesuch,
    };
  });

  const ausPodo = vords.map(v => {
    const { erbracht, verordnet } = podoZaehler(v, behsProVord.get(v.id));
    // `icd10` ist im Podologie-Topf ein text[], im Physio-Topf eine Spalte —
    // beim Umschreiben leicht zu verwechseln (db/SCHEMA.sql, Warnung dort).
    const icd = Array.isArray(v.icd10) ? v.icd10.filter(Boolean).join(', ') : (v.icd10 || '');
    return {
      id: v.id,
      quelle: 'podologie',
      ziel: 'podologie',
      datum: v.ausstellungsdatum,
      titel: podoTitel(v),
      diagnose: [icd, v.diagnosegruppe].filter(Boolean).join(' · '),
      frequenz: v.therapiefrequenz || '',
      nummer: belegnummerRosette(v, { patientennummer, escapeHtml: esc, titel: BELEG_TITEL }),
      erbracht, verordnet,
      status: v.status,
      dringend: !!v.dringend,
      hausbesuch: !!v.hausbesuch,
    };
  });

  return [...ausPhysio, ...ausPodo]
    .sort((a, b) => String(b.datum || '').localeCompare(String(a.datum || '')));
}

const BELEG_TITEL = 'Patientennummer-Verordnungsnummer — dieselbe Nummer steht auf Rechnung und Abrechnungsdatei';

/**
 * Überschrift einer Podologie-Verordnung. Die Diagnosegruppe ist das, worüber
 * in der Praxis gesprochen wird („die UI2 läuft noch"), deshalb steht sie vorn.
 */
function podoTitel(v) {
  const dg = v.diagnosegruppe || '';
  if (dg) return dg + (PODO_DG_TEXT[dg.slice(0, 3)] ? ' · ' + PODO_DG_TEXT[dg.slice(0, 3)] : '');
  if ((v.rezeptart || 'kassen') !== 'kassen') return v.behandlungsanlass || v.rezeptart;
  return 'Verordnung';
}

/**
 * Klartext zu den podologischen Diagnosegruppen. Nur die vier, die es gibt —
 * bewusst kurz, die Karte soll aus zwei Metern lesbar bleiben.
 * Quelle: Heilmittel-Richtlinie, Abschnitt Podologie.
 */
const PODO_DG_TEXT = {
  DF1: 'Diabetisches Fußsyndrom',
  DF2: 'Diabetisches Fußsyndrom',
  NF1: 'Neuropathischer Fuß',
  NF2: 'Neuropathischer Fuß',
  QF1: 'Querschnitt-Fußsyndrom',
  QF2: 'Querschnitt-Fußsyndrom',
  UI1: 'Nagelkorrektur',
  UI2: 'Nagelspange',
};

/* ═══════════════════════════════════════════════════════════════════════════
   Zeichnen
   ═══════════════════════════════════════════════════════════════════════════ */

const QUELLE_FARBE = { physio: '#7c3aed', podologie: '#15803d' };
const QUELLE_LABEL = { physio: 'Heilmittel', podologie: 'Podologie' };

/**
 * Zeichnet die Karten nebeneinander. Ohne laufende Verordnung wird nichts
 * gezeichnet — ein leerer Kasten mit „keine Verordnung" nimmt in der Akte nur
 * Platz weg, den die Reiter darunter besser gebrauchen.
 *
 * @param {HTMLElement} el
 * @param {Array} liste            Rückgabe von ladeAktiveVerordnungen
 * @param {object} [deps]
 * @param {Function} [deps.onSprung]  (ziel, id, extra) — Klick auf eine Karte
 * @param {string}   [deps.leadId]    wandert im Sprung mit
 */
export function rendereVerordnungsUebersicht(el, liste, deps = {}) {
  if (!el) return;
  if (!liste?.length) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;

  const kopf = liste.length > 1
    ? `<div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
         ${liste.length} laufende Verordnungen
       </div>`
    : `<div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
         Laufende Verordnung
       </div>`;

  // auto-fit statt fester Spaltenzahl: bei zwei Verordnungen stehen sie
  // nebeneinander, auf dem Telefon untereinander — ohne eigenen Breakpoint.
  el.innerHTML = kopf + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;">`
    + liste.map(karteHtml).join('')
    + `</div>`;

  el.querySelectorAll('.vu-karte').forEach(b => {
    b.addEventListener('click', () => deps.onSprung?.(b.dataset.ziel, b.dataset.id, { leadId: deps.leadId }));
  });
}

function karteHtml(v) {
  const farbe = QUELLE_FARBE[v.quelle] || 'var(--text-muted)';
  const offen = Math.max(0, (v.verordnet || 0) - (v.erbracht || 0));
  const pct = v.verordnet > 0 ? Math.min(100, Math.round((v.erbracht / v.verordnet) * 100)) : 0;
  // Voll heisst nicht fertig: erbracht > verordnet wäre ein Fehler und soll
  // auffallen, deshalb rot statt einfach abgeschnitten.
  const zuviel = v.verordnet > 0 && v.erbracht > v.verordnet;
  const balkenFarbe = zuviel ? '#ef4444' : farbe;

  const marker = [
    v.dringend ? '<span style="color:#ef4444;font-weight:600;">Dringend</span>' : '',
    v.hausbesuch ? '<span>Hausbesuch</span>' : '',
    v.frequenz ? `<span>${esc(v.frequenz)}</span>` : '',
  ].filter(Boolean).join(' · ');

  return `<button type="button" class="vu-karte" data-ziel="${esc(v.ziel)}" data-id="${esc(v.id)}"
    title="Öffnen"
    style="text-align:left;width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--border);
           border-left:3px solid ${farbe};background:var(--bg-card);color:var(--text-main);
           cursor:pointer;display:flex;flex-direction:column;gap:7px;">
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
      <span style="font-size:10px;font-weight:700;color:${farbe};text-transform:uppercase;letter-spacing:.05em;">${QUELLE_LABEL[v.quelle] || ''}</span>
      ${v.nummer || ''}
      <span style="margin-left:auto;font-size:11px;color:var(--text-muted);">${DE(v.datum)}</span>
    </div>

    <div style="font-weight:600;font-size:13px;line-height:1.3;">${esc(v.titel)}</div>
    ${v.diagnose ? `<div style="font-size:11px;color:var(--text-muted);">${esc(v.diagnose)}</div>` : ''}

    <div style="display:flex;align-items:baseline;gap:6px;margin-top:2px;">
      <span style="font-size:18px;font-weight:700;color:${balkenFarbe};">${v.erbracht}</span>
      <span style="font-size:12px;color:var(--text-muted);">/ ${v.verordnet || '—'} Einheiten</span>
      ${offen ? `<span style="margin-left:auto;font-size:11px;color:var(--text-muted);">noch ${offen}</span>` : ''}
    </div>
    <div style="height:5px;border-radius:3px;background:var(--border);overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${balkenFarbe};"></div>
    </div>

    ${marker ? `<div style="font-size:11px;color:var(--text-muted);display:flex;gap:5px;flex-wrap:wrap;">${marker}</div>` : ''}
  </button>`;
}

/** Zähler gegen veraltete Antworten — siehe zeigeVerordnungsUebersicht. */
let _laufendeAbfrage = 0;

/**
 * Laden und zeichnen in einem Aufruf — das ist die Schnittstelle für die Akte.
 *
 * @param {HTMLElement} el
 * @param {object} deps  { sb, ownerId, leadId, onSprung }
 */
export async function zeigeVerordnungsUebersicht(el, deps = {}) {
  if (!el) return;
  // Zuerst leeren, dann laden. Ohne diese Zeile stehen beim Wechsel auf den
  // nächsten Patienten für die Dauer der Abfrage noch die Verordnungen des
  // vorigen da — mit Zähler, also glaubwürdig falsch. Ein kurzer leerer Platz
  // ist harmlos, eine fremde Verordnung in der Akte nicht.
  el.innerHTML = '';
  el.hidden = true;

  // Zweite Sicherung, gegen das Wettrennen: wer schnell durch die Patienten
  // klickt, löst mehrere Abfragen aus, und die langsamere Antwort darf die
  // spätere Anzeige nicht überschreiben. Der Zähler ist modulweit, weil es
  // genau EINEN Behälter in der Akte gibt.
  const meins = ++_laufendeAbfrage;
  const liste = await ladeAktiveVerordnungen(deps.sb, { ownerId: deps.ownerId, leadId: deps.leadId });
  if (meins !== _laufendeAbfrage) return;
  rendereVerordnungsUebersicht(el, liste, deps);
}
