/**
 * rechnung-verordnung.js — abgerechnet wird die Verordnung, nicht der Termin.
 *
 * Befund (Kemal, Live-Test 15.08.2026):
 *   „Nicht den Termin, die Behandlung müssen wir wählen lassen. Eine Behandlung
 *   kann zehn Sitzungen haben. Normalerweise muss die ganze Verordnung gewählt
 *   werden. Darunter, mit einem Pfeil, kann aufklappen wie viele Behandlungen
 *   es sind — wer will, stellt es einzeln ein, aber in der Regel läuft es über
 *   die Verordnung."
 *
 * Warum die Verordnung die richtige Abrechnungseinheit ist:
 *   Eine gesetzliche Heilmittelverordnung (Muster 13 / Rezept) autorisiert eine
 *   bestimmte Anzahl von Behandlungseinheiten. Die Kasse erwartet die Abrechnung
 *   auf Verordnungsebene, nicht auf Terminebene. Einzeltermine in die Rechnung
 *   zu übernehmen (bisheriger Fehler) erzeugt Belege, die nicht zur Struktur des
 *   Rezepts passen.
 *
 * Zwei getrennte Verordnungstöpfe — sie werden nicht vereinheitlicht:
 *
 *   Fachbereich            | Verordnung     | Behandlung
 *   ─────────────────────  | ────────────── | ──────────────────────
 *   Physio · Ergo · Logo   | prescriptions  | prescription_sessions
 *   Podologie              | verordnungen   | podologie_behandlungen
 *
 *   Welcher Topf gilt, entscheidet profiles.sector (getSector() im Frontend).
 *   Die Trennung ist bewusst (db/README.md §2) — Podologie hat eigene Spalten,
 *   eigene HPNR-Codes und ein eigenes Preisgefüge. Einen gemeinsamen Weg zu
 *   erzwingen würde beide Töpfe kaputt machen.
 *
 *   Podologie-Bezug an der Rechnung:
 *     invoices.prescription_id hat einen Fremdschlüssel auf prescriptions(id),
 *     nicht auf verordnungen. Eine verordnungen.id dort einzutragen schlägt am
 *     FK fehl. Deshalb bleibt prescription_id für Podologie NULL; der Bezug wird
 *     als Klartext in invoices.notes eingetragen, z. B.:
 *     „Verordnung vom 12.08.2026 (ID: 6f3a…-…)".
 *
 * Exporte: verordnungenLaden · verordnungenRendern · verordnungAuswahl
 */

// ─── Modulzustand (wird bei jedem verordnungenRendern zurückgesetzt) ──────────
let _liste = [];       // normalisierte Verordnungsliste aus verordnungenLaden
let _zustand = [];     // [{ vordId, behandlungIds: Set }] — welche Beh. gehakt
let _onAuswahl = null; // Callback bei Änderung

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function _datumDE(isoStr) {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return isoStr; }
}

/** Baut den Verordnungstitel aus heilmittel_items (Podologie) oder heilmittel-Feld (Physio). */
function _vordTitel(vord, katalogPodo) {
  if (vord.quelle === 'podologie') {
    const items = vord._heilmittelItems || [];
    if (items.length && katalogPodo) {
      const titel = items.map(it => {
        const entry = katalogPodo.find(k => k.code === String(it.code || it));
        return entry ? entry.title : null;
      }).filter(Boolean);
      if (titel.length) return titel.join(' · ');
    }
    return vord._diagnosegruppe || 'Verordnung';
  }
  // Physio / Ergo / Logo
  return vord._heilmittel || vord._diagnosegruppe || 'Behandlung';
}

/**
 * Löst HPNR-Codes einer Podologie-Behandlung gegen den Katalog auf.
 * Gibt Rechnungszeilen zurück. Unbekannte Codes werden als Hinweis-Zeile gemeldet.
 * Ist hpnr_codes leer, fällt die Funktion auf betrag_gkv zurück.
 *
 * @param {object} beh         podologie_behandlungen-Zeile (bereits geladen)
 * @param {Array}  katalogPodo GKV_LEISTUNGSKATALOG.podologie (nach applyGueltigePreise)
 * @param {string} vordTitel   Fallback-Titel aus der Verordnung
 * @param {number} betraGkv    betrag_gkv als letzter Fallback
 * @returns {{ zeilen: Array, hinweis: string|null }}
 */
function _zeilenAusCodes(beh, katalogPodo, vordTitel, betraGkv) {
  const codes = beh.hpnr_codes || [];
  if (!codes.length) {
    // Kein Code — auf betrag_gkv zurückfallen
    const preis = Number(betraGkv) || 0;
    const hinweis = preis === 0 ? 'kein Betrag hinterlegt' : null;
    return {
      zeilen: [{ title: vordTitel, quantity: 1, unit_price: preis }],
      hinweis,
    };
  }

  const zeilen = [];
  const unbekannt = [];
  for (const code of codes) {
    const entry = katalogPodo.find(k => k.code === String(code));
    if (entry) {
      zeilen.push({ title: entry.title, quantity: 1, unit_price: entry.price });
    } else {
      unbekannt.push(code);
    }
  }
  const hinweis = unbekannt.length
    ? 'Position' + (unbekannt.length > 1 ? 'en' : '') + ' ' + unbekannt.join(', ') + ' unbekannt'
    : null;
  return { zeilen, hinweis };
}

// ─── Öffentliche API ──────────────────────────────────────────────────────────

/**
 * Lädt und normalisiert die Verordnungen eines Patienten.
 *
 * @param {object} sb           Supabase-Client
 * @param {object} opts
 * @param {string} opts.ownerId
 * @param {string} opts.leadId  Patienten-ID (aus leads.id)
 * @param {string} opts.sector  getSector()-Rückgabe
 * @param {Array}  opts.katalogPodo  GKV_LEISTUNGSKATALOG.podologie (nach applyGueltigePreise)
 *
 * @returns {Promise<Array>} Liste normalisierter Verordnungen:
 *   [{
 *     id, quelle:'podologie'|'physio', datum, titel,
 *     einheiten, behandlungen:[{id, datum, betrag, hinweis, zeilen:[{title,quantity,unit_price}]}],
 *     gesamt
 *   }]
 */
export async function verordnungenLaden(sb, { ownerId, leadId, sector, katalogPodo }) {
  if (!ownerId || !leadId) return [];

  // ── Podologie-Weg ──────────────────────────────────────────────────────────
  if (sector === 'podologie') {
    const { data: vords, error: vErr } = await sb
      .from('verordnungen')
      .select('id, ausstellungsdatum, diagnosegruppe, heilmittel_items, behandlungseinheiten, status, rezeptart')
      .eq('owner_id', ownerId)
      .eq('lead_id', leadId)
      .order('ausstellungsdatum', { ascending: false });
    if (vErr) { console.error('[verordnungenLaden:podo]', vErr); return []; }

    const vordIds = (vords || []).map(v => v.id);
    let behandlungenMap = {};
    if (vordIds.length) {
      const { data: behs, error: bErr } = await sb
        .from('podologie_behandlungen')
        .select('id, verordnung_id, behandlungsdatum, hpnr_codes, diagnosegruppe, betrag_gkv')
        .eq('owner_id', ownerId)
        .in('verordnung_id', vordIds)
        .order('behandlungsdatum', { ascending: true });
      if (bErr) { console.error('[verordnungenLaden:podo:behandlungen]', bErr); }
      for (const b of (behs || [])) {
        if (!behandlungenMap[b.verordnung_id]) behandlungenMap[b.verordnung_id] = [];
        behandlungenMap[b.verordnung_id].push(b);
      }
    }

    return (vords || []).map(v => {
      const behs = behandlungenMap[v.id] || [];
      const kpodo = katalogPodo || [];
      const heilmittelItems = Array.isArray(v.heilmittel_items) ? v.heilmittel_items : [];

      // Verordnungstitel aus heilmittel_items-Codes ermitteln
      let vordTitelStr = '';
      if (heilmittelItems.length) {
        const titels = heilmittelItems.map(it => {
          const entry = kpodo.find(k => k.code === String(it.code || it));
          return entry ? entry.title : null;
        }).filter(Boolean);
        vordTitelStr = titels.join(' · ');
      }
      if (!vordTitelStr) vordTitelStr = v.diagnosegruppe || 'Verordnung';

      const behandlungen = behs.map(b => {
        const { zeilen, hinweis } = _zeilenAusCodes(b, kpodo, vordTitelStr, b.betrag_gkv);
        const betrag = zeilen.reduce((s, z) => s + (z.quantity || 1) * (z.unit_price || 0), 0);
        return {
          id: b.id,
          datum: b.behandlungsdatum,
          betrag,
          hinweis,
          zeilen,
        };
      });

      const gesamt = behandlungen.reduce((s, b) => s + b.betrag, 0);

      return {
        id: v.id,
        quelle: 'podologie',
        datum: v.ausstellungsdatum,
        titel: vordTitelStr,
        einheiten: v.behandlungseinheiten || 0,
        behandlungen,
        gesamt,
        // Interna für _vordTitel (nicht Teil des öffentlichen Vertrags)
        _heilmittelItems: heilmittelItems,
        _diagnosegruppe: v.diagnosegruppe,
      };
    });
  }

  // ── Physio / Ergo / Logopädie-Weg ─────────────────────────────────────────
  const { data: rxs, error: rErr } = await sb
    .from('prescriptions')
    .select('id, ausstellungsdatum, diagnosegruppe, heilmittel, anzahl_einheiten, status, prescription_sessions(id, booking_id, status, done_at)')
    .eq('owner_id', ownerId)
    .eq('patient_id', leadId)
    .order('ausstellungsdatum', { ascending: false });
  if (rErr) { console.error('[verordnungenLaden:physio]', rErr); return []; }

  // Booking-IDs sammeln für Preisauflösung
  const allBookingIds = [];
  for (const rx of (rxs || [])) {
    for (const s of (rx.prescription_sessions || [])) {
      if (s.booking_id) allBookingIds.push(s.booking_id);
    }
  }

  let bookingsMap = {};
  if (allBookingIds.length) {
    const { data: bkgs } = await sb
      .from('bookings')
      .select('id, services(title, price, price_config)')
      .in('id', allBookingIds);
    for (const bk of (bkgs || [])) bookingsMap[bk.id] = bk;
  }

  const DONE_STATUS = ['done', 'completed'];

  return (rxs || []).map(rx => {
    const sessions = (rx.prescription_sessions || [])
      .filter(s => DONE_STATUS.includes(s.status));

    const rxTitel = rx.heilmittel || rx.diagnosegruppe || 'Behandlung';

    const behandlungen = sessions.map(s => {
      let zeilen;
      let hinweis = null;

      if (!s.booking_id) {
        zeilen = [{ title: rxTitel, quantity: 1, unit_price: 0 }];
        hinweis = 'kein Termin verknüpft';
      } else {
        const bk = bookingsMap[s.booking_id];
        const svc = bk?.services;
        let preis = parseFloat(svc?.price) || 0;
        if (!preis && svc?.price_config?.durations) {
          const dur = svc.price_config.durations;
          const first = Object.keys(dur).find(k => dur[k].active);
          preis = parseFloat(dur[first]?.price) || 0;
        }
        if (!preis) hinweis = 'kein Termin verknüpft';
        zeilen = [{ title: rxTitel, quantity: 1, unit_price: preis }];
      }

      const betrag = zeilen.reduce((s, z) => s + (z.quantity || 1) * (z.unit_price || 0), 0);
      return { id: s.id, datum: s.done_at, betrag, hinweis, zeilen };
    });

    const gesamt = behandlungen.reduce((s, b) => s + b.betrag, 0);

    return {
      id: rx.id,
      quelle: 'physio',
      datum: rx.ausstellungsdatum,
      titel: rxTitel,
      einheiten: rx.anzahl_einheiten || 0,
      behandlungen,
      gesamt,
      _heilmittel: rx.heilmittel,
      _diagnosegruppe: rx.diagnosegruppe,
    };
  });
}

/**
 * Zeichnet die Auswahlliste in `container`.
 *
 * Zustandslogik:
 *  - Verordnungszeile startet UNGEHAKT, Behandlungen starten GEHAKT.
 *  - Verordnung abhaken → alle Behandlungen mit.
 *  - Einzelne Behandlung ändern → Verordnungshaken wird checked / indeterminate.
 *  - Verordnung ohne Behandlungen → disabled mit Hinweis.
 *
 * @param {HTMLElement} container   Ziel-Element (wird geleert und befüllt)
 * @param {Array}       liste       Rückgabe von verordnungenLaden
 * @param {object}      deps
 * @param {Function}    deps.escapeHtml
 * @param {Function}    deps.formatEur
 * @param {Function}    deps.onAuswahl  Callback bei Änderung
 */
export function verordnungenRendern(container, liste, { escapeHtml, formatEur, onAuswahl }) {
  // Zustand zurücksetzen
  _liste = liste;
  _zustand = [];
  _onAuswahl = onAuswahl || null;

  if (!container) return;
  if (!liste || liste.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Startzustand: alle Behandlungen gehakt, Verordnung selbst ungehakt
  for (const vord of liste) {
    _zustand.push({
      vordId: vord.id,
      behandlungIds: new Set(vord.behandlungen.map(b => b.id)),
    });
  }

  container.innerHTML = '';

  for (let vi = 0; vi < liste.length; vi++) {
    const vord = liste[vi];
    const hasBeh = vord.behandlungen.length > 0;
    const anzahl = vord.behandlungen.length;
    const einheiten = vord.einheiten || 0;

    // ── Verordnungs-Kopfzeile ───────────────────────────────────────────────
    const vordRow = document.createElement('div');
    vordRow.style.cssText = [
      'display:flex', 'align-items:center', 'gap:8px',
      'padding:8px 10px', 'border-radius:var(--radius-sm)',
      'border:1px solid var(--border)', 'background:var(--bg-card)',
      'margin-bottom:2px', 'user-select:none',
    ].join(';');

    // Aufklapp-Pfeil
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.textContent = '▸';
    toggleBtn.style.cssText = [
      'background:none', 'border:none', 'cursor:pointer',
      'font-size:11px', 'padding:0 2px', 'color:var(--text-muted)',
      'flex-shrink:0', 'line-height:1', 'width:16px', 'text-align:center',
    ].join(';');
    if (!hasBeh) toggleBtn.style.visibility = 'hidden';

    // Verordnungs-Checkbox
    const vordCb = document.createElement('input');
    vordCb.type = 'checkbox';
    vordCb.id = 'vord-cb-' + vi;
    vordCb.checked = false;
    vordCb.disabled = !hasBeh;
    vordCb.style.cssText = 'flex-shrink:0;cursor:' + (hasBeh ? 'pointer' : 'default');

    // Beschriftung
    const label = document.createElement('label');
    label.setAttribute('for', 'vord-cb-' + vi);
    label.style.cssText = [
      'flex:1', 'min-width:0', 'cursor:' + (hasBeh ? 'pointer' : 'default'),
      'display:flex', 'flex-direction:column', 'gap:1px',
    ].join(';');

    const titelSpan = document.createElement('span');
    titelSpan.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-main);';
    titelSpan.textContent = _datumDE(vord.datum) + ' · ' + vord.titel;

    const metaSpan = document.createElement('span');
    metaSpan.style.cssText = 'font-size:11px;color:var(--text-muted);';
    if (!hasBeh) {
      metaSpan.textContent = 'noch keine Behandlung dokumentiert';
    } else {
      const einheitenHinweis = einheiten > 0 ? ' von ' + einheiten : '';
      metaSpan.textContent = anzahl + einheitenHinweis + ' Behandlung' + (anzahl !== 1 ? 'en' : '') + ' dokumentiert';
    }

    label.appendChild(titelSpan);
    label.appendChild(metaSpan);

    // Betrag rechtsbündig
    const betragSpan = document.createElement('span');
    betragSpan.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-main);flex-shrink:0;';
    betragSpan.textContent = hasBeh ? formatEur(vord.gesamt) : '—';

    vordRow.appendChild(toggleBtn);
    vordRow.appendChild(vordCb);
    vordRow.appendChild(label);
    vordRow.appendChild(betragSpan);
    container.appendChild(vordRow);

    // ── Unterzeilen (Behandlungen) ─────────────────────────────────────────
    const subList = document.createElement('div');
    subList.style.cssText = [
      'display:none', 'margin-left:32px', 'margin-bottom:4px',
      'border-left:2px solid var(--border)', 'padding-left:8px',
    ].join(';');

    const subCbs = [];
    for (let bi = 0; bi < vord.behandlungen.length; bi++) {
      const beh = vord.behandlungen[bi];
      const subRow = document.createElement('label');
      subRow.style.cssText = [
        'display:flex', 'align-items:center', 'gap:8px',
        'padding:4px 6px', 'border-radius:var(--radius-sm)',
        'font-size:12px', 'cursor:pointer',
        'color:var(--text-main)',
      ].join(';');
      subRow.addEventListener('mouseenter', () => { subRow.style.background = 'var(--bg-hover)'; });
      subRow.addEventListener('mouseleave', () => { subRow.style.background = ''; });

      const subCb = document.createElement('input');
      subCb.type = 'checkbox';
      subCb.checked = true; // alle Behandlungen starten gehakt
      subCb.dataset.vordIdx = vi;
      subCb.dataset.behId = beh.id;
      subCbs.push(subCb);

      const datumSpan = document.createElement('span');
      datumSpan.style.cssText = 'color:var(--text-muted);flex-shrink:0;';
      datumSpan.textContent = _datumDE(beh.datum);

      const betragBeh = document.createElement('span');
      betragBeh.style.cssText = 'margin-left:auto;font-weight:600;flex-shrink:0;';
      betragBeh.textContent = formatEur(beh.betrag);

      subRow.appendChild(subCb);
      subRow.appendChild(datumSpan);

      if (beh.hinweis) {
        const hw = document.createElement('span');
        hw.style.cssText = 'color:var(--text-muted);font-style:italic;';
        hw.textContent = escapeHtml(beh.hinweis);
        subRow.appendChild(hw);
      }

      subRow.appendChild(betragBeh);
      subList.appendChild(subRow);

      // Behandlungs-Checkbox-Handler
      subCb.addEventListener('change', () => {
        const zst = _zustand[vi];
        if (subCb.checked) {
          zst.behandlungIds.add(beh.id);
        } else {
          zst.behandlungIds.delete(beh.id);
        }
        // Verordnungshaken aktualisieren
        const total = vord.behandlungen.length;
        const checked = zst.behandlungIds.size;
        if (checked === 0) {
          vordCb.checked = false;
          vordCb.indeterminate = false;
        } else if (checked === total) {
          vordCb.checked = true;
          vordCb.indeterminate = false;
        } else {
          vordCb.checked = false;
          vordCb.indeterminate = true;
        }
        if (_onAuswahl) _onAuswahl();
      });
    }

    // Verordnungs-Checkbox-Handler
    vordCb.addEventListener('change', () => {
      const zst = _zustand[vi];
      if (vordCb.checked) {
        // Alle Behandlungen haken
        for (const b of vord.behandlungen) zst.behandlungIds.add(b.id);
        for (const sc of subCbs) sc.checked = true;
        vordCb.indeterminate = false;
      } else {
        // Alle Behandlungen abhaken
        zst.behandlungIds.clear();
        for (const sc of subCbs) sc.checked = false;
        vordCb.indeterminate = false;
      }
      if (_onAuswahl) _onAuswahl();
    });

    // Aufklapp-Pfeil-Handler
    if (hasBeh) {
      toggleBtn.addEventListener('click', () => {
        const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        toggleBtn.setAttribute('aria-expanded', String(!expanded));
        toggleBtn.textContent = expanded ? '▸' : '▾';
        subList.style.display = expanded ? 'none' : 'block';
      });
    }

    container.appendChild(subList);

    // Hover-Effekt auf Verordnungszeile
    vordRow.addEventListener('mouseenter', () => {
      if (hasBeh) vordRow.style.background = 'var(--bg-hover)';
    });
    vordRow.addEventListener('mouseleave', () => {
      vordRow.style.background = 'var(--bg-card)';
    });
  }
}

/**
 * Gibt den aktuellen Auswahlstand zurück.
 *
 * @returns {{
 *   zeilen: Array,           // {title, quantity, unit_price} — für invLines
 *   prescriptionId: string|null,  // nur wenn genau eine Physio-Verordnung gewählt
 *   notizZeile: string|null,      // Podologie-Bezug für invoices.notes
 *   anzahl: number                // Anzahl gewählter Behandlungen
 * }}
 */
export function verordnungAuswahl() {
  const zeilen = [];
  let physioIds = [];  // gewählte prescriptions.id aus Physio-Topf
  const notizTeile = [];

  for (let vi = 0; vi < _liste.length; vi++) {
    const vord = _liste[vi];
    const zst = _zustand[vi];
    if (!zst || zst.behandlungIds.size === 0) continue;

    // Behandlungen, die gehakt sind
    for (const beh of vord.behandlungen) {
      if (!zst.behandlungIds.has(beh.id)) continue;
      zeilen.push(...beh.zeilen);
    }

    if (vord.quelle === 'physio') {
      physioIds.push(vord.id);
    } else if (vord.quelle === 'podologie') {
      notizTeile.push('Verordnung vom ' + _datumDE(vord.datum) + ' (ID: ' + vord.id + ')');
    }
  }

  const prescriptionId = physioIds.length === 1 ? physioIds[0] : null;
  const notizZeile = notizTeile.length ? notizTeile.join(' · ') : null;

  return { zeilen, prescriptionId, notizZeile, anzahl: zeilen.length };
}
