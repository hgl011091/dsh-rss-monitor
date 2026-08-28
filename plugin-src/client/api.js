import {
  LIMITS,
  normalizeStatus,
  RSS_PROTOCOL_VERSION,
  RSS_RPC_CHANNEL,
  RSS_RPC_ENDPOINTS,
} from '../../src/protocol.mjs';

export { LIMITS, normalizeStatus, RSS_PROTOCOL_VERSION, RSS_RPC_CHANNEL, RSS_RPC_ENDPOINTS };

/** Unwrap the `{ ok, value } | { ok, error }` envelope into a value or throw. */
export function unwrapRssRpc(result) {
  if (typeof result !== 'object' || result === null || typeof result.ok !== 'boolean') {
    const preview = (() => {
      try {
        const text = JSON.stringify(result) ?? String(result);
        return text.length > 140 ? `${text.slice(0, 140)}…` : text;
      } catch {
        return String(result);
      }
    })();
    throw new Error(`RSS 监控服务返回了无法识别的响应（${preview}）`);
  }
  if (!result.ok) {
    const error = new Error(
      typeof result.error?.message === 'string' ? result.error.message : 'RSS 监控操作失败',
    );
    error.code = typeof result.error?.code === 'string' ? result.error.code : 'rss-rpc-error';
    throw error;
  }
  return result.value;
}
