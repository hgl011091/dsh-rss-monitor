/**
 * dsh-rss shared protocol.
 *
 * This module is the single source of truth for the RPC channel name, endpoint
 * identifiers, and data normalization rules. It is bundled into both the Host
 * bundle (lib/index.js) and the Client bundle (lib/client.js), mirroring the
 * dsh-im approach of sharing a protocol module between both sides.
 */

export const RSS_PROTOCOL_VERSION = 'dsh-rss-monitor.v1';

// Channel names must match the Harness connection service pattern
// /^\/[A-Za-z0-9._~-]+$/ (leading slash; "/api" is reserved).
export const RSS_RPC_CHANNEL = '/dsh-rss-monitor';

export const RSS_RPC_ENDPOINTS = Object.freeze({
  status: 'status',
  feedTest: 'feed.test',
  feedSave: 'feed.save',
  feedRemove: 'feed.remove',
  settingsSave: 'settings.save',
  checkNow: 'check.now',
  emailSave: 'email.save',
  emailTest: 'email.test',
  emailRemove: 'email.remove',
  itemsClear: 'items.clear',
  historyClear: 'history.clear',
});

export const LIMITS = Object.freeze({
  maxFeeds: 100,
  maxFeedNameLength: 80,
  maxUrlLength: 2048,
  maxKeywordCount: 20,
  maxKeywordLength: 60,
  minCheckIntervalMinutes: 1,
  maxCheckIntervalMinutes: 1440,
  maxNotifiedItems: 1000,
  maxRecentItems: 100,
  maxHistoryEntries: 50,
  maxEmailFieldLength: 254,
  maxDisplayRows: 100,
  smtpPassRefPattern: /^DSH_RSS_SMTP_PASS_[A-F0-9]{24}$/,
});

export const DEFAULT_SETTINGS = Object.freeze({
  checkInterval: 5,
  enabled: false,
});

export const DEFAULT_DISPLAY = Object.freeze({
  recentItems: 10,
  historyItems: 10,
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKeywordList(value, limit) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const output = [];
  for (const raw of value) {
    const keyword = cleanString(raw);
    if (!keyword || keyword.length > LIMITS.maxKeywordLength) return null;
    if (!output.includes(keyword)) output.push(keyword);
    if (output.length > limit) return null;
  }
  return output;
}

export function randomId() {
  return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalize a feed definition. Returns a frozen feed object, or null when the
 * input is invalid. `id` is optional on create; a stable id is generated.
 */
export function normalizeFeed(value, { generateId = randomId } = {}) {
  if (!isRecord(value)) return null;
  const name = cleanString(value.name);
  const url = cleanString(value.url);
  if (!name || name.length > LIMITS.maxFeedNameLength) return null;
  if (!url || url.length > LIMITS.maxUrlLength) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const keywords = normalizeKeywordList(value.keywords, LIMITS.maxKeywordCount);
  const excludeKeywords = normalizeKeywordList(value.excludeKeywords, LIMITS.maxKeywordCount);
  if (keywords === null || excludeKeywords === null) return null;
  const id = cleanString(value.id) || generateId();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(id)) return null;
  return Object.freeze({
    id,
    name,
    url,
    enabled: value.enabled === undefined ? true : value.enabled === true,
    keywords,
    excludeKeywords,
  });
}

/** Normalize the full feeds array; returns null when any entry is invalid. */
export function normalizeFeeds(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  if (value.length > LIMITS.maxFeeds) return null;
  const feeds = [];
  const seen = new Set();
  for (const raw of value) {
    const feed = normalizeFeed(raw);
    if (!feed) return null;
    if (seen.has(feed.id)) return null;
    if (feeds.some((other) => other.url === feed.url)) return null;
    seen.add(feed.id);
    feeds.push(feed);
  }
  return Object.freeze(feeds);
}

/** Normalize monitor settings. Returns null when invalid. */
export function normalizeSettings(value) {
  const base = isRecord(value) ? value : {};
  const interval = Number(base.checkInterval ?? DEFAULT_SETTINGS.checkInterval);
  if (!Number.isInteger(interval)
    || interval < LIMITS.minCheckIntervalMinutes
    || interval > LIMITS.maxCheckIntervalMinutes) {
    return null;
  }
  const enabled = base.enabled === undefined ? DEFAULT_SETTINGS.enabled : base.enabled === true;
  return Object.freeze({ checkInterval: interval, enabled });
}

/**
 * Normalize the display row counts for recent items and check history.
 * Lenient by design: numeric strings are accepted and out-of-range values
 * are clamped, so the settings inputs never hard-fail.
 */
export function normalizeDisplay(value) {
  const base = isRecord(value) ? value : {};
  const clamp = (raw, fallback) => {
    const parsed = Math.trunc(Number(raw));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(LIMITS.maxDisplayRows, Math.max(1, parsed));
  };
  return Object.freeze({
    recentItems: clamp(base.recentItems ?? DEFAULT_DISPLAY.recentItems, DEFAULT_DISPLAY.recentItems),
    historyItems: clamp(base.historyItems ?? DEFAULT_DISPLAY.historyItems, DEFAULT_DISPLAY.historyItems),
  });
}

/**
 * Normalize the email configuration. `pass` never lives in the config file:
 * the SMTP password is stored in the Harness credential store and referenced
 * by `passRef`. Returns null when invalid.
 */
export function normalizeEmailConfig(value) {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return null;
  const host = cleanString(value.host);
  const user = cleanString(value.user);
  const to = cleanString(value.to);
  if (!host || host.length > LIMITS.maxEmailFieldLength) return null;
  if (!to || to.length > LIMITS.maxEmailFieldLength) return null;
  const port = Number(value.port ?? 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const from = cleanString(value.from);
  if (from.length > LIMITS.maxEmailFieldLength) return null;
  const passRef = cleanString(value.passRef);
  if (passRef && !LIMITS.smtpPassRefPattern.test(passRef)) return null;
  return Object.freeze({
    host,
    port,
    secure: value.secure === undefined ? port === 465 : value.secure === true,
    user,
    from,
    to,
    ...(passRef ? { passRef } : {}),
  });
}

/**
 * Full config normalization used by the config store:
 * { version, settings, feeds, email }.
 */
export function normalizeConfig(value) {
  if (!isRecord(value)) return null;
  const settings = normalizeSettings(value.settings ?? DEFAULT_SETTINGS);
  const feeds = normalizeFeeds(value.feeds ?? []);
  if (!settings || feeds === null) return null;
  let email = null;
  if (value.email !== undefined && value.email !== null) {
    email = normalizeEmailConfig(value.email);
    if (!email) return null;
  }
  return Object.freeze({
    version: 1,
    settings,
    feeds,
    email,
    display: normalizeDisplay(value.display),
  });
}

/** Client-side shape guard for status payloads returned by the Host. */
export function normalizeStatus(value) {
  if (!isRecord(value)) {
    return {
      version: RSS_PROTOCOL_VERSION,
      running: false,
      enabled: false,
      lastCheck: null,
      nextCheckAt: null,
      settings: { ...DEFAULT_SETTINGS },
      feeds: [],
      email: null,
      emailConfigured: false,
      display: { ...DEFAULT_DISPLAY },
      recentItems: [],
      history: [],
      notifiedCount: 0,
    };
  }
  const settings = isRecord(value.settings) ? value.settings : {};
  return {
    version: typeof value.version === 'string' ? value.version : RSS_PROTOCOL_VERSION,
    running: value.running === true,
    enabled: value.enabled === true,
    lastCheck: typeof value.lastCheck === 'string' ? value.lastCheck : null,
    nextCheckAt: typeof value.nextCheckAt === 'string' ? value.nextCheckAt : null,
    settings: {
      checkInterval: Number.isInteger(settings.checkInterval)
        ? settings.checkInterval
        : DEFAULT_SETTINGS.checkInterval,
      enabled: settings.enabled === true,
    },
    feeds: Array.isArray(value.feeds) ? value.feeds : [],
    email: isRecord(value.email) ? value.email : null,
    emailConfigured: value.emailConfigured === true,
    display: normalizeDisplay(value.display),
    recentItems: Array.isArray(value.recentItems) ? value.recentItems : [],
    history: Array.isArray(value.history) ? value.history : [],
    notifiedCount: Number.isInteger(value.notifiedCount) ? value.notifiedCount : 0,
  };
}
