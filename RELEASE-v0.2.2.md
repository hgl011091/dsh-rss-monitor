# dsh-rss-monitor v0.2.2

> Patch release: 修复 pnpm `allowBuilds` 攔截問題，恢復 DSH 一鍵安裝

## 🐛 修復

- **pnpm `allowBuilds` 攔截** — 之前 `devDependencies` 裡有 `esbuild@0.25.9`，而 esbuild 有 `postinstall` 腳本（下載 native binary）。pnpm 9+ 默認策略拒絕運行 postinstall → 整個 install 失敗
- **修復**：`package.json` 改為 `dependencies: {}` + `devDependencies: {}`。`rss-parser` 和 `nodemailer` 早就通過 esbuild 打包進了 `lib/index.js`，運行時不需要任何 npm 依賴
- **附帶修復**：`build.mjs` 改用 `execFileSync` 直接調用 esbuild CLI，繞開 DSH 桌面沙盒對 `spawn` 子進程的 EPERM 攔截

## ✅ 驗證

- 本地 `npm install --dry-run` 不再要求任何依賴
- 26 個文件 tarball 體積 164.5 kB
- `lib/client.js` (71.3 kB) + `lib/index.js` (388.7 kB) 自包含
- 58/58 單元測試通過

## 📦 安裝

```bash
# DSH Desktop（務必帶 @精確版本 + --save-exact）
dsh plugin --profile desktop add -wE dsh-rss-monitor@0.2.2

# DSH Web
dsh plugin --profile web add dsh-rss-monitor
```

> ⚠️ 安裝前先完全退出 DSH Desktop（托盤 → 退出）

## 🆕 v0.2.0 / v0.2.1 新增 (本版本繼承)

### 🗓️ 時間區間 (按星期 + 時間段)
- 自定義每周某幾天 + 具體時間段
- 窗口期內執行 RSS 檢查和郵件通知
- 跨午夜支持 (22:00-06:00 等)
- 窗口狀態實時顯示

### 💾 界面改進
- 保存按鈕移出方框
- 移除時區選擇器 (跟隨系統)
- 單次保存合併 (一個按鈕覆蓋所有"運行設置"字段)

### ⚡ 5 輪性能優化
**Client 端**:
- rpcCall 穩定身份 (ref 包裹)
- 5 個 React.memo (ItemCard, StatusCard, Switch, Notice, ConfirmDialog)
- i18n Map 緩存 (tr() 命中)
- Fingerprint 差異比對 (O(n) 字符串拼接)
- Slim lastKnownStatus

**Host 端**:
- ConfigStore/StateStore snapshot 緩存
- Controller.status() 完整結果 memo
- Monitor.onStateChanged 回環

## 🔗 鏈接

- **GitHub**: https://github.com/hgl011091/dsh-rss-monitor
- **NPM**: https://www.npmjs.com/package/dsh-rss-monitor
- **Tarball**: https://registry.npmjs.org/dsh-rss-monitor/-/dsh-rss-monitor-0.2.2.tgz

## 🧪 測試

- 58/58 單元測試通過
- 0 runtime errors / 0 React warnings
- Build: client.js (71.3 kB) + index.js (388.7 kB)