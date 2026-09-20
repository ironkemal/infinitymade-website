/**
 * podo-einheiten.js — die Einheiten einer podologischen Verordnung im
 * Terminbereich: vergebene, offene, und was an jeder mitläuft.
 *
 * Anlass (Kemal, 18.09.2026)
 * ─────────────────────────
 * „Hastanın o verordnung için verilmemiş seanslarda gözükür olacak … #1
 *  numaralı seansında eingangsbefund + hizmet olacak, kalan seanslarda #2, #3
 *  hizmet + befund … #2 numaralı randevu şimdi olduğu gibi sürükle-bırak
 *  yapıldığında gene atanacak. … Şu an geriye dönüp her seans için tek tek
 *  ekleniyor."
 *
 * Physio/Ergo/Logo haben diese Liste: `prescription_sessions`, eine Zeile je
 * verordneter Einheit, ziehbar auf den Kalender. Die Podologie hatte im
 * Terminbereich bisher NICHTS — der Block sagte „Podologie führt kein
 * Einheiten-Hauptbuch" (`module/termin-panel.js`), und wer einen Termin einer
 * Verordnung zuordnen wollte, musste in die Verordnungsseite und „zuordnen"
 * drücken (`module/verordnung-termine.js`).
 *
 * Wichtigste Entscheidung: KEINE Zeilen in `prescription_sessions`
 * ────────────────────────────────────────────────────────────────
 * `db-ustasi` und `fonksiyon-ustasi` (18.09.2026) haben beide geprüft, was ein
 * Hauptbuch für die Podologie kosten würde: ein zweiter Zähler auf denselben
 * Statusspalten (`sitzungsfortschritt.js` gegen `podologie-abrechnung.js`), ein
 * zweiter Termin↔Verordnung-Bezug neben `bookings.verordnung_id`, und 24
 * Altzeilen, die im Panel plötzlich auftauchen. Und was eine gespeicherte Zeile
 * WISSEN könnte, ist nichts, was nicht schon dasteht: sie trüge keine
 * Positionsnummer (die hängt an der Geschichte des Patienten, nicht an der
 * Sitzung — `befundungFuerLeistung()`), und ihre Zahl wäre `anzahl_einheiten −
 * vergebene Termine`. Deshalb sind die offenen Einheiten hier BERECHNET, so wie
 * `terminZaehler()` es schon tut — nur mit einem Gesicht.
 *
 * Termin↔Verordnung bleibt EINE Spalte: `bookings.verordnung_id`, geschrieben
 * allein von `bindeTermin()` (`module/verordnung-termine.js`) — dort sind der
 * Owner-Riegel (42501) und die „0 Zeilen geändert"-Falle bereits gelöst. Kein
 * `verordnung_id` im Insert-Payload: das wäre ein zweiter, schwächerer
 * Schreibweg auf dieselbe Regel.
 *
 * Was hier NICHT passiert
 * ───────────────────────
 * Nichts wird abgerechnet und keine Position gesetzt. Die Befund-Beschriftung ist
 * eine Anzeige; sie kommt aus `sitzungsplan()` → `befundungFuerLeistung()`
 * (Regel und Fundstellen dort). Gesetzt werden die Positionen weiterhin allein in
 * der Podologie-Abrechnung, wo alle Sperren laufen (78040 nicht neben 78030, 78100
 * einmal je Kalenderjahr, Behandlungsbeginn-Frist).
 */

import { sitzungsplan } from './sitzungsplan.js?v=20260918';
import { positionVon } from './podo-geplant.js?v=20260918';
import { istVergeben, ladePodoTermine, bindeTermin } from './verordnung-termine.js?v=20260908';
import { zeigeSitzungenArbeit } from './termin-panel.js?v=20260918';
import { zeigeSitzungsSeiten, verdrahteSitzungsUmschalter } from './sitzungen-ansicht.js?v=20260919';

/** Klartext der Befundpositionen — dieselben Namen wie im Sitzungsplan. */
const BEFUND_NAME = Object.freeze({
  '78040': 'Eingangsbefundung',
  '78030': 'Befundung',
  '78100': 'Erstbefundung (groß)',
  '78110': 'Erstbefundung (klein)',
});

/**
 * „Eingangsbefundung (78040) + Behandlung" — die Zeile, die der Anwender liest.
 * Ohne Befund nur „Behandlung".
 */
export function einheitBeschriftung(befund) {
  if (!befund) return 'Behandlung';
  return `${BEFUND_NAME[befund] || 'Befund'} (${befund}) + Behandlung`;
}

/**
 * Der Plan aller Einheiten einer Verordnung.
 *
 * Reine Rechnung. Die vergebenen Termine belegen die Einheiten in zeitlicher
 * Reihenfolge (1..k), die offenen sind k+1..n — dieselbe Zählweise wie
 * `terminZaehler()`. Abgesagte Termine zählen nicht (`istVergeben`).
 *
 * Die Befundposition je Einheit kommt aus `sitzungsplan()` für die GANZE Serie
 * (1..n), nicht für die Restmenge: ist Einheit 1 gebucht, aber noch nicht
 * dokumentiert, steht sie weiter als Eingangsbefundung da — und die offenen
 * 2..n tragen richtig die Befundung. Würde man nur die Restmenge planen, bekäme
 * Einheit 2 ein zweites 78040.
 *
 * @param {object} opt
 * @param {?string} opt.diagnosegruppe
 * @param {*}       opt.anzahl            `prescriptions.anzahl_einheiten`
 * @param {Array}   [opt.termine]         Termine dieser Verordnung (`bookings`)
 * @param {Array}   [opt.behandlungen]    `podologie_behandlungen` des Patienten
 * @param {string}  opt.datum             `YYYY-MM-DD`, heute
 * @param {?boolean} [opt.podologieVor2023]
 * @returns {{anwendbar:boolean, einheiten:Array<{nr:number, termin:?object,
 *           befund:?string}>, offen:?number, hinweis:string, rueckfrage:?string}}
 *   `offen` ist `null`, wenn die Einheitenzahl nicht erfasst ist — dann gibt es
 *   keine Restmenge, die man behaupten kann (`terminZaehler()`, Regel 1).
 */
export function einheitenPlan({
  diagnosegruppe, anzahl, termine = [], behandlungen = [], datum, podologieVor2023 = null,
} = {}) {
  const n = Number.parseInt(anzahl, 10);
  const gebucht = (termine || [])
    .filter(istVergeben)
    .slice()
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));

  if (!Number.isFinite(n) || n < 1) {
    return { anwendbar: false, einheiten: [], offen: null, hinweis: '', rueckfrage: null };
  }

  const plan = sitzungsplan({ diagnosegruppe, anzahl: n, behandlungen, datum, podologieVor2023 });
  const befundVon = (nr) => plan.zeilen.find(z => nr >= z.von && nr <= z.bis)?.codes?.[0] || null;

  // Mehr Termine als verordnete Einheiten kommen vor (Nachtrag, Fehlzuordnung) —
  // sie bleiben sichtbar, statt zu verschwinden.
  const anzahlZeilen = Math.max(n, gebucht.length);
  const einheiten = [];
  for (let nr = 1; nr <= anzahlZeilen; nr++) {
    einheiten.push({ nr, termin: gebucht[nr - 1] || null, befund: befundVon(nr) });
  }

  return {
    anwendbar: true,
    einheiten,
    offen: Math.max(0, n - gebucht.length),
    hinweis: plan.hinweis || '',
    rueckfrage: plan.rueckfrage || null,
  };
}

/**
 * Die Leistung, die eine Befundposition abbildet — aus dem Leistungskatalog der
 * Praxis. `null`, wenn sie dort nicht eingerichtet ist (dann fehlt die Zeile im
 * Termin, und der Aufrufer sagt es, statt still zu schweigen).
 *
 * @param {Array} dienste  `services` der Praxis
 * @param {?string} code   `'78040'` …
 * @returns {?string}      `services.id`
 */
export function befundDienstId(dienste, code) {
  if (!code) return null;
  return (dienste || []).find(d => d && positionVon(d) === code)?.id || null;
}

/**
 * Was beim Ziehen einer offenen Einheit auf den Kalender mitgeht.
 *
 * Bewusst dasselbe Format wie die Physio-Karten (`application/rx-session`,
 * `sessions[]`): beide Abwurfstellen des Kalenders (Monat/Tag und Tagesraster)
 * lesen es und rufen `handleRxSessionDropToModal()` — es entsteht kein dritter
 * Abwurfweg. `sessionId` bleibt `null`: es gibt keine Zeile, die gebunden werden
 * könnte; gebunden wird über `podoVordId` (`bindePodoAnTermin`).
 *
 * @returns {object}
 */
export function ziehNutzlast({ vord, einheit, patientName, leadId }) {
  const heilmittel = vord.heilmittel_feld_text || vord.heilmittel || '';
  return {
    prescriptionId: vord.id,
    podoVordId: vord.id,
    patientName: patientName || '',
    leadId: leadId || '',
    serviceId: '',
    befund: einheit.befund || null,
    bannerText: `Einheit #${einheit.nr}: ${einheitBeschriftung(einheit.befund)}`,
    sessions: [{ sessionId: null, sessionNum: einheit.nr, heilmittelIdx: 0, heilmittelName: heilmittel }],
    sessionId: null,
    sessionNum: einheit.nr,
    heilmittelIdx: 0,
    heilmittelName: heilmittel,
  };
}

/**
 * Nach dem Anlegen des Termins: ihn der Verordnung zuordnen.
 *
 * Aufgerufen vom Speichern der Terminmaske, wenn `_pendingRxSession` eine
 * `podoVordId` trägt. Schreibt über `bindeTermin()` — nicht per Insert-Payload
 * (siehe Kopf).
 *
 * Das Ergebnis hat dieselbe Form wie `bindeSitzungenAnTermin()`
 * (`module/sitzung-bindung.js`): das Speichern der Terminmaske entscheidet mit
 * `bindung.ok` zwischen „gespeichert" und der Fehlermeldung. „Termin gespeichert"
 * ohne Zuordnung wäre genau die Stille, die bei den Physio-Sitzungen vier Wochen
 * lang unbemerkt blieb.
 *
 * @param {object} sb
 * @param {string} bookingId
 * @param {{podoVordId?:string}} pend   `window._pendingRxSession`
 * @param {{emit?:Function}} [hilfen]
 * @returns {Promise<{ok:boolean, gebunden:number, erwartet:number, fehlend:string[], meldung:string}>}
 */
export async function bindePodoAnTermin(sb, bookingId, pend, { emit } = {}) {
  if (!pend?.podoVordId || !bookingId) {
    return { ok: true, gebunden: 0, erwartet: 0, fehlend: [], meldung: '' };
  }
  const r = await bindeTermin(sb, { bookingId, vordId: pend.podoVordId });
  if (!r.ok) {
    return {
      ok: false, gebunden: 0, erwartet: 1, fehlend: [bookingId],
      meldung: `Der Termin wurde angelegt, aber der Verordnung nicht zugeordnet: ${r.fehler} `
             + 'Bitte unter „Verordnungen" von Hand zuordnen.',
    };
  }
  emit?.('verordnungen:changed');
  return { ok: true, gebunden: 1, erwartet: 1, fehlend: [], meldung: '' };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Anzeige
   ═══════════════════════════════════════════════════════════════════════════ */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });   // YYYY-MM-DD
const datumKurz = (iso) => (iso
  ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  : '—');

/**
 * Die laufende podologische Verordnung des Patienten — oder die gewünschte.
 * „Laufend" wie in `oeffnePodoBehandlungen()` (dashboard.js): aktiv (NULL) oder
 * abrechenbar (`bereit`); `.or()`, weil `.in()` NULL nicht trifft.
 */
async function ladeVerordnung(sb, { ownerId, leadId, vordId }) {
  const spalten = 'id, heilmittel, heilmittel_feld_text, heilmittel_position, diagnosegruppe, '
                + 'anzahl_einheiten, ausstellungsdatum, patient_id, therapie_bereich';
  if (vordId) {
    const { data } = await sb.from('prescriptions').select(spalten)
      .eq('id', vordId).eq('owner_id', ownerId).eq('therapie_bereich', 'podo').maybeSingle();
    return data || null;
  }
  if (!leadId) return null;
  const { data } = await sb.from('prescriptions').select(spalten)
    .eq('owner_id', ownerId).eq('patient_id', leadId).eq('therapie_bereich', 'podo')
    .or('abrechnung_status.is.null,abrechnung_status.eq.bereit')
    .not('status', 'in', '("cancelled")')
    .order('ausstellungsdatum', { ascending: false, nullsFirst: false })
    .limit(1);
  return data?.[0] || null;
}

/** Alle dokumentierten Behandlungen des Patienten über ALLE seine Verordnungen. */
async function ladeBehandlungen(sb, { ownerId, leadId }) {
  if (!leadId) return [];
  const { data: vords } = await sb.from('prescriptions').select('id')
    .eq('owner_id', ownerId).eq('patient_id', leadId).eq('therapie_bereich', 'podo');
  if (!vords?.length) return [];
  const { data } = await sb.from('podologie_behandlungen')
    .select('behandlungsdatum, hpnr_codes')
    // Stornierte Behandlungen verbrauchen keine Einheit (Migration 0026).
    .is('storniert_am', null)
    .eq('owner_id', ownerId).in('verordnung_id', vords.map(v => v.id));
  return data || [];
}

async function ladeAltbestand(sb, { ownerId, leadId }) {
  if (!leadId) return null;
  const { data } = await sb.from('leads').select('podologie_altbestand_vor_2023')
    .eq('id', leadId).eq('owner_id', ownerId).maybeSingle();
  return data?.podologie_altbestand_vor_2023 ?? null;
}

/**
 * Den Einheitenblock im Terminbereich für eine podologische Verordnung zeichnen.
 *
 * Füllt dieselben Elemente wie die Physio-Fassung (`#bkRxUnvergebeneList`,
 * `#bkRxTermineList`, Umschalter) — der Block sieht für beide gleich aus, nur die
 * Zeilen kommen von woanders.
 *
 * @param {object} opt
 * @param {object} opt.sb
 * @param {string} opt.ownerId
 * @param {{lead_id?:string, customer_name?:string}} opt.booking  darf ein
 *        Ersatzkontext ohne `id` sein (Patient ohne Termin)
 * @param {?string} [opt.vordId]           gewünschte Verordnung (Blätterpfeile)
 * @param {Function} [opt.aufBehandlungen] Sprung in die Behandlungsdokumentation
 * @returns {Promise<boolean>}  `false` = keine podologische Verordnung — der
 *          Aufrufer zeigt seinen Leerzustand
 */
export async function zeichnePodoEinheiten({ sb, ownerId, booking, vordId = null, aufBehandlungen } = {}) {
  const panel    = document.getElementById('bkRxSessionsPanel');
  const unvList  = document.getElementById('bkRxUnvergebeneList');
  const termList = document.getElementById('bkRxTermineList');
  if (!panel || !unvList || !termList || !sb || !ownerId) return false;

  const leadId = booking?.lead_id || null;
  const vord = await ladeVerordnung(sb, { ownerId, leadId, vordId });
  if (!vord) return false;

  const patientId = vord.patient_id || leadId;
  const [{ vergeben }, behandlungen, altbestand] = await Promise.all([
    ladePodoTermine(sb, { ownerId, vordId: vord.id, leadId: null }),
    ladeBehandlungen(sb, { ownerId, leadId: patientId }),
    ladeAltbestand(sb, { ownerId, leadId: patientId }),
  ]);

  const plan = einheitenPlan({
    diagnosegruppe: vord.diagnosegruppe,
    anzahl: vord.anzahl_einheiten,
    termine: vergeben,
    behandlungen,
    datum: heute(),
    podologieVor2023: altbestand,
  });

  zeigeSitzungenArbeit();

  const badge = document.getElementById('bkRxSessionsBadge');
  const offene = plan.einheiten.filter(e => !e.termin);
  const belegte = plan.einheiten.filter(e => e.termin);

  if (badge) {
    badge.textContent = plan.offen === null
      ? `${belegte.length} vergeben`
      : `${plan.offen} offen / ${plan.einheiten.length} ges.`;
  }

  // Keine Serienplanung: sie verteilt `prescription_sessions`-Zeilen, die es hier
  // nicht gibt.
  const serieBtn = document.getElementById('bkRxSerieBtn');
  if (serieBtn) { serieBtn.hidden = true; serieBtn.onclick = null; }

  const patientName = booking?.customer_name || '';
  const stil = 'display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg-card-solid);'
             + 'border:1px solid var(--border);border-radius:8px;font-size:12px;';

  if (plan.offen === null) {
    // `anzahl_einheiten` fehlt: keine Restmenge behaupten (terminZaehler, Regel 1).
    unvList.innerHTML = '<span style="font-size:12px;color:var(--text-muted);font-style:italic;">'
      + 'Einheitenzahl der Verordnung nicht erfasst — es lässt sich nichts vorplanen.</span>';
  } else if (!offene.length) {
    unvList.innerHTML = '<span style="font-size:12px;color:var(--text-muted);font-style:italic;">Alle vergeben ✓</span>';
  } else {
    unvList.innerHTML = offene.map(e => `
      <div class="rx-unv-item" draggable="true" data-podo-nr="${e.nr}"
        style="${stil}cursor:grab;user-select:none;"
        title="Auf den Kalender ziehen, um einen Termin zu erstellen — mit der Befundung, die an dieser Einheit fällig ist.">
        <span style="color:var(--text-muted);font-size:11px;min-width:16px;">#${e.nr}</span>
        <span style="color:var(--text-main);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${esc(einheitBeschriftung(e.befund))}</span>
        <span style="font-size:16px;opacity:0.4;flex-shrink:0;">⠿</span>
      </div>`).join('')
      + (plan.hinweis ? `<div style="font-size:10px;color:var(--text-muted);line-height:1.45;margin-top:4px;">${esc(plan.hinweis)}</div>` : '')
      + (plan.rueckfrage ? `<div style="font-size:10px;color:var(--warning,#f59e0b);line-height:1.45;margin-top:4px;">${esc(plan.rueckfrage)} — in der Verordnung beantworten.</div>` : '');

    unvList.querySelectorAll('.rx-unv-item').forEach(el => {
      const einheit = offene.find(e => String(e.nr) === el.dataset.podoNr);
      el.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.effectAllowed = 'copy';
        ev.dataTransfer.setData('application/rx-session', JSON.stringify(
          ziehNutzlast({ vord, einheit, patientName, leadId: patientId })));
        el.style.opacity = '0.4';
      });
      el.addEventListener('dragend', () => { el.style.opacity = '1'; });
    });
  }

  termList.innerHTML = belegte.length
    ? belegte.map(e => `<div style="${stil}">
        <span style="color:var(--text-muted);font-size:11px;min-width:16px;">#${e.nr}</span>
        <span style="color:var(--text-main);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(einheitBeschriftung(e.befund))}</span>
        <span style="color:var(--text-muted);flex-shrink:0;">${esc(datumKurz(e.termin.start_time))}</span>
      </div>`).join('')
    : '<span style="font-size:12px;color:var(--text-muted);font-style:italic;">Keine</span>';

  verdrahteSitzungsUmschalter();
  zeigeSitzungsSeiten({ offen: offene.length, vergeben: belegte.length });

  const leistBtn = document.getElementById('bkRxLeistungenBtn');
  if (leistBtn) {
    leistBtn.hidden = !patientId || typeof aufBehandlungen !== 'function';
    leistBtn.onclick = aufBehandlungen ? () => aufBehandlungen(patientId) : null;
  }

  panel.hidden = false;
  return true;
}
