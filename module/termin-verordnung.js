/**
 * termin-verordnung.js — Verordnungsauswahl im Termin-Fenster.
 *
 * Warum es das gibt
 * ─────────────────
 * Der Terminkalender ist der Bildschirm, auf dem die Praxis den Tag verbringt
 * (Beta-2, 12.08.2026: „wir sind die meiste Zeit dort"). Die Auswahl der
 * Verordnung im Termin-Fenster stand bis hierher zweimal wortgleich in
 * `dashboard.js` — einmal im Seitenbereich, einmal im Neu-Termin-Fenster.
 * Zwei Kopien heisst: jede Korrektur muss man zweimal machen und vergisst es
 * einmal. Diese Datei ist die eine Stelle.
 *
 * Sie beantwortet drei Fragen:
 *
 *   1. Welche Verordnungen hat der Patient — und welche ist gewählt?
 *   2. Welche Sitzung dieser Verordnung bekommt der Termin?
 *   3. Passt das gewählte Datum zur verordneten Frequenz?
 *
 * Frage 3 beantwortet `module/frequenz-pruefung.js` — mit Zahlen aus dem
 * Fragen-Antworten-Katalog Podologie, nicht mit geschätzten.
 *
 * Konsey 2026-08-13: neuer Code kommt in ein eigenes Modul, `dashboard.js`
 * wächst nicht mehr.
 */

import { ladePodoTermine, terminZaehler, loeseTermin } from './verordnung-termine.js?v=20260908';
import { ausTopf } from './verordnung-topf.js?v=20260930c';

// ── Frequenz ─────────────────────────────────────────────────────────────

// Die Frequenzprüfung ist nach module/frequenz-pruefung.js umgezogen. Der erste
// Anlauf hier rechnete mit selbst ausgedachten Toleranzen (80 % des Intervalls);
// der Fragen-Antworten-Katalog Podologie Nr. 11 nennt statt dessen 2 WERKTAGE
// und eine 12-Wochen-Grenze für die Unterbrechung. Erfundene Zahlen haben in
// einer Abrechnungswarnung nichts verloren — siehe dort.

// ── Verordnungskarten ──────────────────────────────────────────────────────

/**
 * Der „+" — der Weg zu einer neuen Verordnung.
 *
 * Er sieht in beiden Lagen anders aus, weil er zwei verschiedene Dinge sagt:
 *
 *   leer  — „hier fehlt etwas, fang hier an." Grosse Flaeche, Frage im Text,
 *           der Knopf IST die Antwort.
 *   voll  — „es geht auch noch eine mehr." Eine schmale Zeile unter den
 *           Karten; sie darf die vorhandenen Verordnungen nicht ueberstrahlen.
 *
 * Vorher gab es ihn nur in der leeren Lage. Stand schon eine Verordnung da,
 * fuehrte kein Weg mehr zu einer zweiten — und Folgeverordnungen sind in der
 * Podologie der Normalfall, nicht die Ausnahme.
 */
function anlegenKnopf(onAnlegen, leer) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bk-vero-anlegen';
  btn.title = 'Neue Verordnung anlegen';
  btn.style.cssText = leer
    ? 'width:100%;padding:14px 12px;border-radius:10px;border:2px dashed var(--accent,#b1891b);'
      + 'background:rgba(177,137,27,0.05);cursor:pointer;display:flex;flex-direction:column;'
      + 'align-items:center;gap:6px;color:var(--accent,#b1891b);'
    : 'width:100%;padding:7px 12px;border-radius:10px;border:1px dashed var(--border-strong,var(--border));'
      + 'background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;'
      + 'gap:6px;color:var(--text-muted);font-size:12px;font-weight:600;';
  btn.innerHTML = leer
    ? '<span style="font-size:26px;line-height:1;">＋</span>'
      + '<span style="font-size:12px;font-weight:600;">Für diesen Patienten ist keine Verordnung hinterlegt</span>'
      + '<span style="font-size:12px;font-weight:700;">Jetzt eine anlegen?</span>'
    : '<span style="font-size:15px;line-height:1;">＋</span> Verordnung anlegen';
  btn.addEventListener('click', onAnlegen);
  return btn;
}

/**
 * Zeichnet die Liste der aktiven Verordnungen. Der Knopf zum Anlegen steht —
 * sofern `onAnlegen` gereicht wird — in BEIDEN Lagen: mit und ohne Verordnung.
 *
 * `sb`/`ownerId`/`leadId` (Reform S1.3, 29.09.2026): Podologie führt kein
 * `prescription_sessions`-Hauptbuch (module/verordnung-topf.js,
 * fuehrtSitzungsbuch) — der Zähler zeigte für sie IMMER „0/…", ganz gleich
 * wie oft schon behandelt wurde (das Panel widersprach sich dabei selbst: die
 * Karte „0/3" neben dem Hinweis „keine aktive Verordnung hinterlegt"). Die
 * echte Zahl steht in `bookings.verordnung_id` und wird hier — wie in
 * `verordnung-detail.js` (_terminePodo) — über `ladePodoTermine()` +
 * `terminZaehler()` nachgezählt. Physio/Ergo/Logo bleiben unverändert: ohne
 * `sb`/`ownerId` (Aufrufer reicht sie nicht) läuft nur der bisherige,
 * synchrone Zweig.
 */
export function rendereVeroKarten({ container, rxs, onSelect, onAnlegen = null, escapeHtml, sb = null, ownerId = null, leadId = null }) {
  if (!container) return;
  container.innerHTML = '';

  if (!rxs?.length) {
    // Ohne Anlegen-Weg bleibt nur die Feststellung — sonst spricht der Knopf.
    if (!onAnlegen) {
      container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:4px 0 6px;">Keine aktive Verordnung vorhanden.</div>';
      return;
    }
    container.appendChild(anlegenKnopf(onAnlegen, true));
    return;
  }

  rxs.forEach(rx => {
    const sessions = rx.prescription_sessions || [];
    const istPodo = rx.therapie_bereich === 'podo';
    // Podologie: `sessions` ist strukturell leer (kein Hauptbuch) — der Platz
    // wird unten asynchron nachgefüllt, statt hier fälschlich 0 zu behaupten.
    const done = istPodo ? 0 : sessions.filter(s => s.status === 'done' || s.status === 'completed').length;
    const total = rx.anzahl_einheiten || sessions.length || 0;
    const issued = rx.ausstellungsdatum
      ? new Date(rx.ausstellungsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';
    const card = document.createElement('button');
    card.type = 'button';
    card.dataset.rxId = rx.id;
    card.className = 'bk-vero-card';
    card.style.cssText = 'width:100%;text-align:left;padding:10px 12px;border-radius:10px;border:2px solid var(--border);background:transparent;cursor:pointer;transition:border-color 0.15s,background 0.15s;';
    const diag = rx.icd10
      ? rx.icd10 + (rx.diagnosegruppe ? ' · ' + rx.diagnosegruppe : '')
      : (rx.diagnosegruppe || '');
    const freq = rx.frequenz ? ` · ${escapeHtml(rx.frequenz)}` : '';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div style="font-size:13px;font-weight:600;color:var(--text-main);">${escapeHtml(rx.heilmittel || rx.heilmittel_position || '—')}</div>
        <span data-vero-zaehler="${escapeHtml(rx.id)}" style="font-size:11px;font-weight:700;color:var(--accent,#b1891b);background:rgba(177,137,27,0.12);padding:1px 7px;border-radius:10px;">${done}/${total}</span>
      </div>
      <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(diag)} · ${escapeHtml(issued)}${freq}</div>`;
    card.addEventListener('click', () => onSelect(rx, sessions));
    container.appendChild(card);

    if (istPodo && sb && ownerId && rx.id) {
      ladePodoTermine(sb, { ownerId, vordId: rx.id, leadId }).then(({ vergeben }) => {
        const { verordnet, belegt } = terminZaehler(ausTopf(rx), vergeben);
        const badge = card.querySelector('[data-vero-zaehler]');
        if (badge) badge.textContent = `${belegt}/${verordnet ?? total}`;
      }).catch(e => console.error('[rendereVeroKarten] Podo-Zaehler:', e));
    }
  });

  if (onAnlegen) container.appendChild(anlegenKnopf(onAnlegen, false));
}

// ── Sitzungswahl ───────────────────────────────────────────────────────────

/**
 * Farben der Sitzungspunkte.
 *
 * Vorher war „offen" auf `var(--border)` gesetzt — im dunklen Wie im hellen
 * Thema praktisch unsichtbar, und genau darüber ist die Praxis gestolpert
 * (Beta-2, 12.08.2026: die 1/2/3-Anzeige „fällt nicht auf"). Jetzt trägt jeder
 * Zustand eine eigene, im Thema definierte Farbe UND eine eigene Randart, so
 * dass die Unterscheidung auch ohne Farbwahrnehmung trägt.
 * Feste Hex-Werte sind hier verboten (CLAUDE.md, Dark Theme).
 */
const PUNKT_STIL = {
  done:    { rand: 'var(--success)',           fuell: 'var(--success)',      text: 'var(--bg-card-solid)', art: 'solid',  titel: 'Erledigt' },
  planned: { rand: 'var(--accent,#b1891b)',    fuell: 'var(--warning-dim)',  text: 'var(--accent,#b1891b)', art: 'solid', titel: 'Geplant'  },
  offen:   { rand: 'var(--text-muted)',        fuell: 'transparent',         text: 'var(--text-main)',      art: 'dashed', titel: 'Offen'    },
};

/**
 * Zeichnet Sitzungspunkte, setzt die verborgenen Felder und meldet über
 * `onDienstleistung` die zur Verordnung passende Leistung nach oben.
 *
 * deps: { escapeHtml, aufDienstleistung(rx), aufAbwahl() }
 */
export async function waehleVerordnung(rx, sessions, deps = {}) {
  const { aufDienstleistung, sb, ownerId, leadId } = deps;

  document.querySelectorAll('.bk-vero-card').forEach(c => {
    c.style.borderColor = 'var(--border)';
    c.style.background = 'transparent';
  });
  const aktiv = document.querySelector(`.bk-vero-card[data-rx-id="${rx.id}"]`);
  if (aktiv) {
    aktiv.style.borderColor = 'var(--accent,#b1891b)';
    aktiv.style.background = 'rgba(177,137,27,0.08)';
  }

  const selbstBtn = document.getElementById('bkSelbstzahlerBtn');
  if (selbstBtn) { selbstBtn.style.borderColor = 'var(--border)'; selbstBtn.style.color = 'var(--text-muted)'; }
  setzeWert('bkIsSelbstzahler', '');
  setzeWert('bkSelectedRxId', rx.id);

  const pickerBlock = document.getElementById('bkSessionPickerBlock');
  const dotsEl = document.getElementById('bkSessionDots');
  const titleEl = document.getElementById('bkSessionPickerTitle');
  const infoEl = document.getElementById('bkSessionPickerInfo');
  if (!pickerBlock || !dotsEl) return;

  const total = rx.anzahl_einheiten || sessions?.length || 0;
  if (titleEl) {
    titleEl.textContent = `${rx.heilmittel || '—'}${rx.icd10 ? ' · ' + rx.icd10 : ''} · ${total} Einh.`
      + (rx.frequenz ? ` · ${rx.frequenz}` : '');
  }

  const istPodo = rx?.therapie_bereich === 'podo';

  if (istPodo) {
    dotsEl.innerHTML = '';
    setzeWert('bkSelectedSessionId', '');
    window._pendingRxSession = { prescriptionId: rx.id, podoVordId: rx.id };

    if (sb && ownerId) {
      try {
        const { vergeben } = await ladePodoTermine(sb, { ownerId, vordId: rx.id, leadId });
        const z = terminZaehler(ausTopf(rx), vergeben);
        if (z.offen === 0) {
          if (infoEl) infoEl.textContent = 'Alle Sitzungen bereits vergeben.';
          window._pendingRxSession = null;
        } else if (z.offen !== null) {
          if (infoEl) infoEl.textContent = `Noch ${z.offen} von ${z.verordnet} Einheiten offen.`;
        } else {
          if (infoEl) infoEl.textContent = 'Termin wird der Verordnung zugeordnet.';
        }
      } catch (e) {
        console.error('[waehleVerordnung] Fehler beim Laden der Podo-Termine:', e);
        if (infoEl) infoEl.textContent = 'Termin wird der Verordnung zugeordnet.';
      }
    } else {
      if (infoEl) infoEl.textContent = 'Termin wird der Verordnung zugeordnet.';
    }
  } else {
    const offeneSessions = (sessions || [])
      .filter(s => !s.booking_id || s.status === 'planned')
      .sort((a, b) => a.session_number - b.session_number);
    const naechste = offeneSessions[0] || null;

    dotsEl.innerHTML = (sessions || [])
      .slice()
      .sort((a, b) => a.session_number - b.session_number)
      .map(s => {
        const erledigt = s.status === 'done' || s.status === 'completed';
        const geplant = !!s.booking_id && !erledigt;
        const stil = erledigt ? PUNKT_STIL.done : geplant ? PUNKT_STIL.planned : PUNKT_STIL.offen;
        const waehlbar = !erledigt;
        return `<button type="button" class="bk-sess-dot" data-sess-id="${s.id}" data-sess-num="${s.session_number}" data-pending="${waehlbar ? '1' : '0'}"
        title="Sitzung ${s.session_number}: ${stil.titel}"
        style="width:32px;height:32px;border-radius:50%;border:2px ${stil.art} ${stil.rand};background:${stil.fuell};cursor:${waehlbar ? 'pointer' : 'default'};font-size:13px;font-weight:700;color:${stil.text};display:flex;align-items:center;justify-content:center;line-height:1;">
        ${s.session_number}
      </button>`;
      }).join('');

    dotsEl.querySelectorAll('.bk-sess-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        if (dot.dataset.pending !== '1') return;
        markiereGewaehltenPunkt(dotsEl, dot);
        setzeWert('bkSelectedSessionId', dot.dataset.sessId);
        window._pendingRxSession = { sessionId: dot.dataset.sessId, prescriptionId: rx.id };
        if (infoEl) infoEl.textContent = `Sitzung ${dot.dataset.sessNum} von ${total} ausgewählt`;
      });
    });

    if (naechste) {
      setzeWert('bkSelectedSessionId', naechste.id);
      window._pendingRxSession = { sessionId: naechste.id, prescriptionId: rx.id };
      if (infoEl) infoEl.textContent = `Nächste: Sitzung ${naechste.session_number} von ${total}`;
      const standardPunkt = dotsEl.querySelector(`.bk-sess-dot[data-sess-id="${naechste.id}"]`);
      if (standardPunkt) markiereGewaehltenPunkt(dotsEl, standardPunkt);
    } else {
      if (infoEl) infoEl.textContent = 'Alle Sitzungen bereits vergeben.';
      setzeWert('bkSelectedSessionId', '');
      window._pendingRxSession = null;
    }
  }

  pickerBlock.hidden = false;

  // Die Verordnung enthält die Leistung bereits — danach noch einmal zu fragen
  // ist ein Klick, den die Praxis dutzendfach am Tag machen müsste
  // (Beta-2, 12.08.2026: „das werde ich jetzt entfernen").
  if (typeof aufDienstleistung === 'function') aufDienstleistung(rx);
}

function markiereGewaehltenPunkt(dotsEl, dot) {
  dotsEl.querySelectorAll('.bk-sess-dot').forEach(d => { d.style.outline = 'none'; });
  dot.style.outline = '3px solid var(--accent,#b1891b)';
  dot.style.outlineOffset = '2px';
}

function setzeWert(id, wert) {
  const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (el) el.value = wert;
}

/**
 * Blendet die Dienstleistungs-Auswahl aus bzw. wieder ein.
 * Ausgeblendet heisst NICHT „leer": der Wert bleibt gesetzt, weil
 * `bookings.service_id` weiterhin Pflicht ist.
 */
export function zeigeDienstleistungsfeld(sichtbar) {
  const gruppe = typeof document !== 'undefined' ? document.getElementById('bkServiceGroup') : null;
  if (gruppe) gruppe.hidden = !sichtbar;
  const hinweis = typeof document !== 'undefined' ? document.getElementById('bkServiceAusVerordnung') : null;
  if (hinweis) hinweis.hidden = sichtbar;
}

/**
 * Leert die Verordnungsauswahl und verbundene Felder im Termin-Fenster.
 */
export function resetVerordnungFelder() {
  setzeWert('bkSelectedRxId', '');
  setzeWert('bkSelectedSessionId', '');
  if (typeof window !== 'undefined') {
    window._pendingRxSession = null;
    window._bkGewaehlteRx = null;
    window._bkUrspruenglicheVordId = null;
  }
  const pickerBlock = typeof document !== 'undefined' ? document.getElementById('bkSessionPickerBlock') : null;
  if (pickerBlock) pickerBlock.hidden = true;
  if (typeof document !== 'undefined') {
    document.querySelectorAll?.('.bk-vero-card')?.forEach(c => {
      if (c?.style) {
        c.style.borderColor = 'var(--border)';
        c.style.background = 'transparent';
      }
    });
  }
  zeigeDienstleistungsfeld(true);
}

/**
 * Lädt die aktiven Verordnungen eines Patienten in das Termin-Fenster und
 * wählt bei Bedarf die zum Termin gehörende Verordnung vor.
 *
 * @param {object} sb - Supabase Client
 * @param {object} [params]
 * @param {string|null} [params.leadId] - Patient ID
 * @param {string|null} [params.bookingId] - Termin ID
 * @param {string|null|undefined} [params.bekannteVerordnungId] - Vorab bekannte Verordnungs-ID (z. B. aus Termin)
 * @param {object} [deps] - DOM-Elemente und Callbacks
 */
export async function zeigeVerordnungenFuerTermin(sb, { leadId, bookingId, bekannteVerordnungId } = {}, deps = {}) {
  const veroSection = deps.veroSection ?? (typeof document !== 'undefined' ? document.getElementById('bkVerordnungSection') : null);
  const veroCards = deps.veroCards ?? (typeof document !== 'undefined' ? document.getElementById('bkVeroCards') : null);
  const resetFn = deps.resetFelder || resetVerordnungFelder;

  resetFn?.();

  if (!leadId) {
    if (veroSection) veroSection.hidden = true;
    return;
  }

  let vordId = bekannteVerordnungId;
  if (vordId === undefined && bookingId && sb) {
    const { data } = await sb.from('bookings').select('verordnung_id').eq('id', bookingId).maybeSingle();
    vordId = data?.verordnung_id ?? null;
  }

  const { data: rxs } = await sb
    .from('prescriptions')
    .select('id,heilmittel,heilmittel_position,icd10,anzahl_einheiten,ausstellungsdatum,status,diagnosegruppe,gueltig_bis,is_dringend,frequenz,prescription_sessions(id,session_number,status,booking_id),therapie_bereich')
    .eq('patient_id', leadId)
    .not('status', 'in', '("completed","billed","cancelled")')
    .order('created_at', { ascending: false })
    .limit(5);

  const renderFn = deps.rendereVeroKarten || rendereVeroKarten;
  renderFn({
    container: veroCards,
    rxs: rxs || [],
    escapeHtml: deps.escapeHtml || ((s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))),
    onSelect: deps.onSelect,
    onAnlegen: deps.onAnlegen,
    sb, ownerId: deps.ownerId, leadId,
  });

  if (veroSection) veroSection.hidden = false;

  if (vordId && rxs?.length) {
    const match = rxs.find(r => r.id === vordId);
    if (match && typeof deps.onSelect === 'function') {
      // Nur merken, wenn die Karte sichtbar ist — sonst könnte „Abwählen"
      // eine Bindung lösen, die der Anwender gar nicht gesehen hat.
      if (typeof window !== 'undefined') window._bkUrspruenglicheVordId = vordId;
      await deps.onSelect(match, match.prescription_sessions || []);
    }
  }
}

/**
 * „Abwählen" im Bearbeiten-Fenster. `prefillBookingModal()` verdrahtet den
 * Knopf nur beim Neu-Termin; beim Bearbeiten fehlte der Handler.
 * WeakSet statt Datenattribut: `cloneNode` würde ein Attribut mitkopieren,
 * den Listener aber nicht.
 */
const _abwahlVerdrahtet = new WeakSet();
export function verdrahteAbwahl() {
  const btn = typeof document !== 'undefined' ? document.getElementById('bkVeroDeselect') : null;
  if (!btn || _abwahlVerdrahtet.has(btn)) return;
  _abwahlVerdrahtet.add(btn);
  btn.addEventListener('click', () => {
    setzeWert('bkIsSelbstzahler', '');
    const selbst = document.getElementById('bkSelbstzahlerBtn');
    if (selbst?.style) { selbst.style.borderColor = 'var(--border)'; selbst.style.color = 'var(--text-muted)'; }
    // Ursprüngliche Bindung behalten: sie entscheidet beim Speichern über das Lösen.
    const orig = window._bkUrspruenglicheVordId;
    resetVerordnungFelder();
    window._bkUrspruenglicheVordId = orig;
  });
}

/**
 * Verordnungsbindung beim Speichern eines BESTEHENDEN Termins.
 * Podologie: neu/anders gewählt -> binden; ursprünglich gebunden und jetzt
 * abgewählt -> lösen; unverändert -> nichts schreiben.
 * Physio (Sitzungszeilen) bleibt bewusst unberührt.
 *
 * @param {Function} binde  bindePodoAnTermin (injiziert — vermeidet DOM-Importe)
 * @returns {Promise<null|{ok:boolean, meldung:string}>}
 */
export async function aktualisiereBindungBeimSpeichern(sb, bookingId, { emit, binde } = {}) {
  if (typeof window === 'undefined') return null;
  const pend = window._pendingRxSession;
  const gewaehlt = pend?.podoVordId || null;
  const orig = window._bkUrspruenglicheVordId || null;
  const rxFeld = typeof document !== 'undefined' ? document.getElementById('bkSelectedRxId') : null;
  let ergebnis = null;
  if (gewaehlt && gewaehlt !== orig) {
    ergebnis = await binde(sb, bookingId, pend, { emit });
    if (ergebnis.ok) window._bkUrspruenglicheVordId = gewaehlt;
  } else if (!gewaehlt && orig && (rxFeld?.value ?? '') === '') {
    const r = await loeseTermin(sb, { bookingId });
    if (r.ok) {
      window._bkUrspruenglicheVordId = null;
      emit?.('verordnungen:changed');
      ergebnis = { ok: true, meldung: '' };
    } else {
      ergebnis = { ok: false, meldung: `Die Zuordnung zur Verordnung konnte nicht gelöst werden: ${r.fehler}` };
    }
  }
  if (gewaehlt) window._pendingRxSession = null;
  return ergebnis;
}

// ── Rezeptart des Termins ────────────────────────────────────────────────

/**
 * `bookings.rezeptart` haelt fest, WIE ein Termin bezahlt wird:
 * `'selbstzahler'`, `'kassen'` oder leer. Beim Bearbeiten eines bestehenden
 * Termins wurde das Feld bisher bedingungslos geleert und beim Speichern als
 * NULL zurueckgeschrieben — die Markierung ueberlebte also keine einzige
 * Bearbeitung, auch wenn nur die Notiz geaendert wurde.
 *
 * Diese beiden Funktionen sind der Weg hin und zurueck. Sie stehen hier und
 * nicht in `dashboard.js`, weil dort die Verordnungsauswahl ohnehin zu Hause
 * ist und die Datei nicht wachsen darf (tools/check-dashboard-size.sh).
 */

/**
 * Gespeicherte Rezeptart in die Maske uebernehmen.
 *
 * Nur `'selbstzahler'` setzt den Schalter. `'kassen'` haengt an der gewaehlten
 * Verordnung, nicht an diesem Feld — die Karte waehlt `waehleVerordnung()`
 * aus, und die setzt den Schalter selbst wieder zurueck.
 *
 * @param {?string} rezeptart  Wert aus `bookings.rezeptart` (darf fehlen).
 */
export function setzeRezeptartInMaske(rezeptart) {
  setzeWert('bkIsSelbstzahler', rezeptart === 'selbstzahler' ? '1' : '');
}

/**
 * Die Rezeptart, wie sie gerade in der Maske steht — fuer Zwischenschritte,
 * die das Fenster schliessen und wieder oeffnen (Patient neu anlegen).
 *
 * @returns {?string} `'selbstzahler'` oder null.
 */
export function rezeptartAusMaske() {
  const el = typeof document !== 'undefined'
    ? document.getElementById('bkIsSelbstzahler') : null;
  return el?.value === '1' ? 'selbstzahler' : null;
}
