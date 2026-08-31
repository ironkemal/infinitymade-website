/**
 * anfrage-bearbeiten.js — Eine Terminanfrage vor dem Bestätigen korrigieren.
 *
 * Herkunft
 * ────────
 * Ops-Karte „Terminanfrage vor dem Bestätigen bearbeiten können" (Besprechung
 * 31.08.2026). Neuer Code kommt in eine neue Datei — `dashboard.js` wächst
 * nicht mehr (Konsey 2026-08-13).
 *
 * Warum es das gibt
 * ─────────────────
 * Bisher kannte der Praxisinhaber genau zwei Antworten auf eine Anfrage:
 * annehmen wie eingetragen, oder ablehnen. Die Angaben kommen aber aus einem
 * öffentlichen Formular, das der Patient selbst ausfüllt — ein Zahlendreher in
 * der Uhrzeit, die falsche Leistung aus der Liste oder eine Sitzungszahl, die
 * nicht zur Verordnung passt, kostete deshalb die ganze Anfrage: ablehnen,
 * Patient anrufen, alles neu anlegen.
 *
 * Ein zweiter Fall führte zum selben Sackgassen-Gefühl: Wunschtermin inzwischen
 * belegt. Der Server antwortet dann mit 409, und vorher landete das als Toast —
 * der Dialog war zu, die Anfrage weiter offen, der Inhaber fing von vorn an.
 * Hier bleibt die Maske in diesem Fall stehen, mit der Meldung darüber, sodass
 * direkt eine andere Uhrzeit eingetragen werden kann.
 *
 * Grenze: nur Terminplanung, keine Verordnungsfakten
 * ─────────────────────────────────────────────────
 * Bearbeitbar sind Therapeut, Datum, Uhrzeit, Leistung, Sitzungszahl und die
 * interne Notiz. ICD, Diagnosegruppe, Krankenkasse, Arzt und Frequenz bleiben
 * unangetastet — die stehen auf dem Rezept und werden im Rezept-Modul
 * korrigiert, nicht nebenbei beim Bestätigen. Der Server hält dieselbe Grenze
 * (`anfrageKorrekturenPruefen` in `api-backend/server.js`); diese Maske ist die
 * Bequemlichkeit, nicht die Kontrolle.
 *
 * Es wird nur gesendet, was sich geändert hat: unveränderte Felder bleiben aus
 * dem Rumpf, und der Server fasst ein Feld nur an, wenn es mitkommt
 * (`undefined` = unverändert). So überschreibt ein Bestätigen ohne Änderung
 * nichts — auch nicht mit demselben Wert.
 */

'use strict';

/** @type {object|null} Von `initAnfrageBearbeiten` gesetzter Zugang zur Dashboard-Umgebung. */
let ctx = null;

/**
 * @param {object} c
 *   API, escapeHtml, showToast, showHtmlModal, supabase
 *   getSession()   → Promise<{access_token}>
 *   getProfile()   → profiles-Zeile des angemeldeten Inhabers
 *   onFertig()     → nach erfolgreichem Bestätigen (Liste neu laden)
 */
export function initAnfrageBearbeiten(c) { ctx = c; }

/** 'HH:MM:SS' oder 'HH:MM' → 'HH:MM'; alles andere → ''. */
function zeitFuerFeld(wert) {
  const s = String(wert ?? '');
  return /^\d{2}:\d{2}/.test(s) ? s.substring(0, 5) : '';
}

/** Postgres `date` kommt als 'YYYY-MM-DD' — genau das, was <input type="date"> will. */
function datumFuerFeld(wert) {
  const s = String(wert ?? '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/**
 * Lädt Therapeuten und Leistungen der Praxis.
 * Beides owner-weit — der Inhaber darf beim Bestätigen jeden seiner Therapeuten
 * und jede seiner Leistungen eintragen.
 */
// `profiles` hat KEINE Spalte `full_name` (db/SCHEMA.sql) — der Name steht in
// owner_first_name/owner_last_name, ersatzweise in email. Ein Select auf full_name
// laesst PostgREST die ganze Abfrage mit 400 abweisen: die Therapeutenliste waere
// leer und nur der Inhaber stuende drin.
function personName(p) {
  return [p?.owner_first_name, p?.owner_last_name].filter(Boolean).join(' ')
    || p?.business_name || p?.email || '—';
}

async function stammdatenLaden(ownerId) {
  const { supabase, getProfile } = ctx;
  const [{ data: team }, { data: leistungen }] = await Promise.all([
    supabase.from('profiles')
      .select('id, owner_first_name, owner_last_name, business_name, email')
      .eq('owner_id', ownerId).eq('role', 'employee'),
    // `services.owner_id` ist nicht immer gefuellt — aeltere Leistungen haengen nur
    // an `user_id`. Alle fuenf anderen Leser im Dashboard fragen deshalb beide
    // Spalten ab; nur `owner_id` zu pruefen liesse Leistungen aus der Liste fallen.
    supabase.from('services').select('id, title, duration_minutes')
      .or(`owner_id.eq.${ownerId},user_id.eq.${ownerId}`).order('title'),
  ]);
  const profil = getProfile();
  return {
    team: [{ id: profil.id, name: `${personName(profil)} (Sie)` },
           ...(team || []).map(p => ({ id: p.id, name: personName(p) }))],
    leistungen: leistungen || [],
  };
}

function formularHtml(req, team, leistungen) {
  const { escapeHtml } = ctx;
  const opt = (wert, text, gewaehlt) =>
    `<option value="${escapeHtml(String(wert))}"${String(wert) === String(gewaehlt) ? ' selected' : ''}>${escapeHtml(text)}</option>`;

  const therapeuten = team.map(p => opt(p.id, p.name, req.employee_id)).join('');
  // Steht die Leistung der Anfrage nicht in der Liste (geloescht, oder einem anderen
  // Standort zugeordnet), faellt das <select> auf "" zurueck. `aenderungenSammeln`
  // haelt das fuer eine Aenderung und wuerde die Leistung beim Bestaetigen loeschen,
  // ohne dass jemand das Feld angefasst hat. Deshalb hier ergaenzen statt verlieren —
  // der Titel kommt aus dem Join in /booking-request/list.
  const bekannt = leistungen.some(s => s.id === req.service_id);
  const liste = (!bekannt && req.service_id)
    ? [{ id: req.service_id, title: req.services?.title || 'Zugeordnete Leistung',
         duration_minutes: req.services?.duration_minutes }, ...leistungen]
    : leistungen;

  const dienste = liste.map(s =>
    opt(s.id, s.duration_minutes ? `${s.title} (${s.duration_minutes} Min)` : s.title, req.service_id)).join('');

  // Sitzungszahl: `verordnung_sitzungen` steuert die Serie (siehe
  // api-backend/booking/from-request.js), `session_count` ist der Wunsch aus dem
  // Formular. Ein Feld für beide — zwei Zahlen nebeneinander erklärt hier niemand.
  const sitzungen = Number(req.verordnung_sitzungen || req.session_count) || 1;

  return `
    <div id="anfBearbeitenFehler" hidden
         style="background:var(--danger-bg,#fee2e2);color:var(--danger,#b91c1c);
                border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:13px;line-height:1.45"></div>

    <p style="color:var(--text-sub);font-size:13px;margin:0 0 14px;line-height:1.45">
      Die Angaben stammen aus dem Anfrage-Formular des Patienten. Korrigieren Sie,
      was nicht passt — bestätigt wird der Stand aus dieser Maske.
    </p>

    <label class="form-label" for="anfEmp">Therapeut</label>
    <select id="anfEmp" class="form-input" style="width:100%">
      <option value="">— Therapeuten wählen —</option>
      ${therapeuten}
    </select>

    <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:140px">
        <label class="form-label" for="anfDatum">Datum</label>
        <input id="anfDatum" class="form-input" type="date" style="width:100%"
               value="${escapeHtml(datumFuerFeld(req.preferred_date))}">
      </div>
      <div style="flex:1;min-width:110px">
        <label class="form-label" for="anfZeit">Uhrzeit</label>
        <input id="anfZeit" class="form-input" type="time" style="width:100%"
               value="${escapeHtml(zeitFuerFeld(req.preferred_time))}">
      </div>
    </div>

    <label class="form-label" for="anfLeistung" style="margin-top:12px">Leistung</label>
    <select id="anfLeistung" class="form-input" style="width:100%">
      <option value="">— keine Leistung —</option>
      ${dienste}
    </select>

    <label class="form-label" for="anfSitzungen" style="margin-top:12px">Sitzungen</label>
    <input id="anfSitzungen" class="form-input" type="number" min="1" max="99" step="1"
           style="width:100%" value="${sitzungen}">

    <label class="form-label" for="anfNotiz" style="margin-top:12px">Interne Notiz</label>
    <textarea id="anfNotiz" class="form-input" rows="2" maxlength="500" style="width:100%;resize:vertical">${escapeHtml(req.notizen || '')}</textarea>
  `;
}

/** Nur die tatsächlich geänderten Felder einsammeln. */
function aenderungenSammeln(req) {
  const wert = id => document.getElementById(id)?.value ?? '';
  const koerper = {};

  const datum = wert('anfDatum');
  if (datum !== datumFuerFeld(req.preferred_date)) koerper.preferred_date = datum;

  const zeit = wert('anfZeit');
  if (zeit !== zeitFuerFeld(req.preferred_time)) koerper.preferred_time = zeit;

  const leistung = wert('anfLeistung');
  if (leistung !== (req.service_id || '')) koerper.service_id = leistung || null;

  const sitzungen = Number(wert('anfSitzungen'));
  if (sitzungen !== (Number(req.verordnung_sitzungen || req.session_count) || 1)) {
    koerper.session_count = sitzungen;
    // Beide Spalten mitziehen: die Serie hängt an `verordnung_sitzungen`, die
    // Kartenansicht zeigt `session_count`. Nur eine zu ändern liesse die
    // Übersicht eine andere Zahl anzeigen als der Kalender hergibt.
    koerper.verordnung_sitzungen = sitzungen;
  }

  const notiz = wert('anfNotiz').trim();
  if (notiz !== String(req.notizen || '').trim()) koerper.notizen = notiz || null;

  return koerper;
}

/** Meldung im Dialog stehen lassen, statt ihn zu schliessen. */
function fehlerZeigen(text) {
  const box = document.getElementById('anfBearbeitenFehler');
  if (!box) return;
  box.textContent = text;
  box.hidden = false;
  box.scrollIntoView({ block: 'nearest' });
}

/** Rückmeldung nach dem Anlegen — eine Serie kann teilweise durchgehen. */
function ergebnisMelden(json) {
  const { showToast } = ctx;
  if (!(json.sessions_total > 1)) { showToast('Termin bestätigt ✓', 'success'); return; }
  if (json.needs_manual_scheduling) {
    showToast(`1. Termin bestätigt ✓ — ${json.sessions_total - 1} weitere Termine bitte manuell als Serie planen (Frequenz erfordert mehrere Wochentage).`, 'info');
  } else if (json.sessions_conflicts > 0) {
    showToast(`${json.sessions_created} von ${json.sessions_total} Terminen angelegt — ${json.sessions_conflicts} Termin(e) waren belegt und müssen manuell geplant werden.`, 'info');
  } else {
    showToast(`Alle ${json.sessions_total} Termine der Serie wurden angelegt ✓`, 'success');
  }
}

/**
 * Öffnet die Maske. `req` ist ein Datensatz aus `/booking-request/list`.
 * @param {object} req
 */
export async function oeffneAnfrageBearbeiten(req) {
  const { API, showHtmlModal, showToast, getSession, getProfile, onFertig } = ctx;
  const ownerId = getProfile()?.id;
  if (!ownerId || !req) return;

  let stamm;
  try {
    stamm = await stammdatenLaden(ownerId);
  } catch {
    showToast('Therapeuten und Leistungen konnten nicht geladen werden.', 'error');
    return;
  }

  showHtmlModal({
    title: 'Anfrage prüfen und bestätigen',
    confirmText: 'Termin bestätigen',
    html: formularHtml(req, stamm.team, stamm.leistungen),
    onConfirm: async () => {
      const empId = document.getElementById('anfEmp')?.value;
      if (!empId) { fehlerZeigen('Bitte einen Therapeuten wählen.'); return false; }

      const datum = document.getElementById('anfDatum')?.value;
      const zeit = document.getElementById('anfZeit')?.value;
      // Ohne Wunschzeit legt der Server den Termin auf „jetzt". Beim Bestätigen
      // aus dieser Maske ist das nie gewollt, also hier verlangen.
      if (!datum || !zeit) { fehlerZeigen('Bitte Datum und Uhrzeit angeben.'); return false; }

      const sitzungen = Number(document.getElementById('anfSitzungen')?.value);
      if (!Number.isInteger(sitzungen) || sitzungen < 1 || sitzungen > 99) {
        fehlerZeigen('Sitzungszahl muss zwischen 1 und 99 liegen.'); return false;
      }

      const koerper = {
        request_id: req.id,
        owner_id: ownerId,
        employee_id: empId,
        ...aenderungenSammeln(req),
      };

      try {
        const session = await getSession();
        const r = await fetch(`${API}/booking-request/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify(koerper),
        });
        const json = await r.json();
        if (!r.ok) {
          // 409 = Wunschtermin inzwischen belegt. Genau dafür bleibt die Maske
          // offen: eine andere Uhrzeit eintragen und erneut bestätigen.
          fehlerZeigen(json.error || 'Bestätigung fehlgeschlagen.');
          return false;
        }
        ergebnisMelden(json);
        onFertig?.();
      } catch (e) {
        fehlerZeigen(e.message || 'Bestätigung fehlgeschlagen.');
        return false;
      }
    },
  });
}
