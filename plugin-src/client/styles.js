export const RSS_STYLE_ID = 'dsh-rss-monitor-settings';

const CSS = String.raw`
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
.drss-historyTime { flex: none; width: auto; margin-right: -6px; color: var(--dsw-alias-label-tertiary, #8f959e); font: 500 12px/17px ui-monospace, SFMono-Regular, Menlo, monospace; }
.drss-historyBadge { flex: none; padding: 1px 8px; border-radius: 999px; background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: 17px; }
.drss-historyCount { color: var(--drss-green); font-weight: 620; }
.drss-historyError { min-width: 0; flex: 1; color: var(--dsw-alias-state-danger-primary, #d92d20); font-size: 12px; line-height: 17px; overflow-wrap: anywhere; }

.drss-twoCol { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; align-items: start; }
.drss-twoCol .drss-item { border: 1px solid var(--dsw-alias-border-l1, #eef0f3); border-radius: 10px; padding: 10px 12px; }
.drss-twoCol .drss-historyRow { border: 1px solid var(--dsw-alias-border-l1, #eef0f3); border-radius: 10px; padding: 8px 12px; }
@media (max-width: 720px) { .drss-twoCol { grid-template-columns: 1fr; } }

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
.drss-schedule { margin-top: 14px; border-top: 1px dashed var(--dsw-alias-border-l1, #eef0f3); padding-top: 12px; }
.drss-scheduleSummary { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; cursor: pointer; list-style: none; }
.drss-scheduleSummary::-webkit-details-marker { display: none; }
.drss-scheduleSummary::before { content: '▸'; display: inline-block; transition: transform .15s ease; color: var(--dsw-alias-label-tertiary, #8f959e); }
.drss-schedule[open] > .drss-scheduleSummary::before { transform: rotate(90deg); }
.drss-scheduleBody { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; }
.drss-scheduleRow { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
.drss-scheduleFields { display: flex; flex-direction: column; gap: 12px; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1, #eef0f3); border-radius: 10px; background: var(--dsw-alias-bg-layer-1, #fff); }
.drss-scheduleDays { border: 0; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 10px; }
.drss-scheduleDay { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
.drss-scheduleTimeRow { display: flex; flex-wrap: wrap; gap: 14px; }
.drss-scheduleTimeRow label { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--dsw-alias-label-tertiary, #8f959e); }
.drss-scheduleTimeRow input, .drss-scheduleTimeRow select { min-height: 30px; padding: 4px 8px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 6px; font: inherit; background: var(--dsw-alias-bg-layer-1, #fff); }
.drss-scheduleError { color: var(--dsw-alias-state-danger-primary, #d92d20); font-size: 12.5px; margin: 0; }
.drss-scheduleActions { display: flex; justify-content: flex-end; padding-top: 4px; }
.drss-scheduleTag { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: var(--dsw-alias-bg-layer-2, #f4f5f7); color: var(--dsw-alias-label-secondary, #646a73); }
.drss-scheduleTagOn { background: var(--drss-green-soft); color: var(--drss-green); }
.drss-scheduleTagInside { background: #fff7e6; color: #b25000; }
.drss-spacer { flex: 1; }
@media (max-width: 640px) {
  .drss-form { grid-template-columns: 1fr; }
  .drss-label { text-align: left; }
  .drss-formHint { grid-column: 1; }
  .drss-historyTime { width: auto; }
}
`;

/** Install the settings-page stylesheet once; returns a disposer. */
export function installRssStyles({ documentRef = globalThis.document } = {}) {
  if (!documentRef?.head) return () => {};
  const existing = documentRef.getElementById(RSS_STYLE_ID);
  if (existing) return () => {};
  const element = documentRef.createElement('style');
  element.id = RSS_STYLE_ID;
  element.textContent = CSS;
  documentRef.head.appendChild(element);
  return () => element.remove();
}
