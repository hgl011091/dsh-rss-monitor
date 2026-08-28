import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(sourceDirectory, '../..');
const outputPath = resolve(packageRoot, 'lib/client.js');

await mkdir(dirname(outputPath), { recursive: true });
await build({
  entryPoints: [resolve(sourceDirectory, 'index.js')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome100'],
  // React comes from the DSH web app bundle; everything else is bundled.
  external: ['react', 'react-dom'],
  outfile: outputPath,
  sourcemap: false,
  minify: false,
  legalComments: 'none',
});

// DSH loads client bundles through window.__ModuleLoader__, so the emitted CJS
// bundle is wrapped here (the same shape as the dsh-im client artifact).
const loaderId = 'dsh-rss-monitor';
const body = await readFile(outputPath, 'utf8');
await writeFile(outputPath, [
  `window.__ModuleLoader__.load({`,
  `  id: ${JSON.stringify(loaderId)},`,
  `  factory: (require) => {`,
  `    var module = { exports: {} };`,
  `    var exports = module.exports;`,
  body,
  `    return module.exports;`,
  `  }`,
  `});`,
  '',
].join('\n'));

console.log(`Wrote ${outputPath}`);
