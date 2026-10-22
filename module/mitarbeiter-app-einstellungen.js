/**
 * mitarbeiter-app-einstellungen.js — Owner-Einstellung „App für Mitarbeiter"
 * (22.10.2026, onprem O-214).
 *
 * Warum: Box-Adressen sind absichtlich zufällig (kohl-paket-52.box.praxura.de,
 * K2b.2 — der Name steht dauerhaft in den öffentlichen Zertifikatslogs). Im Beta-
 * Test mussten sich die Mitarbeiter deshalb den Link gegenseitig schicken. Jetzt
 * verteilt die Praxis einen QR-Code; er führt auf app.html, dort liegt die App mit
 * zwei Fingertipps auf dem Startbildschirm — unter dem Praxisnamen.
 *
 * Der QR enthält NUR die Adresse (location.origin + /app.html): keinen Einrichtungs-
 * code, keinen company_code, keinen Jeton (onprem O-214 / guvenlik). Wer ihn hat,
 * sieht die Anmeldeseite — deshalb „nur im Team weitergeben".
 *
 * Baut seinen Abschnitt selbst und hängt ihn unter „Profil" ein (Muster:
 * praxis-rechtslinks-einstellungen.js) — dashboard.html/dashboard.js wachsen nicht.
 * Der QR-Schreiber (vendor/qrcode.js, 68 KB) wird erst beim Öffnen von Einstellungen geladen.
 *
 * @param {object}   deps
 * @param {object}   deps.profile    currentProfile (Owner)
 * @param {Function} deps.showToast
 */

export const HINWEIS = 'Ihre Mitarbeiter scannen diesen Code mit der Handykamera und legen die Praxis-App '
  + 'mit zwei Fingertipps auf ihren Startbildschirm — ohne Link, ohne Adresse abzutippen. Angemeldet wird '
  + 'sich danach wie gewohnt mit E-Mail und Passwort.';
export const WARNUNG = 'Nur im Team weitergeben, nicht öffentlich aushängen oder posten: Der Code führt zur '
  + 'Anmeldeseite Ihrer Praxis.';

/** Adresse, auf die der QR-Code zeigt. */
export function appAdresse(origin) {
  return String(origin || '').replace(/\/+$/, '') + '/app.html';
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Druckblatt für das Team: Name, QR, drei Schritte. */
export function druckblattHtml({ praxisName, adresse, svg }) {
  const name = esc(praxisName || 'Ihre Praxis');
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>App für Mitarbeiter — ${name}</title>
<style>body{font-family:system-ui,sans-serif;color:#1A1611;max-width:640px;margin:40px auto;padding:0 24px;text-align:center}
h1{font-weight:500;font-size:28px;margin:0 0 6px}.sub{color:#685E52;margin:0 0 28px}
.qr{width:300px;height:300px;margin:0 auto 24px}.qr svg{width:100%;height:100%}
ol{text-align:left;display:inline-block;font-size:16px;line-height:1.7;margin:0 0 20px}
.url{font-family:monospace;font-size:13px;color:#685E52;word-break:break-all}
.klein{font-size:12px;color:#685E52;margin-top:24px}@media print{body{margin:0 auto}}</style></head>
<body><h1>${name}</h1><p class="sub">Praxis-App für Ihr Handy</p><div class="qr">${svg}</div>
<ol><li>Handykamera öffnen und den Code scannen.</li><li>Den Hinweisen auf der Seite folgen (Android: „App installieren", iPhone: Teilen → „Zum Home-Bildschirm").</li>
<li>App vom Startbildschirm öffnen und mit E-Mail und Passwort anmelden.</li></ol>
<div class="url">${esc(adresse)}</div><p class="klein">Nur für das Praxisteam — bitte nicht öffentlich aushängen.</p></body></html>`;
}

function knopf(doc, id, text, klasse = 'btn-ghost') {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = klasse;
  b.id = id;
  b.textContent = text;
  return b;
}

function abschnittBauen(doc) {
  const sec = doc.createElement('div');
  sec.className = 'settings-section';
  sec.id = 'settingsMitarbeiterAppSection';
  const titel = doc.createElement('div');
  titel.className = 'settings-section-title';
  titel.textContent = 'App für Mitarbeiter';
  const body = doc.createElement('div');
  body.className = 'settings-section-body';

  const hinweis = doc.createElement('p');
  hinweis.style.cssText = 'font-size:13px;color:var(--text-muted);margin:0 0 14px;line-height:1.5;';
  hinweis.textContent = HINWEIS;

  const reihe = doc.createElement('div');
  reihe.style.cssText = 'display:flex;flex-wrap:wrap;gap:18px;align-items:center;';
  const qr = doc.createElement('div');
  qr.id = 'mitarbeiterAppQr';
  // Weißer Grund auch im Dark Theme — Kameras lesen hell auf dunkel schlecht.
  qr.style.cssText = 'width:168px;height:168px;flex:none;border-radius:10px;overflow:hidden;background:#fff;'
    + 'border:1px solid var(--border-color, rgba(0,0,0,.08));';
  const rechts = doc.createElement('div');
  rechts.style.cssText = 'flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px;';
  const adresse = doc.createElement('code');
  adresse.id = 'mitarbeiterAppAdresse';
  adresse.style.cssText = 'font-size:12px;color:var(--text-muted);word-break:break-all;';
  const knoepfe = doc.createElement('div');
  knoepfe.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
  knoepfe.append(
    knopf(doc, 'mitarbeiterAppTeilen', 'Teilen', 'btn-primary'),
    knopf(doc, 'mitarbeiterAppKopieren', 'Link kopieren'),
    knopf(doc, 'mitarbeiterAppDrucken', 'QR-Code drucken'),
  );
  rechts.append(adresse, knoepfe);
  reihe.append(qr, rechts);

  const warnung = doc.createElement('p');
  warnung.style.cssText = 'font-size:12px;color:var(--text-muted);margin:14px 0 0;';
  warnung.textContent = WARNUNG;

  body.append(hinweis, reihe, warnung);
  sec.append(titel, body);
  return sec;
}

async function kopieren(text, showToast) {
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error('kein Clipboard');
    await navigator.clipboard.writeText(text);
    showToast('Link kopiert.', 'success');
  } catch {
    // Box mit eigener CA / http: kein Clipboard — Link zum Markieren anbieten.
    window.prompt('Link kopieren:', text);
  }
}

export async function renderMitarbeiterAppSettings(deps, doc = document) {
  if (deps.profile?.role !== 'owner') return;
  if (doc.getElementById('settingsMitarbeiterAppSection')) return;
  const profil = doc.getElementById('settingsProfileSection');
  if (!profil) return;
  // Nach „Impressum & Datenschutz", falls vorhanden — sonst direkt unter „Profil".
  const vor = doc.getElementById('settingsRechtslinksSection') || profil;
  const sec = abschnittBauen(doc);
  vor.after(sec);

  const adresse = appAdresse(window.location.origin);
  const praxisName = deps.profile?.business_name || '';
  doc.getElementById('mitarbeiterAppAdresse').textContent = adresse;

  let svg = '';
  try {
    const { qrSvg } = await import('./qr-svg.js?v=20261022');
    svg = qrSvg(adresse, { titel: 'QR-Code: Praxis-App' });
    doc.getElementById('mitarbeiterAppQr').innerHTML = svg;
  } catch (e) {
    console.error('[mitarbeiter-app] QR', e);
    doc.getElementById('mitarbeiterAppQr').textContent = 'QR-Code nicht verfügbar';
  }

  const teilen = doc.getElementById('mitarbeiterAppTeilen');
  if (!navigator.share) teilen.hidden = true;
  teilen.addEventListener('click', async () => {
    try {
      await navigator.share({
        title: praxisName ? `${praxisName} — Praxis-App` : 'Praxis-App',
        text: 'Link öffnen und die Praxis-App auf den Startbildschirm legen:',
        url: adresse,
      });
    } catch (e) {
      if (e?.name !== 'AbortError') kopieren(adresse, deps.showToast);
    }
  });
  doc.getElementById('mitarbeiterAppKopieren').addEventListener('click', () => kopieren(adresse, deps.showToast));
  doc.getElementById('mitarbeiterAppDrucken').addEventListener('click', () => {
    if (!svg) { deps.showToast('QR-Code nicht verfügbar.', 'error'); return; }
    const w = window.open('', '_blank');
    if (!w) { deps.showToast('Bitte Pop-ups für diese Seite erlauben.', 'error'); return; }
    w.document.write(druckblattHtml({ praxisName, adresse, svg }));
    w.document.close();
    w.focus();
    w.print();
  });
}
