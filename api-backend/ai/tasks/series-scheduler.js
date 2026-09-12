// Task: series-scheduler — KI-Rangfolge für eine Terminserie (mehrere Wunschtage,
// je Tag ein Slot).
//
// Ersetzt den n8n-Workflow "AI Series Scheduler" (Q7u38AtRd4JIdolD, Webhook →
// Build Prompt → Azure OpenAI → Parse Response). Warum direkt statt über n8n:
// dieselbe Regel wie bei rezept-ocr/rezept-normalize — Azure-Aufrufe laufen
// direkt aus Express, n8n ist kein AI-Proxy (CLAUDE.md). Zusätzlicher Grund
// hier: `N8N_AI_SERIES_URL` fiel bei leerer Variable auf eine HARDCODED
// n8n.infinitymade.de-Adresse zurück und schickte den Patientennamen dorthin —
// in einer On-Prem-Box ohne n8n bedeutete das reale Patientendaten Richtung
// Zentrale (G1, onprem/REGISTER.md O-02). Diese Datei macht den Fallback
// überflüssig: es gibt keine URL mehr, die leer sein könnte.
//
// Prompt-Text und Regeln sind wortgleich aus dem n8n-Workflow übernommen
// (Build-Prompt-Node, JS) — bewusst 1:1, damit sich das Vorschlagsverhalten
// für Bestandskunden nicht ändert. Nur der Transportweg ändert sich.
//
// Input  : dasselbe Payload-Objekt, das server.js bisher an N8N_AI_URL schickte
// Output : { selected: [{date,time,employeeId}], report: string }
//          Wirft bei Azure-Fehler/Non-JSON — der Aufrufer faellt auf die
//          deterministische Auswahl zurueck (server.js, unveraendert).

import { chat } from '../azureClient.js';

const SECTOR_NAMES = {
  barber: 'Friseur/Beauty/Kosmetiksalon',
  beauty: 'Beauty-Salon',
  physiotherapy: 'Physiotherapie-Praxis'
};

function buildPrompt(body) {
  const candidates = body.candidates || [];
  const count = body.count || 8;
  const recurrence = body.recurrence || 'weekly';
  const targetDates = body.targetDates || [];
  const emptyDates = body.emptyDates || [];
  const prefs = body.preferences || {};
  const service = body.service || {};
  const employees = body.employees || [];
  const customer = body.customer || {};
  const sector = body.sector || 'unbekannt';
  const genderFilterApplied = body.genderFilterApplied || null;

  const sectorName = SECTOR_NAMES[sector] || sector;

  const empMap = {};
  const empAnredeMap = {};
  employees.forEach(e => { empMap[e.id] = e.name; empAnredeMap[e.id] = e.anrede || null; });

  const byDate = {};
  candidates.forEach(c => {
    if (!byDate[c.date]) byDate[c.date] = [];
    byDate[c.date].push(c);
  });

  const candText = targetDates.map((d, i) => {
    const wd = new Date(d + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const slots = byDate[d] || [];
    if (slots.length === 0) return '\n[Wunschtag ' + (i + 1) + '] ' + wd + ' (' + d + ') -> KEIN FREIER SLOT (überspringen)';
    const lines = slots.map(s => {
      const an = empAnredeMap[s.employeeId];
      return '   * ' + s.time + ' bei ' + (an ? an + ' ' : '') + (empMap[s.employeeId] || s.employeeId.slice(0, 8));
    }).join('\n');
    return '\n[Wunschtag ' + (i + 1) + '] ' + wd + ' (' + d + ') -> wähle GENAU EINEN dieser Slots:\n' + lines;
  }).join('');

  const empListText = employees.map(e => '- ' + (e.anrede ? e.anrede + ' ' : '') + e.name + (e.anrede ? ' [' + e.anrede + ']' : ' [Anrede unbekannt]') + ' (id: ' + e.id + ')').join('\n');

  let prefText = '';
  if (prefs.sameEmployee === 'always') prefText += 'WICHTIG: Alle Termine MÜSSEN beim selben Mitarbeiter sein.\n';
  else if (prefs.sameEmployee === 'preferred') prefText += 'Bevorzugung: Möglichst alle beim selben Mitarbeiter, nur als letzte Lösung wechseln.\n';
  else prefText += 'Mitarbeiter dürfen frei verteilt werden.\n';
  if (prefs.preferredEmployee) prefText += 'Vom Patient bevorzugter Mitarbeiter: ' + (empMap[prefs.preferredEmployee] || prefs.preferredEmployee) + '\n';
  if (prefs.timeOfDay && prefs.timeOfDay !== 'any') prefText += 'Bevorzugte Tageszeit: ' + (prefs.timeOfDay === 'morning' ? 'Vormittag (8-12 Uhr)' : 'Nachmittag (12-18 Uhr)') + '\n';
  if (prefs.notes) prefText += 'Besondere Wünsche des Patienten: ' + prefs.notes + '\n';
  if (body.userFeedback) prefText += 'ÄNDERUNGSWUNSCH DES NUTZERS zu den vorherigen Vorschlägen (HÖCHSTE PRIORITÄT, unbedingt umsetzen — der Server hat die Slot-Kandidaten bereits entsprechend angepasst): ' + body.userFeedback + '\n';
  if (Array.isArray(body.feedbackApplied) && body.feedbackApplied.length) prefText += 'Vom Server bereits angewendete Änderungen: ' + body.feedbackApplied.join(' · ') + '\n';
  const prevSel = Array.isArray(body.previousSelected) ? body.previousSelected : [];
  if (prevSel.length) prefText += 'VORHERIGE AUSWAHL — jeden Termin, den der Änderungswunsch NICHT betrifft, EXAKT so beibehalten (gleicher Tag, gleiche Zeit, gleicher Mitarbeiter), sofern er unter dem jeweiligen Wunschtag noch angeboten wird:\n' + prevSel.map(s => '- ' + s.date + ' ' + s.time + ' (' + (empMap[s.employeeId] || s.employeeId) + ')').join('\n') + '\n';

  let genderInfo = '';
  if (genderFilterApplied === 'female') genderInfo = '\n\nGESCHLECHTERFILTER aktiv: Der Server hat bereits nur weibliche Mitarbeiter (Anrede=Frau) zur Auswahl gestellt.';
  else if (genderFilterApplied === 'male') genderInfo = '\n\nGESCHLECHTERFILTER aktiv: Der Server hat bereits nur männliche Mitarbeiter (Anrede=Herr) zur Auswahl gestellt.';

  const sectorRules = sector === 'physiotherapy'
    ? '\n\nPHYSIOTHERAPIE-REGELN:\n- Behandlungsserie möglichst beim selben Therapeuten.\n- Wechsel nur als letzter Ausweg.\n- Geschlechterwünsche haben höchste Priorität.\n'
    : '\n\nFRISEUR/BEAUTY-REGELN:\n- Mitarbeiterwechsel akzeptabel, aber Patient-Präferenz einhalten.\n- Termine gleichmäßig verteilen.\n';

  const recurName = recurrence === 'biweekly' ? 'alle 2 Wochen' : (recurrence === 'daily' ? 'täglich' : 'wöchentlich');

  const system = 'Du bist ein intelligenter Termin-Assistent für eine ' + sectorName + '-Praxis in Deutschland.' + sectorRules + genderInfo + '\n\nGRUNDREGELN (UNVERHANDELBAR):\n1. Es gibt eine Liste von WUNSCHTAGEN. Für JEDEN Wunschtag wähle GENAU EINEN Slot aus den dort angebotenen.\n2. NIEMALS denselben Tag zweimal in selected aufnehmen.\n3. NIEMALS einen Slot zurückgeben, der nicht unter dem entsprechenden Wunschtag aufgelistet ist.\n4. Tage mit "KEIN FREIER SLOT" werden übersprungen (nicht in selected aufnehmen) und im report erwähnt.\n5. Halte Uhrzeit und Mitarbeiter so konstant wie möglich (siehe Präferenzen).\n\nAUSGABE: Reines JSON, keine Erklärung außerhalb:\n{\n  "selected": [{"date":"2026-05-21","time":"14:00","employeeId":"uuid"}, ...],\n  "report": "Kurze freundliche deutsche Erklärung (max 4 Sätze). Erwähne übersprungene Tage und Mitarbeiterwechsel."\n}';

  let emptyHint = '';
  if (emptyDates.length) emptyHint = '\n\nWUNSCHTAGE OHNE FREIEN SLOT (in selected weglassen):\n- ' + emptyDates.join('\n- ');

  const user = 'PATIENT: ' + (customer.name || 'unbekannt') + '\nSERVICE: ' + (service.title || 'unbekannt') + ' (' + (service.duration || '?') + ' Min)\nGEWÜNSCHTE ANZAHL TERMINE: ' + count + ' (' + recurName + ')\n\nPRÄFERENZEN:\n' + prefText + '\nMITARBEITER:\n' + empListText + '\n\nWUNSCHTAGE (in dieser Reihenfolge):\n' + candText + emptyHint;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

function mockResponse() {
  // Dry-run/Dev: bewusst LEER statt erfundene Termine — der Aufrufer (server.js)
  // faellt dann auf die deterministische Auswahl zurueck, genau wie bei einem
  // echten Azure-Ausfall. Kein Unterschied zwischen "n8n war down" und
  // "Azure ist in diesem Environment nicht konfiguriert".
  return JSON.stringify({ selected: [], report: '' });
}

/**
 * @param {object} payload  dasselbe Objekt, das bisher an N8N_AI_URL ging
 *                          (candidates, count, recurrence, targetDates, …)
 * @returns {Promise<{selected: Array, report: string}>}
 * @throws  bei Azure-Fehler oder nicht-JSON-Antwort — Aufrufer faengt ab
 */
export async function run(payload) {
  const result = await chat({
    messages: buildPrompt(payload || {}),
    responseFormat: { type: 'json_object' },
    temperature: 0.2,
    maxTokens: 2000,
    // Kein deployment-Override — Standard-Deployment wie bei rezept-ocr.js
    // (AZURE_OPENAI_DEPLOYMENT env, produktiv bereits gpt-4.1-mini).
    mockFn: mockResponse
  });

  let parsed;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new Error('series-scheduler returned non-JSON content');
  }

  return {
    selected: Array.isArray(parsed.selected) ? parsed.selected : [],
    report: typeof parsed.report === 'string' ? parsed.report : ''
  };
}
