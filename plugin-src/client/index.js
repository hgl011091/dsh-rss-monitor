import * as React from 'react';

import { normalizeStatus } from './api.js';
import { RSS_LOCALE_NAMESPACE, setRssTranslator, tr } from './i18n.js';
import { installRssStyles } from './styles.js';
import { RssSettingsTab } from './app.js';

export const name = 'dsh-rss-monitor';
export const version = '0.2.9';
export const inject = ['slots', 'connection', 'locale'];

export function apply(ctx) {
  const t = ctx.locale.bind(RSS_LOCALE_NAMESPACE);
  setRssTranslator(t);
  ctx.effect(() => () => setRssTranslator(null), 'dsh-rss-monitor: release translator');

  ctx.effect(
    () => installRssStyles(),
    'dsh-rss-monitor: settings stylesheet',
  );

  // Ride the shared `/api` channel like every other settings tab: custom
  // plugin channels are not reliably dispatched on current desktop builds
  // (browser requests can fall through to the static fallback and fail
  // with HTTP 405). The host mounts one exact route per endpoint under
  // /api for this namespace (see src/rpc.mjs), so the namespaced method
  // maps onto /api/dsh-rss-monitor.<endpoint>.
  const rpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(
    '/api',
    `dsh-rss-monitor.${endpoint}`,
    payload,
    signal,
  );

  ctx.slots.inject(
    'settings.section',
    () => ctx.slots.register({
      name: 'settings.section',
      id: 'dsh-rss-monitor',
      order: 22,
      label: () => t('RSS 监控'),
      locale: RSS_LOCALE_NAMESPACE,
      inject: () => ({ rpcCall, version }),
    }, RssSettingsTab),
    'dsh-rss-monitor: settings page',
  );

  return { version, normalizeStatus };
}
