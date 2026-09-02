# @dshp-inx/token-stats

DeepSeek Harness（DSH) 统计插件：聚合本机全部会话日志的 Token 用量，在**设置页**展示；侧边栏底部附带「今日用量」常驻入口。

## 功能

- **总览**：累计 Token（输入/输出/缓存分解）、峰值单次请求、峰值单日、当前/最长连续使用天数、活跃天数、会话数、调用次数、首次/最近使用
- **趋势**：按日/按周使用趋势线图（含累计曲线）+ 24 小时时段分布
- **热力图**：GitHub 风格近一年 Token 活动热力图（悬停显示当日用量）
- **模型分布**：环形图 + 各模型明细（占比、输入/输出/缓存分解、调用次数）
- **今日入口**：侧边栏底部今日用量 + 逐小时模型堆叠图 + 昨日对比
- **时间范围**：近 7/30/90 天 / 全部

## 统计口径

- 总 Token = inputTokens + cacheReadTokens + cacheWriteTokens + outputTokens
  （reasoningTokens 已含在 outputTokens，不重复计）
- 同一 (turn, step) 的 usage chunk 为早期采样、assistant/message usage 为终值，覆盖不重复累计
- fork/resume 会话跳过其 seedLength 条种子事件（父会话已计），不重复计数
- 含子代理会话（它们是真实用量）

数据源是 `sessionQuery` 服务实时扫描会话日志，无独立持久化——会话日志本身就是持久层。

## 安装（推荐：GitHub）

```sh
dsh plugin --profile web add github:Yinxe/dsh-token-stats
```

`dsh plugin` 把参数转发给 profile 目录里的 pnpm，装完自动把插件写进 profile 的 `dsh.profile.bundles` 挂载列表 —— **无需手动改任何配置文件**。

重启生效：

```sh
dsh web
```

**验证**：打开 web 页面 → 设置 → Token 用量统计；侧边栏底部出现「今日」用量入口。

## 更新

```sh
dsh plugin --profile web update "token-stats" --latest
dsh web
```

`update --latest` 会让 pnpm 重新解析 GitHub 仓库的最新 commit 并更新 lockfile；重启后生效。

## 安装（备选：clone 源码 + 本地 link）

适合想改源码、或 GitHub 不可达的场景。link 安装的源码改动**即时生效**（client 半刷新页面即可，host 半需重启 `dsh web`）：

```sh
git clone git@github.com:Yinxe/dsh-token-stats.git ~/.dsh/plugins/token-stats
dsh plugin --profile web add "token-stats@link:~/.dsh/plugins/token-stats
# 若 pnpm 不展开 ~，改用绝对路径：
# dsh plugin --profile web add "token-stats@link:/home/<you>/.dsh/plugins/token-stats
dsh web
```

> ⚠️ **不要直接编辑 `node_modules/token-stats/` 里的文件**：pnpm 的安装文件与内容寻址 store 硬链接，直接覆盖会连带改坏 store。改源码请改 link 指向的源码目录。

link 方式的更新就是 `git pull`（源码目录）+ 刷新页面/重启。

## 卸载

```sh
dsh plugin --profile web remove "token-stats"
dsh web
```

`remove` 会自动从 `dsh.profile.bundles` 撤下挂载。

## 代码结构

```
lib/index.js     Host 半：sessionQuery 聚合 + /ext/token-stats/data 路由
lib/engine.js    聚合引擎（累计/峰值/连续天数/趋势/热力图/模型分解）
lib/fold.js      会话日志折叠抽取（usage 终值覆盖采样、seed 跳过）
lib/http.js      同源 JSON 路由
client.js        Client 半：__ModuleLoader__ bundle，设置页 + 侧边栏今日入口
cordis.patch.yml bundle 层 patch：仅 insert 挂载行
test/            fold 抽取单元测试（node test/fold.test.mjs）
```

## 免责声明

- 统计数据全部来自本机会话日志，无网络上报、无独立持久化；
- 本插件与 DeepSeek 官方无隶属关系。
