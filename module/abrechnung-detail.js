/**
 * abrechnung-detail.js — die UNTERE Hälfte der Ansicht „Bisherige Abrechnungen":
 * welche Patienten stecken in DIESER Datei, was ist daraus geworden, was ist
 * damit noch zu tun.
 *
 * Diese Hälfte gab es noch nie
 * ─────────────────────────────
 * Bis zum 09.09.2026 zeigte der §302-Bildschirm zu einer Datei nur
 * `prescription_count` — eine Zahl, keine Liste. „Zeigen Sie mir die 4. Sitzung
 * zu Beleg X" (Kassenprüfung) war damit nicht beantwortbar. Aus
 * `prescriptions.abrechnung_id` liesse sich eine Liste ableiten, aber sie wäre
 * ab Tag eins falsch: wird ein abgesetztes Rezept korrigiert und neu
 * eingereicht, wandert die id mit und die Zeile verschwindet rückwirkend aus
 * der alten Datei. Deshalb liest diese Ansicht `abrechnung_zeile` über
 * `GET /abrechnung/:id/zeilen` — den eingefrorenen Stand.
 *
 * Gruppiert nach Gesamtrechnung, nicht nach Datei
 * ───────────────────────────────────────────────
 * Seit dem 07.09.2026 enthält EINE Datei mehrere Gesamtrechnungen (je Karten-IK
 * eine, `dta/builder.js`). Das Geld kommt je Gesamtrechnung, und je
 * Gesamtrechnung wird ein eigener Begleitzettel gedruckt (Anlage 4 V2.0,
 * Allgemeines (2)). Wer hier nur nach Datei gruppiert, kann eine Teilzahlung
 * nicht zuordnen.
 *
 * Vier Zahlen, immer
 * ──────────────────
 * `Eingereicht · Abgesetzt · Bezahlt · Offen`. Die Absetzung wird vom Soll
 * NICHT abgezogen, sondern danebengestellt — sonst verschwindet genau das Geld
 * aus dem Bildschirm, das mit einer Korrekturrechnung (VKZ 04) zurückzuholen
 * wäre (gkv-302 zum Plan, Abschnitt 3).
 *
 * `downloadAbrechnungFile()` ist mitgezogen, nicht neu geschrieben — damit
 * bekommt die Podologie ihren Datei-Download zum ersten Mal. Sie lief bis
 * heute über einen eigenen Bildschirm, auf dem es keinen gab.
 */

import { fmtEur } from './geld.js?v=20260909';
import { dateiStatusBadge, aggregierterDateiStatus, dateiStatusInfo } from './abrechnung-status.js?v=20260909';
import { ladeDateieinheiten, dateieinheitVon } from './podologie-dateieinheit.js?v=20260907';
import { on } from './signal.js?v=20260813';

let ctx = null;
let _hoertZu = false;
let _offeneId = null;

/**
 * @param {object} deps supabase · apiBase · escapeHtml · showToast ·
 *   aktionen {signieren, zaaHochladen, zaaFehler, anleitung}
 */
export function initAbrechnungDetail(deps) {
  ctx = deps;
  if (_hoertZu) return;
  _hoertZu = true;
  // Gekoppelt über signal.js — dieselbe Bauart wie Verordnungsliste/-detail.
  on('abrechnung:gewaehlt', ({ id } = {}) => {
    if (id) zeigeAbrechnungDetail(id);
    else leere();
  });
}

/** Welche Datei steht gerade unten? */
export function offeneAbrechnung() { return _offeneId; }

// ─── Reine Teile (ohne DOM — hier liegen die Tests) ─────────────────────────

/**
 * Der Zeitraum einer Datei aus den Verordnungsdaten ihrer Zeilen.
 * Leere/fehlende Daten werden ausgelassen, nicht durch „heute" ersetzt.
 * @returns {{von:string|null, bis:string|null}}
 */
export function zeitraumAusZeilen(zeilen) {
  const daten = (zeilen || []).map(z => z.verordnungsdatum).filter(Boolean).sort();
  return { von: daten[0] || null, bis: daten[daten.length - 1] || null };
}

/**
 * Wann ist das Geld fällig? 4 Wochen ab Einreichung, sofern der Vertrag nichts
 * anderes sagt (Richtlinien-Text 20.11.2006 § 7 Abs. 2).
 * `null`, solange die Datei nicht eingereicht ist — eine Frist auf eine Datei
 * zu setzen, die noch im Haus liegt, wäre eine erfundene Mahnung.
 */
export function faelligkeit(abrechnung, heute = new Date()) {
  if (!abrechnung?.zaa_uploaded_at) return null;
  const faellig = new Date(new Date(abrechnung.zaa_uploaded_at).getTime() + 28 * 864e5);
  return {
    am: faellig.toISOString().slice(0, 10),
    tageRest: Math.ceil((faellig.getTime() - heute.getTime()) / 864e5),
    ueberfaellig: faellig.getTime() < heute.getTime(),
  };
}

const ZEILEN_STATUS = {
  eingereicht:    { text: 'eingereicht',   farbe: 'var(--text-muted)' },
  akzeptiert:     { text: 'angenommen',    farbe: '#16a34a' },
  abgesetzt:      { text: 'abgesetzt',     farbe: '#be185d' },
  teilabgesetzt:  { text: 'teilabgesetzt', farbe: '#ea580c' },
  nachgereicht:   { text: 'nachgereicht',  farbe: '#2563eb' },
};

/** @param {string} key */
export function zeilenStatusInfo(key) {
  return ZEILEN_STATUS[key] || { text: key || '—', farbe: 'var(--text-muted)' };
}

// ─── Laden und Zeichnen ─────────────────────────────────────────────────────

const esc = (s) => (ctx?.escapeHtml ? ctx.escapeHtml(s) : String(s));

export function leere() {
  _offeneId = null;
  const titel = document.getElementById('abDetailTitel');
  const inhalt = document.getElementById('abDetailContent');
  if (titel) titel.textContent = 'Abrechnung';
  if (inhalt) inhalt.innerHTML = '<span style="color:var(--text-muted);">Wählen Sie oben eine Abrechnung aus.</span>';
}

export async function zeigeAbrechnungDetail(abrechnungId) {
  const inhalt = document.getElementById('abDetailContent');
  const titel = document.getElementById('abDetailTitel');
  if (!inhalt) return;
  _offeneId = abrechnungId;

  inhalt.style.opacity = '0.45';
  if (!inhalt.dataset.geladen) inhalt.innerHTML = '<span style="color:var(--text-muted);">Lädt…</span>';

  let json;
  try {
    const { data: { session } } = await ctx.supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Nicht angemeldet');
    const res = await fetch(`${ctx.apiBase}/billing/abrechnung/${abrechnungId}/zeilen`, {
      headers: { 'Authorization': 'Bearer ' + session.access_token },
    });
    json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  } catch (e) {
    console.error('[abrechnung-detail]', e);
    inhalt.style.opacity = '';
    inhalt.innerHTML = `<div style="color:#ef4444;font-size:13px;">Konnte nicht geladen werden: ${esc(e.message)}</div>`;
    return;
  }

  const ab = json.abrechnung || {};
  const gruppen = json.gruppen || [];
  const zeilen = json.zeilen || [];
  const geld = json.geld || {};

  if (titel) titel.textContent = ab.dateiname || ab.rechnungsnummer || 'Abrechnung';

  // Annahmestelle nachtragen, wenn bekannt — dieselbe Auflösung wie beim
  // Versand (module/podologie-dateieinheit.js), kein zweiter Nachbau.
  if (ab.kostentraeger_ik) ladeDateieinheiten([ab.kostentraeger_ik]).then(neu => {
    if (!neu || _offeneId !== abrechnungId) return;
    const slot = document.getElementById('abDetailAnnahmestelle');
    const info = dateieinheitVon(ab.kostentraeger_ik);
    if (slot && info?.aufloesbar) slot.textContent = `${info.davName || info.davIk}${info.kassenart ? ' · Kassenart ' + info.kassenart : ''}`;
  });

  inhalt.innerHTML = kopfHtml(ab, zeilen, geld) + geldHtml(geld, ab)
    + (gruppen.length ? gruppen.map(g => gruppeHtml(g, gruppen.length > 1)).join('') : leerHtml(ab))
    + korrekturHtml(zeilen)
    + aktionenHtml(ab);
  inhalt.style.opacity = '';
  inhalt.dataset.geladen = '1';

  _verdrahteAktionen(ab);
}

/** Wieviele Belege dieser Datei sind korrigierbar? */
export function korrigierbareZeilen(zeilen) {
  return (zeilen || []).filter(z =>
    (z.status === 'abgesetzt' || z.status === 'teilabgesetzt')
    // Ohne diese vier gibt es kein URI-Segment (Anlage 1 TP5 V21 Kap. 7.3).
    // Bei rekonstruierten Altzeilen fehlen sie systematisch.
    && z.prescription_id && z.belegnummer && z.einzel_rechnungsnummer);
}

function kopfHtml(ab, zeilen, geld) {
  const z = zeitraumAusZeilen(zeilen);
  const dat = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '—';
  const status = aggregierterDateiStatus(ab);
  const f = faelligkeit(ab);

  const felder = [
    ['Rechnungsnummer', `<code style="font-size:12px;">${esc(ab.rechnungsnummer || '—')}</code>`],
    ['Erstellt', dat(ab.created_at)],
    ['Eingereicht', ab.zaa_uploaded_at ? dat(ab.zaa_uploaded_at) : '<span style="color:var(--text-muted);">noch nicht</span>'],
    ['Annahmestelle', `<span id="abDetailAnnahmestelle">${esc(ab.kostentraeger_ik || '—')}</span>`],
    ['Zeitraum', z.von ? `${dat(z.von)} – ${dat(z.bis)}` : '—'],
    ['Belege', String(zeilen.length || ab.prescription_count || 0)],
  ];

  return `
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
    ${dateiStatusBadge(status)}
    ${f ? `<span style="font-size:12px;color:${f.ueberfaellig ? '#ea580c' : 'var(--text-muted)'};"
       title="4 Wochen ab Eingang der vollständigen Unterlagen (Richtlinien-Text 20.11.2006 § 7 Abs. 2)">
       ${f.ueberfaellig ? `überfällig seit ${Math.abs(f.tageRest)} Tag${Math.abs(f.tageRest) === 1 ? '' : 'en'}` : `fällig in ${f.tageRest} Tag${f.tageRest === 1 ? '' : 'en'}`}
     </span>` : ''}
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px 18px;margin-bottom:14px;">
    ${felder.map(([k, v]) => `<div>
      <div style="font-size:11px;color:var(--text-muted);">${esc(k)}</div>
      <div style="font-size:13px;color:var(--text-main);">${v}</div>
    </div>`).join('')}
  </div>`;
}

function geldHtml(geld, ab) {
  // Immer vierteilig, auch wenn drei davon 0 sind: „10 eingereicht, 1
  // abgesetzt, 9 bezahlt" muss als vier Zahlen ablesbar sein (Plan, Phase 4).
  const zahlen = [
    ['Eingereicht', geld.eingereicht, 'var(--text-main)'],
    ['Abgesetzt',   geld.abgesetzt,   Number(geld.abgesetzt) > 0 ? '#be185d' : 'var(--text-muted)'],
    ['Bezahlt',     geld.bezahlt,     Number(geld.bezahlt)   > 0 ? '#16a34a' : 'var(--text-muted)'],
    ['Offen',       geld.offen,       Number(geld.offen) > 0.005 ? '#ea580c' : 'var(--text-muted)'],
  ];
  const rekonstruiert = Number(ab.total_eur) > 0 && !(Number(geld.eingereicht) > 0);
  return `
  <div style="display:flex;gap:20px;flex-wrap:wrap;padding:10px 14px;margin-bottom:14px;
       border:1px solid var(--border);border-radius:8px;background:var(--bg-card);">
    ${zahlen.map(([k, v, c]) => `<div>
      <div style="font-size:11px;color:var(--text-muted);">${esc(k)}</div>
      <div style="font-size:15px;font-weight:600;color:${c};">${esc(fmtEur(v))}</div>
    </div>`).join('')}
    ${rekonstruiert ? `<div style="font-size:11px;color:#b45309;align-self:center;max-width:280px;">
      Beträge aus dem Kopfsatz — für diese Altdatei gibt es keine eingefrorenen Zeilenbeträge.</div>` : ''}
  </div>`;
}

function gruppeHtml(g, zeigeNummer) {
  return `
  <div style="border:1px solid var(--border);border-radius:8px;margin-bottom:10px;overflow:hidden;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;
         padding:8px 12px;background:var(--bg-card);">
      <div style="font-size:12px;color:var(--text-main);font-weight:600;">
        ${zeigeNummer ? `Gesamtrechnung ${esc(g.einzel_rechnungsnummer)}` : 'Gesamtrechnung'}
        ${g.karten_ik ? `<span style="font-weight:400;color:var(--text-muted);"> · Karten-IK ${esc(g.karten_ik)}</span>` : ''}
        <span style="font-weight:400;color:var(--text-muted);"> · ${g.zeilen.length} Beleg${g.zeilen.length > 1 ? 'e' : ''}</span>
      </div>
      <div style="font-size:12px;color:var(--text-muted);">
        Brutto ${esc(fmtEur(g.brutto_eur))} · Zuzahlung ${esc(fmtEur(g.zuzahlung_eur))} ·
        <strong style="color:var(--text-main);">Kassenanteil ${esc(fmtEur(g.netto_eur))}</strong>
        ${g.absetzung_eur > 0 ? ` · <span style="color:#be185d;">Absetzung ${esc(fmtEur(g.absetzung_eur))}</span>` : ''}
      </div>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="color:var(--text-muted);text-align:left;">
            <th style="padding:4px 8px;font-weight:600;">Beleg</th>
            <th style="padding:4px 8px;font-weight:600;">Patient</th>
            <th style="padding:4px 8px;font-weight:600;">Verordnet</th>
            <th style="padding:4px 8px;font-weight:600;">Leistungen</th>
            <th style="padding:4px 8px;font-weight:600;text-align:right;">Kassenanteil</th>
            <th style="padding:4px 8px;font-weight:600;">Rückmeldung</th>
          </tr>
        </thead>
        <tbody>
          ${g.zeilen.map(zeileHtml).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function zeileHtml(z) {
  const st = zeilenStatusInfo(z.status);
  const dat = z.verordnungsdatum ? new Date(z.verordnungsdatum).toLocaleDateString('de-DE') : '—';
  // Die Sitzungen stehen als jsonb an der Zeile — genau das, was VKZ 04 auf
  // Positionsebene braucht („nicht zuvor vergütete Positionen").
  const leistungen = Array.isArray(z.leistungen) ? z.leistungen : [];
  const leistungText = leistungen.length
    ? leistungen.map(l => `${l.positionsnummer || '?'}${l.anzahl > 1 ? `×${l.anzahl}` : ''}`).join(', ')
    : (z.heilmittel_position || '—');
  const leistungTitel = leistungen.length
    ? leistungen.map(l => `${l.datum || '?'} · ${l.positionsnummer || '?'} · ${l.anzahl || 1}× · ${fmtEur(l.einzelbetrag)}`).join('\n')
    : '';

  return `<tr style="border-top:1px solid var(--border);">
    <td style="padding:4px 8px;color:var(--text-muted);white-space:nowrap;"><code>${esc(z.belegnummer || '—')}</code></td>
    <td style="padding:4px 8px;color:var(--text-main);">${esc(z.patient_name || '—')}
      ${z.herkunft === 'rekonstruiert' ? `<span title="Nicht der eingefrorene Einreichungsstand, sondern nachträglich aus der Verordnung rekonstruiert." style="font-size:10px;color:#b45309;border:1px solid #b45309;border-radius:3px;padding:0 4px;margin-left:4px;">rekonstruiert</span>` : ''}
    </td>
    <td style="padding:4px 8px;color:var(--text-muted);white-space:nowrap;">${dat}${z.anzahl_einheiten ? ` · ${z.anzahl_einheiten} Einh.` : ''}</td>
    <td style="padding:4px 8px;color:var(--text-muted);" title="${esc(leistungTitel)}">${esc(leistungText)}</td>
    <td style="padding:4px 8px;text-align:right;color:var(--text-main);white-space:nowrap;">${esc(fmtEur(z.netto_eur))}</td>
    <td style="padding:4px 8px;white-space:nowrap;">
      <span style="color:${st.farbe};font-weight:600;">${esc(st.text)}</span>
      ${Number(z.absetzung_eur) > 0 ? `<span style="color:#be185d;"> −${esc(fmtEur(z.absetzung_eur))}</span>` : ''}
      ${z.absetzung_grund ? `<div style="font-size:11px;color:var(--text-muted);white-space:normal;max-width:280px;">${esc(z.absetzung_grund.split('\n')[0])}</div>` : ''}
    </td>
  </tr>`;
}

/**
 * Der eigene, getrennte Lauf für abgesetzte Belege.
 *
 * ⛔ V3 (Anlage 1 TP5 V21 Kap. 7.3): „Innerhalb einer Datei dürfen nicht
 * verschiedene Verarbeitungskennzeichen genutzt werden. Je
 * Verarbeitungskennzeichen ist eine eigene Datei zu übermitteln."
 * Deshalb steht dieser Knopf hier — in der Ansicht „Bisherige", an der
 * abgesetzten Datei — und nicht in der Auswahlliste unter „Neu". Eine
 * Oberfläche, die beides in einem Lauf anbietet, erzeugt eine Datei, die die
 * Annahmestelle als Ganzes zurückweist.
 */
function korrekturHtml(zeilen) {
  const kandidaten = korrigierbareZeilen(zeilen);
  const abgesetztOhneUri = (zeilen || []).filter(z =>
    (z.status === 'abgesetzt' || z.status === 'teilabgesetzt') && !kandidaten.includes(z));
  if (!kandidaten.length && !abgesetztOhneUri.length) return '';

  return `
  <div style="border:1px solid #be185d;border-radius:8px;padding:14px;margin-top:14px;background:var(--bg-card);">
    <h4 style="margin:0 0 6px;font-size:14px;color:#be185d;">Abgesetzte Belege — Korrekturrechnung (VKZ 04)</h4>
    <p style="margin:0 0 10px;font-size:12px;color:var(--text-muted);">
      Ein abgesetzter Beleg geht mit <strong>VKZ 04 und URI-Segment</strong> in einer <strong>eigenen Datei</strong>
      zurück, nie still in die nächste Erstrechnung — sonst ist es für die Kasse derselbe Beleg zum zweiten Mal
      (Anlage 1 TP5 V21 Kap. 7.4.3, Korrekturverfahren Nr. 3). Korrigieren Sie zuerst die Verordnung, dann hier
      auswählen und erstellen.
    </p>
    ${kandidaten.length ? `
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
        ${kandidaten.map(z => `
          <label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text-main);cursor:pointer;">
            <input type="checkbox" class="ab-kor-check" data-id="${esc(z.id)}" checked style="margin-top:2px;">
            <span><code>${esc(z.belegnummer)}</code> · ${esc(z.patient_name || '—')} · ${esc(fmtEur(z.netto_eur))}
              ${z.absetzung_grund ? `<span style="color:var(--text-muted);"> — ${esc(z.absetzung_grund.split('\n')[0])}</span>` : ''}
            </span>
          </label>`).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="abKorGrund" placeholder="Was wurde korrigiert? (wird protokolliert)"
          style="flex:1;min-width:220px;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:12px;">
        <button class="btn-primary btn-sm" data-ab-akt="korrektur">Korrekturrechnung erstellen (VKZ 04)</button>
      </div>
      <div id="abKorFehler" style="color:#ef4444;font-size:12px;margin-top:8px;display:none;"></div>
    ` : ''}
    ${abgesetztOhneUri.length ? `
      <div style="margin-top:${kandidaten.length ? '12px' : '0'};padding:8px 10px;border:1px dashed var(--border);border-radius:6px;font-size:12px;color:var(--text-muted);">
        ${abgesetztOhneUri.length} abgesetzte${abgesetztOhneUri.length > 1 ? '' : 'r'} Beleg${abgesetztOhneUri.length > 1 ? 'e' : ''}
        ohne vollständige Ursprungsangaben — für sie lässt sich kein URI-Segment bauen. Das betrifft Dateien von vor
        dem 09.09.2026; diese Korrektur läuft über das Kassenportal oder auf Papier.
      </div>` : ''}
    <p style="margin:10px 0 0;font-size:11px;color:var(--text-muted);">
      <strong>Nicht hier</strong>, sondern als neue Erstrechnung (VKZ 01): wenn die ganze Rechnung wegen
      <em>fehlender Urbelege</em> abgesetzt wurde (Nr. 21) oder die <em>Datei abgewiesen</em> wurde, weil sie nicht
      TA-konform war (Nr. 22). In beiden Fällen gilt nichts als eingereicht und eine URI wäre falsch — die Verordnung
      wird über den Statusdialog bewusst wieder auf „bereit" gesetzt.
    </p>
  </div>`;
}

function leerHtml(ab) {
  return `<div style="padding:14px;border:1px dashed var(--border);border-radius:8px;color:var(--text-muted);font-size:13px;">
    Für diese Datei sind keine Zeilen gespeichert. Das betrifft Dateien, die vor dem 09.09.2026 entstanden sind —
    damals hielt nur der Kopfsatz fest, wie viele Belege drin waren (${ab.prescription_count || 0}).
  </div>`;
}

function aktionenHtml(ab) {
  const k = [];
  if (ab.storage_path)       k.push(`<button class="btn-ghost btn-sm" data-ab-akt="dta">DTA herunterladen</button>`);
  if (ab.begleitzettel_path) k.push(`<button class="btn-ghost btn-sm" data-ab-akt="begleit">Begleitzettel</button>`);
  if (ab.signed_storage_path) k.push(`<button class="btn-ghost btn-sm" data-ab-akt="p7m">Signierte Datei (.p7m)</button>`);
  else if (ab.storage_path)   k.push(`<button class="btn-primary btn-sm" data-ab-akt="signieren">✍ Signieren</button>`);
  k.push(`<button class="btn-ghost btn-sm" data-ab-akt="zaa">📨 ZAA hochladen</button>`);
  if (ab.status === 'rejected' || ab.status === 'accepted') {
    k.push(`<button class="btn-ghost btn-sm" data-ab-akt="fehler">🔍 ZAA-Fehler</button>`);
  }
  k.push(`<button class="btn-ghost btn-sm" data-ab-akt="anleitung">Anleitung</button>`);

  // ⚠️ „Korrigieren & erneut vorbereiten" fehlt hier absichtlich — siehe
  // Kopfkommentar von abrechnung-verlauf.js. Der richtige Weg (VKZ 04 + URI)
  // kommt mit Phase 5.
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
    ${k.join('')}
  </div>`;
}

function _verdrahteAktionen(ab) {
  const inhalt = document.getElementById('abDetailContent');
  if (!inhalt) return;
  for (const btn of inhalt.querySelectorAll('[data-ab-akt]')) {
    btn.addEventListener('click', () => {
      switch (btn.dataset.abAkt) {
        case 'dta':        return downloadAbrechnungFile(ab.storage_path, ab.id, 'dta');
        case 'p7m':        return downloadAbrechnungFile(ab.signed_storage_path, ab.id, 'dta');
        case 'begleit':    return downloadAbrechnungFile(ab.begleitzettel_path, null, 'begleit');
        case 'signieren':  return ctx.aktionen?.signieren?.(ab.id, ab.dateiname);
        case 'zaa':        return ctx.aktionen?.zaaHochladen?.(ab.id, ab.dateiname);
        case 'fehler':     return ctx.aktionen?.zaaFehler?.(ab.id);
        case 'anleitung':  return ctx.aktionen?.anleitung?.(ab.id);
        case 'korrektur':  return _erstelleKorrektur(btn, ab);
      }
    });
  }
}

/**
 * Eine eigene Datei mit VKZ 04 für die angehakten abgesetzten Belege.
 * Der Knopf wird VOR dem ersten `await` gesperrt — ein Doppelklick erzeugte
 * sonst zwei Korrekturdateien mit derselben laufenden Datennummer.
 */
async function _erstelleKorrektur(btn, ab) {
  if (btn.disabled) return;
  const fehlerEl = document.getElementById('abKorFehler');
  const zeigeFehler = (t) => { if (fehlerEl) { fehlerEl.textContent = t; fehlerEl.style.display = t ? 'block' : 'none'; } };
  zeigeFehler('');

  const zeilenIds = [...document.querySelectorAll('#abDetailContent .ab-kor-check:checked')]
    .map(cb => cb.dataset.id);
  if (!zeilenIds.length) { zeigeFehler('Bitte mindestens einen Beleg auswählen.'); return; }

  const grund = document.getElementById('abKorGrund')?.value.trim() || '';
  const altText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Wird erstellt…';
  try {
    const { data: { session } } = await ctx.supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Nicht angemeldet');
    const res = await fetch(`${ctx.apiBase}/billing/abrechnung/korrektur`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ zeilenIds, grund }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

    ctx.showToast?.(`Korrekturrechnung erstellt: ${json.sammelRechnungsnummer} · VKZ 04 ✓`);
    // Die neue Datei steht jetzt oben in der Liste; die alte zeigt ihre Zeilen
    // als „nachgereicht". Beide Hälften neu laden.
    await ctx.nachDownload?.();
    await zeigeAbrechnungDetail(ab.id);
  } catch (e) {
    console.error('[abrechnung/korrektur]', e);
    zeigeFehler(e.message || 'Korrekturrechnung fehlgeschlagen.');
    btn.disabled = false;
    btn.textContent = altText;
  }
}

/**
 * Signierte URL holen und die Datei öffnen.
 *
 * Aus `dashboard.js` mitgezogen (09.09.2026), unverändert bis auf die
 * Abhängigkeiten, die jetzt über `ctx` kommen. Der Statuswechsel
 * `erstellt → heruntergeladen` ist bedingt (`.eq('status','erstellt')`):
 * ein zweiter Download darf eine schon eingereichte Datei nicht zurücksetzen.
 *
 * @param {string} path  Pfad im Bucket `abrechnungen`
 * @param {string|null} abrechnungId  nur für den Statuswechsel
 * @param {'dta'|'begleit'} kind
 */
export async function downloadAbrechnungFile(path, abrechnungId, kind) {
  if (!path) return;
  try {
    const { data, error } = await ctx.supabase.storage.from('abrechnungen').createSignedUrl(path, 300);
    if (error) throw error;
    window.open(data.signedUrl, '_blank');
    if (abrechnungId && kind === 'dta') {
      await ctx.supabase.from('abrechnung')
        .update({ status: 'heruntergeladen' })
        .eq('id', abrechnungId)
        .eq('status', 'erstellt');
      await ctx.nachDownload?.();
    }
  } catch (e) {
    console.error('[abrechnung/download]', e);
    ctx.showToast?.('Download fehlgeschlagen: ' + e.message, 'error');
  }
}
