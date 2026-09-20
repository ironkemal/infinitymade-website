// Storno einer dokumentierten podologischen Behandlung.
//
// WARUM ES DIESES MODUL GIBT (§302-Echtbetrieb, Schritt 1.5 / Entscheidung K3,
// legal-de 20.09.2026):
//
// Bis zum 20.09.2026 liess sich eine falsch erfasste Behandlung nur auf zwei
// Wegen loswerden: gar nicht (in der Oberflaeche) oder per SQL durch uns.
// Beides ist falsch.
//   • "Gar nicht" heisst: der Irrtum steht in der §302-Datei. In der
//     Kundenbox gibt es niemanden, der ihn per SQL herausnimmt (K10) — der
//     Weg ueber uns existiert dort nicht (onprem O-114).
//   • "Per DELETE" heisst: der urspruengliche Inhalt ist nicht mehr
//     erkennbar. § 630f Abs. 1 S. 2 BGB verlangt das Gegenteil, und BGH
//     VI ZR 84/19 spricht einer Dokumentation, die Aenderungen nicht sichtbar
//     macht, den Beweiswert ab.
//
// Also: Durchstreichen statt Radieren. Die Zeile bleibt, bekommt einen
// Zeitpunkt, eine Person und einen GRUND — und zaehlt ab dann nirgends mehr
// mit (Migration 0026 + `.is('storniert_am', null)` an allen Leseorten).
//
// ⛔ Kein Kulanzfenster ("innerhalb von 5 Minuten loeschbar"). Das waere in
//    § 630f nicht gedeckt und genau der Fall aus BGH VI ZR 84/19.
//
// ⚠️ Das DELETE-Verbot steht in der DATENBANK (Trigger), nicht hier. Dieses
//    Modul ist die Bedienung dazu, nicht die Sperre — eine Regel, die nur im
//    Browser steht, ist keine Regel.
//
// Wer darf: der INHABER. Das kommt nicht aus diesem Modul, sondern aus der
// RLS-Policy `owner_behandlungen` (USING owner_id = auth.uid()); Angestellte
// haben auf dieser Tabelle nur SELECT. Ein Storno ist eine Belegentscheidung.

/** Mindestlaenge des Grundes. Kuerzer ist keine Begruendung, sondern ein Haken. */
const GRUND_MIN = 3;
const GRUND_MAX = 500;

/**
 * Kann diese Zeile storniert werden? Reine Funktion — testbar ohne DOM und
 * ohne Datenbank, und genau das ist der Punkt: die drei Faelle unten sind die
 * einzigen, die der Bildschirm unterscheiden muss.
 *
 * @param {object} beh  Zeile aus `podologie_behandlungen`
 * @returns {{ erlaubt: boolean, grund: string, text: string }}
 *   `grund`: '' | 'bereits_storniert' | 'auf_rechnung'
 */
export function darfStornieren(beh) {
  if (!beh || !beh.id) {
    return { erlaubt: false, grund: 'keine_zeile', text: 'Keine Behandlung ausgewählt.' };
  }
  if (beh.storniert_am) {
    return { erlaubt: false, grund: 'bereits_storniert', text: 'Diese Behandlung ist bereits storniert.' };
  }
  if (beh.invoice_id) {
    // Bewusst kein Durchgriff: die Behandlung steht auf einer Rechnung, und
    // eine Rechnung ist nach GoBD selbst unveraenderlich. Zuerst die Rechnung
    // stornieren (das loest die Verknuepfung, module/rechnung-bruecke.js
    // `verknuepfungLoesen`), danach diese Zeile.
    return {
      erlaubt: false,
      grund: 'auf_rechnung',
      text: 'Diese Behandlung steht bereits auf einer Rechnung. Bitte zuerst die Rechnung stornieren — danach lässt sich die Behandlung stornieren.',
    };
  }
  return { erlaubt: true, grund: '', text: '' };
}

/** Grund auf ein speicherbares Mass bringen. `null` = unbrauchbar. */
export function grundPruefen(roh) {
  const g = String(roh ?? '').trim();
  if (g.length < GRUND_MIN) return null;
  return g.slice(0, GRUND_MAX);
}

/**
 * Storniert eine Behandlung. Fragt vorher nach dem Grund.
 *
 * @param {object} ctx  { supabase, getOwnerId, getSessionUserId, showInputModal, showToast }
 * @param {object} beh  die Zeile (braucht id, invoice_id, storniert_am, behandlungsdatum)
 * @returns {Promise<{ ok: boolean, abgebrochen?: boolean, fehler?: string }>}
 */
export async function behandlungStornieren(ctx, beh) {
  const lage = darfStornieren(beh);
  if (!lage.erlaubt) {
    ctx.showToast?.(lage.text, 'error');
    return { ok: false, fehler: lage.grund };
  }

  const datum = beh.behandlungsdatum
    ? new Date(beh.behandlungsdatum).toLocaleDateString('de-DE')
    : '—';

  const eingabe = await ctx.showInputModal?.({
    title:       'Behandlung stornieren',
    // Der Text sagt ausdruecklich, dass nichts verschwindet. Sonst klickt
    // niemand auf "Stornieren", wenn er "Loeschen" sucht — und der Irrtum
    // bleibt in der Datei stehen.
    message:     `Behandlung vom ${datum} stornieren. Die Zeile bleibt in der Dokumentation sichtbar (durchgestrichen) `
               + `und zählt ab dann nicht mehr — weder für die Einheiten noch für die Abrechnung. `
               + `Rückgängig machen lässt sich eine Stornierung nicht.`,
    inputLabel:  'Grund der Stornierung',
    inputPlaceholder: 'z. B. falsches Datum erfasst, Behandlung fand nicht statt',
    confirmText: 'Stornieren',
    variant:     'danger',
  });

  if (eingabe === null || eingabe === undefined || eingabe === false) {
    return { ok: false, abgebrochen: true };
  }

  const grund = grundPruefen(eingabe);
  if (!grund) {
    // Der Grund IST die Anforderung aus § 630f ("warum/wann erkennbar"),
    // nicht eine Formalie davor.
    ctx.showToast?.('Ohne Grund lässt sich nicht stornieren — bitte kurz beschreiben, was nicht stimmte.', 'error');
    return { ok: false, fehler: 'grund_fehlt' };
  }

  const { error, data } = await ctx.supabase
    .from('podologie_behandlungen')
    .update({
      storniert_am:  new Date().toISOString(),
      storniert_von: ctx.getSessionUserId?.() || null,
      storno_grund:  grund,
    })
    .eq('id', beh.id)
    .eq('owner_id', ctx.getOwnerId())
    // Wettlauf-Schutz: zwei offene Fenster, zweimal geklickt. Der Trigger
    // wuerde den zweiten Versuch ohnehin abweisen, aber hier bleibt die
    // Meldung verstaendlich statt eine Datenbankausnahme zu zeigen.
    .is('storniert_am', null)
    .select('id');

  if (error) {
    console.error('[podo-storno]', error);
    return { ok: false, fehler: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, fehler: 'Die Behandlung wurde inzwischen von jemand anderem storniert.' };
  }

  ctx.showToast?.('Behandlung storniert — die Zeile bleibt durchgestrichen stehen.', 'info');
  return { ok: true };
}
