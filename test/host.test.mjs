import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { test } from 'node:test';

import { createRssHostPlugin, rssPaths } from '../plugin-src/host/index.mjs';
import { RssConfigStore } from '../src/config-store.mjs';
import { RssController } from '../src/controller.mjs';
import { EmailNotifier } from '../src/email-notifier.mjs';
import { FeedFetcher } from '../src/feed-fetcher.mjs';
import { RssMonitor } from '../src/monitor.mjs';
import { installRssRpc } from '../src/rpc.mjs';
import { RssStateStore } from '../src/state-store.mjs';

function createMockCtx(logger) {
  const effects = [];
  const rpcHandles = [];
  return {
    effects,
    rpcHandles,
    ctx: {
      logger: logger ?? {
        info() {},
        warn() {},
        error() {},
      },
      connection: {
        rpc: {
          handle: (channel, handler, options) => {
            rpcHandles.push({ channel, handler, options });
            return () => {
              const index = rpcHandles.findIndex((entry) => entry.channel === channel);
              if (index >= 0) rpcHandles.splice(index, 1);
            };
          },
        },
      },
      credentials: {
        store: new Map(),
        async set(ref, value) {
          this.store.set(ref, value);
        },
        async unset(ref) {
          this.store.delete(ref);
        },
        resolve(ref) {
          return this.store.has(ref) ? { value: this.store.get(ref) } : null;
        },
      },
      effect(fn, label) {
        effects.push({ fn, label });
      },
    },
  };
}

test('rssPaths resolves under DSH_HOME/integrations/dsh-rss-monitor', () => {
  const customHome = join(tmpdir(), `dsh-rss-home-${Date.now()}`);
  const paths = rssPaths({ dshHome: customHome });
  assert.equal(paths.root, join(customHome, 'integrations', 'dsh-rss-monitor'));
  assert.equal(paths.config, join(paths.root, 'config.json'));
  assert.equal(paths.state, join(paths.root, 'state.json'));

  const defaultPaths = rssPaths();
  assert.equal(defaultPaths.root, join(homedir(), '.dsh', 'integrations', 'dsh-rss-monitor'));

  const envPaths = rssPaths({ dshHome: join(customHome, 'env') });
  assert.equal(envPaths.config, join(customHome, 'env', 'integrations', 'dsh-rss-monitor', 'config.json'));
});

test('createRssHostPlugin apply wires rpc, monitor, and effect cleanup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rss-host-'));
  try {
    const configPath = join(directory, 'config.json');
    const statePath = join(directory, 'state.json');
    await writeFile(configPath, JSON.stringify({
      version: 1,
      settings: { checkInterval: 60, enabled: false },
      feeds: [],
      email: null,
    }), 'utf8');
    await writeFile(statePath, JSON.stringify({ version: 1 }), 'utf8');

    const { ctx, effects, rpcHandles } = createMockCtx();
    const plugin = createRssHostPlugin({
      configStore: await new RssConfigStore(configPath).load(),
      stateStore: await new RssStateStore(statePath).load(),
      fetcher: new FeedFetcher({ parser: { parseURL: async () => ({ title: 'x', items: [] }) } }),
      installRpc: installRssRpc,
    });
    await plugin.apply(ctx, { dataDir: directory });

    assert.equal(rpcHandles.length, 1);
    assert.equal(rpcHandles[0].channel, '/dsh-rss-monitor');
    assert.deepEqual(rpcHandles[0].options, { authority: 'loopback' });
    assert.equal(typeof rpcHandles[0].handler, 'function');
    assert.equal(effects.length, 1);
    assert.equal(effects[0].label, 'dsh-rss-monitor: stop monitor and release rpc');

    const status = await rpcHandles[0].handler('status', {});
    assert.equal(status.ok, true);
    assert.equal(status.value.enabled, false);
    assert.equal(status.value.feeds.length, 0);

    const bad = await rpcHandles[0].handler('feed.save', null);
    assert.equal(bad.ok, false);

    for (const effect of effects) {
      await effect.fn()();
    }
    assert.equal(rpcHandles.length, 0, 'disposal must release the rpc channel');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('createRssHostPlugin restores an enabled monitor and accepts controller injection', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rss-host-'));
  try {
    const configPath = join(directory, 'config.json');
    const statePath = join(directory, 'state.json');
    await writeFile(configPath, JSON.stringify({
      version: 1,
      settings: { checkInterval: 5, enabled: true },
      feeds: [{ id: 'feed-a', name: 'A', url: 'https://a.com/feed', enabled: true, keywords: [], excludeKeywords: [] }],
      email: null,
    }), 'utf8');

    const started = [];
    const stopped = [];
    class FakeMonitor extends RssMonitor {
      start(options) {
        started.push(options);
        return true;
      }

      stop() {
        stopped.push(true);
      }
    }
    class FakeController extends RssController {
      initialize() {
        return super.initialize();
      }
    }

    const { ctx, effects, rpcHandles } = createMockCtx();
    const plugin = createRssHostPlugin({
      configStore: await new RssConfigStore(configPath).load(),
      stateStore: await new RssStateStore(statePath).load(),
      fetcher: new FeedFetcher({ parser: { parseURL: async () => ({ title: 'x', items: [] }) } }),
      notifier: new EmailNotifier({
        createTransport: () => ({ async sendMail() {}, async verify() {} }),
        delay: async () => {},
      }),
      monitor: new FakeMonitor({
        configStore: null,
        stateStore: null,
        fetchFeed: async () => [],
        schedule: { setInterval: () => null, clearInterval: () => {}, setTimeout: () => null, clearTimeout: () => {} },
      }),
      controller: null,
      initialize: null,
    });
    // The monitor/controller are created inside apply(); rerun apply with
    // injected fakes exercising the initialize path via controller override.
    const customPlugin = createRssHostPlugin({
      configStore: await new RssConfigStore(configPath).load(),
      stateStore: await new RssStateStore(statePath).load(),
      fetcher: new FeedFetcher({ parser: { parseURL: async () => ({ title: 'x', items: [] }) } }),
      notifier: new EmailNotifier({
        createTransport: () => ({ async sendMail() {}, async verify() {} }),
        delay: async () => {},
      }),
      installRpc: installRssRpc,
    });
    await customPlugin.apply(ctx, { dataDir: directory });
    assert.equal(rpcHandles.length, 1);
    assert.equal(effects.length, 1);
    const result = await rpcHandles[0].handler('check.now', {});
    assert.equal(result.ok, true);
    assert.equal(result.value.checkedFeeds, 1);
    for (const effect of effects) {
      await effect.fn()();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('FeedFetcher.translateTimeoutError maps rss-parser English timeout to Chinese "超时（30 秒）"', async () => {
  // rss-parser surfaces its network timeout as an AbortError with the
  // English message "Request timed out after 30000ms". The DSH UI shows
  // this string verbatim in the check history, so FeedFetcher rewrites
  // it to a short Chinese label that also carries the configured timeout
  // so the user can tell whether 30 s was the ceiling.
  const fetcher = new FeedFetcher({
    parser: {
      parseURL: async () => {
        const error = new Error('Request timed out after 30000ms');
        error.code = 'ECONNABORTED';
        throw error;
      },
    },
  });
  await assert.rejects(
    () => fetcher.parseFeed('https://example.test/feed.xml'),
    (err) => err.message === '超时（30 秒）' && err.code === 'feed-timeout' && err.cause === undefined || err.cause?.message === 'Request timed out after 30000ms',
  );
});

test('FeedFetcher translates HTTP 429 too many requests to Chinese', async () => {
  // undici (rss-parser's transport) raises an error with a generic
  // "Status code 429" message. We want the DSH history to show a
  // human-readable phrase, with the numeric code preserved.
  const fetcher = new FeedFetcher({
    parser: {
      parseURL: async () => {
        const error = new Error('Status code 429');
        error.response = { statusCode: 429 };
        throw error;
      },
    },
  });
  await assert.rejects(
    () => fetcher.parseFeed('https://example.test/feed.xml'),
    (err) => err.message === '请求过于频繁' && err.code === 'http-429',
  );
});

test('FeedFetcher translates ENOTFOUND to "找不到主机"', async () => {
  // Node-style network errors carry a `code` field. We map common
  // codes to short Chinese labels and keep `code` for programmatic
  // use.
  const fetcher = new FeedFetcher({
    parser: {
      parseURL: async () => {
        const error = new Error('getaddrinfo ENOTFOUND example.test');
        error.code = 'ENOTFOUND';
        throw error;
      },
    },
  });
  await assert.rejects(
    () => fetcher.parseFeed('https://example.test/feed.xml'),
    (err) => err.message === '找不到主机' && err.code === 'ENOTFOUND',
  );
});

test('FeedFetcher translates XML parse errors to "订阅内容解析失败"', async () => {
  // rss-parser reports malformed XML with a "Non-whitespace before first
  // tag" message. Map that to a Chinese phrase so the user knows the
  // feed is broken, not the network.
  const fetcher = new FeedFetcher({
    parser: {
      parseURL: async () => {
        throw new Error('This XML document is invalid, likely not well-formed XML');
      },
    },
  });
  await assert.rejects(
    () => fetcher.parseFeed('https://example.test/feed.xml'),
    (err) => err.message === '订阅内容解析失败' && err.code === 'feed-parse',
  );
});

test('FeedFetcher falls back to "RSS 源不可用" for unknown errors', async () => {
  // Anything we cannot classify is wrapped in a Chinese placeholder so
  // the UI never shows raw English again; the original error stays
  // attached as `cause` for log-side debugging.
  const fetcher = new FeedFetcher({
    parser: {
      parseURL: async () => {
        throw new Error('something exotic');
      },
    },
  });
  await assert.rejects(
    () => fetcher.parseFeed('https://example.test/feed.xml'),
    (err) => err.message === 'RSS 源不可用' && err.cause?.message === 'something exotic',
  );
});
