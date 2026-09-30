/**
 * podo-tag-zusatz.js — zwei Zusätze der Tagesbehandlung (Reform S4, Paket 2).
 *
 * Warum es das gibt
 * ─────────────────
 * Konsey 30.09.2026 (Podologie-Reform S0, Beschluss 1a/1b): die Tagesbehandlung
 * bleibt der EINE Erfassungsort der Sitzung — es entsteht kein zweiter
 * Bildschirm. Zwei Dinge kommen dazu, beide ohne neuen Schreibweg:
 *
 *  (a) Ein aufklappbarer Fußbefund-Abschnitt. Zu, zeigt er nur, wann der
 *      letzte Befund war („unverändert lassen oder aktualisieren"). Auf,
 *      wird die vorhandene Fußbefund-Karte (module/fussbefund.js) hineingesetzt;
 *      sie speichert selbst nach `pat_fussbefund`. `podologie_behandlungen`
 *      bekommt dadurch KEINEN zweiten Schreibweg.
 *  (b) Nach dem Speichern die Frage „Folgetermin jetzt anlegen?". Sie legt
 *      nichts an — sie öffnet die vorhandene Terminmaske vorbelegt
 *      (module/termin-folge.js, `oeffneFolgetermin`).
 *
 * Hier steht nur, was ohne DOM testbar ist; die Verdrahtung sitzt in
 * podologie-abrechnung.js (Aufruf) und dashboard.js (Abhängigkeiten).
 */

import { datumDe, alsISODatum } from './datum.js?v=20260930f';

/** Text der Rückfrage nach dem Speichern (Konsey S0, 1b). */
export const FOLGE_FRAGE = {
  title: 'Folgetermin?',
  message: 'Behandlung gespeichert. Folgetermin jetzt anlegen?',
  confirmText: 'Folgetermin anlegen',
  cancelText: 'Später',
};

/**
 * Kopfzeile des Fußbefund-Abschnitts.
 *
 * @param {?string} letzterBefund  `pat_fussbefund.erstellt_am` des jüngsten gültigen Befunds, oder null
 * @returns {{titel:string, hinweis:string}}
 */
export function fussbefundKopf(letzterBefund) {
  const tag = datumDe(letzterBefund);
  if (!tag) {
    return { titel: 'Fußbefund — Noch kein Fußbefund', hinweis: 'Zum Erfassen aufklappen' };
  }
  return { titel: `Fußbefund — zuletzt am ${tag}`, hinweis: 'Befund unverändert lassen oder aktualisieren' };
}

/**
 * HTML des Abschnitts (`<details>`, standardmässig zu). `hostId` ist der
 * Container, in den beim ersten Aufklappen die Karte gesetzt wird.
 *
 * @param {?string} letzterBefund
 * @param {(s:string)=>string} esc  escapeHtml
 */
export function fussbefundBoxHtml(letzterBefund, esc) {
  const { titel, hinweis } = fussbefundKopf(letzterBefund);
  return `<details id="podFussbefundBox" style="border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);margin-bottom:12px;">
        <summary style="cursor:pointer;padding:10px 12px;color:var(--text-main);font-size:13px;">
          <strong>${esc(titel)}</strong>
          <span style="color:var(--text-muted);font-size:12px;"> · ${esc(hinweis)}</span>
        </summary>
        <div id="podFussbefundHost" style="padding:8px 12px 12px;overflow-x:auto;max-width:100%;"></div>
      </details>`;
}

/**
 * Jüngster gültiger Fußbefund des Patienten — nur das Datum.
 * Wirft nie; ohne Treffer oder bei Fehler `null` (dann steht „Noch kein Fußbefund").
 */
export async function ladeLetzterBefund(sb, ownerId, leadId) {
  if (!sb || !leadId) return null;
  try {
    const { data } = await sb.from('pat_fussbefund')
      .select('erstellt_am')
      .eq('owner_id', ownerId).eq('lead_id', leadId).eq('ist_aktuell', true)
      .order('erstellt_am', { ascending: false }).limit(1).maybeSingle();
    return data?.erstellt_am || null;
  } catch { return null; }
}

/**
 * Der Termin, von dem der Folgetermin ausgeht.
 *
 * Reihenfolge: (1) die Buchung, mit der die Tagesbehandlung geöffnet wurde
 * (Hausbesuch, `fahrtBookingId`); (2) ein nicht abgesagter Termin DERSELBEN
 * Verordnung am Behandlungstag; (3) keiner — dann ein Platzhalter aus Patient
 * und Verordnung, Datum = Behandlungstag 09:00. Der letzte Fall trägt keine
 * `id`, `oeffneFolgetermin` liest dann keine Leistungen.
 *
 * @param {object} p
 * @param {?object} p.buchung   Zeile aus `bookings` (mit start_time, lead_id …) oder null
 * @param {object} p.vord       Verordnung (`id`, `lead_id`)
 * @param {string} p.datum      Behandlungstag `YYYY-MM-DD`
 * @param {string} [p.name]     Anzeigename des Patienten
 * @returns {{quelle:'buchung'|'platzhalter', booking:object}}
 */
export function folgeAusgangstermin({ buchung, vord, datum, name = '' }) {
  if (buchung?.id) {
    return { quelle: 'buchung', booking: { ...buchung, lead_id: buchung.lead_id || vord?.lead_id || null,
      verordnung_id: buchung.verordnung_id || vord?.id || null } };
  }
  return {
    quelle: 'platzhalter',
    booking: {
      id: null, lead_id: vord?.lead_id || null, verordnung_id: vord?.id || null,
      customer_name: name, customer_phone: '', service_id: null, hausbesuch: !!vord?.hausbesuch,
      start_time: `${datum || alsISODatum(new Date())}T09:00:00`,
    },
  };
}

/** Termin am Behandlungstag zu dieser Verordnung, sonst null. Wirft nie. */
export async function ladeTagesTermin(sb, ownerId, vordId, datum) {
  if (!sb || !vordId || !datum) return null;
  try {
    // Tag in Berlin (alsISODatum) wie podGeplanteHpnr — nicht die Mitternacht des Browsers.
    // Grob ±1 Tag laden, dann genau filtern.
    const mitte = Date.parse(`${datum}T12:00:00Z`);
    const { data } = await sb.from('bookings').select('*')
      .eq('owner_id', ownerId).eq('verordnung_id', vordId)
      .neq('status', 'cancelled')
      .gte('start_time', new Date(mitte - 36 * 3600e3).toISOString()).lt('start_time', new Date(mitte + 36 * 3600e3).toISOString())
      .order('start_time', { ascending: true });
    return (data || []).find(b => b.start_time && alsISODatum(new Date(b.start_time)) === datum) || null;
  } catch { return null; }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Anamnese-Hinweis (Reform S4, Paket 3 · gkv-302 30.09.2026)
   Die Anamnese ist Leistungsinhalt der Eingangsbefundung 78040 (Anlage 1a
   Teil 2 Nr. 4.1). Fehlt sie, gibt es zwei WEICHE Hinweise — beide sperren nichts,
   der DTA-/Bereit-Pfad kennt keinen Block:
     1. Notiz + Link in der Tagesbehandlung (immer, wenn keine Anamnese da ist);
     2. Rückfrage beim Speichern, wenn 78040 angekreuzt ist.
   Beide hängen an EINER Prüfung: `hatAnamnese`.
   ───────────────────────────────────────────────────────────────────────────── */

/** Die Eingangsbefundung — eine Konstante, damit Test und Aufrufer dasselbe meinen. */
export const CODE_EINGANGSBEFUNDUNG = '78040';

export const ANAMNESE_FEHLT_NOTIZ = 'Für diese Patientin / diesen Patienten ist noch keine Anamnese erfasst.';

/** Rückfrage beim Speichern von 78040 ohne Anamnese (Text: gkv-302). */
export const ANAMNESE_78040_FRAGE = {
  title: 'Anamnese fehlt',
  message: 'Die Anamnese ist Leistungsinhalt der Eingangsbefundung (Anlage 1a Teil 2 Nr. 4.1). Wurde sie erhoben (auch auf Papier)?',
  confirmText: 'Anamnese erhoben — speichern',
  cancelText: 'Zurück',
  variant: 'warning',
};

/**
 * Gibt es zu diesem Patienten eine GÜLTIGE Podologie-Anamnese?
 * `anamnese.patient_id` → `leads.id`. Bewusst OHNE `owner_id`-Filter, wie der
 * Reiter „Anamnese" der Akte (RLS entscheidet; ein Filter könnte bei geteilten
 * Standorten fälschlich „fehlt" melden). Seit 30.09.2026 (Anamnese je Fachbereich,
 * append-only): nur die gültige Zeile (`ist_aktuell`) des Fachbereichs `podo` zählt —
 * eine alte Physio-Anamnese ist keine Podologie-Anamnese.
 *
 * @returns {Promise<boolean|null>} `true`/`false`, oder `null` = nicht ermittelbar
 *   (Fehler, kein Patient). Der Hinweis erscheint NUR bei `false`.
 */
export async function hatAnamnese(sb, leadId) {
  if (!sb || !leadId) return null;
  try {
    const { data, error } = await sb.from('anamnese').select('id').eq('patient_id', leadId).eq('ist_aktuell', true).eq('fachbereich', 'podo').limit(1);
    if (error) return null;
    return Array.isArray(data) && data.length > 0;
  } catch { return null; }
}

/** Notiz mit Ein-Klick-Link; leerer String, wenn nichts zu sagen ist (Anamnese da oder unbekannt). */
export function anamneseFehltNotizHtml(hat, esc) {
  if (hat !== false) return '';
  return `<div id="podAnamneseFehltNotiz" style="font-size:12px;color:var(--warning-text,var(--text-muted));background:var(--warning-dim,var(--bg-card-solid));border:1px solid var(--warning,var(--border));border-radius:6px;padding:8px 10px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;">
        <span>${esc(ANAMNESE_FEHLT_NOTIZ)}</span>
        <button type="button" id="podAnamneseErfassenBtn" class="btn-ghost" style="padding:3px 10px;font-size:12px;">Anamnese erfassen</button>
      </div>`;
}

/** Fragt das Speichern von 78040 nach der Anamnese? Nur bei bestätigtem `false`. */
export function frageAnamnese78040({ checks, hatAnamnese: hat }) {
  return Array.isArray(checks) && checks.includes(CODE_EINGANGSBEFUNDUNG) && hat === false;
}

/**
 * Soll nach dem Speichern gefragt werden? Nicht, wenn die Verordnung mit
 * dieser Behandlung aufgebraucht ist — dann folgt eine neue Verordnung, kein
 * Folgetermin auf der alten.
 */
export function frageFolgetermin({ alleVerbraucht }) {
  return !alleVerbraucht;
}
