window.__ModuleLoader__.load({
  id: "dsh-rss-monitor",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugin-src/client/index.js
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name,
  version: () => version
});
module.exports = __toCommonJS(index_exports);
var React2 = __toESM(require("react"), 1);

// src/protocol.mjs
var RSS_PROTOCOL_VERSION = "dsh-rss-monitor.v1";
var RSS_RPC_CHANNEL = "/dsh-rss-monitor";
var RSS_RPC_ENDPOINTS = Object.freeze({
  status: "status",
  feedTest: "feed.test",
  feedSave: "feed.save",
  feedRemove: "feed.remove",
  settingsSave: "settings.save",
  checkNow: "check.now",
  emailSave: "email.save",
  emailTest: "email.test",
  emailRemove: "email.remove",
  itemsClear: "items.clear",
  historyClear: "history.clear"
});
var LIMITS = Object.freeze({
  maxFeeds: 100,
  maxFeedNameLength: 80,
  maxUrlLength: 2048,
  maxKeywordCount: 20,
  maxKeywordLength: 60,
  minCheckIntervalMinutes: 1,
  maxCheckIntervalMinutes: 1440,
  maxNotifiedItems: 1e3,
  maxRecentItems: 100,
  maxHistoryEntries: 50,
  maxEmailFieldLength: 254,
  maxDisplayRows: 100,
  smtpPassRefPattern: /^DSH_RSS_SMTP_PASS_[A-F0-9]{24}$/
});
var DEFAULT_SETTINGS = Object.freeze({
  checkInterval: 5,
  enabled: false
});
var DEFAULT_DISPLAY = Object.freeze({
  recentItems: 10,
  historyItems: 10
});
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function normalizeDisplay(value) {
  const base = isRecord(value) ? value : {};
  const clamp = (raw, fallback) => {
    const parsed = Math.trunc(Number(raw));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(LIMITS.maxDisplayRows, Math.max(1, parsed));
  };
  return Object.freeze({
    recentItems: clamp(base.recentItems ?? DEFAULT_DISPLAY.recentItems, DEFAULT_DISPLAY.recentItems),
    historyItems: clamp(base.historyItems ?? DEFAULT_DISPLAY.historyItems, DEFAULT_DISPLAY.historyItems)
  });
}
function normalizeStatus(value) {
  if (!isRecord(value)) {
    return {
      version: RSS_PROTOCOL_VERSION,
      running: false,
      enabled: false,
      lastCheck: null,
      nextCheckAt: null,
      settings: { ...DEFAULT_SETTINGS },
      feeds: [],
      email: null,
      emailConfigured: false,
      display: { ...DEFAULT_DISPLAY },
      recentItems: [],
      history: [],
      notifiedCount: 0
    };
  }
  const settings = isRecord(value.settings) ? value.settings : {};
  return {
    version: typeof value.version === "string" ? value.version : RSS_PROTOCOL_VERSION,
    running: value.running === true,
    enabled: value.enabled === true,
    lastCheck: typeof value.lastCheck === "string" ? value.lastCheck : null,
    nextCheckAt: typeof value.nextCheckAt === "string" ? value.nextCheckAt : null,
    settings: {
      checkInterval: Number.isInteger(settings.checkInterval) ? settings.checkInterval : DEFAULT_SETTINGS.checkInterval,
      enabled: settings.enabled === true
    },
    feeds: Array.isArray(value.feeds) ? value.feeds : [],
    email: isRecord(value.email) ? value.email : null,
    emailConfigured: value.emailConfigured === true,
    display: normalizeDisplay(value.display),
    recentItems: Array.isArray(value.recentItems) ? value.recentItems : [],
    history: Array.isArray(value.history) ? value.history : [],
    notifiedCount: Number.isInteger(value.notifiedCount) ? value.notifiedCount : 0
  };
}

// plugin-src/client/api.js
function unwrapRssRpc(result) {
  if (typeof result !== "object" || result === null || typeof result.ok !== "boolean") {
    const preview = (() => {
      try {
        const text = JSON.stringify(result) ?? String(result);
        return text.length > 140 ? `${text.slice(0, 140)}\u2026` : text;
      } catch {
        return String(result);
      }
    })();
    throw new Error(`RSS \u76D1\u63A7\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u54CD\u5E94\uFF08${preview}\uFF09`);
  }
  if (!result.ok) {
    const error = new Error(
      typeof result.error?.message === "string" ? result.error.message : "RSS \u76D1\u63A7\u64CD\u4F5C\u5931\u8D25"
    );
    error.code = typeof result.error?.code === "string" ? result.error.code : "rss-rpc-error";
    throw error;
  }
  return result.value;
}

// plugin-src/client/i18n.js
var RSS_LOCALE_NAMESPACE = "dsh-rss-monitor";
var EN = Object.freeze({
  "$locale": "en",
  "RSS \u76D1\u63A7": "RSS Monitor",
  "RSS \u8BA2\u9605\u76D1\u63A7": "RSS feed monitoring",
  "\u8BA9 Harness \u5E2E\u4F60\u76EF\u4F4F\u8BA2\u9605\u66F4\u65B0": "Let Harness watch your feeds",
  "\u6982\u89C8": "Overview",
  "RSS \u6E90": "Feeds",
  "\u90AE\u4EF6\u901A\u77E5": "Email notification",
  "\u8FD0\u884C\u8BBE\u7F6E": "Runtime settings",
  "\u76D1\u63A7\u72B6\u6001": "Monitoring",
  "\u8FD0\u884C\u4E2D": "Running",
  "\u5DF2\u505C\u6B62": "Stopped",
  "\u542F\u52A8\u76D1\u63A7": "Start monitoring",
  "\u505C\u6B62\u76D1\u63A7": "Stop monitoring",
  "\u7ACB\u5373\u68C0\u67E5": "Check now",
  "\u68C0\u67E5\u4E2D\u2026": "Checking\u2026",
  "\u68C0\u67E5\u95F4\u9694": "Check interval",
  "\u5206\u949F": "min",
  "\u4E0A\u6B21\u68C0\u67E5": "Last check",
  "\u4E0B\u6B21\u68C0\u67E5": "Next check",
  "RSS \u6E90\u6570\u91CF": "Feeds",
  "\u5DF2\u8BB0\u5F55\u6761\u76EE": "Tracked items",
  "\u4ECE\u672A\u68C0\u67E5": "Never checked",
  "\u6682\u65E0\u65B0\u6761\u76EE": "No new items yet",
  "\u6700\u8FD1\u53D1\u73B0": "Recent items",
  "\u67E5\u770B\u539F\u6587": "Open link",
  "\u68C0\u67E5\u5386\u53F2": "Check history",
  "\u65B0\u6761\u76EE": "new",
  "\u624B\u52A8": "manual",
  "\u81EA\u52A8": "scheduled",
  "\u65E0": "none",
  "\u6DFB\u52A0 RSS \u6E90": "Add feed",
  "\u7F16\u8F91 RSS \u6E90": "Edit feed",
  "\u540D\u79F0": "Name",
  "\u5730\u5740 URL": "Feed URL",
  "\u5305\u542B\u5173\u952E\u8BCD": "Include keywords",
  "\u6392\u9664\u5173\u952E\u8BCD": "Exclude keywords",
  "\u5173\u952E\u8BCD\u63D0\u793A": "Separate multiple keywords with commas; leave include keywords empty to keep every item.",
  "\u4FDD\u5B58": "Save",
  "\u53D6\u6D88": "Cancel",
  "\u7F16\u8F91": "Edit",
  "\u5220\u9664": "Delete",
  "\u6D4B\u8BD5\u8FDE\u63A5": "Test",
  "\u6D4B\u8BD5\u901A\u8FC7": "Feed parsed",
  "\u6D4B\u8BD5\u5931\u8D25": "Test failed",
  "\u542F\u7528": "Enabled",
  "\u505C\u7528": "Disabled",
  "\u786E\u8BA4\u5220\u9664\u8BE5 RSS \u6E90\uFF1F": "Delete this feed?",
  "\u8FD8\u6CA1\u6709 RSS \u6E90": "No feeds yet",
  "\u8FD8\u6CA1\u6709 RSS \u6E90\u63D0\u793A": "Add a feed to start monitoring. Both RSS 2.0 and Atom are supported.",
  "SMTP \u4E3B\u673A": "SMTP host",
  "\u7AEF\u53E3": "Port",
  "\u4F7F\u7528 SSL/TLS\uFF08465 \u7AEF\u53E3\u901A\u5E38\u9700\u8981\uFF09": "Use SSL/TLS (usually required for port 465)",
  "\u8D26\u53F7": "Account",
  "\u5BC6\u7801": "Password",
  "\u5BC6\u7801\u63D0\u793A": "Leave the password empty to keep the stored password. It is saved into the Harness credential store and never returned to the browser.",
  "\u53D1\u4EF6\u4EBA": "From",
  "\u6536\u4EF6\u4EBA": "To",
  "\u4FDD\u5B58\u90AE\u4EF6\u914D\u7F6E": "Save email config",
  "\u53D1\u9001\u6D4B\u8BD5\u90AE\u4EF6": "Send test email",
  "\u6E05\u9664\u90AE\u4EF6\u914D\u7F6E": "Remove email config",
  "\u5C1A\u672A\u914D\u7F6E\u90AE\u4EF6\u901A\u77E5": "Email notification is not configured yet",
  "\u5DF2\u914D\u7F6E": "Configured",
  "\u6E05\u9664\u5DF2\u901A\u77E5\u8BB0\u5F55": "Clear tracked items",
  "\u6E05\u9664\u68C0\u67E5\u5386\u53F2": "Clear check history",
  "\u786E\u8BA4\u64CD\u4F5C": "Confirm",
  "\u6E05\u9664": "Clear",
  "\u6700\u8FD1\u53D1\u73B0\u6761\u6570": "Recent items rows",
  "\u68C0\u67E5\u5386\u53F2\u6761\u6570": "History rows",
  "\u5220\u9664 RSS \u6E90": "Delete RSS feed",
  "\u5C06\u5220\u9664\u8BE5 RSS \u6E90\u53CA\u5176\u76D1\u63A7\u914D\u7F6E\uFF0C\u5DF2\u901A\u77E5\u8BB0\u5F55\u4FDD\u7559\u3002": "Removes this feed and its monitoring config. Tracked items are kept.",
  "\u5C06\u6E05\u7A7A\u53BB\u91CD\u5217\u8868\u548C\u6700\u8FD1\u6761\u76EE\uFF0C\u76F8\u540C\u6761\u76EE\u53EF\u80FD\u518D\u6B21\u901A\u77E5\u3002": "Clears the dedup list and recent items. Matching items may be notified again.",
  "\u5C06\u6E05\u7A7A\u5168\u90E8\u68C0\u67E5\u5386\u53F2\u8BB0\u5F55\u3002": "Clears the entire check history.",
  "\u6570\u636E\u8BB0\u5F55": "Data records",
  "\u65B0\u6761\u76EE\u5C06\u5728\u53D1\u73B0\u540E\u901A\u8FC7\u90AE\u4EF6\u901A\u77E5": "New items are delivered by email once discovered",
  "\u90AE\u4EF6\u672A\u914D\u7F6E\uFF0C\u4EC5\u663E\u793A\u5728\u6982\u89C8\u4E2D": "Email is not configured; new items are only listed here",
  "\u64CD\u4F5C\u6210\u529F": "Done",
  "\u64CD\u4F5C\u5931\u8D25": "Operation failed",
  "\u52A0\u8F7D\u4E2D\u2026": "Loading\u2026",
  "\u6682\u65E0\u5386\u53F2\u8BB0\u5F55": "No check history yet",
  "\u6761": "items",
  "\u6761\u76EE\u5185\u5BB9\u8FC7\u6EE4\u540E\u4E3A\u7A7A\u5C5E\u6B63\u5E38\u73B0\u8C61": "An empty result is expected when filters exclude every item."
});
var zh = Object.freeze(Object.fromEntries(
  Object.keys(EN).map((key) => [key, key === "$locale" ? "zh" : key])
));
var translator = null;
function setRssTranslator(t) {
  translator = typeof t === "function" ? t : null;
}
function tr(key) {
  if (translator) {
    const value = translator(key);
    if (typeof value === "string" && value) return value;
  }
  return key;
}

// plugin-src/client/styles.js
var RSS_STYLE_ID = "dsh-rss-monitor-settings";
var CSS = String.raw`
.drss-page {
  --drss-green: var(--dsw-alias-state-success-primary, #16a34a);
  --drss-green-soft: color-mix(in srgb, var(--drss-green) 10%, transparent);
  width: 100%;
  max-width: 1080px;
  padding: 2px 0 30px;
  color: var(--dsw-alias-label-primary, #1f2329);
  box-sizing: border-box;
  position: relative;
}
.drss-page *, .drss-page *::before, .drss-page *::after { box-sizing: border-box; }
.drss-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 0 0 18px; }
.drss-brand { min-width: 0; width: max-content; max-width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
.drss-brandHeading { display: flex; align-items: baseline; gap: 8px; white-space: nowrap; }
.drss-brandName { color: var(--dsw-alias-label-primary, #1f2329); font-size: 21px; line-height: 26px; font-weight: 800; letter-spacing: .04em; }
.drss-brandVersion { color: var(--dsw-alias-label-tertiary, #8f959e); font: 500 10px/16px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0; }
.drss-title p { margin: 0; color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 19px; font-weight: 500; white-space: nowrap; }
.drss-titleActions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }

.drss-button { min-height: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 6px 13px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 8px; color: var(--dsw-alias-label-secondary, #646a73); background: var(--dsw-alias-bg-layer-1, #fff); font: inherit; font-size: 13px; line-height: 19px; font-weight: 560; cursor: pointer; transition: border-color .15s ease, color .15s ease, background .15s ease; }
.drss-button:hover:not(:disabled) { border-color: #aeb3bb; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.drss-button:focus-visible { outline: 2px solid var(--drss-green); outline-offset: 2px; }
.drss-button:disabled { opacity: .55; cursor: default; }
.drss-buttonPrimary, .drss-buttonPrimary:hover:not(:disabled) { border-color: var(--drss-green); color: #fff; background: var(--drss-green); }
.drss-buttonDanger { color: var(--dsw-alias-state-danger-primary, #d92d20); }
.drss-buttonDanger:hover:not(:disabled) { border-color: var(--dsw-alias-state-danger-primary, #d92d20); color: var(--dsw-alias-state-danger-primary, #d92d20); }
.drss-buttonDangerSolid, .drss-buttonDangerSolid:hover:not(:disabled) { border-color: #d92d20; color: #fff; background: #d92d20; }
.drss-buttonDangerSolid:focus-visible { outline: 2px solid rgba(217, 45, 32, .55); outline-offset: 2px; }

.drss-modalBackdrop { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 24px; background: rgb(15 18 22 / 45%); animation: drssFadeIn .15s ease; }
.drss-modal { width: min(400px, 100%); padding: 22px 22px 18px; border: 1px solid var(--dsw-alias-border-l1, #eef0f3); border-radius: 14px; background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: 0 18px 50px rgb(0 0 0 / 22%); animation: drssModalIn .16s ease; }
.drss-modalIcon { width: 40px; height: 40px; margin-bottom: 12px; border-radius: 12px; display: grid; place-items: center; background: rgba(217, 45, 32, .1); color: #d92d20; font-size: 22px; font-weight: 700; }
.drss-modalTitle { margin: 0 0 6px; color: var(--dsw-alias-label-primary, #1f2329); font-size: 15px; line-height: 22px; font-weight: 680; }
.drss-modalMessage { margin: 0 0 18px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 20px; overflow-wrap: anywhere; }
.drss-modalActions { display: flex; justify-content: flex-end; gap: 8px; }
@keyframes drssFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes drssModalIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

.drss-switch { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; border: none; background: transparent; padding: 5px 10px; border-radius: 999px; font: inherit; transition: background .15s ease; }
.drss-switch:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.drss-switch:focus-visible { outline: 2px solid var(--drss-green); outline-offset: 2px; }
.drss-switch:disabled { opacity: .55; cursor: default; }
.drss-switchTrack { position: relative; width: 40px; height: 22px; border-radius: 999px; background: var(--dsw-alias-border-l2, #dfe1e5); transition: background .18s ease; flex: none; }
.drss-switchOn .drss-switchTrack { background: var(--drss-green); box-shadow: 0 0 0 3px var(--drss-green-soft); }
.drss-switchKnob { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 25%); transition: transform .18s ease; }
.drss-switchOn .drss-switchKnob { transform: translateX(18px); }
.drss-switchLabel { font-size: 13px; line-height: 19px; font-weight: 560; color: var(--dsw-alias-label-secondary, #646a73); transition: color .15s ease; }
.drss-switchOn .drss-switchLabel { color: var(--drss-green); font-weight: 640; }

.drss-toastWrap { position: fixed; right: 24px; bottom: 24px; z-index: 9999; display: flex; justify-content: flex-end; pointer-events: none; max-width: min(480px, calc(100vw - 48px)); }
/* useLayoutEffect overrides right/bottom to pin the toast to the settings
   scroll container's visible bottom-right corner (measured per show). */
.drss-notice { pointer-events: auto; width: fit-content; max-width: 100%; display: inline-flex; align-items: center; gap: 9px; padding: 9px 12px 9px 15px; border: 1px solid var(--dsw-alias-border-l1, #eef0f3); border-radius: 999px; background: var(--dsw-alias-bg-layer-1, #fff); color: var(--dsw-alias-label-primary, #1f2329); font-size: 13px; line-height: 19px; box-shadow: 0 10px 30px rgb(0 0 0 / 14%); animation: drssToastIn .18s ease; }
.drss-noticeError { border-color: rgba(217, 45, 32, .4); color: #d92d20; background: #feefee; }
.drss-noticeSuccess { border-color: rgba(22, 163, 74, .4); color: #16a34a; background: #e9f7ef; }
.drss-noticeDot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; opacity: .9; flex: none; }
.drss-noticeText { overflow-wrap: anywhere; }
.drss-noticeClose { border: none; background: transparent; color: inherit; font: inherit; font-size: 15px; line-height: 1; padding: 2px 4px; cursor: pointer; opacity: .55; border-radius: 50%; flex: none; }
.drss-noticeClose:hover { opacity: 1; }
@keyframes drssToastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.drss-layout { display: flex; flex-direction: column; gap: 14px; }
.drss-rail { display: flex; flex-direction: row; flex-wrap: nowrap; gap: 4px; width: 100%; padding: 4px; border: 1px solid var(--dsw-alias-border-l1, #eef0f3); border-radius: 12px; background: var(--dsw-alias-bg-layer-1, #fff); }
.drss-railButton { flex: 1 1 0; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 9px 10px; border: 1px solid transparent; border-radius: 9px; background: transparent; color: var(--dsw-alias-label-secondary, #646a73); font: inherit; font-size: 14px; line-height: 21px; font-weight: 560; text-align: center; white-space: nowrap; cursor: pointer; transition: background .15s ease, color .15s ease, border-color .15s ease; }
.drss-railButton:hover { background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); color: var(--dsw-alias-label-primary, #1f2329); }
.drss-railButton[aria-selected='true'] { border-color: color-mix(in srgb, var(--drss-green) 35%, transparent); background: var(--drss-green-soft); color: var(--drss-green); font-weight: 640; }
.drss-railCount { margin-left: 4px; font: 500 11px/17px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--dsw-alias-label-tertiary, #8f959e); }

.drss-panel { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.drss-panelHeading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.drss-panelHeading h3 { margin: 0; font-size: 15px; line-height: 23px; font-weight: 680; }
.drss-panelHint { margin: 2px 0 0; color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 12.5px; line-height: 19px; }

.drss-statusGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.drss-statusCard { padding: 13px 15px; border: 1px solid var(--dsw-alias-border-l1, #eef0f3); border-radius: 12px; background: var(--dsw-alias-bg-layer-1, #fff); }
.drss-statusCard dt { margin: 0 0 4px; color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 12px; line-height: 17px; font-weight: 560; }
.drss-statusCard dd { margin: 0; color: var(--dsw-alias-label-primary, #1f2329); font-size: 14px; line-height: 21px; font-weight: 620; overflow-wrap: anywhere; }
.drss-statusRun { color: var(--drss-green) !important; }
.drss-statusStop { color: var(--dsw-alias-label-tertiary, #8f959e) !important; }

.drss-section { padding: 15px 17px; border: 1px solid var(--dsw-alias-border-l1, #eef0f3); border-radius: 12px; background: var(--dsw-alias-bg-layer-1, #fff); }
.drss-empty { padding: 22px 16px; text-align: center; color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 14px; line-height: 21px; }
.drss-empty strong { display: block; margin-bottom: 4px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 14px; }

.drss-item { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-top: 1px solid var(--dsw-alias-border-l1, #eef0f3); }
.drss-item:first-of-type { border-top: none; }
.drss-itemThumb { width: 72px; height: auto; flex: none; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1, #eef0f3); background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.drss-itemThumbFallback { width: 72px; height: 48px; flex: none; border-radius: 8px; display: grid; place-items: center; border: 1px dashed var(--dsw-alias-border-l2, #dfe1e5); background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 16px; }
.drss-itemBody { min-width: 0; flex: 1; }
.drss-itemFeed { margin: 0 0 2px; color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 12px; line-height: 17px; }
.drss-itemTitle { margin: 0; color: var(--dsw-alias-label-primary, #1f2329); font-size: 14px; line-height: 21px; font-weight: 620; overflow-wrap: anywhere; }
.drss-itemTitle a { color: inherit; text-decoration: none; }
.drss-itemTitle a:hover { color: var(--drss-green); text-decoration: underline; }
.drss-itemMeta { margin: 4px 0 0; color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 12px; line-height: 17px; }

.drss-historyRow { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--dsw-alias-border-l1, #eef0f3); font-size: 13px; line-height: 19px; }
.drss-historyRow:first-of-type { border-top: none; }
.drss-historyTime { flex: none; width: 140px; color: var(--dsw-alias-label-tertiary, #8f959e); font: 500 12px/17px ui-monospace, SFMono-Regular, Menlo, monospace; }
.drss-historyBadge { flex: none; padding: 1px 8px; border-radius: 999px; background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: 17px; }
.drss-historyCount { color: var(--drss-green); font-weight: 620; }
.drss-historyError { min-width: 0; flex: 1; color: var(--dsw-alias-state-danger-primary, #d92d20); font-size: 12px; line-height: 17px; overflow-wrap: anywhere; }

.drss-feedCard { padding: 13px 15px; border: 1px solid var(--dsw-alias-border-l1, #eef0f3); border-radius: 12px; background: var(--dsw-alias-bg-layer-1, #fff); display: flex; flex-direction: column; gap: 6px; }
.drss-feedHead { display: flex; align-items: center; gap: 8px; }
.drss-feedName { min-width: 0; flex: 1; margin: 0; font-size: 14px; line-height: 21px; font-weight: 660; overflow-wrap: anywhere; }
.drss-feedUrl { margin: 0; color: var(--dsw-alias-label-tertiary, #8f959e); font: 500 12px/17px ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
.drss-feedKeywords { display: flex; flex-wrap: wrap; gap: 4px; }
.drss-chip { padding: 2px 9px; border-radius: 999px; background: var(--drss-green-soft); color: var(--drss-green); font-size: 12px; line-height: 17px; }
.drss-chipExclude { background: color-mix(in srgb, var(--dsw-alias-state-danger-primary, #d92d20) 8%, transparent); color: var(--dsw-alias-state-danger-primary, #d92d20); }
.drss-chipMuted { background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); color: var(--dsw-alias-label-tertiary, #8f959e); }
.drss-feedActions { display: flex; gap: 6px; margin-left: auto; flex: none; }

.drss-form { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 10px 14px; align-items: center; }
.drss-formWide { grid-column: 1 / -1; }
.drss-label { color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 19px; font-weight: 560; text-align: right; }
.drss-input, .drss-fieldsetInput { width: 100%; min-height: 34px; padding: 6px 11px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 8px; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-layer-1, #fff); font: inherit; font-size: 14px; line-height: 20px; }
.drss-input:focus-visible, .drss-fieldsetInput:focus-visible { outline: 2px solid var(--drss-green); outline-offset: 1px; border-color: var(--drss-green); }
.drss-inputSmall { width: 110px; }
.drss-formHint { grid-column: 2; margin: -4px 0 0; color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 12px; line-height: 17px; }
.drss-formActions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.drss-checkRow { display: flex; align-items: center; gap: 8px; font-size: 14px; line-height: 21px; }
.drss-preview { margin-top: 4px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--drss-green) 30%, var(--dsw-alias-border-l2, #dfe1e5)); border-radius: 10px; background: var(--drss-green-soft); font-size: 13px; line-height: 19px; overflow-wrap: anywhere; }
.drss-preview strong { font-weight: 660; }
.drss-previewError { border-color: rgba(217, 45, 32, .4); background: #feefee; color: #d92d20; }
.drss-settingsRows { display: flex; flex-direction: column; gap: 14px; }
.drss-settingsRow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.drss-settingsRow .drss-label { text-align: left; width: auto; }
.drss-muted { color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 12.5px; line-height: 19px; }
.drss-spacer { flex: 1; }
@media (max-width: 640px) {
  .drss-form { grid-template-columns: 1fr; }
  .drss-label { text-align: left; }
  .drss-formHint { grid-column: 1; }
  .drss-historyTime { width: auto; }
}
`;
function installRssStyles({ documentRef = globalThis.document } = {}) {
  if (!documentRef?.head) return () => {
  };
  const existing = documentRef.getElementById(RSS_STYLE_ID);
  if (existing) return () => {
  };
  const element = documentRef.createElement("style");
  element.id = RSS_STYLE_ID;
  element.textContent = CSS;
  documentRef.head.appendChild(element);
  return () => element.remove();
}

// plugin-src/client/app.js
var React = __toESM(require("react"), 1);
var POLL_MS = 15e3;
function h(type, props, ...children) {
  return React.createElement(type, props, ...children);
}
function formatTime(value) {
  if (!value) return tr("\u4ECE\u672A\u68C0\u67E5");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
function shortErrorText(message) {
  const firstLine = String(message ?? "").split(/\r?\n/)[0].trim();
  return firstLine.length > 96 ? `${firstLine.slice(0, 96)}\u2026` : firstLine;
}
function Switch({ on, onChange, disabled, label }) {
  return h(
    "button",
    {
      type: "button",
      className: `drss-switch${on ? " drss-switchOn" : ""}`,
      role: "switch",
      "aria-checked": on,
      disabled,
      onClick: () => onChange(!on)
    },
    h(
      "span",
      { className: "drss-switchTrack", "aria-hidden": "true" },
      h("span", { className: "drss-switchKnob" })
    ),
    label ? h("span", { className: "drss-switchLabel" }, label) : null
  );
}
function Notice({ notice, onDismiss }) {
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    if (!notice) return void 0;
    const timer = window.setTimeout(onDismiss, notice.type === "error" ? 6e3 : 3e3);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);
  React.useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !notice) return;
    try {
      const doc = document;
      const rootEl = doc.querySelector(".drss-page");
      let node = rootEl?.parentElement ?? null;
      let scroller = null;
      while (node && node !== doc.body && node !== doc.documentElement) {
        const style = doc.defaultView?.getComputedStyle(node);
        if (style && (style.overflowY === "auto" || style.overflowY === "scroll")) {
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
        wrap.style.right = "24px";
        wrap.style.bottom = "24px";
      }
    } catch {
    }
  }, [notice]);
  if (!notice) return null;
  return h(
    "div",
    { ref: wrapRef, className: "drss-toastWrap" },
    h(
      "div",
      {
        className: `drss-notice${notice.type === "error" ? " drss-noticeError" : " drss-noticeSuccess"}`,
        role: "status"
      },
      h("span", { className: "drss-noticeDot", "aria-hidden": "true" }),
      h("span", { className: "drss-noticeText" }, notice.text),
      h("button", {
        type: "button",
        className: "drss-noticeClose",
        onClick: onDismiss,
        "aria-label": tr("\u53D6\u6D88")
      }, "\xD7")
    )
  );
}
function ConfirmDialog({ options, onClose }) {
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return h(
    "div",
    { className: "drss-modalBackdrop", onClick: () => onClose(false) },
    h(
      "div",
      {
        className: "drss-modal",
        role: "alertdialog",
        "aria-modal": "true",
        "aria-label": options.title,
        onClick: (event) => event.stopPropagation()
      },
      h("div", { className: "drss-modalIcon", "aria-hidden": "true" }, "!"),
      h("h4", { className: "drss-modalTitle" }, options.title),
      h("p", { className: "drss-modalMessage" }, options.message),
      h(
        "div",
        { className: "drss-modalActions" },
        h("button", {
          type: "button",
          className: "drss-button",
          onClick: () => onClose(false)
        }, tr("\u53D6\u6D88")),
        h("button", {
          type: "button",
          className: "drss-button drss-buttonDangerSolid",
          autoFocus: true,
          onClick: () => onClose(true)
        }, options.confirmLabel)
      )
    )
  );
}
function StatusCard({ label, value, tone }) {
  return h(
    "div",
    { className: "drss-statusCard" },
    h("dt", null, label),
    h("dd", { className: tone === "run" ? "drss-statusRun" : tone === "stop" ? "drss-statusStop" : void 0 }, value)
  );
}
function ItemCard({ item }) {
  const thumb = item.thumbnail ? h("img", { className: "drss-itemThumb", src: item.thumbnail, alt: "", loading: "lazy" }) : h("span", { className: "drss-itemThumbFallback", "aria-hidden": "true" }, "\u{1F3AC}");
  return h(
    "div",
    { className: "drss-item" },
    thumb,
    h(
      "div",
      { className: "drss-itemBody" },
      h("p", { className: "drss-itemFeed" }, item.feedName || "RSS"),
      h(
        "p",
        { className: "drss-itemTitle" },
        item.link ? h("a", { href: item.link, target: "_blank", rel: "noopener noreferrer" }, item.title) : item.title
      ),
      h(
        "p",
        { className: "drss-itemMeta" },
        `${tr("\u4E0A\u6B21\u68C0\u67E5")}: ${formatTime(item.pubDate ?? item.discoveredAt)}`
      )
    )
  );
}
function OverviewPanel({ status }) {
  const history = status.history ?? [];
  const recent = status.recentItems ?? [];
  return [
    h(
      "div",
      { key: "grid", className: "drss-statusGrid" },
      h(StatusCard, {
        label: tr("\u76D1\u63A7\u72B6\u6001"),
        value: status.running ? tr("\u8FD0\u884C\u4E2D") : tr("\u5DF2\u505C\u6B62"),
        tone: status.running ? "run" : "stop"
      }),
      h(StatusCard, {
        label: tr("\u68C0\u67E5\u95F4\u9694"),
        value: `${status.settings?.checkInterval ?? 5} ${tr("\u5206\u949F")}`
      }),
      h(StatusCard, { label: tr("\u4E0A\u6B21\u68C0\u67E5"), value: formatTime(status.lastCheck) }),
      h(StatusCard, {
        label: tr("\u4E0B\u6B21\u68C0\u67E5"),
        value: status.running ? formatTime(status.nextCheckAt) : tr("\u65E0")
      }),
      h(StatusCard, { label: tr("RSS \u6E90\u6570\u91CF"), value: String(status.feeds?.length ?? 0) }),
      h(StatusCard, { label: tr("\u5DF2\u8BB0\u5F55\u6761\u76EE"), value: String(status.notifiedCount ?? 0) })
    ),
    h(
      "div",
      { key: "mail", className: "drss-muted" },
      status.emailConfigured ? tr("\u65B0\u6761\u76EE\u5C06\u5728\u53D1\u73B0\u540E\u901A\u8FC7\u90AE\u4EF6\u901A\u77E5") : tr("\u90AE\u4EF6\u672A\u914D\u7F6E\uFF0C\u4EC5\u663E\u793A\u5728\u6982\u89C8\u4E2D")
    ),
    h(
      "section",
      { key: "recent", className: "drss-section" },
      h(
        "div",
        { className: "drss-panelHeading" },
        h("h3", null, tr("\u6700\u8FD1\u53D1\u73B0")),
        h("span", { className: "drss-muted" }, `${recent.length} ${tr("\u6761")}`)
      ),
      recent.length === 0 ? h("p", { className: "drss-empty" }, tr("\u6682\u65E0\u65B0\u6761\u76EE")) : recent.map((item) => h(ItemCard, { key: item.id, item }))
    ),
    h(
      "section",
      { key: "history", className: "drss-section" },
      h(
        "div",
        { className: "drss-panelHeading" },
        h("h3", null, tr("\u68C0\u67E5\u5386\u53F2"))
      ),
      history.length === 0 ? h("p", { className: "drss-empty" }, tr("\u6682\u65E0\u5386\u53F2\u8BB0\u5F55")) : history.map((entry, index) => h(
        "div",
        { key: entry.timestamp ?? index, className: "drss-historyRow" },
        h("span", { className: "drss-historyTime" }, formatTime(entry.timestamp)),
        h("span", { className: "drss-historyBadge" }, entry.manual ? tr("\u624B\u52A8") : tr("\u81EA\u52A8")),
        h("span", { className: "drss-historyCount" }, `+${entry.newCount ?? 0} ${tr("\u65B0\u6761\u76EE")}`),
        entry.errors?.length ? h(
          "span",
          { className: "drss-historyError" },
          entry.errors.map((err) => `${err.feed}: ${err.error}`).join("\uFF1B")
        ) : null
      ))
    )
  ];
}
function FeedEditor({ initial, busy, onCancel, onSave, onTest }) {
  const [name2, setName] = React.useState(initial?.name ?? "");
  const [url, setUrl] = React.useState(initial?.url ?? "");
  const [keywords, setKeywords] = React.useState((initial?.keywords ?? []).join(", "));
  const [exclude, setExclude] = React.useState((initial?.excludeKeywords ?? []).join(", "));
  const [enabled, setEnabled] = React.useState(initial?.enabled ?? true);
  const [preview, setPreview] = React.useState(null);
  const [previewError, setPreviewError] = React.useState(null);
  const split = (value) => value.split(/[,，;；\n]/).map((part) => part.trim()).filter(Boolean);
  const feed = () => ({
    ...initial?.id ? { id: initial.id } : {},
    name: name2,
    url: url.trim(),
    enabled,
    keywords: split(keywords),
    excludeKeywords: split(exclude)
  });
  return h(
    "form",
    {
      className: "drss-section",
      onSubmit: (event) => {
        event.preventDefault();
        onSave(feed());
      }
    },
    h("h3", { style: { margin: "0 0 10px", fontSize: 14 } }, initial?.id ? tr("\u7F16\u8F91 RSS \u6E90") : tr("\u6DFB\u52A0 RSS \u6E90")),
    h(
      "div",
      { className: "drss-form" },
      h("label", { className: "drss-label", htmlFor: "drss-feed-name" }, tr("\u540D\u79F0")),
      h("input", {
        id: "drss-feed-name",
        className: "drss-input",
        value: name2,
        required: true,
        maxLength: 80,
        onChange: (event) => setName(event.target.value),
        placeholder: "\u5C11\u6570\u6D3E"
      }),
      h("label", { className: "drss-label", htmlFor: "drss-feed-url" }, tr("\u5730\u5740 URL")),
      h("input", {
        id: "drss-feed-url",
        className: "drss-input",
        type: "url",
        value: url,
        required: true,
        maxLength: 2048,
        onChange: (event) => {
          setUrl(event.target.value);
          setPreview(null);
          setPreviewError(null);
        },
        placeholder: "https://example.com/feed"
      }),
      h("button", {
        type: "button",
        className: "drss-button",
        disabled: busy || !url.trim(),
        onClick: async () => {
          setPreview(null);
          setPreviewError(null);
          try {
            setPreview(await onTest(url.trim()));
          } catch (error) {
            setPreviewError(shortErrorText(error.message));
          }
        }
      }, tr("\u6D4B\u8BD5\u8FDE\u63A5")),
      h("span", null),
      h("label", { className: "drss-label", htmlFor: "drss-feed-kw" }, tr("\u5305\u542B\u5173\u952E\u8BCD")),
      h("input", {
        id: "drss-feed-kw",
        className: "drss-input",
        value: keywords,
        onChange: (event) => setKeywords(event.target.value),
        placeholder: tr("\u5305\u542B\u5173\u952E\u8BCD")
      }),
      h("label", { className: "drss-label", htmlFor: "drss-feed-ex" }, tr("\u6392\u9664\u5173\u952E\u8BCD")),
      h("input", {
        id: "drss-feed-ex",
        className: "drss-input",
        value: exclude,
        onChange: (event) => setExclude(event.target.value),
        placeholder: tr("\u6392\u9664\u5173\u952E\u8BCD")
      }),
      h("p", { className: "drss-formHint" }, tr("\u5173\u952E\u8BCD\u63D0\u793A")),
      h(
        "div",
        { className: "drss-checkRow" },
        h(Switch, { on: enabled, onChange: setEnabled, disabled: busy, label: enabled ? tr("\u542F\u7528") : tr("\u505C\u7528") })
      ),
      preview ? h(
        "div",
        { className: "drss-preview" },
        h("strong", null, `${tr("\u6D4B\u8BD5\u901A\u8FC7")}: `),
        `${preview.title || url} \xB7 ${preview.itemsCount} ${tr("\u6761")}`,
        preview.latestItem?.title ? ` \xB7 ${preview.latestItem.title}` : null
      ) : null,
      previewError ? h(
        "div",
        { className: "drss-preview drss-previewError" },
        `${tr("\u6D4B\u8BD5\u5931\u8D25")}: ${previewError}`
      ) : null,
      h(
        "div",
        { className: "drss-formActions" },
        h("button", { type: "button", className: "drss-button", disabled: busy, onClick: onCancel }, tr("\u53D6\u6D88")),
        h("button", { type: "submit", className: "drss-button drss-buttonPrimary", disabled: busy }, tr("\u4FDD\u5B58"))
      )
    )
  );
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
        await run(() => rpc(RSS_RPC_ENDPOINTS.feedSave, { feed }), tr("\u64CD\u4F5C\u6210\u529F"));
        setEditing(null);
      },
      onTest: async (url) => {
        const result = await rpc(RSS_RPC_ENDPOINTS.feedTest, { url });
        return result;
      }
    });
  }
  return [
    h(
      "div",
      { key: "actions", className: "drss-panelHeading" },
      h(
        "div",
        null,
        h("h3", null, tr("RSS \u6E90")),
        h("p", { className: "drss-panelHint" }, tr("\u8FD8\u6CA1\u6709 RSS \u6E90\u63D0\u793A"))
      ),
      h("button", {
        type: "button",
        className: "drss-button drss-buttonPrimary",
        disabled: busy,
        onClick: () => setEditing({})
      }, `+ ${tr("\u6DFB\u52A0 RSS \u6E90")}`)
    ),
    feeds.length === 0 ? h(
      "div",
      { key: "empty", className: "drss-section drss-empty" },
      h("strong", null, tr("\u8FD8\u6CA1\u6709 RSS \u6E90")),
      tr("\u8FD8\u6CA1\u6709 RSS \u6E90\u63D0\u793A")
    ) : feeds.map(
      (feed) => h(
        "div",
        { key: feed.id, className: "drss-feedCard" },
        h(
          "div",
          { className: "drss-feedHead" },
          h("p", { className: "drss-feedName" }, feed.name),
          h(
            "div",
            { className: "drss-feedActions" },
            h("button", {
              type: "button",
              className: "drss-button",
              disabled: busy,
              onClick: () => run(
                () => rpc(RSS_RPC_ENDPOINTS.feedSave, { feed: { ...feed, enabled: !feed.enabled } }),
                tr("\u64CD\u4F5C\u6210\u529F")
              )
            }, feed.enabled ? tr("\u505C\u7528") : tr("\u542F\u7528")),
            h("button", {
              type: "button",
              className: "drss-button",
              disabled: busy,
              onClick: () => setEditing(feed)
            }, tr("\u7F16\u8F91")),
            h("button", {
              type: "button",
              className: "drss-button drss-buttonDanger",
              disabled: busy,
              onClick: async () => {
                if (!await confirmAction({
                  title: tr("\u5220\u9664 RSS \u6E90"),
                  message: tr("\u5C06\u5220\u9664\u8BE5 RSS \u6E90\u53CA\u5176\u76D1\u63A7\u914D\u7F6E\uFF0C\u5DF2\u901A\u77E5\u8BB0\u5F55\u4FDD\u7559\u3002"),
                  confirmLabel: tr("\u5220\u9664")
                })) return;
                await run(() => rpc(RSS_RPC_ENDPOINTS.feedRemove, { id: feed.id }), tr("\u64CD\u4F5C\u6210\u529F"));
              }
            }, tr("\u5220\u9664"))
          )
        ),
        h("p", { className: "drss-feedUrl" }, feed.url),
        h(
          "div",
          { className: "drss-feedKeywords" },
          h(
            "span",
            { className: `drss-chip${feed.enabled ? "" : " drss-chipMuted"}` },
            feed.enabled ? tr("\u542F\u7528") : tr("\u505C\u7528")
          ),
          (feed.keywords ?? []).map((keyword) => h("span", { key: `k-${keyword}`, className: "drss-chip" }, keyword)),
          (feed.excludeKeywords ?? []).map((keyword) => h("span", { key: `x-${keyword}`, className: "drss-chip drss-chipExclude" }, `-${keyword}`))
        )
      )
    )
  ];
}
function EmailPanel({ status, busy, run, rpc }) {
  const email = status.email ?? {};
  const [host, setHost] = React.useState(email.host ?? "");
  const [port, setPort] = React.useState(String(email.port ?? 465));
  const [secure, setSecure] = React.useState(email.secure ?? true);
  const [user, setUser] = React.useState(email.user ?? "");
  const [pass, setPass] = React.useState("");
  const [from, setFrom] = React.useState(email.from ?? "");
  const [to, setTo] = React.useState(email.to ?? "");
  React.useEffect(() => {
    setHost(email.host ?? "");
    setPort(String(email.port ?? 465));
    setSecure(email.secure ?? true);
    setUser(email.user ?? "");
    setFrom(email.from ?? "");
    setTo(email.to ?? "");
    setPass("");
  }, [status.email?.host, status.email?.port, status.email?.user, status.email?.to]);
  const payload = () => ({
    host: host.trim(),
    port: Number(port) || 465,
    secure,
    user: user.trim(),
    pass: pass.length > 0 ? pass : void 0,
    from: from.trim(),
    to: to.trim()
  });
  return [
    h(
      "div",
      { key: "head", className: "drss-panelHeading" },
      h(
        "div",
        null,
        h("h3", null, tr("\u90AE\u4EF6\u901A\u77E5")),
        h(
          "p",
          { className: "drss-panelHint" },
          status.emailConfigured ? tr("\u5DF2\u914D\u7F6E") : tr("\u5C1A\u672A\u914D\u7F6E\u90AE\u4EF6\u901A\u77E5")
        )
      )
    ),
    h(
      "form",
      {
        key: "form",
        className: "drss-section",
        onSubmit: (event) => {
          event.preventDefault();
          run(() => rpc(RSS_RPC_ENDPOINTS.emailSave, payload()), tr("\u64CD\u4F5C\u6210\u529F"));
        }
      },
      h(
        "div",
        { className: "drss-form" },
        h("label", { className: "drss-label", htmlFor: "drss-mail-host" }, tr("SMTP \u4E3B\u673A")),
        h("input", {
          id: "drss-mail-host",
          className: "drss-input",
          value: host,
          required: true,
          onChange: (event) => setHost(event.target.value),
          placeholder: "smtp.example.com"
        }),
        h("label", { className: "drss-label", htmlFor: "drss-mail-port" }, tr("\u7AEF\u53E3")),
        h("input", {
          id: "drss-mail-port",
          className: "drss-input drss-inputSmall",
          type: "number",
          min: 1,
          max: 65535,
          value: port,
          onChange: (event) => setPort(event.target.value)
        }),
        h("label", { className: "drss-label", htmlFor: "drss-mail-user" }, tr("\u8D26\u53F7")),
        h("input", {
          id: "drss-mail-user",
          className: "drss-input",
          value: user,
          onChange: (event) => setUser(event.target.value),
          placeholder: "user@example.com"
        }),
        h("label", { className: "drss-label", htmlFor: "drss-mail-pass" }, tr("\u5BC6\u7801")),
        h("input", {
          id: "drss-mail-pass",
          className: "drss-input",
          type: "password",
          value: pass,
          onChange: (event) => setPass(event.target.value),
          placeholder: email.passwordStored ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : ""
        }),
        h("p", { className: "drss-formHint" }, tr("\u5BC6\u7801\u63D0\u793A")),
        h("label", { className: "drss-label", htmlFor: "drss-mail-from" }, tr("\u53D1\u4EF6\u4EBA")),
        h("input", {
          id: "drss-mail-from",
          className: "drss-input",
          value: from,
          onChange: (event) => setFrom(event.target.value),
          placeholder: "RSS \u76D1\u63A7 <rss@example.com>"
        }),
        h("label", { className: "drss-label", htmlFor: "drss-mail-to" }, tr("\u6536\u4EF6\u4EBA")),
        h("input", {
          id: "drss-mail-to",
          className: "drss-input",
          value: to,
          required: true,
          onChange: (event) => setTo(event.target.value),
          placeholder: "me@example.com"
        }),
        h(
          "div",
          { className: "drss-checkRow" },
          h("input", {
            id: "drss-mail-secure",
            type: "checkbox",
            checked: secure,
            onChange: (event) => setSecure(event.target.checked)
          }),
          h("label", { htmlFor: "drss-mail-secure" }, tr("\u4F7F\u7528 SSL/TLS\uFF08465 \u7AEF\u53E3\u901A\u5E38\u9700\u8981\uFF09"))
        ),
        h(
          "div",
          { className: "drss-formActions" },
          status.email ? h("button", {
            type: "button",
            className: "drss-button drss-buttonDanger",
            disabled: busy,
            onClick: () => run(() => rpc(RSS_RPC_ENDPOINTS.emailRemove, {}), tr("\u64CD\u4F5C\u6210\u529F"))
          }, tr("\u6E05\u9664\u90AE\u4EF6\u914D\u7F6E")) : null,
          h("button", {
            type: "button",
            className: "drss-button",
            disabled: busy,
            onClick: async () => {
              await run(() => rpc(RSS_RPC_ENDPOINTS.emailSave, payload()), tr("\u64CD\u4F5C\u6210\u529F"));
              await run(() => rpc(RSS_RPC_ENDPOINTS.emailTest, {}), tr("\u64CD\u4F5C\u6210\u529F"));
            }
          }, tr("\u53D1\u9001\u6D4B\u8BD5\u90AE\u4EF6")),
          h("button", { type: "submit", className: "drss-button drss-buttonPrimary", disabled: busy }, tr("\u4FDD\u5B58\u90AE\u4EF6\u914D\u7F6E"))
        )
      )
    )
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
    h(
      "section",
      { key: "interval", className: "drss-section" },
      h("h3", { style: { margin: "0 0 10px", fontSize: 14 } }, tr("\u8FD0\u884C\u8BBE\u7F6E")),
      h(
        "div",
        { className: "drss-settingsRows" },
        h(
          "div",
          { className: "drss-settingsRow" },
          h("label", { className: "drss-label", htmlFor: "drss-interval" }, tr("\u68C0\u67E5\u95F4\u9694")),
          h("input", {
            id: "drss-interval",
            className: "drss-input drss-inputSmall",
            type: "number",
            min: 1,
            max: 1440,
            value: interval,
            disabled: busy,
            onChange: (event) => setIntervalValue(event.target.value)
          }),
          h("span", { className: "drss-muted" }, tr("\u5206\u949F")),
          h("label", { className: "drss-label", htmlFor: "drss-recent-rows" }, tr("\u6700\u8FD1\u53D1\u73B0\u6761\u6570")),
          h("input", {
            id: "drss-recent-rows",
            className: "drss-input drss-inputSmall",
            type: "number",
            min: 1,
            max: 100,
            value: recentRows,
            disabled: busy,
            onChange: (event) => setRecentRows(event.target.value)
          }),
          h("span", { className: "drss-muted" }, tr("\u6761")),
          h("label", { className: "drss-label", htmlFor: "drss-history-rows" }, tr("\u68C0\u67E5\u5386\u53F2\u6761\u6570")),
          h("input", {
            id: "drss-history-rows",
            className: "drss-input drss-inputSmall",
            type: "number",
            min: 1,
            max: 100,
            value: historyRows,
            disabled: busy,
            onChange: (event) => setHistoryRows(event.target.value)
          }),
          h("span", { className: "drss-muted" }, tr("\u6761")),
          h("button", {
            type: "button",
            className: "drss-button",
            disabled: busy,
            onClick: () => run(
              () => rpc(RSS_RPC_ENDPOINTS.settingsSave, {
                checkInterval: Number(interval) || 5,
                display: {
                  recentItems: Math.trunc(Number(recentRows)) || 10,
                  historyItems: Math.trunc(Number(historyRows)) || 10
                }
              }),
              tr("\u64CD\u4F5C\u6210\u529F")
            )
          }, tr("\u4FDD\u5B58"))
        )
      )
    ),
    h(
      "section",
      { key: "danger", className: "drss-section" },
      h("h3", { style: { margin: "0 0 10px", fontSize: 14 } }, tr("\u6570\u636E\u8BB0\u5F55")),
      h(
        "div",
        { className: "drss-settingsRows" },
        h(
          "div",
          { className: "drss-settingsRow" },
          h("button", {
            type: "button",
            className: "drss-button",
            disabled: busy,
            onClick: async () => {
              if (!await confirmAction({
                title: tr("\u6E05\u9664\u5DF2\u901A\u77E5\u8BB0\u5F55"),
                message: tr("\u5C06\u6E05\u7A7A\u53BB\u91CD\u5217\u8868\u548C\u6700\u8FD1\u6761\u76EE\uFF0C\u76F8\u540C\u6761\u76EE\u53EF\u80FD\u518D\u6B21\u901A\u77E5\u3002"),
                confirmLabel: tr("\u6E05\u9664")
              })) return;
              await run(() => rpc(RSS_RPC_ENDPOINTS.itemsClear, {}), tr("\u64CD\u4F5C\u6210\u529F"));
            }
          }, tr("\u6E05\u9664\u5DF2\u901A\u77E5\u8BB0\u5F55")),
          h("button", {
            type: "button",
            className: "drss-button",
            disabled: busy,
            onClick: async () => {
              if (!await confirmAction({
                title: tr("\u6E05\u9664\u68C0\u67E5\u5386\u53F2"),
                message: tr("\u5C06\u6E05\u7A7A\u5168\u90E8\u68C0\u67E5\u5386\u53F2\u8BB0\u5F55\u3002"),
                confirmLabel: tr("\u6E05\u9664")
              })) return;
              await run(() => rpc(RSS_RPC_ENDPOINTS.historyClear, {}), tr("\u64CD\u4F5C\u6210\u529F"));
            }
          }, tr("\u6E05\u9664\u68C0\u67E5\u5386\u53F2"))
        )
      )
    )
  ];
}
function RssSettingsTab({ rpcCall, version: version2 = "0.1.0" }) {
  const [status, setStatus] = React.useState(() => normalizeStatus(null));
  const [view, setView] = React.useState("overview");
  const [notice, setNotice] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmState, setConfirmState] = React.useState(null);
  const rpc = React.useCallback(async (endpoint, payload) => unwrapRssRpc(await rpcCall(endpoint, payload ?? {})), [rpcCall]);
  const confirmAction = React.useCallback((options) => new Promise((resolve) => {
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
  const lastStatusJson = React.useRef("");
  const refresh = React.useCallback(async () => {
    try {
      const next = normalizeStatus(await rpc(RSS_RPC_ENDPOINTS.status, {}));
      const json = JSON.stringify(next);
      if (json !== lastStatusJson.current) {
        lastStatusJson.current = json;
        setStatus(next);
      }
    } catch (error) {
      setNotice({ type: "error", text: `${tr("\u64CD\u4F5C\u5931\u8D25")}: ${shortErrorText(error.message)}` });
    }
  }, [rpc]);
  React.useEffect(() => {
    refresh();
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      Promise.resolve(refresh()).finally(() => {
        inFlight = false;
      });
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
      setNotice({ type: "success", text: successText });
      return result;
    } catch (error) {
      setNotice({ type: "error", text: `${tr("\u64CD\u4F5C\u5931\u8D25")}: ${shortErrorText(error.message)}` });
      return void 0;
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  const views = [
    { id: "overview", label: tr("\u6982\u89C8") },
    { id: "feeds", label: tr("RSS \u6E90"), count: status.feeds?.length ?? 0 },
    { id: "email", label: tr("\u90AE\u4EF6\u901A\u77E5") },
    { id: "settings", label: tr("\u8FD0\u884C\u8BBE\u7F6E") }
  ];
  return h(
    "section",
    { className: "drss-page", "aria-label": tr("RSS \u76D1\u63A7") },
    h(
      "header",
      { className: "drss-title" },
      h(
        "div",
        { className: "drss-brand" },
        h(
          "div",
          { className: "drss-brandHeading" },
          h("strong", { className: "drss-brandName" }, "DSH-RSS"),
          h("span", { className: "drss-brandVersion" }, `v${version2}`)
        ),
        h("p", null, tr("\u8BA9 Harness \u5E2E\u4F60\u76EF\u4F4F\u8BA2\u9605\u66F4\u65B0"))
      ),
      h(
        "div",
        { className: "drss-titleActions" },
        h(Switch, {
          on: status.enabled,
          disabled: busy,
          label: status.enabled ? tr("\u8FD0\u884C\u4E2D") : tr("\u5DF2\u505C\u6B62"),
          onChange: (enabled) => run(
            () => rpc(RSS_RPC_ENDPOINTS.settingsSave, { enabled }),
            enabled ? tr("\u542F\u52A8\u76D1\u63A7") : tr("\u505C\u6B62\u76D1\u63A7")
          )
        }),
        h("button", {
          type: "button",
          className: "drss-button drss-buttonPrimary",
          disabled: busy,
          onClick: () => run(() => rpc(RSS_RPC_ENDPOINTS.checkNow, {}), tr("\u64CD\u4F5C\u6210\u529F"))
        }, busy ? tr("\u68C0\u67E5\u4E2D\u2026") : tr("\u7ACB\u5373\u68C0\u67E5"))
      )
    ),
    h(
      "div",
      { className: "drss-layout" },
      h(
        "nav",
        { className: "drss-rail", role: "tablist", "aria-label": tr("RSS \u76D1\u63A7") },
        views.map((entry) => h(
          "button",
          {
            key: entry.id,
            type: "button",
            role: "tab",
            className: "drss-railButton",
            "aria-selected": view === entry.id,
            onClick: () => setView(entry.id)
          },
          h("span", null, entry.label),
          entry.count !== void 0 ? h("span", { className: "drss-railCount" }, String(entry.count)) : null
        ))
      ),
      h(
        "main",
        { className: "drss-panel", role: "tabpanel" },
        view === "overview" ? h(OverviewPanel, { status }) : null,
        view === "feeds" ? h(FeedsPanel, { status, busy, run, rpc, confirmAction }) : null,
        view === "email" ? h(EmailPanel, { status, busy, run, rpc }) : null,
        view === "settings" ? h(SettingsPanel, { status, busy, run, rpc, confirmAction }) : null
      ),
      h(Notice, { notice, onDismiss: dismissNotice }),
      confirmState ? h(ConfirmDialog, { options: confirmState, onClose: closeConfirm }) : null
    )
  );
}

// plugin-src/client/index.js
var name = "dsh-rss-monitor";
var version = "0.1.0";
var inject = ["slots", "connection", "locale"];
function apply(ctx) {
  const t = ctx.locale.bind(RSS_LOCALE_NAMESPACE);
  setRssTranslator(t);
  ctx.effect(() => () => setRssTranslator(null), "dsh-rss-monitor: release translator");
  ctx.effect(
    () => installRssStyles(),
    "dsh-rss-monitor: settings stylesheet"
  );
  const rpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(
    RSS_RPC_CHANNEL,
    endpoint,
    payload,
    signal
  );
  ctx.slots.inject(
    "settings.section",
    () => ctx.slots.register({
      name: "settings.section",
      id: "dsh-rss-monitor",
      order: 22,
      label: () => t("RSS \u76D1\u63A7"),
      locale: RSS_LOCALE_NAMESPACE,
      inject: () => ({ rpcCall, version })
    }, RssSettingsTab),
    "dsh-rss-monitor: settings page"
  );
  return { version, normalizeStatus };
}

    return module.exports;
  }
});
