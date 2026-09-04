import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_SETTINGS,
  LIMITS,
  normalizeConfig,
  normalizeEmailConfig,
  normalizeFeed,
  normalizeFeeds,
  normalizeSchedule,
  normalizeSettings,
  normalizeStatus,
  randomId,
  RSS_PROTOCOL_VERSION,
  RSS_RPC_CHANNEL,
  RSS_RPC_ENDPOINTS,
} from '../src/protocol.mjs';

test('RSS_RPC_CHANNEL matches the Harness channel pattern', () => {
  assert.equal(RSS_RPC_CHANNEL, '/dsh-rss-monitor');
  assert.match(RSS_RPC_CHANNEL, /^\/[A-Za-z0-9._~-]+$/);
  assert.notEqual(RSS_RPC_CHANNEL, '/api');
  assert.equal(RSS_PROTOCOL_VERSION, 'dsh-rss-monitor.v1');
  assert.ok(Object.isFrozen(RSS_RPC_ENDPOINTS));
  assert.ok(Object.isFrozen(LIMITS));
  assert.deepEqual(DEFAULT_SETTINGS, { checkInterval: 5, enabled: false, schedule: null });
});

test('normalizeFeed accepts a valid feed and fills defaults', () => {
  const feed = normalizeFeed({ name: '少数派', url: 'https://sspai.com/feed' });
  assert.ok(feed);
  assert.equal(feed.name, '少数派');
  assert.equal(feed.url, 'https://sspai.com/feed');
  assert.equal(feed.enabled, true);
  assert.deepEqual(feed.keywords, []);
  assert.deepEqual(feed.excludeKeywords, []);
  assert.match(feed.id, /^f[0-9a-z]+/);
  assert.ok(Object.isFrozen(feed));
});

test('normalizeFeed keeps a provided id, keywords, and enabled=false', () => {
  const feed = normalizeFeed({
    id: 'sspai',
    name: ' 少数派 ',
    url: 'https://sspai.com/feed',
    enabled: false,
    keywords: [' AI ', '模型', 'AI'],
    excludeKeywords: ['广告'],
  });
  assert.ok(feed);
  assert.equal(feed.id, 'sspai');
  assert.equal(feed.name, '少数派');
  assert.equal(feed.enabled, false);
  assert.deepEqual(feed.keywords, ['AI', '模型']);
  assert.deepEqual(feed.excludeKeywords, ['广告']);
});

test('normalizeFeed rejects invalid input', () => {
  assert.equal(normalizeFeed(null), null);
  assert.equal(normalizeFeed('feed'), null);
  assert.equal(normalizeFeed({ name: '', url: 'https://a.com' }), null);
  assert.equal(normalizeFeed({ name: 'x'.repeat(LIMITS.maxFeedNameLength + 1), url: 'https://a.com' }), null);
  assert.equal(normalizeFeed({ name: 'n', url: 'not a url' }), null);
  assert.equal(normalizeFeed({ name: 'n', url: 'ftp://a.com/feed' }), null);
  assert.equal(normalizeFeed({ name: 'n', url: 'https://a.com', keywords: 'ai' }), null);
  assert.equal(normalizeFeed({ name: 'n', url: 'https://a.com', keywords: [''] }), null);
  assert.equal(normalizeFeed({ name: 'n', url: 'https://a.com', id: 'bad id!' }), null);
  const tooLongUrl = `https://a.com/${'x'.repeat(LIMITS.maxUrlLength)}`;
  assert.equal(normalizeFeed({ name: 'n', url: tooLongUrl }), null);
  const tooManyKeywords = Array.from({ length: LIMITS.maxKeywordCount + 1 }, (_, i) => `k${i}`);
  assert.equal(normalizeFeed({ name: 'n', url: 'https://a.com', keywords: tooManyKeywords }), null);
});

test('randomId produces stable-shaped unique ids', () => {
  const a = randomId();
  const b = randomId();
  assert.notEqual(a, b);
  assert.ok(normalizeFeed({ id: a, name: 'n', url: 'https://a.com' }));
});

test('normalizeFeeds validates the whole list', () => {
  assert.deepEqual(normalizeFeeds(undefined), []);
  assert.equal(normalizeFeeds('nope'), null);
  assert.equal(normalizeFeeds([{ name: 'n', url: 'https://a.com' }, { name: 'n', url: 'https://a.com' }]), null);
  const first = normalizeFeed({ name: 'n', url: 'https://a.com' });
  const second = normalizeFeed({ name: 'm', url: 'https://b.com' });
  const list = normalizeFeeds([first, { ...second, id: first.id }]);
  assert.equal(list, null);
  const ok = normalizeFeeds([first, second]);
  assert.equal(ok.length, 2);
  const tooMany = Array.from({ length: LIMITS.maxFeeds + 1 }, (_, i) => ({
    name: `f${i}`,
    url: `https://f${i}.com/feed`,
  }));
  assert.equal(normalizeFeeds(tooMany), null);
});

test('normalizeSettings clamps nothing and rejects out-of-range intervals', () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ checkInterval: 30, enabled: true }),
    { checkInterval: 30, enabled: true, schedule: null });
  assert.equal(normalizeSettings({ checkInterval: 0 }), null);
  assert.equal(normalizeSettings({ checkInterval: 1441 }), null);
  assert.equal(normalizeSettings({ checkInterval: 2.5 }), null);
  assert.deepEqual(normalizeSettings({ checkInterval: '5' }),
    { checkInterval: 5, enabled: false, schedule: null });
  assert.equal(normalizeSettings({ checkInterval: 'abc' }), null);
  assert.deepEqual(normalizeSettings({ checkInterval: LIMITS.maxCheckIntervalMinutes }), {
    checkInterval: LIMITS.maxCheckIntervalMinutes,
    enabled: false,
    schedule: null,
  });
});

test('normalizeSchedule accepts valid weekly windows and defaults', () => {
  assert.equal(normalizeSchedule(undefined), null);
  assert.equal(normalizeSchedule(null), null);
  assert.equal(normalizeSchedule({}), null);
  const off = normalizeSchedule({ enabled: false, days: [1, 2], startTime: '09:00', endTime: '18:00' });
  assert.ok(off);
  assert.equal(off.enabled, false);
  assert.deepEqual([...off.days], [1, 2]);
  const on = normalizeSchedule({
    enabled: true, days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00', timezone: 'UTC',
  });
  assert.ok(on);
  assert.equal(on.enabled, true);
  assert.equal(on.startTime, '09:00');
  assert.equal(on.endTime, '18:00');
  assert.equal(on.timezone, 'UTC');
  // No days = every day; explicit empty array is allowed.
  const everyday = normalizeSchedule({ enabled: true, startTime: '00:00', endTime: '23:59' });
  assert.ok(everyday);
  assert.deepEqual([...everyday.days], []);
  assert.equal(everyday.timezone, 'system');
});

test('normalizeSchedule rejects malformed windows', () => {
  const tooManyDays = Array.from({ length: 8 }, (_, i) => i);
  assert.equal(normalizeSchedule({ enabled: true, days: tooManyDays }), null);
  assert.equal(normalizeSchedule({ enabled: true, days: [-1, 0] }), null);
  assert.equal(normalizeSchedule({ enabled: true, days: [7] }), null);
  assert.equal(normalizeSchedule({ enabled: true, days: [1.5] }), null);
  assert.equal(normalizeSchedule({ enabled: true, startTime: '24:00', endTime: '18:00' }), null);
  assert.equal(normalizeSchedule({ enabled: true, startTime: '9:00', endTime: '18:00' }), null);
  assert.equal(normalizeSchedule({ enabled: true, startTime: '09:60', endTime: '18:00' }), null);
  assert.equal(normalizeSchedule({ enabled: true, startTime: '09:00', endTime: '18:00', timezone: 'Not/AZone' }), null);
  assert.equal(normalizeSchedule({ enabled: true, startTime: '09:00', endTime: '18:00', timezone: 'a'.repeat(200) }), null);
  // Non-record payloads.
  assert.equal(normalizeSchedule('daily'), null);
  assert.equal(normalizeSchedule(42), null);
  assert.equal(normalizeSchedule([1, 2, 3]), null);
});

test('normalizeSettings routes a valid schedule through and rejects malformed schedules', () => {
  const withSchedule = normalizeSettings({
    checkInterval: 10,
    enabled: true,
    schedule: { enabled: true, days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' },
  });
  assert.ok(withSchedule);
  assert.equal(withSchedule.schedule.enabled, true);
  assert.equal(withSchedule.schedule.startTime, '09:00');
  // A malformed schedule must fail the whole settings payload so an invalid
  // window can never persist alongside a valid enabled flag.
  assert.equal(normalizeSettings({
    checkInterval: 10,
    enabled: true,
    schedule: { enabled: true, startTime: 'bad', endTime: '18:00' },
  }), null);
  // A null schedule clears it without breaking the rest of the payload.
  const cleared = normalizeSettings({ checkInterval: 10, enabled: true, schedule: null });
  assert.ok(cleared);
  assert.equal(cleared.schedule, null);
});

test('normalizeEmailConfig requires host and to, validates port and passRef', () => {
  assert.equal(normalizeEmailConfig(null), null);
  assert.equal(normalizeEmailConfig([]), null);
  assert.equal(normalizeEmailConfig({ host: 'smtp.a.com' }), null);
  assert.equal(normalizeEmailConfig({ to: 'me@a.com' }), null);
  const email = normalizeEmailConfig({ host: 'smtp.a.com', user: 'bot@a.com', to: 'me@a.com' });
  assert.ok(email);
  assert.equal(email.port, 465);
  assert.equal(email.secure, true);
  assert.equal(email.passRef, undefined);
  const explicit = normalizeEmailConfig({
    host: 'smtp.a.com',
    port: 587,
    secure: false,
    user: 'bot@a.com',
    from: 'RSS <bot@a.com>',
    to: 'me@a.com',
    passRef: 'DSH_RSS_SMTP_PASS_ABCDEF01ABCDEF01ABCDEF01',
  });
  assert.ok(explicit);
  assert.equal(explicit.port, 587);
  assert.equal(explicit.secure, false);
  assert.equal(explicit.passRef, 'DSH_RSS_SMTP_PASS_ABCDEF01ABCDEF01ABCDEF01');
  assert.equal(normalizeEmailConfig({ host: 'smtp.a.com', to: 'me@a.com', port: 70000 }), null);
  assert.equal(normalizeEmailConfig({ host: 'smtp.a.com', to: 'me@a.com', port: 0 }), null);
  assert.equal(
    normalizeEmailConfig({ host: 'smtp.a.com', to: 'me@a.com', passRef: 'DSH_RSS_SMTP_PASS_short' }),
    null,
  );
  assert.equal(
    normalizeEmailConfig({ host: 'smtp.a.com', to: 'me@a.com', passRef: 'DSH_RSS_SMTP_PASS_ZZZZZZZZZZZZZZZZZZZZZZZZ' }),
    null,
  );
  assert.equal(
    normalizeEmailConfig({ host: 'smtp.a.com', to: 'x'.repeat(LIMITS.maxEmailFieldLength + 1) }),
    null,
  );
});

test('normalizeConfig wires the full document and rejects invalid parts', () => {
  const config = normalizeConfig({
    settings: { checkInterval: 10, enabled: true },
    feeds: [{ name: 'n', url: 'https://a.com' }],
    email: { host: 'smtp.a.com', to: 'me@a.com' },
  });
  assert.ok(config);
  assert.equal(config.version, 1);
  assert.equal(config.settings.checkInterval, 10);
  assert.equal(config.feeds.length, 1);
  assert.equal(config.email.host, 'smtp.a.com');
  assert.equal(normalizeConfig({ settings: { checkInterval: 0 } }), null);
  assert.equal(normalizeConfig({ feeds: [{ name: '' }] }), null);
  assert.equal(normalizeConfig({ email: { host: '' } }), null);
  assert.equal(normalizeConfig(null), null);
  const minimal = normalizeConfig({});
  assert.ok(minimal);
  assert.deepEqual(minimal.settings, DEFAULT_SETTINGS);
  assert.deepEqual(minimal.feeds, []);
  assert.equal(minimal.email, null);
});

test('normalizeStatus guards client payloads', () => {
  const empty = normalizeStatus(null);
  assert.equal(empty.running, false);
  assert.equal(empty.enabled, false);
  assert.equal(empty.version, RSS_PROTOCOL_VERSION);
  assert.deepEqual(empty.settings, DEFAULT_SETTINGS);
  assert.deepEqual(empty.feeds, []);
  assert.deepEqual(empty.recentItems, []);
  assert.deepEqual(empty.history, []);
  assert.equal(empty.emailConfigured, false);
  const junk = normalizeStatus({ version: 42, feeds: 'nope', settings: 'nope', notifiedCount: 'x' });
  assert.equal(junk.version, RSS_PROTOCOL_VERSION);
  assert.deepEqual(junk.feeds, []);
  assert.equal(junk.settings.checkInterval, 5);
  assert.equal(junk.notifiedCount, 0);
  const full = normalizeStatus({
    version: 'dsh-rss.v1',
    running: true,
    enabled: true,
    lastCheck: '2026-01-01T00:00:00.000Z',
    nextCheckAt: '2026-01-01T00:05:00.000Z',
    settings: { checkInterval: 5, enabled: true },
    feeds: [{ id: 'a', name: 'n', url: 'https://a.com', enabled: true, keywords: [], excludeKeywords: [] }],
    email: { host: 'smtp.a.com' },
    emailConfigured: true,
    recentItems: [],
    history: [],
    notifiedCount: 3,
  });
  assert.equal(full.running, true);
  assert.equal(full.nextCheckAt, '2026-01-01T00:05:00.000Z');
  assert.equal(full.feeds.length, 1);
  assert.equal(full.notifiedCount, 3);
});

test('normalizeStatus passes the schedule field through', () => {
  // Regression: the settings tab used to render the schedule toggle
  // from the client-side defaults (enabled: false) because normalizeStatus
  // silently dropped the schedule + scheduleActive fields, even though the
  // host returned them. The toggle then "auto-cancelled" after every save
  // and every view switch, because the client could never see what the
  // host had stored.
  const persisted = normalizeStatus({
    running: true,
    enabled: true,
    settings: {
      checkInterval: 5,
      enabled: true,
      schedule: {
        enabled: true,
        days: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '18:00',
        timezone: 'system',
      },
      scheduleActive: true,
    },
  });
  assert.equal(persisted.settings.schedule.enabled, true);
  assert.deepEqual(persisted.settings.schedule.days, [1, 2, 3, 4, 5]);
  assert.equal(persisted.settings.schedule.startTime, '09:00');
  assert.equal(persisted.settings.schedule.endTime, '18:00');
  assert.equal(persisted.settings.schedule.timezone, 'system');
  assert.equal(persisted.settings.scheduleActive, true);

  // When the host reports no schedule, the client must mirror that.
  const empty = normalizeStatus({
    running: false,
    enabled: false,
    settings: { checkInterval: 5, enabled: false },
  });
  assert.equal(empty.settings.schedule, null);
  assert.equal(empty.settings.scheduleActive, false);
});
