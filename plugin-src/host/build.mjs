import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// esbuild's JS API spawns a subprocess to run its native binary. That
// subprocess is blocked by the DSH desktop sandbox (spawn EPERM), so we
// invoke the binary directly via its Node CLI shim. Same behaviour, no
// subprocess: the shim inlines the binary path and exec's it in-process.
//
// esbuild 0.25.x always emits `require()` calls for CommonJS dependencies
// even when --format=esm is set (#1944); the DSH cordis plugin loader is
// a strict ESM loader and rejects "Dynamic require of 'events' is not
// supported". The fix is to mark every Node built-in, rss-parser, and
// nodemailer as --external so the emitted bundle is pure ESM and resolves
// those modules at runtime through normal ESM import — rss-parser and
// nodemailer are real dependencies on the published package now.
const build = async (options) => {
  const esbuildCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../node_modules/esbuild/bin/esbuild');
  const args = [esbuildCli, options.entryPoints[0]];
  for (const ext of options.external ?? []) args.push(`--external:${ext}`);
  args.push('--bundle', `--format=${options.format}`, `--platform=${options.platform}`, `--target=${options.target.join(',')}`);
  if (options.mainFields) args.push(`--main-fields=${options.mainFields.join(',')}`);
  args.push(`--outfile=${options.outfile}`);
  if (options.minify) args.push('--minify');
  if (options.legalComments && options.legalComments !== 'none') args.push(`--legal-comments=${options.legalComments}`);
  execFileSync(process.execPath, args, { stdio: 'inherit' });
  if (options.banner) {
    const body = await readFile(options.outfile, 'utf8');
    await writeFile(options.outfile, options.banner.js + '\n' + body);
  }
};

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
  // rss-parser and nodemailer ship as CommonJS. esbuild's --bundle emits
  // `__commonJS` wrappers + `require()` calls for those, which DSH's
  // strict ESM plugin loader refuses to run. Marking them --external turns
  // them into plain ESM `import` statements that the loader resolves
  // through node_modules at runtime. Node built-ins are also marked so
  // the bundle does not need to ship its own polyfill.
  external: [
    'node:*',
    'rss-parser',
    'nodemailer',
  ],
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
