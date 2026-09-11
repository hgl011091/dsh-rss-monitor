import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RssController } from '../src/controller.mjs';
import {
  createRssRpcHandler,
  installRssRpc,
} from '../src/rpc.mjs';
import {
  LIMITS,
  RSS_RPC_CHANNEL,
  RSS_RPC_ENDPOINTS as ENDPOINTS,
} from '../src/protocol.mjs';

function buildController(overrides = {}) {
  const statusPayload = {
    running: false,
    enabled: false,
    lastCheck: null,
    nextCheckAt: null,
    settings: { checkInterval: 5, enabled: false },
    feeds: [{ id: 'feed-a', name: 'A', url: 'https://a.com/feed', enabled: true, keywords: [], excludeKeywords: [] }],
    email: null,
    emailConfigured: false,
    recentItems: [],
    history: [],
    notifiedCount: 0,
  };
  const controller = {
    status: async () => ({ ...statusPayload }),
    testFeed: async ({ url }) => ({ title: 'T', description: 'D', itemsCount: 2, latestItem: { title: 'x', link: 'l', pubDate: null }, url }),
    saveFeed: async ({ feed }) => ({ feeds: [{ ...feed }] }),
    removeFeed: async ({ id }) => ({ feeds: id === 'feed-a' ? [] : statusPayload.feeds }),
    saveSettings: async ({ checkInterval = 5, enabled = false }) => ({ settings: { checkInterval, enabled }, running: enabled, nextCheckAt: null }),
    checkNow: async () => ({ newItems: [], errors: [], checkedFeeds: 1, lastCheck: null, recentItems: [], history: [] }),
    saveEmail: async () => ({ emailConfigured: true }),
    testEmail: async () => ({ ok: true }),
    removeEmail: async () => ({ email: null }),
    clearItems: async () => ({ ok: true }),
    clearHistory: async () => ({ ok: true }),
    ...overrides,
  };
  controller.handlers = () => ({
    [ENDPOINTS.status]: (payload) => controller.status(payload),
    [ENDPOINTS.feedTest]: (payload) => controller.testFeed(payload),
    [ENDPOINTS.feedSave]: (payload) => controller.saveFeed(payload),
    [ENDPOINTS.feedRemove]: (payload) => controller.removeFeed(payload),
    [ENDPOINTS.settingsSave]: (payload) => controller.saveSettings(payload),
    [ENDPOINTS.checkNow]: () => controller.checkNow(),
    [ENDPOINTS.emailSave]: (payload) => controller.saveEmail(payload),
    [ENDPOINTS.emailTest]: () => controller.testEmail(),
    [ENDPOINTS.emailRemove]: () => controller.removeEmail(),
    [ENDPOINTS.itemsClear]: () => controller.clearItems(),
    [ENDPOINTS.historyClear]: () => controller.clearHistory(),
  });
  return { controller, statusPayload };
}

test('createRssRpcHandler returns the dsh-im envelope for success and failure', async () => {
  const { controller } = buildController();
  const handler = createRssRpcHandler(controller);
  const ok = await handler(ENDPOINTS.status, {}, undefined);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.feeds.length, 1);
  assert.equal(ok.value.enabled, false);

  const bad = await handler('nope.endpoint', {}, undefined);
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, 'bad-request');
  assert.deepEqual(bad.error.details, { issues: [] });

  const badPayload = await handler(ENDPOINTS.status, [], undefined);
  assert.equal(badPayload.ok, false);
  assert.equal(badPayload.error.code, 'bad-request');

  const nullPayload = await handler(ENDPOINTS.status, null, undefined);
  assert.equal(nullPayload.ok, false);

  const stringPayload = await handler(ENDPOINTS.status, 'status', undefined);
  assert.equal(stringPayload.ok, false);

  const aborted = await handler(ENDPOINTS.status, {}, { aborted: true });
  assert.equal(aborted.ok, false);
  assert.equal(aborted.error.code, 'cancelled');
  assert.deepEqual(aborted.error.details, {});
});

test('createRssRpcHandler maps thrown errors into transport-legal envelopes', async () => {
  const coded = new Error('RSS 源不存在');
  coded.code = 'feed-not-found';
  const { controller } = buildController({
    removeFeed: async () => {
      throw coded;
    },
  });
  const handler = createRssRpcHandler(controller);
  const result = await handler(ENDPOINTS.feedRemove, { id: 'nope' }, undefined);
  assert.equal(result.ok, false);
  // Custom codes are not in the transport's discriminated union; the generic
  // `internal` branch (details required) is the only legal catch-all.
  assert.equal(result.error.code, 'internal');
  assert.deepEqual(result.error.details, {});
  assert.equal(result.error.message, 'RSS 源不存在');

  const { controller: plain } = buildController({
    checkNow: async () => {
      throw new Error('boom');
    },
  });
  const plainResult = await createRssRpcHandler(plain)(ENDPOINTS.checkNow, {}, undefined);
  assert.equal(plainResult.ok, false);
  assert.equal(plainResult.error.code, 'internal');
  assert.equal(plainResult.error.message, 'boom');

  const { controller: junk } = buildController({
    status: async () => {
      throw 'not-an-error';
    },
  });
  const junkResult = await createRssRpcHandler(junk)(ENDPOINTS.status, {}, undefined);
  assert.equal(junkResult.ok, false);
  assert.equal(junkResult.error.code, 'internal');
  assert.equal(junkResult.error.message, 'RSS 监控操作失败，请稍后重试。');
});

test('handler rejects non-record payloads and keeps cancellation first', async () => {
  const { controller } = buildController();
  const handler = createRssRpcHandler(controller);
  const undefinedPayload = await handler(ENDPOINTS.status, undefined, undefined);
  assert.equal(undefinedPayload.ok, false);
  const abortedUnknown = await handler('unknown', {}, { aborted: true });
  assert.equal(abortedUnknown.error.code, 'cancelled');
});

test('installRssRpc mounts one exact /api Fetch route per endpoint', () => {
  const { controller } = buildController();
  const routes = [];
  const ctx = {
    connection: {
      fetch: {
        register: (route) => {
          routes.push(route);
          return () => {
            const index = routes.indexOf(route);
            if (index >= 0) routes.splice(index, 1);
          };
        },
      },
    },
  };
  const dispose = installRssRpc(ctx, controller);
  assert.equal(routes.length, Object.keys(ENDPOINTS).length);
  assert.equal(routes.length, 11);
  for (const route of routes) {
    assert.match(route.path, /^\/api\/dsh-rss-monitor\.[A-Za-z0-9_$.~-]+$/);
    assert.deepEqual(route.methods, ['POST']);
    assert.equal(route.requestBodyMode, 'buffered');
    assert.equal(typeof route.fetch, 'function');
  }
  dispose();
  assert.equal(routes.length, 0);
});

test('installRssRpc routes answer standard client-request envelopes on /api', async () => {
  const { controller } = buildController();
  const routes = [];
  const ctx = {
    connection: {
      fetch: {
        register: (route) => {
          routes.push(route);
          return () => {};
        },
      },
    },
  };
  installRssRpc(ctx, controller);
  const route = routes.find((entry) => entry.path === '/api/dsh-rss-monitor.status');
  const url = 'http://127.0.0.1:43120/api/dsh-rss-monitor.status';
  const call = (body) => route.fetch(new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));

  const ok = await call({ type: 'client-request', rpcId: 'rpc-1', method: 'dsh-rss-monitor.status', payload: {} });
  assert.equal(ok.status, 200);
  const envelope = await ok.json();
  assert.equal(envelope.type, 'server-response');
  assert.equal(envelope.rpcId, 'rpc-1');
  assert.equal(envelope.result.ok, true);
  assert.equal(envelope.result.value.feeds.length, 1);

  // Method sent to the wrong route: rejected before dispatch.
  const mismatched = await call({ type: 'client-request', rpcId: 'rpc-2', method: 'other.status', payload: {} });
  assert.equal(mismatched.status, 400);

  // Non-JSON body: rejected before dispatch.
  const junk = await route.fetch(new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  }));
  assert.equal(junk.status, 400);

  // A namespaced method on its own route dispatches across endpoints too.
  const saveRoute = routes.find((entry) => entry.path === '/api/dsh-rss-monitor.feed.save');
  const dispatched = await saveRoute.fetch(new Request('http://127.0.0.1:43120/api/dsh-rss-monitor.feed.save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'rpc-3', method: 'dsh-rss-monitor.feed.save', payload: { feed: { id: 'x' } } }),
  }));
  assert.equal(dispatched.status, 200);
  const saved = await dispatched.json();
  assert.equal(saved.result.ok, true);
});

test('the RPC namespace stays out of the reserved /api identity', () => {
  assert.equal(RSS_RPC_CHANNEL, '/dsh-rss-monitor');
  assert.match(RSS_RPC_CHANNEL, /^\/[A-Za-z0-9._~-]+$/, 'channel must satisfy the Harness pattern');
  assert.notEqual(RSS_RPC_CHANNEL, '/api');
  assert.ok(LIMITS.smtpPassRefPattern.source.endsWith('{24}$'), 'passRef pattern must require 24 hex chars');
});

test('RssController.assertComplete validates the full surface', () => {
  const { controller } = buildController();
  assert.equal(RssController.assertComplete(controller), controller);
  for (const method of ['status', 'saveFeed', 'removeFeed', 'checkNow', 'saveEmail', 'clearHistory']) {
    const broken = { ...controller };
    delete broken[method];
    assert.throws(() => RssController.assertComplete(broken), new RegExp(`requires ${method}\\(\\)`));
  }
  assert.throws(() => RssController.assertComplete(null), /requires status\(\)/);
});

test('endpoint table covers the documented management surface', () => {
  const { controller } = buildController();
  const handlers = controller.handlers();
  const expected = Object.values(ENDPOINTS);
  assert.equal(Object.keys(handlers).length, expected.length);
  for (const endpoint of expected) {
    assert.equal(typeof handlers[endpoint], 'function', `missing handler for ${endpoint}`);
  }
  assert.equal(expected.length, 11);
});
