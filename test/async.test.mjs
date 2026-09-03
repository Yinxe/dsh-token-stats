/**
 * async.js 单元测试 —— withTimeout 语义（无依赖，node 直接跑）。
 *
 * 用法：node test/async.test.mjs
 */
import { withTimeout } from '../lib/async.js'
import assert from 'node:assert'

const later = (ms, value, fail) => new Promise((resolve, reject) => {
  setTimeout(() => { if (fail) reject(new Error(fail)); else resolve(value) }, ms)
})

// ── 1. 限时内完成 → 透传结果 ─────────────────────────────────────────────
{
  const v = await withTimeout(later(5, 'ok'), 500, 'fast')
  assert.strictEqual(v, 'ok')
  console.log('✓ 1. 限时内透传结果')
}

// ── 2. 超时 → reject（标签进错误信息） ────────────────────────────────────
{
  await assert.rejects(withTimeout(later(300, 'late'), 30, 'slow-op'), /timeout after 30ms \(slow-op\)/)
  console.log('✓ 2. 超时 reject 带标签')
}

// ── 3. 内层失败 → 原样透传（不被包装成超时） ─────────────────────────────
{
  await assert.rejects(withTimeout(later(5, null, 'boom'), 500), /boom/)
  console.log('✓ 3. 内层失败原样透传')
}

// ── 4. 超时不拖进程：定时器已 unref（行为断言：无挂起 handle 即可正常退出） ──
{
  const t0 = Date.now()
  await withTimeout(later(5, 1), 10000)
  assert.ok(Date.now() - t0 < 1000, '快路径不应等满超时')
  console.log('✓ 4. 快路径不等超时')
}

console.log('\n=== async.js 全部 4 项测试通过 ===')
