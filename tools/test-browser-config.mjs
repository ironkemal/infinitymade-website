// Node-Tests importieren Browsermodule ohne Webserver. Nur diesen Configaufruf
// beantworten; Produktcode behält seine strikte Prüfung und Fehleranzeige.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  if (input === '/api/config') return Promise.resolve(new Response(JSON.stringify({
    supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetic-public-test-key',
    apiBase: '/api', istKutu: false, telemetryEnabled: false,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  return originalFetch(input, options);
};
