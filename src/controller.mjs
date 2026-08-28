import { randomUUID } from 'node:crypto';

import {
  DEFAULT_DISPLAY,
  LIMITS,
  normalizeDisplay,
  normalizeEmailConfig,
  normalizeFeed,
  normalizeSettings,
  RSS_RPC_ENDPOINTS as RSS_ENDPOINTS,
} from './protocol.mjs';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Newest first by publish time (fallback: discovery time); stable for ties. */
function newestFirst(a, b) {
  const at = Date.parse(a?.pubDate ?? a?.discoveredAt ?? '') || 0;
  const bt = Date.parse(b?.pubDate ?? b?.discoveredAt ?? '') || 0;
  return bt - at;
}

function newSmtpPassRef() {
  return `DSH_RSS_SMTP_PASS_${randomUUID().replaceAll('-', '').toUpperCase().slice(0, 24)}`;
}

/**
 * Business controller behind the dsh-rss-monitor RPC surface. Coordinates the
 * config store, state store, monitor, email notifier, and credential store.
 * All operations validate their input and never leak the SMTP password: the
 * browser only sees `emailConfigured` and non-secret fields.
 */
export class RssController {
  #configStore;
  #stateStore;
  #monitor;
  #notifier;
  #describeFeed;
  #credentials;
  #logger;
  #onChanged;

  constructor({
    configStore,
    stateStore,
    monitor,
    notifier,
    describeFeed,
    credentials,
    logger = console,
    onChanged,
  } = {}) {
    this.#configStore = configStore;
    this.#stateStore = stateStore;
    this.#monitor = monitor;
    this.#notifier = notifier;
    this.#describeFeed = typeof describeFeed === 'function' ? describeFeed : null;
    this.#credentials = credentials;
    this.#logger = logger;
    this.#onChanged = typeof onChanged === 'function' ? onChanged : null;
  }

  /** Restore the monitor after process start when it was enabled. */
  async initialize() {
    const config = this.#configStore.get();
    if (config?.settings?.enabled) {
      this.#monitor.start({ immediate: true });
      this.#logger?.info?.(`[dsh-rss-monitor] monitor restored, interval ${config.settings.checkInterval} min`);
    }
  }

  close() {
    this.#monitor.stop();
  }

  #emitChanged() {
    try {
      this.#onChanged?.();
    } catch (error) {
      this.#logger?.warn?.('[dsh-rss-monitor] onChanged callback failed', error);
    }
  }

  async status() {
    const config = this.#configStore.get();
    const state = this.#stateStore.get();
    const settings = config?.settings;
    const display = config?.display ?? DEFAULT_DISPLAY;
    return {
      running: this.#monitor.isRunning(),
      enabled: settings?.enabled === true,
      lastCheck: state?.lastCheck ?? null,
      nextCheckAt: this.#monitor.getNextCheckAt(),
      settings: {
        checkInterval: settings?.checkInterval ?? 5,
        enabled: settings?.enabled === true,
      },
      feeds: (config?.feeds ?? []).map((feed) => ({
        id: feed.id,
        name: feed.name,
        url: feed.url,
        enabled: feed.enabled,
        keywords: feed.keywords,
        excludeKeywords: feed.excludeKeywords,
      })),
      email: config?.email
        ? {
            host: config.email.host,
            port: config.email.port,
            secure: config.email.secure,
            user: config.email.user,
            from: config.email.from,
            to: config.email.to,
            passwordStored: Boolean(config.email.passRef),
          }
        : null,
      emailConfigured: this.#notifier.isConfigured(config?.email),
      // Row counts are display preferences; the dedup-list count below stays
      // the real notified-item total regardless of these settings. The state
      // copy from the store is already a private structuredClone, so sorting
      // in place is safe.
      display,
      recentItems: (state?.recentItems ?? []).sort(newestFirst).slice(0, display.recentItems),
      history: (state?.history ?? []).slice(0, display.historyItems),
      notifiedCount: state?.notifiedItems.length ?? 0,
    };
  }

  async testFeed({ url } = {}) {
    const cleaned = typeof url === 'string' ? url.trim() : '';
    if (!cleaned || cleaned.length > LIMITS.maxUrlLength || !/^https?:\/\//i.test(cleaned)) {
      const error = new Error('请输入有效的 http(s) RSS 地址');
      error.code = 'invalid-url';
      throw error;
    }
    if (!this.#describeFeed) {
      const error = new Error('RSS 测试功能未就绪');
      error.code = 'not-ready';
      throw error;
    }
    return this.#describeFeed(cleaned);
  }

  async saveFeed({ feed } = {}) {
    const normalized = normalizeFeed(feed);
    if (!normalized) {
      const error = new Error('RSS 源配置无效：请检查名称、URL 和关键词');
      error.code = 'invalid-feed';
      throw error;
    }
    const config = this.#configStore.get();
    const feeds = [...(config.feeds ?? [])];
    const index = feeds.findIndex((existing) => existing.id === normalized.id);
    if (index >= 0) {
      if (feeds.some((existing, at) => at !== index && existing.url === normalized.url)) {
        const error = new Error('已存在相同 URL 的 RSS 源');
        error.code = 'duplicate-feed';
        throw error;
      }
      feeds[index] = normalized;
    } else {
      if (feeds.some((existing) => existing.url === normalized.url)) {
        const error = new Error('已存在相同 URL 的 RSS 源');
        error.code = 'duplicate-feed';
        throw error;
      }
      if (feeds.length >= LIMITS.maxFeeds) {
        const error = new Error(`最多支持 ${LIMITS.maxFeeds} 个 RSS 源`);
        error.code = 'too-many-feeds';
        throw error;
      }
      feeds.push(normalized);
    }
    await this.#configStore.save({ ...config, feeds });
    this.#emitChanged();
    return { feeds: (await this.status()).feeds };
  }

  async removeFeed({ id } = {}) {
    const config = this.#configStore.get();
    const before = config.feeds ?? [];
    const feeds = before.filter((feed) => feed.id !== id);
    if (feeds.length === before.length) {
      const error = new Error('RSS 源不存在');
      error.code = 'feed-not-found';
      throw error;
    }
    await this.#configStore.save({ ...config, feeds });
    this.#emitChanged();
    return { feeds: (await this.status()).feeds };
  }

  async saveSettings({ checkInterval, enabled, display } = {}) {
    const config = this.#configStore.get();
    const current = config.settings;
    const settings = normalizeSettings({
      checkInterval: checkInterval ?? current.checkInterval,
      enabled: enabled ?? current.enabled,
    });
    if (!settings) {
      const error = new Error(`检查间隔必须是 ${LIMITS.minCheckIntervalMinutes}-${LIMITS.maxCheckIntervalMinutes} 分钟`);
      error.code = 'invalid-settings';
      throw error;
    }
    // Display rows merge over the stored values so partial updates (e.g. the
    // enabled-switch payload without a display field) keep them intact.
    const nextDisplay = normalizeDisplay(display === undefined ? config.display : { ...config.display, ...display });
    await this.#configStore.save({ ...config, settings, display: nextDisplay });
    this.#monitor.applySettings(settings);
    this.#emitChanged();
    return {
      settings,
      display: nextDisplay,
      running: this.#monitor.isRunning(),
      nextCheckAt: this.#monitor.getNextCheckAt(),
    };
  }

  async checkNow() {
    const result = await this.#monitor.checkNow(true);
    const state = this.#stateStore.get();
    return {
      ...result,
      lastCheck: state.lastCheck,
      recentItems: state.recentItems,
      history: state.history,
    };
  }

  /**
   * Save the SMTP configuration. When `pass` is a non-empty string it is
   * written to the credential store and referenced by `passRef`; when `pass`
   * is omitted or empty the previously stored password (if any) is kept.
   */
  async saveEmail(payload = {}) {
    if (!isRecord(payload)) {
      const error = new Error('邮件配置无效');
      error.code = 'invalid-email-config';
      throw error;
    }
    const config = this.#configStore.get();
    const existing = config.email;
    let passRef = existing?.passRef;
    const providingPassword = typeof payload.pass === 'string' && payload.pass.length > 0;
    if (providingPassword) {
      passRef = newSmtpPassRef();
      try {
        await this.#credentials?.set?.(passRef, payload.pass);
      } catch (error) {
        this.#logger?.error?.('[dsh-rss-monitor] failed to store smtp credential', error);
        const wrapped = new Error('SMTP 密码写入凭据存储失败');
        wrapped.code = 'credential-store-failed';
        throw wrapped;
      }
    }
    const email = normalizeEmailConfig({ ...payload, passRef: passRef ?? undefined });
    if (!email) {
      const error = new Error('邮件配置无效：请检查 SMTP 主机、端口和收件人');
      error.code = 'invalid-email-config';
      throw error;
    }
    await this.#configStore.save({ ...config, email });
    this.#emitChanged();
    return { emailConfigured: this.#notifier.isConfigured(email) };
  }

  async testEmail() {
    const config = this.#configStore.get();
    if (!config.email) {
      const error = new Error('尚未配置邮件通知');
      error.code = 'email-not-configured';
      throw error;
    }
    if (!config.email.passRef) {
      const error = new Error('尚未保存 SMTP 密码，请填写密码后保存');
      error.code = 'email-password-required';
      throw error;
    }
    try {
      await this.#notifier.sendTest(config.email);
    } catch (error) {
      // Belt and braces: even if something inside the notifier escapes the
      // retry wrap (e.g. a credential-store failure), the UI must only ever
      // see a concise message; per-attempt SMTP detail stays in the log.
      this.#logger?.warn?.('[dsh-rss-monitor] test email failed:', error);
      const short = new Error('发送失败');
      short.code = 'email-send-failed';
      short.cause = error;
      throw short;
    }
    return { ok: true };
  }

  async removeEmail() {
    const config = this.#configStore.get();
    const previous = config.email;
    if (!previous) return { email: null };
    if (previous.passRef) {
      try {
        await this.#credentials?.unset?.(previous.passRef);
      } catch (error) {
        this.#logger?.warn?.('[dsh-rss-monitor] failed to unset smtp credential', error);
      }
    }
    await this.#configStore.save({ ...config, email: null });
    this.#emitChanged();
    return { email: null };
  }

  async clearItems() {
    const state = this.#stateStore.get();
    await this.#stateStore.save({ ...state, notifiedItems: [], recentItems: [] });
    this.#emitChanged();
    return { ok: true };
  }

  async clearHistory() {
    const state = this.#stateStore.get();
    await this.#stateStore.save({ ...state, history: [] });
    this.#emitChanged();
    return { ok: true };
  }

  /** Endpoint dispatch table used by the RPC handler. */
  handlers() {
    return {
      [RSS_ENDPOINTS.status]: (payload) => this.status(),
      [RSS_ENDPOINTS.feedTest]: (payload) => this.testFeed(payload),
      [RSS_ENDPOINTS.feedSave]: (payload) => this.saveFeed(payload),
      [RSS_ENDPOINTS.feedRemove]: (payload) => this.removeFeed(payload),
      [RSS_ENDPOINTS.settingsSave]: (payload) => this.saveSettings(payload),
      [RSS_ENDPOINTS.checkNow]: () => this.checkNow(),
      [RSS_ENDPOINTS.emailSave]: (payload) => this.saveEmail(payload),
      [RSS_ENDPOINTS.emailTest]: () => this.testEmail(),
      [RSS_ENDPOINTS.emailRemove]: () => this.removeEmail(),
      [RSS_ENDPOINTS.itemsClear]: () => this.clearItems(),
      [RSS_ENDPOINTS.historyClear]: () => this.clearHistory(),
    };
  }

  /** Validate the controller surface once at construction time. */
  static assertComplete(controller) {
    for (const method of [
      'status', 'testFeed', 'saveFeed', 'removeFeed', 'saveSettings', 'checkNow',
      'saveEmail', 'testEmail', 'removeEmail', 'clearItems', 'clearHistory',
    ]) {
      if (typeof controller?.[method] !== 'function') {
        throw new TypeError(`dsh-rss-monitor controller requires ${method}()`);
      }
    }
    return controller;
  }
}
