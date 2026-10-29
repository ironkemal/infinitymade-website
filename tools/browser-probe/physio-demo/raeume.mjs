/** Local demo side tables only. No production schema or DB guarantees. */
export function raumName(value) {
  const name=String(value??'').trim().replace(/\s+/g,' ');
  if(!name||name.length>80)throw new Error('Bitte einen Raumnamen mit 1–80 Zeichen eingeben.');
  return name;
}
export function speichereRaum(tables,{id,name,ownerId,businessId=null}) {
  const title=raumName(name),rooms=tables.demo_rooms||[];
  if(rooms.some(r=>r.owner_id===ownerId&&r.business_id===businessId&&r.id!==id&&r.name.toLocaleLowerCase('de')===title.toLocaleLowerCase('de')))throw new Error('Dieser Raumname ist bereits vergeben.');
  if(id){const room=rooms.find(r=>r.id===id&&r.owner_id===ownerId&&r.business_id===businessId);if(!room)throw new Error('Raum gehört nicht zu diesem Standort.');room.name=title;}
  else {if(!ownerId)throw new Error('Praxis fehlt.');rooms.push({id:crypto.randomUUID(),owner_id:ownerId,business_id:businessId,name:title});}
  tables.demo_rooms=rooms;
}
export function weiseRaumZu(tables,{bookingIds,roomId,ownerId}) {
  const rooms=tables.demo_rooms||[],assignments=(tables.demo_room_assignments||[]).filter(a=>!bookingIds.includes(a.booking_id));
  const room=roomId?rooms.find(r=>r.id===roomId&&r.owner_id===ownerId):null;
  if(roomId&&!room)throw new Error('Raum ist nicht mehr verfügbar.');
  for(const id of bookingIds){
    const booking=tables.bookings.find(b=>b.id===id&&b.owner_id===ownerId);
    if(!booking)throw new Error('Termin gehört nicht zu dieser Praxis.');
    if(!room)continue;
    if((booking.business_id||null)!==(room.business_id||null))throw new Error('Raum und Termin gehören zu unterschiedlichen Standorten.');
    const start=Date.parse(booking.start_time),end=Date.parse(booking.end_time);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error('Terminzeit ist ungültig.');
    if(!['cancelled','no_show'].includes(booking.status)){
      const collision=assignments.some(a=>a.room_id===roomId&&tables.bookings.some(b=>b.id===a.booking_id&&b.owner_id===ownerId&&!['cancelled','no_show'].includes(b.status)&&Date.parse(b.start_time)<end&&Date.parse(b.end_time)>start));
      if(collision)throw new Error('Raum ist zu dieser Zeit bereits belegt. Bitte anderen Raum oder andere Zeit wählen.');
    }
    assignments.push({booking_id:id,room_id:roomId,owner_id:ownerId});
  }
  tables.demo_room_assignments=assignments;
}

export function raeumeBeimSchreiben(tables,{bookingIds,payload,ownerId}) {
  for(const id of bookingIds){
    const input=Array.isArray(payload)?payload.find(r=>r.id===id):payload;
    const roomId=input&&Object.hasOwn(input,'__demo_room_id')?input.__demo_room_id:(tables.demo_room_assignments||[]).find(a=>a.booking_id===id)?.room_id||'';
    weiseRaumZu(tables,{bookingIds:[id],roomId,ownerId});
  }
}

if(typeof window!=='undefined') {
  const start=()=>{
    const demo=window.__lokaleTestpraxis;if(!demo){setTimeout(start,100);return;}
    const owner=()=>demo.tabellen.profiles.find(p=>p.role==='owner'&&!p.owner_id)?.id;
    const isOwner=window.__rsRolle!=='employee';
    demo.tabellen.demo_rooms||=[];demo.tabellen.demo_room_assignments||=[];
    const roomFor=id=>demo.tabellen.demo_room_assignments.find(a=>a.booking_id===id)?.room_id||'';
    const error=document.createElement('p');error.id='demoRoomError';error.setAttribute('role','alert');error.style.color='var(--danger)';
    const host=document.createElement('section');host.className='card';host.id='demoRoomManager';
    host.innerHTML='<h2>Räume</h2><p>Räume dieses Standorts verwalten. Speicherung nur in dieser Testpraxis.</p><form id="demoRoomForm"><label for="demoRoomName">Raumname</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="demoRoomName" class="form-input" maxlength="80" placeholder="z. B. Behandlungsraum 1" required style="flex:1;min-width:140px"><button class="btn-primary" type="submit">Raum anlegen</button></div></form><div id="demoRoomList"></div>';
    host.append(error);document.querySelector('#panel-hours')?.append(host);
    if(!isOwner)host.querySelector('form').hidden=true;
    const control=document.createElement('div');control.className='form-group';
    control.innerHTML='<label class="form-label" for="demoBookingRoom">Raum</label><select id="demoBookingRoom" class="form-select"></select><button type="button" class="btn-ghost" id="demoManageRooms" style="margin-top:6px">Räume verwalten</button><p id="demoBookingRoomHint" class="form-hint"></p>';
    document.getElementById('bkEmployeeGroup')?.after(control);
    const select=control.querySelector('select');
    let bookingId='',detailId='';
    const save=action=>{const backup=structuredClone(demo.tabellen);try{action();demo.speichern();error.textContent='';return true;}catch(e){for(const k of Object.keys(demo.tabellen))delete demo.tabellen[k];Object.assign(demo.tabellen,backup);error.textContent=e.message;return false;}};
    const rooms=()=>demo.tabellen.demo_rooms.filter(r=>r.owner_id===owner()&&r.business_id==null);
    function options(target,value){target.replaceChildren();for(const [id,title] of [['','Kein Raum zugewiesen'],...rooms().map(r=>[r.id,r.name])]){const o=document.createElement('option');o.value=id;o.textContent=title;target.append(o);}target.value=value;}
    function render(){
      options(select,roomFor(bookingId)||select.value);const list=host.querySelector('#demoRoomList');list.replaceChildren();
      if(!rooms().length){const p=document.createElement('p');p.textContent='Noch keine Räume angelegt.';list.append(p);}
      for(const room of rooms()){
        const row=document.createElement('form');row.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:12px';
        const input=document.createElement('input');input.className='form-input';input.value=room.name;input.maxLength=80;input.setAttribute('aria-label','Raumname '+room.name);input.style.cssText='flex:1;min-width:140px';input.disabled=!isOwner;
        const btn=document.createElement('button');btn.className='btn-ghost';btn.textContent='Umbenennen';btn.type='submit';btn.disabled=!isOwner;row.append(input,btn);row.onsubmit=e=>{e.preventDefault();if(save(()=>speichereRaum(demo.tabellen,{id:room.id,name:input.value,ownerId:owner()})))render();};list.append(row);
      }
      control.querySelector('#demoBookingRoomHint').textContent=rooms().length?'Raumbelegung wird beim Speichern geprüft.':'Zuerst unter „Räume verwalten“ einen Raum anlegen.';
      renderDetail();
    }
    host.querySelector('form').onsubmit=e=>{e.preventDefault();if(!isOwner)return;if(save(()=>speichereRaum(demo.tabellen,{name:host.querySelector('#demoRoomName').value,ownerId:owner()}))){host.querySelector('#demoRoomName').value='';render();}};
    control.querySelector('button').onclick=()=>{document.querySelector('#bookingModal .modal-close')?.click();window.switchPanel('hours');host.scrollIntoView({block:'start'});host.querySelector('input').focus();};
    const modal=document.getElementById('bookingModal');
    new MutationObserver(()=>{if(!modal.hidden){bookingId=document.getElementById('bk-id').value;options(select,roomFor(bookingId));}}).observe(modal,{attributes:true,attributeFilter:['hidden']});
    const detail=document.createElement('div');detail.className='form-group';detail.id='demoRoomDetail';
    detail.innerHTML='<label class="form-label" for="demoRoomDetailSelect">Raum</label><select id="demoRoomDetailSelect" class="form-select"></select><button type="button" class="btn-ghost" style="margin-top:6px">Raum zuweisen</button><p role="status"></p>';
    document.querySelector('#bkActionModal .modal-body')?.append(detail);
    function renderDetail(){detail.hidden=!detailId;options(detail.querySelector('select'),roomFor(detailId));}
    detail.querySelector('button').onclick=()=>{const ok=save(()=>weiseRaumZu(demo.tabellen,{bookingIds:[detailId],roomId:detail.querySelector('select').value,ownerId:owner()}));detail.querySelector('p').textContent=ok?'Raumzuweisung gespeichert.':error.textContent;};
    window.addEventListener('physio-demo:booking',e=>{detailId=e.detail?.id||'';renderDetail();});
    window.__physioRaumZuordnung=(ids,payload)=>{
      raeumeBeimSchreiben(demo.tabellen,{bookingIds:ids,payload,ownerId:owner()});
    };
    render();
  };
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',start);else start();
}
