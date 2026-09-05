/**
 * selbstzahler-stufen.js — benennbare Selbstzahler-Preisstufen und der zuletzt
 * bei einem Patienten berechnete Betrag.
 *
 * Warum es das gibt
 * ─────────────────
 * Beta-2, 05.09.2026: Die Praxis nimmt für dieselbe Behandlung nicht von jedem
 * denselben Betrag — Bestandspatienten zahlen weniger als neue, ein Hausbesuch
 * kostet mehr. Bisher hiess das: bei jeder Rechnung erinnern, was man beim
 * letzten Mal genommen hat, und den Betrag von Hand tippen. Das ging schief,
 * sobald zwei Personen abrechneten oder ein paar Monate dazwischen lagen —
 * derselbe Patient bekam zwei verschiedene Preise.
 *
 * Zwei Hälften, und die zweite ist die wichtigere:
 *
 *   1. **Preisstufen** — die Praxis benennt 2 bis 6 Stufen selbst („SB1
 *      Bestandspatient", „Hausbesuch"). Ein Klick setzt den Betrag.
 *   2. **Zuletzt berechnet** — was dieser Patient beim letzten Mal bezahlt hat,
 *      steht direkt daneben. Das trifft den eigentlichen Schmerz: die Stufe
 *      braucht man nur beim ersten Besuch, danach zählt die eigene Historie.
 *
 * Warum keine Versionierung der Stufen
 * ────────────────────────────────────
 * Naheliegend wäre, in der Rechnungszeile die *Stufe* zu vermerken und den
 * Betrag daraus abzuleiten. Genau das darf nicht passieren: ändert die Praxis
 * später „SB2" von 68 € auf 74 €, würde eine zwei Jahre alte Rechnung
 * rückwirkend einen anderen Betrag zeigen. Deshalb wandert immer nur die
 * **Zahl** in `invoices.line_items` — die Stufe ist ein Eingabehelfer, keine
 * Referenz. Die GoBD-Festschreibung (`invoice_festschreibung()`, friert alles
 * ausserhalb von `status = 'draft'` ein) hält diese Zahl danach ohnehin fest.
 *
 * Warum die Stufen in `profiles` liegen
 * ─────────────────────────────────────
 * Owner-Einstellung, kein Standort-Merkmal — und Einzelpraxen haben gar keine
 * `businesses`-Zeile (CLAUDE.md → Multi-tenant). Direkte Vorbilder in derselben
 * Tabelle: `fussbefund_legende` (ebenfalls eine vom Owner benannte Liste als
 * jsonb) und `ausfall_amount_eur` (ebenfalls ein Betrag auf Owner-Ebene).
 *
 * Warum nicht in `services.price_config`
 * ──────────────────────────────────────
 * Dessen Schlüssel sind Minutenzahlen, und der Rest des Codes verlässt sich
 * darauf: `dashboard.js:9968` zeichnet nur die 14 bekannten Minutenwerte, und
 * die Speicherschleife (`dashboard.js:10043`) läuft über das DOM — ein Schlüssel
 * „sb1" würde beim nächsten Speichern der Leistung **stillschweigend gelöscht**.
 * Dazu kämen `parseInt`-Sortierung und vier Stellen, die „erste aktive Dauer"
 * als Preis lesen. Eine Preisstufe ist keine Dauer.
 */

/** Mehr als sechs Stufen sind keine Stufen mehr, sondern eine Preisliste. */
export const STUFEN_MAX = 6;

const NAME_MAX = 40;

/**
 * Bringt die rohe jsonb-Spalte in eine Form, auf die sich die Oberfläche
 * verlassen kann. Defensiv, weil die Spalte per Hand in der DB stehen kann und
 * weil `[]` der Default ist.
 *
 * Verworfen wird nur, was unbrauchbar ist: kein Name oder kein positiver
 * Betrag. Eine Stufe mit 0 € wäre kein Eingabehelfer, sondern eine Falle.
 */
export function normalisiereStufen(roh) {
  if (!Array.isArray(roh)) return [];
  const gesehen = new Set();
  const raus = [];
  for (const e of roh) {
    if (!e || typeof e !== 'object') continue;
    const name = String(e.name ?? '').trim().slice(0, NAME_MAX);
    const betrag = Number(e.betrag_eur);
    if (!name) continue;
    if (!Number.isFinite(betrag) || betrag <= 0) continue;
    let id = String(e.id ?? '').trim();
    if (!id || gesehen.has(id)) id = neueStufenId(raus.length);
    gesehen.add(id);
    raus.push({ id, name, betrag_eur: Math.round(betrag * 100) / 100 });
    if (raus.length >= STUFEN_MAX) break;
  }
  return raus;
}

/**
 * Ids werden nie wiederverwendet und nie interpretiert — sie halten nur die
 * Zeilen der Bearbeitungsliste auseinander.
 */
export function neueStufenId(index = 0) {
  return `st${Date.now().toString(36)}${index}`;
}

/** Die gepflegten Stufen eines Profils, in der Form, die die Oberfläche braucht. */
export function stufenAusProfil(profile) {
  return normalisiereStufen(profile?.selbstzahler_stufen);
}

/**
 * Was wurde diesem Patienten zuletzt berechnet?
 *
 * Quelle ist `invoices`, nicht eine neue Spalte: der Betrag, den der Patient
 * tatsächlich bezahlt hat, steht bereits in `line_items` — und dort GoBD-fest.
 * Eine zweite Ablage desselben Betrags könnte nur auseinanderlaufen.
 *
 * Drei Feinheiten, jede einzeln in der Datenbank nachgesehen:
 *   • Die Spalte heisst `patient_id`, nicht `lead_id`. `saveInvoice()` schreibt
 *     `patient_id`; über `lead_id` kommt nichts zurück.
 *   • `status = 'draft'` fliegt raus. Ein unfertiger Entwurf ist keine
 *     Preisauskunft, und genau diese Entwürfe enthalten Tippfehler.
 *   • `invoice_type` taugt nicht als Filter — die Spalte ist in allen
 *     bestehenden Zeilen NULL. Deshalb wird nach Titel gruppiert, nicht nach
 *     Abrechnungsart.
 *
 * Zurück kommt je Leistungsbezeichnung der **jüngste** Betrag, nicht der
 * häufigste: gefragt ist „was habe ich zuletzt genommen", nicht ein Mittelwert.
 * Ein Median würde hier ausserdem die Falle aus `termin-dauer.js` öffnen — das
 * System würde seinen eigenen Vorschlag wieder einlesen und bestätigen.
 */
export async function ladeLetztePreise(supabase, patientId, opts = {}) {
  const maxEintraege = opts.maxEintraege || 3;
  if (!supabase || !patientId) return [];
  const { data, error } = await supabase
    .from('invoices')
    .select('line_items, issued_at, created_at, status')
    .eq('patient_id', patientId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    console.warn('[selbstzahler-stufen] letzte Preise:', error.message);
    return [];
  }
  return letztePreiseAusRechnungen(data || [], maxEintraege);
}

/**
 * Der reine Teil von `ladeLetztePreise` — ohne Datenbank, damit er prüfbar ist.
 * Erwartet die Rechnungen bereits absteigend sortiert.
 */
export function letztePreiseAusRechnungen(rechnungen, maxEintraege = 3) {
  const jeTitel = new Map();
  for (const r of rechnungen || []) {
    const datum = r?.issued_at || r?.created_at || null;
    for (const l of Array.isArray(r?.line_items) ? r.line_items : []) {
      const titel = String(l?.title ?? '').trim();
      const betrag = Number(l?.unit_price);
      if (!titel) continue;
      if (!Number.isFinite(betrag) || betrag <= 0) continue;
      if (jeTitel.has(titel)) continue;      // die erste Fundstelle ist die jüngste
      jeTitel.set(titel, { title: titel, betrag_eur: betrag, datum });
      if (jeTitel.size >= maxEintraege) return [...jeTitel.values()];
    }
  }
  return [...jeTitel.values()];
}

// ── Einstellungen ───────────────────────────────────────────────────────────
// Aufbau bewusst wie `renderLegendeSettings` in module/fussbefund.js: dieselbe
// Stelle im Menü, dieselbe Owner-Prüfung, dasselbe „Entwurf erst beim
// Speichern übernehmen". Zwei benachbarte Listen in denselben Einstellungen
// sollen sich nicht unterschiedlich bedienen lassen.

let stufenEntwurf = [];

/**
 * Der Entwurf ist eine Kopie. Solange nicht gespeichert wurde, darf eine offene
 * Rechnung nichts von der Bearbeitung mitbekommen.
 */
export async function renderPreisstufenSettings(deps) {
  const section = document.getElementById('settingsPreisstufenSection');
  if (!section) return;

  const zeigen = deps.profile?.role === 'owner';
  section.hidden = !zeigen;
  if (!zeigen) return;

  const ownerId = deps.ownerId();
  let gespeichert = stufenAusProfil(deps.profile);
  if (ownerId) {
    const { data } = await deps.supabase
      .from('profiles').select('selbstzahler_stufen').eq('id', ownerId).maybeSingle();
    if (data) gespeichert = normalisiereStufen(data.selbstzahler_stufen);
  }
  stufenEntwurf = gespeichert.map(e => ({ ...e }));
  zeichneStufenListe(deps);

  if (section.dataset.wired) return;
  section.dataset.wired = '1';

  document.getElementById('setStufenAddBtn')?.addEventListener('click', () => {
    if (stufenEntwurf.length >= STUFEN_MAX) {
      deps.showToast(`Mehr als ${STUFEN_MAX} Preisstufen werden unübersichtlich.`, 'error');
      return;
    }
    stufenEntwurf.push({ id: neueStufenId(stufenEntwurf.length), name: '', betrag_eur: null });
    zeichneStufenListe(deps);
    // In den Cursor der neuen Zeile springen: jede Zeile hat zwei Inputs, ein
    // `:last-of-type` im Selektor traefe deshalb das Betragsfeld — hier zaehlt
    // die letzte Namenszeile.
    const namen = document.querySelectorAll('#setStufenList .stufe-name');
    namen[namen.length - 1]?.focus();
  });

  document.getElementById('setStufenSaveBtn')?.addEventListener('click', () => speichereStufen(deps));
}

function zeichneStufenListe(deps) {
  const wrap = document.getElementById('setStufenList');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!stufenEntwurf.length) {
    const leer = document.createElement('p');
    leer.style.cssText = 'margin:0 0 4px;font-size:13px;color:var(--text-muted);';
    leer.textContent = 'Noch keine Preisstufe angelegt.';
    wrap.appendChild(leer);
    return;
  }

  stufenEntwurf.forEach((stufe, i) => {
    const zeile = document.createElement('div');
    zeile.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;';

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'form-input stufe-name';
    name.placeholder = 'z. B. SB1 Bestandspatient';
    name.maxLength = NAME_MAX;
    name.value = stufe.name || '';
    name.style.cssText = 'flex:1;min-width:180px;';
    name.addEventListener('input', () => { stufenEntwurf[i].name = name.value; });

    const betrag = document.createElement('input');
    betrag.type = 'number';
    betrag.className = 'form-input';
    betrag.placeholder = '0,00';
    betrag.step = '0.01';
    betrag.min = '0';
    betrag.value = stufe.betrag_eur ?? '';
    betrag.style.width = '110px';
    betrag.addEventListener('input', () => {
      const v = parseFloat(betrag.value);
      stufenEntwurf[i].betrag_eur = Number.isFinite(v) ? v : null;
    });

    const weg = document.createElement('button');
    weg.type = 'button';
    weg.className = 'btn-ghost';
    weg.textContent = '✕';
    weg.title = 'Stufe entfernen';
    weg.addEventListener('click', () => {
      stufenEntwurf.splice(i, 1);
      zeichneStufenListe(deps);
    });

    zeile.appendChild(name);
    zeile.appendChild(betrag);
    zeile.appendChild(weg);
    wrap.appendChild(zeile);
  });
}

async function speichereStufen(deps) {
  const btn = document.getElementById('setStufenSaveBtn');
  const sauber = normalisiereStufen(stufenEntwurf);

  // Halb ausgefüllte Zeilen still zu verschlucken wäre schlimmer als eine
  // Fehlermeldung: der Owner glaubt sonst, die Stufe sei angelegt.
  if (stufenEntwurf.length && sauber.length !== stufenEntwurf.length) {
    deps.showToast('Bitte jeder Stufe einen Namen und einen Betrag über 0 € geben.', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const { error } = await deps.supabase
    .from('profiles')
    .update({ selbstzahler_stufen: sauber })
    .eq('id', deps.ownerId());
  if (btn) { btn.disabled = false; btn.textContent = 'Speichern'; }

  if (error) {
    console.error('[selbstzahler-stufen] speichern:', error.message);
    deps.showToast('Fehler beim Speichern: ' + error.message, 'error');
    return;
  }

  // Den lokalen Profil-Cache nachziehen, damit der Rechnungs-Dialog die neuen
  // Stufen sofort anbietet — ohne Neuladen der Seite.
  if (deps.profile) deps.profile.selbstzahler_stufen = sauber;
  stufenEntwurf = sauber.map(e => ({ ...e }));
  zeichneStufenListe(deps);
  deps.showToast('Preisstufen gespeichert ✓');
}
