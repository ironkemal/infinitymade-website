/**
 * verordnung-uebersicht.js — die aktiven Verordnungen eines Patienten,
 * nebeneinander, jede mit eigenem Sitzungszähler.
 *
 * Warum es das gibt
 * ─────────────────
 * Beta-1 (Beta, Podologe · 08.08.2026):
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
 * In der Abrechnung war das nie das Problem: die podologische Verordnung und
 * `podologie_behandlungen` hängen ohnehin je Verordnung zusammen, jede Datei
 * geht getrennt zur Kasse. Gefehlt hat allein die ANZEIGE. Die Patientenakte
 * zeigte im Reiter „Rezepte" damals nur den Physio-Zweig — bei einem Podologen
 * also eine leere Seite, obwohl zwei Verordnungen liefen. Wer sehen wollte,
 * wie viele Einheiten der Nagelspange schon erbracht sind, musste in die
 * Podologie-Abrechnung wechseln und dort in einer Liste ALLER Patienten
 * suchen. Daher der Behelf mit den zwei Akten.
 *
 * Diese Datei zeigt beide Verordnungen dort, wo der Anwender ohnehin steht:
 * in der Akte des Patienten, nebeneinander, jede mit ihrem eigenen Zähler
 * `erbracht / verordnet`.
 *
 * Zwei Zweige, EIN Topf (seit 04.09.2026)
 * ────────────────────────────────────────
 *   Fachbereich            | therapie_bereich | Behandlung
 *   ─────────────────────  | ──────────────── | ──────────────────────
 *   Physio · Ergo · Logo   | ≠ 'podo'         | prescription_sessions
 *   Podologie              | = 'podo'         | podologie_behandlungen
 *
 * Beide Abfragen unten treffen dieselbe Tabelle (`prescriptions`) und werden
 * durch `therapie_bereich` GEGENSEITIG AUSSCHLIESSEND gehalten — das ist
 * Pflicht, nicht Kosmetik: ohne die beiden Filter erschiene ein und dieselbe
 * podologische Zeile zweimal (einmal aus jeder Abfrage), oder eine physio-
 * therapeutische Zeile fiele der podologischen Kartenansicht zu.
 *
 * Hier wird bewusst NICHT nach `profiles.sector` unterschieden, sondern immer
 * beides geladen. Eine interdisziplinäre Praxis führt denselben Patienten in
 * beiden Zweigen, und genau dann ist das Nebeneinander am nötigsten.
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

import { belegnummerRosette, belegnummerText } from './belegnummer.js?v=20260817';
import { bereichFarbe, bereichBadge } from './abrechnungsstatus.js?v=20260905a';
// Seit 04.09.2026 EIN Verordnungstopf (`prescriptions`). `ausTopf()` übersetzt
// eine Zeile davon in genau den podologischen Wortschatz, den `ausPodo()`
// unten schon immer erwartet hat (lead_id, behandlungseinheiten,
// therapiefrequenz, dringend, icd10 als Array, status als podologische
// Achse) — dieselbe Grenzfunktion, die auch module/podologie-abrechnung.js
// benutzt.
import { ausTopf, PODO_ARBEITSLISTE_OR } from './verordnung-topf.js?v=20260904';

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
    erbracht: Array.isArray(behs) ? behs.filter(istBehandlungseinheit).length : 0,
    verordnet: Number(vord?.behandlungseinheiten) || 0,
  };
}

// 78010/78020 podologische Behandlung, 78610 Nagelspangenbehandlung. Befundung
// (78030/78040/78100/78110), Kontrolle (78510), Abschluss (78520), Bericht
// (78530), Zuschlag (78620) und Hausbesuch (79933/79934) sind KEINE Einheiten.
const POD_BEHANDLUNGSPOSITIONEN = new Set(['78010', '78020', '78610']);

/**
 * Zaehlt diese Zeile gegen die verordnete Menge?
 *
 * Nicht jede Zeile in `podologie_behandlungen` ist eine Behandlungseinheit.
 * Anlage 1a i.d.F. 17.06.2024, Teil 2 Ziffer 4.1 sagt ausdruecklich:
 * "Die Eingangsbefundung ist: - keine Behandlungseinheit im Sinne der
 * Heilmittel-Richtlinie". Dasselbe gilt fuer Befundung, Kontrolle und
 * Abschluss — bezahlt werden sie, verbraucht wird durch sie nichts.
 *
 * Sichtbar wird das nur, wenn so eine Position ALLEIN auf einem Tag steht:
 * eine Erstbefundung ohne anschliessende Therapie etwa ist ausdruecklich
 * zulaessig (ZFD-FAK Podologie, Stand Juli 2024). Vorher zaehlte diese Zeile
 * als verbrauchte Einheit, die Verordnung galt eine Sitzung zu frueh als
 * ausgeschoepft — verschenkte Leistung statt Absetzung, aber ebenso Geld.
 * Im Normalfall (78040 zusammen mit 78010 am selben Tag, eine Zeile) aendert
 * sich nichts.
 *
 * Gezaehlt wird positiv: eine Zeile ist eine Einheit, wenn eine echte
 * Behandlungsposition drin steht. Zeilen ohne HPNR-Codes (Altbestand, bevor
 * die Codes gepflegt wurden) zaehlen weiterhin mit — sonst schrumpfte
 * rueckwirkend jeder alte Zaehler.
 *
 * @param {object} beh  Zeile aus `podologie_behandlungen`
 * @returns {boolean}
 */
export function istBehandlungseinheit(beh) {
  const codes = beh?.hpnr_codes;
  if (!Array.isArray(codes) || codes.length === 0) return true;
  return codes.some(c => POD_BEHANDLUNGSPOSITIONEN.has(String(c)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Laden
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Alle Verordnungen aus BEIDEN Töpfen — je nach Aufruf für einen Patienten
 * oder für die ganze Praxis.
 *
 * Zwei Betriebsarten, EINE Funktion
 * ─────────────────────────────────
 * Ursprünglich beantwortete diese Funktion genau eine Frage: „was läuft bei
 * DIESEM Patienten?" (Akte). Seit dem Umbau der Seite „Verordnungen"
 * (Kemal, 31.08.2026) wird dieselbe Zusammenführung ein zweites Mal gebraucht,
 * nur praxisweit und ohne Filter auf „aktiv". Das ist keine zweite Frage,
 * sondern dieselbe mit weiterem Ausschnitt — deshalb zwei Parameter statt
 * einer vierten Ladefunktion. Die drei bestehenden Lader und warum sie sich
 * unterscheiden, stehen im Kopf dieser Datei.
 *
 * @param {object} sb        Supabase-Client
 * @param {object} opts
 * @param {string} opts.ownerId
 * @param {string} [opts.leadId]   Patient (`leads.id`). Fehlt er, wird
 *        praxisweit geladen — dann tragen die Zeilen den Patientennamen.
 * @param {boolean} [opts.nurAktive=true]  `false` lädt auch abgeschlossene,
 *        abgerechnete und stornierte Verordnungen (Seite „Verordnungen").
 * @param {number} [opts.limit=200]  greift nur praxisweit.
 * @returns {Promise<Array>} normalisierte Liste, neueste zuerst:
 *   [{ id, quelle:'physio'|'podologie', datum, titel, diagnose, nummer,
 *      nachname, vorname, patientennummer, leadId,
 *      erbracht, verordnet, status, dringend, hausbesuch, ziel }]
 */
export async function ladeAktiveVerordnungen(sb, { ownerId, leadId, nurAktive = true, limit = 200 } = {}) {
  if (!sb || !ownerId) return [];

  const frag = async (q) => {
    const { data, error } = await q;
    if (error) { console.error('[verordnung-uebersicht]', error.message); return []; }
    return data || [];
  };

  // Beide Töpfe parallel. Der `leads`-Verbund kommt IMMER mit, aus zwei
  // Gründen: praxisweit steht der Name in der Zeile (die Liste zeigt Nachname
  // und Vorname getrennt), und die Belegnummer (<Patienten-Nr.>-<Verordnungs-
  // Nr.>) lässt sich ohne `patientennummer` nicht zusammensetzen — sie steht
  // bis zur ersten Abrechnung nicht in der Zeile.
  let rxQ = sb.from('prescriptions')
    .select('id, patient_id, ausstellungsdatum, gueltig_bis, diagnosegruppe, icd10, heilmittel, ' +
            'anzahl_einheiten, frequenz, status, is_dringend, hausbesuch, ' +
            'belegnummer, verordnungsnummer, prescription_sessions(id, status), ' +
            'leads!patient_id(first_name, last_name, patientennummer)')
    .eq('owner_id', ownerId)
    // Pflichtfilter (siehe Kopf) — sonst erscheint eine podologische Zeile
    // zusätzlich hier. `.or()` statt `.neq()`: Altbestand vor Einführung des
    // Felds führt `therapie_bereich = NULL`, und `<> 'podo'` liesse NULL-
    // Zeilen in SQL aus dem Ergebnis fallen.
    .or('therapie_bereich.is.null,therapie_bereich.neq.podo');
  let voQ = sb.from('prescriptions')
    .select('id, patient_id, patient_name, ausstellungsdatum, diagnosegruppe, icd10, icd10_2, ' +
            'anzahl_einheiten, frequenz, abrechnung_status, is_dringend, hausbesuch, rezeptart, ' +
            'behandlungsanlass, heilmittel_items, belegnummer, verordnungsnummer, ' +
            'leads!patient_id(first_name, last_name, patientennummer)')
    .eq('owner_id', ownerId)
    // Gegenstück zum obigen Filter — Pflicht, nicht Kosmetik (siehe Kopf).
    .eq('therapie_bereich', 'podo');

  if (leadId) {
    rxQ = rxQ.eq('patient_id', leadId);
    voQ = voQ.eq('patient_id', leadId);
  } else {
    rxQ = rxQ.limit(limit);
    voQ = voQ.limit(limit);
  }

  // Der Filter „läuft noch" gilt nur in der Akte. Die Seite „Verordnungen"
  // zeigt auch Abgerechnetes — dort ist gerade der Statuswechsel die
  // Information, und eine Verordnung, die nach der Abrechnung aus der Liste
  // verschwindet, sieht aus wie ein Datenverlust.
  if (nurAktive) {
    rxQ = rxQ.not('status', 'in', `(${PHYSIO_ABGESCHLOSSEN.map(s => `"${s}"`).join(',')})`);
    // Gleiche Menge wie PODO_AKTIV (aktiv/abrechenbar/abgesetzt/teilabsetzung),
    // nur auf die Spalte abrechnung_status übersetzt — siehe verordnung-topf.js.
    voQ = voQ.or(PODO_ARBEITSLISTE_OR);
  }

  const [rxs, vordsRoh, lead] = await Promise.all([
    frag(rxQ.order('ausstellungsdatum', { ascending: false })),
    frag(voQ.order('ausstellungsdatum', { ascending: false })),
    leadId
      ? (async () => {
          const { data } = await sb.from('leads').select('patientennummer').eq('id', leadId).maybeSingle();
          return data || null;
        })()
      : Promise.resolve(null),
  ]);

  // Ab hier spricht der podologische Zweig wieder seinen gewohnten Wortschatz
  // (lead_id, behandlungseinheiten, therapiefrequenz, dringend, icd10 als
  // Array, status als podologische Achse) — übersetzt an der Grenze, damit
  // `ausPodo()` unten unverändert bleibt.
  const vords = vordsRoh.map(ausTopf);

  // Behandlungen erst jetzt, denn sie hängen an der Verordnung und nicht am
  // Patienten — `podologie_behandlungen` führt kein lead_id.
  let behsProVord = new Map();
  if (vords.length) {
    // `hpnr_codes` MUSS mitkommen: `istBehandlungseinheit` entscheidet daran,
    // ob eine Zeile gegen die verordnete Menge zählt (eine Eingangsbefundung
    // allein tut das nicht). Ohne die Spalte sah die Funktion immer `undefined`
    // und zählte jede Zeile mit — die Regel war zwar geschrieben, wirkte hier
    // aber nie. Gefunden beim Umbau der Seite „Verordnungen" (02.09.2026).
    const behs = await frag(sb.from('podologie_behandlungen')
      .select('id, verordnung_id, behandlungsdatum, hpnr_codes')
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
    const p = rx.leads || {};
    const pnr = p.patientennummer ?? patientennummer;
    return {
      id: rx.id,
      quelle: 'physio',
      ziel: 'verordnungen',
      datum: rx.ausstellungsdatum,
      titel: rx.heilmittel || rx.diagnosegruppe || 'Verordnung',
      diagnose: [rx.icd10, rx.diagnosegruppe].filter(Boolean).join(' · '),
      frequenz: rx.frequenz || '',
      nummer: belegnummerRosette(rx, { patientennummer: pnr, escapeHtml: esc, titel: BELEG_TITEL }),
      nummerText: belegnummerText(rx, { patientennummer: pnr }),
      nachname: p.last_name || '',
      vorname: p.first_name || '',
      patientennummer: pnr ?? null,
      leadId: rx.patient_id || null,
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
    const p = v.leads || {};
    const pnr = p.patientennummer ?? patientennummer;
    const ausName = p.last_name ? null : nameAusFreitext(v.patient_name);
    return {
      id: v.id,
      quelle: 'podologie',
      ziel: 'podologie',
      datum: v.ausstellungsdatum,
      titel: podoTitel(v),
      diagnose: [icd, v.diagnosegruppe].filter(Boolean).join(' · '),
      frequenz: v.therapiefrequenz || '',
      nummer: belegnummerRosette(v, { patientennummer: pnr, escapeHtml: esc, titel: BELEG_TITEL }),
      nummerText: belegnummerText(v, { patientennummer: pnr }),
      nachname: p.last_name || ausName?.nachname || '',
      vorname:  p.first_name || ausName?.vorname  || '',
      patientennummer: pnr ?? null,
      leadId: v.lead_id || null,
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
 * Notbehelf für Podologie-Verordnungen OHNE Patientenakte.
 *
 * `verordnungen.patient_name` ist ein Freitextfeld aus der Zeit, als eine
 * Verordnung ohne `lead_id` angelegt werden konnte; es steht dort in der Form
 * „Werner Müller" oder „Werner Müller · 1955-12-19". Getrennte Spalten für
 * Nach- und Vorname gibt es dort nicht.
 *
 * Geraten wird bewusst nur das Nötigste — letztes Wort = Nachname, Rest =
 * Vorname. Bei „von der Heide" ist das falsch, und das ist hinnehmbar: die
 * Zeile ist ohnehin ein Altfall, der an eine Akte gebunden gehört (ohne
 * `lead_id` vergibt der Trigger auch keine Verordnungsnummer, die Belegnummer
 * bleibt dann leer). Neu entstehen solche Zeilen nicht mehr —
 * `podologie-abrechnung.js` verlangt bei GKV die Auswahl aus der Kartei.
 */
function nameAusFreitext(roh) {
  const text = String(roh || '').split('·')[0].trim();
  if (!text) return null;
  const teile = text.split(/\s+/);
  if (teile.length === 1) return { nachname: teile[0], vorname: '' };
  return { nachname: teile[teile.length - 1], vorname: teile.slice(0, -1).join(' ') };
}

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
  const farbe = bereichFarbe(v.quelle);
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
      ${bereichBadge(v.quelle)}
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
