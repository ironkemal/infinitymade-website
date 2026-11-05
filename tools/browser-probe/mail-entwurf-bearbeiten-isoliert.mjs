/** Actual dashboard compose/copy handlers; synthetic DOM, no account or external transport. */
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const source = await readFile(new URL('dashboard.js', root), 'utf8');
const start = source.indexOf('function openComposeModal(draft) {');
const end = source.indexOf("document.getElementById('composeSendBtn').addEventListener", start);
assert.ok(start >= 0 && end > start, 'actual compose/copy handler boundaries must exist');
const actual = source.slice(start, end);
function replaceOnce(code, from, to) {
  assert.equal(code.split(from).length, 2, 'mutation must target exactly one actual statement');
  return code.replace(from, to);
}
const variants = [
  ['actual', actual],
  ['stale-body', replaceOnce(actual, "document.getElementById('composeBody').value,getMailSignaturen().text()", "'KI-Ausgangstext',getMailSignaturen().text()")],
  ['missing-footer', replaceOnce(actual, 'getMailSignaturen().text()', "''")],
  ['stale-subject', replaceOnce(actual, "document.getElementById('copySubjectBtn'), document.getElementById('composeSubject').value", "document.getElementById('copySubjectBtn'), 'KI-Ausgangsbetreff'")],
];

const browser = await chromium.launch();
let blockedRequests = 0;
try {
  for (const [name, code] of variants) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        if (route.request().url() === 'https://fixture.test/') {
          return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
        }
        blockedRequests++;
        return route.abort();
      });
      await page.goto('https://fixture.test/');
      const bundled = await build({ stdin: { resolveDir: root.pathname, contents: `
import { mountMailSignaturen } from './module/mail-signatur-editor.js';
import { runMailDraftInUi } from './module/ki-client.js';
document.body.innerHTML = '<div id="config"></div><section id="emailComposeModal" hidden><input id="composeToName"><input id="composeToEmail"><input id="composeSubject" aria-label="Betreff"><textarea id="composeBody" aria-label="Nachricht"></textarea><span id="composeFromDisplay"></span><div id="mailSignaturCompose"></div><button id="composeDiscardBtn">Verwerfen</button><button id="copyToEmailBtn">Adresse kopieren</button><button id="copySubjectBtn">Betreff kopieren</button><button id="copyBodyBtn">Text kopieren</button><button id="composeSendBtn">Senden</button></section>';
window.copies=[];
Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copies.push(text)}}});
const profil={mail_signatur_einstellungen:{standard_id:'default',vorlagen:[{id:'default',name:'Standard',praxis:'TEST-Standard'},{id:'selected',name:'Auswahl',praxis:'TEST-Auswahl',email:'qa@example.invalid',telefon:'030000000'}]}};
const signatures=mountMailSignaturen({config:document.getElementById('config'),compose:document.getElementById('mailSignaturCompose'),getProfil:()=>profil,isOwner:()=>true,speichern:async()=>{throw Error('Persistence forbidden');},uploadLogo:async()=>{throw Error('Upload forbidden');}});
const getMailSignaturen=()=>signatures;
let currentDraftContactId=null;
const gmailConnectedEmail='';
const currentSession={user:{email:'owner@example.invalid'}};
function openModal(id){document.getElementById(id).hidden=false;}
function closeModal(id){document.getElementById(id).hidden=true;}
function aiAddMsg(){}
${code}
window.generate=()=>runMailDraftInUi({intent:'Erstelle einen synthetischen Testentwurf',containerId:'unused',aiAddMsg,openComposeModal},{getToken:async()=>'synthetic-not-a-token',getKiConfig:async()=>({effective:true,mode:'direkt',capabilities:{freeText:true,mailDraft:true}}),fetchImpl:async()=>({ok:true,status:200,json:async()=>({success:true,draft:{to_name:'TEST-Empfänger',to_email:'recipient@example.invalid',subject:'KI-Ausgangsbetreff',body:'KI-Ausgangstext'}})})});
` }, bundle: true, write: false, format: 'iife' });
      await page.addScriptTag({ content: bundled.outputFiles[0].text });
      await page.evaluate(() => window.generate());
      assert.equal(await page.locator('#emailComposeModal').isVisible(), true);
      assert.equal(await page.getByLabel('Betreff', { exact: true }).inputValue(), 'KI-Ausgangsbetreff');
      assert.equal(await page.getByLabel('Nachricht', { exact: true }).inputValue(), 'KI-Ausgangstext');
      await page.getByLabel('Betreff', { exact: true }).fill('TEST: nachträglich geändert');
      await page.getByLabel('Nachricht', { exact: true }).fill('TEST: bearbeiteter Entwurf');
      await page.getByLabel('Mail-Fußzeile', { exact: true }).selectOption('selected');
      assert.match(await page.locator('[data-compose-preview]').innerText(), /TEST-Auswahl/);
      await page.getByRole('button', { name: 'Betreff kopieren', exact: true }).click();
      await page.waitForFunction(() => window.copies.length === 1);
      await page.getByRole('button', { name: 'Text kopieren', exact: true }).click();
      await page.waitForFunction(() => window.copies.length === 2);
      const copies = await page.evaluate(() => window.copies);
      const verify = () => {
        assert.equal(copies[0], 'TEST: nachträglich geändert', 'copy must read edited subject');
        assert.equal(copies[1], 'TEST: bearbeiteter Entwurf\n\nTEST-Auswahl\n030000000\nqa@example.invalid', 'copy must read edited body and selected footer');
      };
      if (name === 'actual') verify();
      else assert.throws(verify, { code: 'ERR_ASSERTION' }, `${name} mutation must fail acceptance`);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
  assert.equal(blockedRequests, 0, 'compose/copy must not attempt network traffic');
  console.log(JSON.stringify({ pass: true, actualComposeAndCopy: true, detectedMutations: 3, accountsUsed: 0, realDbWrites: 0, mailsSent: 0, externalAiCalls: 0, blockedRequests }));
} finally {
  await browser.close();
}
