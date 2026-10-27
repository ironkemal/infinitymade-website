/** B08 DTOs only. No slot generation, price logic or client-side availability queries. */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GRUENDE = {
  KONTEXT_UNGUELTIG: 'Behandler- oder Leistungszuordnung noch nicht eindeutig.',
  SCOPE_UNGUELTIG: 'Zuordnung zur Praxis noch nicht eindeutig.',
  QUELLEN_UNVOLLSTAENDIG: 'Daten oder Leistungsberechtigungen noch nicht vollständig belegt.',
  QUELLEN_WIDERSPRUCH: 'Quellen oder Zuordnungen widersprechen sich.',
  EXTERNE_BELEGUNG_UNBEKANNT: 'Externe Kalenderbelegung nicht vollständig verfügbar.',
  INTERVALL_UNGUELTIG: 'Arbeits- oder Sperrzeiten noch nicht eindeutig.',
  SLOT_UNGUELTIG: 'Startzeiten noch nicht eindeutig belegt.',
  WOCHENBASIS_FEHLT: 'Vollständige Grundlage für alle sieben Tage fehlt.',
  ZEITBASIS_UNKLAR: 'Zeitbasis nicht eindeutig, etwa bei der Zeitumstellung.',
  QUELLE_NICHT_VERFUEGBAR: 'Eine benötigte Quelle ist gerade nicht verfügbar.',
};
export function minutenText(n) {
  if (!Number.isSafeInteger(n) || n < 0) return '–';
  const h = Math.floor(n / 60), m = n % 60;
  return h ? `${h} Std${m ? ` ${m} Min` : ''}` : `${m} Min`;
}
function unbekannt(z, was) {
  const grund = Object.hasOwn(GRUENDE, z.daten?.grund) ? GRUENDE[z.daten.grund] : 'Daten gerade nicht vollständig verfügbar.';
  return `<div class="px-karte-zustand"><p>${was} derzeit unbekannt.</p><p>${esc(grund)}</p><button type="button" class="px-knopf px-knopf--zweit" data-aktion="verf-neu">Erneut versuchen</button></div>`;
}
const altstand = z => z.fehler && z.daten ? '<p class="px-verf-hinweis">Aktualisierung fehlgeschlagen. Zuletzt geladener Stand.</p>' : '';

export function freieZeitHtml(z = {}, { eigeneUid = null, behandlerName = () => '', serviceName = () => '' } = {}) {
  const d = z.daten;
  let body;
  if (z.laden && !d) body = '<div class="px-karte-zustand"><p>Startzeiten werden geladen …</p></div>';
  else if (d?.status !== 'ok' || !Array.isArray(d.luecken)
    || d.luecken.some(p => !p || (eigeneUid && p.userId !== eigeneUid) || !Number.isSafeInteger(p.freiMin) || p.freiMin < 0
      || !Array.isArray(p.starts) || p.starts.some(s => !s || typeof s.start !== 'string' || !Number.isInteger(s.dauerMin) || s.dauerMin < 1)
      || !Array.isArray(p.intervalle) || p.intervalle.some(i => !i || typeof i.von !== 'string' || typeof i.bis !== 'string'))) body = unbekannt(z, 'Freie Behandlungszeit');
  else if (!d.luecken.length) {
    const text = { KEINE_BEHANDLER: 'Keine aktiven Behandler.', KEINE_LEISTUNGEN: 'Keine zugeordneten Behandlungen.',
      KEINE_ARBEITSZEIT: 'Keine Arbeitszeit hinterlegt.', KEINE_FREIEN_STARTS: 'Keine freien Startzeiten gefunden.' }[d.grund] || 'Keine freien Startzeiten gefunden.';
    body = `<div class="px-karte-zustand"><p>${text}</p></div>`;
  } else {
    body = `<div class="px-verf-personen">${d.luecken.map(p => {
      const name = behandlerName(p.userId) || (p.userId === eigeneUid ? 'Eigene Behandlungszeit' : 'Behandlername nicht verfügbar');
      const gruppe = p.starts.filter(s => s.art === 'gruppenrestplatz').length;
      return `<div class="px-verf-person"><div class="px-verf-zeile"><strong>${esc(name)}</strong><span>${minutenText(p.freiMin)} frei</span></div>
        <p>${p.intervalle.length ? p.intervalle.map(i => `${esc(i.von)}–${esc(i.bis)}`).join(' · ') : 'Keine freien Behandlungsminuten'}</p>
        ${gruppe ? `<p>Gruppenrestplätze: ${gruppe} ${gruppe === 1 ? 'mögliche Startzeit' : 'mögliche Startzeiten'}.</p>` : ''}
        <details class="px-verf-details" data-person="${esc(p.userId)}"><summary class="px-startzeiten">Startzeiten ansehen (${p.starts.length})</summary><ul>
          ${p.starts.map(s => `<li><time>${esc(s.start)}</time> · ${esc(serviceName(s.serviceId) || 'Behandlung')} · ${minutenText(s.dauerMin)}${s.art === 'gruppenrestplatz' ? ' · Gruppenrestplatz' : ''}</li>`).join('')}
        </ul></details></div>`;
    }).join('')}</div>`;
  }
  return `<section class="px-karte px-k-frei" aria-labelledby="pxFreiTitel"><div class="px-karte-kopf"><div><h2 id="pxFreiTitel">Freie Behandlungszeit heute</h2><p>Aus möglichen Startzeiten ermittelt; ohne Puffer</p></div></div>${body}${altstand(z)}
    <p class="px-verf-hinweis">${Number.isInteger(d?.minimumMin) ? `Kürzeste berücksichtigte Behandlung: ${d.minimumMin} Min. ` : ''}Gruppenrestplätze separat. Momentaufnahme, keine Buchbarkeitsgarantie.</p>
    <div class="px-karte-fuss"><button type="button" class="px-fuss-knopf" data-ziel="calendar">Im Kalender öffnen</button></div></section>`;
}

export function wocheHtml(z = {}) {
  const d = z.daten;
  let body;
  if (z.laden && !d) body = '<div class="px-karte-zustand"><p>Wochenbasis wird geladen …</p></div>';
  else if (d?.status !== 'ok' || !Number.isSafeInteger(d.arbeitsMin) || d.arbeitsMin < 0
    || !Number.isSafeInteger(d.gebuchtMin) || d.gebuchtMin < 0 || d.gebuchtMin > d.arbeitsMin
    || (d.arbeitsMin === 0 ? d.quote !== null : !Number.isFinite(d.quote) || d.quote < 0 || d.quote > 1)) body = unbekannt(z, 'Wochenbelegung');
  else {
    const pct = d.quote === null ? null : Math.round(d.quote * 100);
    body = `<div class="px-verf-woche"><div class="px-verf-zeile"><strong>${pct === null ? '– · Keine Arbeitszeit' : `${pct} % belegt`}</strong><span>${minutenText(d.gebuchtMin)} von ${minutenText(d.arbeitsMin)} Behandlerzeit</span></div>
      ${pct === null ? '' : `<div class="px-verf-balken" role="meter" aria-label="Belegte Behandlerzeit" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`}
      <p>Termine und externe Kalenderbelegung innerhalb verfügbarer Arbeitszeit.</p></div>`;
  }
  return `<section class="px-karte px-k-woche" aria-labelledby="pxWocheTitel"><div class="px-karte-kopf"><div><h2 id="pxWocheTitel">Diese Woche</h2><p>Montag–Sonntag · alle Standorte</p></div></div>${body}${altstand(z)}</section>`;
}

export async function holeVerfuegbarkeit({ supabase, apiBase, modus, rolle, fetchFn = (...a) => fetch(...a) }) {
  if (!['owner', 'employee'].includes(rolle) || !['tag', 'woche'].includes(modus) || (modus === 'woche' && rolle !== 'owner')) throw new Error('ZUGRIFF_VERWEIGERT');
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token || !apiBase) throw new Error('KEINE_SITZUNG');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetchFn(`${String(apiBase).replace(/\/+$/, '')}/startseite/${modus}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const dto = await res.json();
    if (!dto || !['ok', 'unbekannt'].includes(dto.status)) throw new Error('QUELLE_NICHT_VERFUEGBAR');
    return dto;
  } finally { clearTimeout(timer); }
}
