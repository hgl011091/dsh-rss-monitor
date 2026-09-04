import Parser from 'rss-parser';

/**
 * Feed fetching built on rss-parser. `parseFeed` returns a normalized item
 * list so the monitor never touches parser internals. Injectable parser for
 * offline tests.
 */
export class FeedFetcher {
  #parser;

  constructor({ parser, timeoutMs = 30_000, userAgent } = {}) {
    if (parser) {
      this.#parser = parser;
      return;
    }
    this.#parser = new Parser({
      timeout: timeoutMs,
      headers: {
        'User-Agent': userAgent
          ?? 'Mozilla/5.0 (compatible; dsh-rss-monitor/0.1; +https://github.com/example/dsh-rss-monitor)',
      },
      customFields: {
        item: [
          ['media:thumbnail', 'mediaThumbnail'],
          ['media:content', 'mediaContent', { keepArray: false }],
        ],
      },
    });
  }

  /** Fetch and normalize one feed. Throws with a readable message on failure. */
  async parseFeed(url) {
    let feed;
    try {
      feed = await this.#parser.parseURL(url);
    } catch (error) {
      throw translateError(error);
    }
    const items = Array.isArray(feed.items) ? feed.items : [];
    return items.map((item) => ({
      guid: typeof item.guid === 'string' ? item.guid : '',
      title: typeof item.title === 'string' ? item.title.trim() : '',
      link: typeof item.link === 'string' ? item.link.trim() : '',
      pubDate: item.isoDate ?? item.pubDate ?? null,
      contentSnippet: typeof item.contentSnippet === 'string' ? item.contentSnippet : '',
      content: typeof item.content === 'string' ? item.content : '',
      thumbnail: extractThumbnail(item),
    }));
  }

  /** Fetch one feed and return its metadata plus the latest item, for tests. */
  async describe(url) {
    const feed = await this.#parser.parseURL(url);
    return describeFeed(feed, url);
  }
}

/**
 * Translate an rss-parser / undici / Node network error into a Chinese
 * message suitable for the DSH "check history" panel.
 *
 * The original rss-parser surfaces error messages in English
 * ("Request timed out after 30000ms", "Status code 429", "getaddrinfo
 * ENOTFOUND", "Parse error: Non-whitespace before first tag", ...).
 * DSH's history panel shows `error.message` verbatim, so users saw
 * English strings in a Chinese UI. This helper maps the common cases
 * to short Chinese labels and leaves the original message attached as
 * `cause` for log-side debugging.
 *
 * The mapping is best-effort: anything we cannot classify falls through
 * with a generic "RSS 源不可用" label + the original error attached,
 * so a malformed feed still reports something useful.
 */
export function translateError(error) {
  const raw = error?.message ?? '';
  const code = error?.code;
  const status = error?.response?.statusCode ?? error?.statusCode ?? null;

  // Timeout — the rss-parser error has no structured code, only a
  // message that contains the literal "timed out". The numeric timeout
  // (in ms) is recovered from the message so the user can tell whether
  // the configured 30s ceiling was hit.
  const timeoutMatch = /(\d+)\s*ms/i.exec(raw);
  if (/Request timed out/i.test(raw) || code === 'ECONNABORTED' || code === 'ABORT_ERR') {
    const seconds = timeoutMatch ? Math.round(Number(timeoutMatch[1]) / 1000) : null;
    const wrapped = new Error(seconds != null ? `超时（${seconds} 秒）` : '超时');
    wrapped.code = 'feed-timeout';
    wrapped.cause = error;
    return wrapped;
  }

  // HTTP status codes surfaced by undici (rss-parser's underlying
  // client) as `error.message === "Status code <NN>"` plus
  // `error.response.statusCode`. Translate the common ones to a
  // human-readable phrase; the numeric code is preserved in `code`.
  if (status != null) {
    const label = HTTP_STATUS_ZH[status] ?? `HTTP ${status}`;
    const wrapped = new Error(label);
    wrapped.code = `http-${status}`;
    wrapped.cause = error;
    return wrapped;
  }
  const httpStatusMatch = /Status code\s+(\d{3})/i.exec(raw);
  if (httpStatusMatch) {
    const n = Number(httpStatusMatch[1]);
    const label = HTTP_STATUS_ZH[n] ?? `HTTP ${n}`;
    const wrapped = new Error(label);
    wrapped.code = `http-${n}`;
    wrapped.cause = error;
    return wrapped;
  }

  // Node-style network error codes set on `error.code`. The pattern
  // (`code: 'XXX'`) appears in the raw message too, but the structured
  // field is the canonical source.
  if (code && NETWORK_CODE_ZH[code]) {
    const wrapped = new Error(NETWORK_CODE_ZH[code]);
    wrapped.code = code;
    wrapped.cause = error;
    return wrapped;
  }
  for (const [pattern, label] of NETWORK_MSG_PATTERNS) {
    if (pattern.test(raw)) {
      const wrapped = new Error(label);
      wrapped.code = code ?? 'feed-network';
      wrapped.cause = error;
      return wrapped;
    }
  }

  // XML / feed-format errors. rss-parser reports these as
  // "Error: Non-whitespace before first tag" or "This XML document is
  // invalid, likely not well-formed XML".
  if (XML_PARSE_RE.test(raw) || /not well-formed/i.test(raw) || /Parse error/i.test(raw)) {
    const wrapped = new Error('订阅内容解析失败');
    wrapped.code = 'feed-parse';
    wrapped.cause = error;
    return wrapped;
  }

  // Catch-all: leave a Chinese placeholder so the UI never shows raw
  // English again, but keep the original message attached for logs.
  const wrapped = new Error('RSS 源不可用');
  wrapped.code = code ?? 'feed-unknown';
  wrapped.cause = error;
  return wrapped;
}

const HTTP_STATUS_ZH = Object.freeze({
  400: '请求格式错误',
  401: '需要登录',
  403: '访问被拒绝',
  404: '订阅不存在',
  408: '服务器响应超时',
  410: '订阅已永久移除',
  413: '请求内容过大',
  418: "I'm a teapot",
  429: '请求过于频繁',
  500: '服务器内部错误',
  501: '服务器不支持该请求',
  502: '网关错误',
  503: '服务暂不可用',
  504: '网关超时',
  521: '源站已离线',
  522: '源站连接超时',
  523: '源站不可达',
  524: '源站响应超时',
  525: 'SSL 握手失败',
  526: 'SSL 证书无效',
});

const NETWORK_CODE_ZH = Object.freeze({
  ECONNREFUSED: '连接被拒绝',
  ECONNRESET: '连接被重置',
  ENOTFOUND: '找不到主机',
  EAI_AGAIN: '解析主机名失败',
  ETIMEDOUT: '连接超时',
  ENETUNREACH: '网络不可达',
  EHOSTUNREACH: '目标主机不可达',
  EPIPE: '连接已断开',
  ENOTCONN: '连接已关闭',
  EAI_FAIL: 'DNS 解析失败',
  CERT_HAS_EXPIRED: '服务器证书已过期',
  DEPTH_ZERO_SELF_SIGNED_CERT: '自签名证书不受信任',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: '证书链不受信任',
  CERT_NOT_YET_VALID: '服务器证书尚未生效',
  ERR_TLS_CERT_ALTNAME_INVALID: '证书域名不匹配',
});

const NETWORK_MSG_PATTERNS = Object.freeze([
  [/getaddrinfo\s+ENOTFOUND/i, '找不到主机'],
  [/getaddrinfo\s+EAI_AGAIN/i, '解析主机名失败'],
  [/connect\s+ECONNREFUSED/i, '连接被拒绝'],
  [/connect\s+ETIMEDOUT/i, '连接超时'],
  [/read\s+ECONNRESET/i, '连接被重置'],
  [/socket hang up/i, '服务器中断了连接'],
  [/TLS\s+alert/i, 'TLS 握手失败'],
  [/self[- ]signed/i, '自签名证书不受信任'],
  [/certificate\s+has\s+expired/i, '服务器证书已过期'],
]);

const XML_PARSE_RE = /Non-whitespace before first tag|Unexpected end|JSX-style attribute|Invalid character in attribute name/i;

/** Best-effort thumbnail extraction, matching the rss-video-monitor behavior. */
export function extractThumbnail(item) {
  const fromMediaObject = (value) => {
    const direct = value?.$?.url ?? value?.$?.href;
    return typeof direct === 'string' && direct ? direct : null;
  };
  const fromMedia = fromMediaObject(item.mediaThumbnail) ?? fromMediaObject(item.mediaContent);
  if (fromMedia) return fromMedia;
  if (item.enclosure?.url
    && (item.enclosure.type?.startsWith('image/')
      || /\.(jpg|jpeg|png|gif|webp)$/i.test(item.enclosure.url))) {
    return item.enclosure.url;
  }
  const content = item.content || item.contentSnippet || '';
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return match[1];
  return null;
}

/** Shape a parsed feed into the test/preview payload used by the RPC layer. */
export function describeFeed(feed, url) {
  const items = Array.isArray(feed.items) ? feed.items : [];
  const latest = items[0];
  return {
    title: typeof feed.title === 'string' ? feed.title : '',
    description: typeof feed.description === 'string' ? feed.description : '',
    itemsCount: items.length,
    latestItem: latest
      ? {
          title: typeof latest.title === 'string' ? latest.title : '',
          link: typeof latest.link === 'string' ? latest.link : '',
          pubDate: latest.isoDate ?? latest.pubDate ?? null,
        }
      : null,
    url,
  };
}
