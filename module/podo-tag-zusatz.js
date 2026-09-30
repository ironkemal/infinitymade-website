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
    const von = new Date(`${datum}T00:00:00`);
    const bis = new Date(von.getFullYear(), von.getMonth(), von.getDate() + 1);
    const { data } = await sb.from('bookings').select('*')
      .eq('owner_id', ownerId).eq('verordnung_id', vordId)
      .neq('status', 'cancelled')
      .gte('start_time', von.toISOString()).lt('start_time', bis.toISOString())
      .order('start_time', { ascending: true }).limit(1);
    return data?.[0] || null;
  } catch { return null; }
}

/**
 * Soll nach dem Speichern gefragt werden? Nicht, wenn die Verordnung mit
 * dieser Behandlung aufgebraucht ist — dann folgt eine neue Verordnung, kein
 * Folgetermin auf der alten.
 */
export function frageFolgetermin({ alleVerbraucht }) {
  return !alleVerbraucht;
}
