import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(sourceDirectory, '../..');
const outputPath = resolve(packageRoot, 'lib/index.js');

await mkdir(dirname(outputPath), { recursive: true });
await build({
  entryPoints: [resolve(sourceDirectory, 'index.mjs')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  mainFields: ['module', 'main'],
  // rss-parser and nodemailer are bundled (like dsh-im bundles the Lark SDK
  // and Baileys), so the installed plugin has zero runtime package
  // dependencies and cannot break on dependency resolution.
  external: [],
  outfile: outputPath,
  banner: {
    js: [
      "import { createRequire as __dshCreateRequire } from 'node:module';",
      "import { dirname as __dshDirname } from 'node:path';",
      "import { fileURLToPath as __dshFileURLToPath } from 'node:url';",
      'const require = __dshCreateRequire(import.meta.url);',
      'const __filename = __dshFileURLToPath(import.meta.url);',
      'const __dirname = __dshDirname(__filename);',
    ].join('\n'),
  },
  sourcemap: false,
  minify: true,
  legalComments: 'eof',
});

console.log(`Wrote ${outputPath}`);
