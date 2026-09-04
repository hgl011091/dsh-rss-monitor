import { createHash } from 'node:crypto';

import { LIMITS } from './protocol.mjs';
import { inScheduleWindow } from './schedule-window.mjs';

/**
 * Stable dedup id for a feed item, matching the rss-video-monitor scheme:
 * md5(feedUrl|item.guid||item.link||item.title) truncated to 16 hex chars.
 * Falls back through the fields so feeds without guids still dedup reliably.
 */
export function generateGuid(item, feedUrl) {
  const base = item?.guid || item?.link || item?.title || '';
  return createHash('md5').update(`${feedUrl}|${base}`).digest('hex').slice(0, 16);
}

/**
 * Keyword include/exclude filter against title + snippet, case-insensitive,
 * matching the rss-video-monitor semantics: an item passes when it matches at
 * least one include keyword (or there are none) and matches no exclude keyword.
 */
export function passesKeywordFilter(item, feed) {
  const title = (item.title || '').toLowerCase();
  const content = (item.contentSnippet || item.content || '').toLowerCase();
  const include = feed.keywords ?? [];
  const exclude = feed.excludeKeywords ?? [];
  if (exclude.some((keyword) => {
    const needle = keyword.toLowerCase();
    return title.includes(needle) || content.includes(needle);
  })) return false;
  if (include.length === 0) return true;
  return include.some((keyword) => {
    const needle = keyword.toLowerCase();
    return title.includes(needle) || content.includes(needle);
  });
}

/**
 * Periodic RSS monitor. Owns the check loop, dedup state, keyword filtering,
 * and history bookkeeping. External effects (feed fetching, email delivery)
 * are injected so the whole lifecycle is testable without network access.
 */
export class RssMonitor {
  #configStore;
  #stateStore;
  #fetchFeed;
  #notify;
  #logger;
  #now;
  #setInterval;
  #clearInterval;
  #setTimeout;
  #clearTimeout;
  #concurrency;
  #onStateChanged;
  #timer = null;
  #startDelayTimer = null;
  #nextCheckAt = null;
  #checking = null;
  #stopped = true;

  constructor({
    configStore,
    stateStore,
    fetchFeed,
    notify,
    logger = console,
    now = () => new Date().toISOString(),
    schedule = {},
    concurrency = 3,
    onStateChanged,
  } = {}) {
    if (typeof fetchFeed !== 'function') throw new TypeError('RssMonitor requires fetchFeed()');
    this.#configStore = configStore;
    this.#stateStore = stateStore;
    this.#fetchFeed = fetchFeed;
    this.#notify = typeof notify === 'function' ? notify : null;
    this.#logger = logger;
    this.#now = now;
    this.#concurrency = Math.max(1, Math.min(8, concurrency));
    this.#onStateChanged = typeof onStateChanged === 'function' ? onStateChanged : null;
    this.#setInterval = schedule.setInterval ?? ((fn, ms) => {
      const timer = setInterval(fn, ms);
      timer?.unref?.();
      return timer;
    });
    this.#clearInterval = schedule.clearInterval ?? ((timer) => clearInterval(timer));
    this.#setTimeout = schedule.setTimeout ?? ((fn, ms) => {
      const timer = setTimeout(fn, ms);
      timer?.unref?.();
      return timer;
    });
    this.#clearTimeout = schedule.clearTimeout ?? ((timer) => clearTimeout(timer));
  }

  isRunning() {
    return !this.#stopped && this.#timer !== null;
  }

  getNextCheckAt() {
    return this.isRunning() ? this.#nextCheckAt : null;
  }

  /** Start (or re-arm) the periodic loop. Performs an initial check shortly after start. */
  start({ immediate = true } = {}) {
    const settings = this.#configStore.get()?.settings;
    if (!settings?.enabled) return false;
    // The schedule window is a no-op when the feature is off or invalid; the
    // exact return value is intentionally lost — the monitor must still arm
    // the timer so it can fire once the next window opens.
    this.#stopped = false;
    this.#armTimer(settings.checkInterval);
    if (immediate) {
      this.#clearTimeout(this.#startDelayTimer);
      this.#startDelayTimer = this.#setTimeout(() => {
        this.#startDelayTimer = null;
        this.checkNow(false).catch((error) => {
          this.#logger?.error?.('[dsh-rss-monitor] initial check failed', error);
        });
      }, 3_000);
    }
    return true;
  }

  /** Stop the loop. In-flight checks finish; no new checks are scheduled. */
  stop() {
    this.#stopped = true;
    this.#clearInterval(this.#timer);
    this.#timer = null;
    this.#clearTimeout(this.#startDelayTimer);
    this.#startDelayTimer = null;
    this.#nextCheckAt = null;
  }

  /** Re-arm after settings changed; starts when enabled, stops when disabled. */
  applySettings(settings) {
    if (settings?.enabled) {
      this.#stopped = false;
      this.#armTimer(settings.checkInterval);
      return true;
    }
    this.stop();
    return false;
  }

  #armTimer(intervalMinutes) {
    this.#clearInterval(this.#timer);
    this.#timer = null;
    // Defense in depth: a NaN/undefined interval would make setInterval fire
    // as fast as possible. normalizeSettings guarantees an integer, but never
    // trust callers.
    const minutes = Math.max(1, Math.min(1440, Number(intervalMinutes) || 1));
    const intervalMs = minutes * 60_000;
    this.#nextCheckAt = new Date(Date.now() + intervalMs).toISOString();
    this.#timer = this.#setInterval(() => {
      this.checkNow(false).catch((error) => {
        this.#logger?.error?.('[dsh-rss-monitor] scheduled check failed', error);
      });
    }, intervalMs);
  }

  /**
   * Run one check across all enabled feeds with bounded concurrency.
   * Returns { newItems, errors, checkedFeeds }. Concurrent calls share the
   * in-flight check promise (identity-stable by design).
   */
  checkNow(manual = false) {
    if (this.#checking) return this.#checking;
    this.#checking = this.#runCheck(manual).finally(() => {
      this.#checking = null;
    });
    return this.#checking;
  }

  async #runCheck(manual) {
    const config = this.#configStore.get();
    const state = this.#stateStore.get();
    const settings = config?.settings;
    // The schedule window is checked on every tick rather than gating `start()`
    // because `setInterval` may straddle a window boundary; the check itself
    // is the single source of truth. Manual triggers always run regardless.
    if (manual !== true && !inScheduleWindow(settings?.schedule, new Date())) {
      return { newItems: [], errors: [], checkedFeeds: 0, skipped: 'out-of-window' };
    }
    const feeds = (config?.feeds ?? []).filter((feed) => feed.enabled);
    const notified = new Set(state.notifiedItems);
    const newItems = [];
    const errors = [];
    const timestamp = this.#now();

    const results = await this.#runBounded(feeds, async (feed) => {
      try {
        const items = await this.#fetchFeed(feed.url);
        for (const item of items) {
          const guid = generateGuid(item, feed.url);
          if (notified.has(guid)) continue;
          if (!passesKeywordFilter(item, feed)) continue;
          notified.add(guid);
          newItems.push({
            id: guid,
            feedId: feed.id,
            feedName: feed.name,
            // Cap free-form feed text so the state file and every status poll
            // stay bounded no matter what a feed publishes.
            title: (item.title || '(untitled)').slice(0, 300),
            link: (item.link || '').slice(0, 2048),
            pubDate: item.pubDate ?? null,
            contentSnippet: (item.contentSnippet || '').slice(0, 500),
            thumbnail: (item.thumbnail ?? null)?.slice(0, 2048) ?? null,
            discoveredAt: timestamp,
          });
        }
        return null;
      } catch (error) {
        const message = error?.message || '未知错误';
        this.#logger?.warn?.(`[dsh-rss-monitor] feed check failed: ${feed.name}: ${message}`);
        return { feed: feed.name, error: message };
      }
    });

    for (const result of results) {
      if (result) errors.push(result);
    }

    const updatedState = {
      lastCheck: timestamp,
      notifiedItems: [...notified].slice(-LIMITS.maxNotifiedItems),
      recentItems: [...newItems, ...state.recentItems].slice(0, LIMITS.maxRecentItems),
      history: [
        {
          timestamp,
          manual: manual === true,
          newCount: newItems.length,
          checkedFeeds: feeds.length,
          errors,
        },
        ...state.history,
      ].slice(0, LIMITS.maxHistoryEntries),
    };
    await this.#stateStore.save(updatedState);
    // Notify the controller so it can invalidate its cached status
    // payload. The periodic check bypasses the controller's RPC
    // handlers (it runs on the monitor's own setInterval), so without
    // this callback the next status() call would return a stale
    // snapshot until a user action (save feed, save settings) happened
    // to flip a dirty flag.
    try { this.#onStateChanged?.(); } catch (error) {
      this.#logger?.warn?.('[dsh-rss-monitor] onStateChanged callback failed', error);
    }

    if (newItems.length > 0 && this.#notify) {
      try {
        await this.#notify(newItems);
      } catch (error) {
        this.#logger?.error?.('[dsh-rss-monitor] notification delivery failed', error);
      }
    }

    return { newItems, errors, checkedFeeds: feeds.length };
  }

  /** Run `worker` over `items` with at most #concurrency in flight. */
  async #runBounded(items, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(this.#concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index]);
      }
    });
    await Promise.all(runners);
    return results;
  }
}
