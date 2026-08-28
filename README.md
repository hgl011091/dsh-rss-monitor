<div align="center">

# 📡 dsh-rss-monitor

**DeepSeek Harness 原生 RSS 订阅监控插件 —— 定时检查、关键词过滤、新条目邮件通知，原生设置页体验**

多源订阅 · 关键词过滤 · 智能去重 · HTML 邮件通知 · 凭据安全存储

![DSH Plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-6366f1)
![Node](https://img.shields.io/badge/node-%E2%89%A522.19-339933?logo=nodedotjs&logoColor=white)
![Tests](https://img.shields.io/badge/tests-37%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## ✨ 功能特性

| | 功能 | 说明 |
|---|---|---|
| 📡 | **多源订阅** | RSS 2.0 / Atom 均支持；添加前可「测试连接」预览标题与最新条目 |
| 🔍 | **关键词过滤** | 每源独立的**包含/排除**关键词（匹配标题与摘要），多个关键词逗号分隔 |
| ⏰ | **定时检查** | 间隔 1–1440 分钟可调（默认 5 分钟）；顶部开关启停监控；随时手动「立即检查」 |
| 🧹 | **智能去重** | `md5(feedUrl\|guid\|\|link\|\|title)` 前 16 位作为稳定 id，环形窗口上限 1000 条 |
| 📧 | **邮件通知** | SMTP（SSL 465 等），精美 HTML 模板带缩略图卡片，2s/4s 指数退避重试，可发测试邮件 |
| 🖥️ | **原生设置页** | 通过 slots 注入 Harness 设置界面：概览 / RSS 源 / 邮件通知 / 运行设置 四个页签，中英双语 |
| 📊 | **概览面板** | 运行状态、上次/下次检查、最近发现（缩略图原始比例、标题可点击）、检查历史（手动/自动、新条目数、错误） |
| 🔢 | **显示条数可调** | 「最近发现」与「检查历史」各 1–100 行自行设置，已记录条目始终显示真实总数 |
| 🔄 | **自动刷新** | 设置页每 15 秒拉取状态，数据无变化不重渲染，窗口后台自动暂停轮询 |
| 🔒 | **凭据安全** | SMTP 密码只存 Harness 凭据库（`DSH_RSS_SMTP_PASS_*`），配置文件中仅存引用 `passRef`，界面与磁盘永不见明文 |

## 📸 界面预览

> 将截图放入仓库 `docs/` 目录后替换下方路径。

<p align="center">
  <img src="docs/screenshot-settings.png" width="720" alt="DSH 设置页 - RSS 监控"/>
</p>

## 📦 安装

**方式一：dsh 命令（推荐）**

```bash
dsh plugin --profile desktop add -w /path/to/dsh-rss-monitor
```

**方式二：手动安装**

把插件文件夹（至少含 `lib/`、`package.json`、`cordis.patch.yml`，构建产物已自包含）放入或链接到 profile 的包目录：

```powershell
# Windows 开发联动（junction，无需管理员）
New-Item -ItemType Junction `
  -Path "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-rss-monitor" `
  -Target "D:\path\to\dsh-rss-monitor"
```

重启 Harness Desktop 后，「设置」中即出现「RSS 监控」。

> 插件数据存放在 `DSH_HOME/integrations/dsh-rss-monitor/`（`config.json` + `state.json`，临时文件 + rename 原子写入、owner-only 权限）。数据每台机器独立，不随插件目录迁移。

## 📖 使用

1. **RSS 源** → 「+ 添加 RSS 源」，填名称与 URL，可选关键词过滤，先「测试连接」再保存
2. **邮件通知** → 填 SMTP 主机/端口/账号/密码/收件人，保存后「发送测试邮件」验证（各大邮箱需使用授权码）
3. **运行设置** → 调整检查间隔与「最近发现 / 检查历史」显示条数；顶部开关启动/停止监控
4. **概览** → 查看运行状态、最近发现的新条目与检查历史；支持一键清除（带确认弹窗）

## 🏗️ 架构

```
dsh-rss-monitor/
├─ src/                 # Host/Client 共享层
│  ├─ protocol.mjs      #   协议单一来源：通道名、端点、限额、归一化规则
│  ├─ monitor.mjs       #   定时调度 + 有界并发检查 + 去重窗口
│  ├─ controller.mjs    #   11 个 RPC 端点的业务处理
│  ├─ config-store.mjs  #   配置存储（原子写、规范化）
│  ├─ state-store.mjs   #   运行状态存储（去重/最近/历史）
│  ├─ feed-fetcher.mjs  #   rss-parser 封装 + 缩略图提取
│  ├─ email-notifier.mjs#   nodemailer 封装（验证 + 重试）
│  └─ rpc.mjs           #   RPC 通道安装与错误信封
├─ plugin-src/host/     # Host 插件入口（inject: connection, credentials）+ esbuild 构建
├─ plugin-src/client/   # React 设置页（slots/locale/样式/i18n）+ esbuild 构建
├─ lib/                 # 构建产物：index.js（Host, ESM node22）、client.js（Client, CJS）
└─ test/                # node:test 单元测试套件
```

契约要点（与 dsh-im 插件模式对齐）：

- 通道名 `/dsh-rss-monitor`（满足 Harness 连接服务 `/^[A-Za-z0-9._~-]+$/` 校验，`/api` 保留），authority 默认 `loopback`
- RPC 载荷统一 `{ ok: true, value } | { ok: false, error: { code, message, details } }`，错误信封经客户端 zod schema 严格校验
- 客户端经 `window.__ModuleLoader__.load({ id: 'dsh-rss-monitor', factory })` 加载，React 由 Harness 注入
- SMTP 密码仅以凭据引用（`passRef`）出现在配置中，明文只存在于凭据存储

## 🛠️ 开发

```bash
npm install
npm run check   # 构建两端 bundle + 运行全部 37 个单元测试
npm test        # 仅跑测试（node:test）
```

| 构建 | 命令 | 产物 |
|---|---|---|
| Host | esbuild `--format=esm --platform=node --target=node22` | `lib/index.js`（rss-parser/nodemailer 已打包，自包含） |
| Client | esbuild `--format=cjs --platform=browser --target=chrome100` | `lib/client.js`（React external，由 Harness 提供） |

> 修改 Host 侧代码需重启 Harness Desktop；仅客户端改动硬刷新设置页即可。

## 🔗 相关项目

- **[rss-video-monitor](https://github.com/<你的用户名>/rss-video-monitor)** —— 同一套功能的 **Electron 独立桌面版**：不依赖 Harness，开箱即用的独立窗口应用（每 5 分钟检查、邮件通知、系统托盘）。

## 📄 License

[MIT](LICENSE)
