/**
 * 同源 JSON 路由（设置页数据源）。
 *
 * @module @dshp-inx/token-stats/http
 */

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

/**
 * 注册 GET /ext/dshp-inx-token-stats/data（engine.snapshot 快照）。
 * @param {object} ctx cordis 上下文（webServer 已注入）
 * @param {{snapshot: Function}} engine 统计引擎
 */
export function registerRoutes(ctx, engine) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/ext/dshp-inx-token-stats/data',
    handler: async (req, res) => {
      if (!sameOrigin(req)) return json(res, 403, { ready: false, error: 'forbidden' })
      try {
        const data = await engine.snapshot()
        return json(res, 200, data)
      } catch (error) {
        return json(res, 200, { ready: false, error: String((error && error.message) || error) })
      }
    }
  }), 'dshp-inx-token-stats: data route')
}
