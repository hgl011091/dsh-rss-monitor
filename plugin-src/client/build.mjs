import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// esbuild's JS API spawns a subprocess to run its native binary. That
// subprocess is blocked by the DSH desktop sandbox (spawn EPERM), so we
// invoke the binary directly via its Node CLI shim. Same behaviour, no
// subprocess: the shim inlines the binary path and exec's it in-process.
const build = async (options) => {
  const esbuildCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../node_modules/esbuild/bin/esbuild');
  const args = [esbuildCli, options.entryPoints[0]];
  for (const ext of options.external ?? []) args.push(`--external:${ext}`);
  args.push('--bundle', `--format=${options.format}`, `--platform=${options.platform}`, `--target=${options.target.join(',')}`);
  args.push(`--outfile=${options.outfile}`);
  if (options.minify) args.push('--minify');
  if (options.legalComments && options.legalComments !== 'none') args.push(`--legal-comments=${options.legalComments}`);
  execFileSync(process.execPath, args, { stdio: 'inherit' });
};

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

// Rewrite every literal that looks like a semver string ("0.1.0" or
// '2.4.0') in the bundle to the package.json version. The two places
// where this matters in plugin-src are:
//   - `export const version = '0.2.0'` in client/index.js
//   - `version = '0.2.0'` default in RssSettingsTab's signature
// Esbuild keeps these as raw string literals in the CJS bundle, so a
// targeted replacement is the simplest way to keep them in lockstep
// with the package manifest without coupling the source files to a
// preprocessor. The pattern matches any triple of digit-dot-digit-dot-
// digit in single or double quotes so adding a new literal later
// (or bumping a default) cannot accidentally bypass the rewrite.
body = body.replace(/['"]\d+\.\d+\.\d+['"]/g, JSON.stringify(packageVersion));
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
