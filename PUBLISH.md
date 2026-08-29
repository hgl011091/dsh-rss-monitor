# 🚀 发布手册：让 dsh-rss-monitor 可以被任何电脑安装

四条安装路径的发布与维护 runbook。路径与 README「📦 安装」章节一一对应：

| 路径 | 用户命令 | 前提 | 本文章节 |
|---|---|---|---|
| 方式一（npm） | `dsh plugin --profile desktop add -w dsh-rss-monitor` | 发布到 npm | [路径一](#路径一发布到-npm桌面一键装的前提) |
| 方式二（github:） | `dsh plugin --profile desktop add -w github:hgl011091/dsh-rss-monitor` | 无（用户网络需通） | 无需发布动作 |
| 方式三（tarball） | `dsh plugin --profile desktop add -w "https://…/releases/latest/download/dsh-rss-monitor.tgz"` | GitHub Release 附带 tgz | [路径三](#路径三github-release-预构建-tarball) |
| 方式四（link） | 本地 clone + `dsh plugin add -w link:…` | 无 | [install-dsh-desktop.ps1](install-dsh-desktop.ps1) |

> 一次性仓库设置（做一次就够）：GitHub 仓库 **About ⚙ → Topics** 添加 `dsh-plugin`。awesome-dsh-plugin 的收录要求里有这一条。

---

## 路径一：发布到 npm（桌面一键装的前提）

**为什么必须发 npm**：DSH Desktop（anywhere-labs 版）的市场安装边界只接受 `name@精确版本` 的 npm 包，GitHub-only 插件在市场 UI 里会被直接拒装（`dshmarket/lib/dsh-cli.js` 的 `NPM_ONLY_HOST_NOTE`）。发到 npm 后，市场自动通过 `package.json` 的 `repository` 字段关联 npm↔仓库——**不需要也不允许**在收录条目里手写 `npm:` 字段。

包名 `dsh-rss-monitor` 当前未被占用（registry 404 已验证）。仓库元数据已修好：`repository` / `homepage` / `bugs` 都指向 `hgl011091/dsh-rss-monitor`，**幽灵依赖 `"dependencies": {"dsh-rss-monitor": "link:"}` 已清除**——那是曾在插件目录里中断的 `pnpm add` 留下的残留，不清掉的话所有人 `npm install` 都会失败。

### 发布步骤

```powershell
cd D:\HarnessProjects\dsh-rss-monitor

# 0. 发布前自检（产物完整性已验证过一次：22 个文件、lib/ 三件套齐全、dependencies 为空）
npm pack --pack-destination $env:TEMP --cache $env:TEMP\npm-cache-rss
# 应产出 dsh-rss-monitor-0.1.0.tgz

# 1. 登录（需要一个 npm 账号，npmjs.com 免费注册）
npm login

# 2. 发布
npm publish
```

### 发布后验证

```powershell
npm view dsh-rss-monitor version        # 应显示 0.1.0
npm view dsh-rss-monitor repository.url # 应指向 github.com/hgl011091/dsh-rss-monitor
```

然后实际装一遍（先退出 DSH Desktop）：

```powershell
dsh plugin --profile desktop add -w dsh-rss-monitor
```

### 以后发新版

```powershell
npm version patch   # 0.1.0 -> 0.1.1（或 minor / major）
git push --tags
npm publish
```

---

## 路径二：`github:` 源安装（无需发布动作，但用户网络是门槛）

不需要你做任何事——`dsh plugin --profile desktop add -w github:hgl011091/dsh-rss-monitor` 随时可用。**但**它的下载源是 `codeload.github.com`，中国大陆网络实测连接被重置，这条路径实际只对境外/代理用户可用。README 里已明确标注。

想让这条路径在国内可用，唯一办法是给仓库配代理镜像并在 README 注明（例如 `github:` 换成镜像域名的 tarball URL），属于可选项。

---

## 路径三：GitHub Release 预构建 tarball

让市场与 README 的「方式三」可用：Release 资产在国内通常比 codeload 稳定。收录条目（`awesome-dsh-plugin-entry.yml`）加上 `tarball:` 字段后，市场会优先展示预构建安装、跳过构建授权步骤。

**资产命名要求**：必须用**固定名** `dsh-rss-monitor.tgz`（不带版本号）——这样 `releases/latest/download/dsh-rss-monitor.tgz` 永远指向最新版，收录条目的 `tarball:` 字段不用每次发版都改。

### 发布步骤（首次）

```powershell
cd D:\HarnessProjects\dsh-rss-monitor

# 1. 生成 tarball（npm pack 产物即符合 pnpm/npm 安装格式）
npm pack --pack-destination $env:TEMP --cache $env:TEMP\npm-cache-rss

# 2. 重命名为固定名
Copy-Item "$env:TEMP\dsh-rss-monitor-0.1.0.tgz" "$env:TEMP\dsh-rss-monitor.tgz" -Force

# 3a. 有 gh CLI 的话：
gh release create v0.1.0 "$env:TEMP\dsh-rss-monitor.tgz" --title "v0.1.0" --notes "首个预构建发布"

# 3b. 没有 gh CLI：打开 https://github.com/hgl011091/dsh-rss-monitor/releases/new
#     Tag: v0.1.0  标题: v0.1.0  拖入 $env:TEMP\dsh-rss-monitor.tgz  Publish
```

### 发布后

1. 验证固定链接可达：浏览器打开
   `https://github.com/hgl011091/dsh-rss-monitor/releases/latest/download/dsh-rss-monitor.tgz`
2. 取消 `awesome-dsh-plugin-entry.yml` 里 `tarball:` 行的注释
3. （收录 PR 已合并的话）更新你 fork 里的条目文件并发 PR

### 以后发新版

```powershell
npm version patch && git push --tags
npm pack --pack-destination $env:TEMP --cache $env:TEMP\npm-cache-rss
Copy-Item "$env:TEMP\dsh-rss-monitor-0.1.1.tgz" "$env:TEMP\dsh-rss-monitor.tgz" -Force
gh release create v0.1.1 "$env:TEMP\dsh-rss-monitor.tgz" --title "v0.1.1" --notes "…"
```

---

## 路径四：收录到 awesome-dsh-plugin（市场可见性）

市场数据源 = `https://awesome-dsh-plugin.com/plugins.json`，由 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 仓库的 `data/plugins/*.yml` 每夜构建。收录后市场里能搜到本插件；配合路径一，桌面用户可一键装。

### 收录要求核对表

| 要求 | 状态 |
|---|---|
| `package.json` 声明 `dsh.bundle`（只有 `dsh.client` 会被拒） | ✅ `dsh.bundle.patch: ./cordis.patch.yml` |
| 仓库根有 `cordis.patch.yml`（纯 `id`/`name` insert 行） | ✅ |
| 仓库 ≥ 1 天 | ⚠️ 2026-08-28 21:35 创建——若 CI 卡这道，等满 24h 再提 |
| 提交数 ≥ 10 | ✅ 恰好 10 |
| 仓库 topic 含 `dsh-plugin` | ⚠️ 需要你在 GitHub About ⚙ 里手动添加 |
| 描述与代码相符（会被逐句核对） | ✅ 多源/关键词/定时去重/HTML 邮件/凭据库——均真实存在 |
| 分类贴切 | ✅ `notify`（通知与集成） |
| 一个 PR ≤ 3 条 | ✅ 只加 1 条 |

### PR 步骤

```bash
# 1. fork https://github.com/awesome-dsh-plugin/awesome-dsh-plugin，然后：
git clone https://github.com/<你的用户名>/awesome-dsh-plugin.git
cd awesome-dsh-plugin

# 2. 放入条目文件（内容 = 本仓库的 awesome-dsh-plugin-entry.yml；
#    做完路径三的话记得先取消 tarball: 行的注释）
cp /path/to/awesome-dsh-plugin-entry.yml data/plugins/hgl011091__dsh-rss-monitor.yml

# 3. 重新生成两个 README（仓库要求，勿手工编辑 README）
npm ci
node scripts/generate-readme.mjs

# 4. 提交 + 推分支 + 开 PR（base: awesome-dsh-plugin/awesome-dsh-plugin main）
git checkout -b add-dsh-rss-monitor
git add data/plugins/hgl011091__dsh-rss-monitor.yml README.md README.zh.md
git commit -m "Add hgl011091/dsh-rss-monitor"
git push -u origin add-dsh-rss-monitor
```

CI 会自动查 manifest、仓库年龄/提交数、README 可再生性；绿了之后维护者读源码合并。合并后网站与市场次日自动更新。

### 收录后验证

打开 `https://awesome-dsh-plugin.com/p/hgl011091/dsh-rss-monitor/`——当前是 404，收录成功后变成插件页。市场里搜「RSS」应出现卡片。

---

## 发布顺序建议

1. **路径一（npm）**——所有路径里价值最高：桌面一键装的前提，且国内网络无障碍
2. **路径三（Release tarball）**——5 分钟的事，给 npm 之外多一条国内可用通道
3. **路径四（收录 PR）**——做完 1、2 后再提（tarball 字段一次到位，避免 PR 来回改）；若 CI 卡仓库年龄就等满 24 小时
4. 路径二无需动作，README 已如实标注网络限制

## 一个 PR 只改自己条目

收录后若要更新描述/分类/截图，**只改 `data/plugins/hgl011091__dsh-rss-monitor.yml` 这一个文件**，重新生成 README 后提交。动别人的条目会被 gate 拦下（#1348 的教训）。
