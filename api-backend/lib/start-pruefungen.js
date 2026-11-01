// Warnzeilen beim Start — Fehlkonfigurationen, die sonst still bleiben (onprem O-230, O-232).
//
// 1. KI-Deployment ungueltig: im SaaS stand die KI 23 Tage still, weil der Deployment-Name
//    einen Punkt hatte und niemand die Ablehnung sah (O-230). Jetzt eine Zeile im Log.
// 2. Box ohne SUPABASE_PUBLIC_URL: istKutu() (lib/dagitim.js) haengt an dieser einen
//    Variable. Fehlt sie, verhaelt sich eine Box in allen Gates wie SaaS, die KI-Freigabe
//    faellt auf die SaaS-Kennung (O-232). Erkennbar an einer vorhandenen Box-Kimlik.
// Nur Warnungen, kein Abbruch: ein Start-Abbruch wuerde im SaaS bei Watchtower in einer
// Neustart-Schleife enden. Keine Werte aus env im Log, nur Namen und Codes.

/**
 * @param {{env?: object, kimlikVorhanden?: boolean, aiConfig?: {mode?: string, valid?: boolean, code?: string}}} p
 * @returns {string[]}
 */
export function startWarnungen({ env = process.env, kimlikVorhanden = false, aiConfig = null } = {}) {
  const warnungen = [];
  if (aiConfig && aiConfig.mode && aiConfig.mode !== 'aus' && aiConfig.valid === false) {
    warnungen.push(`[start] KI-Konfiguration ungueltig (${aiConfig.code || 'unbekannt'}) — KI bleibt aus, bis die Werte korrigiert sind.`);
  }
  if (kimlikVorhanden && !env.SUPABASE_PUBLIC_URL) {
    warnungen.push('[start] Box-Kimlik vorhanden, aber SUPABASE_PUBLIC_URL fehlt — die Box verhaelt sich wie SaaS. Bitte .env pruefen.');
  }
  return warnungen;
}
