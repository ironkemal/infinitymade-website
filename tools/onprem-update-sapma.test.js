// update.sh Sapma-Prüfung (Beta-Test 22.10.2026): Eine Datei, die von der letzten
// erfolgreichen Fassung abweicht, ist nur dann „von Hand geändert", wenn sie auch
// NICHT schon byte-gleich mit der neuen Bundle-Fassung ist. Sonst stoppt jeder
// per Hand eingespielte Hotfix die nächtliche Aktualisierung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const s = fs.readFileSync(path.join(repoRoot, 'onprem/update.sh'), 'utf8');

test('Sapma nur, wenn Disk ≠ letzte Fassung UND Disk ≠ neue Fassung', () => {
  const zeile = s.split('\n').find((z) => z.includes('Sapma:') === false && /taban_sha" != "\$mevcut_sha"/.test(z));
  assert.ok(zeile, 'Bedingung der Sapma-Prüfung nicht gefunden');
  assert.match(zeile, /"\$mevcut_sha" != "\$yeni_sha"/);
});
