import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(sourceDirectory, '../..');
const outputPath = resolve(packageRoot, 'lib/client.js');

// Read the single source of truth for the version (package.json). The
// `plugin-src/client/index.js` source file also exports a `version`
// constant, but having the two drift independently is a footgun: the
// settings tab title shows one number while the package metadata reports
// another. The build below rewrites the constant from package.json so
// the bundle always matches the manifest.
const packageManifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
const packageVersion = packageManifest.version ?? '0.0.0';

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
let body = await readFile(outputPath, 'utf8');

// Rewrite every literal that looks like a version string ("0.1.0" or
// '0.1.0') in the bundle to the package.json version. The two places
// where this matters in plugin-src are:
//   - `export const version = '0.1.0'` in client/index.js
//   - `version = '0.1.0'` default in RssSettingsTab's signature
// Esbuild keeps these as raw string literals in the CJS bundle, so a
// targeted replacement is the simplest way to keep them in lockstep
// with the package manifest without coupling the source files to a
// preprocessor.
body = body.replace(/['"]0\.1\.0['"]/g, JSON.stringify(packageVersion));
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

console.log(`Wrote ${outputPath} (version ${packageVersion})`);
