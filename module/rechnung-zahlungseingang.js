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
 *      Kassenbuch-Zeile als `zuzahlung` gebucht, nicht als `rechnung`.
 *      Mahnwesen (`mahnwesen.routes.js`) und Statistik filtern auf
 *      `type IN ('zuzahlung','storno')` und würden eine `rechnung`-Zeile
 *      übersehen. Der Typ beschreibt den Geschäftsvorfall, nicht den
 *      Erfassungsweg.
 *   2. `ausbuchungUeberKorrektur()` — eine Ausbuchung erzeugt keinen
 *      Kassenbuch-Beleg (kein Geldfluss). Bei einer rezeptgebundenen Rechnung
 *      bliebe der Saldo damit unter dem Soll und es würde weiter gemahnt.
 *      Deshalb läuft sie dort über den bestehenden Korrekturpfad
 *      (`zuzahlung_korrekturen`), nicht über dieses Ledger.
 */

import {
  aktiveKonten, kontoAnzeige,
  AUSBUCHUNGSKONTO_STANDARD, KASSENKONTO,
} from './buchungskonten.js?v=20260908';

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

/** Nur Bargeld gehört ins Kassenbuch (§ 146 AO). Bank/EC erzeugen keinen Beleg. */
export function erzeugtKassenbuchBeleg(gegenkontoCode) {
  return String(gegenkontoCode ?? '').replace(/\s+/g, '') === KASSENKONTO;
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
    kassenbuchBeleg: erzeugtKassenbuchBeleg(gegenkontoCode),
  };
}

// ── Dialog ──────────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const eur = (v) => (Number(v) || 0).toFixed(2).replace('.', ',') + ' €';

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
  try {
    const jwt = await token();
    const res = await fetch(`${apiBasis}/billing/rechnungen/${invoiceId}/zahlungen`, {
      headers: { 'Authorization': 'Bearer ' + jwt },
    });
    stand = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(stand.error || `Serverfehler (${res.status})`);
  } catch (e) {
    console.error('[zahlungseingang] laden:', e);
    showToast('Zahlungsstand konnte nicht geladen werden: ' + e.message, 'error');
    return false;
  }

  return oeffneZahlungseingang({
    rechnung: { ...stand.rechnung, id: invoiceId },
    bereitsGebucht: stand.bereits_gebucht || 0,
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
 * @param {object} opts.profile         currentProfile — liefert den Kontenrahmen
 * @param {string} opts.apiBasis        z. B. `${API}`
 * @param {Function} opts.token         async () => access_token
 * @param {Function} opts.showToast
 * @returns {Promise<boolean>} true, wenn gebucht wurde
 */
export function oeffneZahlungseingang(opts) {
  const {
    rechnung, bereitsGebucht = 0, profile, apiBasis, token, showToast,
  } = opts;

  const konten = aktiveKonten(profile);
  // Der Server liefert `hat_rezeptbezug` bereits ausgewertet (er kennt beide
  // Spalten — prescription_id für Physio/Ergo/Logo, verordnung_id für
  // Podologie). Die Einzelspalten bleiben als Rückfall, falls der Dialog
  // einmal direkt aus einem Listeneintrag geöffnet wird.
  const hatRezeptbezug = rechnung?.hat_rezeptbezug != null
    ? !!rechnung.hat_rezeptbezug
    : !!(rechnung?.prescription_id || rechnung?.verordnung_id);
  const rechnungsbetrag = Number(rechnung?.total_patient) || 0;
  const offen = offenerBetrag({ rechnungsbetrag, bereitsGebucht });

  return new Promise(resolve => {
    document.getElementById('_zeModal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = '_zeModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10001;'
      + 'display:flex;align-items:center;justify-content:center;padding:16px;';

    const feld = 'width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;'
      + 'background:var(--bg-input,var(--bg-card));color:var(--text-main);font-size:13px;font-family:inherit;';
    const label = 'margin-bottom:4px;color:var(--text-muted);font-size:12px;';
    const zeile = 'display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:2px 0;';

    const kontoOptionen = konten
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
            <input id="_zeDatum" type="date" value="${new Date().toISOString().slice(0, 10)}" style="${feld}">
          </label>

          <label style="display:block;">
            <div style="${label}">Gegenkonto</div>
            <select id="_zeKonto" style="${feld}">${kontoOptionen}</select>
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
              <select id="_zeAusKonto" style="${feld}">${kontoOptionen}</select>
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
    const kontoEl = $('_zeKonto');
    const ausKontoEl = $('_zeAusKonto');
    const restWrap = $('_zeRestWrap');
    const restEl = $('_zeRest');
    const ausKontoWrap = $('_zeAusKontoWrap');
    const hinweisEl = $('_zeHinweis');
    const fehlerEl = $('_zeFehler');
    const buchenBtn = $('_zeBuchen');

    if (ausKontoEl) ausKontoEl.value = AUSBUCHUNGSKONTO_STANDARD;

    function modus() {
      return overlay.querySelector('input[name="_zeRestModus"]:checked')?.value || 'offen_lassen';
    }

    function aktualisiere() {
      const plan = planeZahlung({
        rechnungsbetrag, bereitsGebucht,
        eingegangen: betragEl.value,
        restbetragModus: modus(),
        gegenkontoCode: kontoEl.value,
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
      if (plan.kassenbuchBeleg) hinweise.push('Es entsteht ein Kassenbuch-Beleg (Bargeld).');
      hinweisEl.textContent = hinweise.join(' ');
      hinweisEl.style.display = hinweise.length ? '' : 'none';
    }

    betragEl.addEventListener('input', aktualisiere);
    kontoEl.addEventListener('change', aktualisiere);
    ausKontoEl?.addEventListener('change', aktualisiere);
    overlay.querySelectorAll('input[name="_zeRestModus"]').forEach(r =>
      r.addEventListener('change', aktualisiere));

    function schliessen(ergebnis) {
      overlay.remove();
      resolve(ergebnis);
    }

    $('_zeAbbrechen').addEventListener('click', () => schliessen(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) schliessen(false); });

    buchenBtn.addEventListener('click', async () => {
      const plan = planeZahlung({
        rechnungsbetrag, bereitsGebucht,
        eingegangen: betragEl.value,
        restbetragModus: modus(),
        gegenkontoCode: kontoEl.value,
        ausbuchungskontoCode: ausKontoEl?.value,
        hatRezeptbezug,
      });
      if (!plan.ok) { fehlerEl.textContent = plan.fehler; fehlerEl.style.display = ''; return; }

      // Doppelklick sperren: die Buchung hat keinen Idempotenz-Schlüssel, ein
      // zweiter Aufruf würde ein zweites Mal buchen.
      buchenBtn.disabled = true;
      buchenBtn.textContent = '…';
      try {
        const jwt = await token();
        const res = await fetch(`${apiBasis}/billing/rechnungen/${rechnung.id}/zahlung`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eingegangener_betrag: plan.buchungen[0].betrag_eur,
            zahlungsdatum: $('_zeDatum').value || null,
            gegenkonto_code: kontoEl.value,
            restbetrag_modus: modus(),
            ausbuchungskonto_code: ausKontoEl?.value || AUSBUCHUNGSKONTO_STANDARD,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Serverfehler (${res.status})`);

        showToast(json.beleg_nr
          ? `Zahlung gebucht ✓ · Beleg ${String(json.beleg_nr).padStart(6, '0')}`
          : 'Zahlung gebucht ✓');
        schliessen(true);
      } catch (e) {
        console.error('[zahlungseingang]', e);
        fehlerEl.textContent = e.message;
        fehlerEl.style.display = '';
        buchenBtn.disabled = false;
        buchenBtn.textContent = 'Buchen';
      }
    });

    aktualisiere();
    betragEl.focus();
    betragEl.select();
  });
}
