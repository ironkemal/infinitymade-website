// Structured series ranking: only offered candidates can survive output validation.
import { executeKiTask } from '../ki-gateway.js';
/**
 * @param {import('../ki-gateway.js').GatewayPayload} payload
 * @param {import('../ki-gateway.js').GatewayContext} [context={}]
 */
export async function run(payload, context = {}) {
  /** @type {Array<{ date: string, time: string, employeeId?: string }>} */
  let maskedCandidates = [];
  const {output,meta} = await executeKiTask({
    task:'series-scheduler',payload,context,
    buildMessages:p => {
      maskedCandidates = p.candidates || [];
      return [{role:'system',content:'Du planst Heilmitteltermine. Wähle ausschließlich angebotene Kandidaten, höchstens einen Termin je Datum und höchstens count Termine. Berücksichtige Präferenzen und vorige Auswahl. Antworte nur als JSON mit genau selected (Array aus Objekten mit genau date,time,employeeId) und report (kurze deutsche Erklärung). Übernimm Platzhalter unverändert.'}, {role:'user',content:JSON.stringify(p)}];
    },
    validateOutput:p => {
      if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).sort().join(',') !== 'report,selected') return false;
      if (!Array.isArray(p.selected) || p.selected.length > Math.min(payload.count || 60,60) || typeof p.report !== 'string' || !p.report.trim() || p.report.length > 2000) return false;
      const dates = new Set();
      for (const s of p.selected) {
        if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).sort().join(',') !== 'date,employeeId,time') return false;
        const slot = /** @type {Record<string, unknown>} */ (s);
        if (![slot.date,slot.time,slot.employeeId].every(v => typeof v === 'string') || dates.has(slot.date)) return false;
        if (!maskedCandidates.some(c => c.date === slot.date && c.time === slot.time && c.employeeId === slot.employeeId)) return false;
        dates.add(slot.date);
      }
      return true;
    },
    chatOptions:{responseFormat:{type:'json_object'},temperature:0.2,maxTokens:2000},dependencies:context.dependencies || {}
  });
  return {selected:output.selected,report:output.report,_meta:meta};
}
