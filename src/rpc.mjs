import { RSS_RPC_CHANNEL } from './protocol.mjs';

/**
 * Creates the dsh-rss-monitor RPC handler. Every request is validated (known
 * endpoint, record payload) and normalized into the `{ ok, value } |
 * { ok, error }` envelope used by the dsh-im channels, so the client can
 * unwrap uniformly.
 */
export function createRssRpcHandler(controller) {
  const handlers = controller.handlers();
  return async (endpoint, payload, signal) => {
    if (signal?.aborted) {
      return { ok: false, error: { code: 'cancelled', message: '请求已取消。', details: {} } };
    }
    const handler = handlers[endpoint];
    if (typeof handler !== 'function' || payload === undefined || payload === null
      || typeof payload !== 'object' || Array.isArray(payload)) {
      return {
        ok: false,
        error: { code: 'bad-request', message: '无效的 RSS 监控请求。', details: { issues: [] } },
      };
    }
    try {
      const value = await handler(payload);
      return { ok: true, value };
    } catch (error) {
      // The transport's serverResponseSchema only accepts a fixed set of error
      // codes (discriminated union, `details` required per branch). Custom
      // codes make the browser-side zod parse throw a raw issues JSON — so
      // map every controller failure onto the generic `internal` branch and
      // keep the human-readable message for the client to display.
      const message = error instanceof Error && error.message
        ? error.message
        : 'RSS 监控操作失败，请稍后重试。';
      return { ok: false, error: { code: 'internal', message, details: {} } };
    }
  };
}

/**
 * Install the handler on the Harness connection. Defaults to loopback
 * authority (matching dsh-im) so only the local browser can call the
 * management surface; pass `authority: 'trusted-host'` to widen it.
 * Returns the disposer.
 */
export function installRssRpc(ctx, controller, { authority = 'loopback' } = {}) {
  return ctx.connection.rpc.handle(RSS_RPC_CHANNEL, createRssRpcHandler(controller), { authority });
}
