// Build-time only (wie build-barcode.mjs): erzeugt vendor/qrcode.js aus dem gepinnten
// @zxing/library 0.21.3. Lizenz liegt schon als vendor/zxing.LICENSE daneben.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
await build({
  absWorkingDir: root, entryPoints: ['tools/vendor/qrcode-entry.js'],
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020',
  minify: true, legalComments: 'none', outfile: `${root}/vendor/qrcode.js`,
  banner: { js: '/*! @zxing/library 0.21.3 (QRCodeWriter). Upstream LICENSE: Apache-2.0, see vendor/zxing.LICENSE. */' },
});
