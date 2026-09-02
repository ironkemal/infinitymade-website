// Ops-Dashboard DB'sine (farkaejociddtgqkusvm) DDL dahil her SQL'i çalıştırır.
// service-role key sadece REST (CRUD) yapabiliyor, DDL yapamıyor — bu yüzden
// Management API + Personal Access Token (ops/.env.ops → SUPABASE_ACCESS_TOKEN).
//
// Kullanım:
//   node ops/tools/exec-ops-sql.mjs ops/schema-numbering.sql
//   node ops/tools/exec-ops-sql.mjs --sql "select count(*) from ops_todos"

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const envPath = join(repoRoot, 'ops', '.env.ops');
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}

const PROJECT_REF = 'farkaejociddtgqkusvm';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN eksik — ops/.env.ops kontrol et');
  process.exit(1);
}

const args = process.argv.slice(2);
let sql;
if (args[0] === '--sql') {
  sql = args[1];
} else if (args[0]) {
  sql = readFileSync(join(repoRoot, args[0]), 'utf8');
} else {
  console.error('Kullanım: node exec-ops-sql.mjs <dosya.sql>  |  --sql "..."');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.json();
if (!res.ok) {
  console.error('HATA', res.status, JSON.stringify(body, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(body, null, 2));
