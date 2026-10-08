// Build-time only. Customer boxes serve these committed files without npm/CDN.
import { build } from 'esbuild';
import { copyFile, cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
await build({
  absWorkingDir: root, entryPoints: ['tools/vendor/zxing-entry.js'],
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020',
  minify: true, legalComments: 'linked', outfile: `${root}/vendor/zxing.js`,
  banner: { js: '/*! @zxing/library 0.21.3. Upstream LICENSE: Apache-2.0; ts-custom-error: MIT. See adjacent license files. */' },
});
await mkdir(`${root}/vendor/pdfjs`, { recursive: true });
for (const [source, dest] of [
  ['@zxing/library/LICENSE', 'zxing.LICENSE'],
  ['ts-custom-error/LICENSE', 'zxing-ts-custom-error.LICENSE'],
  ['pdfjs-dist/build/pdf.min.mjs', 'pdfjs/pdf.mjs'],
  ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdfjs/pdf.worker.mjs'],
  ['pdfjs-dist/LICENSE', 'pdfjs/LICENSE'],
]) await copyFile(`${root}/node_modules/${source}`, `${root}/vendor/${dest}`);
await cp(`${root}/node_modules/pdfjs-dist/standard_fonts`, `${root}/vendor/pdfjs/standard_fonts`, { recursive: true });
// API Docker's build context cannot see module/. Keep one source, two artifacts.
await copyFile(`${root}/module/podologie-heilmittel-position.js`, `${root}/api-backend/lib/podologie-heilmittel-position.js`);
