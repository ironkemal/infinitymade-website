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
 */

/** Anzeigetext für den Zustand; rein, für Tests. */
export function standortStatusText(biz) {
  if (!biz) return 'Kein Standort-Datensatz vorhanden — GPS-Check-in nicht eingerichtet.';
  const lat = Number(biz.clinic_lat), lng = Number(biz.clinic_lng);
  if (!biz.clinic_lat || !biz.clinic_lng || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'Praxisstandort nicht eingerichtet — Check-ins werden ohne GPS-Prüfung gezählt.';
  }
  return `Praxisstandort gesetzt (${lat.toFixed(5)}, ${lng.toFixed(5)}) — Check-ins werden im Umkreis von 150 m geprüft.`;
}

/**
 * Block „Praxisstandort" oben in die Owner-Ansicht der Anwesenheit setzen (idempotent).
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {()=>?object} deps.getBusiness   aktueller `businesses`-Datensatz (wird bei Erfolg aktualisiert)
 * @param {(msg:string, typ?:string)=>void} [deps.toast]
 * @param {Document} [doc]
 */
export function mountPraxisStandort({ supabase, getBusiness, toast }, doc = document) {
  const host = doc.getElementById('anwOwnerView');
  if (!host) return;
  let box = doc.getElementById('anwStandortBox');
  if (!box) {
    box = doc.createElement('div');
    box.id = 'anwStandortBox';
    box.style.cssText = 'font-size:12px;color:var(--text-muted);background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;';
    box.innerHTML = '<span data-standort-text></span><button type="button" class="btn-ghost" data-standort-setzen style="padding:4px 10px;font-size:12px;">Aktuellen Standort als Praxisstandort übernehmen</button>';
    host.prepend(box);
    box.querySelector('[data-standort-setzen]').addEventListener('click', () => setzen());
  }
  const text = box.querySelector('[data-standort-text]');
  const knopf = box.querySelector('[data-standort-setzen]');
  const zeichne = () => {
    const biz = getBusiness();
    text.textContent = standortStatusText(biz);
    knopf.hidden = !biz?.id;
  };

  async function setzen() {
    const biz = getBusiness();
    if (!biz?.id) return;
    if (!navigator.geolocation) { toast?.('Dieses Gerät kann keinen Standort bestimmen.', 'warning'); return; }
    knopf.disabled = true;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const clinic_lat = pos.coords.latitude, clinic_lng = pos.coords.longitude;
      const { error } = await supabase.from('businesses').update({ clinic_lat, clinic_lng }).eq('id', biz.id);
      knopf.disabled = false;
      if (error) { toast?.('Standort konnte nicht gespeichert werden.', 'error'); return; }
      biz.clinic_lat = clinic_lat; biz.clinic_lng = clinic_lng;
      toast?.('Praxisstandort gespeichert.', 'success');
      zeichne();
    }, () => {
      knopf.disabled = false;
      toast?.('Standortfreigabe verweigert oder nicht verfügbar — bitte im Browser erlauben und in der Praxis erneut versuchen.', 'warning');
    }, { enableHighAccuracy: true, timeout: 15000 });
  }

  zeichne();
}
