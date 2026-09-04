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
 * Was der Anwender an dieser Stelle wirklich wissen muss (Beta-2, 12.08.2026):
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
 *     Wahrheit  =  der Abrechnungsstatus je Verordnung, in der Datenbank
 *                  (podologisch übersetzt aus prescriptions.abrechnung_status,
 *                  siehe verordnung-topf.js)
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
// Seit 04.09.2026 EIN Verordnungstopf (`prescriptions`). Diese Datei spricht
// weiter podologisch (STATUS/UEBERGAENGE oben bleiben unangetastet) —
// uebersetzt wird nur an den beiden Lesestellen unten.
import { TOPF, ausTopf } from './verordnung-topf.js?v=20260904';

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

/* ═══════════════════════════════════════════════════════════════════════════
   Der zweite Topf: `prescriptions` (Physio · Ergo · Logopädie)
   ═══════════════════════════════════════════════════════════════════════════

   Anlass: Beim Umbau der Seite „Verordnungen" in zwei Hälften (Kemal,
   31.08.2026) stehen beide Töpfe erstmals in EINER Liste untereinander. Vorher
   wurde `prescriptions.status` an zwei Stellen getrennt übersetzt —
   `verordnung-liste.js` kannte 6 Zustände mit Farben, `verordnung-detail.js`
   kannte 8 ohne Farben. Dieselbe Verordnung konnte oben in der Zeile und unten
   im Detail verschieden heissen.

   Warum die Zustände NICHT in STATUS oben einsortiert werden: STATUS ist die
   Zustandsmaschine des Podologie-Topfes; `UEBERGAENGE` und der Statusdialog
   hängen daran, und der Server (`verordnung-status.routes.js`) kennt genau
   diese Schlüssel. Ein `parsed` dort hinein würde im Statusdialog einer
   Podologie-Verordnung als anklickbares Ziel auftauchen, das der Server
   ablehnt. Zwei Vokabulare, eine Darstellung — deshalb dieselbe Form
   ({key,label,kurz,farbe,bg,hilfe}) und ein gemeinsamer Zeichner.

   Die Beschriftungen sind bewusst an den Podologie-Topf angeglichen, wo die
   Bedeutung dieselbe ist: `in_therapy` heisst „In Behandlung" wie `aktiv`,
   `completed` heisst „Bereit zur Abrechnung" wie `abrechenbar`. Für den
   Anwender ist es dieselbe Lage, nur ein anderer Fachbereich.
*/
const PHYSIO_STATUS = [
  {
    key: 'parsed', label: 'Erfasst', kurz: 'Erfasst',
    farbe: '#b45309', bg: 'rgba(180,83,9,0.14)',
    hilfe: 'Aus dem Rezept gelesen, noch nicht geprüft und bestätigt.',
  },
  {
    key: 'confirmed', label: 'Bestätigt', kurz: 'Bestätigt',
    farbe: '#0f766e', bg: 'rgba(15,118,110,0.14)',
    hilfe: 'Geprüft und übernommen. Die Behandlungsserie hat noch nicht begonnen.',
  },
  {
    key: 'in_therapy', label: 'In Behandlung', kurz: 'In Behandlung',
    farbe: '#2563eb', bg: 'rgba(37,99,235,0.14)',
    hilfe: 'Die Behandlungsserie läuft noch.',
  },
  {
    // Altbestand: dieselbe Bedeutung wie `in_therapy`, nur ältere Schreibweise.
    key: 'active', label: 'In Behandlung', kurz: 'In Behandlung',
    farbe: '#2563eb', bg: 'rgba(37,99,235,0.14)',
    hilfe: 'Die Behandlungsserie läuft noch.',
  },
  {
    key: 'completed', label: 'Bereit zur Abrechnung', kurz: 'Bereit',
    farbe: '#15803d', bg: 'rgba(21,128,61,0.14)',
    hilfe: 'Alle Einheiten sind erbracht. Die Verordnung wartet auf die Abrechnung.',
  },
  {
    key: 'billed', label: 'Abgerechnet', kurz: 'Abgerechnet',
    farbe: '#7c3aed', bg: 'rgba(124,58,237,0.14)',
    hilfe: 'Eingereicht. Rückmeldung der Kasse steht aus oder war fehlerfrei.',
  },
  {
    // NICHT dasselbe wie eine Absetzung: hier hat die Praxis das erfasste
    // Rezept verworfen, die Kasse hat gar nichts gesehen.
    key: 'rejected', label: 'Abgelehnt', kurz: 'Abgelehnt',
    farbe: '#b91c1c', bg: 'rgba(185,28,28,0.14)',
    hilfe: 'Beim Prüfen verworfen — nicht zu verwechseln mit einer Absetzung durch die Kasse.',
  },
  {
    key: 'cancelled', label: 'Storniert', kurz: 'Storniert',
    farbe: '#6b7280', bg: 'rgba(107,114,128,0.14)',
    hilfe: 'Von der Praxis zurückgezogen.',
  },
];

const PHYSIO_BY_KEY = new Map(PHYSIO_STATUS.map(s => [s.key, s]));

/**
 * Statusbeschreibung für eine Verordnung aus BEIDEM Topf.
 *
 * @param {string} quelle  'physio' | 'podologie'
 * @param {string} status  der rohe Spaltenwert
 * @returns {{key:string,label:string,kurz:string,farbe:string,bg:string,hilfe:string}|null}
 *          `null`, wenn gar kein Status vorliegt — dann bleibt die Zelle leer
 *          statt „unbekannt" zu behaupten.
 */
export function verordnungStatusInfo(quelle, status) {
  if (!status) return null;
  const tabelle = quelle === 'podologie' ? BY_KEY : PHYSIO_BY_KEY;
  return tabelle.get(status)
      // Ein unbekannter Wert wird gezeigt, wie er in der Spalte steht. Ihn auf
      // „In Behandlung" zu schönen wäre die gefährlichere Lüge: dann sähe eine
      // Verordnung in unbekanntem Zustand wie eine laufende aus.
      || { key: status, label: status, kurz: status,
           farbe: 'var(--text-muted)', bg: 'transparent',
           hilfe: 'Unbekannter Status — steht so in der Datenbank.' };
}

/**
 * Die grosse Statusrosette für den Kopf der Verordnungsansicht.
 *
 * Kemal, 31.08.2026: „dann Status bereit" — aus zwei Metern Abstand muss ohne
 * Hinsehen erkennbar sein, ob eine Verordnung noch läuft oder abgerechnet
 * werden kann. Deshalb hier grösser und mit Rand, nicht die 11px-Variante der
 * Listenzeile.
 */
export function statusBadgeGross(quelle, status) {
  const s = verordnungStatusInfo(quelle, status);
  if (!s) return '';
  return `<span title="${escapeAttr(s.hilfe)}" style="display:inline-flex;align-items:center;`
       + `font-size:13px;font-weight:700;padding:5px 14px;border-radius:14px;`
       + `background:${s.bg};color:${s.farbe};border:1px solid ${s.farbe};white-space:nowrap;">`
       + `${escapeHtml(s.label)}</span>`;
}

export function statusLabel(key) {
  return statusInfo(key).label;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Der Bereich — aus welchem Topf die Verordnung kommt
   ═══════════════════════════════════════════════════════════════════════════

   Nicht zu verwechseln mit dem Status oben. Status sagt „wo steht diese
   Verordnung auf dem Weg zum Geld", Bereich sagt „aus welchem Topf kommt
   sie" — und davon hängt ab, welche Felder sie überhaupt hat, welcher
   Katalog gilt und über welchen Weg sie abgerechnet wird:

       Physio · Ergo · Logopädie  →  prescriptions (therapie_bereich ≠ 'podo')  →  „Heilmittel"
       Podologie                  →  prescriptions (therapie_bereich = 'podo')  →  „Podologie"

   (Seit der Zusammenlegung der Verordnungstöpfe, 04.09.2026 — vorher stand
   hier eine eigene Tabelle `verordnungen`.)

   Deshalb eine eigene Farbfamilie: ein violettes „Heilmittel" neben einem
   violetten „Abgerechnet" wäre zweimal dieselbe Farbe für zwei Fragen.

   Steht hier und nicht in einer eigenen Datei, weil `quelle` in diesem Modul
   ohnehin schon der erste Parameter ist (`statusBadgeGross(quelle, status)`)
   und die Aufrufer es bereits importieren. Vorher stand dieselbe Tabelle
   wortgleich in `verordnung-liste.js` und `verordnung-uebersicht.js`; die
   dritte Kopie für den Kopf der aufgeschlagenen Verordnung (Kemal,
   03.09.2026) war der Anlass, sie an eine Stelle zu ziehen.
*/
const BEREICH = {
  physio: {
    label: 'Heilmittel', farbe: '#7c3aed', bg: 'rgba(124,58,237,0.12)',
    hilfe: 'Physiotherapie · Ergotherapie · Logopädie',
  },
  podologie: {
    label: 'Podologie', farbe: '#15803d', bg: 'rgba(21,128,61,0.12)',
    hilfe: 'Podologie',
  },
};

/**
 * @param {'physio'|'podologie'} quelle
 * @returns {{label:string,farbe:string,bg:string,hilfe:string}|null}
 *          `null` bei unbekanntem Topf — dann bleibt die Stelle leer, statt
 *          einen Bereich zu behaupten, den es nicht gibt.
 */
export function bereichInfo(quelle) {
  return BEREICH[quelle] || null;
}

/** Nur die Farbe — für Ränder und Akzentstriche, die keinen Text tragen. */
export function bereichFarbe(quelle) {
  return BEREICH[quelle]?.farbe || 'var(--text-muted)';
}

/**
 * Das Bereichsetikett als HTML.
 *
 * @param {'physio'|'podologie'} quelle
 * @param {object} [opt]
 * @param {boolean} [opt.gross=false]  `false` = die nackte Versalienzeile der
 *        Tabellenspalte (so stand sie dort schon, das bleibt so). `true` =
 *        gerandete Rosette für den Kopf einer aufgeschlagenen Verordnung, wo
 *        sie neben Belegnummer und Status steht und mithalten muss.
 */
export function bereichBadge(quelle, { gross = false } = {}) {
  const b = BEREICH[quelle];
  if (!b) return '';
  const gemeinsam = `font-weight:700;text-transform:uppercase;color:${b.farbe};`;
  if (!gross) {
    return `<span title="${escapeAttr(b.hilfe)}" style="font-size:11px;${gemeinsam}`
         + `letter-spacing:.04em;">${escapeHtml(b.label)}</span>`;
  }
  return `<span title="${escapeAttr(b.hilfe)}" style="display:inline-flex;align-items:center;`
       + `font-size:11px;${gemeinsam}letter-spacing:.06em;padding:4px 11px;border-radius:14px;`
       + `background:${b.bg};border:1px solid ${b.farbe};white-space:nowrap;">`
       + `${escapeHtml(b.label)}</span>`;
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
    .from(TOPF)
    .select('id, patient_id, abrechnung_status')
    .eq('owner_id', ownerId)
    .eq('therapie_bereich', 'podo')
    .not('patient_id', 'is', null);

  if (error) {
    console.error('[abrechnungsstatus] laden fehlgeschlagen:', error.message);
    return karte;
  }

  const gruppen = new Map();
  for (const roh of (data || [])) {
    const row = ausTopf(roh);
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
  const { data: vRoh, error } = await supabase
    .from(TOPF)
    .select('id, abrechnung_status, patient_name, absetzung_betrag, absetzung_grund')
    .eq('id', verordnungId)
    .eq('therapie_bereich', 'podo')
    .maybeSingle();
  if (error || !vRoh) {
    alert('Verordnung konnte nicht geladen werden.');
    return;
  }
  oeffneStatusDialog(ausTopf(vRoh), { token, onFertig });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
