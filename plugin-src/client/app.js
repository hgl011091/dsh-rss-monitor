import * as React from 'react';

import { normalizeStatus, RSS_RPC_ENDPOINTS as ENDPOINTS, unwrapRssRpc } from './api.js';
import { tr } from './i18n.js';

const POLL_MS = 15_000;

function h(type, props, ...children) {
  return React.createElement(type, props, ...children);
}

function formatTime(value) {
  if (!value) return tr('从未检查');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

/** Collapse raw host/transport errors into a short single-line UI message. */
function shortErrorText(message) {
  const firstLine = String(message ?? '').split(/\r?\n/)[0].trim();
  return firstLine.length > 96 ? `${firstLine.slice(0, 96)}…` : firstLine;
}

function Switch({ on, onChange, disabled, label }) {
  return h('button', {
    type: 'button',
    className: `drss-switch${on ? ' drss-switchOn' : ''}`,
    role: 'switch',
    'aria-checked': on,
    disabled,
    onClick: () => onChange(!on),
  },
  h('span', { className: 'drss-switchTrack', 'aria-hidden': 'true' },
    h('span', { className: 'drss-switchKnob' })),
  label ? h('span', { className: 'drss-switchLabel' }, label) : null);
}

/**
 * Toast rendered entirely inside the plugin's own React tree: nothing is
 * appended to DSH-owned DOM, no ancestor styles are mutated, and leaving the
 * settings page unmounts the toast instantly (no lingering nodes or deferred
 * style restoration over the main interface).
 *
 * Placement: the settings scroll container's visible rect IS the settings
 * window on screen, so the toast is pinned (position:fixed + measured
 * right/bottom) to that rect's bottom-right corner. The rect does not change
 * when panels switch, so every menu shows the toast at the same point.
 */
function Notice({ notice, onDismiss }) {
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(onDismiss, notice.type === 'error' ? 6_000 : 3_000);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);
  React.useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !notice) return;
    try {
      const doc = document;
      const rootEl = doc.querySelector('.drss-page');
      let node = rootEl?.parentElement ?? null;
      let scroller = null;
      while (node && node !== doc.body && node !== doc.documentElement) {
        const style = doc.defaultView?.getComputedStyle(node);
        if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
          scroller = node;
          break;
        }
        node = node.parentElement;
      }
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        const view = doc.documentElement;
        const right = Math.max(16, view.clientWidth - rect.right + 16);
        const bottom = Math.max(16, view.clientHeight - rect.bottom + 16);
        wrap.style.right = `${right}px`;
        wrap.style.bottom = `${bottom}px`;
      } else {
        wrap.style.right = '24px';
        wrap.style.bottom = '24px';
      }
    } catch {
      // Leave the stylesheet defaults (viewport corner) on any failure.
    }
  }, [notice]);
  if (!notice) return null;
  return h('div', { ref: wrapRef, className: 'drss-toastWrap' },
    h('div', {
      className: `drss-notice${notice.type === 'error' ? ' drss-noticeError' : ' drss-noticeSuccess'}`,
      role: 'status',
    },
    h('span', { className: 'drss-noticeDot', 'aria-hidden': 'true' }),
    h('span', { className: 'drss-noticeText' }, notice.text),
    h('button', {
      type: 'button',
      className: 'drss-noticeClose',
      onClick: onDismiss,
      'aria-label': tr('取消'),
    }, '×')));
}

/**
 * In-app confirmation dialog replacing the native confirm(): native dialogs
 * block the Electron renderer and are known to leave the composer input
 * unresponsive afterwards. This one is plain React, styled like the rest of
 * the plugin, Escape/backdrop cancels and Enter confirms.
 */
function ConfirmDialog({ options, onClose }) {
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return h('div', { className: 'drss-modalBackdrop', onClick: () => onClose(false) },
    h('div', {
      className: 'drss-modal',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-label': options.title,
      onClick: (event) => event.stopPropagation(),
    },
    h('div', { className: 'drss-modalIcon', 'aria-hidden': 'true' }, '!'),
    h('h4', { className: 'drss-modalTitle' }, options.title),
    h('p', { className: 'drss-modalMessage' }, options.message),
    h('div', { className: 'drss-modalActions' },
      h('button', {
        type: 'button',
        className: 'drss-button',
        onClick: () => onClose(false),
      }, tr('取消')),
      h('button', {
        type: 'button',
        className: 'drss-button drss-buttonDangerSolid',
        autoFocus: true,
        onClick: () => onClose(true),
      }, options.confirmLabel))));
}

function StatusCard({ label, value, tone }) {
  return h('div', { className: 'drss-statusCard' },
    h('dt', null, label),
    h('dd', { className: tone === 'run' ? 'drss-statusRun' : tone === 'stop' ? 'drss-statusStop' : undefined }, value));
}

function ItemCard({ item }) {
  const thumb = item.thumbnail
    ? h('img', { className: 'drss-itemThumb', src: item.thumbnail, alt: '', loading: 'lazy' })
    : h('span', { className: 'drss-itemThumbFallback', 'aria-hidden': 'true' }, '🎬');
  return h('div', { className: 'drss-item' },
    thumb,
    h('div', { className: 'drss-itemBody' },
      h('p', { className: 'drss-itemFeed' }, item.feedName || 'RSS'),
      h('p', { className: 'drss-itemTitle' },
        item.link
          ? h('a', { href: item.link, target: '_blank', rel: 'noopener noreferrer' }, item.title)
          : item.title),
      h('p', { className: 'drss-itemMeta' },
        `${tr('上次检查')}: ${formatTime(item.pubDate ?? item.discoveredAt)}`)),
  );
}

function OverviewPanel({ status }) {
  const history = status.history ?? [];
  const recent = status.recentItems ?? [];
  return [
    h('div', { key: 'grid', className: 'drss-statusGrid' },
      h(StatusCard, {
        label: tr('监控状态'),
        value: status.running ? tr('运行中') : tr('已停止'),
        tone: status.running ? 'run' : 'stop',
      }),
      h(StatusCard, {
        label: tr('检查间隔'),
        value: `${status.settings?.checkInterval ?? 5} ${tr('分钟')}`,
      }),
      h(StatusCard, { label: tr('上次检查'), value: formatTime(status.lastCheck) }),
      h(StatusCard, {
        label: tr('下次检查'),
        value: status.running ? formatTime(status.nextCheckAt) : tr('无'),
      }),
      h(StatusCard, { label: tr('RSS 源数量'), value: String(status.feeds?.length ?? 0) }),
      h(StatusCard, { label: tr('已记录条目'), value: String(status.notifiedCount ?? 0) })),
    h('div', { key: 'mail', className: 'drss-muted' },
      status.emailConfigured
        ? tr('新条目将在发现后通过邮件通知')
        : tr('邮件未配置，仅显示在概览中')),
    h('section', { key: 'recent', className: 'drss-section' },
      h('div', { className: 'drss-panelHeading' },
        h('h3', null, tr('最近发现')),
        h('span', { className: 'drss-muted' }, `${recent.length} ${tr('条')}`)),
      recent.length === 0
        ? h('p', { className: 'drss-empty' }, tr('暂无新条目'))
        : h('div', { className: 'drss-twoCol' },
          recent.map((item) => h(ItemCard, { key: item.id, item })))),
    h('section', { key: 'history', className: 'drss-section' },
      h('div', { className: 'drss-panelHeading' },
        h('h3', null, tr('检查历史'))),
      history.length === 0
        ? h('p', { className: 'drss-empty' }, tr('暂无历史记录'))
        : h('div', { className: 'drss-twoCol' },
          history.map((entry, index) => h('div', { key: entry.timestamp ?? index, className: 'drss-historyRow' },
            h('span', { className: 'drss-historyTime' }, formatTime(entry.timestamp)),
            h('span', { className: 'drss-historyBadge' }, entry.manual ? tr('手动') : tr('自动')),
            h('span', { className: 'drss-historyCount' }, `+${entry.newCount ?? 0} ${tr('新条目')}`),
            entry.errors?.length
              ? h('span', { className: 'drss-historyError' },
                entry.errors.map((err) => `${err.feed}: ${err.error}`).join('；'))
              : null)))),
  ];
}

function FeedEditor({ initial, busy, onCancel, onSave, onTest }) {
  const [name, setName] = React.useState(initial?.name ?? '');
  const [url, setUrl] = React.useState(initial?.url ?? '');
  const [keywords, setKeywords] = React.useState((initial?.keywords ?? []).join(', '));
  const [exclude, setExclude] = React.useState((initial?.excludeKeywords ?? []).join(', '));
  const [enabled, setEnabled] = React.useState(initial?.enabled ?? true);
  const [preview, setPreview] = React.useState(null);
  const [previewError, setPreviewError] = React.useState(null);
  const split = (value) => value.split(/[,，;；\n]/).map((part) => part.trim()).filter(Boolean);
  const feed = () => ({
    ...(initial?.id ? { id: initial.id } : {}),
    name,
    url: url.trim(),
    enabled,
    keywords: split(keywords),
    excludeKeywords: split(exclude),
  });
  return h('form', {
    className: 'drss-section',
    onSubmit: (event) => {
      event.preventDefault();
      onSave(feed());
    },
  },
  h('h3', { style: { margin: '0 0 10px', fontSize: 14 } }, initial?.id ? tr('编辑 RSS 源') : tr('添加 RSS 源')),
  h('div', { className: 'drss-form' },
    h('label', { className: 'drss-label', htmlFor: 'drss-feed-name' }, tr('名称')),
    h('input', {
      id: 'drss-feed-name',
      className: 'drss-input',
      value: name,
      required: true,
      maxLength: 80,
      onChange: (event) => setName(event.target.value),
      placeholder: '少数派',
    }),
    h('label', { className: 'drss-label', htmlFor: 'drss-feed-url' }, tr('地址 URL')),
    h('input', {
      id: 'drss-feed-url',
      className: 'drss-input',
      type: 'url',
      value: url,
      required: true,
      maxLength: 2048,
      onChange: (event) => { setUrl(event.target.value); setPreview(null); setPreviewError(null); },
      placeholder: 'https://example.com/feed',
    }),
    h('button', {
      type: 'button',
      className: 'drss-button',
      disabled: busy || !url.trim(),
      onClick: async () => {
        setPreview(null);
        setPreviewError(null);
        try {
          // Route through the editor's own error state: an unhandled
          // rejection here used to fail silently.
          setPreview(await onTest(url.trim()));
        } catch (error) {
          setPreviewError(shortErrorText(error.message));
        }
      },
    }, tr('测试连接')),
    h('span', null),
    h('label', { className: 'drss-label', htmlFor: 'drss-feed-kw' }, tr('包含关键词')),
    h('input', {
      id: 'drss-feed-kw',
      className: 'drss-input',
      value: keywords,
      onChange: (event) => setKeywords(event.target.value),
      placeholder: tr('包含关键词'),
    }),
    h('label', { className: 'drss-label', htmlFor: 'drss-feed-ex' }, tr('排除关键词')),
    h('input', {
      id: 'drss-feed-ex',
      className: 'drss-input',
      value: exclude,
      onChange: (event) => setExclude(event.target.value),
      placeholder: tr('排除关键词'),
    }),
    h('p', { className: 'drss-formHint' }, tr('关键词提示')),
    h('div', { className: 'drss-checkRow' },
      h(Switch, { on: enabled, onChange: setEnabled, disabled: busy, label: enabled ? tr('启用') : tr('停用') })),
    preview
      ? h('div', { className: 'drss-preview' },
        h('strong', null, `${tr('测试通过')}: `),
        `${preview.title || url} · ${preview.itemsCount} ${tr('条')}`,
        preview.latestItem?.title ? ` · ${preview.latestItem.title}` : null)
      : null,
    previewError
      ? h('div', { className: 'drss-preview drss-previewError' },
        `${tr('测试失败')}: ${previewError}`)
      : null,
    h('div', { className: 'drss-formActions' },
      h('button', { type: 'button', className: 'drss-button', disabled: busy, onClick: onCancel }, tr('取消')),
      h('button', { type: 'submit', className: 'drss-button drss-buttonPrimary', disabled: busy }, tr('保存')))));
}

function FeedsPanel({ status, busy, run, rpc, confirmAction }) {
  const [editing, setEditing] = React.useState(null);
  const feeds = status.feeds ?? [];
  if (editing) {
    return h(FeedEditor, {
      initial: editing,
      busy,
      onCancel: () => setEditing(null),
      onSave: async (feed) => {
        await run(() => rpc(ENDPOINTS.feedSave, { feed }), tr('操作成功'));
        setEditing(null);
      },
      onTest: async (url) => {
        const result = await rpc(ENDPOINTS.feedTest, { url });
        return result;
      },
    });
  }
  return [
    h('div', { key: 'actions', className: 'drss-panelHeading' },
      h('div', null,
        h('h3', null, tr('RSS 源')),
        h('p', { className: 'drss-panelHint' }, tr('还没有 RSS 源提示'))),
      h('button', {
        type: 'button',
        className: 'drss-button drss-buttonPrimary',
        disabled: busy,
        onClick: () => setEditing({}),
      }, `+ ${tr('添加 RSS 源')}`)),
    feeds.length === 0
      ? h('div', { key: 'empty', className: 'drss-section drss-empty' },
        h('strong', null, tr('还没有 RSS 源')),
        tr('还没有 RSS 源提示'))
      : feeds.map((feed) => h('div', { key: feed.id, className: 'drss-feedCard' },
        h('div', { className: 'drss-feedHead' },
          h('p', { className: 'drss-feedName' }, feed.name),
          h('div', { className: 'drss-feedActions' },
            h('button', {
              type: 'button',
              className: 'drss-button',
              disabled: busy,
              onClick: () => run(
                () => rpc(ENDPOINTS.feedSave, { feed: { ...feed, enabled: !feed.enabled } }),
                tr('操作成功'),
              ),
            }, feed.enabled ? tr('停用') : tr('启用')),
            h('button', {
              type: 'button',
              className: 'drss-button',
              disabled: busy,
              onClick: () => setEditing(feed),
            }, tr('编辑')),
            h('button', {
              type: 'button',
              className: 'drss-button drss-buttonDanger',
              disabled: busy,
              onClick: async () => {
                if (!(await confirmAction({
                  title: tr('删除 RSS 源'),
                  message: tr('将删除该 RSS 源及其监控配置，已通知记录保留。'),
                  confirmLabel: tr('删除'),
                }))) return;
                await run(() => rpc(ENDPOINTS.feedRemove, { id: feed.id }), tr('操作成功'));
              },
            }, tr('删除')))),
        h('p', { className: 'drss-feedUrl' }, feed.url),
        h('div', { className: 'drss-feedKeywords' },
          h('span', { className: `drss-chip${feed.enabled ? '' : ' drss-chipMuted'}` },
            feed.enabled ? tr('启用') : tr('停用')),
          (feed.keywords ?? []).map((keyword) => h('span', { key: `k-${keyword}`, className: 'drss-chip' }, keyword)),
          (feed.excludeKeywords ?? []).map((keyword) => h('span', { key: `x-${keyword}`, className: 'drss-chip drss-chipExclude' }, `-${keyword}`)))
        )
      )
    ];
}

function EmailPanel({ status, busy, run, rpc }) {
  const email = status.email ?? {};
  const [host, setHost] = React.useState(email.host ?? '');
  const [port, setPort] = React.useState(String(email.port ?? 465));
  const [secure, setSecure] = React.useState(email.secure ?? true);
  const [user, setUser] = React.useState(email.user ?? '');
  const [pass, setPass] = React.useState('');
  const [from, setFrom] = React.useState(email.from ?? '');
  const [to, setTo] = React.useState(email.to ?? '');
  React.useEffect(() => {
    setHost(email.host ?? '');
    setPort(String(email.port ?? 465));
    setSecure(email.secure ?? true);
    setUser(email.user ?? '');
    setFrom(email.from ?? '');
    setTo(email.to ?? '');
    setPass('');
  }, [status.email?.host, status.email?.port, status.email?.user, status.email?.to]);
  const payload = () => ({
    host: host.trim(),
    port: Number(port) || 465,
    secure,
    user: user.trim(),
    pass: pass.length > 0 ? pass : undefined,
    from: from.trim(),
    to: to.trim(),
  });
  return [
    h('div', { key: 'head', className: 'drss-panelHeading' },
      h('div', null,
        h('h3', null, tr('邮件通知')),
        h('p', { className: 'drss-panelHint' },
          status.emailConfigured ? tr('已配置') : tr('尚未配置邮件通知')))),
    h('form', {
      key: 'form',
      className: 'drss-section',
      onSubmit: (event) => {
        event.preventDefault();
        run(() => rpc(ENDPOINTS.emailSave, payload()), tr('操作成功'));
      },
    },
    h('div', { className: 'drss-form' },
      h('label', { className: 'drss-label', htmlFor: 'drss-mail-host' }, tr('SMTP 主机')),
      h('input', {
        id: 'drss-mail-host', className: 'drss-input', value: host, required: true,
        onChange: (event) => setHost(event.target.value), placeholder: 'smtp.example.com',
      }),
      h('label', { className: 'drss-label', htmlFor: 'drss-mail-port' }, tr('端口')),
      h('input', {
        id: 'drss-mail-port', className: 'drss-input drss-inputSmall', type: 'number', min: 1, max: 65535,
        value: port, onChange: (event) => setPort(event.target.value),
      }),
      h('label', { className: 'drss-label', htmlFor: 'drss-mail-user' }, tr('账号')),
      h('input', {
        id: 'drss-mail-user', className: 'drss-input', value: user,
        onChange: (event) => setUser(event.target.value), placeholder: 'user@example.com',
      }),
      h('label', { className: 'drss-label', htmlFor: 'drss-mail-pass' }, tr('密码')),
      h('input', {
        id: 'drss-mail-pass', className: 'drss-input', type: 'password', value: pass,
        onChange: (event) => setPass(event.target.value),
        placeholder: email.passwordStored ? '••••••••' : '',
      }),
      h('p', { className: 'drss-formHint' }, tr('密码提示')),
      h('label', { className: 'drss-label', htmlFor: 'drss-mail-from' }, tr('发件人')),
      h('input', {
        id: 'drss-mail-from', className: 'drss-input', value: from,
        onChange: (event) => setFrom(event.target.value), placeholder: 'RSS 监控 <rss@example.com>',
      }),
      h('label', { className: 'drss-label', htmlFor: 'drss-mail-to' }, tr('收件人')),
      h('input', {
        id: 'drss-mail-to', className: 'drss-input', value: to, required: true,
        onChange: (event) => setTo(event.target.value), placeholder: 'me@example.com',
      }),
      h('div', { className: 'drss-checkRow' },
        h('input', {
          id: 'drss-mail-secure', type: 'checkbox', checked: secure,
          onChange: (event) => setSecure(event.target.checked),
        }),
        h('label', { htmlFor: 'drss-mail-secure' }, tr('使用 SSL/TLS（465 端口通常需要）'))),
      h('div', { className: 'drss-formActions' },
        status.email
          ? h('button', {
            type: 'button', className: 'drss-button drss-buttonDanger', disabled: busy,
            onClick: () => run(() => rpc(ENDPOINTS.emailRemove, {}), tr('操作成功')),
          }, tr('清除邮件配置'))
          : null,
        h('button', {
          type: 'button', className: 'drss-button', disabled: busy,
          onClick: async () => {
            await run(() => rpc(ENDPOINTS.emailSave, payload()), tr('操作成功'));
            await run(() => rpc(ENDPOINTS.emailTest, {}), tr('操作成功'));
          },
        }, tr('发送测试邮件')),
        h('button', { type: 'submit', className: 'drss-button drss-buttonPrimary', disabled: busy }, tr('保存邮件配置'))))),
  ];
}

function SettingsPanel({ status, busy, run, rpc, confirmAction }) {
  const [interval, setIntervalValue] = React.useState(String(status.settings?.checkInterval ?? 5));
  const [recentRows, setRecentRows] = React.useState(String(status.display?.recentItems ?? 10));
  const [historyRows, setHistoryRows] = React.useState(String(status.display?.historyItems ?? 10));
  React.useEffect(() => {
    setIntervalValue(String(status.settings?.checkInterval ?? 5));
    setRecentRows(String(status.display?.recentItems ?? 10));
    setHistoryRows(String(status.display?.historyItems ?? 10));
  }, [status.settings?.checkInterval, status.display?.recentItems, status.display?.historyItems]);
  return [
    h('section', { key: 'interval', className: 'drss-section' },
      h('h3', { style: { margin: '0 0 10px', fontSize: 14 } }, tr('运行设置')),
      h('div', { className: 'drss-settingsRows' },
        h('div', { className: 'drss-settingsRow' },
          h('label', { className: 'drss-label', htmlFor: 'drss-interval' }, tr('检查间隔')),
          h('input', {
            id: 'drss-interval',
            className: 'drss-input drss-inputSmall',
            type: 'number',
            min: 1,
            max: 1440,
            value: interval,
            disabled: busy,
            onChange: (event) => setIntervalValue(event.target.value),
          }),
          h('span', { className: 'drss-muted' }, tr('分钟')),
          h('label', { className: 'drss-label', htmlFor: 'drss-recent-rows' }, tr('最近发现条数')),
          h('input', {
            id: 'drss-recent-rows',
            className: 'drss-input drss-inputSmall',
            type: 'number',
            min: 1,
            max: 100,
            value: recentRows,
            disabled: busy,
            onChange: (event) => setRecentRows(event.target.value),
          }),
          h('span', { className: 'drss-muted' }, tr('条')),
          h('label', { className: 'drss-label', htmlFor: 'drss-history-rows' }, tr('检查历史条数')),
          h('input', {
            id: 'drss-history-rows',
            className: 'drss-input drss-inputSmall',
            type: 'number',
            min: 1,
            max: 100,
            value: historyRows,
            disabled: busy,
            onChange: (event) => setHistoryRows(event.target.value),
          }),
          h('span', { className: 'drss-muted' }, tr('条')),
          h('button', {
            type: 'button',
            className: 'drss-button',
            disabled: busy,
            onClick: () => run(
              () => rpc(ENDPOINTS.settingsSave, {
                checkInterval: Number(interval) || 5,
                display: {
                  recentItems: Math.trunc(Number(recentRows)) || 10,
                  historyItems: Math.trunc(Number(historyRows)) || 10,
                },
              }),
              tr('操作成功'),
            ),
          }, tr('保存'))))),
    h('section', { key: 'danger', className: 'drss-section' },
      h('h3', { style: { margin: '0 0 10px', fontSize: 14 } }, tr('数据记录')),
      h('div', { className: 'drss-settingsRows' },
        h('div', { className: 'drss-settingsRow' },
          h('button', {
            type: 'button',
            className: 'drss-button',
            disabled: busy,
            onClick: async () => {
              if (!(await confirmAction({
                title: tr('清除已通知记录'),
                message: tr('将清空去重列表和最近条目，相同条目可能再次通知。'),
                confirmLabel: tr('清除'),
              }))) return;
              await run(() => rpc(ENDPOINTS.itemsClear, {}), tr('操作成功'));
            },
          }, tr('清除已通知记录')),
          h('button', {
            type: 'button',
            className: 'drss-button',
            disabled: busy,
            onClick: async () => {
              if (!(await confirmAction({
                title: tr('清除检查历史'),
                message: tr('将清空全部检查历史记录。'),
                confirmLabel: tr('清除'),
              }))) return;
              await run(() => rpc(ENDPOINTS.historyClear, {}), tr('操作成功'));
            },
          }, tr('清除检查历史'))))),
  ];
}

export function RssSettingsTab({ rpcCall, version = '0.1.0' }) {
  const [status, setStatus] = React.useState(() => normalizeStatus(null));
  const [view, setView] = React.useState('overview');
  const [notice, setNotice] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmState, setConfirmState] = React.useState(null);
  const rpc = React.useCallback(async (endpoint, payload) => unwrapRssRpc(await rpcCall(endpoint, payload ?? {})), [rpcCall]);

  const confirmAction = React.useCallback((options) => new Promise((resolve) => {
    // Re-opening while a previous dialog is still pending auto-cancels it so
    // its awaiting handler can never fire twice.
    setConfirmState((current) => {
      current?.resolve?.(false);
      return { ...options, resolve };
    });
  }), []);
  const closeConfirm = React.useCallback((result) => {
    setConfirmState((current) => {
      current?.resolve?.(result);
      return null;
    });
  }, []);

  const lastStatusJson = React.useRef('');
  const refresh = React.useCallback(async () => {
    try {
      const next = normalizeStatus(await rpc(ENDPOINTS.status, {}));
      // Skip the re-render entirely when the poll returned identical data.
      const json = JSON.stringify(next);
      if (json !== lastStatusJson.current) {
        lastStatusJson.current = json;
        setStatus(next);
      }
    } catch (error) {
      setNotice({ type: 'error', text: `${tr('操作失败')}: ${shortErrorText(error.message)}` });
    }
  }, [rpc]);

  React.useEffect(() => {
    refresh();
    let inFlight = false;
    const timer = window.setInterval(() => {
      // Skip ticks while backgrounded or while the previous poll is still
      // in flight; manual actions always refresh immediately.
      if (document.hidden || inFlight) return;
      inFlight = true;
      Promise.resolve(refresh()).finally(() => { inFlight = false; });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const dismissNotice = React.useCallback(() => setNotice(null), []);

  const run = React.useCallback(async (operation, successText) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await operation();
      await refresh();
      setNotice({ type: 'success', text: successText });
      return result;
    } catch (error) {
      setNotice({ type: 'error', text: `${tr('操作失败')}: ${shortErrorText(error.message)}` });
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const views = [
    { id: 'overview', label: tr('概览') },
    { id: 'feeds', label: tr('RSS 源'), count: status.feeds?.length ?? 0 },
    { id: 'email', label: tr('邮件通知') },
    { id: 'settings', label: tr('运行设置') },
  ];

  return h('section', { className: 'drss-page', 'aria-label': tr('RSS 监控') },
    h('header', { className: 'drss-title' },
      h('div', { className: 'drss-brand' },
        h('div', { className: 'drss-brandHeading' },
          h('strong', { className: 'drss-brandName' }, 'DSH-RSS'),
          h('span', { className: 'drss-brandVersion' }, `v${version}`)),
        h('p', null, tr('让 Harness 帮你盯住订阅更新'))),
      h('div', { className: 'drss-titleActions' },
        h(Switch, {
          on: status.enabled,
          disabled: busy,
          label: status.enabled ? tr('运行中') : tr('已停止'),
          onChange: (enabled) => run(
            () => rpc(ENDPOINTS.settingsSave, { enabled }),
            enabled ? tr('启动监控') : tr('停止监控'),
          ),
        }),
        h('button', {
          type: 'button',
          className: 'drss-button drss-buttonPrimary',
          disabled: busy,
          onClick: () => run(() => rpc(ENDPOINTS.checkNow, {}), tr('操作成功')),
        }, busy ? tr('检查中…') : tr('立即检查')))),
    h('div', { className: 'drss-layout' },
      h('nav', { className: 'drss-rail', role: 'tablist', 'aria-label': tr('RSS 监控') },
        views.map((entry) => h('button', {
          key: entry.id,
          type: 'button',
          role: 'tab',
          className: 'drss-railButton',
          'aria-selected': view === entry.id,
          onClick: () => setView(entry.id),
        },
        h('span', null, entry.label),
        entry.count !== undefined ? h('span', { className: 'drss-railCount' }, String(entry.count)) : null))),
      h('main', { className: 'drss-panel', role: 'tabpanel' },
        view === 'overview' ? h(OverviewPanel, { status }) : null,
        view === 'feeds' ? h(FeedsPanel, { status, busy, run, rpc, confirmAction }) : null,
        view === 'email' ? h(EmailPanel, { status, busy, run, rpc }) : null,
        view === 'settings' ? h(SettingsPanel, { status, busy, run, rpc, confirmAction }) : null),
      h(Notice, { notice, onDismiss: dismissNotice }),
      confirmState ? h(ConfirmDialog, { options: confirmState, onClose: closeConfirm }) : null));
}
