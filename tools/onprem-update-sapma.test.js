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

test('Konflikt hebt die NEUE Bundle-Fassung als .neu.bekliyor auf (onprem O-218 b)', () => {
  assert.match(s, /cp "\$BUNDLE_TMP\/bundle\/\$yol" "\$hedef\.neu\.bekliyor"/);
  assert.ok(!/cp "\$hedef" "\$hedef\.neu\.bekliyor"/.test(s), 'darf nicht die Disk-Fassung kopieren');
});

test('ohne Konflikt werden alte .neu.bekliyor-Reste vor dem Anwenden entfernt', () => {
  const aufraeumen = s.indexOf('rm -f "$SCRIPT_DIR/$yol.neu.bekliyor"');
  const anwenden = s.indexOf('kaynak="$BUNDLE_TMP/bundle/$yol"');
  assert.ok(aufraeumen > 0 && aufraeumen < anwenden);
});
