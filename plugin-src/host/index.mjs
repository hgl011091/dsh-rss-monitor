import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import nodemailer from 'nodemailer';

import { RssConfigStore } from '../../src/config-store.mjs';
import { RssController } from '../../src/controller.mjs';
import { EmailNotifier } from '../../src/email-notifier.mjs';
import { FeedFetcher } from '../../src/feed-fetcher.mjs';
import { RssMonitor } from '../../src/monitor.mjs';
import { installRssRpc } from '../../src/rpc.mjs';
import { RssStateStore } from '../../src/state-store.mjs';

export const name = 'dsh-rss-monitor-host';
export const inject = ['connection', 'credentials'];

/** Resolve the plugin's data directory under DSH_HOME. */
export function rssPaths(config = {}) {
  const dshHome = resolve(config.dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh'));
  const root = resolve(config.dataDir ?? join(dshHome, 'integrations', 'dsh-rss-monitor'));
  return {
    root,
    config: resolve(config.configPath ?? join(root, 'config.json')),
    state: resolve(config.statePath ?? join(root, 'state.json')),
  };
}

/**
 * Assemble the host plugin with injectable internals (stores, fetcher,
 * notifier, monitor factory) so tests can run the full apply() offline.
 */
export function createRssHostPlugin(internals = {}) {
  return Object.freeze({
    name,
    inject,
    async apply(ctx, config = {}) {
      const logger = typeof ctx?.logger === 'function'
        ? ctx.logger(name)
        : (ctx?.logger ?? console);
      const paths = rssPaths(config);
      const configStore = internals.configStore
        ?? (await new (internals.ConfigStore ?? RssConfigStore)(paths.config).load());
      const stateStore = internals.stateStore
        ?? (await new (internals.StateStore ?? RssStateStore)(paths.state).load());
      const credentials = ctx?.credentials;

      const fetcher = internals.fetcher ?? new FeedFetcher();
      const notifier = internals.notifier ?? new EmailNotifier({
        credentials,
        createTransport: nodemailer.createTransport,
        logger,
      });

      const monitor = internals.monitor ?? new RssMonitor({
        configStore,
        stateStore,
        fetchFeed: (url) => fetcher.parseFeed(url),
        notify: async (items) => {
          const email = configStore.get()?.email;
          if (!notifier.isConfigured(email)) {
            logger?.info?.('[dsh-rss-monitor] email not configured; skip notification');
            return;
          }
          await notifier.send(email, items);
        },
        logger,
      });

      const controller = internals.controller ?? new RssController({
        configStore,
        stateStore,
        monitor,
        notifier,
        describeFeed: (url) => fetcher.describe(url),
        credentials,
        logger,
      });
      RssController.assertComplete(controller);

      let rpcDisposer = null;
      if (ctx?.connection?.rpc) {
        rpcDisposer = internals.installRpc
          ? internals.installRpc(ctx, controller, config)
          : installRssRpc(ctx, controller, config);
      } else {
        logger?.warn?.('[dsh-rss-monitor] connection.rpc unavailable; settings page will not reach this host');
      }

      await (internals.initialize ?? (() => controller.initialize()))();

      ctx.effect(() => async () => {
        controller.close();
        rpcDisposer?.();
      }, 'dsh-rss-monitor: stop monitor and release rpc');
    },
  });
}

export async function apply(ctx, config = {}) {
  return createRssHostPlugin().apply(ctx, config);
}
