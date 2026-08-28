import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';

import { RssConfigStore } from '../src/config-store.mjs';
import { generateGuid, passesKeywordFilter, RssMonitor } from '../src/monitor.mjs';
import { RssStateStore } from '../src/state-store.mjs';

test('generateGuid follows the rss-video-monitor md5 scheme with field fallback', () => {
  const url = 'https://a.com/feed';
  const expected = createHash('md5').update(`${url}|guid-1`).digest('hex').slice(0, 16);
  assert.equal(generateGuid({ guid: 'guid-1', link: 'x', title: 't' }, url), expected);
  const linkExpected = createHash('md5').update(`${url}|link-1`).digest('hex').slice(0, 16);
  assert.equal(generateGuid({ link: 'link-1', title: 't' }, url), linkExpected);
  const titleExpected = createHash('md5').update(`${url}|title-1`).digest('hex').slice(0, 16);
  assert.equal(generateGuid({ title: 'title-1' }, url), titleExpected);
  const emptyExpected = createHash('md5').update(`${url}|`).digest('hex').slice(0, 16);
  assert.equal(generateGuid({}, url), emptyExpected);
});

test('passesKeywordFilter implements include/exclude over title and snippet', () => {
  const feed = (keywords, excludeKeywords) => ({ keywords, excludeKeywords });
  const item = { title: 'DeepSeek 发布新模型', contentSnippet: 'open source weights' };
  assert.equal(passesKeywordFilter(item, feed([], [])), true);
  assert.equal(passesKeywordFilter(item, feed(['deepseek'], [])), true);
  assert.equal(passesKeywordFilter(item, feed(['DeepSeek'], [])), true);
  assert.equal(passesKeywordFilter(item, feed(['模型'], [])), true);
  assert.equal(passesKeywordFilter(item, feed(['weights'], [])), true);
  assert.equal(passesKeywordFilter(item, feed(['不存在的词'], [])), false);
  assert.equal(passesKeywordFilter(item, feed(['deepseek', 'x'], [])), true);
  assert.equal(passesKeywordFilter(item, feed([], ['模型'])), false);
  assert.equal(passesKeywordFilter(item, feed([], ['Open Source'])), false);
  assert.equal(passesKeywordFilter(item, feed(['deepseek'], ['模型'])), false);
  assert.equal(passesKeywordFilter(item, feed(['deepseek'], ['不存在'])), true);
});

const directories = [];

async function buildStores() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rss-monitor-'));
  directories.push(directory);
  const configStore = await new RssConfigStore(join(directory, 'config.json')).load();
  const stateStore = await new RssStateStore(join(directory, 'state.json')).load();
  return { configStore, stateStore };
}

test.after(async () => {
  await Promise.allSettled(directories.map((dir) => rm(dir, { recursive: true, force: true })));
});

test('RssMonitor checks feeds, dedups by guid, filters keywords, and notifies', async () => {
  const { configStore, stateStore } = await buildStores();
  await configStore.save({
    settings: { checkInterval: 5, enabled: true },
    feeds: [
      { id: 'feed-a', name: 'A', url: 'https://a.com/feed', enabled: true, keywords: [], excludeKeywords: [] },
      { id: 'feed-b', name: 'B', url: 'https://b.com/feed', enabled: true, keywords: ['ai'], excludeKeywords: [] },
      { id: 'feed-c', name: 'C', url: 'https://c.com/feed', enabled: false, keywords: [], excludeKeywords: [] },
    ],
  });

  const fetchedUrls = [];
  const notifications = [];
  const monitor = new RssMonitor({
    configStore,
    stateStore,
    fetchFeed: async (url) => {
      fetchedUrls.push(url);
      if (url === 'https://a.com/feed') {
        return [
          { guid: 'a1', title: 'Alpha one', link: 'https://a.com/1', contentSnippet: 'first' },
          { guid: 'a2', title: 'Alpha two', link: 'https://a.com/2', contentSnippet: 'second' },
        ];
      }
      if (url === 'https://b.com/feed') {
        return [
          { guid: 'b1', title: 'Beta AI news', link: 'https://b.com/1' },
          { guid: 'b2', title: 'Beta weather', link: 'https://b.com/2' },
        ];
      }
      return [{ guid: 'c1', title: 'Gamma', link: 'https://c.com/1' }];
    },
    notify: async (items) => notifications.push(items),
    now: () => '2026-01-01T00:00:00.000Z',
    schedule: { setInterval: () => null, clearInterval: () => {}, setTimeout: () => null, clearTimeout: () => {} },
  });

  const first = await monitor.checkNow(true);
  assert.equal(first.checkedFeeds, 2);
  assert.equal(first.newItems.length, 3);
  assert.deepEqual(first.errors, []);
  assert.equal(fetchedUrls.length, 2);
  assert.ok(first.newItems.every((item) => item.discoveredAt === '2026-01-01T00:00:00.000Z'));
  // Cross-feed completion order under concurrency is not deterministic;
  // compare as a sorted multiset.
  assert.deepEqual(first.newItems.map((item) => item.feedId).sort(), ['feed-a', 'feed-a', 'feed-b']);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].length, 3);

  const state = stateStore.get();
  assert.equal(state.lastCheck, '2026-01-01T00:00:00.000Z');
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].manual, true);
  assert.equal(state.history[0].newCount, 3);
  assert.equal(state.notifiedItems.length, 3);
  assert.equal(state.recentItems.length, 3);

  const second = await monitor.checkNow(false);
  assert.equal(second.newItems.length, 0);
  assert.equal(second.checkedFeeds, 2);
  assert.equal(stateStore.get().recentItems.length, 3);
  assert.equal(stateStore.get().history.length, 2);
  assert.equal(stateStore.get().history[0].manual, false);
  assert.equal(notifications.length, 1, 'no duplicate notification for known guids');
});

test('RssMonitor collects per-feed errors without failing the whole check', async () => {
  const { configStore, stateStore } = await buildStores();
  await configStore.save({
    settings: { checkInterval: 5, enabled: true },
    feeds: [
      { id: 'ok', name: 'OK', url: 'https://ok.com/feed', enabled: true, keywords: [], excludeKeywords: [] },
      { id: 'bad', name: 'BAD', url: 'https://bad.com/feed', enabled: true, keywords: [], excludeKeywords: [] },
    ],
  });
  const monitor = new RssMonitor({
    configStore,
    stateStore,
    fetchFeed: async (url) => {
      if (url === 'https://bad.com/feed') throw new Error('HTTP 503');
      return [{ guid: 'ok1', title: 'Fine', link: 'https://ok.com/1' }];
    },
    now: () => '2026-01-01T00:00:00.000Z',
    schedule: { setInterval: () => null, clearInterval: () => {}, setTimeout: () => null, clearTimeout: () => {} },
  });
  const result = await monitor.checkNow(false);
  assert.equal(result.checkedFeeds, 2);
  assert.equal(result.newItems.length, 1);
  assert.deepEqual(result.errors, [{ feed: 'BAD', error: 'HTTP 503' }]);
  assert.equal(stateStore.get().history[0].errors.length, 1);
  assert.equal(stateStore.get().history[0].checkedFeeds, 2);
});

test('RssMonitor dedup window evicts oldest ids past the 1000 cap', async () => {
  const { configStore, stateStore } = await buildStores();
  await configStore.save({
    settings: { checkInterval: 5, enabled: true },
    feeds: [{ id: 'feed', name: 'F', url: 'https://f.com/feed', enabled: true, keywords: [], excludeKeywords: [] }],
  });
  let round = 0;
  const monitor = new RssMonitor({
    configStore,
    stateStore,
    fetchFeed: async () => {
      round += 1;
      return Array.from({ length: 700 }, (_, i) => ({
        guid: `r${round}-i${i}`,
        title: `item ${round}-${i}`,
        link: `https://f.com/${round}/${i}`,
      }));
    },
    now: () => `2026-01-0${round < 8 ? round + 1 : 9}T00:00:00.000Z`,
    schedule: { setInterval: () => null, clearInterval: () => {}, setTimeout: () => null, clearTimeout: () => {} },
  });
  await monitor.checkNow(false);
  await monitor.checkNow(false);
  assert.equal(stateStore.get().notifiedItems.length, 1000);

  const before = new Set(stateStore.get().notifiedItems);
  await monitor.checkNow(false);
  const after = stateStore.get().notifiedItems;
  assert.equal(after.length, 1000);
  const afterSet = new Set(after);
  // Tracked ids are md5-derived (generateGuid), not the raw item guids.
  const round3Ids = Array.from({ length: 700 }, (_, i) => generateGuid({ guid: `r${round}-i${i}` }, 'https://f.com/feed'));
  assert.ok(round3Ids.every((id) => afterSet.has(id)), 'round-3 items must all be tracked');
  const evicted = [...before].filter((id) => !afterSet.has(id));
  assert.ok(evicted.length > 0, 'oldest ids must be evicted');
});

test('checkNow shares one in-flight promise and stays identity-stable', async () => {
  const { configStore, stateStore } = await buildStores();
  await configStore.save({
    settings: { checkInterval: 5, enabled: true },
    feeds: [{ id: 'feed', name: 'F', url: 'https://s.com/feed', enabled: true, keywords: [], excludeKeywords: [] }],
  });
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const monitor = new RssMonitor({
    configStore,
    stateStore,
    fetchFeed: async () => {
      calls += 1;
      await gate;
      return [{ guid: 's1', title: 'Shared', link: 'https://s.com/1' }];
    },
    now: () => '2026-01-01T00:00:00.000Z',
    schedule: { setInterval: () => null, clearInterval: () => {}, setTimeout: () => null, clearTimeout: () => {} },
  });

  const first = monitor.checkNow(true);
  const second = monitor.checkNow(false);
  assert.equal(typeof monitor.checkNow, 'function');
  assert.ok(first instanceof Promise);
  assert.equal(first, second, 'concurrent callers must receive the same promise');
  release();
  const result = await first;
  assert.equal(calls, 1);
  assert.equal(result.newItems.length, 1);

  const third = monitor.checkNow(false);
  assert.notEqual(third, first, 'after settling a new check creates a new promise');
  await third;
  assert.equal(calls, 2);
});

test('RssMonitor lifecycle: start arms the timer, applySettings re-arms, stop clears', async () => {
  const { configStore, stateStore } = await buildStores();
  await configStore.save({
    settings: { checkInterval: 5, enabled: true },
    feeds: [{ id: 'feed', name: 'F', url: 'https://l.com/feed', enabled: true, keywords: [], excludeKeywords: [] }],
  });
  const timers = { intervals: [], timeouts: [] };
  const schedule = {
    setInterval: (fn, ms) => {
      const timer = { fn, ms, cleared: false };
      timers.intervals.push(timer);
      return timer;
    },
    clearInterval: (timer) => {
      if (timer) timer.cleared = true;
    },
    setTimeout: (fn, ms) => {
      const timer = { fn, ms, cleared: false };
      timers.timeouts.push(timer);
      return timer;
    },
    clearTimeout: (timer) => {
      if (timer) timer.cleared = true;
    },
  };
  const monitor = new RssMonitor({
    configStore,
    stateStore,
    fetchFeed: async () => [],
    now: () => '2026-01-01T00:00:00.000Z',
    schedule,
  });

  assert.equal(monitor.isRunning(), false);
  assert.equal(monitor.getNextCheckAt(), null);

  const started = monitor.start({ immediate: true });
  assert.equal(started, true);
  assert.equal(monitor.isRunning(), true);
  assert.equal(timers.intervals.length, 1);
  assert.equal(timers.intervals[0].ms, 5 * 60_000);
  assert.ok(monitor.getNextCheckAt());
  assert.equal(timers.timeouts.length, 1, 'immediate start schedules one early check');
  assert.equal(timers.timeouts[0].ms, 3_000);
  timers.timeouts[0].fn();

  const rearmed = monitor.applySettings({ checkInterval: 30, enabled: true });
  assert.equal(rearmed, true);
  assert.equal(timers.intervals[0].cleared, true);
  assert.equal(timers.intervals[1].ms, 30 * 60_000);

  monitor.stop();
  assert.equal(monitor.isRunning(), false);
  assert.equal(monitor.getNextCheckAt(), null);
  assert.equal(timers.intervals[1].cleared, true);

  const disabled = monitor.applySettings({ checkInterval: 5, enabled: false });
  assert.equal(disabled, false);
  assert.equal(monitor.isRunning(), false);
});
