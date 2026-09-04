/**
 * @dshp-inx/token-stats —— DSH 插件 Host 半（cordis 插件）。
 *
 * 挂载：bundle patch（本包 cordis.patch.yml，加入 profile bundles 后自动生效）。
 *
 * 职责：sessionQuery 扫描本机全部会话日志（含子代理会话）聚合 TokenUsage，
 * 经 GET /ext/dshp-inx-token-stats/data 供设置页消费。
 *
 * 持久化（按官方分工拆两层）：
 *  - 用户偏好：标准 settings 存储，settings.yaml 顶层 `dshp-inx-token-stats`
 *    命名空间（showToday / defaultRange），经 ctx.settings 分层解析，
 *    settings 页开关与默认范围改完即时生效；
 *  - 派生缓存：会话指纹聚合缓存仍走 ctx.storageDomain
 *   （域 token_stats，$DSH_HOME/storages/token_stats.json；域名保持原样——
 *    storageDomain 只允许小写字母/数字/下划线，且改名会废掉已有缓存触发全量重扫），
 *    丢了可后台重扫，不属于用户配置。
 *
 * 模块划分：
 *  - ./fold.js    纯聚合函数（可独立单测）
 *  - ./engine.js  缓存引擎（指纹持久化 + 后台渐进扫描）
 *  - ./http.js    同源 JSON 路由（用量快照）
 *
 * @module @dshp-inx/token-stats
 */
import { join } from 'node:path'
import { homedir } from 'node:os'
import z from '@deepseek-ai/schemastery'
import { createEngine } from './engine.js'
import { registerRoutes } from './http.js'

export const name = '@dshp-inx/token-stats'
export const inject = ['webServer', 'storageDomain']

// ── DSH 0.1.2-rc.1 适配：@deepseek-ai/dsh-settings 不再导出
// settingsNamespace / installSettingsSection（0.1.1-rc.2 及以前有）。
// settingsNamespace 只是 kebab-case 校验，本地内联；installSettingsSection
// 改用 settings 服务的 installSection 方法（官方 dsh-bash-local 同款写法）。──

const NAMESPACE_PATTERN = /^[a-z][a-z0-9-]*$/

function settingsNamespace(value) {
  if (!NAMESPACE_PATTERN.test(value)) throw new TypeError(`settings namespace "${value}" must match ${String(NAMESPACE_PATTERN)}`)
  return value
}

// ── 官方 settings 命名空间与 schema（settings.yaml: dshp-inx-token-stats）──
// 与包名 @dshp-inx/token-stats / 路由 /etc 前缀保持一致。

export const NS = settingsNamespace('dshp-inx-token-stats')

const DEFAULT_ENTRY = {
  showToday: false,
  defaultRange: '30' // 7 | 30 | 90 | all
}

export const ConfigSchema = z.object({
  showToday: z.boolean().default(false),
  defaultRange: z.union([z.const('7'), z.const('30'), z.const('90'), z.const('all')]).default('30')
})

function sanitizePatchConfig(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out = {}
  if (Object.hasOwn(raw, 'showToday')) out.showToday = raw.showToday === true
  if (Object.hasOwn(raw, 'defaultRange') && (raw.defaultRange === '7' || raw.defaultRange === '30' || raw.defaultRange === '90' || raw.defaultRange === 'all')) {
    out.defaultRange = raw.defaultRange
  }
  return out
}

export function apply(ctx, rawConfig) {
  // composition entry：默认值 ← patch 覆盖（settings 的 base 层）
  const entry = { ...DEFAULT_ENTRY }
  const patch = sanitizePatchConfig(rawConfig)
  if (patch) {
    if (Object.hasOwn(patch, 'showToday')) entry.showToday = patch.showToday
    if (Object.hasOwn(patch, 'defaultRange')) entry.defaultRange = patch.defaultRange
  }

  // 官方 settings：当前生效配置源（有 settings 时指向 scope.get()，否则指向 entry）
  let current = () => entry
  ctx.inject(['settings'], (sctx) => {
    sctx.settings.installSection(ctx, NS, ConfigSchema, entry, {
      setSource: (src) => { current = src },
      onChange: () => {}
    })
  })

  function getConfig() {
    try {
      const v = current()
      if (v && typeof v === 'object') {
        return {
          showToday: v.showToday === true,
          defaultRange: (v.defaultRange === '7' || v.defaultRange === '30' || v.defaultRange === '90' || v.defaultRange === 'all') ? v.defaultRange : entry.defaultRange
        }
      }
    } catch {}
    return { ...entry }
  }
  async function updateConfig(configPatch) {
    const settings = ctx.get('settings')
    if (!settings) throw new Error('settings 服务不可用，无法持久化到 settings.yaml（请重启 DSH 或检查 FileSettingsProvider 是否挂载）')
    await settings.update(NS, configPatch)
  }

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
  ctx.effect(() => () => { void engine.dispose() }, 'dshp-inx-token-stats: close domain on dispose')

  registerRoutes(ctx, engine)
  registerSettingsRoutes(ctx, getConfig, updateConfig)
  engine.start()
}

// ── 同源 JSON 路由：偏好读写（Client 半设置开关/默认范围用）──────────────

function registerSettingsRoutes(ctx, getConfig, updateConfig) {
  const json = (res, status, value) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(value))
  }
  const sameOrigin = (req) => {
    const origin = req.headers.origin
    if (origin === undefined) return true
    const host = req.headers.host
    return origin === `http://${host}` || origin === `https://${host}`
  }
  const readBody = (req) => new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/ext/dshp-inx-token-stats/state',
    handler: async (req, res) => {
      if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      try {
        return json(res, 200, { ok: true, config: getConfig() })
      } catch (error) {
        return json(res, 200, { ok: false, error: String((error && error.message) || error) })
      }
    }
  }), 'dshp-inx-token-stats: state route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/ext/dshp-inx-token-stats/config',
    handler: async (req, res) => {
      if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
      let body = {}
      try { body = JSON.parse((await readBody(req)) || '{}') } catch { return json(res, 200, { ok: false, error: '请求体不是合法 JSON' }) }
      const a = (body && typeof body === 'object' && !Array.isArray(body)) ? body : {}
      try {
        const configPatch = {}
        let hasPatch = false
        if (Object.hasOwn(a, 'showToday')) { configPatch.showToday = a.showToday === true; hasPatch = true }
        if (Object.hasOwn(a, 'defaultRange')) {
          if (a.defaultRange !== '7' && a.defaultRange !== '30' && a.defaultRange !== '90' && a.defaultRange !== 'all') {
            throw new Error("defaultRange 非法，应为 '7' / '30' / '90' / 'all'")
          }
          configPatch.defaultRange = a.defaultRange
          hasPatch = true
        }
        if (hasPatch) await updateConfig(configPatch)
        return json(res, 200, { ok: true, config: getConfig() })
      } catch (error) {
        return json(res, 200, { ok: false, error: String((error && error.message) || error) })
      }
    }
  }), 'dshp-inx-token-stats: config route')
}
