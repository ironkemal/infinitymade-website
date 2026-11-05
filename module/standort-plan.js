/**
 * standort-plan.js — Standortplan je Mitarbeiter pflegen (Physio/PILOT-PLAN.md M4c, AUTOPILOT S5).
 *
 * Reiter „Standorte" im Team-Panel, nur Inhaber, nur bei mehr als einem Standort. Schreibt
 * employee_standort_plan (0097): Wochenmuster (weekday) und Einzeltage (datum). Die Regel, die den Plan
 * liest, steht in standort-plan-regel.js (Einzeltag -> Wochenmuster -> alle) und wird hier für die
 * Warnliste wiederverwendet, nicht nachgebaut.
 *
 * „Versetzen" = Einzeltage für einen Zeitraum (von–bis) an anderen Standort(en). Termine werden NIE
 * automatisch verschoben: vor dem Speichern zeigt eine Warnliste die künftigen Termine, die danach am
 * falschen Standort lägen; jede Zeile öffnet den Termin zum Umbuchen (physio 01.11.2026).
 * Wochenmuster in Versionen (gueltig_ab, 0098): „Änderung gilt ab" legt eine geplante Umstellung an.
 * Zeitfenster (0109): je Häkchen optional von–bis (z. B. Mo 8–12 A, 14–18 B). Leer = ganzer Tag. Einzeltage
 * bleiben ganztägig. Nur die Uhrzeit geändert -> UPDATE derselben Zeile (Insert scheiterte am UNIQUE).
 */
import { imZeitfenster, zeitInMinuten } from './standort-plan-regel.js?v=20261104zeit';

/** Anzeige Mo..So, gespeichert wie JS getDay (0 = Sonntag). */
export const WOCHENTAGE = [
  { weekday: 1, kurz: 'Mo' }, { weekday: 2, kurz: 'Di' }, { weekday: 3, kurz: 'Mi' },
  { weekday: 4, kurz: 'Do' }, { weekday: 5, kurz: 'Fr' }, { weekday: 6, kurz: 'Sa' }, { weekday: 0, kurz: 'So' },
];

/** Höchstens so viele Tage legt ein Versetzen-Zeitraum an. */
export const MAX_VERSETZEN_TAGE = 62;
/** Warnliste schaut so viele Tage nach vorn. */
export const WARN_TAGE = 120;

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const musterSchluessel = (weekday, businessId) => `${weekday}|${businessId}`;

/** gueltig_ab einer Wochenzeile als 'YYYY-MM-DD' oder null (= seit immer). */
export function gueltigAb(wert) {
  if (typeof wert !== 'string') return null;
  const tag = wert.slice(0, 10);
  return DATUM_RE.test(tag) ? tag : null;
}

const istWoche = z => z && z.datum == null && z.weekday != null && z.weekday !== '' && z.business_id;
/** null zählt als „älter als jedes Datum". */
const aelter = (a, b) => (a === null ? b !== null : b !== null && a < b);

/** Heute gültige Musterversion (größtes gueltig_ab <= heute, null = seit immer); undefined = gar kein Muster. */
export function aktuelleVersion(zeilen, heute) {
  let version;
  for (const z of Array.isArray(zeilen) ? zeilen : []) {
    if (!istWoche(z)) continue;
    const g = gueltigAb(z.gueltig_ab);
    if (g !== null && g > heute) continue;
    if (version === undefined || aelter(version, g)) version = g;
  }
  return version;
}

/** Künftige Versionen (gueltig_ab > heute), aufsteigend. */
export function kuenftigeVersionen(zeilen, heute) {
  const set = new Set();
  for (const z of Array.isArray(zeilen) ? zeilen : []) {
    const g = istWoche(z) ? gueltigAb(z.gueltig_ab) : null;
    if (g !== null && g > heute) set.add(g);
  }
  return [...set].sort();
}

/** Wochenmuster-Zeilen einer Version -> Set "weekday|business_id". Ohne Version: alle mit gueltig_ab null. */
export function musterAusZeilen(zeilen, version = null) {
  const muster = new Set();
  for (const z of Array.isArray(zeilen) ? zeilen : []) {
    if (istWoche(z) && gueltigAb(z.gueltig_ab) === (version ?? null)) muster.add(musterSchluessel(Number(z.weekday), z.business_id));
  }
  return muster;
}

const hhmm = wert => (typeof wert === 'string' && /^\d{2}:\d{2}/.test(wert) ? wert.slice(0, 5) : '');

/** Zeitfenster der Wochenmuster-Zeilen einer Version -> Map "weekday|business_id" -> {von, bis} ('HH:MM' oder ''). */
export function fensterAusZeilen(zeilen, version = null) {
  const fenster = new Map();
  for (const z of Array.isArray(zeilen) ? zeilen : []) {
    if (!istWoche(z) || gueltigAb(z.gueltig_ab) !== (version ?? null)) continue;
    const von = hhmm(z.von);
    const bis = hhmm(z.bis);
    if (von && bis) fenster.set(musterSchluessel(Number(z.weekday), z.business_id), { von, bis });
  }
  return fenster;
}

/** Fehlertext für ein ungültiges Fenster, sonst null. Beide leer = ganzer Tag. */
export function fensterFehler(fenster) {
  for (const [, f] of fenster || []) {
    const von = f?.von || '';
    const bis = f?.bis || '';
    if (!von && !bis) continue;
    if (!von || !bis) return 'Bitte bei einem Zeitfenster Beginn und Ende angeben (oder beide leer lassen = ganzer Tag).';
    if (zeitInMinuten(von) === null || zeitInMinuten(bis) === null || zeitInMinuten(von) >= zeitInMinuten(bis)) {
      return 'Das Zeitfenster muss vor dem Ende beginnen.';
    }
  }
  return null;
}

/** Einzeltage ab heute -> Map datum -> [business_id], nach Datum sortiert. Vergangene bleiben unangetastet. */
export function einzeltageAusZeilen(zeilen, heute) {
  const tage = new Map();
  for (const z of Array.isArray(zeilen) ? zeilen : []) {
    if (!z || typeof z.datum !== 'string' || !z.business_id) continue;
    const tag = z.datum.slice(0, 10);
    if (heute && tag < heute) continue;
    if (!tage.has(tag)) tage.set(tag, []);
    if (!tage.get(tag).includes(z.business_id)) tage.get(tag).push(z.business_id);
  }
  return new Map([...tage.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** Alle Kalendertage von..bis einschließlich (UTC, sommerzeitfest). Ungültig oder zu lang -> null. */
export function tageImZeitraum(von, bis, max = MAX_VERSETZEN_TAGE) {
  if (!DATUM_RE.test(von || '') || !DATUM_RE.test(bis || '')) return null;
  const start = new Date(`${von}T12:00:00Z`);
  const ende = new Date(`${bis}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(ende.getTime()) || ende < start) return null;
  const tage = [];
  for (let d = start; d <= ende; d = new Date(d.getTime() + 86400000)) {
    tage.push(d.toISOString().slice(0, 10));
    if (tage.length > max) return null;
  }
  return tage;
}

/**
 * Soll-Zustand -> Zeilen für employee_standort_plan. Wochenzeilen tragen die bearbeitete Version (gueltig_ab).
 * Vergangene Einzeltage gehören nicht zum Soll und werden von planAenderung nie gelöscht.
 */
export function sollZeilen({ muster, einzeltage, fenster }, { ownerId, empId }, version = null) {
  const zeilen = [];
  for (const schluessel of muster || []) {
    const [weekday, businessId] = schluessel.split('|');
    const f = fenster?.get?.(schluessel);
    const mitFenster = f && f.von && f.bis;
    zeilen.push({ owner_id: ownerId, employee_id: empId, business_id: businessId, weekday: Number(weekday), datum: null, gueltig_ab: version ?? null,
      von: mitFenster ? f.von : null, bis: mitFenster ? f.bis : null });
  }
  for (const [datum, ids] of einzeltage || []) {
    for (const businessId of ids) zeilen.push({ owner_id: ownerId, employee_id: empId, business_id: businessId, weekday: null, datum, gueltig_ab: null });
  }
  return zeilen;
}

const zeilenSchluessel = z => `${z.business_id}|${z.weekday ?? ''}|${z.datum ? String(z.datum).slice(0, 10) : ''}|${istWoche(z) ? gueltigAb(z.gueltig_ab) ?? '' : ''}`;

/**
 * Unterschied alt -> soll: was löschen (ids), was neu anlegen.
 * Betrachtet nur: künftige Einzeltage, die bearbeitete Version, ausdrücklich entfernte Versionen und — wenn
 * die heute gültige Version bearbeitet wird (aufraeumen) — ältere, abgelöste Versionen. Sonst würde eine leer
 * gespeicherte aktuelle Version eine alte wieder in Kraft setzen. Andere künftige Versionen bleiben unberührt.
 */
export function planAenderung(alteZeilen, soll, heute, { version = null, entfernteVersionen = [], aufraeumen = false } = {}) {
  const entfernt = new Set(entfernteVersionen);
  const relevant = (Array.isArray(alteZeilen) ? alteZeilen : []).filter((z) => {
    if (!z) return false;
    if (typeof z.datum === 'string') return !(heute && z.datum.slice(0, 10) < heute);
    if (!istWoche(z)) return false;
    const g = gueltigAb(z.gueltig_ab);
    return g === (version ?? null) || entfernt.has(g) || (aufraeumen && aelter(g, version ?? null));
  });
  const sollMap = new Map(soll.map(z => [zeilenSchluessel(z), z]));
  const altMap = new Map(relevant.map(z => [zeilenSchluessel(z), z]));
  const aendern = [];
  for (const [k, z] of sollMap) {
    const a = altMap.get(k);
    if (a?.id && (hhmm(a.von) !== hhmm(z.von ?? '') || hhmm(a.bis) !== hhmm(z.bis ?? ''))) {
      aendern.push({ id: a.id, von: z.von ?? null, bis: z.bis ?? null });
    }
  }
  return {
    loeschen: relevant.filter(z => !sollMap.has(zeilenSchluessel(z))).map(z => z.id).filter(Boolean),
    neu: soll.filter(z => !altMap.has(zeilenSchluessel(z))),
    aendern,
  };
}

/** Planzeilen nach der Änderung (für die Warnliste über alle Versionen). */
export function planNachher(alteZeilen, { loeschen, neu, aendern = [] }) {
  const weg = new Set(loeschen);
  const neuZeit = new Map(aendern.map(a => [a.id, a]));
  return (Array.isArray(alteZeilen) ? alteZeilen : []).filter(z => z && !weg.has(z.id))
    .map(z => (neuZeit.has(z.id) ? { ...z, von: neuZeit.get(z.id).von, bis: neuZeit.get(z.id).bis } : z)).concat(neu);
}

/**
 * Künftige Termine, die nach dem neuen Plan am falschen Standort lägen.
 * Ohne Standort (Altzeilen), Hausbesuche und abgesagte Termine zählen nicht.
 * Datum des Termins in Berliner Zeit, sonst kippt 00:30 auf den Vortag.
 */
export function konflikte(termine, zeilen, empId, alleStandortIds) {
  const tagBerlin = iso => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const minBerlin = iso => zeitInMinuten(new Date(iso).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }));
  return (Array.isArray(termine) ? termine : []).filter((t) => {
    if (!t || !t.business_id || t.hausbesuch || t.status === 'cancelled') return false;
    const von = minBerlin(t.start_time);
    const dauer = t.end_time ? Math.round((Date.parse(t.end_time) - Date.parse(t.start_time)) / 60000) : 0;
    const bis = von !== null && dauer > 0 ? von + dauer : von;
    return !imZeitfenster(zeilen, empId, tagBerlin(t.start_time), t.business_id, von, bis, alleStandortIds);
  });
}

function zeitText(iso) {
  const d = new Date(iso);
  const datum = d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  const zeit = d.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
  return `${datum}, ${zeit}`;
}

export function warnlisteHtml(liste, standortName) {
  if (!liste.length) return '';
  const zeilen = liste.map(t => `
    <li><button type="button" class="sp-warn-termin" data-termin="${escapeHtml(t.id)}">
      <span>${escapeHtml(zeitText(t.start_time))}</span>
      <span>${escapeHtml(t.customer_name || 'Ohne Name')}${t.services?.title ? ` · ${escapeHtml(t.services.title)}` : ''}</span>
      <span class="sp-warn-ort">gebucht: ${escapeHtml(standortName(t.business_id))}</span>
    </button></li>`).join('');
  return `<div class="sp-warnung" role="alert">
    <p><strong>${liste.length} ${liste.length === 1 ? 'Termin liegt' : 'Termine liegen'} danach am falschen Standort.</strong>
      Termine werden nicht verschoben. Antippen öffnet den Termin zum Umbuchen.</p>
    <ul>${zeilen}</ul></div>`;
}

const datumDe = tag => new Date(`${tag}T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Kurzbeschreibung eines Musters: "Mo Nord · Mi Süd". */
export function musterText(muster, name) {
  return WOCHENTAGE.flatMap(w => [...muster].filter(k => k.startsWith(`${w.weekday}|`)).map(k => `${w.kurz} ${name(k.split('|')[1])}`)).join(' · ') || 'kein Muster (alle Standorte)';
}

/** Liste „Zeitfenster (optional)" je Häkchen, in Wochentagsfolge. */
export function fensterListeHtml({ standorte, muster, fenster }) {
  const name = id => standorte.find(s => s.id === id)?.business_name || 'Standort';
  const eintraege = WOCHENTAGE.flatMap(w => standorte.filter(s => muster.has(musterSchluessel(w.weekday, s.id))).map((s) => {
    const k = musterSchluessel(w.weekday, s.id);
    const f = fenster?.get?.(k) || { von: '', bis: '' };
    const etikett = `${w.kurz} ${name(s.id)}`;
    return `<li><span>${escapeHtml(etikett)}</span>
      <input type="time" class="form-input sp-von" data-key="${escapeHtml(k)}" value="${escapeHtml(f.von)}" aria-label="${escapeHtml(etikett)} von">
      <span aria-hidden="true">–</span>
      <input type="time" class="form-input sp-bis" data-key="${escapeHtml(k)}" value="${escapeHtml(f.bis)}" aria-label="${escapeHtml(etikett)} bis"></li>`;
  }));
  return eintraege.length
    ? `<ul class="sp-tage sp-fenster">${eintraege.join('')}</ul>`
    : '<p class="form-hint">Erst Häkchen setzen, dann optional Uhrzeiten.</p>';
}

export function standortPlanHtml({ standorte, muster, einzeltage, heute, aktuellSeit = null, versionen = [], fenster = new Map() }) {
  const name = id => standorte.find(s => s.id === id)?.business_name || 'Standort';
  const kopf = WOCHENTAGE.map(w => `<th scope="col">${w.kurz}</th>`).join('');
  const reihen = standorte.map(s => `<tr><th scope="row">${escapeHtml(s.business_name)}</th>${WOCHENTAGE.map(w => `
    <td><input type="checkbox" class="sp-muster" data-weekday="${w.weekday}" data-standort="${escapeHtml(s.id)}"
      aria-label="${w.kurz} ${escapeHtml(s.business_name)}" ${muster.has(musterSchluessel(w.weekday, s.id)) ? 'checked' : ''}></td>`).join('')}</tr>`).join('');
  const tage = [...einzeltage.entries()].map(([datum, ids]) => `
    <li><span>${escapeHtml(datumDe(datum))}</span>
      <span>${ids.map(id => escapeHtml(name(id))).join(', ')}</span>
      <button type="button" class="btn-ghost-sm sp-tag-weg" data-datum="${escapeHtml(datum)}" aria-label="Einzeltag ${escapeHtml(datum)} entfernen">Entfernen</button></li>`).join('');
  const auswahl = standorte.map(s => `<label class="sp-ziel"><input type="checkbox" class="sp-versetzen-ziel" value="${escapeHtml(s.id)}"> ${escapeHtml(s.business_name)}</label>`).join('');
  return `<div class="card standort-plan">
  <h4>Wochenmuster</h4>
  <p class="form-hint">Häkchen = an diesem Wochentag an diesem Standort. Ein Tag ohne Häkchen: wie bisher an allen Standorten.
    Ob an einem Tag gearbeitet wird, regeln die Arbeitszeiten.</p>
  <p class="form-hint">Angezeigt: heute gültiges Muster${aktuellSeit ? ` (gilt seit ${escapeHtml(datumDe(aktuellSeit))})` : ''}.</p>
  <div class="sp-tabelle-wrap"><table class="sp-tabelle"><thead><tr><th></th>${kopf}</tr></thead><tbody>${reihen}</tbody></table></div>
  <h4>Zeitfenster (optional)</h4>
  <p class="form-hint">Leer = ganzer Tag. Beispiel: Mo vormittags am einen, nachmittags am anderen Standort. Online-Termine und Serien werden nur innerhalb des Fensters angeboten.</p>
  <div id="spFenster">${fensterListeHtml({ standorte, muster, fenster })}</div>
  <div class="sp-ab">
    <label>Änderung gilt ab <input type="date" class="form-input" id="spAb" min="${escapeHtml(naechsterTag(heute))}"></label>
    <span class="form-hint">Leer = sofort. Mit Datum wird das Raster als geplante Umstellung gespeichert, das heutige Muster gilt bis dahin weiter. Gleiches Datum erneut speichern ersetzt die Umstellung.</span>
  </div>
  ${versionen.length ? `<ul class="sp-tage sp-versionen">${versionen.map(v => `
    <li><span>ab ${escapeHtml(datumDe(v.ab))}</span><span>${escapeHtml(musterText(v.muster, name))}</span>
      <button type="button" class="btn-ghost-sm sp-version-weg" data-version="${escapeHtml(v.ab)}" aria-label="Umstellung ab ${escapeHtml(v.ab)} entfernen">Entfernen</button></li>`).join('')}</ul>` : ''}

  <h4>Versetzen (einzelne Tage)</h4>
  <p class="form-hint">Für einen Tag oder Zeitraum an anderen Standort(en). Gilt vor dem Wochenmuster.</p>
  <div class="sp-versetzen">
    <label>Von <input type="date" class="form-input" id="spVon" min="${escapeHtml(heute)}"></label>
    <label>Bis <input type="date" class="form-input" id="spBis" min="${escapeHtml(heute)}"></label>
    <div class="sp-ziele">${auswahl}</div>
    <button type="button" class="btn-ghost" id="spVersetzenBtn">Tage übernehmen</button>
  </div>
  ${tage ? `<ul class="sp-tage">${tage}</ul>` : '<p class="form-hint">Keine Einzeltage geplant.</p>'}

  <div id="spWarnung"></div>
  <div class="sp-aktionen"><button type="button" class="btn-primary" id="spSpeichernBtn">Speichern</button></div>
</div>`;
}

const PLAN_SPALTEN = 'id,employee_id,business_id,weekday,datum,gueltig_ab,von,bis';

/** Folgetag als 'YYYY-MM-DD' (UTC-Rechnung, sommerzeitfest). */
export function naechsterTag(tag) {
  if (!DATUM_RE.test(tag || '')) return '';
  return new Date(new Date(`${tag}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
}
const TERMIN_SPALTEN = 'id,start_time,end_time,customer_name,business_id,status,hausbesuch,services(title)';

/**
 * @param {HTMLElement} container
 * @param {object} deps supabase, ownerId, empId, standorte [{id,business_name}], erlaubteIds (null = alle),
 *   showToast, showConfirmModal, oeffneTermin, heute ('YYYY-MM-DD', für Tests)
 */
export async function mountStandortPlan(container, deps = {}) {
  if (!container) return;
  const { supabase, ownerId, empId, showToast = () => {}, showConfirmModal, oeffneTermin } = deps;
  const heute = deps.heute || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  // Der Plan darf employee_business_assignments nie erweitern: angeboten werden nur zugeordnete Standorte.
  const erlaubt = Array.isArray(deps.erlaubteIds) && deps.erlaubteIds.length ? new Set(deps.erlaubteIds) : null;
  const standorte = (deps.standorte || []).filter(s => !erlaubt || erlaubt.has(s.id));
  const alleIds = standorte.map(s => s.id);
  const name = id => (deps.standorte || []).find(s => s.id === id)?.business_name || 'anderer Standort';

  container.innerHTML = '<p class="form-hint">Standortplan wird geladen …</p>';
  const { data: alt, error } = await supabase.from('employee_standort_plan').select(PLAN_SPALTEN)
    .eq('owner_id', ownerId).eq('employee_id', empId);
  if (error) { container.innerHTML = '<p class="form-hint">Standortplan ist gerade nicht verfügbar.</p>'; return; }
  if (standorte.length < 2) {
    container.innerHTML = '<p class="form-hint">Der Mitarbeiter ist nur einem Standort zugeordnet. Ein Standortplan ist erst ab zwei Standorten nötig (Zuordnung im Reiter Info).</p>';
    return;
  }

  const version = aktuelleVersion(alt, heute) ?? null;
  const zustand = { muster: musterAusZeilen(alt, version), fenster: fensterAusZeilen(alt, version), einzeltage: einzeltageAusZeilen(alt, heute), entfernt: new Set() };
  const zeichnen = () => {
    const versionen = kuenftigeVersionen(alt, heute).filter(ab => !zustand.entfernt.has(ab)).map(ab => ({ ab, muster: musterAusZeilen(alt, ab) }));
    container.innerHTML = standortPlanHtml({ standorte, muster: zustand.muster, fenster: zustand.fenster, einzeltage: zustand.einzeltage, heute, aktuellSeit: version, versionen });
    verdrahten();
  };

  async function warnungPruefen(nachher) {
    const bis = new Date(Date.now() + WARN_TAGE * 86400000).toISOString();
    const { data, error: e } = await supabase.from('bookings').select(TERMIN_SPALTEN)
      .eq('owner_id', ownerId).eq('user_id', empId).gte('start_time', new Date().toISOString()).lte('start_time', bis)
      .neq('status', 'cancelled').order('start_time').limit(500);
    if (e) return null;
    return konflikte(data, nachher, empId, alleIds);
  }

  function warnungZeigen(liste) {
    const host = container.querySelector('#spWarnung');
    if (!host) return;
    host.innerHTML = warnlisteHtml(liste, name);
    host.querySelectorAll('.sp-warn-termin').forEach(b => b.addEventListener('click', () => oeffneTermin?.(b.dataset.termin)));
  }

  function fensterVerdrahten() {
    container.querySelectorAll('.sp-von, .sp-bis').forEach(inp => inp.addEventListener('change', () => {
      const f = { ...(zustand.fenster.get(inp.dataset.key) || { von: '', bis: '' }) };
      f[inp.classList.contains('sp-von') ? 'von' : 'bis'] = inp.value || '';
      zustand.fenster.set(inp.dataset.key, f);
    }));
  }

  function verdrahten() {
    container.querySelectorAll('.sp-muster').forEach(cb => cb.addEventListener('change', () => {
      const k = musterSchluessel(Number(cb.dataset.weekday), cb.dataset.standort);
      if (cb.checked) zustand.muster.add(k); else { zustand.muster.delete(k); zustand.fenster.delete(k); }
      const host = container.querySelector('#spFenster');
      if (host) { host.innerHTML = fensterListeHtml({ standorte, muster: zustand.muster, fenster: zustand.fenster }); fensterVerdrahten(); }
    }));
    fensterVerdrahten();
    container.querySelectorAll('.sp-tag-weg').forEach(b => b.addEventListener('click', () => {
      zustand.einzeltage.delete(b.dataset.datum);
      zeichnen();
    }));
    container.querySelectorAll('.sp-version-weg').forEach(b => b.addEventListener('click', () => {
      zustand.entfernt.add(b.dataset.version);
      zeichnen();
      showToast('Umstellung entfernt – noch speichern.');
    }));
    container.querySelector('#spVersetzenBtn')?.addEventListener('click', () => {
      const von = container.querySelector('#spVon')?.value;
      const bis = container.querySelector('#spBis')?.value || von;
      const ziele = [...container.querySelectorAll('.sp-versetzen-ziel:checked')].map(c => c.value);
      const tage = tageImZeitraum(von, bis);
      if (!tage) { showToast(`Bitte gültigen Zeitraum wählen (höchstens ${MAX_VERSETZEN_TAGE} Tage).`, 'error'); return; }
      if (tage[0] < heute) { showToast('Vergangene Tage lassen sich nicht planen.', 'error'); return; }
      if (!ziele.length) { showToast('Bitte mindestens einen Standort wählen.', 'error'); return; }
      for (const tag of tage) zustand.einzeltage.set(tag, ziele.slice());
      zustand.einzeltage = new Map([...zustand.einzeltage.entries()].sort(([a], [b]) => a.localeCompare(b)));
      zeichnen();
      showToast(`${tage.length} ${tage.length === 1 ? 'Tag' : 'Tage'} übernommen – noch speichern.`);
    });
    container.querySelector('#spSpeichernBtn')?.addEventListener('click', speichern);
  }

  async function speichern() {
    const btn = container.querySelector('#spSpeichernBtn');
    if (btn) btn.disabled = true;
    try {
      const ab = container.querySelector('#spAb')?.value || '';
      if (ab && (!DATUM_RE.test(ab) || ab <= heute)) { showToast('„Gilt ab" muss in der Zukunft liegen – für sofort leer lassen.', 'error'); return; }
      const ziel = ab || version;
      const fehler = fensterFehler(zustand.fenster);
      if (fehler) { showToast(fehler, 'error'); return; }
      const soll = sollZeilen(zustand, { ownerId, empId }, ziel);
      // Mit Datum: nur die geplante Version (+ Einzeltage) ändern, das heutige Muster bleibt unberührt.
      const aenderung = ab
        ? planAenderung(alt, soll, heute, { version: ab, entfernteVersionen: [...zustand.entfernt] })
        : planAenderung(alt, soll, heute, { version, entfernteVersionen: [...zustand.entfernt], aufraeumen: true });
      const { loeschen, neu, aendern } = aenderung;
      if (!loeschen.length && !neu.length && !aendern.length) { showToast('Keine Änderung.'); return; }
      const liste = await warnungPruefen(planNachher(alt, aenderung));
      if (liste === null) { showToast('Termine konnten nicht geprüft werden – nicht gespeichert.', 'error'); return; }
      warnungZeigen(liste);
      if (liste.length && showConfirmModal) {
        const ok = await showConfirmModal({
          title: 'Trotzdem speichern?',
          message: `${liste.length} künftige ${liste.length === 1 ? 'Termin liegt' : 'Termine liegen'} danach am falschen Standort. Sie werden nicht verschoben; die Liste bleibt zum Umbuchen sichtbar.`,
          confirmText: 'Speichern', cancelText: 'Abbrechen',
        });
        if (!ok) return;
      }
      // Erst anlegen, dann löschen: scheitert das Anlegen, bleibt der alte Plan vollständig.
      if (neu.length) {
        const { error: e } = await supabase.from('employee_standort_plan').insert(neu);
        if (e) { showToast('Standortplan konnte nicht gespeichert werden.', 'error'); return; }
      }
      for (const a of aendern) {
        const { error: e } = await supabase.from('employee_standort_plan').update({ von: a.von, bis: a.bis })
          .eq('owner_id', ownerId).eq('id', a.id);
        if (e) { showToast('Zeitfenster konnte nicht gespeichert werden.', 'error'); return; }
      }
      if (loeschen.length) {
        const { error: e } = await supabase.from('employee_standort_plan').delete().eq('owner_id', ownerId).in('id', loeschen);
        if (e) { showToast('Alte Einträge konnten nicht entfernt werden. Bitte neu laden.', 'error'); return; }
      }
      showToast('Standortplan gespeichert ✓');
      await mountStandortPlan(container, deps);
      if (liste.length) warnungZeigen(liste);
    } catch {
      showToast('Standortplan konnte nicht gespeichert werden.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  zeichnen();
}
