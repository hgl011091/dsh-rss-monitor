import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';

import { RssConfigStore } from '../src/config-store.mjs';
import { RssStateStore } from '../src/state-store.mjs';

test('RssConfigStore round-trips normalized configuration atomically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rss-config-'));
  try {
    const path = join(directory, 'nested', 'config.json');
    const store = await new RssConfigStore(path).load();
    const initial = store.get();
    assert.equal(initial.settings.checkInterval, 5);
    assert.equal(initial.feeds.length, 0);
    assert.equal(initial.email, null);

    const saved = await store.save({
      version: 1,
      settings: { checkInterval: 15, enabled: true },
      feeds: [{ name: 'n', url: 'https://a.com/feed', keywords: ['ai'] }],
      email: { host: 'smtp.a.com', to: 'me@a.com' },
    });
    assert.equal(saved.settings.checkInterval, 15);
    assert.equal(saved.settings.enabled, true);
    assert.equal(saved.feeds[0].keywords[0], 'ai');
    assert.equal(saved.email.host, 'smtp.a.com');

    const onDisk = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(onDisk.settings.checkInterval, 15);
    assert.ok(onDisk.feeds[0].id);

    const reloaded = await new RssConfigStore(path).load();
    assert.deepEqual(reloaded.get(), saved);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('RssConfigStore refuses to persist invalid configuration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rss-config-'));
  try {
    const path = join(directory, 'config.json');
    const store = await new RssConfigStore(path).load();
    await assert.rejects(
      () => store.save({ settings: { checkInterval: 0 } }),
      /invalid dsh-rss-monitor configuration/,
    );
    await assert.rejects(() => store.save(null));
    let sawTmp = false;
    try {
      const entries = await readFile(path, 'utf8');
      sawTmp = entries.length > 0;
    } catch {
      sawTmp = false;
    }
    assert.equal(sawTmp, false, 'invalid save must not leave a config file behind');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('RssStateStore sanitizes junk entries and caps arrays', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rss-state-'));
  try {
    const path = join(directory, 'state.json');
    const store = await new RssStateStore(path).load();
    const empty = store.get();
    assert.equal(empty.lastCheck, null);
    assert.deepEqual(empty.notifiedItems, []);
    assert.deepEqual(empty.recentItems, []);
    assert.deepEqual(empty.history, []);

    const items = Array.from({ length: 150 }, (_, i) => ({
      id: `id${i}`,
      feedId: 'feed',
      feedName: 'Feed',
      title: `t${i}`,
      link: `https://a.com/${i}`,
      discoveredAt: '2026-01-01T00:00:00.000Z',
    }));
    const history = Array.from({ length: 80 }, (_, i) => ({
      timestamp: `2026-01-01T00:${String(i % 60).padStart(2, '0')}:00.000Z#${i}`,
      manual: false,
      newCount: i,
      checkedFeeds: 1,
      errors: [],
    }));
    const saved = await store.save({
      lastCheck: '2026-01-01T00:00:00.000Z',
      notifiedItems: [...Array.from({ length: 1100 }, (_, i) => `n${i}`), 42, null],
      recentItems: [...items, { id: '' }, null, 'junk', { id: 'ok', feedId: 'f' }],
      history: [...history, null, 'junk', { timestamp: '', newCount: 1 }, { timestamp: '2026-01-02T00:00:00.000Z', manual: true, newCount: 2, checkedFeeds: 3, errors: [{ feed: 'f', error: 'e' }, 'junk', 42] }],
    });
    assert.equal(saved.notifiedItems.length, 1000);
    assert.equal(saved.notifiedItems.at(-1), 'n1099');
    assert.equal(saved.recentItems.length, 100);
    // recentItems are stored newest-first; the cap keeps the head, so the
    // trailing junk-valid entry ("ok") beyond 100 entries is dropped.
    assert.equal(saved.recentItems.at(-1).id, 'id99');
    assert.equal(saved.history.length, 50);
    assert.equal(saved.history.at(-1).timestamp, '2026-01-02T00:00:00.000Z');
    assert.equal(saved.history.at(-1).manual, true);
    assert.equal(saved.history.at(-1).errors.length, 1);
    assert.deepEqual(saved.history.at(-1).errors[0], { feed: 'f', error: 'e' });

    const reloaded = await new RssStateStore(path).load();
    assert.deepEqual(reloaded.get(), saved);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
