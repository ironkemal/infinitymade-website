/**
 * patientenkarte.js — Kopf der Patientenakte: Stammdaten und Verlauf.
 *
 * Warum es das gibt
 * ─────────────────
 * Zwei Beobachtungen aus dem Beta-Gespräch (12.08.2026):
 *
 *   Kemal: „Patientenkarte ist immer noch vom alten geblieben, wir müssen
 *           mit neuen … würde ich nicht alles zeigen, sondern nur Datum und
 *           was du gemacht hast."
 *   Nausad: „Genau, und wenn ich anklicke, dass automatisch die Maske,
 *            dass ich dorthin gehe."
 *
 * Der Kopf zeigte zwölf gleich gewichtete Felder — darunter „Entfernung",
 * „Fahrzeit" und den alten CRM-Status. In einer Behandlung braucht niemand
 * die Fahrzeit; gebraucht werden Name, Geburtsdatum, Kasse, Versichertennummer.
 * Der Rest hat den Blick verdünnt.
 *
 * Neu daneben: der **Verlauf** — eine Zeile je Ereignis, nur Datum und was
 * passiert ist, neueste zuerst. Ein Klick springt in die zuständige Maske.
 * Bisher musste man dafür durch zehn Reiter blättern und selbst zusammenlegen,
 * was wann war.
 *
 * Was hier NICHT passiert
 * ───────────────────────
 * Kein Schreiben. Diese Datei liest und zeigt. Die Reiter (Notizen, Anamnese,
 * Rezepte, …) bleiben, wo sie sind — der Verlauf ist der Einstieg, nicht ihr
 * Ersatz.
 */

'use strict';

const DE = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('de-DE');
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Stammdaten-Kopf
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {HTMLElement} grid       Zielelement (#pdInfoGrid)
 * @param {object} lead            Patient aus `leads`
 * @param {object} deps            { name: (lead)=>string, icons: {car} }
 */
export function renderStammdaten(grid, lead, deps = {}) {
  if (!grid) return;
  const md = lead.metadata || {};
  const name = deps.name ? deps.name(lead) : `${lead.first_name || ''} ${lead.last_name || ''}`.trim();

  const geburt = lead.geburtsdatum || md.geburtsdatum || '';
  const alter = berechneAlter(geburt);
  const adresse = [lead.street, [lead.plz, lead.city].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ') || '—';

  // Festnetz und Handy stehen getrennt in der Akte (seit 14.08.2026) — hier
  // in einer Zeile, aber beschriftet, damit erkennbar bleibt welche Nummer
  // welche ist.
  const tel = [
    lead.phone ? `${esc(lead.phone)} <span style="color:var(--text-muted);font-size:11px;">Festnetz</span>` : null,
    lead.handy ? `${esc(lead.handy)} <span style="color:var(--text-muted);font-size:11px;">Handy</span>` : null,
  ].filter(Boolean).join('<br>') || '—';

  const GESCHLECHT = { m: 'männlich', f: 'weiblich', d: 'divers' };
  const sex = GESCHLECHT[lead.geschlecht || md.geschlecht] || '—';

  // Reihenfolge = Häufigkeit im Gebrauch. Die frühere Karte zeigte
  // Entfernung, Fahrzeit und den CRM-Status gleichrangig neben dem Namen;
  // die ersten beiden gehören zur Fahrtenplanung, der dritte existiert nicht
  // mehr (siehe module/abrechnungsstatus.js).
  const felder = [
    ['Name', esc(name) || '—'],
    ['Geburtsdatum', geburt ? `${DE(geburt)}${alter ? ` <span style="color:var(--text-muted);font-size:11px;">${alter} J.</span>` : ''}` : '—'],
    ['Geschlecht', esc(sex)],
    ['Krankenkasse', esc(lead.krankenkasse || md.krankenkasse || '—')],
    ['Versicherten-Nr.', esc(lead.versichertennummer || md.krankenkassennummer || '—')],
    ['Telefon', tel],
    ['E-Mail', esc(lead.email || '—')],
    ['Adresse', esc(adresse)],
  ];

  if (md.hausbesuch) {
    const auto = deps.icons?.car
      ? `<span class="svg-icon" style="width:14px;height:14px;display:inline-flex;">${deps.icons.car}</span> `
      : '';
    const weg = lead.distance_km != null
      ? ` <span style="color:var(--text-muted);font-size:11px;">${Number(lead.distance_km).toFixed(1)} km${lead.duration_min != null ? ` · ${lead.duration_min} min` : ''}</span>`
      : '';
    felder.push(['Hausbesuch', `${auto}Ja${weg}`]);
  }

  grid.innerHTML = felder.map(([label, wert]) => `
    <div>
      <div style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px;">${label}</div>
      <div style="font-weight:500;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">${wert}</div>
    </div>`).join('');
}

function berechneAlter(iso) {
  if (!iso) return null;
  const g = new Date(iso);
  if (isNaN(g)) return null;
  const heute = new Date();
  let a = heute.getFullYear() - g.getFullYear();
  const m = heute.getMonth() - g.getMonth();
  if (m < 0 || (m === 0 && heute.getDate() < g.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Verlauf
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Alle datierten Ereignisse eines Patienten, neueste zuerst.
 *
 * Eine Abfrage je Quelle, parallel. Fehlschläge einzelner Quellen werden
 * geschluckt: ein Verlauf ohne Rechnungen ist brauchbar, eine leere Karte
 * wegen einer fehlenden Tabelle nicht.
 *
 * @returns {Promise<Array<{datum:string, art:string, text:string, ziel:string, id:string}>>}
 */
export async function ladeVerlauf(sb, ownerId, leadId) {
  const frag = (p) => p.then(r => r.data || []).catch(() => []);

  // Achtung Spaltennamen (gegen db/SCHEMA.sql geprüft, nicht geraten):
  //   • `podologie_behandlungen` hat KEIN lead_id — die Behandlung hängt an der
  //     Verordnung. Deshalb erst die Verordnungen, dann deren Behandlungen.
  //   • `pat_fussbefund` heisst lead_id und datiert über `erstellt_am`.
  //   • `bookings` führt keinen Leistungsnamen, nur `service_id` → Join.
  //   • `prescriptions` (Physio-Topf) heisst dagegen patient_id.
  const [termine, verordnungen, rezepte, befunde] = await Promise.all([
    frag(sb.from('bookings')
      .select('id, start_time, status, services:service_id (title)')
      .eq('owner_id', ownerId).eq('lead_id', leadId)
      .order('start_time', { ascending: false }).limit(50)),
    frag(sb.from('verordnungen')
      .select('id, ausstellungsdatum, diagnosegruppe, status, rezeptart')
      .eq('owner_id', ownerId).eq('lead_id', leadId)
      .order('ausstellungsdatum', { ascending: false }).limit(50)),
    frag(sb.from('prescriptions')
      .select('id, ausstellungsdatum, diagnosegruppe, status')
      .eq('owner_id', ownerId).eq('patient_id', leadId)
      .order('ausstellungsdatum', { ascending: false }).limit(50)),
    frag(sb.from('pat_fussbefund')
      .select('id, erstellt_am')
      .eq('owner_id', ownerId).eq('lead_id', leadId)
      .order('erstellt_am', { ascending: false }).limit(50)),
  ]);

  const behandlungen = verordnungen.length
    ? await frag(sb.from('podologie_behandlungen')
        .select('id, behandlungsdatum, hpnr_codes, verordnung_id')
        .eq('owner_id', ownerId)
        .in('verordnung_id', verordnungen.map(v => v.id))
        .order('behandlungsdatum', { ascending: false }).limit(100))
    : [];

  const STATUS_TERMIN = {
    completed: 'wahrgenommen', cancelled: 'abgesagt',
    no_show: 'nicht erschienen', confirmed: 'bestätigt',
  };

  const zeilen = [
    ...termine.map(t => ({
      datum: t.start_time, art: 'Termin', ziel: 'kalender', id: t.id,
      text: [t.services?.title, STATUS_TERMIN[t.status]].filter(Boolean).join(' · ') || 'Termin',
    })),
    ...verordnungen.map(v => ({
      datum: v.ausstellungsdatum, art: 'Verordnung', ziel: 'podologie', id: v.id,
      text: [v.diagnosegruppe, v.rezeptart && v.rezeptart !== 'kassen' ? v.rezeptart : null]
        .filter(Boolean).join(' · ') || 'Verordnung',
    })),
    ...behandlungen.map(b => ({
      datum: b.behandlungsdatum, art: 'Behandlung', ziel: 'podologie', id: b.id,
      text: (b.hpnr_codes || []).join(', ') || 'Behandlung',
    })),
    ...rezepte.map(r => ({
      datum: r.ausstellungsdatum, art: 'Rezept', ziel: 'verordnungen', id: r.id,
      text: r.diagnosegruppe || 'Rezept',
    })),
    ...befunde.map(f => ({
      datum: f.erstellt_am, art: 'Fußbefund', ziel: 'fussbefund', id: f.id,
      text: 'Fußbefund erhoben',
    })),
  ].filter(z => z.datum);

  zeilen.sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  return zeilen;
}

const FARBE = {
  Termin:      '#2563eb',
  Verordnung:  '#7c3aed',
  Behandlung:  '#15803d',
  Rezept:      '#7c3aed',
  'Fußbefund': '#c2410c',
};

/**
 * Verlauf zeichnen. `onSprung(ziel, id)` wird beim Klick auf eine Zeile
 * gerufen — das Springen selbst kennt nur dashboard.js.
 */
export function renderVerlauf(el, zeilen, onSprung) {
  if (!el) return;

  if (!zeilen.length) {
    el.innerHTML = '<div class="pd-empty">Noch nichts dokumentiert.</div>';
    return;
  }

  el.innerHTML = zeilen.map(z => `
    <button type="button" class="pk-verlauf-zeile" data-ziel="${esc(z.ziel)}" data-id="${esc(z.id)}"
      style="display:grid;grid-template-columns:92px 108px 1fr;gap:10px;align-items:baseline;width:100%;
             text-align:left;padding:8px 10px;border:0;border-bottom:1px solid var(--border);
             background:transparent;color:var(--text-main);font-size:13px;cursor:pointer;">
      <span style="color:var(--text-muted);">${DE(z.datum)}</span>
      <span style="color:${FARBE[z.art] || 'var(--text-muted)'};font-weight:600;font-size:12px;">${esc(z.art)}</span>
      <span>${esc(z.text)}</span>
    </button>`).join('');

  el.querySelectorAll('.pk-verlauf-zeile').forEach(b => {
    b.addEventListener('click', () => onSprung?.(b.dataset.ziel, b.dataset.id));
  });
}

/** Kopf + Verlauf in einem Aufruf — das ist die Schnittstelle für dashboard.js. */
export async function renderPatientenkarte(lead, deps = {}) {
  renderStammdaten(document.getElementById('pdInfoGrid'), lead, deps);

  const verlaufEl = document.getElementById('pdVerlaufContent');
  if (!verlaufEl || !deps.sb || !deps.ownerId) return;
  verlaufEl.innerHTML = '<div class="pd-empty">Laden…</div>';
  const zeilen = await ladeVerlauf(deps.sb, deps.ownerId, lead.id);
  renderVerlauf(verlaufEl, zeilen, deps.onSprung);
}
