/**
 * terminerinnerung-einstellung.js — Owner-Schalter „Terminerinnerung per E-Mail" in den Einstellungen.
 *
 * Herkunft: O-206 Phase A (06.11.2026, Physio-Pilot P1). Der Zeitjob läuft im Backend
 * (api-backend/lib/terminerinnerung-job.js, nur Box mit Praxis-SMTP); hier steht nur der Schalter
 * `profiles.terminerinnerung_aktiv` (Migration 0110, Standard aus). Ohne diese Oberfläche hätte man ihn nur per SQL
 * in der Box setzen können (onprem O-206).
 *
 * Sichtbar nur für den Inhaber UND nur, wenn die Spalte im geladenen Profil existiert (select('*') liefert sie
 * ausschließlich, wo 0110 angewandt ist) – in der SaaS bleibt der Abschnitt versteckt, ohne Fehlerabfrage.
 */
'use strict';
import { einrichtenLink } from './mailversand.js?v=20261109';

export const WIRKUNG_TEXT = 'Am Vorabend (zwischen 18 und 22 Uhr) erhalten Patientinnen und Patienten mit Termin am nächsten Tag '
  + 'eine kurze E-Mail mit Datum, Uhrzeit und Praxis. Gesendet wird nur an Personen, die der Mitteilung per E-Mail '
  + 'zugestimmt haben (Datenschutz-Einwilligung mit der Option „Terminerinnerungen und Terminänderungen"). '
  + 'Die Mail enthält keinen Namen und keinen Grund. Absagen erfolgen telefonisch.';

export const VORAUSSETZUNG_TEXT = 'Voraussetzung: Unter Einstellungen → E-Mail-Versand ist ein Postfach der Praxis verbunden. Ohne Postfach wird nichts versendet. '
  + 'Die Mails gehen über Ihr eigenes Postfach, nicht über Praxura.';

/** Soll der Abschnitt gezeigt werden? Inhaber + Spalte vorhanden (boolean). */
export function schalterSichtbar(profile) {
  return profile?.role === 'owner' && typeof profile?.terminerinnerung_aktiv === 'boolean';
}

/** Schreibt den Schalter in die Inhaber-Zeile. @returns {{ok:boolean, fehler?:string}} */
export async function speichereSchalter(supabase, ownerId, an) {
  if (!ownerId) return { ok: false, fehler: 'Kein Benutzer angemeldet.' };
  const { error } = await supabase.from('profiles').update({ terminerinnerung_aktiv: an === true }).eq('id', ownerId);
  return error ? { ok: false, fehler: 'Die Einstellung konnte nicht gespeichert werden.' } : { ok: true };
}

export function renderTerminerinnerungSettings(deps) {
  const section = document.getElementById('settingsTerminerinnerungSection');
  if (!section) return;
  const zeigen = schalterSichtbar(deps.profile);
  section.hidden = !zeigen;
  if (!zeigen) return;

  const body = section.querySelector('.settings-section-body');
  body.textContent = '';
  const absatz = (text, stil) => { const p = document.createElement('p'); p.className = 'form-hint'; p.style.cssText = stil; p.textContent = text; return p; };
  const zeile = document.createElement('label');
  zeile.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;';
  const box = document.createElement('input');
  box.type = 'checkbox'; box.id = 'setTerminerinnerungAktiv'; box.checked = deps.profile.terminerinnerung_aktiv === true;
  const beschriftung = document.createElement('span');
  beschriftung.textContent = 'Terminerinnerung per E-Mail senden';
  zeile.append(box, beschriftung);
  const voraus = absatz(VORAUSSETZUNG_TEXT + ' ', 'margin-bottom:12px;');
  voraus.append(einrichtenLink(document, 'Zum E-Mail-Versand →'));
  body.append(absatz(WIRKUNG_TEXT, 'margin-bottom:10px;'), voraus, zeile);

  box.addEventListener('change', async () => {
    const gewollt = box.checked;
    box.disabled = true;
    const r = await speichereSchalter(deps.supabase, deps.ownerId(), gewollt);
    box.disabled = false;
    if (r.ok) {
      deps.profile.terminerinnerung_aktiv = gewollt; // nachziehen, damit ein erneutes Rendern den Stand zeigt
      deps.showToast?.(gewollt ? 'Terminerinnerung eingeschaltet.' : 'Terminerinnerung ausgeschaltet.', 'success');
    } else {
      box.checked = !gewollt;
      deps.showToast?.(r.fehler, 'error');
    }
  });
}
