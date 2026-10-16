/** Gemeinsamer Startschutz für Login und Dashboard; keine Sitzung oder Secrets speichern. */
export async function ladeAppKonfiguration({ fetchFn = globalThis.fetch, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchFn('/api/config', { signal: controller.signal, cache: 'no-store' });
        if (!response?.ok) throw new Error('CONFIG_HTTP');
        const config = await response.json();
        if (!config || typeof config.supabaseUrl !== 'string' || typeof config.supabaseAnonKey !== 'string' || !config.supabaseAnonKey.trim()) throw new Error('CONFIG_SCHEMA');
        const url = new URL(config.supabaseUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('CONFIG_SCHEMA');
        if (config.apiBase != null && (typeof config.apiBase !== 'string' || !config.apiBase.trim()
          || (!/^\/(?!\/)/.test(config.apiBase) && !/^https?:\/\//.test(config.apiBase)))) throw new Error('CONFIG_SCHEMA');
        return config;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('CONFIG_TIMEOUT')); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function pruefeStartprofil(profile, userId) {
  if (!profile || profile.id !== userId || !['owner', 'employee'].includes(profile.role)
    || profile.plan_status === 'deleted'
    || (profile.role === 'employee' && (!profile.owner_id || profile.is_active === false))) throw new Error('PROFILE_UNAVAILABLE');
  return profile;
}

export function zeigeStartfehler(doc = globalThis.document, reload = () => globalThis.location.reload(), hinweis = 'Bitte Verbindung prüfen und erneut versuchen. Ihre Sitzung bleibt erhalten.') {
  if (!doc) return;
  const render = () => {
    if (doc.getElementById('appStartFehler')) return;
    for (const element of [...doc.body.children]) element.hidden = true;
    const panel = doc.createElement('main');
    panel.id = 'appStartFehler';
    panel.setAttribute('role', 'alert');
    panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;gap:16px;padding:24px;background:var(--bg-main,#fff);color:var(--text-main,#17212b);font:16px system-ui;text-align:center;';
    const title = doc.createElement('h1'); title.textContent = 'Praxura konnte nicht geladen werden.';
    const message = doc.createElement('p'); message.textContent = hinweis;
    const button = doc.createElement('button'); button.type = 'button'; button.textContent = 'Erneut versuchen';
    button.style.cssText = 'min-height:44px;padding:12px 20px;font:inherit;cursor:pointer;';
    button.addEventListener('click', reload);
    panel.append(title, message, button); doc.body.append(panel); button.focus();
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
}
