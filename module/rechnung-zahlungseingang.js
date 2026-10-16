/**
 * rechnung-zahlungseingang.js — „Zahlungseingang verbuchen" für eine Rechnung.
 *
 * Was hier passiert und was nicht
 * ───────────────────────────────
 * Dieses Modul stellt den Dialog und rechnet die Vorschau. **Gebucht wird
 * serverseitig**, in einer einzigen Transaktion (RPC `rechnung_zahlung_buchen`,
 * aufgerufen über `POST /api/billing/rechnungen/:id/zahlung`). Der Rechenkern
 * hier ist die Anzeige, nicht die Wahrheit — dieselbe Prüfung läuft nochmal in
 * der Datenbank, dort mit Zeilensperre gegen zwei gleichzeitige Buchungen.
 *
 * Warum ein eigenes Modul neben `rechnung-zahlung.js`
 * ──────────────────────────────────────────────────
 * `rechnung-zahlung.js` beantwortet beim Speichern die Frage „wurde das schon
 * bezahlt?" und hat dafür eine bewusst enge Zuständigkeit (Beta-2, 12.08.2026:
 * dieselbe Zahlung wurde zweimal erfasst). Dieser Dialog ist etwas anderes: ein
 * späterer Zahlungseingang auf eine offene Rechnung, mit Gegenkonto und
 * Restbetrag-Behandlung. Die beiden nicht vermischen.
 *
 * ⚠️ Zwei Verdrahtungsregeln, die hier als Code stehen statt als Kommentar
 * ──────────────────────────────────────────────────────────────────────
 * Untersucht am 08.09.2026. Beide würden sonst den Bug wiederholen, den
 * `rechnung-zahlung.js` behoben hat — „bezahlt, trotzdem gemahnt":
 *
 *   1. `belegTypFuer()` — hängt die Rechnung an einem Rezept, wird die
 *      Beleg-Zeile als `zuzahlung` gebucht, nicht als `rechnung`.
 *      Mahnwesen (`mahnwesen.routes.js`) und Statistik filtern auf
 *      `type IN ('zuzahlung','storno')` und würden eine `rechnung`-Zeile
 *      übersehen. Der Typ beschreibt den Geschäftsvorfall, nicht den
 *      Erfassungsweg.
 *   2. `ausbuchungUeberKorrektur()` — eine Ausbuchung erzeugt keinen
 *      Beleg (kein Geldfluss). Bei einer rezeptgebundenen Rechnung
 *      bliebe der Saldo damit unter dem Soll und es würde weiter gemahnt.
 *      Deshalb läuft sie dort über den bestehenden Korrekturpfad
 *      (`zuzahlung_korrekturen`), nicht über dieses Ledger.
 *
 * ⚠️ Seit 08.09.2026 (Ops #271): `belegliste` ist ein Belegjournal, kein
 * reines Bar-Kassenbuch — jede `art='zahlung'`-Buchung erzeugt jetzt einen
 * Beleg, nicht mehr nur Bar (Konto `1000`). Das Gegenkonto-Feld zeigt deshalb
 * nur noch Zahlungskonten (`istZahlungskategorie()`) — Erlösschmälerung/
 * Teilabsetzung sind reine Ausbuchungskonten und bleiben dem zweiten
 * Dropdown vorbehalten.
 */

import {
  aktiveKonten, kontoAnzeige, istZahlungskategorie,
  AUSBUCHUNGSKONTO_STANDARD,
} from './buchungskonten.js?v=20260909';
import { frageZahlungsstatus } from './rechnung-zahlung.js?v=20261010w';
import { alsISODatum } from './datum.js?v=20261001a';

/**
 * Modulweiter Zustand für Rechnungen mit unbestätigter Buchungslage (K4 Finanzsicherheit).
 * Sobald ein Buchungs-POST losgetreten wurde und unklar endet (Timeout, Abort, Netzwerkabbruch,
 * Server-5xx oder unlesbare/ungültige Antwort), wird die Rechnung fail-closed gesperrt.
 * Reopen/Schließen reaktiviert den Buchen-Knopf NICHT.
 */
const unbestaetigteRechnungen = new Map();
const laufendeBuchungen = new Set();

export const UNGEWISSER_BUCHUNGS_HINWEIS =
  'Der Status der Buchung ist unklar (z. B. Zeitüberschreitung, Netzwerk- oder Serverfehler). '
  + 'Eine erneute Buchung ist gesperrt, um doppelte Zahlungen zu verhindern. '
  + 'Bitte prüfen Sie das Belegjournal, bevor Sie eine weitere Buchung vornehmen.';

const LOCK_PREFIX = 'praxura:zahlung_lock:';

function holePersistiertenLock(rechnungId) {
  if (!rechnungId) return null;
  try {
    if (typeof localStorage === 'undefined') return { status: 'uncertain' };
    const raw = localStorage.getItem(LOCK_PREFIX + rechnungId);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.invoice_id === String(rechnungId)
      && ['in_flight', 'uncertain'].includes(parsed.status)) return parsed;
  } catch {}
  // Unlesbare Sperren dürfen keinen erneuten Buchungsversuch freigeben.
  return { status: 'uncertain' };
}

function speicherePersistiertenLock(rechnungId, status) {
  if (!rechnungId) return;
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage nicht verfügbar');
  }
  // Nur invoiceUUID und status — KEIN Patient, KEIN Betrag, KEIN PHI!
  localStorage.setItem(LOCK_PREFIX + rechnungId, JSON.stringify({
    invoice_id: String(rechnungId),
    status: String(status),
    ts: Date.now(),
  }));
}

function loeschePersistiertenLock(rechnungId) {
  if (!rechnungId) return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCK_PREFIX + rechnungId);
    }
  } catch {}
}

export function istZahlungUnklar(invoiceId) {
  const id = String(invoiceId || '');
  if (!id) return false;
  if (unbestaetigteRechnungen.has(id)) return true;
  const lock = holePersistiertenLock(id);
  return Boolean(lock && (lock.status === 'uncertain' || lock.status === 'in_flight'));
}

/** Beträge werden in Cent verglichen — `numeric(10,2)` kennt keine Rundungsreste. */
const cent = (v) => Math.round((Number(v) || 0) * 100);
const euro = (c) => Math.round(c) / 100;

/** Was ist auf dieser Rechnung noch offen? */
export function offenerBetrag({ rechnungsbetrag, bereitsGebucht = 0 }) {
  return euro(cent(rechnungsbetrag) - cent(bereitsGebucht));
}

/**
 * Der Kassenbuch-Typ für die Bar-Brücke. Siehe Regel 1 im Dateikopf.
 * @param {boolean} hatRezeptbezug  invoices.prescription_id ODER verordnung_id gesetzt
 */
export function belegTypFuer(hatRezeptbezug) {
  return hatRezeptbezug ? 'zuzahlung' : 'rechnung';
}

/**
 * Erzeugt diese Zahlung einen Beleg im Journal? Seit Ops #271 (08.09.2026)
 * bei JEDER Zahlart — die Funktion bleibt als Begriffserklärung stehen, damit
 * der Aufrufer nicht selbst raten muss, aber sie ist keine Fallunterscheidung
 * mehr. Nur die Ausbuchung (kein Geldfluss) bleibt ohne Beleg, siehe Regel 2.
 */
export function erzeugtKassenbuchBeleg() {
  return true;
}

/** Ausbuchung auf eine rezeptgebundene Forderung läuft über die Zuzahlungskorrektur. */
export function ausbuchungUeberKorrektur(hatRezeptbezug) {
  return !!hatRezeptbezug;
}

/**
 * Prüft die Eingabe und sagt, was gebucht würde. Rein — keine DB, kein DOM.
 *
 * Überzahlung ist ein harter Fehler, kein Guthaben: „mehr als die Rechnung" im
 * Moment der Erfassung ist ein Tippfehler. (Das echte Guthaben-Verfahren
 * `zuzahlung_guthaben` löst eine andere Lage — Patient zahlt für sechs
 * Einheiten und bricht nach drei ab.)
 *
 * @returns {{ok: true, offenVorher: number, restbetrag: number,
 *            buchungen: Array<{art: string, betrag_eur: number, gegenkonto_code: string}>,
 *            neuerStatus: string, kassenbuchBeleg: boolean, ueberKorrektur: boolean}
 *          | {ok: false, fehler: string}}
 */
export function planeZahlung({
  rechnungsbetrag,
  bereitsGebucht = 0,
  eingegangen,
  restbetragModus = 'offen_lassen',
  gegenkontoCode,
  ausbuchungskontoCode = AUSBUCHUNGSKONTO_STANDARD,
  hatRezeptbezug = false,
} = {}) {
  const betrag = Number(rechnungsbetrag);
  if (!Number.isFinite(betrag) || betrag <= 0) {
    return { ok: false, fehler: 'Die Rechnung hat keinen Betrag — bitte zuerst die Rechnung prüfen.' };
  }
  if (!gegenkontoCode) {
    return { ok: false, fehler: 'Bitte ein Gegenkonto auswählen.' };
  }

  const eingang = Number(eingegangen);
  if (!Number.isFinite(eingang) || cent(eingang) <= 0) {
    return { ok: false, fehler: 'Der eingegangene Betrag muss über 0 € liegen.' };
  }

  const offenC = cent(betrag) - cent(bereitsGebucht);
  if (offenC <= 0) {
    return { ok: false, fehler: 'Auf diese Rechnung ist bereits alles gebucht.' };
  }
  if (cent(eingang) > offenC) {
    return { ok: false, fehler: `Mehr als offen: es stehen noch ${euro(offenC).toFixed(2).replace('.', ',')} € aus.` };
  }

  const restC = offenC - cent(eingang);
  const ausbuchen = restbetragModus === 'ausbuchen' && restC > 0;

  // Regel 2 aus dem Dateikopf: eine rezeptgebundene Forderung wird über die
  // Zuzahlungskorrektur reduziert, nicht hier. Der bestehende Weg protokolliert
  // GoBD-fest, kennt Guthaben und Gründe — ihn hier nachzubauen wäre der zweite
  // Weg, dieselbe Forderung kleinzurechnen. Genau das soll es nicht geben.
  if (ausbuchen && ausbuchungUeberKorrektur(hatRezeptbezug)) {
    return {
      ok: false,
      fehler: 'Diese Rechnung hängt an einem Rezept. Den Restbetrag über „Zuzahlung korrigieren" '
        + 'reduzieren — nur dort wird die Forderung sauber protokolliert. Hier den Rest offen lassen.',
    };
  }

  const buchungen = [
    { art: 'zahlung', betrag_eur: euro(cent(eingang)), gegenkonto_code: String(gegenkontoCode) },
  ];
  if (ausbuchen) {
    buchungen.push({
      art: 'ausbuchung',
      betrag_eur: euro(restC),
      gegenkonto_code: String(ausbuchungskontoCode || AUSBUCHUNGSKONTO_STANDARD),
    });
  }

  return {
    ok: true,
    offenVorher: euro(offenC),
    restbetrag: euro(restC),
    buchungen,
    neuerStatus: (restC === 0 || ausbuchen) ? 'paid' : 'partial',
    kassenbuchBeleg: erzeugtKassenbuchBeleg(),
  };
}

// ── Dialog ──────────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const eur = (v) => (Number(v) || 0).toFixed(2).replace('.', ',') + ' €';

/**
 * Einstiegspunkt direkt nach dem Speichern einer Rechnung (Ops #271,
 * 08.09.2026). Verzweigt EINMAL nach Rezeptbezug, damit `dashboard.js` diese
 * Entscheidung nicht selbst treffen muss:
 *   - Rezept (ggf. offene Zuzahlung) -> `frageZahlungsstatus()` — der
 *     bestehende Kassieren-Ablauf bleibt zuständig, keine zweite Frage.
 *   - kein Rezept (Privatrechnung/Selbstzahler) -> dieser Ledger-Dialog,
 *     Gegenkonto Bar/Karte/Überweisung/PayPal.
 * Ersetzt den alten Bezahlt/Nicht-bezahlt-Dialog aus `rechnung-zahlung.js`
 * (dessen Fall 3 schrieb `payment_status='paid'` ohne Ledger-Zeile — genau
 * das lehnt `rechnung_zahlung_buchen()` seither ab).
 *
 * @param {object} opts
 * @param {string} opts.invoiceId
 * @param {boolean} opts.hatRezeptbezug  invoices.prescription_id ODER verordnung_id gesetzt
 * @param {string|null} [opts.prescriptionId]
 * @param {string|null} [opts.patientId]
 * @param {string} [opts.patientName]
 * @param {object} opts.supabase
 * @param {string} opts.apiBasis
 * @param {object} opts.profile
 * @param {Function} opts.showToast
 * @param {Function} opts.kassiere  siehe frageZahlungsstatus()
 * @param {Function} opts.token    async () => access_token
 */
export async function zahlungsartNachRechnungAbfragen({
  invoiceId, hatRezeptbezug, prescriptionId = null, patientId = null, patientName = '',
  supabase, apiBasis, profile, showToast, kassiere, token,
}) {
  if (hatRezeptbezug) {
    const r = await frageZahlungsstatus(invoiceId, {
      supabase, prescriptionId, patientId, patientName, kassiere, toast: showToast,
    });
    // Verordnung ohne Zuzahlungsfall (Podologie Privat/BG): wie eine Rechnung ohne Rezept (canli-test 10.10.2026 P2).
    if (r !== 'ohne_zuzahlungsfall') return r;
  }
  return starteZahlungseingang({ invoiceId, apiBasis, profile, showToast, token });
}

/**
 * Einstiegspunkt: Zahlungsstand laden, dann den Dialog öffnen.
 *
 * Der Stand kommt bewusst vom Server und nicht aus dem Listen-Cache: `offen`
 * ist die Summe des Ledgers, und die kann sich geändert haben, seit die Liste
 * geladen wurde (zweiter Arbeitsplatz, zweiter Tab).
 *
 * @returns {Promise<boolean>} true, wenn gebucht wurde
 */
export async function starteZahlungseingang({ invoiceId, apiBasis, token, profile, showToast }) {
  let stand;
  // Ops #293: kein Timeout hing hier hängen lassen, wenn das Backend nicht
  // antwortet — dieselbe Absicherung wie module/podologie-positionen.js:80f.
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 8000);
  try {
    const jwt = await token();
    const res = await fetch(`${apiBasis}/billing/rechnungen/${invoiceId}/zahlungen`, {
      headers: { 'Authorization': 'Bearer ' + jwt },
      signal: abbruch.signal,
    });
    stand = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(stand.error || `Serverfehler (${res.status})`);
  } catch (e) {
    console.error('[zahlungseingang] laden:', e);
    showToast('Zahlungsstand konnte nicht geladen werden: ' + (e.name === 'AbortError' ? 'Zeitüberschreitung — bitte erneut versuchen.' : e.message), 'error');
    return false;
  } finally {
    clearTimeout(uhr);
  }

  return oeffneZahlungseingang({
    rechnung: { ...stand.rechnung, id: invoiceId },
    bereitsGebucht: stand.bereits_gebucht || 0,
    // Vom Server, bereits korrekt auf den Tenant aufgelöst (Angestellte haben
    // keinen eigenen Kontenrahmen, ihrer wäre sonst leer/falsch — Ops #271,
    // 08.09.2026, gefunden bei der Bestandsaufnahme zu #271).
    konten: stand.konten,
    profile,
    apiBasis,
    token,
    showToast,
  });
}

/**
 * Öffnet den Dialog und bucht bei Bestätigung über das Backend.
 *
 * @param {object} opts
 * @param {object} opts.rechnung        Zeile aus `invoices` (id, total_patient, invoice_number, …)
 * @param {number} opts.bereitsGebucht  Summe der bisherigen Zahlungen (vom Server)
 * @param {Array}  [opts.konten]        Kontenrahmen vom Server (bevorzugt — schon auf den
 *                                      richtigen Tenant aufgelöst). Ohne das: Fallback auf
 *                                      `profile` (nur für Aufrufer ohne Server-Roundtrip).
 * @param {object} [opts.profile]       currentProfile — Fallback-Kontenrahmen, siehe oben
 * @param {string} opts.apiBasis        z. B. `${API}`
 * @param {Function} opts.token         async () => access_token
 * @param {Function} opts.showToast
 * @returns {Promise<boolean>} true, wenn gebucht wurde
 */
export function oeffneZahlungseingang(opts) {
  const {
    rechnung, bereitsGebucht = 0, konten: kontenVomServer, profile, apiBasis, token, showToast,
  } = opts;

  const konten = Array.isArray(kontenVomServer) ? kontenVomServer : aktiveKonten(profile);
  // Gegenkonto (Zahlung) zeigt nur Zahlungskonten — Erlösschmälerung/
  // Teilabsetzung gehören ins Ausbuchungs-Feld, nie hierher (Ops #271).
  // Kein eigenes UI-Element für die geforderte Bar/Karte/Überweisung/PayPal-
  // Abfrage nötig: bei Standardrahmen sind das genau diese vier Optionen.
  const zahlungskonten = konten.filter(k => istZahlungskategorie(k.kategorie));
  // Der Server liefert `hat_rezeptbezug` bereits ausgewertet (er kennt beide
  // Spalten — prescription_id für Physio/Ergo/Logo, verordnung_id für
  // Podologie). Die Einzelspalten bleiben als Rückfall, falls der Dialog
  // einmal direkt aus einem Listeneintrag geöffnet wird.
  const hatRezeptbezug = rechnung?.hat_rezeptbezug != null
    ? !!rechnung.hat_rezeptbezug
    : !!(rechnung?.prescription_id || rechnung?.verordnung_id);
  const rechnungsbetrag = Number(rechnung?.total_patient) || 0;
  const offen = offenerBetrag({ rechnungsbetrag, bereitsGebucht });

  const rechnungId = String(rechnung?.id || opts.invoiceId || '');

  // 1. Wenn aktuell irgendeine Buchung in-flight ist: existierenden Dialog nicht zerstören!
  if (laufendeBuchungen.size > 0) {
    if (typeof showToast === 'function') {
      showToast('Eine Buchung wird bereits verarbeitet. Bitte warten.', 'error');
    }
    return Promise.resolve(false);
  }

  // 2. Existierendes Modal im DOM prüfen: nicht zerstören, falls in-flight
  const altesModal = typeof document !== 'undefined' ? document.getElementById('_zeModal') : null;
  if (altesModal) {
    if (altesModal.dataset?.submitting === 'true') {
      return Promise.resolve(false);
    }
    altesModal.remove();
  }

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.id = '_zeModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10001;'
      + 'display:flex;align-items:center;justify-content:center;padding:16px;';

    const feld = 'width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;'
      + 'background:var(--bg-input,var(--bg-card));color:var(--text-main);font-size:13px;font-family:inherit;';
    const label = 'margin-bottom:4px;color:var(--text-muted);font-size:12px;';
    const zeile = 'display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:2px 0;';

    // Gegenkonto: nur Zahlungskonten (Bar/Karte/Überweisung/PayPal, #271).
    const zahlungskontoOptionen = zahlungskonten
      .map(k => `<option value="${esc(k.code)}">${esc(kontoAnzeige(k))}</option>`).join('');
    // Ausbuchen: weiterhin alle aktiven Konten — dort gehören Erlösschmälerung
    // und Teilabsetzung hin.
    const ausbuchungskontoOptionen = konten
      .map(k => `<option value="${esc(k.code)}">${esc(kontoAnzeige(k))}</option>`).join('');

    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="_zeTitle"
        style="background:var(--bg-card-solid);border:1px solid var(--border);border-radius:12px;
               padding:24px;max-width:460px;width:100%;color:var(--text-main);font-family:inherit;
               max-height:90vh;overflow-y:auto;">
        <div id="_zeTitle" style="font-size:15px;font-weight:700;margin-bottom:2px;">Zahlungseingang verbuchen</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">
          ${esc(rechnung?.invoice_number || '')} · ${esc(rechnung?.patient_name || '')}
        </div>

        <div style="background:var(--bg-input,var(--bg-card));border:1px solid var(--border);
                    border-radius:8px;padding:10px 12px;margin-bottom:16px;">
          <div style="${zeile}"><span style="color:var(--text-muted);">Rechnungsbetrag</span>
            <span style="font-weight:600;">${esc(eur(rechnungsbetrag))}</span></div>
          <div style="${zeile}"><span style="color:var(--text-muted);">Bereits gebucht</span>
            <span style="font-weight:600;">${esc(eur(bereitsGebucht))}</span></div>
          <div style="${zeile}"><span style="color:var(--text-muted);">Offen</span>
            <span style="font-weight:700;">${esc(eur(offen))}</span></div>
        </div>

        <div style="display:grid;gap:12px;">
          <label style="display:block;">
            <div style="${label}">Eingegangener Betrag</div>
            <input id="_zeBetrag" type="number" min="0" step="0.01" value="${offen.toFixed(2)}" style="${feld}">
          </label>

          <label style="display:block;">
            <div style="${label}">Zahlungsdatum</div>
            <input id="_zeDatum" type="date" value="${alsISODatum(new Date())}" style="${feld}">
          </label>

          <label style="display:block;">
            <div style="${label}">Zahlungsart</div>
            <select id="_zeKonto" style="${feld}">${zahlungskontoOptionen}</select>
          </label>

          <div id="_zeRestWrap" style="display:none;border:1px solid var(--border);border-radius:8px;
               padding:10px 12px;background:var(--bg-input,var(--bg-card));">
            <div style="${zeile}"><span style="color:var(--text-muted);">Restbetrag</span>
              <span id="_zeRest" style="font-weight:700;">—</span></div>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-top:8px;">
              <input id="_zeOffenLassen" type="radio" name="_zeRestModus" value="offen_lassen" checked>
              Restbetrag offen lassen
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-top:4px;">
              <input id="_zeAusbuchen" type="radio" name="_zeRestModus" value="ausbuchen">
              Forderung tilgen, Differenz ausbuchen
            </label>
            <label id="_zeAusKontoWrap" style="display:none;margin-top:8px;">
              <div style="${label}">Ausbuchen auf</div>
              <select id="_zeAusKonto" style="${feld}">${ausbuchungskontoOptionen}</select>
            </label>
          </div>

          <div id="_zeHinweis" style="display:none;font-size:11px;color:var(--text-muted);"></div>
          <div id="_zeFehler" style="display:none;font-size:12px;color:var(--danger,#dc2626);"></div>

          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
            <button type="button" id="_zeAbbrechen" class="btn-ghost">Abbrechen</button>
            <button type="button" id="_zeBuchen" class="btn-primary">Buchen</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const $ = (id) => overlay.querySelector('#' + id);
    const betragEl = $('_zeBetrag');
    const datumEl = $('_zeDatum');
    const kontoEl = $('_zeKonto');
    const ausKontoEl = $('_zeAusKonto');
    const restWrap = $('_zeRestWrap');
    const restEl = $('_zeRest');
    const ausKontoWrap = $('_zeAusKontoWrap');
    const hinweisEl = $('_zeHinweis');
    const fehlerEl = $('_zeFehler');
    const abbrechenBtn = $('_zeAbbrechen');
    const buchenBtn = $('_zeBuchen');

    const rechnungId = String(rechnung?.id || opts.invoiceId || '');
    let dialogZustand = 'idle'; // 'idle' | 'submitting' | 'uncertain' | 'success'
    let geschlossen = false;

    if (ausKontoEl) ausKontoEl.value = AUSBUCHUNGSKONTO_STANDARD;

    function modus() {
      return overlay.querySelector('input[name="_zeRestModus"]:checked')?.value || 'offen_lassen';
    }

    function setzeSteuerelementeGesperrt(gesperrt) {
      if (betragEl) betragEl.disabled = gesperrt;
      if (datumEl) datumEl.disabled = gesperrt;
      if (kontoEl) kontoEl.disabled = gesperrt;
      if (ausKontoEl) ausKontoEl.disabled = gesperrt;
      overlay.querySelectorAll('input[name="_zeRestModus"]').forEach(r => {
        r.disabled = gesperrt;
      });
      if (abbrechenBtn) abbrechenBtn.disabled = gesperrt;
      if (buchenBtn) buchenBtn.disabled = gesperrt;
    }

    function wechsleZuUnbestaetigt(nachricht = UNGEWISSER_BUCHUNGS_HINWEIS) {
      dialogZustand = 'uncertain';
      overlay.dataset.submitting = 'false';
      if (rechnungId) {
        unbestaetigteRechnungen.set(rechnungId, nachricht);
        try { speicherePersistiertenLock(rechnungId, 'uncertain'); } catch {}
        laufendeBuchungen.delete(rechnungId);
      }
      setzeSteuerelementeGesperrt(true);
      if (abbrechenBtn) {
        abbrechenBtn.disabled = false;
        abbrechenBtn.textContent = 'Schließen';
      }
      if (buchenBtn) {
        buchenBtn.disabled = true;
        buchenBtn.textContent = 'Buchung unklar';
      }
      if (fehlerEl) {
        fehlerEl.textContent = nachricht;
        fehlerEl.style.display = '';
      }
    }

    function aktualisiere() {
      if (dialogZustand !== 'idle') return;

      const plan = planeZahlung({
        rechnungsbetrag, bereitsGebucht,
        eingegangen: betragEl?.value,
        restbetragModus: modus(),
        gegenkontoCode: kontoEl?.value,
        ausbuchungskontoCode: ausKontoEl?.value,
        hatRezeptbezug,
      });

      if (!plan.ok) {
        fehlerEl.textContent = plan.fehler;
        fehlerEl.style.display = '';
        buchenBtn.disabled = true;
        restWrap.style.display = 'none';
        hinweisEl.style.display = 'none';
        return;
      }

      fehlerEl.style.display = 'none';
      buchenBtn.disabled = false;

      const hatRest = plan.restbetrag > 0;
      restWrap.style.display = hatRest ? '' : 'none';
      if (hatRest) restEl.textContent = eur(plan.restbetrag);
      ausKontoWrap.style.display = (hatRest && modus() === 'ausbuchen') ? '' : 'none';

      const hinweise = [];
      if (plan.kassenbuchBeleg) hinweise.push('Es entsteht ein Beleg im Belegjournal.');
      hinweisEl.textContent = hinweise.join(' ');
      hinweisEl.style.display = hinweise.length ? '' : 'none';
    }

    betragEl?.addEventListener('input', aktualisiere);
    datumEl?.addEventListener('change', aktualisiere);
    kontoEl?.addEventListener('change', aktualisiere);
    ausKontoEl?.addEventListener('change', aktualisiere);
    overlay.querySelectorAll('input[name="_zeRestModus"]').forEach(r =>
      r.addEventListener('change', aktualisiere));

    function schliessen(ergebnis) {
      if (dialogZustand === 'submitting') return;
      if (geschlossen) return;
      geschlossen = true;
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('keydown', onKeyDown);
      }
      overlay.remove();
      resolve(Boolean(ergebnis));
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (dialogZustand === 'submitting') {
          e.preventDefault?.();
          return;
        }
        schliessen(false);
      }
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', onKeyDown);
    }

    abbrechenBtn?.addEventListener('click', () => {
      if (dialogZustand === 'submitting') return;
      schliessen(false);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (dialogZustand === 'submitting') return;
        schliessen(false);
      }
    });

    buchenBtn?.addEventListener('click', async () => {
      if (dialogZustand !== 'idle') return;
      if (rechnungId && istZahlungUnklar(rechnungId)) {
        wechsleZuUnbestaetigt(unbestaetigteRechnungen.get(rechnungId));
        return;
      }
      if (rechnungId && laufendeBuchungen.has(rechnungId)) {
        return;
      }

      // 1. Snapshot aller Eingaben VOR jeglichem await einfrieren
      const eingegangenRaw = betragEl?.value;
      const datumRaw = datumEl?.value || null;
      const gegenkontoRaw = kontoEl?.value;
      const restModusRaw = modus();
      const ausKontoRaw = ausKontoEl?.value || AUSBUCHUNGSKONTO_STANDARD;

      const plan = planeZahlung({
        rechnungsbetrag, bereitsGebucht,
        eingegangen: eingegangenRaw,
        restbetragModus: restModusRaw,
        gegenkontoCode: gegenkontoRaw,
        ausbuchungskontoCode: ausKontoRaw,
        hatRezeptbezug,
      });

      if (!plan.ok) {
        fehlerEl.textContent = plan.fehler;
        fehlerEl.style.display = '';
        buchenBtn.disabled = true;
        return;
      }

      const snapshot = Object.freeze({
        eingegangener_betrag: plan.buchungen[0].betrag_eur,
        zahlungsdatum: datumRaw,
        gegenkonto_code: gegenkontoRaw,
        restbetrag_modus: restModusRaw,
        ausbuchungskonto_code: ausKontoRaw,
      });

      // 2. In-flight Zustand aktivieren und Interaktionen sperren
      dialogZustand = 'submitting';
      overlay.dataset.submitting = 'true';
      if (rechnungId) laufendeBuchungen.add(rechnungId);
      setzeSteuerelementeGesperrt(true);
      buchenBtn.textContent = '…';
      fehlerEl.style.display = 'none';

      // 3. Token vor POST anfordern mit strikter 8s-Frist (späteres Auflösen darf niemals POST senden)
      let jwt;
      let tokenAbgelaufen = false;
      const tokenAbbruch = new AbortController();
      const tokenUhr = setTimeout(() => {
        tokenAbgelaufen = true;
        tokenAbbruch.abort();
      }, 8000);

      try {
        const tokenP = Promise.resolve().then(() => token({ signal: tokenAbbruch.signal }));
        const timeoutP = new Promise((_, reject) => {
          tokenAbbruch.signal.addEventListener('abort', () => {
            reject(new Error('Zeitüberschreitung beim Abrufen des Authentifizierungs-Tokens.'));
          });
        });

        jwt = await Promise.race([tokenP, timeoutP]);
        clearTimeout(tokenUhr);

        if (tokenAbgelaufen || !jwt) {
          throw new Error(tokenAbgelaufen
            ? 'Zeitüberschreitung beim Abrufen des Authentifizierungs-Tokens.'
            : 'Kein Sitzungstoken vorhanden.');
        }
      } catch (tokenFehler) {
        clearTimeout(tokenUhr);
        console.error('[zahlungseingang] Sitzung konnte vor der Buchung nicht bestätigt werden.');
        dialogZustand = 'idle';
        overlay.dataset.submitting = 'false';
        if (rechnungId) laufendeBuchungen.delete(rechnungId);
        setzeSteuerelementeGesperrt(false);
        buchenBtn.textContent = 'Buchen';
        fehlerEl.textContent = 'Sitzung konnte vor der Buchung nicht bestätigt werden. Bitte erneut anmelden.';
        fehlerEl.style.display = '';
        aktualisiere();
        return;
      }

      try {
        speicherePersistiertenLock(rechnungId, 'in_flight');
      } catch {
        wechsleZuUnbestaetigt('Buchung nicht gesendet: Zahlungssperre konnte nicht gespeichert werden. Bitte Browserspeicher prüfen.');
        return;
      }

      // 4. POST und vollständiges Parsen der Antwort unter EINEM Timeout (8s)
      const postAbbruch = new AbortController();
      const postUhr = setTimeout(() => postAbbruch.abort(), 8000);
      let res;
      let json;

      try {
        res = await fetch(`${apiBasis}/billing/rechnungen/${rechnungId}/zahlung`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
          signal: postAbbruch.signal,
        });

        if (res.status >= 500) {
          console.error('[zahlungseingang] server error:', res.status);
          wechsleZuUnbestaetigt(UNGEWISSER_BUCHUNGS_HINWEIS);
          return;
        }

        if (!res.ok) {
          // Explizite 4xx-Ablehnung -> Korrektur möglich
          loeschePersistiertenLock(rechnungId);
          const errJson = await res.json().catch(() => ({}));
          dialogZustand = 'idle';
          overlay.dataset.submitting = 'false';
          if (rechnungId) laufendeBuchungen.delete(rechnungId);
          setzeSteuerelementeGesperrt(false);
          buchenBtn.textContent = 'Buchen';
          fehlerEl.textContent = errJson.error || `Fehler bei der Buchung (${res.status})`;
          fehlerEl.style.display = '';
          aktualisiere();
          return;
        }

        // 2xx-Antwort: Parsen MUSS vor dem Timeout-Clear erfolgen (hängender Body = unklar)
        json = await res.json();
      } catch (postOrParseError) {
        console.error('[zahlungseingang] post/parse error:', postOrParseError);
        wechsleZuUnbestaetigt(UNGEWISSER_BUCHUNGS_HINWEIS);
        return;
      } finally {
        clearTimeout(postUhr);
      }

      // 5. Validierung des exakten RPC-Rückgabe-Shapes aus rechnung_zahlung_buchen:
      // RETURN jsonb_build_object('zahlung_id', v_zahlung_id, 'ausbuchung_id', v_ausbuchung_id,
      //                          'beleg_nr', v_beleg_nr, 'payment_status', v_status, 'offen_eur', ...)
      const istGueltigerRpcPayload = json
        && typeof json === 'object'
        && typeof json.zahlung_id === 'string'
        && json.zahlung_id.length > 0
        && ['paid', 'partial'].includes(json.payment_status);

      if (!istGueltigerRpcPayload) {
        console.error('[zahlungseingang] ungültiger Rückgabe-Payload:', json);
        wechsleZuUnbestaetigt(UNGEWISSER_BUCHUNGS_HINWEIS);
        return;
      }

      // 6. Eindeutiger Erfolg
      loeschePersistiertenLock(rechnungId);
      if (rechnungId) {
        laufendeBuchungen.delete(rechnungId);
        unbestaetigteRechnungen.delete(rechnungId);
      }
      overlay.dataset.submitting = 'false';
      showToast(json?.beleg_nr
        ? `Zahlung gebucht ✓ · Beleg ${String(json.beleg_nr).padStart(6, '0')}`
        : 'Zahlung gebucht ✓');
      dialogZustand = 'success';
      schliessen(true);
    });

    if (rechnungId && istZahlungUnklar(rechnungId)) {
      wechsleZuUnbestaetigt(unbestaetigteRechnungen.get(rechnungId));
    } else {
      aktualisiere();
      if (typeof betragEl?.focus === 'function') betragEl.focus();
      if (typeof betragEl?.select === 'function') betragEl.select();
    }
  });
}
