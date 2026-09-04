import test from 'node:test';
import assert from 'node:assert/strict';

import { tr, setRssTranslator } from '../plugin-src/client/i18n.js';

test('tr caches translator results so repeated keys skip the host call', () => {
  let calls = 0;
  setRssTranslator((key) => { calls++; return key === 'Hello' ? '你好' : key; });
  // First call: 1 host invocation.
  assert.equal(tr('Hello'), '你好');
  assert.equal(calls, 1);
  // Repeated call: cache hit, no host call.
  assert.equal(tr('Hello'), '你好');
  assert.equal(calls, 1);
  // New key: cache miss, 1 host invocation.
  assert.equal(tr('World'), 'World');
  assert.equal(calls, 2);
  // Back to first key: still cached.
  assert.equal(tr('Hello'), '你好');
  assert.equal(calls, 2);
});

test('tr falls back to the key when no translator is installed', () => {
  setRssTranslator(null);
  assert.equal(tr('Hello'), 'Hello');
});

test('re-installing a translator flushes the cache so the new one is consulted', () => {
  setRssTranslator(null);
  setRssTranslator((key) => key === 'Hello' ? '你好' : key);
  assert.equal(tr('Hello'), '你好');
  setRssTranslator((key) => key === 'Hello' ? 'Hallo' : key);
  // New translator must see the call, not the stale cache.
  assert.equal(tr('Hello'), 'Hallo');
});
