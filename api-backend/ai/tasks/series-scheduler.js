// Structured series ranking: only offered candidates can survive output validation.
import { executeKiTask } from '../ki-gateway.js';
export async function run(payload, context = {}) {
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
        if (![s.date,s.time,s.employeeId].every(v => typeof v === 'string') || dates.has(s.date)) return false;
        if (!maskedCandidates.some(c => c.date === s.date && c.time === s.time && c.employeeId === s.employeeId)) return false;
        dates.add(s.date);
      }
      return true;
    },
    chatOptions:{responseFormat:{type:'json_object'},temperature:0.2,maxTokens:2000},dependencies:context.dependencies || {}
  });
  return {selected:output.selected,report:output.report,_meta:meta};
}
