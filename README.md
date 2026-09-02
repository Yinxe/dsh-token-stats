# @dshp-inx/token-stats

DeepSeek Harness (DSH) 统计插件：聚合本机全部会话日志的 Token 用量，在**设置页**展示。

## 功能

- **总览**：累计 Token（输入/输出/缓存分解）、峰值单次请求、峰值单日、当前/最长连续使用天数、活跃天数、会话数、调用次数、首次/最近使用
- **趋势**：按日/按周使用趋势线图（含累计曲线）+ 24 小时时段分布
- **热力图**：GitHub 风格近一年 Token 活动热力图（悬停显示当日用量）
- **模型分布**：环形图 + 各模型明细（占比、输入/输出/缓存分解、调用次数）
- **时间范围**：近 7/30/90 天 / 全部

## 统计口径

- 总 Token = inputTokens + cacheReadTokens + cacheWriteTokens + outputTokens
  （reasoningTokens 已含在 outputTokens，不重复计）
- 同一 (turn, step) 的 usage chunk 为早期采样、assistant/message usage 为终值，覆盖不重复累计
- fork/resume 会话跳过其 seedLength 条种子事件（父会话已计），不重复计数
- 含子代理会话（它们是真实用量）

数据源是 `sessionQuery` 服务实时扫描会话日志，无独立持久化——会话日志本身就是持久层。

## 安装（本机 DSH）

标准 DSH 插件包，放 `~/.dsh/plugins/token-stats`：

```sh
cd ~/.dsh/profiles/web
pnpm add "token-stats@link:../../plugins/token-stats"
# 重启
dsh web
```

加入 profile 的 `dsh.profile.bundles` 列表后 bundle patch 自动挂载，无需手动改 cordis.patch.yml。

重启后验证：设置 → Token 用量统计。
