import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildEmailHtml,
  buildEmailText,
  EmailNotifier,
  RETRY_DELAYS_MS,
  systemResolveHost,
} from '../src/email-notifier.mjs';

/** Offline stub: record the host and hand back a fixed resolution. */
function stubResolveHost(result) {
  const calls = [];
  const resolveHost = async (host) => {
    calls.push(host);
    return typeof result === 'function' ? result(host) : result;
  };
  return { resolveHost, calls };
}

const ITEM = {
  id: 'abc123',
  feedId: 'feed',
  feedName: '少数派',
  title: 'DeepSeek 发布 <新> 模型 & "权重"',
  link: 'https://sspai.com/post/1',
  pubDate: '2026-01-01T08:00:00.000Z',
  contentSnippet: '完全开源的 <b>权重</b> 已发布',
  thumbnail: 'https://img.example.com/thumb.jpg',
  discoveredAt: '2026-01-01T09:00:00.000Z',
};

test('buildEmailText renders a plain-text digest', () => {
  const text = buildEmailText([ITEM]);
  assert.ok(text.includes('发现 1 个新条目'));
  assert.ok(text.includes('标题: DeepSeek 发布 <新> 模型 & "权重"'));
  assert.ok(text.includes('来源: 少数派'));
  assert.ok(text.includes('链接: https://sspai.com/post/1'));
  assert.ok(text.includes('摘要: 完全开源的 <b>权重</b> 已发布'));
});

test('buildEmailHtml escapes content and embeds thumbnail and link', () => {
  const html = buildEmailHtml([ITEM], { heading: 'RSS 监控' });
  assert.ok(html.includes('发现 1 个新条目'));
  assert.ok(html.includes('&lt;新&gt;'));
  assert.ok(html.includes('&quot;权重&quot;'));
  assert.ok(html.includes('<b>权重</b>'.replace(/</g, '&lt;').replace(/>/g, '&gt;')));
  assert.ok(html.includes('https://sspai.com/post/1'));
  assert.ok(html.includes('https://img.example.com/thumb.jpg'));
  assert.ok(html.includes('查看原文'));
  assert.ok(html.includes('📡'));

  const plain = buildEmailHtml([{ ...ITEM, thumbnail: null, link: '' }]);
  assert.ok(!plain.includes('查看原文'));
  assert.ok(plain.includes('DeepSeek 发布'));

  const empty = buildEmailHtml([]);
  assert.ok(empty.includes('发现 0 个新条目'));
});

test('EmailNotifier resolves the password through the credential store', async () => {
  const resolvedRefs = [];
  const transports = [];
  const { resolveHost } = stubResolveHost({ host: '93.184.216.34', servername: 'smtp.a.com' });
  const notifier = new EmailNotifier({
    credentials: {
      resolve: (ref) => {
        resolvedRefs.push(ref);
        return { value: 'secret-pass' };
      },
    },
    createTransport: (options) => {
      const transport = {
        options,
        sent: [],
        async sendMail(mail) {
          transport.sent.push(mail);
        },
      };
      transports.push(transport);
      return transport;
    },
    resolveHost,
    delay: async () => {},
  });
  const config = {
    host: 'smtp.a.com',
    port: 465,
    secure: true,
    user: 'bot@a.com',
    from: 'RSS <bot@a.com>',
    to: 'me@a.com',
    passRef: 'DSH_RSS_SMTP_PASS_ABCDEF01ABCDEF01ABCDEF01',
  };
  await notifier.send(config, [ITEM]);
  assert.deepEqual(resolvedRefs, ['DSH_RSS_SMTP_PASS_ABCDEF01ABCDEF01ABCDEF01']);
  assert.equal(transports.length, 1);
  assert.deepEqual(transports[0].options.auth, { user: 'bot@a.com', pass: 'secret-pass' });
  assert.equal(transports[0].options.host, '93.184.216.34');
  assert.deepEqual(transports[0].options.tls, { servername: 'smtp.a.com' });
  assert.equal(transports[0].options.port, 465);
  assert.equal(transports[0].sent[0].to, 'me@a.com');
  assert.equal(transports[0].sent[0].from, 'RSS <bot@a.com>');
  assert.ok(transports[0].sent[0].subject.includes('1 个新条目'));
  assert.ok(transports[0].sent[0].html.includes('发现 1 个新条目'));
  assert.ok(transports[0].sent[0].text.includes('标题:'));
});

test('EmailNotifier.sendTest verifies and reports incomplete configuration', async () => {
  let verified = 0;
  let sent = 0;
  const { resolveHost } = stubResolveHost({ host: '93.184.216.34', servername: 'smtp.a.com' });
  const notifier = new EmailNotifier({
    credentials: { resolve: () => ({ value: 'pw' }) },
    createTransport: () => ({
      async verify() {
        verified += 1;
      },
      async sendMail() {
        sent += 1;
      },
    }),
    resolveHost,
    delay: async () => {},
  });
  await notifier.sendTest({
    host: 'smtp.a.com', port: 465, secure: true, user: 'bot@a.com', to: 'me@a.com',
    passRef: 'DSH_RSS_SMTP_PASS_ABCDEF01ABCDEF01ABCDEF01',
  });
  assert.equal(verified, 1);
  assert.equal(sent, 1);

  await assert.rejects(
    () => notifier.sendTest({ host: 'smtp.a.com', to: '' }),
    /邮件配置不完整/,
  );
  assert.equal(verified, 1);

  assert.equal(notifier.isConfigured({ host: 'h', to: 'x' }), true);
  assert.equal(notifier.isConfigured({ host: 'h', to: '' }), false);
  assert.equal(notifier.isConfigured(null), false);
});

test('EmailNotifier retries transient failures with backoff then succeeds', async () => {
  const delays = [];
  let attempts = 0;
  const { resolveHost } = stubResolveHost((host) => ({ host }));
  const notifier = new EmailNotifier({
    credentials: { resolve: () => ({ value: 'pw' }) },
    createTransport: () => ({
      async sendMail() {
        attempts += 1;
        if (attempts < 3) throw new Error('ECONNRESET');
      },
    }),
    resolveHost,
    delay: async (ms) => delays.push(ms),
  });
  await notifier.send(
    { host: 'smtp.a.com', port: 465, secure: true, user: 'u', to: 'me@a.com', passRef: 'DSH_RSS_SMTP_PASS_ABCDEF01ABCDEF01ABCDEF01' },
    [ITEM],
  );
  assert.equal(attempts, 3);
  assert.deepEqual(delays, RETRY_DELAYS_MS.slice(0, 2));
});

test('EmailNotifier surfaces a concise failure after exhausting retries', async () => {
  const delays = [];
  const logged = [];
  let attempts = 0;
  const { resolveHost } = stubResolveHost((host) => ({ host }));
  const notifier = new EmailNotifier({
    credentials: { resolve: () => ({ value: 'pw' }) },
    logger: { warn: (msg) => logged.push(msg) },
    createTransport: () => ({
      async sendMail() {
        attempts += 1;
        throw new Error(`SMTP down (attempt ${attempts})`);
      },
    }),
    resolveHost,
    delay: async (ms) => delays.push(ms),
  });
  await assert.rejects(
    () => notifier.send(
      { host: 'smtp.a.com', port: 465, secure: true, user: 'u', to: 'me@a.com', passRef: 'DSH_RSS_SMTP_PASS_ABCDEF01ABCDEF01ABCDEF01' },
      [ITEM],
    ),
    (error) => error.code === 'email-send-failed' && error.message === '发送失败',
  );
  assert.equal(attempts, 3);
  assert.deepEqual(delays, RETRY_DELAYS_MS);
  // Raw SMTP detail stays in the log only, never reaches the UI.
  assert.ok(logged.some((line) => line.includes('SMTP down (attempt 1)')));
});

test('EmailNotifier works without stored credentials (no-auth relay)', async () => {
  const transports = [];
  const { resolveHost } = stubResolveHost((host) => ({ host }));
  const notifier = new EmailNotifier({
    credentials: { resolve: () => undefined },
    createTransport: (options) => {
      const transport = {
        options,
        async sendMail() {},
      };
      transports.push(transport);
      return transport;
    },
    resolveHost,
    delay: async () => {},
  });
  await notifier.send({ host: 'relay.local', port: 25, secure: false, user: '', to: 'me@a.com' }, [ITEM]);
  assert.equal(transports[0].options.auth, undefined);
  assert.equal(transports[0].options.secure, false);
});

test('EmailNotifier keeps the original hostname when the resolver throws', async () => {
  const logged = [];
  const transports = [];
  const notifier = new EmailNotifier({
    credentials: { resolve: () => ({ value: 'pw' }) },
    logger: { warn: (msg) => logged.push(msg) },
    createTransport: (options) => {
      const transport = { options, async sendMail() {} };
      transports.push(transport);
      return transport;
    },
    resolveHost: async () => {
      throw new Error('resolver exploded');
    },
    delay: async () => {},
  });
  await notifier.send(
    { host: 'smtp.a.com', port: 465, secure: true, user: 'u', to: 'me@a.com', passRef: 'DSH_RSS_SMTP_PASS_ABCDEF01ABCDEF01ABCDEF01' },
    [ITEM],
  );
  assert.equal(transports[0].options.host, 'smtp.a.com');
  assert.equal(transports[0].options.tls, undefined);
  assert.ok(logged.some((line) => line.includes('host pre-resolve failed')));
});

test('EmailNotifier keeps the original hostname when the resolver returns garbage', async () => {
  const transports = [];
  const notifier = new EmailNotifier({
    credentials: { resolve: () => ({ value: 'pw' }) },
    createTransport: (options) => {
      const transport = { options, async sendMail() {} };
      transports.push(transport);
      return transport;
    },
    resolveHost: async () => null,
    delay: async () => {},
  });
  await notifier.send(
    { host: 'smtp.a.com', port: 465, secure: true, user: 'u', to: 'me@a.com', passRef: 'DSH_RSS_SMTP_PASS_ABCDEF01ABCDEF01ABCDEF01' },
    [ITEM],
  );
  assert.equal(transports[0].options.host, 'smtp.a.com');
  assert.equal(transports[0].options.tls, undefined);
});

test('systemResolveHost prefers IPv4 and preserves the hostname for TLS', async () => {
  const resolveHost = systemResolveHost({
    lookup: async () => [
      { address: '2001:db8::1', family: 6 },
      { address: '93.184.216.34', family: 4 },
    ],
  });
  assert.deepEqual(await resolveHost('smtp.a.com'), { host: '93.184.216.34', servername: 'smtp.a.com' });
});

test('systemResolveHost falls back to IPv6 when only AAAA exists', async () => {
  const resolveHost = systemResolveHost({
    lookup: async () => [{ address: '2001:db8::1', family: 6 }],
  });
  assert.deepEqual(await resolveHost('smtp.a.com'), { host: '2001:db8::1', servername: 'smtp.a.com' });
});

test('systemResolveHost passes IP literals through without servername', async () => {
  const resolveHost = systemResolveHost({ lookup: async () => { throw new Error('must not be called'); } });
  assert.deepEqual(await resolveHost('127.0.0.1'), { host: '127.0.0.1', servername: undefined });
});

test('systemResolveHost returns the hostname unchanged when lookup fails', async () => {
  const resolveHost = systemResolveHost({ lookup: async () => { throw new Error('ENOTFOUND'); } });
  assert.deepEqual(await resolveHost('smtp.a.com'), { host: 'smtp.a.com', servername: undefined });
});

test('systemResolveHost handles empty lookup results', async () => {
  const resolveHost = systemResolveHost({ lookup: async () => [] });
  assert.deepEqual(await resolveHost('smtp.a.com'), { host: 'smtp.a.com', servername: undefined });
});
