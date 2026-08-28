import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { LIMITS } from './protocol.mjs';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeItem(value) {
  if (!isRecord(value)) return null;
  const guid = typeof value.id === 'string' ? value.id : '';
  if (!guid) return null;
  return {
    id: guid,
    feedId: typeof value.feedId === 'string' ? value.feedId : '',
    feedName: typeof value.feedName === 'string' ? value.feedName.slice(0, 80) : '',
    title: typeof value.title === 'string' ? value.title.slice(0, 300) : '',
    link: typeof value.link === 'string' ? value.link.slice(0, 2048) : '',
    pubDate: typeof value.pubDate === 'string' ? value.pubDate : null,
    contentSnippet: typeof value.contentSnippet === 'string' ? value.contentSnippet.slice(0, 500) : '',
    thumbnail: typeof value.thumbnail === 'string' ? value.thumbnail.slice(0, 2048) : null,
    discoveredAt: typeof value.discoveredAt === 'string' ? value.discoveredAt : null,
  };
}

function sanitizeHistoryEntry(value) {
  if (!isRecord(value)) return null;
  if (typeof value.timestamp !== 'string' || !value.timestamp) return null;
  return {
    timestamp: value.timestamp,
    manual: value.manual === true,
    newCount: Number.isInteger(value.newCount) ? value.newCount : 0,
    checkedFeeds: Number.isInteger(value.checkedFeeds) ? value.checkedFeeds : 0,
    errors: Array.isArray(value.errors)
      ? value.errors
        .filter((entry) => isRecord(entry) && typeof entry.feed === 'string' && typeof entry.error === 'string')
        .map((entry) => ({ feed: entry.feed.slice(0, 80), error: entry.error.slice(0, 300) }))
        .slice(0, LIMITS.maxFeeds)
      : [],
  };
}

/**
 * Durable store for dsh-rss runtime state: the notified-guid dedup list,
 * the recent new items shown in the settings page, check history, and the
 * last-check timestamp. Separate from config.json so frequent check results
 * never rewrite user settings.
 */
export class RssStateStore {
  #path;
  #value = RssStateStore.empty();
  #queue = Promise.resolve();
  #logger;

  constructor(path, { logger = console } = {}) {
    this.#path = path;
    this.#logger = logger;
  }

  static empty() {
    return Object.freeze({
      version: 1,
      lastCheck: null,
      notifiedItems: [],
      recentItems: [],
      history: [],
    });
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.#path, 'utf8'));
      if (!isRecord(parsed)) throw new Error('dsh-rss-monitor state is invalid');
      this.#value = Object.freeze({
        version: 1,
        lastCheck: typeof parsed.lastCheck === 'string' ? parsed.lastCheck : null,
        notifiedItems: Array.isArray(parsed.notifiedItems)
          ? parsed.notifiedItems.filter((id) => typeof id === 'string').slice(-LIMITS.maxNotifiedItems)
          : [],
        recentItems: Array.isArray(parsed.recentItems)
          ? parsed.recentItems.map(sanitizeItem).filter(Boolean).slice(0, LIMITS.maxRecentItems)
          : [],
        history: Array.isArray(parsed.history)
          ? parsed.history.map(sanitizeHistoryEntry).filter(Boolean).slice(-LIMITS.maxHistoryEntries)
          : [],
      });
    } catch (error) {
      if (error?.code === 'ENOENT') {
        this.#value = RssStateStore.empty();
      } else {
        // A corrupted/unreadable state file must not brick the plugin: the
        // check history and dedup list reset, settings stay untouched.
        this.#logger?.warn?.(`[dsh-rss-monitor] state unreadable (${error?.message}); starting from empty state`);
        this.#value = RssStateStore.empty();
      }
    }
    return this;
  }

  get() {
    return structuredClone(this.#value);
  }

  async save(value) {
    if (!isRecord(value)) throw new Error('Refusing to persist invalid dsh-rss-monitor state');
    const normalized = Object.freeze({
      version: 1,
      lastCheck: typeof value.lastCheck === 'string' ? value.lastCheck : null,
      notifiedItems: Array.isArray(value.notifiedItems)
        ? value.notifiedItems.filter((id) => typeof id === 'string').slice(-LIMITS.maxNotifiedItems)
        : [],
      recentItems: Array.isArray(value.recentItems)
        ? value.recentItems.map(sanitizeItem).filter(Boolean).slice(0, LIMITS.maxRecentItems)
        : [],
      history: Array.isArray(value.history)
        ? value.history.map(sanitizeHistoryEntry).filter(Boolean).slice(-LIMITS.maxHistoryEntries)
        : [],
    });
    const operation = this.#queue.then(async () => {
      await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
      const temporary = `${this.#path}.tmp`;
      await writeFile(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
      await rename(temporary, this.#path);
      this.#value = normalized;
    });
    this.#queue = operation.then(() => undefined, () => undefined);
    await operation;
    return this.get();
  }
}
