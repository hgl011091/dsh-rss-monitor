import { RSS_RPC_CHANNEL, RSS_RPC_ENDPOINTS } from './protocol.mjs';

/** Method namespace under the shared `/api` channel, derived from the channel name. */
export const API_METHOD_PREFIX = `${RSS_RPC_CHANNEL.slice(1)}.`;

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
 * Mount the management surface as exact Fetch routes under the shared
 * `/api` channel — one route per endpoint, `/api/dsh-rss-monitor.<endpoint>`.
 *
 * Why not `connection.rpc.handle(RSS_RPC_CHANNEL, ...)`: registering a
 * custom channel touches the webServer service inside dsh-client-connection
 * (`owner.webServer.register(route)`), which fails at apply time unless
 * webServer is already provided ("cannot get property \"webServer\"
 * without inject" — the desktop loader applies entries directly and ignores
 * module-level inject for gating), and on current desktop builds browser
 * requests to plugin channels can fall through to the static-frontend
 * fallback and fail with HTTP 405. Exact `/api` routes win over the
 * built-in gateway interceptor, ride the same browser-auth fence as every
 * other settings tab, and `connection.fetch.register` never touches
 * webServer, so there is nothing left to race.
 *
 * The browser client calls the shared channel with the namespaced method
 * (`rpc.call('/api', 'dsh-rss-monitor.<endpoint>', ...)`), which POSTs
 * `/api/dsh-rss-monitor.<endpoint>` with the standard client-request
 * envelope; the route validates it, dispatches to the controller, and
 * answers with the standard server-response envelope. Access control is
 * inherited from the shared `/api` route (browser-auth fence), so the old
 * `authority` option is accepted for compatibility but no longer has any
 * effect.
 *
 * Returns the disposer.
 */
export function installRssRpc(ctx, controller, _options = {}) {
  const dispatch = createRssRpcHandler(controller);
  const routes = Object.values(RSS_RPC_ENDPOINTS).map((endpoint) =>
    ctx.connection.fetch.register({
      path: `/api/${API_METHOD_PREFIX}${endpoint}`,
      methods: ['POST'],
      requestBodyMode: 'buffered',
      fetch: async (request) => {
        let envelope;
        try {
          envelope = await request.json();
        } catch {
          return new Response('body is not JSON', { status: 400 });
        }
        if (!envelope || typeof envelope !== 'object' || envelope.type !== 'client-request'
          || typeof envelope.rpcId !== 'string' || envelope.method !== `${API_METHOD_PREFIX}${endpoint}`) {
          return new Response('invalid client-request', { status: 400 });
        }
        const result = await dispatch(endpoint, envelope.payload ?? {}, request.signal);
        return Response.json({ type: 'server-response', rpcId: envelope.rpcId, result });
      },
    }));
  return () => {
    for (const dispose of routes) dispose();
  };
}
