/**
 * @dshp-inx/token-stats —— DSH 插件 Host 半（cordis 插件）。
 *
 * 挂载：bundle patch（本包 cordis.patch.yml，加入 profile bundles 后自动生效）。
 *
 * 职责：sessionQuery 扫描本机全部会话日志（含子代理会话）聚合 TokenUsage，
 * 经 GET /ext/token-stats/data 供设置页消费。
 *
 * 模块划分：
 *  - ./fold.js    纯聚合函数（可独立单测）
 *  - ./engine.js  缓存引擎（指纹持久化 + 后台渐进扫描）
 *  - ./http.js    同源 JSON 路由
 *
 * @module @dshp-inx/token-stats
 */
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createEngine } from './engine.js'
import { registerRoutes } from './http.js'

export const name = '@dshp-inx/token-stats'
export const inject = ['webServer', 'storageDomain']

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
