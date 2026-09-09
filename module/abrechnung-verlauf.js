/**
 * abrechnung-verlauf.js — die OBERE Hälfte der Ansicht „Bisherige Abrechnungen".
 *
 * Auftrag (Kemal, 08.09.2026):
 *   „Eskilerine bak deyince … üstte maviler, altta yeşiller ve kırmızılar,
 *    sarı yarı reddedilmiş. Üst yarıda liste, alt yarıda tıklananın bilgileri."
 *
 * Muster
 * ──────
 * Dieselbe Bauart wie `panel-verordnungen`: `verordnung-liste.js` (oben) +
 * `verordnung-detail.js` (unten), gekoppelt über `module/signal.js`. Der Plan
 * lässt genau zwei Wege zu — dem Muster folgen oder eine gemeinsame Hülle
 * herausziehen —, aber keine dritte Handschrift. Eine Hülle für zwei Nutzer zu
 * bauen wäre die teurere Variante; also das Muster.
 *
 * Was diese Datei ablöst
 * ──────────────────────
 * `renderAbrechnungHistory()` (`dashboard.js`, Stufe 4 des alten Assistenten).
 * Mit ihr geht das `ab_status_*`-Wörterbuch: dessen Wortlaut („Abgelehnt")
 * verwischt genau die Unterscheidung, die `gkv-302` mit Veto V2 verlangt —
 * abgewiesene DATEI (Prüfstufe 1–3) gegen abgesetzten BELEG (Prüfstufe 4).
 * Verbindlich ist ab hier der Wortlaut aus `abrechnung-status.js`.
 *
 * ⚠️ Ein Knopf ist NICHT mitgekommen: „Korrigieren & erneut vorbereiten".
 * Er setzte die Rezepte einer abgesetzten Datei zurück auf `bereit`, womit sie
 * in der nächsten ERSTrechnung (VKZ 01) gelandet wären — für die Kasse
 * derselbe Beleg zum zweiten Mal, also Doppelabrechnung (gkv-302, Veto V1:
 * Anlage 1 TP5 V21 Kap. 7.4.3, Korrekturverfahren Nr. 3). Der richtige Weg
 * (VKZ 04 + URI) kommt mit Phase 5; bis dahin bietet der Bildschirm den
 * falschen Weg lieber gar nicht an. Genau deshalb steht Phase 5 vor Phase 4.
 */

import { fmtEur } from './geld.js?v=20260909';
import { aggregierterDateiStatus, dateiStatusBadge, dateiStatusInfo } from './abrechnung-status.js?v=20260909';
import { emit } from './signal.js?v=20260813';

// ─── Reines Sortieren (ohne DOM — hier liegen die Tests) ────────────────────

/**
 * „Offen zuerst": was die Praxis noch anfassen muss, steht oben; was erledigt
 * ist, unten. Kleinere Zahl = weiter oben.
 *
 * Die Reihenfolge ist keine Statusachse, sondern eine Dringlichkeitsachse:
 *   0  Geld ist in Gefahr und es gibt etwas zu tun (absetzen/abweisen)
 *   1  teilweise — dasselbe, nur für einen Teil der Belege
 *   2  liegt hier herum und ist noch nicht bei der Kasse
 *   3  unterwegs, wir warten auf die Antwort
 *   4  angenommen, wir warten auf das Geld
 *   5  fertig
 */
export const DRINGLICHKEIT = {
  rejected: 0, abgewiesen: 0,
  teilweise_abgesetzt: 1,
  erstellt: 2, heruntergeladen: 2,
  gesendet: 3,
  accepted: 4,
  paid: 5,
};

/** @param {string} key @returns {number} */
export function dringlichkeit(key) {
  const r = DRINGLICHKEIT[key];
  // Unbekanntes nach ganz oben: ein Status, den niemand kennt, ist eher etwas,
  // das jemand ansehen sollte, als etwas, das erledigt ist.
  return r === undefined ? -1 : r;
}

const txt = (v) => String(v ?? '').toLocaleLowerCase('de-DE');
const num = (v) => Number(v) || 0;

/**
 * Sortiert die Dateiliste.
 *
 * `key === null` ist die Vorgabe „offen zuerst, dann Datum absteigend".
 * Ein Klick auf eine Spaltenüberschrift schaltet auf REINE Spaltensortierung —
 * die Dringlichkeit fällt dann weg, sonst wäre die Spalte nicht sortiert,
 * sondern nur innerhalb von Gruppen sortiert, und niemand fände die grösste
 * Summe. (Muster: `docSortCity`, dashboard.js — das einzige Vorbild im Projekt.)
 *
 * @param {Array<object>} zeilen  angereicherte Zeilen aus `ladeVerlauf()`
 * @param {string|null} key
 * @param {'asc'|'desc'} dir
 */
export function sortiereVerlauf(zeilen, key = null, dir = 'desc') {
  const liste = [...(zeilen || [])];
  const vz = dir === 'asc' ? 1 : -1;

  if (!key) {
    return liste.sort((a, b) =>
      dringlichkeit(a.anzeigeStatus) - dringlichkeit(b.anzeigeStatus)
      || String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  const wert = {
    datei:  (r) => txt(r.dateiname || r.rechnungsnummer || r.id),
    kasse:  (r) => txt(r.kassenName),
    belege: (r) => num(r.prescription_count),
    soll:   (r) => num(r.soll),
    offen:  (r) => num(r.offen),
    status: (r) => dringlichkeit(r.anzeigeStatus),
    datum:  (r) => String(r.created_at || ''),
  }[key] || ((r) => String(r.created_at || ''));

  return liste.sort((a, b) => {
    const x = wert(a), y = wert(b);
    if (x < y) return -1 * vz;
    if (x > y) return 1 * vz;
    // Gleichstand: immer dieselbe Reihenfolge, sonst springen Zeilen beim
    // Neuzeichnen sichtbar hin und her.
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Rechnet je Datei die vier Geldzahlen aus den drei Roh-Listen.
 * Rein, weil hier der Unterschied zwischen „Soll" und „Zuzahlung" sitzt, den
 * die alte Podologie-Liste vertauscht hatte.
 *
 * @param {Array<object>} dateien   `abrechnung`-Zeilen
 * @param {Array<object>} zeilen    `abrechnung_zeile` (netto_eur, absetzung_eur, abrechnung_id)
 * @param {Array<object>} zahlungen `abrechnung_zahlung` (betrag_eur, abrechnung_id)
 * @param {(ik:string)=>string} kassenName
 */
export function reichereAn(dateien, zeilen, zahlungen, kassenName = (ik) => ik) {
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const jeDatei = new Map();
  for (const z of zeilen || []) {
    const e = jeDatei.get(z.abrechnung_id) || { netto: 0, absetzung: 0 };
    e.netto     = r2(e.netto     + num(z.netto_eur));
    e.absetzung = r2(e.absetzung + num(z.absetzung_eur));
    jeDatei.set(z.abrechnung_id, e);
  }
  const bezahltJe = new Map();
  for (const z of zahlungen || []) {
    bezahltJe.set(z.abrechnung_id, r2((bezahltJe.get(z.abrechnung_id) || 0) + num(z.betrag_eur)));
  }

  return (dateien || []).map(a => {
    const e = jeDatei.get(a.id);
    // Ohne Zeilenbeträge (rekonstruierte Altdatei) gilt der Kopfsatz —
    // dieselbe Rückfallregel wie in fn_abrechnung_zahlung_status().
    const soll = e && e.netto > 0
      ? e.netto
      : r2(num(a.total_eur) - num(a.zuzahlung_total));
    const absetzung = e ? e.absetzung : 0;
    const bezahlt = bezahltJe.get(a.id) || 0;
    return {
      ...a,
      kassenName: kassenName(a.kostentraeger_ik) || a.kostentraeger_ik || '—',
      anzeigeStatus: aggregierterDateiStatus(a),
      soll, absetzung, bezahlt,
      offen: r2(soll - absetzung - bezahlt),
    };
  });
}

// ─── Zustand + Zeichnen ─────────────────────────────────────────────────────

const SPALTEN = 7;

let ctx = null;
let _zeilen = [];
let _sort = { key: null, dir: 'desc' };
let _auswahl = null;   // abrechnung.id
let _verdrahtet = false;

/**
 * @param {object} deps supabase · getOwnerId · escapeHtml · kassenName
 */
export function initAbrechnungVerlauf(deps) { ctx = deps; }

/** Nur für Tests/Fehlersuche. */
export function _verlaufZustand() { return { zeilen: _zeilen, sort: _sort, auswahl: _auswahl }; }

/** Welche Datei ist gerade aufgeschlagen? */
export function gewaehlteAbrechnung() { return _auswahl; }

export async function ladeAbrechnungVerlauf() {
  const tbody = document.getElementById('abVerlaufTbody');
  const empty = document.getElementById('abVerlaufEmpty');
  const ownerId = ctx?.getOwnerId?.();
  if (!tbody || !ownerId) return;

  if (tbody.dataset.geladen === '1') tbody.style.opacity = '0.45';
  else tbody.innerHTML = `<tr><td colspan="${SPALTEN}" style="text-align:center;padding:20px;color:var(--text-muted)">Lädt…</td></tr>`;

  const [dateiRes, zeilenRes, zahlungRes] = await Promise.all([
    ctx.supabase.from('abrechnung')
      .select('id, kostentraeger_ik, dateiname, rechnungsnummer, total_eur, zuzahlung_total, prescription_count, rejected_count, status, storage_path, begleitzettel_path, signed_storage_path, signed_at, zaa_uploaded_at, paid_at, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(50),
    // Nur die Summanden, nicht die ganzen Zeilen: die Detailansicht holt sie
    // ohnehin je Datei über den Server (GET /abrechnung/:id/zeilen).
    ctx.supabase.from('abrechnung_zeile')
      .select('abrechnung_id, netto_eur, absetzung_eur')
      .eq('owner_id', ownerId),
    ctx.supabase.from('abrechnung_zahlung')
      .select('abrechnung_id, betrag_eur')
      .eq('owner_id', ownerId),
  ]);

  if (dateiRes.error)   console.error('[abrechnung-verlauf/dateien]', dateiRes.error);
  if (zeilenRes.error)  console.error('[abrechnung-verlauf/zeilen]', zeilenRes.error);
  if (zahlungRes.error) console.error('[abrechnung-verlauf/zahlungen]', zahlungRes.error);

  _zeilen = reichereAn(dateiRes.data || [], zeilenRes.data || [], zahlungRes.data || [],
                       (ik) => ctx.kassenName?.(ik));

  _einstiegAktualisieren();
  _verdrahteEinmal();

  tbody.style.opacity = '';
  if (!_zeilen.length) {
    tbody.innerHTML = '';
    delete tbody.dataset.geladen;
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  zeichneVerlauf();
}

function zeichneVerlauf() {
  const tbody = document.getElementById('abVerlaufTbody');
  if (!tbody) return;
  const esc = ctx.escapeHtml;
  const sortiert = sortiereVerlauf(_zeilen, _sort.key, _sort.dir);

  tbody.innerHTML = sortiert.map(a => {
    const gewaehlt = _auswahl === a.id;
    const info = dateiStatusInfo(a.anzeigeStatus);
    const datum = a.created_at ? new Date(a.created_at).toLocaleDateString('de-DE') : '—';
    const signiert = a.signed_storage_path
      ? `<span title="signiert${a.signed_at ? ' am ' + new Date(a.signed_at).toLocaleString('de-DE') : ''}" style="color:#16a34a;">✍</span>`
      : '';
    // Die Fälligkeit steht in der Liste nur, wenn sie überschritten ist —
    // 4 Wochen ab Einreichung (Richtlinien-Text 20.11.2006 § 7 Abs. 2).
    const ueber = istUeberfaellig(a);
    return `<tr class="ab-verlauf-row${gewaehlt ? ' ab-verlauf-gewaehlt' : ''}" data-id="${esc(a.id)}"
        style="cursor:pointer;border-left:3px solid ${info.farbe};${gewaehlt ? 'background:var(--bg-card);' : ''}"
        title="${esc(info.hilfe)}">
      <td style="white-space:nowrap;"><code style="font-size:12px;color:var(--text-main);">${esc(a.dateiname || a.rechnungsnummer || a.id.slice(0, 8))}</code> ${signiert}</td>
      <td style="color:var(--text-main);">${esc(a.kassenName)}</td>
      <td style="white-space:nowrap;">${datum}</td>
      <td style="text-align:center;color:var(--text-muted);">${a.prescription_count || 0}</td>
      <td style="text-align:right;white-space:nowrap;color:var(--text-main);">${esc(fmtEur(a.soll))}</td>
      <td style="text-align:right;white-space:nowrap;color:${a.offen > 0.005 ? 'var(--text-main)' : 'var(--text-muted)'};">
        ${esc(fmtEur(a.offen))}${ueber ? ` <span title="Zahlungsfrist von 4 Wochen überschritten (Richtlinien § 7 Abs. 2)" style="color:#ea580c;">⏰</span>` : ''}
      </td>
      <td>${dateiStatusBadge(a.anzeigeStatus, { kurz: true })}</td>
    </tr>`;
  }).join('');
  tbody.dataset.geladen = '1';
}

/** Eingereicht + 28 Tage, und es ist noch Geld offen. */
export function istUeberfaellig(a, heute = new Date()) {
  if (!a?.zaa_uploaded_at) return false;
  if (!(Number(a.offen) > 0.005)) return false;
  return heute.getTime() - new Date(a.zaa_uploaded_at).getTime() > 28 * 864e5;
}

function _einstiegAktualisieren() {
  const el = document.getElementById('abEinstiegAltInfo');
  if (!el) return;
  if (!_zeilen.length) { el.textContent = 'Noch keine Abrechnungen erstellt'; return; }
  const offenZahl = _zeilen.filter(a => a.offen > 0.005).length;
  const offenSumme = _zeilen.reduce((s, a) => s + (a.offen > 0 ? a.offen : 0), 0);
  const rot = _zeilen.filter(a => a.anzeigeStatus === 'rejected' || a.anzeigeStatus === 'abgewiesen').length;
  el.textContent = `${_zeilen.length} Datei${_zeilen.length > 1 ? 'en' : ''} · ${offenZahl} offen`
    + (rot ? ` · ${rot} abgesetzt` : '') + ` · ${fmtEur(offenSumme)} offen`;
}

// ─── Ereignisse ─────────────────────────────────────────────────────────────

/**
 * Einmal je Sitzung, delegiert. `#abVerlaufTbody` steht statisch in
 * `dashboard.html` und wird nur neu befüllt — ein Zuhörer am Element sammelte
 * sich bei jedem Neuzeichnen an.
 */
function _verdrahteEinmal() {
  if (_verdrahtet) return;
  _verdrahtet = true;

  document.addEventListener('click', (e) => {
    const kopf = e.target.closest?.('#abVerlaufKopf [data-sort]');
    if (kopf) {
      const key = kopf.dataset.sort;
      // Dritter Klick auf dieselbe Spalte führt zurück zur Vorgabe „offen
      // zuerst" — sonst gibt es keinen Weg dorthin ausser Neuladen.
      if (_sort.key === key && _sort.dir === 'asc')       _sort = { key: null, dir: 'desc' };
      else if (_sort.key === key && _sort.dir === 'desc') _sort = { key, dir: 'asc' };
      else                                                _sort = { key, dir: 'desc' };
      _zeichnePfeile();
      zeichneVerlauf();
      return;
    }

    const zeile = e.target.closest?.('#abVerlaufTbody .ab-verlauf-row');
    if (zeile) { waehle(zeile.dataset.id); return; }

    if (e.target.closest?.('#abDetailClose')) { waehle(null); return; }
  });
}

function _zeichnePfeile() {
  for (const th of document.querySelectorAll('#abVerlaufKopf [data-sort]')) {
    const icon = th.querySelector('.sort-icon');
    if (!icon) continue;
    icon.textContent = _sort.key === th.dataset.sort ? (_sort.dir === 'asc' ? '↑' : '↓') : '';
  }
}

/**
 * Datei aufschlagen (oder Auswahl aufheben). Die untere Hälfte hört über
 * `signal.js` zu — dieselbe Kopplung wie zwischen Verordnungsliste und
 * Verordnungsdetail. So muss diese Datei nichts über die Detailansicht wissen.
 */
export function waehle(id) {
  _auswahl = id || null;
  zeichneVerlauf();
  emit('abrechnung:gewaehlt', { id: _auswahl });
}
