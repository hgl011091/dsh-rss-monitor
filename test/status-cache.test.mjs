import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RssController } from '../src/controller.mjs';

function makeFakeStore(initial) {
  let value = initial;
  return {
    get: () => structuredClone(value),
    save: async (next) => { value = next; },
    set: (next) => { value = next; },
  };
}

function makeFakeMonitor() {
  let running = false;
  let nextCheckAt = null;
  return {
    isRunning: () => running,
    getNextCheckAt: () => nextCheckAt,
    applySettings: () => { running = true; nextCheckAt = '2099-01-01T00:00:00Z'; },
    start: () => { running = true; },
    stop: () => { running = false; nextCheckAt = null; },
    checkNow: async () => ({ newItems: [], errors: [], checkedFeeds: 0 }),
  };
}

function makeController({ config, state, monitor } = {}) {
  const configStore = makeFakeStore(config ?? { settings: { checkInterval: 5, enabled: false }, feeds: [], display: { recentItems: 10, historyItems: 10 } });
  const stateStore = makeFakeStore(state ?? { lastCheck: null, notifiedItems: [], recentItems: [], history: [] });
  const fakeMonitor = monitor ?? makeFakeMonitor();
  const notifier = { isConfigured: () => false };
  return new RssController({
    configStore,
    stateStore,
    monitor: fakeMonitor,
    notifier,
    describeFeed: null,
    credentials: null,
    logger: { warn: () => {}, info: () => {}, error: () => {} },
  });
}

test('status() returns the same object reference on a second call when nothing changed', async () => {
  const controller = makeController();
  const first = await controller.status();
  const second = await controller.status();
  // The cache short-circuits the second call and hands back the exact
  // same object, so the client gets a stable reference and its own
  // fingerprint diff becomes O(1).
  assert.equal(first, second);
});

test('status() rebuilds after saveFeed invalidates the cache', async () => {
  const controller = makeController({
    config: {
      settings: { checkInterval: 5, enabled: false },
      feeds: [{ id: 'a', name: 'A', url: 'https://a.com/feed', enabled: true, keywords: [], excludeKeywords: [] }],
      display: { recentItems: 10, historyItems: 10 },
    },
  });
  const before = await controller.status();
  await controller.saveFeed({ feed: { id: 'b', name: 'B', url: 'https://b.com/feed', enabled: true, keywords: [], excludeKeywords: [] } });
  const after = await controller.status();
  assert.notEqual(before, after);
  assert.equal(after.feeds.length, 2);
});

test('status() rebuilds after onStateChanged (monitor periodic check path)', async () => {
  const controller = makeController();
  const before = await controller.status();
  controller.onStateChanged();
  const after = await controller.status();
  assert.notEqual(before, after);
});

test('status() rebuilds after saveSettings when the monitor flips', async () => {
  const controller = makeController();
  const before = await controller.status();
  await controller.saveSettings({ checkInterval: 10, enabled: true });
  const after = await controller.status();
  assert.notEqual(before, after);
  assert.equal(after.running, true);
  assert.equal(after.enabled, true);
});
