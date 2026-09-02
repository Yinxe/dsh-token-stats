/**
 * 统计引擎：会话列表 → 指纹缓存（storageDomain 持久化）→ 后台分批渐进扫描 → 合并快照。
 *
 * 两级性能：
 *  1. 持久化聚合缓存（$DSH_HOME/storages/token_stats.json）——每会话聚合结果按
 *     「日志文件 size+mtime 指纹」缓存；重启后指纹命中零重算。活跃（live）会话
 *     不走指纹快路径——事件监听负责失效，永远实时。
 *  2. 后台异步分批扫描——每批 8 个会话，批间 setImmediate 让出事件循环；
 *     快照返回渐进状态（scanned/total），页面轮询逐步补全。
 *
 * @module @dshp-inx/token-stats/engine
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { foldSession, compactAgg, reviveAgg } from './fold.js'

/** 后台每批扫描的会话数。 */
const BATCH_SIZE = 8
/** 单会话读取失败的最大重试次数，超过则跳过并计入 errors。 */
const MAX_ATTEMPTS = 3

// ── 会话文件索引（指纹用，只 stat 不解析）──────────────────────────────

/** 扫描 sessions 目录建立 sessionId → 日志文件路径 索引。布局变化时返回空，退化为全读。 */
export function buildFileIndex(sessionsDir) {
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
export const tokenStatsDomainSpec = defineDomain({
  name: 'token_stats',
  version: 0,
  tables: { sessions: domainTable(cachedSessionSchema) }
})

/** 会话头 → 种子跳过数（fork/resume 去重；仅 parentSession 存在时启用）。 */
function skipOf(header) {
  return (typeof header.parentSession === 'string'
    && typeof header.seedLength === 'number' && header.seedLength > 0)
    ? header.seedLength : 0
}

/**
 * 创建统计引擎。
 * @param {object} sessionQuery sessionQuery 服务（listSessions / readSession）
 * @param {string} dshHome DSH 主目录（sessions 目录所在）
 * @param {object} storageDomain ctx.storageDomain（KV 域设施）
 * @returns {{invalidate, snapshot, start, drain, dispose}}
 */
export function createEngine(sessionQuery, dshHome, storageDomain) {
  const sessionsDir = join(dshHome, 'sessions')

  const tableReady = storageDomain.open(tokenStatsDomainSpec)
    .then((domain) => ({ table: domain.table('sessions'), close: () => domain.close() }))

  const aggMemo = new Map()                 // id -> agg（运行时已物化结果）
  const fpMemo = new Map()                  // id -> 计算完成时的指纹
  const dirty = new Set()                   // 事件失效的会话
  const attempts = new Map()                // id -> 失败次数
  const errored = new Set()                 // 已放弃的会话
  let queue = []                            // 待扫描 [{id, skip, mtime}]
  let pumping = false
  let listedIds = new Set()
  let currentIndex = new Map()

  /** 事件失效：只标记，下次 snapshot 处理。 */
  function invalidate(sessionId) {
    if (typeof sessionId === 'string') {
      dirty.add(sessionId)
      errored.delete(sessionId)
      attempts.delete(sessionId)
    }
  }

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
            const agg = foldSession((snap && snap.events) || [], job.skip)
            aggMemo.set(job.id, agg)
            attempts.delete(job.id)
            errored.delete(job.id)
            dirty.delete(job.id)
            const fp = fileFingerprint(currentIndex, job.id)
            if (fp !== null) {
              fpMemo.set(job.id, fp)
              await tbl.table.put(job.id, { fp, skip: job.skip, ...compactAgg(agg) })
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
          try { hit = (await tableReady).table.get(id) } catch { hit = undefined }
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
        if (isDirty) job.mtime = Infinity  // 失效会话最优先（含活跃）
        jobs.push(job)
      }
      if (aggMemo.has(id)) scanned++
    }

    // 失效会话优先，其余按 mtime 降序（近期数据先出来）
    jobs.sort((a, b) => b.mtime - a.mtime)
    if (jobs.length > 0) {
      queue = jobs
      void pump()
    }

    // 合并当前已物化的全部结果
    const merged = new Map()
    const models = {}
    const daySessions = {}
    let peak = null
    let first = null
    let last = null
    let active = 0

    for (const id of listedIds) {
      const agg = aggMemo.get(id)
      if (agg === undefined) continue
      if (agg.used) {
        active++
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
    await tableReady
    await new Promise((resolve) => setImmediate(resolve))
  }

  /** 插件卸载：关闭域。 */
  async function dispose() {
    try {
      const t = await tableReady
      await t.close()
    } catch { /* 域未开成功则无需关闭 */ }
  }

  return { invalidate, snapshot, start, drain, dispose }
}
