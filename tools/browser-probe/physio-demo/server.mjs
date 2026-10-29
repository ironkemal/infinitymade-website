/** Local synthetic Physio demo. Never connects to Supabase or production APIs. */
import {createServer} from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import {dirname, resolve, extname, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {API_ANTWORTEN} from '../../redesign-harness.mjs';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const SPEICHER_KEY = 'praxura-physio-demo-v1';
export const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; form-action 'none'; base-uri 'self'";
const MIME = {'.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf', '.wasm':'application/wasm'};
const ASSET_DIRS = new Set(['module', 'vendor', 'design', 'assets', 'fonts', 'images', 'img']);
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
export function istEnginePfad(pfad,methode) {
  return (methode==='POST' && ['/api/rezept/confirm','/api/booking/batch-create','/api/arzt/resolve'].includes(pfad)) ||
    (methode==='PATCH' && /^\/api\/rezept\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pfad));
}
const sindTabellen=v=>v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).every(k=>!['__proto__','constructor','prototype'].includes(k)) && Object.values(v).every(Array.isArray);

export function pruefeOptionen({port = 18086, rolle = 'owner', tag = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Berlin'}).format(new Date())} = {}) {
  if (!/^\d+$/.test(String(port)) || Number(port) < 1024 || Number(port) > 65535) throw new Error('PORT muss 1024–65535 sein.');
  if (!['owner', 'employee'].includes(rolle)) throw new Error('ROLLE muss owner oder employee sein.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || new Date(tag + 'T12:00:00Z').toISOString().slice(0,10) !== tag) throw new Error('TAG muss ein gültiger ISO-Kalendertag sein.');
  return {port:Number(port), rolle, tag};
}

function ersetzeGenau(text, suche, ersatz) {
  if (text.split(suche).length !== 2) throw new Error('Fixture-Anschluss fehlt oder ist nicht eindeutig: ' + suche.slice(0,60));
  return text.replace(suche, ersatz);
}

export function baueFixture({original, tabellenOverrides}) {
  if (!tabellenOverrides || Array.isArray(tabellenOverrides) || typeof tabellenOverrides !== 'object' || Object.values(tabellenOverrides).some(v => !Array.isArray(v))) throw new Error('tabellenOverrides muss Tabellenlisten enthalten.');
  let fixture = ersetzeGenau(original,
    "const tabellen = SZENARIO === 'leer' ? leer : SZENARIO === 'gross' ? grossePraxis() : voll;",
    `const tabellen = SZENARIO === 'leer' ? leer : SZENARIO === 'gross' ? grossePraxis() : voll;
Object.assign(tabellen, ${JSON.stringify(tabellenOverrides)});
const DEMO_KEY=${JSON.stringify(SPEICHER_KEY)};
try { const saved=JSON.parse(localStorage.getItem(DEMO_KEY)||'null'); if(saved?.version===1 && saved.tables && typeof saved.tables==='object' && !Array.isArray(saved.tables) && Object.values(saved.tables).every(Array.isArray)) Object.assign(tabellen,saved.tables); } catch {}
const demoSave=()=>localStorage.setItem(DEMO_KEY,JSON.stringify({version:1,tables:tabellen}));
window.__lokaleTestpraxis={tabellen,speichern:demoSave};
try { demoSave(); } catch { window.__lokaleTestpraxis.speicherFehler=true; }`);
  fixture = ersetzeGenau(fixture, 'upsert(d) { this.schreib = [\'upsert\', d]; return this; }', 'upsert(d,opts={}) { this.conflict=opts.onConflict; this.schreib = [\'upsert\', d]; return this; }');
  fixture = ersetzeGenau(fixture,
    'or() { return this; } filter() { return this; } match() { return this; } contains() { return this; }',
    'or() { this.unsupported=true; return this; } filter() { this.unsupported=true; return this; } match(obj) { for(const [k,v] of Object.entries(obj)) this.eq(k,v); return this; } contains() { this.unsupported=true; return this; }');
  fixture = ersetzeGenau(fixture,
    'containedBy() { return this; } overlaps() { return this; } textSearch() { return this; }',
    'containedBy() { this.unsupported=true; return this; } overlaps() { this.unsupported=true; return this; } textSearch() { this.unsupported=true; return this; }');
  fixture = ersetzeGenau(fixture, '_f(op, k, v, neg = false) {', "_f(op, k, v, neg = false) { if(!['eq','neq','is','in','gt','gte','lt','lte','like','ilike'].includes(op)) this.unsupported=true;");
  const start = fixture.indexOf('    if (this.schreib) {', fixture.indexOf('  lauf() {'));
  const end = fixture.indexOf('    log.reads.push', start);
  if (start < 0 || end < 0) throw new Error('Fixture-Schreibanschluss fehlt.');
  fixture = fixture.slice(0,start) + `    if (this.schreib) {
      log.writes.push({tabelle:this.tabelle,art:this.schreib[0]});
      const [art,payload]=this.schreib;
      const allowed=new Set(['leads','services','employee_services','bookings','prescriptions','prescription_sessions','patient_notes','anamnese','patient_anamnese_physio','working_hours','working_breaks','special_days','document_vorlagen','breaks','text_templates','aerzte','warteliste','booking_services','booking_leistungen','user_preferences','profiles','module_visibility']);
      const fail={data:null,error:{code:'LOCAL_UNSUPPORTED',message:'Lokale Testversion: dieser Schreibweg ist nicht unterstützt.'}};
      if(!allowed.has(this.tabelle)||this.unsupported||(['update','delete'].includes(art)&&!this.filter.length)) return fail;
      if(art!=='delete' && (payload==null || (Array.isArray(payload)?payload:[payload]).some(r=>!r||typeof r!=='object'||Array.isArray(r)))) return fail;
      const backup=clone(tabellen); const rows=tabellen[this.tabelle]||=[]; let changed=[];
      try {
        if(art==='insert'||art==='upsert') {
          for(const input of Array.isArray(payload)?payload:[payload]) {
            const keys=(this.conflict||'id').split(',').map(x=>x.trim());
            if(keys.some(k=>!k)) throw new Error('Invalid conflict key');
            const prior=art==='upsert'?rows.find(r=>keys.every(k=>input[k]!=null&&r[k]===input[k])):null;
            const row=prior?Object.assign(prior,clone(input),{updated_at:new Date().toISOString()}):{id:crypto.randomUUID(),created_at:new Date().toISOString(),...clone(input)};
            if(this.tabelle==='leads'){row.name=[row.first_name,row.last_name].filter(Boolean).join(' ')||row.title||row.name;row.owner_id||=OWNER;row.user_id||=OWNER;row.is_active??=true;row.status||='aktiv';}
            if(this.tabelle==='anamnese'&&!prior){
              if(!row.owner_id||!row.patient_id||!row.fachbereich)throw new Error('Anamnese scope missing');
              const history=rows.filter(r=>r.owner_id===row.owner_id&&r.patient_id===row.patient_id&&(r.fachbereich||'physio')===row.fachbereich);
              row.version=Math.max(0,...history.map(r=>Number(r.version)||0))+1;
              for(const old of history)old.ist_aktuell=false;
              row.ist_aktuell=true;
            }
            if(this.tabelle==='bookings'){row.owner_id||=OWNER;row.user_id||=OWNER;row.employee_id||=row.user_id;row.status||='confirmed';row.services=clone(tabellen.services.find(s=>s.id===row.service_id)||null);row.leads=clone(tabellen.leads.find(p=>p.id===row.lead_id)||null);}
            if(!prior) rows.push(row); changed.push(row);
          }
        } else {
          changed=rows.filter(r=>this.filter.every(f=>f(r)));
          if(art==='update') changed.forEach(r=>Object.assign(r,clone(payload),{updated_at:new Date().toISOString()}));
          else tabellen[this.tabelle]=rows.filter(r=>!changed.includes(r));
        }
        demoSave();
        return {data:clone(this.art==='liste'?changed:changed[0]||null),error:null,count:changed.length};
      } catch { for(const k of Object.keys(tabellen)) delete tabellen[k]; Object.assign(tabellen,backup); return {data:null,error:{code:'LOCAL_STORAGE_FAILED',message:'Lokaler Browserspeicher konnte nicht gespeichert werden.'}}; }
    }
` + fixture.slice(end);
  // Rebuild only the relations used by the app from current demo tables. Seed
  // embeddings otherwise go stale after creating appointments or assignments.
  fixture = ersetzeGenau(fixture,
    "let rows = clone(tabellen[this.tabelle] || []).filter((r) => this.filter.every((f) => f(r)));",
    `let rows = clone(tabellen[this.tabelle] || []).map(r=>{
      if(this.tabelle==='services') r.employee_services=clone((tabellen.employee_services||[]).filter(e=>e.service_id===r.id));
      if(this.tabelle==='bookings'){r.services=clone((tabellen.services||[]).find(s=>s.id===r.service_id)||null);r.leads=clone((tabellen.leads||[]).find(p=>p.id===r.lead_id)||null);}
      if(this.tabelle==='prescription_sessions')r.bookings=clone((tabellen.bookings||[]).find(b=>b.id===r.booking_id)||null);
      if(this.tabelle==='prescriptions'){r.leads=clone((tabellen.leads||[]).find(p=>p.id===r.patient_id)||null);r.prescription_sessions=clone((tabellen.prescription_sessions||[]).filter(s=>s.prescription_id===r.id).map(s=>({...s,bookings:clone((tabellen.bookings||[]).find(b=>b.id===s.booking_id)||null)})));}
      return r;
    }).filter((r) => this.filter.every((f) => f(r)));`);
  fixture = ersetzeGenau(fixture, '      return { data: null, error: null };\n    },\n    channel:', "      return { data: null, error: {code:'LOCAL_UNSUPPORTED',message:'Lokale Testversion: dieser RPC ist nicht verfügbar.'} };\n    },\n    channel:");
  fixture = ersetzeGenau(fixture, 'rpc: async (name) => {', `rpc: async (name,args={}) => {
      if(name==='search_heilmittel'){
        log.rpc.push(name);
        if(args.p_bereich && args.p_bereich!=='physiotherapy')return {data:[],error:null}; // katalog-suche normalizeBereich liefert 'physiotherapy' (nicht 'physio')
        const query=String(args.p_q||'').toLocaleLowerCase('de');
        const rows=(tabellen.services||[]).filter(s=>s.kostentraeger_typ==='gkv'&&s.code&&[s.code,s.title].join(' ').toLocaleLowerCase('de').includes(query)).map(s=>({code:s.code,bereich:'physio',label:s.title,kuerzel:s.code==='X0501'?'KG':s.code==='X1201'?'MT':s.code,kategorie:'Demo-Auswahl',preis_eur:Number(s.price),dauer:s.duration_minutes,notiz:'Lokaler Katalogausschnitt; keine Tarif-/Diagnosefreigabe'}));
        return {data:clone(rows.slice(0,Math.min(Number(args.p_limit)||100,100))),error:null};
      }`);
  return fixture + '\nwindow.__lokaleTestpraxis.client=createClient();\n';
}

export function baueBoot({rolle, tag}) {
  return `window.__rsDay=${JSON.stringify(tag)};window.__rsRolle=${JSON.stringify(rolle)};window.__rsSzenario='voll';
const demoOriginalFetch=window.fetch.bind(window);
let demoEngineBusy=false;
window.fetch=async(input,init={})=>{
  const request=input instanceof Request?input:null;
  const url=new URL(request?request.url:String(input),location.href);
  const methode=String(init.method||request?.method||'GET').toUpperCase();
  const erlaubt=(methode==='POST'&&['/api/rezept/confirm','/api/booking/batch-create','/api/arzt/resolve'].includes(url.pathname))||(methode==='PATCH'&&/^\\/api\\/rezept\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.pathname));
  if(url.origin!==location.origin||!erlaubt)return demoOriginalFetch(input,init);
  const antwort=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  const demo=window.__lokaleTestpraxis;
  if(!demo||demoEngineBusy)return antwort(409,{error:'Lokale Demo: eine Aktion läuft bereits oder Speicher fehlt.'});
  demoEngineBusy=true;
  try {
    const vorher=JSON.stringify(demo.tabellen);
    const body=JSON.parse(init.body??(request?await request.clone().text():'null'));
    const response=await demoOriginalFetch('/__physio_demo_engine',{method:'POST',headers:{'Content-Type':'application/json'},signal:init.signal||request?.signal,body:JSON.stringify({pfad:url.pathname,methode,body,tabellen:demo.tabellen})});
    const result=await response.json();
    if(!response.ok)return antwort(response.status,result);
    if(!result.tabellen||typeof result.tabellen!=='object'||Array.isArray(result.tabellen)||Object.keys(result.tabellen).some(k=>['__proto__','constructor','prototype'].includes(k))||!Object.values(result.tabellen).every(Array.isArray))return antwort(502,{error:'Ungültige lokale Engineantwort.'});
    if(JSON.stringify(demo.tabellen)!==vorher)return antwort(409,{error:'Lokaler Stand wurde während Aktion geändert. Bitte erneut versuchen.'});
    localStorage.setItem(${JSON.stringify(SPEICHER_KEY)},JSON.stringify({version:1,tables:result.tabellen}));
    for(const key of Object.keys(demo.tabellen))delete demo.tabellen[key];
    Object.assign(demo.tabellen,result.tabellen);
    return antwort(response.status,result.body);
  } catch(error) {if(error?.name==='AbortError')throw error;return antwort(503,{error:'Lokale Demoaktion konnte nicht gespeichert werden.'});}
  finally {demoEngineBusy=false;}
};
window.addEventListener('DOMContentLoaded',()=>{const n=document.createElement('div');n.id='physioDemoHinweis';n.textContent='PHYSIO-TESTPRAXIS · Erfundene Daten · Nur Browserlokal · Originalhandler mit synthetischem Speicher, keine echte DB · Finanzkarten: feste Beispiele · Versand/KI/Zahlungen gesperrt';n.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#fff4cc;color:#241b00;padding:7px 12px;font:12px/1.4 system-ui;text-align:center;pointer-events:none';document.body.append(n);document.getElementById('mainArea')?.style.setProperty('padding-bottom','60px');});`;
}

export function erstelleHandler({root, port, rolle, fixture, boot, antworten = API_ANTWORTEN, engine = async(args)=>(await import('./engine.mjs')).fuehreDemoAktionAus(args)}) {
  return async (req,res) => {
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(req.method==='HEAD'?undefined:JSON.stringify(data));};
    res.setHeader('Content-Security-Policy',CSP);
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','no-store');
    try {
      if(req.headers.host!==`127.0.0.1:${port}`) return json(403,{error:'Nur lokaler Testhost'});
      const u=new URL(req.url,`http://127.0.0.1:${port}`);
      if(u.pathname==='/__physio_demo_engine') {
        if(req.method!=='POST')return json(404,{error:'Nicht verfügbar'});
        if(req.headers.origin!==`http://127.0.0.1:${port}`)return json(403,{error:'Nur lokaler Testursprung'});
        if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(415,{error:'JSON erforderlich'});
        let size=0;const chunks=[];
        for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>MAX_BODY_BYTES)return json(413,{error:'Demodaten zu groß'});chunks.push(Buffer.from(chunk));}
        let data;try {data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(400,{error:'Ungültiges JSON'});}
        if(!data || !istEnginePfad(data.pfad,data.methode) || !sindTabellen(data.tabellen) || !data.body || typeof data.body!=='object' || Array.isArray(data.body))return json(400,{error:'Ungültige Demoaktion'});
        let result;try {result=await engine({...data,rolle});}catch{return json(503,{error:'Lokale Engine ist noch nicht verfügbar oder Aktion fehlgeschlagen.'});}
        if(!result||!Number.isInteger(result.status)||result.status<200||result.status>599)return json(502,{error:'Ungültige lokale Engineantwort'});
        if(result.status<300){if(!sindTabellen(result.tabellen))return json(502,{error:'Ungültige lokale Enginetabellen'});return json(result.status,{body:result.body,tabellen:result.tabellen});}
        return json(result.status,result.body);
      }
      if(!['GET','HEAD'].includes(req.method)) return json(501,{error:'Lokale Testversion: Backendaktionen, Versand, KI und Zahlungen sind gesperrt.'});
      if(u.pathname==='/api/config') return json(200,{supabaseUrl:'https://synthetic.invalid',supabaseAnonKey:'synthetisch-anon',apiBase:'/api',istKutu:false,telemetryEnabled:false});
      if(u.pathname.startsWith('/api/')) { const x=Object.hasOwn(antworten,u.pathname)?antworten[u.pathname]:null; return x?json(200,typeof x==='function'?await x({rolle}):x):json(501,{error:'Lokale Testversion: dieser Backend-Leseweg ist nicht verfügbar.'}); }
      if(u.pathname==='/vendor/supabase-js.js'||u.pathname==='/demo-boot.js') {res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});return res.end(req.method==='HEAD'?undefined:u.pathname==='/demo-boot.js'?boot:fixture);}
      const name=u.pathname==='/'?'dashboard.html':decodeURIComponent(u.pathname).slice(1);
      const parts=name.split('/');
      if(parts.some(p=>!p||p.startsWith('.')) || (parts.length>1&&!ASSET_DIRS.has(parts[0])) || !MIME[extname(name)] || (extname(name)==='.json'&&name!=='manifest.json')) return json(403,{error:'Nicht verfügbar'});
      const path=await realpath(resolve(root,name));
      if(!path.startsWith(root+sep)) return json(403,{error:'Nicht verfügbar'});
      let data=await readFile(path);
      if(name==='dashboard.html') data=data.toString().replace('<head>','<head><script src="/demo-boot.js"></script>');
      res.writeHead(200,{'Content-Type':MIME[extname(path)]+'; charset=utf-8'});res.end(req.method==='HEAD'?undefined:data);
    } catch { json(404,{error:'Nicht verfügbar'}); }
  };
}

export async function erstelleDemoServer(options = {}) {
  const {port,rolle,tag}=pruefeOptionen(options);
  const root=await realpath(options.root||REPO_ROOT);
  const {erstellePhysioDaten}=await import('./daten.mjs');
  const original=await readFile(resolve(root,'tools/browser-probe/redesign-fixture.js'),'utf8');
  const fixture=baueFixture({original,tabellenOverrides:erstellePhysioDaten({tag})});
  const server=createServer(erstelleHandler({root,port,rolle,fixture,boot:baueBoot({rolle,tag})}));
  server.on('upgrade',(_req,socket)=>socket.destroy());
  return {server,port,rolle,tag,url:`http://127.0.0.1:${port}/dashboard.html?design=neu`};
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const {server,port,url}=await erstelleDemoServer({port:process.env.PORT||18086,rolle:process.env.ROLLE||'owner',...(process.env.TAG?{tag:process.env.TAG}:{})});
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log('Physio-Testpraxis: '+url));
  for(const sig of ['SIGINT','SIGTERM']) process.on(sig,()=>server.close(()=>process.exit(0)));
}
