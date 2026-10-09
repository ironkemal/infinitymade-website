// O-178 / K2b.16 (08.10.2026) — „Über diese Software" (ueber.html).
//
// legal-de 08.10: In der Box ist die Praxis Betreiberin, nicht Praxura — ein
// Praxura-Impressum gehört nicht hinein (die alten Links liefen dort ohnehin
// auf 404). Stattdessen diese Seite: Hersteller, Version, Lizenzen, und mit
// wem die Box nach außen spricht. Sie funktioniert ohne Internet.
//
// Öffentlich: Hersteller + Version. Nach Anmeldung: Außenverbindungen und
// Lizenztexte der Server-Komponente (routes/ueber.js — Begründung dort).

import { SUPPORT_ADRESSE } from './support-kontakt.js';
import { httpsUrl } from './branding.js?v=20261009k15';

export const HERSTELLER = Object.freeze({
  name: 'Yavuz Kemal Demir',
  ort: 'Siegburg',
  web: 'praxura.de',
  mail: SUPPORT_ADRESSE,
});

// ⚠️ K2b.16-OFFEN — Platzhalter (KHS §5b T21). Wer die ausschließlichen
// Nutzungsrechte hält, hängt an der Antwort auf: deckt die Rechteübertragung
// vom 06.08.2026 auch Melihs SPÄTERE Beiträge? Bis dahin steht hier null und
// die Seite zeigt KEINEN Rechtevermerk — lieber keiner als ein falscher in
// jeder Kundenbox. Mit der Antwort: Text eintragen (z. B. „© 2026 Yavuz Kemal
// Demir"), LICENSE ins Repo + Image, T21 abhaken.
export const RECHTEVERMERK = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Tabelle der Außenverbindungen (Antwort von GET /api/ueber/verbindungen). */
export function verbindungenHtml(liste) {
  const zeilen = (liste?.verbindungen || []).map((v) => `
    <tr>
      <td><code>${esc(v.ziel)}</code>${v.von === 'Betriebssystem' ? '<br><small>nicht Praxura — Ihr Betriebssystem</small>' : ''}</td>
      <td>${esc(v.zweck)}</td>
      <td>${esc(v.wann)}</td>
      <td>${esc(v.inhalt)}</td>
    </tr>`).join('');
  if (!zeilen) return '<p>Keine Außenverbindungen eingetragen.</p>';
  return `<div class="tabelle-wrap"><table>
    <thead><tr><th>Ziel</th><th>Wozu</th><th>Wann</th><th>Was wird übertragen</th></tr></thead>
    <tbody>${zeilen}</tbody></table></div>`;
}

export function herstellerHtml(h = HERSTELLER, vermerk = RECHTEVERMERK) {
  return `
    <p><strong>${esc(h.name)}</strong>, ${esc(h.ort)}<br>
    ${esc(h.web)} · ${esc(h.mail)}</p>
    ${vermerk ? `<p class="vermerk">${esc(vermerk)}</p>` : ''}`;
}

/** Seite verdrahten. Alle Abhängigkeiten von außen, damit sie testbar bleibt. */
export async function ueberSeiteStarten({ doc = document, apiBase, holeToken, fetchFn = fetch }) {
  const $ = (id) => doc.getElementById(id);
  $('hersteller').innerHTML = herstellerHtml();

  try {
    const r = await fetchFn(`${apiBase}/ueber`);
    $('version').textContent = r.ok ? (await r.json()).version : 'nicht abrufbar';
  } catch { $('version').textContent = 'nicht abrufbar'; }

  const token = await holeToken().catch(() => null);
  if (!token) {
    for (const id of ['verbindungen', 'server-lizenzen']) {
      $(id).innerHTML = '<p class="hinweis">Nach der <a href="/login.html">Anmeldung</a> sichtbar.</p>';
    }
    return;
  }
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  try {
    const r = await fetchFn(`${apiBase}/ueber/verbindungen`, auth);
    $('verbindungen').innerHTML = r.ok ? verbindungenHtml(await r.json()) : '<p class="hinweis">Nicht abrufbar.</p>';
  } catch { $('verbindungen').innerHTML = '<p class="hinweis">Nicht abrufbar.</p>'; }

  $('server-lizenzen').innerHTML = '<button type="button" class="btn-ghost" id="lizenzen-laden">Lizenztexte anzeigen</button>';
  $('lizenzen-laden').addEventListener('click', async () => {
    const ziel = $('server-lizenzen');
    ziel.textContent = 'Wird geladen …';
    try {
      const r = await fetchFn(`${apiBase}/ueber/lizenzen`, auth);
      if (!r.ok) throw new Error();
      const pre = doc.createElement('pre');
      pre.textContent = await r.text();
      ziel.replaceChildren(pre);
    } catch { ziel.innerHTML = '<p class="hinweis">Nicht abrufbar.</p>'; }
  });
}

/**
 * Box-Fußzeilen: Impressum/Datenschutz/AGB/Cookie-Links (SaaS-Seiten von
 * Praxura) durch „Über diese Software" ersetzen. Markiert mit data-rechtslinks.
 * Auf SaaS bleibt alles wie es ist (O-58 (a): ein Code, Flaggen-Zweig).
 * Ausnahme data-rechtslinks="praxis" + `praxis`: Patientenseiten, in beiden Betrieben
 * die Angaben der Praxis (praxisFusszeileHtml).
 */
export function rechtslinksFuerKutu(istKutu, doc = globalThis.document, praxis = null) {
  if (!doc) return 0;
  let n = 0;
  for (const b of doc.querySelectorAll('[data-rechtslinks]')) {
    // Patientenseiten (K2b.15, legal-de 09.10.2026): Betreiberin ist die Praxis — in Box UND SaaS
    // ihre Angaben (G7). Ohne Impressum-URL kein „Impressum"-Link, nur Klartext Name · Anschrift.
    if (praxis && b.getAttribute?.('data-rechtslinks') === 'praxis') {
      b.innerHTML = praxisFusszeileHtml(praxis, istKutu);
      n++;
    } else if (istKutu) {
      b.innerHTML = '<a href="/ueber.html">Über diese Software</a>';
      n++;
    }
  }
  return n;
}

/**
 * Fußzeile der Patientenseiten. `praxis` = { name, anschrift, impressumUrl, datenschutzHref }.
 * datenschutzHref ist entweder die https-URL der Praxis oder ein Anker auf die erzeugten Hinweise.
 * Fremde Links: rel="noopener noreferrer" — der Buchungs-Slug soll nicht als Referer abfließen (O-181 ii).
 */
export function praxisFusszeileHtml(praxis, istKutu) {
  const extern = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
  const teile = [];
  const impressum = httpsUrl(praxis.impressumUrl);
  if (impressum) teile.push(extern(impressum, 'Impressum'));
  else {
    const klartext = [praxis.name, praxis.anschrift].map((s) => String(s || '').trim()).filter(Boolean).join(' · ');
    if (klartext) teile.push(`<span>${esc(klartext)}</span>`);
  }
  const ds = String(praxis.datenschutzHref || '');
  if (ds.startsWith('#')) teile.push(`<a href="${esc(ds)}" data-datenschutzhinweise>Datenschutzhinweise</a>`);
  else if (httpsUrl(ds)) teile.push(extern(ds, 'Datenschutz'));
  if (istKutu) teile.push('<a href="/ueber.html">Über diese Software</a>');
  return teile.join(' · ');
}
