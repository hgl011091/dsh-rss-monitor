/**
 * Guard against the 0.2.7 incident: the published 0.2.7 tarball shipped a
 * lib/client.js built while the tree was still 0.2.6, so the installed
 * settings tab kept displaying "v0.2.6" forever. These checks run against
 * the actual artifact (npm pack triggers prepack -> build -> this file):
 *
 *   1. lib/client.js exists and is wrapped for window.__ModuleLoader__;
 *   2. every semver literal in the bundle equals package.json's version;
 *   3. the bundle executes under the ModuleLoader contract and exports the
 *      plugin module with the right name/version.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
const expectedVersion = manifest.version;

test('client bundle exists and is wrapped for window.__ModuleLoader__', async () => {
  const bundle = await readFile(resolve(packageRoot, 'lib/client.js'), 'utf8');
  assert.ok(bundle.trimStart().startsWith('window.__ModuleLoader__.load({'), 'bundle must use the ModuleLoader wrapper');
  assert.ok(bundle.includes(`id: "dsh-rss-monitor"`), 'bundle must declare the dsh-rss-monitor loader id');
});

test('client bundle has no stale semver literals', async () => {
  const bundle = await readFile(resolve(packageRoot, 'lib/client.js'), 'utf8');
  const literals = [...new Set([...bundle.matchAll(/['"](\d+\.\d+\.\d+)['"]/g)].map((m) => m[1]))];
  assert.deepEqual(literals, [expectedVersion], `bundle must only contain version ${expectedVersion}`);
});

test('client bundle executes under the ModuleLoader contract', async () => {
  const bundle = await readFile(resolve(packageRoot, 'lib/client.js'), 'utf8');
  const loaded = [];
  // esbuild's __toESM interop builds the namespace via
  // Object.create(proto) + copyProps(own properties), so a bare Proxy stub
  // is not enough — the stub must carry the React APIs the bundle uses as
  // real own properties. Extract them from the bundle text itself so the
  // list can never drift (esbuild emits both `React2.x` and `React.x`).
  const usedReactApis = [...new Set(
    [...bundle.matchAll(/\bReact2?\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
  )];
  const stub = function stub() {};
  stub.__esModule = true;
  stub.default = stub;
  for (const api of usedReactApis) stub[api] = stub;
  const sandbox = {
    window: { __ModuleLoader__: { load: (definition) => loaded.push(definition) } },
    require: (name) => (name === 'react' ? stub : {}),
  };
  vm.createContext(sandbox);
  vm.runInContext(bundle, sandbox, { filename: 'lib/client.js' });
  assert.equal(loaded.length, 1, 'bundle must register exactly one ModuleLoader module');
  const module = loaded[0].factory(() => stub);
  assert.equal(module.name, 'dsh-rss-monitor');
  assert.equal(module.version, expectedVersion);
  assert.equal(typeof module.apply, 'function');
});
