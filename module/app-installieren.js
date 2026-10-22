// app.html — „App für Mitarbeiter" (22.10.2026, onprem O-214). Ziel des QR-Codes aus
// Einstellungen: Die Mitarbeiterin scannt, diese Seite führt sie zum Symbol auf dem
// Startbildschirm. Automatisch anlegen darf keine Webseite ein Symbol (Apple wie
// Google) — Android: ein Knopf (beforeinstallprompt), iPhone: zwei Schritte im
// Teilen-Menü. Kein Service Worker (onprem O-214: Cache-Risiko bei Box-Updates,
// Ops #26 „keine PHI im SW-Cache").
//
// Der Praxisname kommt aus /manifest.json: in der Box liefert api ihn dort
// (routes/manifest.js), im SaaS steht „Praxura" — eine Quelle, keine Abfrage hier.

/** Welche Anleitung? 'installiert' | 'ios' | 'android' | 'andere'. */
export function plattform({ ua = '', standalone = false, touchPunkte = 0 } = {}) {
  if (standalone) return 'installiert';
  // iPadOS 13+ meldet sich als Mac — erkennbar nur an den Touchpunkten.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPunkte > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'andere';
}

/** Manifest-JSON → Anzeigename; alles Unbrauchbare → „Praxura". */
export function praxisNameAus(manifest) {
  const n = typeof manifest?.name === 'string' ? manifest.name.trim() : '';
  return n || 'Praxura';
}

function zeige(id, an = true) { const el = document.getElementById(id); if (el) el.hidden = !an; }

async function nameLaden() {
  try {
    const res = await fetch('/manifest.json', { cache: 'no-store' });
    if (res.ok) return praxisNameAus(await res.json());
  } catch { /* Grundname */ }
  return 'Praxura';
}

function nameSetzen(name) {
  document.getElementById('praxisName').textContent = name;
  document.title = name;
  // iOS nimmt den Namen unter dem Symbol aus diesem Meta (bzw. dem Titel).
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', name);
}

export async function start() {
  const art = plattform({
    ua: navigator.userAgent,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true,
    touchPunkte: navigator.maxTouchPoints || 0,
  });
  // Vom Startbildschirm geöffnet: gleich in die Anwendung (dashboard leitet ggf. zum Login).
  if (art === 'installiert') { location.replace('/dashboard.html'); return; }

  nameSetzen(await nameLaden());
  zeige('wegIos', art === 'ios');
  zeige('wegAndere', art === 'andere');

  if (art !== 'android') return;
  zeige('wegAndroid');
  // Box mit eigener CA (tls internal): kein sicherer Kontext → nie ein Install-Angebot.
  if (!window.isSecureContext) { zeige('androidMenue'); zeige('unsicherHinweis'); return; }
  let angebot = null;
  const knopf = document.getElementById('installKnopf');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    angebot = e;
    knopf.hidden = false;
    zeige('androidMenue', false);
  });
  window.addEventListener('appinstalled', () => {
    knopf.hidden = true;
    zeige('androidMenue', false);
    zeige('installiertMeldung');
  });
  knopf.addEventListener('click', async () => {
    if (!angebot) return;
    angebot.prompt();
    const { outcome } = await angebot.userChoice;
    angebot = null;
    knopf.hidden = true;
    if (outcome !== 'accepted') zeige('androidMenue');
  });
  // Kein Angebot vom Browser (schon installiert, anderer Browser, Kriterien nicht
  // erfüllt): der Weg über das Menü funktioniert trotzdem.
  setTimeout(() => { if (!angebot) zeige('androidMenue'); }, 2500);
}
