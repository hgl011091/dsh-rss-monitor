# dsh-rss-monitor v0.2.0

## 🆕 新增功能

### 时间区间 (每周定时监控)
现在可以**自定义指定每周的某几天 + 具体时间段**，只在窗口期内执行 RSS 检查和邮件通知。

- ✅ **按星期选择** — 周日 ~ 周六任意勾选，不选 = 每天
- ✅ **自定义时间窗口** — 设置开始时间和结束时间 (HH:MM)
- ✅ **窗口内自动检查** — 只有在窗口期内，定时器才会真正拉取 RSS
- ✅ **跨午夜支持** — 22:00-06:00 这类跨天窗口自动正确处理
- ✅ **窗口外状态显示** — UI 上实时显示"当前在窗口内/外/未启用"
- ✅ **单次保存** — 一个保存按钮覆盖所有"运行设置"字段（检查间隔、显示行数、时间区间）

## 🎨 界面改进

- **保存按钮移出方框** — 时间区间的"保存"按钮现在在方框外面、右对齐，不再挤在边框内
- **移除时区选择器** — 时区硬编码为系统时区，配置更简洁（UTC 选项已移除，配置文件中残留的 `UTC` 字段会被规范化忽略）
- **单次保存合并** — 之前"运行设置"页有两个保存按钮（间隔 + 窗口），现在合并为一个

## ⚡ 性能优化 (5 轮)

### Client 端
- **rpcCall 稳定身份** — 用 ref 包裹 host 传入的函数，避免 15s poll 重建 timer
- **5 个 React.memo** — `ItemCard`, `StatusCard`, `Switch`, `Notice`, `ConfirmDialog` 全部 memo 化
- **i18n Map 缓存** — `tr()` 重复 key 走 Map 命中，host locale 调用从 30/poll 降到 0
- **Fingerprint 差异比对** — 状态对比从 `JSON.stringify(payload)` 降到 14 字段 O(n) 字符串拼接
- **Slim lastKnownStatus** — 跨 remount 不 retain 重型 history/recentItems 数组

### Host 端
- **ConfigStore/StateStore snapshot 缓存** — `get()` 复用预构建 snapshot，避免每次 `structuredClone`
- **Controller.status() 完整结果 memo** — 三个 dirty flag 控制失效，稳态下 O(1) 返回
- **Monitor.onStateChanged 回环** — 定期检查后通过回调通知 controller 失效缓存

## 🐛 修复

- **陈旧 timezone 字段** — 配置文件中旧的 `"timezone": "UTC"` 会被规范化为 `"system"`
- **协议层 schedule 传递** — `normalizeStatus` 现在正确传递 `settings.schedule` 和 `settings.scheduleActive`

## 📦 安装

```bash
npm install dsh-rss-monitor@0.2.0
```

## 🔗 链接

- **GitHub**: https://github.com/hgl011091/dsh-rss-monitor
- **NPM**: https://www.npmjs.com/package/dsh-rss-monitor
- **Tarball**: https://registry.npmjs.org/dsh-rss-monitor/-/dsh-rss-monitor-0.2.0.tgz

## 📝 升级说明

从 v0.1.x 升级到 v0.2.0：
1. 重启 DSH Desktop
2. 打开设置 → RSS 监控 → 运行设置
3. 时间区间会自动用之前保存的值（旧 UTC 时区会被系统时区替换）
4. 点击"保存"即可应用

## ✅ 测试

- **58/58** 单元测试通过
- **0** runtime errors / **0** React warnings
- Build: client.js (71.3 kB) + index.js (389 kB)
