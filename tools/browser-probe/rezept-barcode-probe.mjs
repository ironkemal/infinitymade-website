// Regression runner for the same synthetic fixture page inspected in T3 preview.
import { chromium } from 'playwright';
const browser=await chromium.launch();
const page=await browser.newPage();
const errors=[];
const foreign=[];
const writes=[];
const fontWarnings=[];
const fonts=[];
page.on('console',message=>{if(/standardFontDataUrl|fetchStandardFontData|Helvetica_path/.test(message.text())) fontWarnings.push(message.text());});
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(request.method()!=='GET') writes.push(request.method());
  if(request.url().includes('/vendor/pdfjs/standard_fonts/')) fonts.push(request.url());});
await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin==='http://localhost:8081' || ['data:','blob:'].includes(url.protocol)) return route.continue();
  foreign.push(url.origin);return route.abort();
});
let result;
try {
  await page.goto('http://localhost:8081/tools/browser-probe/rezept-barcode-probe.html');
  await page.waitForFunction(()=>window.m3Probe?.complete,null,{timeout:60000});
  result=await page.evaluate(()=>window.m3Probe.results);
} finally {await browser.close();}
for(const row of result) console.log(`${row.pass?'PASS':'FAIL'} ${row.name || row.file || row.error}`);
const pass=result.length===39 && new Set(result.map(row=>row.name || row.file)).size===39
  && result.every(row=>row.pass) && !errors.length && !foreign.length && !writes.length && !fontWarnings.length && fonts.length>0;
console.log(JSON.stringify({passed:result.filter(row=>row.pass).length,total:result.length,pageErrors:errors,
  blockedForeignOrigins:foreign,networkWrites:writes,fontWarnings,localFontRequests:fonts.length}));
process.exitCode=pass?0:1;
