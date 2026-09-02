/**
 * 会话日志折叠聚合 —— 纯函数，无副作用，可独立单测。
 *
 * 聚合口径（与 dsh-token-meter 的 usage projection 一致）：
 *  - 单请求 Token = inputTokens + cacheReadTokens + cacheWriteTokens + outputTokens
 *    （reasoningTokens 已含在 outputTokens，不重复计）；
 *  - 同一 (turn, step) 的 usage chunk 为早期采样、assistant/message usage 为终值，
 *    后到者覆盖前者（flush 语义），不重复累计；
 *  - fork/resume 会话跳过其头 skipCount 条种子事件（父会话已计）。
 *
 * @module @dshp-inx/token-stats/fold
 */

export function modelKey(provider, model) {
  return String(provider || 'unknown') + '/' + String(model || 'unknown')
}

export function dayKey(t) {
  const d = new Date(t)
  const M = String(d.getMonth() + 1)
  const D = String(d.getDate())
  return d.getFullYear() + '-' + (M.length < 2 ? '0' + M : M) + '-' + (D.length < 2 ? '0' + D : D)
}

const BUCKETS = ['i', 'o', 'cr', 'cw']

/** 会话聚合结果：records 键为 `${day}|${hour}|${model}`。 */
function emptyResult() {
  return { records: new Map(), peak: null, first: null, last: null, used: false }
}

/**
 * 折叠一个会话的事件日志为聚合记录（跳过前 skipCount 条种子事件）。
 * @param {Array<{seq:number, type:string, time:number, data:object}>} events 完整事件日志
 * @param {number} skipCount 种子事件跳过数（fork/resume 去重）
 * @returns {{records: Map, peak: {tokens,d,model}|null, first: string|null, last: string|null, used: boolean}}
 */
export function foldSession(events, skipCount) {
  const state = emptyResult()
  let route = 'unknown/unknown'   // 最近一次请求路由（模型归属回退）
  let pending = null              // {key, usage, time, model} 待终值覆盖的采样

  const commit = (usage, time, model) => {
    const vals = { i: usage.inputTokens || 0, o: usage.outputTokens || 0, cr: usage.cacheReadTokens || 0, cw: usage.cacheWriteTokens || 0 }
    const tokens = vals.i + vals.o + vals.cr + vals.cw
    if (tokens <= 0) return
    state.used = true
    const d = dayKey(time)
    const h = new Date(time).getHours()
    const k = d + '|' + h + '|' + model
    let r = state.records.get(k)
    if (r === undefined) {
      r = { d, h, m: model, i: 0, o: 0, cr: 0, cw: 0, n: 0 }
      state.records.set(k, r)
    }
    for (const b of BUCKETS) r[b] += vals[b]
    r.n += 1
    if (state.peak === null || tokens > state.peak.tokens) state.peak = { tokens, d, model }
    if (state.first === null || d < state.first) state.first = d
    if (state.last === null || d > state.last) state.last = d
  }

  const flush = () => {
    if (pending === null) return
    commit(pending.usage, pending.time, pending.model)
    pending = null
  }

  const limit = skipCount > 0 ? skipCount : 0
  for (let idx = 0; idx < events.length; idx++) {
    if (idx < limit) continue
    const ev = events[idx]
    const data = ev && ev.data
    if (data === null || typeof data !== 'object') continue

    switch (ev.type) {
      case 'request/header': {
        const cfg = data.header && data.header.config
        if (cfg) route = modelKey(cfg.provider, cfg.model)
        break
      }
      case 'request/context': {
        if (data.provider !== undefined || data.model !== undefined) {
          route = modelKey(data.provider, data.model)
        }
        break
      }
      case 'assistant/chunk': {
        const chunk = data.chunk
        if (chunk !== null && typeof chunk === 'object' && chunk.type === 'usage' && chunk.usage) {
          const key = String(data.turn) + ':' + String(data.step)
          if (pending !== null && pending.key !== key) flush()
          pending = { key, usage: chunk.usage, time: ev.time, model: route }
        }
        break
      }
      case 'assistant/message': {
        const key = String(data.turn) + ':' + String(data.step)
        const src = data.message && data.message.source
        const srcModel = (src && src.kind === 'model') ? modelKey(src.provider, src.model) : null
        if (data.usage) {
          if (pending !== null && pending.key !== key) flush()
          pending = { key, usage: data.usage, time: ev.time, model: srcModel || route }
        } else if (pending !== null && pending.key === key && srcModel !== null) {
          pending.model = srcModel   // 无 usage 的终值消息：回填更准确的模型归属
        }
        break
      }
    }
  }
  flush()
  return state
}

/** Map ↔ 数组序列化（JSON 不支持 Map）。 */
export const compactAgg = (agg) => ({
  r: Array.from(agg.records.entries()), p: agg.peak, f: agg.first, l: agg.last, u: agg.used
})

export const reviveAgg = (c) => ({
  records: new Map(c.r), peak: c.p, first: c.f, last: c.l, used: c.u
})
