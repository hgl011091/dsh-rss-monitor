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
    const feed = await this.#parser.parseURL(url);
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
