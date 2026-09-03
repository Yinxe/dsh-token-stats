/**
 * fold.js 单元测试 —— 聚合语义验证（无依赖，node 直接跑）。
 *
 * 用法：node test/fold.test.mjs
 */
import { foldSession, compactAgg, reviveAgg, dayKey } from '../lib/fold.js'
import assert from 'node:assert'

const ev = (seq, type, data, time) => ({ seq, type, time, data })
const T = 1700000000000

// ── 1. 终值覆盖：chunk 采样被 message usage 覆盖，不重复累计 ──────────────
{
  const log = [
    ev(0, 'request/header', { header: { config: { provider: 'zai', model: 'glm-4.6' } }, reason: 'initial' }, T),
    ev(1, 'assistant/chunk', { turn: 0, step: 0, chunk: { type: 'usage', usage: { inputTokens: 100, outputTokens: 50 } } }, T), // 早期采样
    ev(2, 'assistant/message', { turn: 0, step: 0, message: { source: { kind: 'model', provider: 'zai', model: 'glm-4.6' } }, usage: { inputTokens: 120, outputTokens: 80, cacheReadTokens: 40 } }, T) // 终值
  ]
  const r = foldSession(log, 0)
  const total = [...r.records.values()].reduce((s, x) => s + x.i + x.o + x.cr + x.cw, 0)
  assert.strictEqual(total, 240, '终值覆盖：120+80+40=240')
  assert.strictEqual(r.peak.tokens, 240)
  console.log('✓ 1. 终值覆盖语义')
}

// ── 2. 跨 step 累计 ──────────────────────────────────────────────────────
{
  const log = [
    ev(0, 'assistant/message', { turn: 0, step: 0, message: { source: { kind: 'model', provider: 'p', model: 'm' } }, usage: { inputTokens: 10, outputTokens: 5 } }, T),
    ev(1, 'assistant/chunk', { turn: 1, step: 0, chunk: { type: 'usage', usage: { inputTokens: 7, outputTokens: 3 } } }, T + 5000),
    ev(2, 'assistant/message', { turn: 1, step: 0, message: { source: { kind: 'model', provider: 'p', model: 'm' } } }, T + 6000) // 无 usage → 保留 chunk
  ]
  const r = foldSession(log, 0)
  const total = [...r.records.values()].reduce((s, x) => s + x.i + x.o + x.cr + x.cw, 0)
  assert.strictEqual(total, 25, '跨 step：15 + 10 = 25')
  console.log('✓ 2. 跨 step 累计（无 usage 终值保留 chunk）')
}

// ── 3. fork 种子跳过 ──────────────────────────────────────────────────────
{
  const seed = [
    ev(0, 'session/start', {}, T),
    ev(1, 'assistant/message', { turn: 0, step: 0, message: { source: { kind: 'model', provider: 'p', model: 'm' } }, usage: { inputTokens: 100, outputTokens: 100 } }, T)
  ]
  const own = [
    ev(2, 'session/end-seed', {}, T),
    ev(3, 'assistant/message', { turn: 5, step: 0, message: { source: { kind: 'model', provider: 'p', model: 'm' } }, usage: { inputTokens: 30, outputTokens: 20 } }, T)
  ]
  const r = foldSession([...seed, ...own], 2)
  const total = [...r.records.values()].reduce((s, x) => s + x.i + x.o + x.cr + x.cw, 0)
  assert.strictEqual(total, 50, '种子跳过：只计 30+20')
  console.log('✓ 3. fork 种子事件跳过')
}

// ── 4. 模型归属：message.source 优先，回退请求路由 ────────────────────────
{
  const log = [
    ev(0, 'request/header', { header: { config: { provider: 'route', model: 'r-model' } }, reason: 'initial' }, T),
    ev(1, 'assistant/message', { turn: 0, step: 0, message: { source: { kind: 'model', provider: 'src', model: 's-model' } }, usage: { inputTokens: 10, outputTokens: 5 } }, T),
    ev(2, 'assistant/chunk', { turn: 1, step: 0, chunk: { type: 'usage', usage: { inputTokens: 8, outputTokens: 2 } } }, T + 100) // 无 source → 路由
  ]
  const r = foldSession(log, 0)
  const keys = [...r.records.keys()].map((k) => k.split('|')[2])
  assert.ok(keys.includes('src/s-model'), 'source 归属')
  assert.ok(keys.includes('route/r-model'), '路由回退')
  console.log('✓ 4. 模型归属优先级')
}

// ── 5. compactAgg/reviveAgg 往返 ─────────────────────────────────────────
{
  const log = [ev(0, 'assistant/message', { turn: 0, step: 0, message: { source: { kind: 'model', provider: 'p', model: 'm' } }, usage: { inputTokens: 10, outputTokens: 5 } }, T)]
  const a = foldSession(log, 0)
  const c = JSON.parse(JSON.stringify(compactAgg(a)))
  const b = reviveAgg(c)
  const ka = [...a.records.keys()].sort().join(',')
  const kb = [...b.records.keys()].sort().join(',')
  assert.strictEqual(ka, kb)
  assert.strictEqual(JSON.stringify(b.peak), JSON.stringify(a.peak))
  assert.strictEqual(b.first, a.first)
  assert.strictEqual(b.used, a.used)
  console.log('✓ 5. 序列化往返无损')
}

// ── 6. dayKey 本地时区 ────────────────────────────────────────────────────
{
  const d = new Date(2025, 5, 15, 23, 30)  // 2025-06-15 23:30 本地
  assert.strictEqual(dayKey(d.getTime()), '2025-06-15')
  console.log('✓ 6. dayKey 按本地自然日')
}

// ── 7. request/context 半更新：只带 provider 时保留已知 model ──────────────
{
  const log = [
    ev(0, 'request/header', { header: { config: { provider: 'p1', model: 'm1' } } }, T),
    ev(1, 'request/context', { provider: 'p2' }, T + 10),  // 只有 provider
    ev(2, 'assistant/chunk', { turn: 0, step: 0, chunk: { type: 'usage', usage: { inputTokens: 10, outputTokens: 5 } } }, T + 20)
  ]
  const r = foldSession(log, 0)
  const keys = [...r.records.keys()].map((k) => k.split('|')[2])
  assert.ok(keys.includes('p2/m1'), '半更新路由应为 p2/m1，实际：' + keys.join(','))
  assert.ok(!keys.some((k) => k.includes('unknown')), '不应出现 unknown 归属')
  console.log('✓ 7. 路由半更新保留已知半侧')
}

console.log('\n=== fold.js 全部 7 项测试通过 ===')
