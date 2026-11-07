/**
 * rezept-entlass.js — Entlassmerkmal der Physio-Verordnung (Entlassmanagement, Anlage 1 TP5).
 * Reine Funktionen: Formular-HTML und Formularwerte -> Feldpaar für Confirm/PATCH.
 *
 * ⛔ Noch NICHT in dashboard.js verdrahtet: die Spalten entstehen erst mit db/entwuerfe/0112
 * (Release-Schritt, GO nötig). Ohne Spalten würden Confirm/PATCH an der Datenbank scheitern.
 * Solange `schemaAktiv` false ist, liefert alles leer / keine Felder (Alt-Clients unverändert).
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
  return `<div class="form-group"><label for="rxEntlass">Entlassmanagement</label>
<select id="rxEntlass">${opt('', 'Nicht geprüft')}${opt('ja', 'Ja')}${opt('nein', 'Nein')}</select></div>
<div class="form-group"><label for="rxEntlassDatum">Entlassdatum</label>
<input type="date" id="rxEntlassDatum" value="${datum}"${a === 'ja' ? '' : ' disabled'}></div>`;
}
