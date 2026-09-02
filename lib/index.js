/**
 * @dshp-inx/token-stats —— DSH 插件 Host 半（cordis 插件）。
 *
 * 挂载：bundle patch（本包 cordis.patch.yml，加入 profile bundles 后自动生效）。
 *
 * 职责：
 *  - 经 sessionQuery 服务扫描本机全部会话日志（含子代理会话），
 *    按 日×小时×模型 聚合 TokenUsage，fork/resume 种子事件去重；
 *  - 提供 GET /ext/token-stats/data 同源 JSON 路由（设置页数据源）。
 *
 * 存储：走 DSH 标准存储体系——storageDomain（KV 域）落在
 * $DSH_HOME/storages/token_stats.json，而不是私有文件。
 *
 * 性能架构（两级）：
 *  1. 持久化聚合缓存（storage domain）——每个会话的聚合结果按
 *     「日志文件 size+mtime 指纹」缓存；DSH 重启后指纹命中的会话
 *     零重算（不调用 readSession）。指纹只 stat 文件不解析内容。
 *     活跃（live）会话不走指纹快路径——事件监听负责失效，永远实时。
 *  2. 后台异步分批扫描——插件启动即开始，每批 8 个会话，批间
 *     setImmediate 让出事件循环；设置页轮询渐进看到部分数据 +
 *     扫描进度（scanned/total）。
 *
 * 聚合口径（与 dsh-token-meter 的 usage projection 一致）：
 *  - 总 Token = inputTokens + cacheReadTokens + cacheWriteTokens + outputTokens
 *    （reasoningTokens 已含在 outputTokens，不重复计）；
 *  - 同一 (turn, step) 的 usage chunk 为早期采样、assistant/message usage 为终值，
 *    后到者覆盖前者（flush 语义），不重复累计；
 *  - fork/resume 会话跳过其头 seedLength 条种子事件（父会话已计），
 *    仅当 parentSession 存在时启用跳过，避免误伤正常会话。
 */

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

export const name = '@dshp-inx/token-stats'
export const inject = ['webServer', 'storageDomain']

/** 后台每批扫描的会话数。 */
const BATCH_SIZE = 8
/** 单会话读取失败的最大重试次数，超过则跳过并计入 errors。 */
const MAX_ATTEMPTS = 3

// ── 会话聚合 ─────────────────────────────────────────────────────────────

function modelKey(provider, model) {
  return String(provider || 'unknown') + '/' + String(model || 'unknown')
}

function dayKey(t) {
  const d = new Date(t)
  const M = String(d.getMonth() + 1)
  const D = String(d.getDate())
  return d.getFullYear() + '-' + (M.length < 2 ? '0' + M : M) + '-' + (D.length < 2 ? '0' + D : D)
}

/**
 * 折叠一个会话的事件日志为聚合记录（跳过前 skipCount 条种子事件）。
 * 返回：{ records: Map<day|hour|model, {d,h,m,i,o,cr,cw,n}>, peak, first, last, used }
 */
function foldSession(events, skipCount) {
  const records = new Map()
  const state = { peak: null, first: null, last: null, used: false }
  let route = 'unknown/unknown'
  let pending = null

  function commit(usage, time, model) {
    const i = usage.inputTokens || 0
    const o = usage.outputTokens || 0
    const cr = usage.cacheReadTokens || 0
    const cw = usage.cacheWriteTokens || 0
    const tokens = i + o + cr + cw
    if (tokens <= 0) return
    state.used = true
    const d = dayKey(time)
    const h = new Date(time).getHours()
    const k = d + '|' + h + '|' + model
    let r = records.get(k)
    if (r === undefined) {
      r = { d, h, m: model, i: 0, o: 0, cr: 0, cw: 0, n: 0 }
      records.set(k, r)
    }
    r.i += i; r.o += o; r.cr += cr; r.cw += cw; r.n += 1
    if (state.peak === null || tokens > state.peak.tokens) {
      state.peak = { tokens, d, model }
    }
    if (state.first === null || d < state.first) state.first = d
    if (state.last === null || d > state.last) state.last = d
  }

  function flush() {
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
    const type = ev.type

    if (type === 'request/header') {
      const cfg = data.header && data.header.config
      if (cfg) route = modelKey(cfg.provider, cfg.model)
    } else if (type === 'request/context') {
      if (data.provider !== undefined || data.model !== undefined) {
        route = modelKey(data.provider, data.model)
      }
    } else if (type === 'assistant/chunk') {
      const chunk = data.chunk
      if (chunk !== null && typeof chunk === 'object' && chunk.type === 'usage' && chunk.usage) {
        const key = String(data.turn) + ':' + String(data.step)
        if (pending !== null && pending.key !== key) flush()
        pending = { key, usage: chunk.usage, time: ev.time, model: route }
      }
    } else if (type === 'assistant/message') {
      const key = String(data.turn) + ':' + String(data.step)
      const src = data.message && data.message.source
      const srcModel = (src && src.kind === 'model') ? modelKey(src.provider, src.model) : null
      if (data.usage) {
        if (pending !== null && pending.key !== key) flush()
        pending = { key, usage: data.usage, time: ev.time, model: srcModel || route }
      } else if (pending !== null && pending.key === key && srcModel !== null) {
        pending.model = srcModel
      }
    }
  }
  flush()
  return { records, peak: state.peak, first: state.first, last: state.last, used: state.used }
}

// ── 会话文件索引（指纹用，只 stat 不解析）──────────────────────────────

/** 扫描 sessions 目录建立 sessionId → 日志文件路径 索引。布局变化时返回空，退化为全读。 */
function buildFileIndex(sessionsDir) {
  const idx = new Map()
  try {
    for (const entry of readdirSync(sessionsDir)) {
      const full = join(sessionsDir, entry)
      let st
      try { st = statSync(full) } catch { continue }
      if (!st.isDirectory()) continue
      for (const sess of readdirSync(full)) {
        if (!sess.startsWith('session-')) continue
        const file = join(full, sess, 'session.jsonl.zstd')
        try {
          const s = statSync(file)
          if (s.isFile()) idx.set(sess.slice('session-'.length), file)
        } catch { /* 无日志文件的会话跳过 */ }
      }
    }
  } catch { /* sessions 目录不存在 → 空索引 */ }
  return idx
}

function fileFingerprint(index, id) {
  const file = index.get(id)
  if (file === undefined) return null
  try {
    const s = statSync(file)
    return s.size + ':' + Math.floor(s.mtimeMs)
  } catch { return null }
}

// ── 存储域声明（$DSH_HOME/storages/token_stats.json）─────────────────────

const nonNegInt = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const bucketSchema = z.object({
  d: z.string().min(1), h: nonNegInt, m: z.string().min(1),
  i: nonNegInt, o: nonNegInt, cr: nonNegInt, cw: nonNegInt, n: nonNegInt
})
const cachedSessionSchema = z.object({
  /** 日志文件指纹（size:mtime）；失配即重扫。 */
  fp: z.string().min(1),
  /** 计算时使用的种子跳过数；fork 深度变化时失配重扫。 */
  skip: nonNegInt,
  /** 聚合记录桶（day|hour|model → 计数）。 */
  r: z.array(z.tuple([z.string().min(1), bucketSchema])),
  /** 本会话单次请求峰值。 */
  p: z.object({ tokens: nonNegInt, d: z.string().min(1), m: z.string().min(1) }).nullable(),
  /** 首/末活动日（YYYY-MM-DD）。 */
  f: z.string().nullable(),
  l: z.string().nullable(),
  /** 是否产生过用量。 */
  u: z.boolean()
})

/** token-stats 持久化缓存域：sessions 表，key = sessionId。 */
const tokenStatsDomainSpec = defineDomain({
  name: 'token_stats',
  version: 0,
  tables: { sessions: domainTable(cachedSessionSchema) }
})

// ── 统计引擎 ──────────────────────────────────────────────────────────────

/**
 * 创建统计引擎。
 * @param sessionQuery sessionQuery 服务
 * @param dshHome DSH 主目录（sessions 目录所在；存储域负责持久化）
 * @returns { invalidate, snapshot, start, dispose }
 */
export function createEngine(sessionQuery, dshHome, storageDomain) {
  const sessionsDir = join(dshHome, 'sessions')

  const table = storageDomain.open(tokenStatsDomainSpec)
    .then((domain) => {
      const close = () => domain.close()
      return { table: domain.table('sessions'), close }
    })
  // 引擎启动即打开域；open 在 storageDomain 插件就绪后立即完成
  const tableReady = table.then((t) => t.table)

  const aggMemo = new Map()                 // id -> agg（运行时已物化结果）
  const fpMemo = new Map()                  // id -> 计算完成时的指纹
  const dirty = new Set()                   // 事件失效的会话
  const attempts = new Map()                // id -> 失败次数
  const errored = new Set()                 // 已放弃的会话
  let queue = []                            // 待扫描 [{id, skip, mtime}]
  let pumping = false
  let listedIds = new Set()

  function skipOf(header) {
    return (typeof header.parentSession === 'string'
      && typeof header.seedLength === 'number' && header.seedLength > 0)
      ? header.seedLength : 0
  }

  /** Map ↔ 数组序列化（域表存数组，运行时物化为 Map）。 */
  const compactAgg = (agg) => ({
    r: Array.from(agg.records.entries()),
    p: agg.peak, f: agg.first, l: agg.last, u: agg.used
  })
  const reviveAgg = (c) => ({
    records: new Map(c.r), peak: c.p, first: c.f, last: c.l, used: c.u
  })

  /** 后台泵：分批扫描队列，批间让出事件循环。 */
  async function pump() {
    if (pumping) return
    pumping = true
    try {
      while (queue.length > 0) {
        const batch = queue.splice(0, BATCH_SIZE)
        const tbl = await tableReady
        await Promise.all(batch.map(async (job) => {
          try {
            const snap = await sessionQuery.readSession(job.id)
            const events = (snap && snap.events) || []
            const agg = foldSession(events, job.skip)
            aggMemo.set(job.id, agg)
            attempts.delete(job.id)
            errored.delete(job.id)
            dirty.delete(job.id)
            const fp = fileFingerprint(currentIndex, job.id)
            if (fp !== null) {
              fpMemo.set(job.id, fp)
              // 域表 put 是排队写链（durability-first），不 await 也安全；
              // await 保证缓存一致性供测试断言。
              await tbl.put(job.id, { fp, skip: job.skip, ...compactAgg(agg) })
            }
          } catch {
            const n = (attempts.get(job.id) || 0) + 1
            attempts.set(job.id, n)
            if (n >= MAX_ATTEMPTS) {
              aggMemo.set(job.id, { records: new Map(), peak: null, first: null, last: null, used: false })
              errored.add(job.id)
            }
          }
        }))
        if (queue.length > 0) await new Promise((resolve) => setImmediate(resolve))
      }
    } finally {
      pumping = false
    }
  }

  let currentIndex = new Map()

  /**
   * 汇总快照：列出全部会话 → 增量判定（指纹缓存/事件失效）→ 后台泵扫 →
   * 合并当前已物化结果。可随时调用，返回当前渐进状态。
   */
  async function snapshot() {
    const list = await sessionQuery.listSessions()
    listedIds = new Set()
    const jobs = []
    let scanned = 0

    currentIndex = buildFileIndex(sessionsDir)

    for (const rec of list) {
      const header = rec && rec.header
      if (header === null || typeof header !== 'object') continue
      const id = header.id
      if (typeof id !== 'string') continue
      listedIds.add(id)

      const skip = skipOf(header)
      const live = rec.live === true
      const isDirty = dirty.has(id)

      let need = false
      let mtime = 0

      if (live) {
        // 活跃会话：不走指纹（内存可能领先于文件），事件负责失效
        need = isDirty || !aggMemo.has(id)
      } else {
        const fp = fileFingerprint(currentIndex, id)
        if (fp !== null) {
          try { mtime = statSync(currentIndex.get(id)).mtimeMs } catch { /* 忽略 */ }
        }
        if (isDirty || !aggMemo.has(id)) {
          // 尝试持久缓存命中（指纹 + skip 一致 → 零重算）
          let hit
          try { hit = (await tableReady).get(id) } catch { hit = undefined }
          if (!isDirty && hit !== undefined && hit.fp === fp && hit.skip === skip) {
            aggMemo.set(id, reviveAgg(hit))
            fpMemo.set(id, fp)
            dirty.delete(id)
          } else {
            need = true
          }
        } else if (fp !== null && fpMemo.get(id) !== fp) {
          // 已物化但文件被外部修改 → 重扫
          need = true
        }
      }

      if (need && !errored.has(id)) {
        const job = { id, skip, mtime }
        if (dirty.has(id)) job.mtime = Infinity  // 失效会话最优先（含活跃）
        jobs.push(job)
      }
      if (aggMemo.has(id)) scanned++
    }

    jobs.sort((a, b) => b.mtime - a.mtime)
    if (jobs.length > 0) {
      queue = jobs
      void pump()
    }

    // 合并当前已物化的全部结果
    const merged = new Map()
    const models = {}
    const daySessions = {}                 // d -> 有用量的会话数（悬浮明细）
    let peak = null
    let first = null
    let last = null
    let active = 0

    for (const id of listedIds) {
      const agg = aggMemo.get(id)
      if (agg === undefined) continue
      if (agg.used) {
        active++
        // 该会话贡献过用量的日期集合（用于当日会话数）
        const days = new Set()
        for (const r of agg.records.values()) days.add(r.d)
        for (const d of days) daySessions[d] = (daySessions[d] || 0) + 1
      }
      for (const r of agg.records.values()) {
        const k = r.d + '|' + r.h + '|' + r.m
        let m = merged.get(k)
        if (m === undefined) {
          m = { d: r.d, h: r.h, m: r.m, i: 0, o: 0, cr: 0, cw: 0, n: 0 }
          merged.set(k, m)
        }
        m.i += r.i; m.o += r.o; m.cr += r.cr; m.cw += r.cw; m.n += r.n
        if (models[r.m] === undefined) {
          const slash = r.m.indexOf('/')
          models[r.m] = slash > 0
            ? { provider: r.m.slice(0, slash), model: r.m.slice(slash + 1) }
            : { provider: 'unknown', model: r.m }
        }
      }
      if (agg.peak !== null && (peak === null || agg.peak.tokens > peak.tokens)) peak = agg.peak
      if (agg.first !== null && (first === null || agg.first < first)) first = agg.first
      if (agg.last !== null && (last === null || agg.last > last)) last = agg.last
    }

    const records = Array.from(merged.values())
    records.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.h - b.h))

    const total = listedIds.size
    return {
      ready: true,
      records,
      models,
      daySessions,
      peakStep: peak,
      range: first === null ? null : { first, last },
      sessions: total,
      active,
      partial: total - scanned > 0,
      scanned,
      total,
      errors: errored.size,
      generatedAt: Date.now()
    }
  }

  /** 事件失效：只标记，下次 snapshot 处理。 */
  function invalidate(sessionId) {
    if (typeof sessionId === 'string') {
      dirty.add(sessionId)
      errored.delete(sessionId)
      attempts.delete(sessionId)
    }
  }

  /** 启动即开始后台扫描（不阻塞启动）。 */
  function start() {
    const t = setTimeout(() => { void snapshot().catch(() => {}) }, 100)
    if (typeof t.unref === 'function') t.unref()
  }

  /** 等待后台队列清空（测试用）。 */
  async function drain() {
    while (pumping || queue.length > 0) {
      await new Promise((resolve) => setImmediate(resolve))
    }
    // 等待排队的域写完成
    await tableReady.then(() => {})
    await new Promise((resolve) => setImmediate(resolve))
  }

  /** 插件卸载：关闭域。 */
  async function dispose() {
    try {
      const t = await table
      await t.close()
    } catch { /* 域未开成功则无需关闭 */ }
  }

  return { invalidate, snapshot, start, drain, dispose }
}

// ── 同源 JSON 路由 ────────────────────────────────────────────────────────

const json = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

const sameOrigin = (req) => {
  const origin = req.headers.origin
  if (origin === undefined) return true
  const host = req.headers.host
  return origin === `http://${host}` || origin === `https://${host}`
}

function registerRoutes(ctx, engine) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/ext/token-stats/data',
    handler: async (req, res) => {
      if (!sameOrigin(req)) return json(res, 403, { ready: false, error: 'forbidden' })
      try {
        const data = await engine.snapshot()
        return json(res, 200, data)
      } catch (error) {
        return json(res, 200, { ready: false, error: String((error && error.message) || error) })
      }
    }
  }), 'token-stats: data route')
}

// ── 插件入口 ──────────────────────────────────────────────────────────────

export function apply(ctx) {
  const sessionQuery = ctx.get('sessionQuery')
  if (sessionQuery === undefined) return

  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  const engine = createEngine(sessionQuery, dshHome, ctx.storageDomain)

  // 会话事件失效缓存（只读 leaf 字段 session.id）
  ctx.on('session/event', (session) => {
    const id = session && session.id
    if (typeof id === 'string') engine.invalidate(id)
  })

  // 卸载时关闭存储域
  ctx.effect(() => () => { void engine.dispose() }, 'token-stats: close domain on dispose')

  registerRoutes(ctx, engine)
  engine.start()
}
