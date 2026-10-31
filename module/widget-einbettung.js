/**
 * widget-einbettung.js — Einbettungscode für das Termin-Anfrage-Widget (Physio/PILOT-PLAN.md M7).
 *
 * Nur `widget/booking-widget.html` darf gerahmt werden, `booking.html` nie (guvenlik, Header in vercel.json
 * und onprem/Caddyfile). Der Host folgt der Dagitim:
 * - Box: `location.origin`. Zeigte der Code auf praxura.de, sähe Praxura IP und Referer der Patienten und
 *   wäre wieder Auftragsverarbeiter (legal-de, O-211). Eine Box im LAN erreicht kein Patient, also kein Code (O-155).
 * - SaaS: `praxura.de`, weil Vercel nur diesen Host rahmt, nicht die App-Subdomain.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAAS_HOST = 'https://praxura.de';
const INTERNE_ENDUNG = /\.(home\.arpa|local|lan|internal|intranet)$/i;
const PRIVATE_IP = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function istOeffentlicherHost(origin) {
  let adresse;
  try {
    adresse = new URL(origin);
  } catch {
    return false;
  }
  if (adresse.protocol !== 'https:') return false;
  const host = adresse.hostname;
  return host !== 'localhost' && host.includes('.') && !INTERNE_ENDUNG.test(host) && !PRIVATE_IP.test(host);
}

/** Adresse für den Code, oder null, wenn von außen niemand ankommt. */
export function einbettungsHost({ istKutu, origin }) {
  if (!istKutu) return SAAS_HOST;
  return istOeffentlicherHost(origin) ? new URL(origin).origin : null;
}

export function einbettungsCode({ host, ownerId }) {
  if (!host || !UUID.test(ownerId || '')) return '';
  return `<iframe src="${host}/widget/booking-widget.html?owner=${ownerId}"\n`
    + '  title="Terminanfrage" loading="lazy"\n'
    + '  style="width:100%;max-width:600px;height:720px;border:0"\n'
    + '  sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"\n'
    + '  referrerpolicy="strict-origin"\n'
    + "  allow=\"camera 'none'; microphone 'none'; geolocation 'none'\"></iframe>";
}

export function einbettungsHinweis({ istKutu }) {
  const gemeinsam = 'Ergänzen Sie Ihre Datenschutzerklärung um die Terminanfrage, pflegen Sie Impressums- und '
    + 'Datenschutz-URL, nutzen Sie nur HTTPS-Seiten.';
  if (istKutu) return `Das Formular läuft auf Ihrem Server; Sie sind verantwortlich. ${gemeinsam}`;
  return `${gemeinsam} Testkonten nicht auf einer öffentlichen Webseite einbauen.`;
}

function baueBlock(code, hinweis, kopieren) {
  const block = document.createElement('div');
  block.id = 'widgetEinbettung';
  block.style.cssText = 'background:var(--bg-card-solid);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px';
  const titel = document.createElement('div');
  titel.style.cssText = 'font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:4px';
  titel.textContent = 'Auf Ihrer Webseite einbinden';
  const text = document.createElement('div');
  text.style.cssText = 'font-size:12px;color:var(--text-sub);margin-bottom:10px';
  block.append(titel, text);
  if (!code) {
    text.textContent = 'Dieser Server ist aus dem Internet nicht erreichbar. Patienten kämen nicht zum Formular, '
      + 'deshalb gibt es hier keinen Code. Teilen Sie stattdessen den Link oben.';
    return block;
  }
  text.textContent = 'Fügen Sie diesen Code dort ein, wo das Anfrageformular erscheinen soll.';
  const feld = document.createElement('textarea');
  feld.id = 'widgetEinbettungCode';
  feld.readOnly = true;
  feld.rows = 6;
  feld.className = 'input-field';
  feld.style.cssText = 'width:100%;font-family:monospace;font-size:12px;resize:vertical';
  feld.value = code;
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'btn-secondary';
  knopf.style.cssText = 'margin-top:8px;padding:8px 14px;font-size:13px';
  knopf.textContent = 'Code kopieren';
  knopf.addEventListener('click', () => kopieren(code));
  const rechtlich = document.createElement('div');
  rechtlich.style.cssText = 'font-size:12px;color:var(--text-sub);margin-top:10px';
  rechtlich.textContent = hinweis;
  block.append(feld, knopf, rechtlich);
  return block;
}

/** Setzt den Block hinter `nachElement`. Mehrfacher Aufruf ersetzt ihn. */
export function mountWidgetEinbettung(nachElement, { ownerId, istKutu, origin, showToast }) {
  if (!nachElement) return;
  document.getElementById('widgetEinbettung')?.remove();
  const code = einbettungsCode({ host: einbettungsHost({ istKutu, origin }), ownerId });
  const kopieren = text => navigator.clipboard.writeText(text)
    .then(() => showToast('Code kopiert!', 'success'))
    .catch(() => showToast('Kopieren nicht möglich. Bitte den Code markieren.', 'error'));
  nachElement.after(baueBlock(code, einbettungsHinweis({ istKutu }), kopieren));
}
