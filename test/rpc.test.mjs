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

test('installRssRpc registers the handler with loopback authority by default', () => {
  const { controller } = buildController();
  const calls = [];
  const ctx = {
    connection: {
      rpc: {
        handle: (channel, handler, options) => {
          calls.push({ channel, handler, options });
          return () => calls.pop();
        },
      },
    },
  };
  const dispose = installRssRpc(ctx, controller);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].channel, RSS_RPC_CHANNEL);
  assert.deepEqual(calls[0].options, { authority: 'loopback' });
  assert.equal(typeof calls[0].handler, 'function');
  dispose();
  assert.equal(calls.length, 0);
});

test('installRssRpc forwards a custom authority and rejects reserved channels', () => {
  const { controller } = buildController();
  const calls = [];
  const ctx = {
    connection: {
      rpc: {
        handle: (channel, handler, options) => {
          calls.push({ channel, options });
          return () => {};
        },
      },
    },
  };
  installRssRpc(ctx, controller, { authority: 'trusted-host' });
  assert.deepEqual(calls[0].options, { authority: 'trusted-host' });
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
