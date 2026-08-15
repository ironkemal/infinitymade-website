/**
 * abrechnungsstatus.js — Der Status einer Verordnung auf dem Weg zum Geld.
 *
 * Warum es das gibt
 * ─────────────────
 * Die Patientenliste zeigte bis heute einen Vertriebs-Trichter:
 * `Neu · Kontaktiert · Termin · Gewonnen · Verloren`. Das ist das Erbe der
 * Zeit, in der das Produkt ein allgemeines KMU-CRM war. In einer Praxis hat
 * kein einziger dieser Werte eine Entsprechung — ein Patient wird nicht
 * „gewonnen".
 *
 * Was der Anwender an dieser Stelle wirklich wissen muss (Nausad, 12.08.2026):
 *
 *     Bereit zur Abrechnung · Abgerechnet · Teilabsetzung · Absetzung · Storniert
 *
 * Also der Abrechnungsweg — die einzige Statusfrage, die in einer Praxis
 * Geld bedeutet.
 *
 * Die Wahrheit liegt nicht beim Patienten
 * ───────────────────────────────────────
 * Ein Patient IST nicht „abgerechnet" — seine einzelnen Verordnungen sind es.
 * Ein Patient kann gleichzeitig eine abgesetzte Verordnung von letztem Monat
 * und eine laufende Behandlung haben. Deshalb:
 *
 *     Wahrheit  =  verordnungen.status  (je Verordnung, in der Datenbank)
 *     Anzeige   =  der dringlichste Status seiner Verordnungen (hier berechnet)
 *
 * „Dringlichst" heisst: was Arbeit macht, steht oben. Eine Absetzung ist Geld,
 * das nicht gekommen ist, und verdrängt in der Zeile ein ruhiges „Abgerechnet".
 * Deshalb ist der Wert der Patientenzeile nirgends gespeichert — gespeicherte
 * Aggregate laufen auseinander, sobald irgendwo eine Verordnung kippt.
 *
 * Etikett ≠ Tor
 * ─────────────
 * Diese Datei ZEIGT und SCHLÄGT VOR. Ob ein Übergang erlaubt ist, entscheidet
 * ausschliesslich der Server (`PATCH /billing/verordnung/:id/abrechnungsstatus`).
 * Die Liste unten ist eine Kopie für die Menüführung, keine zweite Wahrheit:
 * ein Klick, den das Backend ablehnt, wird hier als Fehler angezeigt, nicht
 * stillschweigend geschluckt.
 */

import { emit } from './signal.js?v=20260813';

const API = 'https://n8n.infinitymade.de/api';

/**
 * Reihenfolge = Dringlichkeit. Kleiner Index gewinnt in der Patientenzeile.
 * Absetzung zuerst: das ist ausgefallenes Geld mit Frist.
 */
export const STATUS = [
  {
    key: 'abgesetzt', label: 'Absetzung', kurz: 'Absetzung',
    farbe: '#b91c1c', bg: 'rgba(185,28,28,0.14)',
    hilfe: 'Die Kasse hat den Beleg abgesetzt. Grund prüfen, korrigieren, erneut einreichen.',
  },
  {
    key: 'teilabsetzung', label: 'Teilabsetzung', kurz: 'Teilabsetzung',
    farbe: '#c2410c', bg: 'rgba(194,65,12,0.14)',
    hilfe: 'Die Kasse hat gekürzt gezahlt. Der gekürzte Betrag steht in der Verordnung.',
  },
  {
    key: 'abrechenbar', label: 'Bereit zur Abrechnung', kurz: 'Bereit',
    farbe: '#15803d', bg: 'rgba(21,128,61,0.14)',
    hilfe: 'Behandlungen sind dokumentiert. Die Verordnung wartet auf die nächste §302-Datei.',
  },
  {
    key: 'aktiv', label: 'In Behandlung', kurz: 'In Behandlung',
    farbe: '#2563eb', bg: 'rgba(37,99,235,0.14)',
    hilfe: 'Die Behandlungsserie läuft noch.',
  },
  {
    key: 'abgerechnet', label: 'Abgerechnet', kurz: 'Abgerechnet',
    farbe: '#7c3aed', bg: 'rgba(124,58,237,0.14)',
    hilfe: 'In einer §302-Datei eingereicht. Rückmeldung der Kasse steht aus oder war fehlerfrei.',
  },
  {
    key: 'storniert', label: 'Storniert', kurz: 'Storniert',
    farbe: '#6b7280', bg: 'rgba(107,114,128,0.14)',
    hilfe: 'Von der Praxis zurückgezogen.',
  },
  {
    key: 'archiviert', label: 'Archiviert', kurz: 'Archiviert',
    farbe: '#6b7280', bg: 'rgba(107,114,128,0.10)',
    hilfe: 'Abgeschlossen und aus der Arbeitsliste genommen.',
  },
];

const BY_KEY = new Map(STATUS.map(s => [s.key, s]));
const RANG = new Map(STATUS.map((s, i) => [s.key, i]));

/** Muss zu UEBERGAENGE in verordnung-status.routes.js passen. Server entscheidet. */
export const UEBERGAENGE = {
  aktiv:         ['abrechenbar', 'storniert', 'archiviert'],
  abrechenbar:   ['aktiv', 'storniert', 'archiviert'],
  abgerechnet:   ['teilabsetzung', 'abgesetzt', 'storniert'],
  teilabsetzung: ['abgesetzt', 'storniert', 'archiviert'],
  abgesetzt:     ['aktiv', 'teilabsetzung', 'storniert', 'archiviert'],
  storniert:     ['archiviert'],
  archiviert:    [],
};

export function statusInfo(key) {
  return BY_KEY.get(key) || BY_KEY.get('aktiv');
}

export function statusLabel(key) {
  return statusInfo(key).label;
}

/** Farbiges Etikett. Ohne Verordnung bleibt die Zelle bewusst leer statt „unbekannt". */
export function statusBadge(key, { kurz = false } = {}) {
  if (!key) {
    return '<span style="color:var(--text-muted);font-size:12px;">—</span>';
  }
  const s = statusInfo(key);
  const text = kurz ? s.kurz : s.label;
  return `<span title="${escapeAttr(s.hilfe)}" style="display:inline-block;font-size:11px;font-weight:600;`
       + `padding:2px 8px;border-radius:10px;background:${s.bg};color:${s.farbe};">${escapeHtml(text)}</span>`;
}

/**
 * Der Status, der in der Patientenzeile stehen soll.
 * @param {Array<{status?:string}>} verordnungen Verordnungen EINES Patienten
 * @returns {string|null} null, wenn der Patient keine Verordnung hat
 */
export function aggregierterStatus(verordnungen) {
  return massgebendeVerordnung(verordnungen)?.status ?? null;
}

/**
 * Die Verordnung, die den Status der Zeile bestimmt — also die dringlichste.
 *
 * Sie wird gebraucht, sobald der Anwender den Status aus der Patientenliste
 * heraus ändern will: geändert wird nie „der Status des Patienten" (den gibt es
 * nicht), sondern genau diese eine Verordnung.
 *
 * @param {Array<{id?:string, status?:string}>} verordnungen
 */
export function massgebendeVerordnung(verordnungen) {
  let best = null;
  for (const v of (verordnungen || [])) {
    const k = v?.status || 'aktiv';
    if (!RANG.has(k)) continue;
    if (best === null || RANG.get(k) < RANG.get(best.status || 'aktiv')) best = { ...v, status: k };
  }
  return best;
}

/**
 * Verordnungsstatus je Patient laden.
 *
 * Eine Abfrage für die ganze Liste, nicht eine je Zeile: bei 400 Patienten
 * wären das 400 Runden und die Liste käme sichtbar zeilenweise an.
 *
 * @param supabase  aktiver Supabase-Client
 * @param ownerId   Mandant (getOwnerId())
 * @returns {Promise<Map<string, {status:string, anzahl:number, offen:number}>>} lead_id → Zusammenfassung
 */
export async function ladeStatusJePatient(supabase, ownerId) {
  const karte = new Map();
  if (!ownerId) return karte;

  const { data, error } = await supabase
    .from('verordnungen')
    .select('id, lead_id, status')
    .eq('owner_id', ownerId)
    .not('lead_id', 'is', null);

  if (error) {
    console.error('[abrechnungsstatus] laden fehlgeschlagen:', error.message);
    return karte;
  }

  const gruppen = new Map();
  for (const row of (data || [])) {
    if (!gruppen.has(row.lead_id)) gruppen.set(row.lead_id, []);
    gruppen.get(row.lead_id).push(row);
  }
  for (const [leadId, rows] of gruppen) {
    const massgebend = massgebendeVerordnung(rows);
    karte.set(leadId, {
      status: massgebend?.status ?? null,
      // Für die Änderung aus der Liste heraus: DIESE Verordnung ist gemeint.
      verordnungId: massgebend?.id ?? null,
      anzahl: rows.length,
      // „offen" = macht noch Arbeit. Archiviert und storniert zählen nicht mit.
      offen:  rows.filter(r => !['archiviert', 'storniert'].includes(r.status)).length,
    });
  }
  return karte;
}

/**
 * Statuswechsel anstossen. Wirft mit lesbarer Meldung, wenn der Server sperrt.
 *
 * Der Server verlangt je nach Ziel Grund/Betrag/Bestätigung. Die Abfrage dazu
 * passiert hier, damit jede aufrufende Stelle dieselbe Führung bekommt.
 *
 * @param {string} verordnungId
 * @param {string} ziel  Zielstatus
 * @param {object} opts  { grund, betrag, datum, meldepflichtBestaetigt, token }
 */
export async function setzeStatus(verordnungId, ziel, opts = {}) {
  const { token } = opts;
  if (!token) throw new Error('Nicht angemeldet.');

  const res = await fetch(`${API}/billing/verordnung/${verordnungId}/abrechnungsstatus`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      status: ziel,
      grund: opts.grund || '',
      betrag: opts.betrag,
      datum: opts.datum,
      meldepflichtBestaetigt: !!opts.meldepflichtBestaetigt,
    }),
  });

  let json = {};
  try { json = await res.json(); } catch { /* leere Antwort */ }

  if (res.status === 428) {
    const e = new Error(json.error || 'Bestätigung erforderlich.');
    e.bestaetigungErforderlich = true;
    e.hinweis = json.hinweis;
    throw e;
  }
  if (!res.ok) throw new Error(json.error || `Statuswechsel fehlgeschlagen (${res.status}).`);

  // Wer schreibt, meldet — Patientenliste und Abrechnungsliste ziehen selbst nach.
  emit('verordnungen:changed', { id: verordnungId, status: ziel });
  return json;
}

/**
 * Was der Anwender von hier aus anklicken darf.
 * „Abgerechnet" fehlt bewusst: den vergibt nur die §302-Dateierzeugung.
 */
export function moeglicheZiele(aktuell) {
  return (UEBERGAENGE[aktuell || 'aktiv'] || []).map(k => statusInfo(k));
}

/** Was der Server zusätzlich verlangt, bevor der Wechsel durchgeht. */
export function bedarf(ziel) {
  if (ziel === 'teilabsetzung') return { grund: true, betrag: true };
  if (ziel === 'abgesetzt')     return { grund: true, betrag: false };
  if (ziel === 'storniert')     return { grund: true, betrag: false };
  return { grund: false, betrag: false };
}

/**
 * Statusdialog öffnen.
 *
 * Bewusst ein eigenes Fenster statt eines <select> in der Zeile: „Teilabsetzung"
 * ohne Betrag und „Storniert" ohne Grund weist der Server ohnehin zurück. Ein
 * Auswahlfeld würde das erst NACH dem Klick zeigen — hier wird direkt gefragt,
 * was der Übergang braucht.
 *
 * @param {{id:string,status?:string,patient_name?:string,absetzung_betrag?:number}} verordnung
 * @param {{token:string, onFertig?:Function}} opts
 */
export function oeffneStatusDialog(verordnung, opts = {}) {
  const aktuell = verordnung.status || 'aktiv';
  const ziele = moeglicheZiele(aktuell);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;'
    + 'display:flex;align-items:center;justify-content:center;padding:16px;';

  const optionen = ziele.length
    ? ziele.map(z => `<option value="${z.key}">${escapeHtml(z.label)}</option>`).join('')
    : '';

  overlay.innerHTML = `
    <div style="background:var(--bg-card-solid,#1f2937);color:var(--text-main,#e5e7eb);border:1px solid var(--border,#374151);
                border-radius:12px;padding:20px;max-width:440px;width:100%;font-size:14px;">
      <h3 style="margin:0 0 4px;font-size:16px;">Abrechnungsstatus ändern</h3>
      <p style="margin:0 0 14px;color:var(--text-muted,#9ca3af);font-size:13px;">
        ${escapeHtml(verordnung.patient_name || 'Verordnung')} · aktuell: ${escapeHtml(statusLabel(aktuell))}
      </p>
      ${ziele.length ? `
      <label style="display:block;margin-bottom:6px;font-weight:600;">Neuer Status</label>
      <select id="as-ziel" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border,#374151);
              background:var(--bg-card,#111827);color:inherit;margin-bottom:12px;">${optionen}</select>
      <p id="as-hilfe" style="margin:-6px 0 12px;color:var(--text-muted,#9ca3af);font-size:12px;"></p>

      <div id="as-betrag-feld" style="display:none;margin-bottom:12px;">
        <label style="display:block;margin-bottom:6px;font-weight:600;">Gekürzter Betrag (€)</label>
        <input id="as-betrag" type="number" step="0.01" min="0.01" style="width:100%;padding:8px;border-radius:8px;
               border:1px solid var(--border,#374151);background:var(--bg-card,#111827);color:inherit;" />
      </div>

      <div id="as-grund-feld" style="display:none;margin-bottom:12px;">
        <label style="display:block;margin-bottom:6px;font-weight:600;">Grund</label>
        <textarea id="as-grund" rows="3" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border,#374151);
                  background:var(--bg-card,#111827);color:inherit;resize:vertical;"></textarea>
      </div>

      <div id="as-meldung" style="display:none;background:rgba(194,65,12,.12);border:1px solid rgba(194,65,12,.35);
           border-radius:8px;padding:10px;margin-bottom:12px;font-size:12.5px;line-height:1.45;">
        <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;">
          <input type="checkbox" id="as-meldepflicht" style="margin-top:2px;" />
          <span id="as-meldung-text"></span>
        </label>
      </div>
      ` : '<p style="color:var(--text-muted,#9ca3af);">Von hier aus ist kein weiterer Schritt möglich.</p>'}

      <p id="as-fehler" style="display:none;color:#f87171;margin:0 0 12px;font-size:13px;"></p>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="as-abbrechen" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border,#374151);
                background:transparent;color:inherit;cursor:pointer;">Abbrechen</button>
        ${ziele.length ? `<button id="as-ok" style="padding:8px 14px;border-radius:8px;border:none;
                background:var(--primary,#b1891b);color:#fff;font-weight:600;cursor:pointer;">Übernehmen</button>` : ''}
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const schliessen = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) schliessen(); });
  overlay.querySelector('#as-abbrechen').addEventListener('click', schliessen);

  if (!ziele.length) return;

  const zielEl    = overlay.querySelector('#as-ziel');
  const grundFeld = overlay.querySelector('#as-grund-feld');
  const betrFeld  = overlay.querySelector('#as-betrag-feld');
  const meldung   = overlay.querySelector('#as-meldung');
  const fehlerEl  = overlay.querySelector('#as-fehler');

  function zeichne() {
    const ziel = zielEl.value;
    const b = bedarf(ziel);
    grundFeld.style.display = b.grund ? '' : 'none';
    betrFeld.style.display  = b.betrag ? '' : 'none';
    overlay.querySelector('#as-hilfe').textContent = statusInfo(ziel).hilfe;
    const nachEinreichung = ['abgerechnet', 'teilabsetzung', 'abgesetzt'].includes(aktuell);
    if (ziel === 'storniert' && nachEinreichung) {
      meldung.style.display = '';
      overlay.querySelector('#as-meldung-text').textContent =
        'Diese Verordnung wurde bereits bei der Kasse eingereicht. Wurde dadurch zu viel '
        + 'gezahlt, muss die Krankenkasse informiert werden (schriftlich oder telefonisch). '
        + 'Ich habe das veranlasst.';
    } else {
      meldung.style.display = 'none';
    }
  }
  zielEl.addEventListener('change', zeichne);
  zeichne();

  overlay.querySelector('#as-ok').addEventListener('click', async () => {
    fehlerEl.style.display = 'none';
    try {
      await setzeStatus(verordnung.id, zielEl.value, {
        token:  opts.token,
        grund:  overlay.querySelector('#as-grund')?.value || '',
        betrag: overlay.querySelector('#as-betrag')?.value || undefined,
        meldepflichtBestaetigt: overlay.querySelector('#as-meldepflicht')?.checked === true,
      });
      schliessen();
      opts.onFertig?.();
    } catch (err) {
      fehlerEl.textContent = err.hinweis ? `${err.message} ${err.hinweis}` : err.message;
      fehlerEl.style.display = '';
    }
  });
}

/**
 * Bequemer Einstieg: lädt die Verordnung selbst und holt das Token aus der
 * Sitzung. Damit bleibt an der aufrufenden Stelle eine Zeile übrig — der
 * Beschluss vom 13.08.2026 verlangt, dass neuer Aufwand hier landet und nicht
 * in `dashboard.js`.
 */
export async function oeffneStatusDialogFuer(verordnungId, { supabase, onFertig } = {}) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  const { data: v, error } = await supabase
    .from('verordnungen')
    .select('id, status, patient_name, absetzung_betrag, absetzung_grund')
    .eq('id', verordnungId)
    .maybeSingle();
  if (error || !v) {
    alert('Verordnung konnte nicht geladen werden.');
    return;
  }
  oeffneStatusDialog(v, { token, onFertig });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
