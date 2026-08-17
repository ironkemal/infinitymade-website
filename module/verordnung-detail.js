/**
 * verordnung-detail.js — eine gespeicherte Verordnung wieder aufschlagen.
 *
 * Befund (Kemal, 17.08.2026):
 *   „Eine angelegte Verordnung können wir nicht mehr aufmachen. Wenn man
 *   draufklickt, sollte sie zeigen, was wir vorher eingetragen haben."
 *
 * Vorher gab es genau eine Stelle, die eine Verordnung anzeigte:
 * `openPatRxDetail()` in `dashboard.js`, erreichbar nur über die
 * Qikbee-Tabelle unter „Patienten" — und dort standen zehn Felder. Alles, was
 * die Muster-13-Maske sonst noch speichert (Diagnosegruppe, Leitsymptomatik,
 * Einheiten, Frequenz, LANR/BSNR, Zuzahlung, Therapiebericht, Hinweise), war
 * nach dem Speichern nicht mehr einsehbar. Wer nachsehen wollte, was auf dem
 * Rezept stand, musste das Papier suchen.
 *
 * Diese Datei ist der EINE Weg, eine Verordnung aus dem Topf `prescriptions`
 * anzuzeigen. `openPatRxDetail()` ruft sie ebenfalls auf; die frühere zweite
 * Feldliste ist entfallen, damit ein neu aufgenommenes Feld nicht an einer der
 * beiden Stellen fehlt.
 *
 * Nur lesen, nicht ändern
 * ───────────────────────
 * Bewusst gibt es hier kein Formular. Ein Teil der Felder ist nach der
 * Abrechnung eingefroren (`belegnummer`, Anlage 1 TP5 V21 Kap. 7.3), und die
 * Sitzungszeilen hängen an `anzahl_einheiten` (siehe
 * `module/sitzung-abgleich.js`). Ein Bearbeiten-Pfad muss beides mitdenken und
 * ist deshalb ein eigenes Stück Arbeit — nicht ein Nebeneffekt der Ansicht.
 *
 * Der zweite Verordnungstopf (`verordnungen`, Podologie) hat mit dem
 * „Bearbeiten"-Knopf der Podologie-Abrechnung bereits eine Ansicht und wird
 * hier NICHT mitbedient. Die beiden Töpfe bestehen bewusst nebeneinander.
 */

import { belegnummerText } from './belegnummer.js?v=20260817';

/** Alles, was die Muster-13-Maske schreibt — plus Patient, Arzt und Nummer. */
const SELECT_DETAIL = `
  *,
  leads!patient_id ( id, first_name, last_name, title, geburtsdatum,
                     versichertennummer, versichertenstatus, krankenkasse,
                     patientennummer ),
  aerzte!arzt_id ( arzt_name, lanr, bsnr, fachrichtung ),
  prescription_sessions ( id, status )
`;

const STATUS_LABEL = {
  parsed: 'Erfasst', confirmed: 'Bestätigt', in_therapy: 'In Therapie',
  active: 'Aktiv', completed: 'Abgeschlossen', billed: 'Abgerechnet',
  rejected: 'Abgelehnt', cancelled: 'Storniert'
};

const BERICHT_LABEL = {
  offen: 'offen', erstellt: 'erstellt', versendet: 'versendet'
};

function _datum(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function _euro(v) {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toFixed(2).replace('.', ',') + ' €';
}

function _jaNein(v) {
  if (v === true) return 'ja';
  if (v === false) return 'nein';
  return '—';
}

/**
 * Ein Feld im Raster. Leere Werte werden zu `—`, damit die Lücke sichtbar ist:
 * bei einer Kassenverordnung ist ein fehlendes Pflichtfeld eine Information,
 * kein Grund, die Zeile wegzulassen.
 */
function _feld(label, wert, esc, opt = {}) {
  const leer = wert === null || wert === undefined || wert === '' || wert === '—';
  const text = leer ? '—' : String(wert);
  const mono = opt.mono ? 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;' : '';
  const farbe = leer ? 'var(--text-muted)' : 'var(--text-main)';
  return `<div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">${esc(label)}</div>
    <div style="color:${farbe};${mono}${opt.fett ? 'font-weight:600;' : ''}">${esc(text)}</div>
  </div>`;
}

function _block(titel, felder, esc) {
  const inhalt = felder.filter(Boolean).join('');
  if (!inhalt) return '';
  return `<div style="margin-top:14px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;">${esc(titel)}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;">${inhalt}</div>
  </div>`;
}

/**
 * Die Merkmale, die ein Rezept ausmachen (dringlich, Hausbesuch, Blanko …),
 * als Reihe kleiner Rosetten. Nur gesetzte Merkmale werden gezeigt — eine Liste
 * aus acht „nein" liest niemand.
 */
function _merkmale(rx, esc) {
  const an = [];
  if (rx.is_dringend) an.push(['Dringlicher Behandlungsbedarf', '#ef4444']);
  if (rx.hausbesuch) an.push(['Hausbesuch', '#38bdf8']);
  if (rx.is_blanko) an.push(['Blankoverordnung', '#a855f7']);
  if (rx.is_lhb_bvb) an.push(['LHB/BVB', '#a855f7']);
  if (rx.zuzahlung_befreit) an.push(['Zuzahlungsbefreit', '#22c55e']);
  if (rx.bericht_angefordert) an.push(['Therapiebericht angefordert', '#f59e0b']);
  if (rx.unterschrift_vorhanden === false) an.push(['Unterschrift fehlt', '#ef4444']);
  if (rx.proceed_anyway) an.push(['Trotz Lücken gespeichert', '#f59e0b']);
  if (!an.length) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;">` + an.map(([txt, farbe]) =>
    `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;border:1px solid ${farbe};color:${farbe};">${esc(txt)}</span>`
  ).join('') + '</div>';
}

/**
 * Die vollständige Ansicht einer Verordnung als HTML.
 *
 * @param {object} rx   Zeile aus `prescriptions` inkl. der Joins aus SELECT_DETAIL.
 * @param {object} opt
 * @param {(s:string)=>string} opt.escapeHtml  Pflicht.
 * @param {string} [opt.leadId]  Ist er gesetzt, erscheint „Patient öffnen →".
 * @returns {string}
 */
export function verordnungDetailHtml(rx, opt = {}) {
  const esc = opt.escapeHtml || (s => String(s));
  const p = rx.leads || {};
  const arzt = rx.aerzte || {};
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';

  const nummer = belegnummerText(rx, { patientennummer: p.patientennummer });
  const nummerHerkunft = rx.belegnummer
    ? 'eingefroren bei der Abrechnung'
    : 'vorläufig — wird bei der Abrechnung festgeschrieben';

  const sitzungen = Array.isArray(rx.prescription_sessions) ? rx.prescription_sessions : [];
  // CHECK status IN (planned, done, cancelled, no_show) — nur `done` zählt.
  const erledigt = sitzungen.filter(s => s.status === 'done').length;
  const sitzungText = sitzungen.length
    ? `${erledigt} von ${sitzungen.length} erledigt`
    : '—';

  const icd = [rx.icd10, rx.icd10_2].filter(Boolean).join(' · ');
  const leit = [rx.leitsymptomatik, rx.pat_leitsymptomatik].filter(Boolean).join(' · ');
  const heilmittel = [rx.heilmittel, rx.heilmittel_position ? `(${rx.heilmittel_position})` : '']
    .filter(Boolean).join(' ');
  const ergaenzend = rx.ergaenzendes_heilmittel
    ? `${rx.ergaenzendes_heilmittel}${rx.ergaenzend_einheiten ? ` · ${rx.ergaenzend_einheiten} EH` : ''}`
    : '';

  return `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span style="font-size:15px;font-weight:700;color:var(--text-main);">${esc(name)}</span>
      ${nummer ? `<span title="${esc(nummerHerkunft)}" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:700;padding:2px 9px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);">${esc(nummer)}</span>` : ''}
      <span style="font-size:12px;color:var(--text-muted);">${esc(STATUS_LABEL[rx.status] || rx.status || '—')}</span>
    </div>
    ${_merkmale(rx, esc)}

    ${_block('Verordnung', [
      _feld('Belegnummer', nummer, esc, { mono: true }),
      _feld('Ausstellungsdatum', _datum(rx.ausstellungsdatum), esc),
      _feld('Gültig bis (Behandlungsbeginn)', _datum(rx.gueltig_bis), esc),
      _feld('Behandlungsbeginn', _datum(rx.behandlungsbeginn), esc),
      _feld('Rezept-Typ', rx.rezept_typ, esc),
      _feld('Therapiebereich', rx.therapie_bereich, esc)
    ], esc)}

    ${_block('Diagnose', [
      _feld('ICD-10', icd, esc, { mono: true }),
      _feld('Diagnosegruppe', rx.diagnosegruppe, esc, { mono: true }),
      _feld('Leitsymptomatik', leit, esc),
      _feld('Diagnose (Freitext)', rx.diagnose_freitext, esc)
    ], esc)}

    ${_block('Heilmittel', [
      _feld('Heilmittel', heilmittel, esc, { fett: true }),
      _feld('Behandlungseinheiten', rx.anzahl_einheiten, esc),
      _feld('Ergänzendes Heilmittel', ergaenzend, esc),
      _feld('Frequenz', rx.frequenz, esc),
      _feld('Sitzungen', sitzungText, esc)
    ], esc)}

    ${_block('Arzt', [
      _feld('Name', arzt.arzt_name, esc),
      _feld('Fachrichtung', arzt.fachrichtung, esc),
      _feld('LANR', rx.doctor_lanr || arzt.lanr, esc, { mono: true }),
      _feld('BSNR', rx.doctor_bsnr || arzt.bsnr, esc, { mono: true }),
      _feld('Unterschrift vorhanden', _jaNein(rx.unterschrift_vorhanden), esc)
    ], esc)}

    ${_block('Kostenträger und Zuzahlung', [
      _feld('Krankenkasse', p.krankenkasse, esc),
      _feld('IK des Kostenträgers', rx.kostentraeger_ik, esc, { mono: true }),
      _feld('Versichertennummer', p.versichertennummer, esc, { mono: true }),
      _feld('Versichertenstatus', p.versichertenstatus, esc, { mono: true }),
      _feld('Geburtsdatum', _datum(p.geburtsdatum), esc),
      _feld('Zuzahlung', rx.zuzahlung_befreit ? 'befreit' : _euro(rx.zuzahlung_eur), esc),
      _feld('Zuzahlung kassiert am', _datum(rx.zuzahlung_kassiert_am), esc)
    ], esc)}

    ${_block('Therapiebericht', [
      _feld('Angefordert', _jaNein(rx.bericht_angefordert), esc),
      _feld('Status', BERICHT_LABEL[rx.bericht_status] || rx.bericht_status, esc)
    ], esc)}

    ${rx.hinweise ? `<div style="margin-top:14px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;">Hinweise</div>
      <div style="color:var(--text-main);white-space:pre-wrap;">${esc(rx.hinweise)}</div>
    </div>` : ''}

    ${_block('Erfassung', [
      _feld('Quelle', rx.quelle, esc),
      _feld('Angelegt am', _datum(rx.created_at), esc),
      _feld('Abrechnungsstatus', rx.abrechnung_status, esc)
    ], esc)}

    ${opt.leadId ? `<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn-primary btn-sm" onclick="switchPanel('kunden');openPatientDetail('${esc(opt.leadId)}')">Patient öffnen →</button>
    </div>` : ''}
  `;
}

/**
 * Verordnung laden und in einen bestehenden Bereich zeichnen.
 *
 * Der Bereich wird nicht von diesem Modul erzeugt — beide Aufrufer haben schon
 * einen (die Qikbee-Tabelle unter „Patienten" und die Verordnungsliste).
 *
 * @param {object} ctx
 * @param {object} ctx.supabase
 * @param {string} ctx.rxId
 * @param {HTMLElement|null} [ctx.panel]    Wird sichtbar gemacht und gescrollt.
 * @param {HTMLElement|null} [ctx.titel]    textContent = Patientenname.
 * @param {HTMLElement} ctx.inhalt          Ziel für das HTML.
 * @param {(s:string)=>string} ctx.escapeHtml
 * @returns {Promise<object|null>} die geladene Zeile (oder null bei Fehler)
 */
export async function zeigeVerordnungDetail(ctx) {
  const { supabase, rxId, panel, titel, inhalt, escapeHtml } = ctx;
  if (!inhalt || !rxId) return null;

  if (panel) panel.hidden = false;
  inhalt.innerHTML = '<span style="color:var(--text-muted);">Lade…</span>';

  const { data: rx, error } = await supabase
    .from('prescriptions')
    .select(SELECT_DETAIL)
    .eq('id', rxId)
    .maybeSingle();

  if (error || !rx) {
    console.error('[zeigeVerordnungDetail]', error);
    inhalt.innerHTML = '<span style="color:var(--danger,#ef4444);">Verordnung konnte nicht geladen werden.</span>';
    if (titel) titel.textContent = '—';
    return null;
  }

  const p = rx.leads || {};
  if (titel) titel.textContent = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';
  inhalt.innerHTML = verordnungDetailHtml(rx, { escapeHtml, leadId: p.id || ctx.leadId || '' });
  if (panel && typeof panel.scrollIntoView === 'function') {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  return rx;
}
