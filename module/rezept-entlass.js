/**
 * rezept-entlass.js — Entlassmerkmal der Physio-Verordnung (Entlassmanagement, Anlage 1 TP5).
 * Reine Funktionen: Formular-HTML und Formularwerte -> Feldpaar für Confirm/PATCH.
 *
 * Verdrahtet in module/verordnung-maske.js (Container #rzEntlassWrap). Die Spalten entstehen erst mit
 * Migration 0112; `entlassMaskeAktualisieren` erkennt das selbst (Spalten-Abfrage, 42703 = Schema fehlt)
 * und bleibt dann unsichtbar und sendet nichts. Solange `schemaAktiv` false ist, liefert alles leer.
 * Server-Validierung: api-backend/lib/rezept-felder.js entlassFelderAusRezept (gleiche Regeln).
 * NULL = ungeprüft und wird nie zu false gemacht (PHYSIO_ENTLASSMERKMAL_UNGEKLAERT bleibt sperrend).
 */

const STICHTAG = /^\d{4}-\d{2}-\d{2}$/;

/** @returns {'ja'|'nein'|''} Auswahlwert aus gespeichertem Merkmal (null -> '' = nicht geprüft) */
export function merkmalZuAuswahl(wert) {
  if (wert === true) return 'ja';
  if (wert === false) return 'nein';
  return '';
}

/**
 * Formularwerte -> Feldpaar. `{}` wenn Schema nicht aktiv (Felder bleiben unberührt).
 * @param {{auswahl:''|'ja'|'nein', datum:string}} werte
 * @param {{schemaAktiv?:boolean, istBlanko?:boolean}} opt
 * @returns {{ok:true, felder:object}|{ok:false, meldung:string}}
 */
export function entlassFelderAusFormular(werte = {}, { schemaAktiv = false, istBlanko = false } = {}) {
  if (!schemaAktiv) return { ok: true, felder: {} };
  const auswahl = werte.auswahl || '';
  const datum = String(werte.datum || '').trim();
  if (auswahl === 'ja') {
    if (!STICHTAG.test(datum) || Number.isNaN(Date.parse(`${datum}T00:00:00Z`))) {
      return { ok: false, meldung: 'Bitte ein gültiges Entlassdatum angeben.' };
    }
    if (istBlanko) return { ok: false, meldung: 'Blankoverordnung und Entlassmanagement dürfen nicht kombiniert werden.' };
    return { ok: true, felder: { entlassmanagement: true, entlassungsdatum: datum } };
  }
  if (auswahl === 'nein') return { ok: true, felder: { entlassmanagement: false, entlassungsdatum: null } };
  return { ok: true, felder: { entlassmanagement: null, entlassungsdatum: null } };
}

/** HTML-Block für die Verordnungsmaske; leer, solange das Schema nicht aktiv ist. */
export function entlassFeldHtml({ entlassmanagement = null, entlassungsdatum = null } = {}, { schemaAktiv = false } = {}) {
  if (!schemaAktiv) return '';
  const a = merkmalZuAuswahl(entlassmanagement);
  const opt = (v, t) => `<option value="${v}"${a === v ? ' selected' : ''}>${t}</option>`;
  const datum = a === 'ja' && entlassungsdatum ? String(entlassungsdatum).slice(0, 10) : '';
  return `<div class="form-group"><label for="rzEntlass">Entlassmanagement</label>
<select id="rzEntlass">${opt('', 'Nicht geprüft')}${opt('ja', 'Ja')}${opt('nein', 'Nein')}</select></div>
<div class="form-group"><label for="rzEntlassDatum">Entlassdatum</label>
<input type="date" id="rzEntlassDatum" value="${datum}"${a === 'ja' ? '' : ' disabled'}></div>`;
}

const CONTAINER = 'rzEntlassWrap';
let _folge = 0;   // nur die jüngste Anfrage darf zeichnen (Heimschicken + Füllen laufen kurz nacheinander)

/**
 * Container füllen: nur Physio, nur wenn die Spalten existieren. Bei Bearbeitung wird der gespeicherte
 * Stand direkt geladen (eigene kleine Abfrage), damit Speichern nie einen bestätigten Wert mit "nicht
 * geprüft" überschreibt. Fehler/Schema fehlt -> Container leer + versteckt, es werden keine Felder gesendet.
 * @param {Document} doc
 * @param {object} db  Supabase-Client
 * @param {{rxId?:string|null, bereich?:string, alsVorlage?:boolean}} opt
 */
export async function entlassMaskeAktualisieren(doc, db, { rxId = null, bereich = 'physio', alsVorlage = false } = {}) {
  const wrap = doc?.getElementById?.(CONTAINER);
  if (!wrap) return false;
  const meine = ++_folge;
  const aus = () => { wrap.innerHTML = ''; wrap.hidden = true; delete wrap.dataset.entlassAktiv; return false; };
  // Die Maske uebergibt beim ersten Oeffnen den Praxis-Sektor ('physiotherapy') statt des Bereichsschluessels ('physio') — canli-test 10.11.
  if (bereich === 'physiotherapy') bereich = 'physio';
  if (bereich !== 'physio' || typeof db?.from !== 'function') return aus();
  let zeile = {};
  try {
    const q = db.from('prescriptions').select('entlassmanagement, entlassungsdatum');
    const { data, error } = rxId && !alsVorlage ? await q.eq('id', rxId).maybeSingle() : await q.limit(1);
    if (meine !== _folge) return false;
    if (error) return aus();
    const roh = Array.isArray(data) ? data[0] : data;
    zeile = rxId && !alsVorlage ? (roh || {}) : {};
  } catch { return aus(); }
  if (meine !== _folge) return false;
  wrap.innerHTML = entlassFeldHtml(zeile, { schemaAktiv: true });
  wrap.hidden = false;
  wrap.dataset.entlassAktiv = '1';
  const sel = doc.getElementById('rzEntlass');
  const dat = doc.getElementById('rzEntlassDatum');
  sel?.addEventListener('change', () => { if (dat) { dat.disabled = sel.value !== 'ja'; if (sel.value !== 'ja') dat.value = ''; } });
  return true;
}

/**
 * Feldpaar für die Nutzlast. `{}` wenn der Container nicht aktiv ist (Server lässt Spalten dann unberührt).
 * Ungültig (ja ohne Datum / Blanko) -> bewusst unvollständig senden, der Server antwortet 422 mit Klartext.
 */
export function entlassNutzlastAusMaske(doc, { istBlanko = false } = {}) {
  const wrap = doc?.getElementById?.(CONTAINER);
  if (!wrap || wrap.dataset.entlassAktiv !== '1') return {};
  const werte = { auswahl: doc.getElementById('rzEntlass')?.value || '', datum: doc.getElementById('rzEntlassDatum')?.value || '' };
  const r = entlassFelderAusFormular(werte, { schemaAktiv: true, istBlanko });
  if (r.ok) return r.felder;
  return { entlassmanagement: true, entlassungsdatum: werte.datum || null, ...(istBlanko ? { is_blanko: true } : {}) };
}
