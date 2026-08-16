/**
 * termin-verordnung.js — Verordnungsauswahl im Termin-Fenster.
 *
 * Warum es das gibt
 * ─────────────────
 * Der Terminkalender ist der Bildschirm, auf dem die Praxis den Tag verbringt
 * (Nausad, 12.08.2026: „wir sind die meiste Zeit dort"). Die Auswahl der
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
 * Frage 3 ist neu. Bis hierher konnte man bei „alle vier Wochen" die zweite
 * Sitzung auf den Folgetag legen; niemand hat widersprochen. Jetzt widerspricht
 * die Oberfläche — aber sie BLOCKIERT NICHT. Das ist eine ausdrückliche
 * Produktentscheidung (Nausad, 12.08.2026: „wenn man weitermachen möchte,
 * weiter drücken, dann soll der Termin gebaut werden"). Gründe für ein
 * Abweichen gibt es reichlich (Urlaub, Krankheit, Nachholtermin), und die
 * Verordnungsfrequenz ist eine ärztliche Vorgabe, kein Abrechnungsverbot.
 *
 * Die Toleranzen in `frequenzMindestabstand()` sind Produkt-Vorgabe, nicht
 * aus der Heilmittel-Richtlinie abgeleitet — sie sind bewusst grosszügig, weil
 * eine zu enge Regel den Warnhinweis zum täglichen Wegklicken degradiert und
 * damit wertlos macht. Vor einer Verschärfung `gkv-302` fragen.
 *
 * Konsey 2026-08-13: neuer Code kommt in ein eigenes Modul, `dashboard.js`
 * wächst nicht mehr.
 */

// ── Frequenz ───────────────────────────────────────────────────────────────

/**
 * Liest den Freitext aus `prescriptions.frequenz` und leitet daraus den
 * Mindestabstand zweier Sitzungen in Tagen ab.
 *
 * Rückgabe: { tage, label } oder null, wenn der Text nichts Verwertbares
 * hergibt. null heisst ausdrücklich „keine Prüfung" — lieber gar nicht warnen
 * als bei jedem zweiten Termin falsch warnen.
 */
export function frequenzMindestabstand(frequenzText) {
  const txt = String(frequenzText || '').toLowerCase().trim();
  if (!txt) return null;

  // „alle 4 Wochen", „alle zwei Wochen", „4-wöchentlich", „14-tägig"
  const alleWochen = txt.match(/alle\s+(\d+|zwei|drei|vier|fünf|sechs)\s*wochen/)
    || txt.match(/(\d+)\s*-?\s*wöchentlich/);
  if (alleWochen) {
    const wochen = zahlAusWort(alleWochen[1]);
    if (wochen > 1) {
      // 20 % Toleranz: bei „alle 4 Wochen" schlägt erst ein Abstand unter
      // 22 Tagen an. Eine Woche früher ist Praxisalltag, kein Fehler.
      return { tage: Math.round(wochen * 7 * 0.8), label: `alle ${wochen} Wochen` };
    }
  }
  if (/14\s*-?\s*tägig|zweiwöchentlich/.test(txt)) {
    return { tage: 11, label: '14-tägig' };
  }

  // „2x wöchentlich", „1-2x pro Woche", „3x wöchentl."
  const proWoche = txt.match(/(\d+)\s*(?:\s*-\s*(\d+))?\s*x?\s*(?:mal)?\s*(?:pro\s+woche|wöchentl)/);
  if (proWoche) {
    // Bei einer Spanne („1-2x") gilt der HÖHERE Wert: er erlaubt den engeren
    // Abstand, und die Warnung soll nur den klar unplausiblen Fall treffen.
    const n = Math.max(Number(proWoche[1]) || 1, Number(proWoche[2]) || 0);
    if (n > 0) {
      const tage = Math.max(1, Math.floor(7 / n) - 1);
      return { tage, label: `${n}× wöchentlich` };
    }
  }

  // „2x monatlich"
  const proMonat = txt.match(/(\d+)\s*(?:\s*-\s*(\d+))?\s*x?\s*(?:mal)?\s*(?:pro\s+monat|monatl)/);
  if (proMonat) {
    const n = Math.max(Number(proMonat[1]) || 1, Number(proMonat[2]) || 0);
    if (n > 0) return { tage: Math.max(1, Math.floor(30 / n) - 2), label: `${n}× monatlich` };
  }

  // Tägliche Frequenzen haben keinen sinnvollen Mindestabstand.
  return null;
}

function zahlAusWort(w) {
  const worte = { zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6 };
  return worte[String(w)] ?? (Number(w) || 0);
}

/**
 * Prüft, ob `neuesDatum` zur Frequenz der Verordnung passt.
 *
 * Verglichen wird gegen den NÄCHSTGELEGENEN bereits terminierten Termin
 * derselben Verordnung — in beide Richtungen, denn man kann einen Termin auch
 * VOR einen bestehenden legen.
 *
 * Rückgabe: { ok: true } oder { ok: false, titel, meldung }.
 * Der Aufrufer entscheidet, was er damit macht — hier wird nichts blockiert.
 */
export async function pruefeFrequenz({ supabase, rx, neuesDatum, ausserBookingId = null }) {
  const regel = frequenzMindestabstand(rx?.frequenz);
  if (!regel || !rx?.id || !neuesDatum) return { ok: true };

  const { data: sessions, error } = await supabase
    .from('prescription_sessions')
    .select('id,session_number,booking_id,bookings(start_time,status)')
    .eq('prescription_id', rx.id)
    .not('booking_id', 'is', null);
  // Bei einem Lesefehler NICHT warnen: eine Warnung ohne Datengrundlage ist
  // schlimmer als keine, weil der Nutzer sie zu Recht ignoriert.
  if (error || !sessions?.length) return { ok: true };

  const neu = new Date(neuesDatum);
  if (Number.isNaN(neu.getTime())) return { ok: true };

  let naechster = null;
  for (const s of sessions) {
    if (ausserBookingId && s.booking_id === ausserBookingId) continue;
    const bk = s.bookings;
    if (!bk?.start_time) continue;
    if (bk.status === 'cancelled') continue;
    const d = new Date(bk.start_time);
    if (Number.isNaN(d.getTime())) continue;
    const abstand = Math.abs(tageZwischen(d, neu));
    if (!naechster || abstand < naechster.abstand) {
      naechster = { abstand, datum: d, nummer: s.session_number };
    }
  }

  if (!naechster || naechster.abstand >= regel.tage) return { ok: true };

  const datumStr = naechster.datum.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  return {
    ok: false,
    titel: 'Frequenz der Verordnung',
    meldung:
      `Die Verordnung sieht „${regel.label}" vor.\n\n`
      + `Sitzung ${naechster.nummer ?? ''} liegt am ${datumStr} — das sind nur `
      + `${naechster.abstand} Tag${naechster.abstand === 1 ? '' : 'e'} Abstand `
      + `(erwartet: mindestens ${regel.tage}).\n\n`
      + `Der Termin kann trotzdem angelegt werden.`,
  };
}

function tageZwischen(a, b) {
  const tagA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const tagB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((tagB - tagA) / 86400000);
}

// ── Verordnungskarten ──────────────────────────────────────────────────────

/**
 * Zeichnet die Liste der aktiven Verordnungen. Ohne Verordnung wird — je nach
 * `mitAnlegen` — ein Knopf zum Anlegen angeboten.
 */
export function rendereVeroKarten({ container, rxs, onSelect, onAnlegen = null, escapeHtml }) {
  if (!container) return;
  container.innerHTML = '';

  if (!rxs?.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:4px 0 6px;">Keine aktive Verordnung vorhanden.</div>';
    if (onAnlegen) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = 'width:100%;text-align:left;padding:10px 12px;border-radius:10px;border:2px dashed var(--accent,#b1891b);background:rgba(177,137,27,0.05);cursor:pointer;display:flex;align-items:center;gap:8px;color:var(--accent,#b1891b);font-size:13px;font-weight:600;';
      btn.innerHTML = '<span style="font-size:18px;">＋</span> Neue Verordnung anlegen';
      btn.addEventListener('click', onAnlegen);
      container.appendChild(btn);
    }
    return;
  }

  rxs.forEach(rx => {
    const sessions = rx.prescription_sessions || [];
    const done = sessions.filter(s => s.status === 'done' || s.status === 'completed').length;
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
  });
}

// ── Sitzungswahl ───────────────────────────────────────────────────────────

/**
 * Farben der Sitzungspunkte.
 *
 * Vorher war „offen" auf `var(--border)` gesetzt — im dunklen Wie im hellen
 * Thema praktisch unsichtbar, und genau darüber ist die Praxis gestolpert
 * (Nausad, 12.08.2026: die 1/2/3-Anzeige „fällt nicht auf"). Jetzt trägt jeder
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
export function waehleVerordnung(rx, sessions, deps = {}) {
  const { aufDienstleistung } = deps;

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

  const total = rx.anzahl_einheiten || sessions.length || 0;
  if (titleEl) {
    titleEl.textContent = `${rx.heilmittel || '—'}${rx.icd10 ? ' · ' + rx.icd10 : ''} · ${total} Einh.`
      + (rx.frequenz ? ` · ${rx.frequenz}` : '');
  }

  const offeneSessions = sessions
    .filter(s => !s.booking_id || s.status === 'planned')
    .sort((a, b) => a.session_number - b.session_number);
  const naechste = offeneSessions[0] || null;

  dotsEl.innerHTML = sessions
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

  pickerBlock.hidden = false;

  // Die Verordnung enthält die Leistung bereits — danach noch einmal zu fragen
  // ist ein Klick, den die Praxis dutzendfach am Tag machen müsste
  // (Nausad, 12.08.2026: „das werde ich jetzt entfernen").
  if (typeof aufDienstleistung === 'function') aufDienstleistung(rx);
}

function markiereGewaehltenPunkt(dotsEl, dot) {
  dotsEl.querySelectorAll('.bk-sess-dot').forEach(d => { d.style.outline = 'none'; });
  dot.style.outline = '3px solid var(--accent,#b1891b)';
  dot.style.outlineOffset = '2px';
}

function setzeWert(id, wert) {
  const el = document.getElementById(id);
  if (el) el.value = wert;
}

/**
 * Blendet die Dienstleistungs-Auswahl aus bzw. wieder ein.
 * Ausgeblendet heisst NICHT „leer": der Wert bleibt gesetzt, weil
 * `bookings.service_id` weiterhin Pflicht ist.
 */
export function zeigeDienstleistungsfeld(sichtbar) {
  const gruppe = document.getElementById('bkServiceGroup');
  if (gruppe) gruppe.hidden = !sichtbar;
  const hinweis = document.getElementById('bkServiceAusVerordnung');
  if (hinweis) hinweis.hidden = sichtbar;
}
