export const RSS_LOCALE_NAMESPACE = 'dsh-rss-monitor';

const EN = Object.freeze({
  '$locale': 'en',
  'RSS 监控': 'RSS Monitor',
  'RSS 订阅监控': 'RSS feed monitoring',
  '让 Harness 帮你盯住订阅更新': 'Let Harness watch your feeds',
  '概览': 'Overview',
  'RSS 源': 'Feeds',
  '邮件通知': 'Email notification',
  '运行设置': 'Runtime settings',
  '监控状态': 'Monitoring',
  '运行中': 'Running',
  '已停止': 'Stopped',
  '启动监控': 'Start monitoring',
  '停止监控': 'Stop monitoring',
  '立即检查': 'Check now',
  '检查中…': 'Checking…',
  '检查间隔': 'Check interval',
  '分钟': 'min',
  '上次检查': 'Last check',
  '下次检查': 'Next check',
  'RSS 源数量': 'Feeds',
  '已记录条目': 'Tracked items',
  '从未检查': 'Never checked',
  '暂无新条目': 'No new items yet',
  '最近发现': 'Recent items',
  '查看原文': 'Open link',
  '检查历史': 'Check history',
  '新条目': 'new',
  '手动': 'manual',
  '自动': 'scheduled',
  '无': 'none',
  '添加 RSS 源': 'Add feed',
  '编辑 RSS 源': 'Edit feed',
  '名称': 'Name',
  '地址 URL': 'Feed URL',
  '包含关键词': 'Include keywords',
  '排除关键词': 'Exclude keywords',
  '关键词提示': 'Separate multiple keywords with commas; leave include keywords empty to keep every item.',
  '保存': 'Save',
  '取消': 'Cancel',
  '编辑': 'Edit',
  '删除': 'Delete',
  '测试连接': 'Test',
  '测试通过': 'Feed parsed',
  '测试失败': 'Test failed',
  '启用': 'Enabled',
  '停用': 'Disabled',
  '确认删除该 RSS 源？': 'Delete this feed?',
  '还没有 RSS 源': 'No feeds yet',
  '还没有 RSS 源提示': 'Add a feed to start monitoring. Both RSS 2.0 and Atom are supported.',
  'SMTP 主机': 'SMTP host',
  '端口': 'Port',
  '使用 SSL/TLS（465 端口通常需要）': 'Use SSL/TLS (usually required for port 465)',
  '账号': 'Account',
  '密码': 'Password',
  '密码提示': 'Leave the password empty to keep the stored password. It is saved into the Harness credential store and never returned to the browser.',
  '发件人': 'From',
  '收件人': 'To',
  '保存邮件配置': 'Save email config',
  '发送测试邮件': 'Send test email',
  '清除邮件配置': 'Remove email config',
  '尚未配置邮件通知': 'Email notification is not configured yet',
  '已配置': 'Configured',
  '清除已通知记录': 'Clear tracked items',
  '清除检查历史': 'Clear check history',
  '确认操作': 'Confirm',
  '清除': 'Clear',
  '最近发现条数': 'Recent items rows',
  '检查历史条数': 'History rows',
  '删除 RSS 源': 'Delete RSS feed',
  '将删除该 RSS 源及其监控配置，已通知记录保留。': 'Removes this feed and its monitoring config. Tracked items are kept.',
  '将清空去重列表和最近条目，相同条目可能再次通知。': 'Clears the dedup list and recent items. Matching items may be notified again.',
  '将清空全部检查历史记录。': 'Clears the entire check history.',
  '数据记录': 'Data records',
  '新条目将在发现后通过邮件通知': 'New items are delivered by email once discovered',
  '邮件未配置，仅显示在概览中': 'Email is not configured; new items are only listed here',
  '操作成功': 'Done',
  '操作失败': 'Operation failed',
  '加载中…': 'Loading…',
  '暂无历史记录': 'No check history yet',
  '条': 'items',
  '条目内容过滤后为空属正常现象': 'An empty result is expected when filters exclude every item.',
  '时间区间': 'Time window',
  '启用时间区间': 'Enable time window',
  '启用时间区间帮助': '关闭时监控按原行为全时段运行；打开后只在下方设置的时间段内检查并通知。',
  '周日': 'Sun',
  '周一': 'Mon',
  '周二': 'Tue',
  '周三': 'Wed',
  '周四': 'Thu',
  '周五': 'Fri',
  '周六': 'Sat',
  '开始时间': 'Start time',
  '结束时间': 'End time',
  '不选任何天表示每天': 'No day selected = every day',
  '当前在窗口内': 'Currently inside the window',
  '当前在窗口外': 'Currently outside the window',
  '时间区间未启用': 'Time window is off',
  '时间区间已启用': 'Time window is on',
  '保存时间区间': 'Save time window',
  '时间区间配置不合法': 'Time window is invalid',
  '请输入有效的开始/结束时间': 'Enter a valid start/end time',
});

export const en = EN;
export const zh = Object.freeze(Object.fromEntries(
  Object.keys(EN).map((key) => [key, key === '$locale' ? 'zh' : key]),
));

let translator = null;
// Per-translator cache of resolved strings. setRssTranslator flushes
// the cache (a new translator may return a different string for the
// same key, e.g. when the user switches locale). tr() is on the hot
// path — every status poll re-renders the page and calls tr() many
// times — and the host's locale.bind call is not free (it crosses
// into a separate component). Caching the key→string answer keeps
// the steady-state cost at one Map.get per call.
//
// A small Map (the panel uses ~30 distinct keys) hits the prototype
// fast path and avoids the cost of allocating the cache key object
// that a plain object property bag would imply.
const trCache = new Map();

/** Install the namespace translator; used by apply() after locale.bind(). */
export function setRssTranslator(t) {
  translator = typeof t === 'function' ? t : null;
  trCache.clear();
}

/** Translate a source string with the registered translator (identity fallback). */
export function tr(key) {
  if (!translator) return key;
  const cached = trCache.get(key);
  if (cached !== undefined) return cached;
  const value = translator(key);
  if (typeof value === 'string' && value) {
    trCache.set(key, value);
    return value;
  }
  return key;
}

/** True when the active locale renders right-to-left-unfriendly raw keys. */
export function isEnglish() {
  return translator?.('$locale') === 'en';
}
