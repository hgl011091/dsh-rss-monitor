import * as React from 'react';

import { normalizeStatus, RSS_RPC_CHANNEL } from './api.js';
import { RSS_LOCALE_NAMESPACE, setRssTranslator, tr } from './i18n.js';
import { installRssStyles } from './styles.js';
import { RssSettingsTab } from './app.js';

export const name = 'dsh-rss-monitor';
export const version = '0.1.0';
export const inject = ['slots', 'connection', 'locale'];

export function apply(ctx) {
  const t = ctx.locale.bind(RSS_LOCALE_NAMESPACE);
  setRssTranslator(t);
  ctx.effect(() => () => setRssTranslator(null), 'dsh-rss-monitor: release translator');

  ctx.effect(
    () => installRssStyles(),
    'dsh-rss-monitor: settings stylesheet',
  );

  const rpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(
    RSS_RPC_CHANNEL,
    endpoint,
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
