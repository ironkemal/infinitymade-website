/**
 * termin-panel-patient.js — der Seitenbereich ohne Termin.
 *
 * Warum es das gibt
 * ─────────────────
 * Wählte man im Suchfeld oben im Seitenbereich einen Patienten, der keinen
 * kommenden Termin hat, schloss sich das Panel und die Maske „Neuer Termin"
 * sprang auf — vorbelegt auf die nächste halbe Stunde. Das ist eine Antwort auf
 * eine Frage, die niemand gestellt hat: man sucht einen Patienten meistens,
 * weil man etwas über ihn wissen will, nicht weil man ihn sofort einbestellen
 * will. Wer wirklich einen Termin anlegen möchte, tut das im Kalender an der
 * Stelle, an der er ihn haben will — dort ist auch die Uhrzeit schon richtig.
 *
 *   Kemal, 31.08.2026: „Termini olmayan bir hastaya tıklandığında ‚Neuer
 *   Termin' maskesi açılmayacak — panel hasta verisi, Verlauf ve Notizen
 *   gösterecek."
 *
 * Also: das Panel bleibt offen und zeigt, was zum Patienten gehört —
 * Stammdatenknopf, Verlauf, Notizen, Anamnese, laufende Verordnungen. Alles,
 * was einen konkreten Termin voraussetzt, wird geschlossen.
 *
 * Zwei Zustände, ein Panel
 * ────────────────────────
 * `zeigePatientOhneTermin()` schliesst die terminbezogenen Blöcke,
 * `zeigeTerminModus()` öffnet sie wieder. Der zweite Aufruf steht am Anfang von
 * `openBookingActionModal` — ohne ihn bliebe das Panel nach einem Ausflug in
 * den Patientenmodus für den Rest der Sitzung halb leer, und zwar lautlos.
 * Wer hier eine Gruppe ergänzt, muss sie in `TERMIN_BLOECKE` eintragen; sonst
 * ist sie im Patientenmodus sichtbar und behauptet einen Termin, den es nicht
 * gibt.
 *
 * Was hier NICHT passiert
 * ───────────────────────
 * Kein Schreiben. Der Verlauf wird aus module/patientenkarte.js geladen und
 * gezeichnet — dieselbe Liste wie in der Patientenakte, nicht eine zweite
 * Zusammenstellung derselben Ereignisse.
 */

import { ladeVerlauf, renderVerlauf } from './patientenkarte.js?v=20260905';

function escapeHtml(x) {
  return String(x ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Arzt-, Therapeuten- und KI-Notizen zeichnen.
 *
 * Steht hier und nicht in dashboard.js, weil beide Zustaende des Panels sie
 * brauchen: der Termin-Modus und der Patientenmodus. Zwei Abschriften
 * derselben drei Bloecke waeren nach dem ersten Umbau verschieden.
 *
 * @param {HTMLElement} karte   #bkPatNotesCard
 * @param {HTMLElement} inhalt  #bkPatNotesContent
 * @param {object|null} notizen Zeile aus `patient_notes`
 */
export function rendereNotizen(karte, inhalt, notizen) {
  if (!karte || !inhalt) return;
  const hatWas = notizen && (notizen.doctor_notes || notizen.therapist_notes || notizen.ai_summary);
  if (!hatWas) { karte.hidden = true; inhalt.innerHTML = ''; return; }

  const block = (label, text, farbe) => text
    ? '<div><div style="font-size:10px;font-weight:600;color:' + farbe + ';text-transform:uppercase;'
      + 'letter-spacing:.04em;margin-bottom:3px;">' + label + '</div>'
      + '<div style="color:var(--text-main);font-size:12px;line-height:1.5;white-space:pre-wrap;">'
      + escapeHtml(text) + '</div></div>'
    : '';

  inhalt.innerHTML = [
    block('Arztnotizen', notizen.doctor_notes, 'var(--accent,#b1891b)'),
    block('Therapeutennotizen', notizen.therapist_notes, '#60a5fa'),
    block('KI-Zusammenfassung', notizen.ai_summary, 'var(--text-muted)'),
  ].filter(Boolean).join('');
  karte.hidden = false;
}

/**
 * Alles im Seitenbereich, was einen konkreten Termin voraussetzt.
 * Reihenfolge egal, Vollständigkeit nicht.
 */
const TERMIN_BLOECKE = [
  'bkBookingNotesCard',        // Notiz AM Termin
  'bkRxInfoCard',              // Rezeptinfo der laufenden Verordnung
  'bkRxSessionsPanel',         // Aktive Verordnung: Einheiten vergeben
  'bkActionHbInfo',            // Hausbesuch-Adresse
  'bkActionFahrtStartedGroup',
  'bkActionArrivedGroup',
  'bkActionStartTerminGroup',  // „Termin Starten"
  'bkActionFahrtEndGroup',
  'bkActionDoneGroup',
  'bkActionFussbefundBtn',
  'bkActionTerminButtons',     // Bearbeiten / Löschen
  'bkActionNoShowGroup',       // „Patient nicht erschienen" + Ausfallrechnung
  'bkActionTerminzettelWrap',  // Termine drucken
  'bkActionAuswahlZeile',
];

/**
 * Terminbezogene Blöcke wieder freigeben.
 *
 * Bewusst nur „nicht mehr zwangsweise versteckt": welche Gruppe danach
 * wirklich sichtbar ist, entscheidet weiterhin `openBookingActionModal`
 * (Hausbesuch ja/nein, eigener Termin ja/nein, Verordnung vorhanden ja/nein).
 * Diese Funktion nimmt nur den Riegel weg, den der Patientenmodus vorgelegt
 * hat — sie behauptet nichts über den Termin.
 */
export function zeigeTerminModus() {
  const verlauf = document.getElementById('bkVerlaufCard');
  if (verlauf) verlauf.hidden = true;
  // Nur zurücknehmen, was dieser Modus selbst gesetzt hat. Blöcke, die schon
  // vorher aus eigenem Grund zu waren, macht `openBookingActionModal` gleich
  // danach ohnehin richtig.
  for (const id of TERMIN_BLOECKE) {
    const el = document.getElementById(id);
    if (el && el.dataset.patientmodusZu === '1') {
      el.hidden = false;
      delete el.dataset.patientmodusZu;
    }
  }
}

/**
 * Den Seitenbereich für einen Patienten OHNE Termin herrichten.
 *
 * @param {object} args
 * @param {object}   args.sb          Supabase-Client
 * @param {string}   args.ownerId
 * @param {object}   args.lead        Patient aus `leads`
 * @param {function} args.setzeKopf   setzeAktionsKopf aus termin-aktionen.js
 * @param {function} args.setzeKarte  setzePatientenKarte aus termin-aktionen.js
 * @param {function} args.oeffneAkte  öffnet die Patientenakte
 * @param {function} args.aufSprung   (ziel, id, extra) — Klick auf eine Verlaufszeile
 * @param {function} [args.setzeAuswahlLabel]  sperrt Bearbeiten/Löschen
 */
export async function zeigePatientOhneTermin({
  sb, ownerId, lead, setzeKopf, setzeKarte, oeffneAkte, aufSprung, setzeAuswahlLabel,
}) {
  if (!lead) return;

  // Terminbezogenes schliessen — und merken, dass DIESER Modus es war.
  for (const id of TERMIN_BLOECKE) {
    const el = document.getElementById(id);
    if (el && !el.hidden) { el.hidden = true; el.dataset.patientmodusZu = '1'; }
  }

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || lead.title || '';
  setzeKopf?.({ patientName: name, dob: lead.geburtsdatum || null });
  setzeAuswahlLabel?.(null);
  setzeKarte?.({ lead, booking: null, oeffneAkte });

  // Die Terminkarte oben trägt sonst Datum und Uhrzeit des zuletzt gewählten
  // Termins — hier gehört ein klarer Satz hin statt eines fremden Termins.
  const svc = document.getElementById('bkDetailService');
  const dt = document.getElementById('bkDetailDateTime');
  const ther = document.getElementById('bkDetailTherapist');
  const dauer = document.getElementById('bkDetailDuration');
  if (svc) svc.textContent = 'Kein kommender Termin';
  if (dt) dt.textContent = name;
  if (ther) ther.textContent = 'Patientendaten, Verlauf und Notizen';
  if (dauer) dauer.textContent = '';

  // Anamnese gehoert zum Patienten, nicht zum Termin — sie bleibt stehen und
  // wird unten frisch geladen. Ohne dieses Nachladen zeigte das Panel die
  // Notizen des ZULETZT geoeffneten Patienten weiter: still und falsch.
  const notizKarte = document.getElementById('bkPatNotesCard');
  const notizInhalt = document.getElementById('bkPatNotesContent');
  const anamKarte = document.getElementById('bkAnamneseCard');
  if (anamKarte) anamKarte.hidden = true;
  sb.from('patient_notes')
    .select('doctor_notes,therapist_notes,ai_summary,updated_at')
    .eq('lead_id', lead.id).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    .then(({ data }) => rendereNotizen(notizKarte, notizInhalt, data))
    .catch(e => { console.error('[termin-panel-patient:notizen]', e); rendereNotizen(notizKarte, notizInhalt, null); });

  const karte = document.getElementById('bkVerlaufCard');
  const inhalt = document.getElementById('bkVerlaufContent');
  if (karte && inhalt) {
    inhalt.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--text-muted);">Wird geladen …</div>';
    karte.hidden = false;
    try {
      const zeilen = await ladeVerlauf(sb, ownerId, lead.id);
      renderVerlauf(inhalt, zeilen, aufSprung);
    } catch (e) {
      console.error('[termin-panel-patient:verlauf]', e);
      inhalt.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--text-muted);">Verlauf konnte nicht geladen werden.</div>';
    }
  }
}
