import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('P2-5: Diagramm benennt Forderungen statt Kassenumsatz; Monatslabels lesbar',async()=>{
  const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
  assert.ok(html.includes('Zuzahlungen und Ausfallhonorare'), 'Diagrammtitel muss Datenreihe benennen');
  const s=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
  const fn=s.slice(s.indexOf('async function loadStatistik()'),s.indexOf("document.getElementById('statMonateSelect')?.addEventListener"));
  const node=()=>({style:{cssText:''},children:[],appendChild(c){this.children.push(c);},prepend(c){this.children.unshift(c);},innerHTML:'',textContent:''});
  const chart=node(),legend=node();
  await vm.runInNewContext(fn+'\nloadStatistik()', {supabase:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}},API:'/api',fetch:async()=>({ok:true,json:async()=>({monatlich:[{monat:'2026-11',bezahlt:0,offen:0,umsatz:12.96}]})}),document:{getElementById:id=>({statBarChart:chart,statBarLegend:legend}[id]||null),createElement:node},t:s=>s,fmtEur:String,escapeHtml:String});
  assert.equal(chart.children.length,1);
  const label=chart.children[0].children[1];assert.match(label.style.cssText,/font-size:12px/);
  assert.match(legend.children[1].textContent,/Nov 26: 0/);
});
