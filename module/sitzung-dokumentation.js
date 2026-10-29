/** Existing session writer, isolated for confirmed save/retry behavior. No new table or storage path. */
const entwürfe=new Map();
const schluessel=({ownerId,userId,bookingId})=>ownerId&&userId&&bookingId?JSON.stringify([ownerId,userId,bookingId]):null;
export function liesSitzungsnotizEntwurf(scope){return entwürfe.get(schluessel(scope))||'';}

export async function dokumentiereSitzung({supabase,bookingId,status,notes,terminStart,ownerId,userId,fortschritt}){
  const key=schluessel({ownerId,userId,bookingId});
  const fehler=meldung=>({ok:false,gespeichert:false,meldung});
  if(!supabase||!key)return fehler('Sitzung nicht gespeichert: Praxis, Benutzer oder Termin fehlt.');
  if(notes!==undefined&&notes!==null)entwürfe.set(key,String(notes));
  const patch={status};
  if(status==='done')patch.done_at=terminStart||new Date().toISOString();
  if(notes!==undefined&&notes!==null)patch.notes=notes;
  let rows;
  try{
    const result=await supabase.from('prescription_sessions').update(patch).eq('booking_id',bookingId).select('id,prescription_id,booking_id,status,done_at,notes');
    if(result.error)return fehler('Sitzung nicht gespeichert. Bitte erneut versuchen; die Notiz bleibt für diesen Termin verfügbar.');
    rows=result.data;
    if(!Array.isArray(rows)||!rows.length)return fehler('Sitzung nicht gespeichert: Dem Termin ist keine lesbare Sitzung zugeordnet. Bitte Verordnungsbindung prüfen. Die Notiz bleibt für diesen Termin verfügbar.');
    if(rows.some(r=>!r.id||!r.prescription_id||r.booking_id!==bookingId||Object.entries(patch).some(([k,v])=>k==='done_at'?Date.parse(r[k])!==Date.parse(v):r[k]!==v)))return fehler('Speicherung der Sitzung nicht bestätigt. Bitte Verordnungs-Panel prüfen; die Notiz bleibt für diesen Termin verfügbar.');
  }catch{return fehler('Sitzung nicht gespeichert. Bitte erneut versuchen; die Notiz bleibt für diesen Termin verfügbar.');}
  entwürfe.delete(key);
  try{for(const rxId of new Set(rows.map(r=>r.prescription_id)))await fortschritt?.(supabase,rxId);}
  catch{return {ok:true,gespeichert:true,meldung:'Sitzung gespeichert. Verordnungsfortschritt konnte nicht aktualisiert werden — bitte im Verordnungs-Panel prüfen.'};}
  return {ok:true,gespeichert:true,meldung:''};
}
