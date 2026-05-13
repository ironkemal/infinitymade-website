const fs = require('fs');
const src = fs.readFileSync('dashboard.js', 'utf8');

let depth = 0;
let inString = false;
let stringChar = '';
let inRegex = false;
let inLineComment = false;
let inBlockComment = false;
let lineNo = 1;

for (let i = 0; i < src.length; i++) {
  const ch = src[i];
  const next = src[i+1];
  const prev = src[i-1];

  if (ch === '\n') lineNo++;

  if (inBlockComment) {
    if (ch === '*' && next === '/') { inBlockComment = false; i++; }
    continue;
  }
  if (inLineComment) {
    if (ch === '\n') inLineComment = false;
    continue;
  }

  if (inString) {
    if (ch === '\\') { i++; continue; }
    if (ch === stringChar) inString = false;
    continue;
  }
  if (inRegex) {
    if (ch === '\\') { i++; continue; }
    if (ch === '/') inRegex = false;
    continue;
  }

  if (ch === '/' && next === '/') { inLineComment = true; continue; }
  if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }

  if (ch === '"' || ch === "'" || ch === '`') {
    inString = true; stringChar = ch; continue;
  }
  if (ch === '/' && (/[(=:,[!&|]/.test(prev))) {
    inRegex = true; continue;
  }

  if (ch === '{') depth++;
  if (ch === '}') depth--;
  if (depth < 0) {
    console.log('UNMATCHED } at line', lineNo);
    process.exit(1);
  }
}

console.log('Final brace depth:', depth);
if (depth === 0) console.log('Braces: OK');
else console.log('UNMATCHED braces, depth:', depth);
