/**
 * sitzung-bindung.js — Sitzungszeilen an einen gerade angelegten Termin binden.
 *
 * Warum es das gibt (Ops-Karte 42a66a3b)
 * ─────────────────────────────────────
 * Beim Speichern der Terminmaske hängte `dashboard.js` die vorgemerkten
 * Sitzungszeilen (`window._pendingRxSession`) an den neuen Termin. Der Fehlerfall
 * stand dort in genau einer Zeile:
 *
 *     if (linkErr) console.error('[rx session link]', linkErr);
 *
 * Danach lief der Ablauf weiter und meldete am Ende `showToast(t('saved'))`.
 * Die Praxis sah „gespeichert", der Termin existierte auch — nur hing keine
 * Einheit daran. Seit dem 17.08.2026 traf das jeden Kombi-Termin: zwei Einheiten
 * derselben Verordnung auf einem Termin verletzten den damaligen Index
 * `uniq_prescription_sessions_booking (prescription_id, booking_id)`, und weil
 * beide Zeilen in EINEM Statement geschrieben wurden (`.in('id', …)`), wurde
 * keine von beiden gebunden. Vier Wochen lang, ohne eine einzige Meldung.
 *
 * Der Index ist seit Migration 0017 um `heilmittel_index` erweitert und lässt
 * den Kombi-Termin zu. Diese Datei ist die zweite Hälfte der Antwort: sie
 * sorgt dafür, dass ein Fehlschlag — aus welchem Grund auch immer — sichtbar
 * wird. Eine Sperre, die man reparieren kann, ist harmlos; eine Sperre, die
 * schweigt, kostet die Abrechnung.
 *
 * Deshalb wird nicht nur `error` geprüft, sondern auch NACHGEZÄHLT. PostgREST
 * meldet keinen Fehler, wenn ein UPDATE null Zeilen trifft — die Zeile kann
 * inzwischen gelöscht, von jemand anderem gebunden oder durch RLS unsichtbar
 * sein. „Kein Fehler" heisst nicht „geschrieben".
 *
 * Kein `status: 'done'` hier. Gebunden heisst geplant; erbracht wird die Einheit
 * erst beim Abhaken (`handleTerminStarten`). Wer das zusammenzieht, baut einen
 * Kalender, der stimmt, und eine Abrechnung, die nicht stattgefunden hat.
 */

import { pruefeTerminVoDatum } from './termin-vo-datum.js?v=20261102a';
import { kuerzelAusKatalog } from './heilmittel-kuerzel.js?v=20261103q';

/**
 * Bindet Sitzungszeilen an einen Termin.
 *
 * @param {object} supabase
 * @param {string} bookingId
 * @param {string[]} sessionIds
 * @param {object} [opt]
 * @param {string|Date} [opt.terminZeit]
 * @param {string|Date} [opt.ausstellungsdatum]
 * @returns {Promise<{ok:boolean, gebunden:number, erwartet:number, fehlend:string[], meldung:string}>}
 */
export async function bindeSitzungenAnTermin(supabase, bookingId, sessionIds, { terminZeit, ausstellungsdatum } = {}) {
  const ids = [...new Set((sessionIds || []).filter(Boolean))];
  const erwartet = ids.length;
  if (!supabase || !bookingId || !erwartet) {
    return { ok: true, gebunden: 0, erwartet: 0, fehlend: [], meldung: '' };
  }

  let tZeit = terminZeit;
  let aDatum = ausstellungsdatum;

  if (!tZeit) {
    try {
      const q = supabase.from('bookings').select('start_time').eq('id', bookingId);
      const res = typeof q?.maybeSingle === 'function' ? await q.maybeSingle() : await q;
      tZeit = res?.data?.start_time;
    } catch (_e) { /* mock / fallback */ }
  }
  if (!aDatum && ids.length) {
    try {
      const qSess = supabase.from('prescription_sessions').select('prescription_id').eq('id', ids[0]);
      const resSess = typeof qSess?.maybeSingle === 'function' ? await qSess.maybeSingle() : await qSess;
      const rxId = resSess?.data?.prescription_id;
      if (rxId) {
        const qRx = supabase.from('prescriptions').select('ausstellungsdatum').eq('id', rxId);
        const resRx = typeof qRx?.maybeSingle === 'function' ? await qRx.maybeSingle() : await qRx;
        aDatum = resRx?.data?.ausstellungsdatum;
      }
    } catch (_e) { /* mock / fallback */ }
  }

  const check = pruefeTerminVoDatum(tZeit, aDatum);
  if (!check.ok) {
    return {
      ok: false,
      gebunden: 0,
      erwartet,
      fehlend: ids,
      meldung: check.fehler,
    };
  }

  let gefundeneSess = [];
  try {
    const qSess = supabase.from('prescription_sessions')
      .select('id, prescription_id, session_number, heilmittel_index, status, booking_id')
      .in('id', ids);
    const resSess = typeof qSess?.maybeSingle === 'function' ? await qSess : (typeof qSess?.then === 'function' ? await qSess : await qSess);
    gefundeneSess = resSess?.data || [];
  } catch (_e) { /* mock / fallback */ }

  if (gefundeneSess.length > 0) {
    for (const s of gefundeneSess) {
      if (s.status === 'done' || s.status === 'completed') {
        return {
          ok: false,
          gebunden: 0,
          erwartet,
          fehlend: ids,
          meldung: 'Bereits erbrachte Sitzungen können keinem neuen Termin zugeordnet werden.',
        };
      }
      if (s.booking_id && s.booking_id !== bookingId) {
        return {
          ok: false,
          gebunden: 0,
          erwartet,
          fehlend: ids,
          meldung: 'Diese Sitzung ist bereits einem anderen Termin zugeordnet.',
        };
      }
    }

    const rxId = gefundeneSess[0].prescription_id;
    if (rxId) {
      let rx = null;
      try {
        const qRx = supabase.from('prescriptions')
          .select('id, anzahl_einheiten, heilmittel_position, heilmittel, heilmittel_items, doppelbehandlung, ausstellungsdatum')
          .eq('id', rxId);
        const resRx = typeof qRx?.maybeSingle === 'function' ? await qRx.maybeSingle() : await qRx;
        rx = resRx?.data || null;
      } catch (_e) { /* mock / fallback */ }

      if (rx) {
        let alleSess = [];
        try {
          const qAll = supabase.from('prescription_sessions')
            .select('id, session_number, heilmittel_index, status, booking_id')
            .eq('prescription_id', rxId);
          const resAll = typeof qAll?.maybeSingle === 'function' ? await qAll : await qAll;
          alleSess = resAll?.data || [];
        } catch (_e) { /* mock / fallback */ }

        for (const s of gefundeneSess) {
          const itIdx = s.heilmittel_index ?? 0;
          const multi = Array.isArray(rx.heilmittel_items) && rx.heilmittel_items.length > 0;
          const item = multi ? rx.heilmittel_items[itIdx] : null;
          const einhRaw = item ? (item.einheiten ?? item.anzahl_einheiten) : rx.anzahl_einheiten;
          const doppel = item ? !!item.doppelbehandlung : !!rx.doppelbehandlung;
          const nEinheiten = parseInt(einhRaw, 10);
          const maxTermine = Number.isFinite(nEinheiten)
            ? (doppel ? Math.ceil(nEinheiten / 2) : nEinheiten)
            : null;
          const kuerzel = item ? kuerzelAusKatalog(item) : (kuerzelAusKatalog(rx.heilmittel_position || rx.heilmittel) || 'Heilmittel');

          if (maxTermine !== null) {
            if ((s.session_number || 0) > maxTermine) {
              return {
                ok: false,
                gebunden: 0,
                erwartet,
                fehlend: ids,
                meldung: `Für dieses Heilmittel (${kuerzel}) sind alle ${maxTermine} Einheiten vergeben. Keine offene Einheit mehr verfügbar.`,
              };
            }
            if (alleSess.length > 0) {
              const belegt = alleSess.filter(other =>
                (other.heilmittel_index ?? 0) === itIdx &&
                other.id !== s.id &&
                other.status !== 'cancelled' &&
                (Boolean(other.booking_id && other.booking_id !== bookingId) || other.status === 'done' || other.status === 'completed')
              ).length;
              if (belegt >= maxTermine) {
                return {
                  ok: false,
                  gebunden: 0,
                  erwartet,
                  fehlend: ids,
                  meldung: `Für dieses Heilmittel (${kuerzel}) sind alle ${maxTermine} Einheiten vergeben. Keine offene Einheit mehr verfügbar.`,
                };
              }
            }
          }
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('prescription_sessions')
    .update({ booking_id: bookingId, status: 'planned' })
    .in('id', ids)
    .select('id');

  if (error) {
    return {
      ok: false, gebunden: 0, erwartet, fehlend: ids,
      meldung: bindungsFehlerText({ erwartet, gebunden: 0, dbMeldung: error.message }),
    };
  }

  const geschrieben = new Set((data || []).map(r => r.id));
  const fehlend = ids.filter(id => !geschrieben.has(id));
  return {
    ok: fehlend.length === 0,
    gebunden: geschrieben.size,
    erwartet,
    fehlend,
    meldung: fehlend.length
      ? bindungsFehlerText({ erwartet, gebunden: geschrieben.size, dbMeldung: '' })
      : '',
  };
}

/**
 * Der Satz, den die Praxis liest. Ausgelagert, damit er prüfbar ist und nicht
 * in drei Varianten im Code herumliegt.
 *
 * Er sagt ausdrücklich, was TROTZDEM passiert ist (der Termin steht) — sonst
 * legt jemand ihn ein zweites Mal an und hat dann zwei.
 */
export function bindungsFehlerText({ erwartet, gebunden, dbMeldung }) {
  const rest = Math.max(0, erwartet - gebunden);
  const kopf = gebunden > 0
    ? `Termin gespeichert, aber nur ${gebunden} von ${erwartet} Einheiten konnten zugeordnet werden`
    : `Termin gespeichert, aber ${rest === 1 ? 'die Einheit' : `die ${rest} Einheiten`} der Verordnung ${rest === 1 ? 'konnte' : 'konnten'} NICHT zugeordnet werden`;
  const schwanz = ' — bitte im Verordnungs-Panel prüfen und von Hand zuordnen.';
  return kopf + schwanz + (dbMeldung ? ` (${dbMeldung})` : '');
}
