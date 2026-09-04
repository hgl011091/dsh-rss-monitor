/**
 * Email notifications for newly discovered RSS items, built on nodemailer.
 * The SMTP password is resolved from the Harness credential store via
 * `passRef` and never persisted in config files or returned to the browser.
 * The transport factory is injectable for offline tests.
 */

export const RETRY_DELAYS_MS = [2_000, 4_000];

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateTime(value) {
  if (!value) return '未知时间';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN');
}

export function buildEmailText(items) {
  let text = `RSS 监控 - 发现 ${items.length} 个新条目\n\n`;
  for (const item of items) {
    text += `标题: ${item.title}\n`;
    text += `来源: ${item.feedName}\n`;
    text += `时间: ${formatDateTime(item.pubDate)}\n`;
    if (item.link) text += `链接: ${item.link}\n`;
    if (item.contentSnippet) text += `摘要: ${item.contentSnippet}\n`;
    text += '\n---\n\n';
  }
  return text;
}

export function buildEmailHtml(items, { heading = 'RSS 监控' } = {}) {
  const now = new Date().toLocaleString('zh-CN');
  const cards = items.map((item) => {
    const thumbnail = item.thumbnail
      ? `<img src="${escapeHtml(item.thumbnail)}" alt="" style="max-width: 200px; max-height: 150px; border-radius: 8px; display: block; margin: 10px 0;">`
      : '';
    return `
      <div style="border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: #fafafa;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          ${thumbnail ? `<div style="flex-shrink: 0;">${thumbnail}</div>` : ''}
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">来源: ${escapeHtml(item.feedName)}</div>
            <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1a1a2e;">${escapeHtml(item.title)}</h3>
            <div style="font-size: 13px; color: #666; margin-bottom: 12px;">发布时间: ${escapeHtml(formatDateTime(item.pubDate))}</div>
            ${item.contentSnippet ? `<div style="font-size: 13px; color: #444; line-height: 1.6;">${escapeHtml(item.contentSnippet)}</div>` : ''}
            ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" style="display: inline-block; padding: 8px 16px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500; margin-top: 10px;">查看原文</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #16a34a 0%, #0d9488 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">📡 ${escapeHtml(heading)}</h1>
          <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">发现 ${items.length} 个新条目 · ${escapeHtml(now)}</p>
        </div>
        <div style="padding: 24px;">${cards}</div>
        <div style="background: #f8f9fa; padding: 16px 24px; border-top: 1px solid #e0e0e0; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #999;">dsh-rss-monitor · DeepSeek Harness RSS 监控插件</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Delivers notification and test emails with bounded retries. `createTransport`
 * mirrors nodemailer.createTransport; `delay` is injectable for tests.
 */
export class EmailNotifier {
  #credentials;
  #createTransport;
  #logger;
  #delay;

  constructor({ credentials, createTransport, logger = console, delay = defaultDelay } = {}) {
    if (typeof createTransport !== 'function') throw new TypeError('EmailNotifier requires createTransport()');
    this.#credentials = credentials;
    this.#createTransport = createTransport;
    this.#logger = logger;
    this.#delay = delay;
  }

  #resolvePassword(config) {
    if (!config?.passRef) return Promise.resolve('');
    const credential = this.#credentials?.resolve?.(config.passRef);
    return Promise.resolve(credential).then((value) => value?.value ?? '');
  }

  #transportOptions(config, password) {
    return {
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: password } : undefined,
    };
  }

  isConfigured(config) {
    return Boolean(config?.host && config?.to);
  }

  async #withRetry(operation, { retries = 2, describe = 'send' } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error;
        this.#logger?.warn?.(`[dsh-rss-monitor] ${describe} failed (attempt ${attempt + 1}/${retries + 1}): ${error?.message}`);
        if (attempt < retries) {
          await this.#delay(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
        }
      }
    }
    throw lastError;
  }

  /** Send the new-item notification email. Throws after retries are exhausted. */
  async send(config, items, { subject } = {}) {
    if (!this.isConfigured(config)) {
      const error = new Error('邮件配置不完整');
      error.code = 'email-not-configured';
      throw error;
    }
    const password = await this.#resolvePassword(config);
    const transport = this.#createTransport(this.#transportOptions(config, password));
    try {
      await this.#withRetry(async () => {
        await transport.sendMail({
          from: config.from || config.user || config.host,
          to: config.to,
          subject: subject ?? `📡 RSS 监控 - 发现 ${items.length} 个新条目`,
          text: buildEmailText(items),
          html: buildEmailHtml(items),
        });
      }, { describe: 'notification email' });
    } catch {
      // Never surface raw SMTP transcripts to the UI; per-attempt detail is
      // already in the Harness log via #withRetry's warn lines.
      throw shortSendFailure();
    }
  }

  /** Send a test email to verify the SMTP configuration. */
  async sendTest(config) {
    if (!this.isConfigured(config)) {
      const error = new Error('邮件配置不完整：至少需要 SMTP 主机和收件人');
      error.code = 'email-not-configured';
      throw error;
    }
    const password = await this.#resolvePassword(config);
    const transport = this.#createTransport(this.#transportOptions(config, password));
    try {
      await this.#withRetry(async (attempt) => {
        if (attempt === 0) await transport.verify();
        await transport.sendMail({
          from: config.from || config.user || config.host,
          to: config.to,
          subject: 'RSS 监控 - 测试邮件',
          text: '这是一封测试邮件，说明 RSS 监控的邮件配置正确。',
          html: `<div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">RSS 监控 - 测试邮件</h2>
            <p>这是一封测试邮件，说明 RSS 监控的邮件配置正确。</p>
            <p style="color: #666; font-size: 14px;">发送时间: ${new Date().toLocaleString('zh-CN')}</p>
          </div>`,
        });
      }, { describe: 'test email' });
    } catch {
      throw shortSendFailure();
    }
  }
}

/** Concise UI-facing error for exhausted email delivery attempts. */
function shortSendFailure() {
  const error = new Error('发送失败');
  error.code = 'email-send-failed';
  return error;
}

function defaultDelay(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer?.unref?.();
  });
}
