/**
 * praxis-standort.js — Praxisstandort für den GPS-Check-in (Anwesenheit).
 *
 * Warum (onprem O-140, 30.09.2026): Bis dahin rief `ensureBusinessCoords()` in
 * dashboard.js OpenStreetMap-Nominatim aus dem Browser auf. Die CSP blockte das
 * (SaaS `vercel.json`, Kasten `onprem/Caddyfile`), `businesses.clinic_lat/lng`
 * blieb leer, und der Server (`/attendance/check-in`, 150-m-Radius) wertete jeden
 * Check-in als ungültig — der Owner sah überall ⚠. Ein Geocoder draußen wäre eine
 * neue Außenkette (G8) gewesen. Stattdessen übernimmt der Owner den Standort
 * einmal mit seinem Gerät in der Praxis — dieselbe Messmethode wie der Check-in
 * der Mitarbeiter (`navigator.geolocation`). Kein externer Aufruf.
 *
 * 30.09.2026 (Oturum A, Devir B §4d): Die Koordinate wird in `profiles.clinic_lat/lng`
 * gespeichert (Owner-Ebene; der Server fällt ohne business_id auf profiles zurück, und
 * eine Einzelpraxis hat keinen `businesses`-Eintrag). Hat der Owner zusätzlich einen
 * `businesses`-Datensatz, wird dieser mitgeschrieben. Dazu der Owner-Schalter
 * `profiles.gps_checkin_pruefen` (Standard aus) — Text und Wirkung: `GPS_HINWEIS`.
 */

/** Dieselbe Formulierung zeigt attendance.js vor dem Check-in (nur wenn der Schalter an ist). */
export const GPS_HINWEIS =
  'Beim Einchecken prüft Praxura einmalig, ob Sie sich im Umkreis von 150 m der Praxis befinden. '
  + 'Ihr Standort wird nicht gespeichert – nur das Ergebnis.';

/**
 * Ist die GPS-Prüfung für diesen Mitarbeiter (oder Owner) eingeschaltet? Liest
 * `profiles.gps_checkin_pruefen` des Owners. Jeder Fehler → false: im Zweifel wird
 * KEIN Standort erfragt (Datensparsamkeit, legal-de 30.09.2026).
 * @returns {Promise<boolean>}
 */
export async function gpsSchalterLesen(supabase, userId) {
  try {
    const { data: ich } = await supabase.from('profiles').select('owner_id, role').eq('id', userId).maybeSingle();
    const ownerId = ich?.role === 'owner' ? userId : ich?.owner_id;
    if (!ownerId) return false;
    const { data } = await supabase.from('profiles').select('gps_checkin_pruefen').eq('id', ownerId).maybeSingle();
    return data?.gps_checkin_pruefen === true;
  } catch { return false; }
}

/**
 * Standort für den Check-in — rein, `holeStandort` wird übergeben (testbar).
 * Schalter aus → nie gefragt. Schalter an, aber verweigert/Fehler/Permissions-Policy → ohne
 * Koordinaten weiter: Check-in scheitert nie am Standort (Server schreibt dann NULL).
 * @param {boolean} pruefen
 * @param {()=>Promise<{lat:number,lng:number}>} holeStandort
 * @returns {Promise<{lat?:number,lng?:number,ohneStandort:boolean}>}
 */
export async function standortFuerCheckin(pruefen, holeStandort) {
  if (!pruefen) return { ohneStandort: false };
  try {
    const { lat, lng } = await holeStandort();
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, ohneStandort: false } : { ohneStandort: true };
  } catch { return { ohneStandort: true }; }
}

/**
 * Bericht-Spalte „GPS" (Owner-Ansicht der Anwesenheit). `check_in_valid`:
 * true = im Umkreis · false = außerhalb · NULL = nicht geprüft (Schalter aus / kein Standort).
 * @param {{check_in_valid:?boolean, check_in_at?:?string}} r
 * @returns {{icon:string, farbe:string, titel:string}}
 */
export function gpsAnzeige(r) {
  if (!r?.check_in_at) return { icon: '—', farbe: 'var(--text-muted)', titel: '' };
  if (r.check_in_valid === true) return { icon: '✓', farbe: 'var(--success, #10b981)', titel: 'Im Umkreis der Praxis' };
  if (r.check_in_valid === false) return { icon: '⚠', farbe: 'var(--warning, #f59e0b)', titel: 'Außerhalb des Umkreises (außerhalb)' };
  return { icon: 'nicht geprüft', farbe: 'var(--text-muted)', titel: 'Der Standort wurde nicht geprüft' };
}

/** Anzeigetext für den Zustand; rein, für Tests. */
// `pruefen` = Owner-Schalter profiles.gps_checkin_pruefen. Ohne ihn behauptete der Text
// „werden geprüft", obwohl die Prüfung aus war (P2 canli-test 30.09.2026).
export function standortStatusText(biz, pruefen = false) {
  const lat = Number(biz?.clinic_lat), lng = Number(biz?.clinic_lng);
  if (!biz || !biz.clinic_lat || !biz.clinic_lng || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'Praxisstandort nicht eingerichtet — Check-ins werden ohne GPS-Prüfung gezählt.';
  }
  const ort = `Praxisstandort gesetzt (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  return pruefen
    ? `${ort} — Check-ins werden im Umkreis von 150 m geprüft.`
    : `${ort} — GPS-Prüfung ist aus, Check-ins werden ohne Standort gezählt.`;
}

/**
 * Block „Praxisstandort" oben in die Owner-Ansicht der Anwesenheit setzen (idempotent).
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {()=>?object} deps.getBusiness   aktueller `businesses`-Datensatz oder null (Einzelpraxis)
 * @param {()=>?string} [deps.getOwnerId]  `profiles.id` des Owners — Ort der Koordinate und des Schalters
 * @param {(msg:string, typ?:string)=>void} [deps.toast]
 * @param {Document} [doc]
 */
export function mountPraxisStandort({ supabase, getBusiness, getOwnerId, toast }, doc = document) {
  const host = doc.getElementById('anwOwnerView');
  if (!host) return;
  let box = doc.getElementById('anwStandortBox');
  if (!box) {
    box = doc.createElement('div');
    box.id = 'anwStandortBox';
    box.style.cssText = 'font-size:12px;color:var(--text-muted);background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px;display:flex;flex-direction:column;gap:8px;';
    box.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;"><span data-standort-text></span>'
      + '<button type="button" class="btn-ghost" data-standort-setzen style="padding:4px 10px;font-size:12px;">Aktuellen Standort als Praxisstandort übernehmen</button></div>'
      + '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;"><input type="checkbox" data-gps-pruefen style="margin-top:2px;">'
      + '<span><strong style="color:var(--text-main);">GPS-Prüfung beim Einchecken</strong> (Standard: aus)<br>' + GPS_HINWEIS + '</span></label>';
    host.prepend(box);
    box.querySelector('[data-standort-setzen]').addEventListener('click', () => setzen());
    box.querySelector('[data-gps-pruefen]').addEventListener('change', (e) => schalter(e.target));
  }
  const text = box.querySelector('[data-standort-text]');
  const knopf = box.querySelector('[data-standort-setzen]');
  const haken = box.querySelector('[data-gps-pruefen]');
  const ownerId = () => (getOwnerId ? getOwnerId() : null);
  let ort = null;   // Zeile aus profiles: clinic_lat, clinic_lng, gps_checkin_pruefen

  const zeichne = () => {
    const biz = getBusiness();
    const hatProfil = ort && ort.clinic_lat != null && ort.clinic_lng != null;
    text.textContent = standortStatusText(hatProfil ? ort : biz, ort?.gps_checkin_pruefen === true);
    haken.checked = ort?.gps_checkin_pruefen === true;
  };

  async function lade() {
    const id = ownerId();
    if (!id) return;
    const { data } = await supabase.from('profiles').select('clinic_lat, clinic_lng, gps_checkin_pruefen').eq('id', id).maybeSingle();
    ort = data || null;
    zeichne();
  }

  async function schalter(el) {
    const id = ownerId();
    if (!id) return;
    const an = el.checked;
    el.disabled = true;
    const { error } = await supabase.from('profiles').update({ gps_checkin_pruefen: an }).eq('id', id);
    el.disabled = false;
    if (error) { el.checked = !an; toast?.('Einstellung konnte nicht gespeichert werden.', 'error'); return; }
    ort = { ...(ort || {}), gps_checkin_pruefen: an };
    zeichne();
    toast?.(an ? 'GPS-Prüfung beim Einchecken ist aktiv.' : 'GPS-Prüfung beim Einchecken ist aus.', 'success');
  }

  async function setzen() {
    const id = ownerId();
    if (!id) return;
    if (!navigator.geolocation) { toast?.('Dieses Gerät kann keinen Standort bestimmen.', 'warning'); return; }
    knopf.disabled = true;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const clinic_lat = pos.coords.latitude, clinic_lng = pos.coords.longitude;
      // Owner-Ebene: profiles (Einzelpraxis hat keinen businesses-Eintrag; der Server fällt dorthin zurück).
      const { error } = await supabase.from('profiles').update({ clinic_lat, clinic_lng }).eq('id', id);
      // Mehrstandort: zusätzlich der businesses-Datensatz, falls vorhanden. Ein Fehler hier ist nicht fatal.
      const biz = getBusiness();
      if (!error && biz?.id) {
        const { error: e2 } = await supabase.from('businesses').update({ clinic_lat, clinic_lng }).eq('id', biz.id);
        if (!e2) { biz.clinic_lat = clinic_lat; biz.clinic_lng = clinic_lng; }
      }
      knopf.disabled = false;
      if (error) { toast?.('Standort konnte nicht gespeichert werden.', 'error'); return; }
      ort = { ...(ort || {}), clinic_lat, clinic_lng };
      toast?.('Praxisstandort gespeichert.', 'success');
      zeichne();
    }, () => {
      knopf.disabled = false;
      toast?.('Standortfreigabe verweigert oder nicht verfügbar — bitte im Browser erlauben und in der Praxis erneut versuchen.', 'warning');
    }, { enableHighAccuracy: true, timeout: 15000 });
  }

  zeichne();
  lade();
}
