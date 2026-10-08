// Regression runner for M4 browser probe (KI-Frontend).
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
const consoleErrors = [];
const foreign = [];
const writes = [];

page.on('console', msg => {if(msg.type() === 'error') consoleErrors.push(msg.text());});
page.on('pageerror', error => {
  console.log('BROWSER PAGEERROR:', error.message, '\nSTACK:\n', error.stack);
  errors.push(error.message);
});
page.on('request', request => {
  const url = new URL(request.url());
  if (!['GET','HEAD','OPTIONS'].includes(request.method())) writes.push({method:request.method(),origin:url.origin});
  if (url.origin !== 'http://localhost:8081' && !['data:', 'blob:'].includes(url.protocol)) {
    foreign.push(request.url());
  }
});

await page.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin === 'http://localhost:8081' || ['data:', 'blob:'].includes(url.protocol)) {
    return route.continue();
  }
  foreign.push(url.origin);
  return route.abort();
});

let result;
try {
  await page.goto('http://localhost:8081/tools/browser-probe/ki-probe.html');
  await page.waitForFunction(() => window.m4Probe?.complete, null, { timeout: 5000 });
  result = await page.evaluate(() => window.m4Probe.results);
} finally {
  await browser.close();
}

for (const row of result) {
  console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.name || row.error}`);
}

const pass = Array.isArray(result) &&
  result.length >= 8 &&
  result.every(row => row.pass) &&
  errors.length === 0 &&
  foreign.length === 0 && consoleErrors.length === 0 && writes.length === 0;

console.log(JSON.stringify({
  passed: result.filter(row => row.pass).length,
  total: result.length,
  pageErrors: errors,
  blockedForeignOrigins: foreign,
  consoleErrors, networkWrites:writes
}));

process.exitCode = pass ? 0 : 1;
