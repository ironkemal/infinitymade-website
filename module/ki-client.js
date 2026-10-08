/** Local authenticated KI client. Default off; server capabilities remain authoritative. */
export const CURRENT_EINWILLIGUNG_VERSION = '2026-10-08-v1';
const TASKS = new Set(['b2c-draft', 'b2b-draft', 'appointment-confirm-draft', 'series-rank', 'series_meta']);
const MAIL = new Set(['b2c-draft', 'b2b-draft']);
const DEFAULT_AI_BASE = '/api/ai';
const fail = (code, message, status = 400) => Object.assign(new Error(message), { code, status, kiClientError:true });
const offline = () => ({ effective:false, mode:'aus', operatorReady:false, ownerActive:false, mailReady:false, freeText:false,
  capabilities:{mailDraft:false,appointmentDraft:false,freeText:false}, disabledReason:'KI_DEAKTIVIERT',
  disabledReasonText:'KI-Unterstützung ist deaktiviert oder derzeit nicht erreichbar.', informationVersion:null, decidedAt:null });

export async function getKiConfig(deps = {}) {
  try {
    const token = await deps.getToken?.();
    if (typeof token !== 'string' || !token) return offline();
    const employee = deps.isOwner?.() === false || (deps.getRole && deps.getRole() !== 'owner');
    const res = await (deps.fetchImpl || globalThis.fetch)(`${deps.apiBase || DEFAULT_AI_BASE}/${employee ? '_healthstate' : '_config'}`, {
      method:'GET',headers:{Authorization:`Bearer ${token}`}
    });
    if (!res.ok) return offline();
    const data = await res.json();
    const mode = ['aus','direkt','jeton'].includes(data.mode) ? data.mode : 'aus';
    const valid = (employee ? data.ok === true : data.success === true) && ['direkt','jeton'].includes(mode);
    const effective = valid && data.active === true && (employee || (data.operatorReady === true && data.ownerActive === true));
    const capabilities = {
      freeText:effective && mode === 'direkt' && data.capabilities?.freeText === true,
      mailDraft:effective && mode === 'direkt' && data.capabilities?.freeText === true && data.capabilities?.mailDraft === true,
      appointmentDraft:effective && data.capabilities?.appointmentDraft === true
    };
    return { ...offline(), mode,effective,operatorReady:data.operatorReady === true,ownerActive:data.ownerActive === true,
      mailReady:data.mailReady === true || (employee && capabilities.appointmentDraft),freeText:capabilities.freeText,capabilities,
      disabledReason:effective ? null : 'KI_DEAKTIVIERT',disabledReasonText:effective ? null : offline().disabledReasonText,
      informationVersion:typeof data.optIn?.informationVersion === 'string' ? data.optIn.informationVersion : null,
      decidedAt:typeof data.optIn?.decidedAt === 'string' && Number.isFinite(Date.parse(data.optIn.decidedAt)) ? data.optIn.decidedAt : null };
  } catch { return offline(); }
}
export async function isKiEffectivelyEnabled(deps = {}) { return (await getKiConfig(deps)).effective === true; }
export async function isKiMailEnabled(deps = {}) { return (await getKiConfig(deps)).capabilities.mailDraft === true; }

export async function updateOwnerOptIn(options, deps = {}) {
  if (!options || Object.keys(options).some(k => !['enabled','informationVersion'].includes(k)) || typeof options.enabled !== 'boolean')
    throw fail('KI_CONFIG_INVALID','Ungültige KI-Einstellung.');
  if (deps.isOwner?.() === false) throw fail('KI_OWNER_REQUIRED','Nur der Praxisinhaber darf die KI-Einwilligung verwalten.',403);
  const informationVersion = options.informationVersion ?? CURRENT_EINWILLIGUNG_VERSION;
  if (informationVersion !== CURRENT_EINWILLIGUNG_VERSION) throw fail('KI_CONFIG_INVALID','Bitte aktuelle Information zur KI-Nutzung lesen.');
  const token = await deps.getToken?.();
  if (typeof token !== 'string' || !token) throw fail('KI_AUTH_REQUIRED','Keine gültige Sitzung vorhanden.',401);
  let res,data;
  try {
    res = await (deps.fetchImpl || globalThis.fetch)(`${deps.apiBase || DEFAULT_AI_BASE}/_config`, {method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({enabled:options.enabled,informationVersion})});
    data = await res.json();
  } catch { throw fail('KI_CONFIG_SAVE_FAILED','KI-Einstellung konnte nicht gespeichert werden.',503); }
  if (!res.ok || data.success !== true) throw fail('KI_CONFIG_SAVE_FAILED','KI-Einstellung konnte nicht gespeichert werden.',res.status || 503);
  return data;
}

export function validateKiChallenge(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || typeof value.challengeId !== 'string' || ! /^[a-f0-9]{64}\.\d{13}$/.test(value.challengeId) || Number(value.challengeId.split('.')[1]) !== value.expiresAt ||
      !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + 300000 ||
      !Array.isArray(value.candidates) || value.candidates.length < 1 || value.candidates.length > 5) return false;
  const seen = new Set();
  return value.candidates.every(c => c && typeof c.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(c.id) && !seen.has(c.id) &&
    (seen.add(c.id),true) && typeof c.text === 'string' && c.text.length > 0 && c.text.length <= 200 && typeof c.type === 'string' && /^[A-Z_]{1,30}$/.test(c.type));
}
function validateChoices(challenge, choices) {
  if (!Array.isArray(choices) || choices.length !== challenge.candidates.length) return false;
  const ids = new Set(challenge.candidates.map(c=>c.id));
  return choices.every(c => c && Object.keys(c).length === 2 && ids.delete(c.id) && ['maskieren','kein_name'].includes(c.action)) && ids.size === 0;
}

/** Tracks event edits (including edit then undo) and programmatic source changes. */
export function createKiSourceGuard(elements = [], getValue = () => elements.map(el => el?.value)) {
  const initial = JSON.stringify(getValue());
  let edited = false;
  const mark = () => { edited = true; };
  for (const el of elements) { el?.addEventListener('input',mark);el?.addEventListener('change',mark); }
  return { isSourceEdited:()=>edited || JSON.stringify(getValue()) !== initial,
    dispose:()=>{for(const el of elements) {el?.removeEventListener('input',mark);el?.removeEventListener('change',mark);}} };
}

export async function requestKiTask(task, payload, deps = {}) {
  if (!TASKS.has(task)) throw fail('KI_TASK_INVALID','Unbekannte KI-Aktion.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(k=>['tenantId','tenant_id','ki_confirmation'].includes(k)))
    throw fail('KI_PAYLOAD_INVALID','Ungültige KI-Eingabe.');
  const snapshot = JSON.parse(JSON.stringify(payload));
  const fingerprint = JSON.stringify(payload);
  const edited = () => deps.isSourceEdited?.() === true || JSON.stringify(payload) !== fingerprint;
  const cfg = await (deps.getKiConfig || getKiConfig)(deps);
  if (cfg.effective !== true || !['direkt','jeton'].includes(cfg.mode)) throw fail('AI_MODE_AUS','KI-Unterstützung ist deaktiviert. Manuelle Funktionen bleiben verfügbar.',503);
  if (MAIL.has(task) && !(cfg.mode === 'direkt' && cfg.capabilities?.freeText === true && cfg.capabilities?.mailDraft === true))
    throw fail('AI_MAIL_NOT_READY','E-Mail-Assistent ist derzeit deaktiviert.',503);
  if (task === 'appointment-confirm-draft' && !(cfg.capabilities?.appointmentDraft === true && cfg.mailReady === true))
    throw fail('AI_MAIL_NOT_READY','Termin-E-Mail-Assistent ist derzeit deaktiviert.',503);
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const post = async body => {
    const token = await deps.getToken?.();
    if (typeof token !== 'string' || !token) throw fail('KI_AUTH_REQUIRED','Keine gültige Sitzung vorhanden.',401);
    if (edited()) throw fail('KI_SOURCE_EDITED','Eingabe wurde geändert. Bitte Aktion neu starten.');
    return fetchImpl(`${deps.apiBase || DEFAULT_AI_BASE}/${task}`, {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
  };
  const decode = async res => {try {return await res.json();} catch {return {};}};
  const success = (res,data) => { if (!res.ok || data.success !== true) throw fail('KI_TASK_FAILED','KI-Verarbeitung fehlgeschlagen. Bitte manuell fortfahren.',res.status || 503);return data; };
  let res;
  try {res = await post(snapshot);} catch (err) {if (err.kiClientError === true) throw err;throw fail('KI_NETWORK_ERROR','KI-Dienst derzeit nicht erreichbar.',503);}
  const data = await decode(res);
  if (res.ok) return success(res,data);
  if (res.status !== 409 || data.code !== 'KI_RUECKFRAGE' || cfg.mode !== 'direkt') return success(res,data);
  const challenge = data.challenge || data;
  if (!validateKiChallenge(challenge)) throw fail('KI_CHALLENGE_INVALID','Rückfrage ist ungültig oder abgelaufen.');
  if (edited()) throw fail('KI_SOURCE_EDITED','Eingabe wurde geändert. Bitte Aktion neu starten.');
  if (typeof deps.zeigeKiRueckfrageDialog !== 'function') throw fail('KI_RUECKFRAGE_HANDLER_MISSING','Rückfrage kann derzeit nicht angezeigt werden.',409);
  const decision = await deps.zeigeKiRueckfrageDialog(challenge,{...deps,isSourceEdited:edited});
  if (!decision) throw Object.assign(fail('KI_RUECKFRAGE_ABGEBROCHEN','Rückfrage abgebrochen. Kein weiterer KI-Aufruf.'),{canceled:true});
  if (!validateChoices(challenge,decision.choices)) throw fail('KI_CHOICES_INVALID','Bitte vollständige Rückfrage beantworten.');
  // Fresh session retrieval may itself overlap expiry or source edits.
  const token = await deps.getToken?.();
  if (typeof token !== 'string' || !token) throw fail('KI_AUTH_REQUIRED','Keine gültige Sitzung vorhanden.',401);
  if (edited()) throw fail('KI_SOURCE_EDITED','Eingabe wurde geändert. Bitte Aktion neu starten.');
  if (!validateKiChallenge(challenge)) throw fail('KI_CHALLENGE_EXPIRED','Rückfrage ist abgelaufen. Bitte Aktion neu starten.');
  try {res = await fetchImpl(`${deps.apiBase || DEFAULT_AI_BASE}/${task}`, {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...snapshot,ki_confirmation:{challengeId:challenge.challengeId,choices:decision.choices}})});}
  catch {throw fail('KI_NETWORK_ERROR','KI-Dienst derzeit nicht erreichbar.',503);}
  if (res.status === 409) throw fail('KI_RETRY_LIMIT','Rückfrage konnte nicht bestätigt werden.',409);
  return success(res,await decode(res));
}

export async function runMailDraftInUi({task='b2c-draft',intent,contacts=[],ownerInfo={},containerId='aiMessages',aiAddMsg,openComposeModal},deps={}) {
  aiAddMsg?.(intent,'user',containerId);
  const msgs = globalThis.document?.getElementById(containerId);
  const loading = msgs ? document.createElement('div') : null;
  if (loading) {loading.className='msg-bubble ai';loading.textContent='KI bereitet E-Mail vor…';msgs.appendChild(loading);}
  try {
    const result=await requestKiTask(task,{intent,contacts:contacts.slice(0,30),owner_info:ownerInfo},deps);
    if (!result.draft) throw fail('KI_TASK_FAILED','Kein E-Mail-Entwurf verfügbar.');
    aiAddMsg?.('Entwurf erstellt — bitte prüfen und manuell senden.','ai',containerId);
    openComposeModal?.(result.draft);return result.draft;
  } catch(err) {aiAddMsg?.(err.canceled ? 'Vorgang abgebrochen.' : 'KI-Entwurf derzeit nicht verfügbar. Bitte manuell schreiben.','ai',containerId);throw err;}
  finally {loading?.remove();}
}

/** Dashboard seam: shared modal handlers and current form generation. */
export function makeKiUiDependencies(deps, sourceId, getSource = () => null) {
  const doc = deps.document || globalThis.document;
  const source = doc?.getElementById(sourceId);
  const guard = createKiSourceGuard(source ? [source] : [], () => [source?.value,getSource()]);
  return {...deps,...guard};
}
export async function refreshKiControls(deps = {}) {
  const doc = deps.document || globalThis.document;
  const ids = ['aiInput','aiSendBtn','aiVoiceBtn','b2cAiInput','b2cAiSendBtn','b2cAiVoiceBtn'];
  ids.forEach(id=>{const el=doc?.getElementById(id);if(el) el.disabled=true;});
  const cfg = await getKiConfig(deps);
  ids.forEach(id=>{const el=doc?.getElementById(id);if(el) {el.disabled=id.endsWith('VoiceBtn') || cfg.capabilities.mailDraft !== true;el.title=el.disabled ? 'KI-E-Mail-Assistent derzeit deaktiviert. Manuelles Schreiben bleibt verfügbar.' : '';}});
  return cfg;
}
