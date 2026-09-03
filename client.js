/* @dshp-inx/token-stats client half — hand-authored __ModuleLoader__ bundle.
 *
 * 设置页：Token 用量统计 —— 单页（指标卡/趋势/热力图/模型分布）+ 侧栏今日卡片。
 *
 * 结构（单 bundle 内 region 划分）：
 *   #region util     日期/格式化/统计纯函数
 *   #region css      DSH 主题 token 样式
 *   #region ui       原子组件（Seg/StatCard/Popover/ComposeBar/Sparkline/…）
 *   #region charts   图表（TrendChart/Heatmap/Donut/TodayChart）
 *   #region page     设置页主体 + 侧栏今日卡片 + apply
 *
 * 数据源：GET /ext/dshp-inx-token-stats/data（Host 半聚合本机全部会话日志）。
 * 偏好（侧栏开关/默认范围）：标准 settings 存储，经
 * GET /ext/dshp-inx-token-stats/state 与 POST /ext/dshp-inx-token-stats/config
 * 读写 settings.yaml（dshp-inx-token-stats 命名空间）。
 * 时效性：挂载即拉取 + 60s 自动刷新（可见时）+ 切回即刷 + partial 时 2s 加速。 */
window.__ModuleLoader__.load({
  id: '@dshp-inx/token-stats',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const el = React.createElement
    // react-dom 官方包在插件 require 映射内（官方 bundle 同款用法），取不到时降级为内联渲染
    let ReactDOM = null
    try { ReactDOM = require('react-dom') } catch {}
    // 浮窗 .ts-float 带 backdrop-filter + overflow:hidden，会成为 fixed 后代的定位基准并裁剪之；
    // 图表悬浮提示必须 portal 到 body 才能跟随鼠标（债权：tipPos 本就按视口坐标计算）
    function tsPortal(node) {
      if (node === null || node === undefined) return null
      try {
        if (ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined' && document.body) {
          return ReactDOM.createPortal(node, document.body)
        }
      } catch {}
      return node
    }

    //#region util ───────────────────────────────────────────────────────

    const BP = 'var(--dsw-alias-state-business-primary)'
    const PALETTE = ['#4c7ef3', '#2fb261', '#f5a623', '#e05e4e', '#9a6ef1', '#25b8c4', '#d557a8', '#8a94a6', '#6b7280', '#34d399', '#f472b6', '#a3e635']

    const keyOf = (t) => { const d = new Date(t); const M = String(d.getMonth() + 1); const D = String(d.getDate()); return d.getFullYear() + '-' + (M.length < 2 ? '0' + M : M) + '-' + (D.length < 2 ? '0' + D : D) }
    const fromKey = (k) => { const p = k.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12).getTime() }
    const dispDay = (k) => k ? k.slice(5).replace('-', '/') : ''
    const cnDate = (k) => { const p = k.split('-'); return Number(p[0]) + '年' + Number(p[1]) + '月' + Number(p[2]) + '日' }
    const hhmm = (t) => { const d = new Date(t); const H = String(d.getHours()); const Mi = String(d.getMinutes()); return (H.length < 2 ? '0' + H : H) + ':' + (Mi.length < 2 ? '0' + Mi : Mi) }
    /** token 合计（records/聚合桶共用）。 */
    const tok = (r) => (r.i || 0) + (r.o || 0) + (r.cr || 0) + (r.cw || 0)

    /** 可读大数字：千分位；≥万 用紧凑单位（1 位小数，去 .0）。 */
    const fmt = (n) => {
      n = Math.round(n || 0)
      if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '亿'
      if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万'
      return n.toLocaleString('en-US')
    }
    /** 精确千分位（悬浮明细用）。 */
    const fmtFull = (n) => Math.round(n || 0).toLocaleString('en-US')

    /** 极紧凑格式（折叠侧栏 rail 卡片用）：整数万/亿，宽度 ≤ 5 字符。 */
    const fmtRail = (n) => {
      n = Math.round(n || 0)
      if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '亿'
      if (n >= 1e4) return String(Math.round(n / 1e4)) + '万'
      return String(n)
    }

    const niceMax = (m) => { if (m <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log(m) / Math.LN10)); const c = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]; for (let i = 0; i < c.length; i++) { if (c[i] * p >= m) return c[i] * p } return 10 * p }
    const median = (arr) => { if (arr.length === 0) return 0; const s = [...arr].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2 }

    /** 记录聚合（客户端按范围二次聚合；byDay 含 byModel 明细供热力图/悬浮）。 */
    function aggregate(records, cutoff) {
      const byDay = new Map(); const byModel = new Map(); const byHour = []
      for (let i = 0; i < 24; i++) byHour.push(0)
      let si = 0, so = 0, scr = 0, scw = 0, sn = 0, first = null, last = null
      for (let idx = 0; idx < records.length; idx++) {
        const r = records[idx]
        if (cutoff !== null && r.d < cutoff) continue
        const t = tok(r)
        si += r.i || 0; so += r.o || 0; scr += r.cr || 0; scw += r.cw || 0; sn += r.n || 0
        byHour[r.h] += t
        let day = byDay.get(r.d)
        if (day === undefined) { day = { d: r.d, i: 0, o: 0, cr: 0, cw: 0, n: 0, t: 0, byModel: {} }; byDay.set(r.d, day) }
        day.i += r.i || 0; day.o += r.o || 0; day.cr += r.cr || 0; day.cw += r.cw || 0; day.n += r.n || 0; day.t += t
        day.byModel[r.m] = (day.byModel[r.m] || 0) + t
        let mo = byModel.get(r.m)
        if (mo === undefined) { mo = { m: r.m, i: 0, o: 0, cr: 0, cw: 0, n: 0, t: 0 }; byModel.set(r.m, mo) }
        mo.i += r.i || 0; mo.o += r.o || 0; mo.cr += r.cr || 0; mo.cw += r.cw || 0; mo.n += r.n || 0; mo.t += t
        if (first === null || r.d < first) first = r.d
        if (last === null || r.d > last) last = r.d
      }
      return { byDay, byModel, byHour, i: si, o: so, cr: scr, cw: scw, n: sn, total: si + so + scr + scw, first, last }
    }

    /** 连续天数：current（今天→往回）/ longest（历史最长）。 */
    function streaks(byDay) {
      const set = new Set(byDay.keys())
      const today = keyOf(Date.now())
      const yKey = keyOf(fromKey(today) - 86400000)
      let cur = 0
      let cursor = set.has(today) ? today : (set.has(yKey) ? yKey : null)
      while (cursor !== null && set.has(cursor)) { cur++; cursor = keyOf(fromKey(cursor) - 86400000) }
      const keys = Array.from(set).sort()
      let longest = 0, run = 0, prev = null
      for (const k of keys) {
        run = (prev !== null && keyOf(fromKey(prev) + 86400000) === k) ? run + 1 : 1
        if (run > longest) longest = run
        prev = k
      }
      return { current: cur, longest }
    }

    function buildDayList(startKey, endKey) {
      const out = []
      let c = startKey
      let guard = 0
      while (c <= endKey && guard < 3000) { out.push(c); c = keyOf(fromKey(c) + 86400000); guard++ }
      return out
    }

    // 模型 → 稳定颜色（排序后取调色板，多处渲染一致）
    let MODEL_COLORS = new Map()
    function buildModelColors(models) {
      const map = new Map()
      Object.keys(models).sort().forEach((k, i) => map.set(k, PALETTE[i % PALETTE.length]))
      MODEL_COLORS = map
    }
    const modelColor = (mk) => MODEL_COLORS.get(mk) || '#8a94a6'

    /** fixed 定位 tooltip 坐标：跟随鼠标 + 视口边缘四向翻转（不受祖先 overflow 裁剪）。 */
    function tipPos(mx, my, w, h) {
      const flipX = mx + w + 28 > window.innerWidth
      const flipY = my + h + 28 > window.innerHeight
      return {
        left: flipX ? undefined : (mx + 14) + 'px',
        right: flipX ? (window.innerWidth - mx + 14) + 'px' : undefined,
        top: flipY ? undefined : (my + 16) + 'px',
        bottom: flipY ? (window.innerHeight - my + 16) + 'px' : undefined
      }
    }

    /** 平滑路径（Catmull-Rom → 三次 Bezier）。 */
    function smoothPath(pts) {
      const n = pts.length
      if (n === 0) return ''
      if (n === 1) return 'M ' + pts[0][0] + ' ' + pts[0][1]
      if (n === 2) return 'M ' + pts[0][0] + ' ' + pts[0][1] + ' L ' + pts[1][0] + ' ' + pts[1][1]
      let d = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1)
      for (let i = 0; i < n - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)]
        const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
        const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
        d += ' C ' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1)
      }
      return d
    }

    /** SVG 悬浮捕获层的鼠标 x → 索引。 */
    const hoverIndex = (svgRef, e, W, pl, pr, n) => {
      const node = svgRef.current
      if (node === null) return null
      const rect = node.getBoundingClientRect()
      const relX = (e.clientX - rect.left) / rect.width * W
      let i = n <= 1 ? 0 : Math.round((relX - pl) / (W - pl - pr) * (n - 1))
      if (i < 0) i = 0
      if (i > n - 1) i = n - 1
      return i
    }

    //#endregion
    //#region css ────────────────────────────────────────────────────────

    const CSS = `
.ts-page{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-primary);max-width:820px}
.ts-title{font-size:15px;font-weight:600;margin:0 0 4px}
.ts-desc{color:var(--dsw-alias-label-secondary);margin:0 0 14px}
.ts-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:14px 16px;margin:0 0 12px}
.ts-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit}
.ts-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.ts-btn:disabled{opacity:.4;cursor:default}
.ts-notice{padding:8px 12px;border-radius:8px;margin:0 0 12px;font-size:12.5px}
.ts-notice-err{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent);color:var(--dsw-alias-state-error-primary)}
.ts-notice-empty{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.ts-hint{font-size:12px;color:var(--dsw-alias-label-secondary)}
.ts-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}
.ts-select{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 8px;font-size:12.5px;font-family:inherit;outline:none}
.ts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:8px}
.ts-stat{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;transition:border-color .15s}
.ts-stat:hover{border-color:var(--dsw-alias-state-business-primary)}
.ts-stat-label{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}
.ts-stat-value{color:var(--dsw-alias-label-primary);font-size:17px;font-weight:600;font-variant-numeric:tabular-nums;line-height:24px}
.ts-stat-sub{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ts-pop{position:fixed;z-index:50;pointer-events:none;background:var(--dsw-specific-menu);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;box-shadow:var(--dsw-shadow-lv3);padding:10px 12px;font-size:12px;line-height:1.5;max-width:300px;color:var(--dsw-alias-label-primary)}
.ts-pop-title{font-weight:600;margin-bottom:6px;font-size:12.5px}
.ts-pop-row{display:flex;align-items:center;gap:6px;white-space:nowrap;margin:2px 0}
.ts-pop-row .ts-dot{width:8px;height:8px;border-radius:2.5px;flex:none}
.ts-pop-k{color:var(--dsw-alias-label-secondary)}
.ts-pop-v{margin-left:auto;font-variant-numeric:tabular-nums;padding-left:12px}
.ts-pop-bar{height:4px;border-radius:2px;background:var(--dsw-alias-interactive-bg-hover);flex:1;min-width:50px;overflow:hidden;display:block}
.ts-pop-fill{height:100%;border-radius:2px;display:block}
.ts-tipfixed{position:fixed;background:var(--dsw-specific-menu);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;box-shadow:var(--dsw-shadow-lv3);padding:7px 10px;font-size:11.5px;line-height:1.5;pointer-events:none;color:var(--dsw-alias-label-primary);z-index:60;max-width:280px}
.ts-tipfloat{z-index:500}
.ts-tiprow{display:flex;align-items:center;gap:6px;white-space:nowrap}
.ts-tip-k{color:var(--dsw-alias-label-secondary)}
.ts-tip-v{font-variant-numeric:tabular-nums;font-weight:500}
.ts-dot{width:10px;height:10px;border-radius:3px;flex:none;display:inline-block}
.ts-muted{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.ts-chart-title{font-weight:600;font-size:12.5px;color:var(--dsw-alias-label-secondary);margin:0 0 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.ts-seg{display:inline-flex;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:2px;flex-wrap:wrap}
.ts-seg-btn{border:none;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:12px;font-family:inherit;padding:2px 8px;border-radius:6px;cursor:pointer;line-height:18px}
.ts-seg-btn:hover{color:var(--dsw-alias-label-primary)}
.ts-seg-on{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.ts-legend{display:flex;align-items:center;gap:4px;margin-top:8px;flex-wrap:wrap}
.ts-modelchip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 9px;font-size:11.5px;cursor:pointer;color:var(--dsw-alias-label-secondary);background:transparent;font-family:inherit;line-height:18px;max-width:180px}
.ts-modelchip:hover{border-color:var(--dsw-alias-state-business-primary)}
.ts-modelchip[data-off="1"]{opacity:.38}
.ts-modelchip .ts-dot{width:8px;height:8px}
.ts-modelchip .ts-mc-name{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ts-heatwrap{position:relative}
.ts-heatrow{display:flex;flex:1 1 auto;min-width:0}
.ts-hcell{border-radius:2.5px;flex:1 1 0;min-width:0;aspect-ratio:1;cursor:default}
.ts-hcell[data-lv="0"]{background:var(--dsw-alias-interactive-bg-hover);opacity:.45}
.ts-cell{width:9px;height:9px;border-radius:2.5px;display:inline-block;margin:0 2px;flex:none}
.ts-models{display:flex;flex-direction:column;flex:1;min-width:300px}
.ts-model{display:flex;align-items:flex-start;gap:10px;padding:8px 4px;border-bottom:1px solid var(--dsw-alias-border-l1);cursor:default;border-radius:6px}
.ts-model:hover{background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 4%, transparent)}
.ts-model:last-child{border-bottom:none}
.ts-model .ts-dot{margin-top:5px}
.ts-bartrack{height:6px;border-radius:3px;background:var(--dsw-alias-interactive-bg-hover);flex:1;overflow:hidden;min-width:60px}
.ts-barfill{height:100%;border-radius:3px;transition:width .3s ease;display:block}
.ts-modelname{color:var(--dsw-alias-label-primary);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ts-modelval{color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums;flex:none}
.ts-flexrow{display:flex;gap:20px;align-items:center;justify-content:center;flex-wrap:wrap}
.ts-empty{color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center;padding:28px 0}
.ts-svgwrap{position:relative}
.ts-spark{display:block;width:100%;height:34px;margin-top:6px}
.ts-compose{display:flex;height:8px;border-radius:4px;overflow:hidden;margin-top:6px;background:var(--dsw-alias-interactive-bg-hover)}
.ts-compose span{display:block;height:100%}
.ts-compose-legend{display:flex;gap:8px;margin-top:5px;font-size:10px;color:var(--dsw-alias-label-caption);flex-wrap:wrap;line-height:14px}
.ts-compose-legend i{display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:3px;vertical-align:-1px}
.ts-statgrow{margin-top:6px;font-size:11px;line-height:14px;display:flex;align-items:center;gap:4px}
.ts-arrow{display:inline-block;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;vertical-align:middle}
.ts-arrow-up{border-bottom:5px solid var(--dsw-alias-state-success-primary)}
.ts-arrow-down{border-top:5px solid var(--dsw-alias-state-error-primary)}
.ts-streakbar{height:8px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover);margin-top:7px;overflow:hidden}
.ts-streakfill{height:100%;border-radius:4px;display:block}
.ts-dayscroll{display:flex;gap:1.5px;margin-top:7px;height:12px}
.ts-dayscroll span{flex:1 1 0;min-width:0;border-radius:1.5px;display:block}
.ts-axislbl{fill:var(--dsw-alias-label-caption);font-size:10.5px}
.ts-gridln{stroke:var(--dsw-alias-border-l1);stroke-width:1}
.ts-today{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:10px 12px;margin:8px 0;width:100%;flex:none;cursor:default;box-sizing:border-box;overflow:hidden}
.ts-today:hover{border-color:var(--dsw-alias-state-business-primary)}
.ts-todaylabel{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}
.ts-todayval{color:var(--dsw-alias-label-primary);font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;line-height:24px}
.ts-todayhead{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.ts-todayhead .ts-todayval{font-size:15px;flex:none}
.ts-todaymodels{display:flex;flex-direction:column;align-items:stretch;gap:2px;margin-top:5px}
.ts-todaymchip{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--dsw-alias-label-secondary);max-width:100%;line-height:14px}
.ts-todaymchip .ts-dot{width:7px;height:7px}
.ts-todaymchip span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* ── 侧栏 footer actions 垂直布局：与 Cordis 徽章并排会横向溢出被裁（折叠侧栏仅 56px），改为垂直堆叠 ── */
.hHd-Xa_footerActions{flex-direction:column;align-items:stretch}
.hHd-Xa_collapsed .hHd-Xa_footerActions{align-items:center}
/* 结构化回退（不依赖 dsh 打包类名 hash，随 dsh 升级改名仍生效）：slot 包装的父级即 footerActions */
div:has(> div[data-slot="sidebar.footer.action"]){flex-direction:column;align-items:stretch}
.ts-todayRail{padding:3px 4px;box-sizing:border-box;min-width:0;max-width:100%;width:auto;margin:2px 0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;background:var(--dsw-alias-bg-layer-1);cursor:pointer}
.ts-todayRail:hover{border-color:var(--dsw-alias-state-business-primary)}
.ts-todayRail .ts-todaymodels,.ts-todayRail .ts-spark,.ts-todayRail .ts-statgrow{display:none}
.ts-todayRail .ts-todayhead{display:none}
.ts-todayRail .ts-todayval{font-size:9px;line-height:12px;text-align:center;white-space:nowrap;font-weight:600}
.ts-todayRail .ts-todaylabel{font-size:8px;line-height:11px;text-align:center;white-space:nowrap;letter-spacing:.06em}
/* ── 今日卡浮窗：抓手拖出 / 标题栏拖到任意位置 / 双击或📌收回 ── */
.ts-todayhead .ts-todayval{margin-left:auto}
.ts-grip{flex:none;cursor:grab;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1;padding:4px 2px;border-radius:6px;user-select:none;-webkit-user-select:none;touch-action:none}
.ts-grip:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.ts-grip:active{cursor:grabbing}
.ts-minibtn{flex:none;background:transparent;border:1px solid transparent;border-radius:6px;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:11px;padding:2px 6px;font-family:inherit;line-height:16px;margin-left:6px}
.ts-minibtn:hover{border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
.ts-float{position:fixed;z-index:300;width:300px;max-width:calc(100vw - 16px);background:color-mix(in srgb, var(--dsw-alias-bg-layer-1) 72%, transparent);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.3);padding:10px 12px;box-sizing:border-box;overflow:hidden}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.ts-float{background:var(--dsw-alias-bg-layer-1)}}
.ts-floathead{cursor:move;user-select:none;-webkit-user-select:none;touch-action:none}
.ts-swrow{display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 14px;margin:0 0 12px}
.ts-swlabel{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}
.ts-swhint{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.ts-switch{position:relative;width:38px;height:22px;border-radius:11px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;padding:0;flex:none;transition:background .18s}
.ts-switch[aria-checked="true"]{background:var(--dsw-alias-state-business-primary);border-color:transparent}
.ts-switch .ts-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground);transition:left .18s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.ts-switch[aria-checked="true"] .ts-knob{left:19px}

/* ── 动画与过渡增强（置于 CSS 末尾：覆盖同特异性前序声明）────────── */
/* 注意：悬浮层用 position:fixed 跟随鼠标，祖先的 transform/filter 会劫持其定位基准
   （悬浮直接飞出屏幕、看起来像没生效）——卡片悬停浮起一律用 top，禁用 transform */
.ts-card{position:relative;transition:border-color .2s,top .2s;animation:ts-fadeup .42s ease backwards}
.ts-card:hover{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 45%,var(--dsw-alias-border-l1));top:-1px}
.ts-stat{position:relative;transition:border-color .18s,top .18s,box-shadow .18s;animation:ts-fadeup .42s ease backwards}
.ts-stat:hover{border-color:var(--dsw-alias-state-business-primary);top:-1.5px;box-shadow:0 3px 12px -4px rgba(0,0,0,.18)}
.ts-stat[data-tint="1"] .ts-stat-value{background:linear-gradient(100deg,var(--dsw-alias-state-business-primary),color-mix(in srgb,var(--dsw-alias-state-business-primary) 52%,#34d399));-webkit-background-clip:text;background-clip:text;color:transparent}
.ts-btn{transition:background .15s,border-color .15s}
.ts-btn:hover:not(:disabled){border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 55%,var(--dsw-alias-border-l2))}
.ts-select{transition:border-color .15s}
.ts-select:focus{border-color:var(--dsw-alias-state-business-primary)}
.ts-seg-btn{transition:color .15s,background .15s}
.ts-seg-on{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent)}
.ts-modelchip{position:relative;transition:border-color .15s,top .15s,opacity .2s}
.ts-modelchip:hover{top:-1px}
.ts-model{transition:background .15s}
.ts-modelval{transition:color .15s}
.ts-today{transition:border-color .18s}
.ts-pop,.ts-tipfixed{animation:ts-pop .13s ease-out}
.ts-gridln,.ts-axislbl{animation:ts-fade .5s ease backwards}
.ts-barfill,.ts-streakfill,.ts-pop-fill,.ts-compose span{transform-origin:left center;animation:ts-groww .55s cubic-bezier(.22,.8,.36,1) backwards}
/* 条宽只在入场生长一次：增量更新直接落值，不再滑动重播（transition 会随值变化重播） */
.ts-barfill{transition:none}
.ts-compose span{animation-delay:.1s}
.ts-streakfill{animation-delay:.12s}
.ts-pop-fill{animation-delay:.06s}
.ts-dayscroll span{animation:ts-fade .4s ease backwards}
.ts-draw{stroke-dasharray:20000;animation:ts-draw 1.05s cubic-bezier(.4,0,.2,1) backwards}
.ts-fadein{animation:ts-fade .45s ease backwards}
.ts-rise{transform-box:fill-box;transform-origin:bottom center;animation:ts-risev .5s cubic-bezier(.22,.8,.36,1) backwards}
.ts-hcell[data-lv]:not([data-lv="0"]){animation:ts-heatin .5s cubic-bezier(.2,.8,.3,1.2) backwards}
.ts-donutseg{animation:ts-donutseg .85s cubic-bezier(.3,.6,.3,1) backwards}
.ts-donut-c{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);width:110px;text-align:center;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;line-height:20px;pointer-events:none}
.ts-donut-cap{position:absolute;left:50%;top:calc(46% + 18px);transform:translateX(-50%);width:110px;text-align:center;font-size:11px;color:var(--dsw-alias-label-caption);pointer-events:none}
.ts-spin{display:inline-block;animation:ts-rot 1s linear infinite}
@keyframes ts-fadeup{from{opacity:0;transform:translateY(6px)}}
@keyframes ts-fade{from{opacity:0}}
@keyframes ts-draw{from{stroke-dashoffset:20000}to{stroke-dashoffset:0}}
@keyframes ts-groww{from{transform:scaleX(0)}}
@keyframes ts-risev{from{transform:scaleY(0)}}
@keyframes ts-heatin{from{opacity:0;transform:scale(.4)}}
@keyframes ts-donutseg{from{stroke-dashoffset:0}}
@keyframes ts-rot{to{transform:rotate(360deg)}}
@keyframes ts-pop{from{opacity:0;transform:scale(.96)}}
@media (prefers-reduced-motion:reduce){.ts-page *,.ts-today *,.ts-pop,.ts-tipfixed{animation:none!important;transition:none!important}}
`

    //#endregion
    //#region ui ─────────────────────────────────────────────────────────

    /** 数字滚动动画：只在首次挂载播一次（从 0 滚到目标）；后续增量更新直接落值，不再重播。 */
    function AnimatedNumber(props) {
      const [disp, setDisp] = React.useState(0)
      const ref = React.useRef(0)
      const played = React.useRef(false)
      React.useEffect(() => {
        const to = Number(props.value) || 0
        if (played.current) {
          if (ref.current !== to) { ref.current = to; setDisp(to) }
          return undefined
        }
        played.current = true
        const from = ref.current
        if (from === to) return undefined
        const dur = props.duration || 650
        const t0 = performance.now()
        let raf = 0
        const step = (t) => {
          const p = Math.min(1, (t - t0) / dur)
          const e = 1 - Math.pow(1 - p, 3)
          const v = from + (to - from) * e
          ref.current = v
          setDisp(v)
          if (p < 1) raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
        return () => cancelAnimationFrame(raf)
      }, [props.value])
      const format = props.format || ((v) => Math.round(v).toLocaleString('en-US'))
      return el('div', { className: props.className || '', style: props.style || undefined }, format(disp))
    }

    function Seg(props) {
      return el('div', { className: 'ts-seg' }, props.options.map((o) =>
        el('button', {
          key: o.v, className: 'ts-seg-btn' + (props.current === o.v ? ' ts-seg-on' : ''),
          'aria-pressed': props.current === o.v ? 'true' : 'false',
          onClick: () => props.onPick(o.v)
        }, o.t)))
    }

    /** 指标卡：visual = 额外可视化 children；count = 数字滚动（tint = 渐变强调）。 */
    function StatCard(props) {
      const valueNode = props.count !== undefined
        ? el(AnimatedNumber, { className: 'ts-stat-value', value: props.count, format: props.fmt || fmt })
        : el('div', { className: 'ts-stat-value' }, props.value)
      return el('div', {
        className: 'ts-stat',
        'data-tint': props.tint ? '1' : '0',
        style: props.delay !== undefined ? { animationDelay: props.delay + 'ms' } : undefined,
        onMouseEnter: props.onHover || undefined,
        onMouseMove: props.onHover || undefined,
        onMouseLeave: props.onLeave || undefined
      },
        el('div', { className: 'ts-stat-label' }, props.label),
        valueNode,
        props.sub ? el('div', { className: 'ts-stat-sub' }, props.sub) : null,
        ...(props.visual || []))
    }

    /** 构成明细悬浮内容：[[标签, 量, _, 总量]..]。 */
    function breakdown(title, parts) {
      return el('div', null,
        el('div', { className: 'ts-pop-title' }, title),
        parts.map((p) => el('div', { key: p[0], className: 'ts-pop-row' },
          el('span', { className: 'ts-pop-k' }, p[0]),
          el('span', { className: 'ts-pop-v' }, fmtFull(p[1]) + ' · ' + (p[3] > 0 ? (p[1] / p[3] * 100).toFixed(1) : '0.0') + '%'))))
    }

    /** 堆叠构成条：parts=[[标签, 量, 颜色]..]。 */
    function ComposeBar(props) {
      const parts = props.parts || []
      const total = parts.reduce((s, p) => s + p[1], 0)
      if (total <= 0) return null
      return el('div', null,
        el('div', { className: 'ts-compose' }, parts.filter((p) => p[1] > 0).map((p) => {
          const w = p[1] / total * 100
          return el('span', { key: p[0], style: { width: w.toFixed(2) + '%', background: p[2] } })
        })),
        el('div', { className: 'ts-compose-legend' },
          parts.map((p) => el('span', { key: p[0] },
            el('i', { style: { background: p[2] } }), p[0]))))
    }

    /** Sparkline 迷你面积图（卡片内纯走势）。 */
    function Sparkline(props) {
      const vals = props.values || []
      const W = 150, H = 34, PAD = 2
      if (vals.length < 2) return null
      const min = Math.min(...vals), max = Math.max(...vals)
      const span = max - min || 1
      const xs = (i) => PAD + (W - PAD * 2) * i / (vals.length - 1)
      const ys = (v) => H - PAD - ((v - min) / span) * (H - PAD * 2)
      const line = smoothPath(vals.map((v, i) => [xs(i), ys(v)]))
      const area = line + ' L ' + xs(vals.length - 1).toFixed(1) + ' ' + (H - PAD) + ' L ' + xs(0).toFixed(1) + ' ' + (H - PAD) + ' Z'
      const c = props.color || BP
      return el('svg', { className: 'ts-spark', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' },
        el('path', { d: area, className: 'ts-fadein', style: { fill: c, fillOpacity: 0.13, animationDelay: '.18s' } }),
        el('path', { d: line, className: 'ts-draw', fill: 'none', style: { stroke: c, strokeWidth: 1.5, strokeLinecap: 'round', animationDelay: '.12s' } }),
        el('circle', { cx: xs(vals.length - 1), cy: ys(vals[vals.length - 1]), r: 1.8, className: 'ts-fadein', style: { fill: c, animationDelay: '.55s' } }))
    }

    /** 涨跌指示（近 7 天 vs 前 7 天）。 */
    function TrendDelta(props) {
      const recent = props.recent, before = props.before
      if (before === 0 && recent === 0) return null
      const delta = before === 0 ? null : (recent - before) / before * 100
      let arrow = 'flat', color = 'var(--dsw-alias-label-tertiary)', text = '持平'
      if (delta === null) { arrow = 'up'; text = '新增' }
      else if (delta > 2) { arrow = 'up'; color = 'var(--dsw-alias-state-success-primary)'; text = '+' + delta.toFixed(0) + '%' }
      else if (delta < -2) { arrow = 'down'; color = 'var(--dsw-alias-state-error-primary)'; text = delta.toFixed(0) + '%' }
      return el('div', { className: 'ts-statgrow ts-fadein', style: { color } },
        el('span', { className: 'ts-arrow ts-arrow-' + arrow }),
        el('span', null, text + '（对比前 7 天）'))
    }

    /** 连击进度条：当前连击相对历史最长。 */
    function StreakBar(props) {
      const pct = props.best > 0 ? Math.min(100, props.current / props.best * 100) : 0
      return el('div', { className: 'ts-streakbar' },
        el('span', { className: 'ts-streakfill', style: { width: pct.toFixed(1) + '%', background: 'linear-gradient(90deg, var(--dsw-alias-state-business-primary), color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, transparent))' } }))
    }

    /** 活跃日条带：全量首日→今天按月分桶的活跃比例。 */
    function DaysRibbon(props) {
      const byDay = props.byDay
      if (byDay === undefined || byDay.size === 0) return null
      const keys = Array.from(byDay.keys()).sort()
      const firstT = fromKey(keys[0]), lastT = fromKey(keys[keys.length - 1])
      const NB = Math.min(Math.max(1, Math.round((lastT - firstT) / (30.44 * 86400000)) + 1), 24)
      const buckets = []
      for (let i = 0; i < NB; i++) buckets.push({ active: 0, total: 0 })
      for (let m = firstT; m <= lastT; m += 86400000) {
        const b = Math.min(NB - 1, Math.floor((m - firstT) / (lastT - firstT || 1) * NB))
        buckets[b].total++
        if (byDay.has(keyOf(m))) buckets[b].active++
      }
      return el('div', { className: 'ts-dayscroll' },
        buckets.map((b, i) => {
          const ratio = b.total > 0 ? b.active / b.total : 0
          return el('span', { key: i, style: { background: BP, opacity: ratio === 0 ? 0.08 : (0.15 + ratio * 0.8), animationDelay: (i * 26) + 'ms' } })
        }))
    }

    /** 迷你双柱对比（今日 vs 昨日；悬浮用 ts-tipfixed 场景下的卡片内嵌元素）。 */
    function DualBars(props) {
      const { a, b, height } = props
      const max = Math.max(a, b) || 1
      const H = height || 14
      return el('div', { className: props.className || '', style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: H + 2, marginTop: 3 } },
        el('span', { className: 'ts-rise', style: { width: 9, borderRadius: '2px 2px 0 0', background: BP, display: 'block', height: Math.max(2, a / max * H).toFixed(1) + 'px', animationDelay: '60ms' } }),
        el('span', { className: 'ts-rise', style: { width: 9, borderRadius: '2px 2px 0 0', background: BP, opacity: .28, display: 'block', height: Math.max(2, b / max * H).toFixed(1) + 'px', animationDelay: '150ms' } }))
    }

    //#endregion
    //#region charts ─────────────────────────────────────────────────────

    /** 多系列平滑趋势图：十字竖线 + fixed 悬浮明细（过滤 0 值系列；titles/emptyText 按小时/天口径传入）。 */
    function TrendChart(props) {
      const seriesList = props.series
      const labels = props.labels
      const titles = props.titles || labels
      const emptyText = props.emptyText || '当日无消耗'
      const W = 780, H = 250, pl = 54, pr = 14, pt = 14, pb = 28
      const n = labels.length
      const vis = seriesList.filter((s) => s.visible)
      const top = niceMax(vis.length > 0 ? Math.max(1, ...vis.flatMap((s) => s.values)) : 1)
      const xs = (i) => n <= 1 ? pl + (W - pl - pr) / 2 : pl + (W - pl - pr) * i / (n - 1)
      const ys = (v) => (H - pb) - (v / top) * (H - pb - pt)

      const [hover, setHover] = React.useState(null)
      const svgRef = React.useRef(null)
      const onMove = (e) => {
        const i = hoverIndex(svgRef, e, W, pl, pr, n)
        if (i !== null) setHover({ i, mx: e.clientX, my: e.clientY })
      }

      const kids = []
      const fr = [0, 0.25, 0.5, 0.75, 1]
      for (let fi = 0; fi < fr.length; fi++) {
        const yy = ys(top * fr[fi])
        kids.push(el('line', { key: 'g' + fi, x1: pl, x2: W - pr, y1: yy, y2: yy, className: 'ts-gridln' }))
        kids.push(el('text', { key: 'gt' + fi, x: pl - 8, y: yy + 4, textAnchor: 'end', className: 'ts-axislbl' }, fmt(top * fr[fi])))
      }
      // X 轴刻度：均匀分布（最多 9 个，含首末）。旧逻辑固定步长再硬补末点，
      // 当 (n-1) 不能被步长整除时末段被压缩（如 30 天时 28→29 只隔 1 天宽度），
      // 表现为“前期宽松、越到后面越拥挤”。按 j*(n-1)/(count-1) 四舍五入取整，
      // 间隔恒定 ±1，视觉等距。
      const tickCount = Math.min(n, 9)
      const xt = []
      for (let j = 0; j < tickCount; j++) {
        const idx = tickCount <= 1 ? 0 : Math.round(j * (n - 1) / (tickCount - 1))
        if (xt.length === 0 || xt[xt.length - 1] !== idx) xt.push(idx)
      }
      for (let xi = 0; xi < xt.length; xi++) {
        const i = xt[xi]
        kids.push(el('text', { key: 'x' + i, x: xs(i), y: H - 9, textAnchor: i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle'), className: 'ts-axislbl' }, labels[i]))
      }
      if (hover !== null) {
        kids.push(el('line', { key: 'ch', x1: xs(hover.i), x2: xs(hover.i), y1: pt, y2: H - pb, style: { stroke: BP, strokeWidth: 1, strokeDasharray: '3 3', opacity: .7 } }))
        for (const s of vis) {
          if (s.values[hover.i] === undefined) continue
          kids.push(el('circle', { key: 'd' + s.name, cx: xs(hover.i), cy: ys(s.values[hover.i]), r: 3.5, style: { fill: s.color, stroke: 'var(--dsw-alias-bg-layer-1)', strokeWidth: 1.5 } }))
        }
      }
      let li = 0
      for (const s of seriesList) {
        if (!s.visible) continue
        kids.push(el('path', {
          key: 'ln' + s.name, className: 'ts-draw', d: smoothPath(s.values.map((v, i) => [xs(i), ys(v)])), fill: 'none',
          style: { stroke: s.color, strokeWidth: s.isTotal ? 2.6 : 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: s.isTotal ? 1 : .92, animationDelay: (0.15 + li * 0.09) + 's' }
        }))
        li++
      }
      kids.push(el('rect', { key: 'cap', x: 0, y: 0, width: W, height: H, fill: 'transparent', style: { cursor: 'crosshair' }, onMouseMove: onMove, onMouseLeave: () => setHover(null) }))

      const tip = hover !== null
        ? (() => {
            const active = vis.filter((s) => (s.values[hover.i] || 0) > 0)
            const rows = active.slice().sort((a, b) => (b.values[hover.i] || 0) - (a.values[hover.i] || 0))
            const pos = tipPos(hover.mx, hover.my, 270, 44 + rows.length * 18)
            return el('div', { className: 'ts-tipfixed', style: pos },
              el('div', { className: 'ts-tiprow', style: { fontWeight: 600, marginBottom: 2 } }, titles[hover.i]),
              rows.length > 0
                ? rows.map((s) =>
                    el('div', { key: s.name, className: 'ts-tiprow' },
                      el('span', { className: 'ts-dot', style: { background: s.color, width: 8, height: 8 } }),
                      el('span', { className: 'ts-tip-k', style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.shortName),
                      el('span', { className: 'ts-tip-v' }, fmt(s.values[hover.i] || 0))))
                : el('div', { className: 'ts-tiprow', style: { color: 'var(--dsw-alias-label-tertiary)' } }, emptyText))
          })()
        : null

      return el('div', { className: 'ts-svgwrap' },
        el('svg', { viewBox: '0 0 ' + W + ' ' + H, style: { width: '100%', height: 'auto', display: 'block' }, ref: svgRef }, kids),
        tip)
    }

    /** 热力图（1/3/6/12 月 flex 自适应 + 当日明细悬浮：日期/总量/会话数/模型占比）。 */
    function Heatmap(props) {
      const byDay = props.byDay
      const daySessions = props.daySessions || {}
      const months = props.months || 6
      const today = keyOf(Date.now())
      const todayT = fromKey(today)
      let startW = todayT - Math.max(1, months) * 31 * 86400000
      const dow0 = new Date(startW).getDay()
      startW = startW - ((dow0 + 6) % 7) * 86400000
      const weeks = Math.max(1, Math.ceil((todayT - startW) / 604800000))
      const cols = []
      let max = 1
      for (let w = 0; w < weeks; w++) {
        const col = []
        for (let r = 0; r < 7; r++) {
          const k = keyOf(startW + w * 604800000 + r * 86400000)
          if (k > today) { col.push(null); continue }
          const day = byDay.get(k)
          const v = day === undefined ? 0 : day.t
          col.push({ k, v, day, sess: daySessions[k] || 0 })
          if (v > max) max = v
        }
        cols.push(col)
      }
      const OPS = [0.16, 0.3, 0.5, 0.72, 0.95]
      const levelOf = (v) => v <= 0 ? 0 : v <= max * 0.25 ? 1 : v <= max * 0.5 ? 2 : v <= max * 0.75 ? 3 : 4
      const cellGap = months >= 12 ? 2.5 : (months >= 6 ? 3 : 4)   // 1/3/6 月加大呼吸感

      const [hover, setHover] = React.useState(null)
      const onCell = (cell, e) => {
        if (cell === null || cell.day === undefined) { setHover(null); return }
        setHover({ k: cell.k, day: cell.day, sess: cell.sess, mx: e.clientX, my: e.clientY })
      }

      const WL = ['一', '二', '三', '四', '五', '六', '日']
      const rows = []
      for (let r = 0; r < 7; r++) {
        const cells = []
        for (let w = 0; w < weeks; w++) {
          const cell = cols[w][r]
          cells.push(el('div', {
            key: w,
            className: 'ts-hcell',
            'data-lv': (cell === null || cell.v <= 0) ? '0' : String(levelOf(cell.v)),
            style: (cell === null) ? { visibility: 'hidden' }
              : (cell.v > 0 ? { background: BP, opacity: OPS[levelOf(cell.v)], animationDelay: ((w * 45) % 480) + 'ms' } : undefined),
            onMouseEnter: cell ? (e) => onCell(cell, e) : undefined,
            onMouseMove: cell ? (e) => onCell(cell, e) : undefined,
            onMouseLeave: () => setHover(null)
          }))
        }
        rows.push(el('div', { key: r, style: { display: 'flex', gap: 4, alignItems: 'center' } },
          el('span', { style: { width: 14, fontSize: 9, color: 'var(--dsw-alias-label-caption)', flex: 'none', textAlign: 'center', lineHeight: '14px' } }, r % 2 === 0 ? WL[r] : ''),
          el('div', { className: 'ts-heatrow', style: { gap: cellGap + 'px' } }, cells)))
      }
      const monthLabels = []
      let prevM = null
      for (let w = 0; w < weeks; w++) {
        const mo = Number(keyOf(startW + w * 604800000).slice(5, 7))
        if (mo !== prevM) { monthLabels.push({ w, mo }); prevM = mo }
      }
      const monthRow = el('div', { style: { display: 'flex', gap: 4, marginBottom: 3 } },
        el('span', { style: { width: 14, flex: 'none' } }),
        el('div', { style: { display: 'flex', gap: cellGap + 'px', flex: '1 1 auto', minHeight: 12 } },
          monthLabels.map((m, i) =>
            el('span', { key: i, style: { fontSize: 9.5, color: 'var(--dsw-alias-label-caption)', width: (100 / weeks).toFixed(3) + '%', flex: 'none', overflow: 'hidden', whiteSpace: 'nowrap' } },
              m.mo + '月'))))

      let pop = null
      if (hover !== null) {
        const d = hover.day
        const entries = Object.entries(d.byModel || {}).sort((a, b) => b[1] - a[1])
        const tot = d.t
        const pos = tipPos(hover.mx, hover.my, 300, 80 + Math.min(entries.length, 8) * 18)
        pop = el('div', { className: 'ts-pop', style: pos },
          el('div', { className: 'ts-pop-title' }, cnDate(hover.k)),
          el('div', { className: 'ts-pop-row', style: { marginBottom: 4 } },
            el('span', { className: 'ts-pop-k' }, '总消耗'),
            el('span', { className: 'ts-pop-v' }, fmt(tot)),
            el('span', { className: 'ts-pop-k', style: { paddingLeft: 12 } }, '会话'),
            el('span', { className: 'ts-pop-v' }, String(hover.sess))),
          tot > 0
            ? entries.slice(0, 8).map(([mk, v]) => {
                const info = (props.models || {})[mk]
                const color = modelColor(mk)
                return el('div', { key: mk, className: 'ts-pop-row' },
                  el('span', { className: 'ts-dot', style: { background: color } }),
                  el('span', { style: { maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, info ? info.model : mk),
                  el('span', { className: 'ts-pop-bar' }, el('span', { className: 'ts-pop-fill', style: { width: (tot > 0 ? v / tot * 100 : 0).toFixed(1) + '%', background: color } })),
                  el('span', { className: 'ts-pop-v' }, fmt(v) + ' · ' + (tot > 0 ? (v / tot * 100).toFixed(0) : 0) + '%'))
              })
            : el('div', { className: 'ts-pop-k' }, '当日无用量'),
          entries.length > 8 ? el('div', { className: 'ts-pop-k', style: { marginTop: 4 } }, '…另有 ' + (entries.length - 8) + ' 个模型') : null)
      }

      return el('div', { className: 'ts-heatwrap' }, monthRow, rows, pop)
    }

    function Donut(props) {
      const entries = props.entries; const total = props.total
      const size = 168, cx = 84, cy = 84, r = 57, C = 2 * Math.PI * r
      const kids = [el('circle', { key: 'bg', cx, cy, r, fill: 'none', style: { stroke: 'var(--dsw-alias-interactive-bg-hover)', strokeWidth: 18 } })]
      let acc = 0
      for (let i = 0; i < entries.length; i++) {
        const it = entries[i]
        const len = total > 0 ? (it.t / total) * C : 0
        kids.push(el('circle', {
          key: 's' + i, cx, cy, r, fill: 'none', className: 'ts-donutseg',
          strokeDasharray: len.toFixed(2) + ' ' + (C - len).toFixed(2),
          strokeDashoffset: (-acc).toFixed(2),
          style: { stroke: it.color, strokeWidth: 18, animationDelay: (i * 70) + 'ms' },
          transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
        }))
        acc += len
      }
      // 中心数字移出 SVG（滚动动画由 AnimatedNumber 驱动），包装一层相对容器
      return el('div', { style: { position: 'relative', width: size, height: size, flex: 'none' } },
        el('svg', { viewBox: '0 0 ' + size + ' ' + size, style: { width: size, height: size, display: 'block' } }, kids),
        el(AnimatedNumber, { className: 'ts-donut-c', value: total, format: fmt }),
        el('div', { className: 'ts-donut-cap' }, '累计 Token'))
    }

    /** 侧栏今日迷你多模型曲线：分色 + 十字 + fixed 悬浮（不裁剪）。 */
    function TodayChart(props) {
      const seriesList = props.series
      const n = props.n
      const W = 160, H = 44, PAD = 3
      const [hover, setHover] = React.useState(null)
      const svgRef = React.useRef(null)
      if (n < 2 || seriesList.length === 0) return null
      const maxV = Math.max(1, ...seriesList.flatMap((s) => s.values))
      const xs = (i) => PAD + (W - PAD * 2) * i / (n - 1)
      const ys = (v) => H - PAD - (v / maxV) * (H - PAD * 2)
      const onMove = (e) => {
        const i = hoverIndex(svgRef, e, W, PAD, PAD, n)
        if (i !== null) setHover({ i, mx: e.clientX, my: e.clientY })
      }
      const kids = []
      if (hover !== null) {
        kids.push(el('line', { key: 'ch', x1: xs(hover.i), x2: xs(hover.i), y1: PAD, y2: H - PAD, style: { stroke: BP, strokeWidth: 1, strokeDasharray: '2 2', opacity: .7 } }))
      }
      for (let si = 0; si < seriesList.length; si++) {
        const s = seriesList[si]
        kids.push(el('path', { key: 'l' + s.name, className: 'ts-draw', d: smoothPath(s.values.map((v, i) => [xs(i), ys(v)])), fill: 'none',
          style: { stroke: s.color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: .9, animationDelay: (0.1 + si * 0.12) + 's' } }))
        kids.push(el('circle', { key: 'e' + s.name, cx: xs(n - 1), cy: ys(s.values[n - 1] || 0), r: 1.8, className: 'ts-fadein', style: { fill: s.color, animationDelay: (0.55 + si * 0.12) + 's' } }))
        if (hover !== null) {
          kids.push(el('circle', { key: 'h' + s.name, cx: xs(hover.i), cy: ys(s.values[hover.i] || 0), r: 2.2, style: { fill: s.color, stroke: 'var(--dsw-alias-bg-layer-1)', strokeWidth: 1 } }))
        }
      }
      kids.push(el('rect', { key: 'cap', x: 0, y: 0, width: W, height: H, fill: 'transparent', style: { cursor: 'crosshair' }, onMouseMove: onMove, onMouseLeave: () => setHover(null) }))
      const tip = hover !== null
        ? (() => {
            const active = seriesList.filter((s) => (s.values[hover.i] || 0) > 0)
            const pos = tipPos(hover.mx, hover.my, 170, 34 + active.length * 16)
            return tsPortal(el('div', { className: 'ts-tipfixed' + (props.floatTip === true ? ' ts-tipfloat' : ''), style: { ...pos, fontSize: 10.5 } },
              el('div', { style: { fontWeight: 600 } }, hover.i + ':00'),
              active.length > 0
                ? active.sort((a, b) => (b.values[hover.i] || 0) - (a.values[hover.i] || 0)).map((s) =>
                    el('div', { key: s.name, className: 'ts-tiprow' },
                      el('span', { className: 'ts-dot', style: { background: s.color, width: 6, height: 6 } }),
                      el('span', { className: 'ts-tip-k', style: { overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 } }, s.shortName),
                      el('span', { className: 'ts-tip-v' }, fmt(s.values[hover.i] || 0))))
                : el('div', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, '该小时无消耗')))
          })()
        : null
      return el('div', { className: 'ts-svgwrap' },
        el('svg', { className: 'ts-spark', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', ref: svgRef }, kids),
        tip)
    }

    //#endregion
    //#region page ───────────────────────────────────────────────────────

    const RANGES = [{ v: '7', t: '近7天' }, { v: '30', t: '近30天' }, { v: '90', t: '近90天' }, { v: 'all', t: '全部' }]
    const rangeText = (rv) => { for (let i = 0; i < RANGES.length; i++) { if (RANGES[i].v === rv) return RANGES[i].t } return '' }

    /** 设置页主体（单页 + 顶部开关 + 指标卡可视化 + 三图表）。 */
    function createSection(bridge, prefs) {
      return function TokenStatsSection() {
        const [data, setData] = React.useState(null)
        const [err, setErr] = React.useState(null)
        const [loading, setLoading] = React.useState(true)
        const [range, setRange] = React.useState('30')
        const [trendRange, setTrendRange] = React.useState('30d')
        const [heatSpan, setHeatSpan] = React.useState('6')
        const [modelOff, setModelOff] = React.useState({})
        const [showTotal, setShowTotal] = React.useState(false)
        const [statPop, setStatPop] = React.useState(null)
        const [todayOn, setTodayOn] = React.useState(false)
        const tsFl = useTsFloat()
        // 偏好经标准 settings 加载（挂载后回填；失败则保持默认）
        React.useEffect(() => {
          let alive = true
          if (prefs && typeof prefs.getPrefs === 'function') {
            prefs.getPrefs().then((p) => {
              if (!alive || !p) return
              setTodayOn(p.showToday === true)
              if (typeof p.defaultRange === 'string') setRange(p.defaultRange)
            }).catch(() => {})
          }
          return () => { alive = false }
        }, [])

        // 刷新调度状态（hooks 区统一声明，early return 之前）
        const inflight = React.useRef(false)    // 请求进行中标记：防叠加
        const lastSig = React.useRef(null)      // 上次已渲染载荷签名：无变化跳过
        const spinTimer = React.useRef(0)       // 延迟转圈定时器
        const dataRef = React.useRef(null)      // 最新 data 镜像：轮询链读它，不闭包过期值
        dataRef.current = data
        const stallRef = React.useRef({ scanned: -1, same: 0 })  // 停滞计数：退避用
        const sigOf = (v) => v.scanned + '/' + v.total + '/' + v.errors + '/' + v.partial + '/' + v.records.length + '/' + v.records.reduce((s, r) => s + tok(r), 0)

        const refresh = React.useCallback((force) => {
          // 请求守卫：上一次还没回来时跳过，防叠加轰炸 host
          if (inflight.current && force !== true) return
          inflight.current = true
          // 延迟转圈：400ms 内返回不闪「刷新中」
          window.clearTimeout(spinTimer.current)
          spinTimer.current = window.setTimeout(() => setLoading(true), 400)
          bridge.getData().then((value) => {
            window.clearTimeout(spinTimer.current)
            inflight.current = false
            setLoading(false)
            if (value && value.ready === true) {
              // 签名去重：载荷无实质变化不 setData，数字/动画不再空转重播
              const sig = sigOf(value)
              if (sig !== lastSig.current) { lastSig.current = sig; setData(value); setErr(null) }
            } else setErr((value && value.error) || '统计服务不可用')
          }).catch((error) => {
            window.clearTimeout(spinTimer.current)
            inflight.current = false
            setLoading(false)
            setErr(String((error && error.message) || error))
          })
        }, [])
        React.useEffect(() => { refresh(true) }, [refresh])

        // 60s 自动刷新（页面可见时）+ 切回页面即刷
        React.useEffect(() => {
          const tick = () => { if (document.visibilityState === 'visible') refresh() }
          const id = window.setInterval(tick, 60000)
          const onVis = () => { if (document.visibilityState === 'visible') refresh() }
          document.addEventListener('visibilitychange', onVis)
          return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); window.clearTimeout(spinTimer.current) }
        }, [refresh])

        // partial 加速轮询：2s 起步；scanned 连续 8 轮无进展退避到 12s
        //（host 侧个别会话超时重试中时不空转；60s 基线仍会补全）
        React.useEffect(() => {
          if (data === null || data.partial !== true) { stallRef.current.same = 0; return undefined }
          let alive = true
          let timer = 0
          const st = stallRef.current
          if (data.scanned === st.scanned) st.same++
          else { st.same = 0; st.scanned = data.scanned }
          const arm = () => {
            if (!alive) return
            timer = window.setTimeout(() => {
              if (!alive) return
              const d = dataRef.current
              if (d !== null && d.partial === true) {
                if (d.scanned === st.scanned) st.same++
                else { st.same = 0; st.scanned = d.scanned }
                if (document.visibilityState === 'visible') refresh()
              }
              arm()
            }, st.same >= 8 ? 12000 : 2000)
          }
          arm()
          return () => { alive = false; window.clearTimeout(timer) }
        }, [data, refresh])

        // 昂贵派生（两次全量 aggregate + 颜色表）只随数据/范围重算：
// 悬浮 tooltip 的每次 mousemove 只改 statPop，不再触发全量重算。
        const derived = React.useMemo(() => {
          if (data === null) return null
          buildModelColors(data.models)
          const tk = keyOf(Date.now())
          const c = range === 'all' ? null : keyOf(fromKey(tk) - (Number(range) - 1) * 86400000)
          return {
            todayK: tk, cut: c,
            scoped: c === null ? null : aggregate(data.records, c),
            aggAll: aggregate(data.records, null)
          }
        }, [data, range])

        const children = []
        children.push(el('h3', { className: 'ts-title' }, 'Token 用量统计（token-stats）'))
        children.push(el('p', { className: 'ts-desc' },
          '聚合本机全部会话日志（含子代理会话；fork/resume 种子事件已去重）。数据每 60 秒自动刷新；时间范围作用于当前范围卡片与模型分布，趋势图用自带的近24小时 / 近7天 / 近30天切换，总览与热力图为全量数据。'))

        // 顶部功能开关：侧栏「今日用量」小卡片
        children.push(el('div', { className: 'ts-swrow' },
          el('div', null,
            el('div', { className: 'ts-swlabel' }, '在侧边栏显示今日用量'),
            el('div', { className: 'ts-swhint' }, '开启后左侧边栏底部显示今日 Token 消耗小卡片（含分色小时曲线与昨日对比；偏好存 settings.yaml · dshp-inx-token-stats）')),
          el('button', {
            className: 'ts-switch', role: 'switch', 'aria-checked': todayOn ? 'true' : 'false',
            onClick: () => { const next = !todayOn; setTodayOn(next); if (prefs) prefs.setToday(next) }
          },
            el('span', { className: 'ts-knob' }))))

        // 今日卡浮窗行：弹出后侧边栏零占位，在此一键收回
        children.push(el('div', { className: 'ts-swrow' },
          el('div', null,
            el('div', { className: 'ts-swlabel' }, '今日卡片浮窗'),
            el('div', { className: 'ts-swhint' }, '弹出后可拖到屏幕任意位置，侧边栏不再占位；开关与坐标存本机 localStorage')),
          tsFl.open
            ? el('button', { className: 'ts-btn', onClick: () => tsFloatSet(false) }, '收回侧边栏')
            : el('div', { className: 'ts-hint' }, '在侧边栏中（卡片标题栏 ⠿ 可拖出）')))

        if (err) {
          children.push(el('div', { className: 'ts-notice ts-notice-err' }, '读取失败：' + err))
          children.push(el('button', { className: 'ts-btn', onClick: refresh }, '重试'))
          return el('div', { className: 'ts-page' }, children)
        }
        if (data === null) {
          children.push(el('div', { className: 'ts-notice ts-notice-empty' }, loading ? '正在统计会话日志…' : '暂无数据'))
          return el('div', { className: 'ts-page' }, children)
        }

        const todayK = derived.todayK
        const scoped = derived.scoped
        const aggAll = derived.aggAll
        const hasData = aggAll.first !== null

        const storageTipContent = el('div', null,
          el('div', { className: 'ts-pop-title' }, '持久化缓存不可用'),
          el('div', { className: 'ts-pop-row' },
            el('span', { className: 'ts-pop-k' }, '统计仍正常运行；重启后需全量重扫。详情见宿主日志 [dshp-inx-token-stats] storage domain')))
        const showStorageTip = (e) => setStatPop({ mx: e.clientX, my: e.clientY, content: storageTipContent })

        children.push(el('div', { className: 'ts-toolbar' },
          el('label', { className: 'ts-hint' }, '时间范围'),
          el('select', { className: 'ts-select', value: range, onChange: (e) => setRange(e.target.value) },
            RANGES.map((o) => el('option', { key: o.v, value: o.v }, o.t))),
          el('span', { className: 'ts-hint', style: { marginLeft: 'auto' } },
            '更新于 ' + hhmm(data.generatedAt) + (loading ? ' · 刷新中…' : '')),
          data.storage === 'disabled'
            ? el('span', { className: 'ts-hint', style: { cursor: 'help' },
                onMouseEnter: showStorageTip, onMouseMove: showStorageTip, onMouseLeave: () => setStatPop(null) }, '⚠ 无持久缓存')
            : null,
          el('button', { className: 'ts-btn', onClick: refresh, disabled: loading },
            el('span', { className: loading ? 'ts-spin' : '' }, '↻'),
            loading ? ' 刷新中…' : ' 刷新')))

        // 条件块一律用 null 占位保住数组位置：显隐只装卸自己，后续兄弟不移位、
        // 不重挂（重挂会重播全部入场动画——模型工作时 partial 每轮翻转即全页重播）
        {
          const pct = data.total > 0 ? Math.round((data.scanned / data.total) * 100) : 0
          children.push(data.partial === true
            ? el('div', { className: 'ts-notice ts-notice-empty', style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
              el('span', null, '后台统计中 ' + pct + '%（' + data.scanned + '/' + data.total + ' 个会话）—— 已扫描部分先展示，完成后自动补全。'),
              data.errors > 0 ? el('span', { className: 'ts-muted' }, data.errors + ' 个会话读取失败已跳过') : null)
            : null)
        }

        if (!hasData) {
          children.push(el('div', { className: 'ts-empty' },
            '暂无 Token 用量数据 — 发起一次对话后会自动统计（已扫描 ' + data.sessions + ' 个会话）'))
          return el('div', { className: 'ts-page' }, children)
        }

        // ── 指标卡（全量；每卡配可视化）──────────────────────────
        const st = streaks(aggAll.byDay)
        let peakDay = null
        for (const day of aggAll.byDay.values()) { if (peakDay === null || day.t > peakDay.t) peakDay = day }
        const dayVals = Array.from(aggAll.byDay.values()).map((d) => d.t)
        const avgDay = dayVals.length > 0 ? aggAll.total / dayVals.length : 0
        const medDay = median(dayVals)
        const leaveStat = () => setStatPop(null)

        const allDays = buildDayList(aggAll.first, todayK)
        const dayVal = (k) => { const d = aggAll.byDay.get(k); return d === undefined ? 0 : d.t }
        const sparkVals = allDays.slice(-30).map(dayVal)
        const last7 = allDays.slice(-7).reduce((s, k) => s + dayVal(k), 0)
        const prev7 = allDays.slice(-14, -7).reduce((s, k) => s + dayVal(k), 0)
        const CI = '#4c7ef3', CO = '#2fb261', CC = '#f5a623'

        const cards = []
        cards.push(el(StatCard, {
          label: '累计 Token', count: aggAll.total, tint: true, sub: '输入 ' + fmt(aggAll.i) + ' · 输出 ' + fmt(aggAll.o), delay: cards.length * 45,
          onHover: (e) => setStatPop({ mx: e.clientX, my: e.clientY, content: breakdown('累计构成', [
            ['输入', aggAll.i, 1, aggAll.total], ['输出', aggAll.o, 1, aggAll.total],
            ['缓存读', aggAll.cr, 1, aggAll.total], ['缓存写', aggAll.cw, 1, aggAll.total]
          ]) }), onLeave: leaveStat,
          visual: [el(ComposeBar, { parts: [
            ['输入', aggAll.i, CI], ['输出', aggAll.o, CO],
            ['缓存读', aggAll.cr, CC], ['缓存写', aggAll.cw, '#9a6ef1']
          ] })]
        }))
        cards.push(el(StatCard, {
          label: '近 30 天走势', count: sparkVals.reduce((s, v) => s + v, 0), sub: '每日用量迷你图', delay: cards.length * 45,
          visual: [el(Sparkline, { values: sparkVals }),
            el(TrendDelta, { recent: last7, before: prev7 })]
        }))
        cards.push(el(StatCard, {
          label: '缓存 Token', count: aggAll.cr + aggAll.cw, sub: '命中 ' + fmt(aggAll.cr) + ' · 写入 ' + fmt(aggAll.cw), delay: cards.length * 45,
          onHover: (e) => setStatPop({ mx: e.clientX, my: e.clientY, content: breakdown('缓存构成 · 命中率 ' + (aggAll.total > 0 ? (aggAll.cr / aggAll.total * 100).toFixed(1) : '0.0') + '%', [
            ['缓存读（命中）', aggAll.cr, 1, aggAll.total], ['缓存写', aggAll.cw, 1, aggAll.total]
          ]) }), onLeave: leaveStat,
          visual: [el(ComposeBar, { parts: [['缓存读', aggAll.cr, CC], ['缓存写', aggAll.cw, '#9a6ef1']] })]
        }))
        cards.push(data.peakStep ? el(StatCard, {
          label: '峰值单次请求', count: data.peakStep.tokens, sub: data.peakStep.model + ' · ' + dispDay(data.peakStep.d), delay: cards.length * 45
        }) : null)
        cards.push(peakDay ? el(StatCard, {
          label: '峰值单日', count: peakDay.t, sub: dispDay(peakDay.d), delay: cards.length * 45,
          onHover: (e) => setStatPop({ mx: e.clientX, my: e.clientY, content: breakdown(peakDay.d + ' 各模型', Object.entries(peakDay.byModel || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([mk, v]) => {
            return [mk, v, 1, peakDay.t]
          })) }), onLeave: leaveStat,
          visual: [el(ComposeBar, { parts: Object.entries(peakDay.byModel || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([mk, v]) => {
            const info = data.models[mk]
            return [info ? info.model : mk, v, modelColor(mk)]
          }) })]
        }) : null)
        cards.push(el(StatCard, { label: '日均消耗', count: avgDay, sub: '按活跃日平均', delay: cards.length * 45,
          visual: [el(Sparkline, { values: sparkVals, color: CO })] }))
        cards.push(el(StatCard, { label: '日消耗中位数', count: medDay, sub: '按活跃日取中位', delay: cards.length * 45 }))
        cards.push(el(StatCard, { label: '当前连续使用', count: st.current, fmt: (v) => fmt(v) + ' 天', sub: '按自然日统计', delay: cards.length * 45,
          visual: [el(StreakBar, { current: st.current, best: st.longest })] }))
        cards.push(el(StatCard, { label: '最长连续使用', count: st.longest, fmt: (v) => fmt(v) + ' 天', sub: '历史最佳纪录', delay: cards.length * 45,
          visual: [el(StreakBar, { current: st.current, best: st.longest })] }))
        cards.push(el(StatCard, { label: '活跃天数', count: aggAll.byDay.size, fmt: (v) => fmt(v) + ' 天', sub: '共 ' + data.sessions + ' 个会话', delay: cards.length * 45,
          visual: [el(DaysRibbon, { byDay: aggAll.byDay })] }))
        cards.push(el(StatCard, { label: '模型调用次数', count: aggAll.n, sub: data.active + ' 个会话有用量', delay: cards.length * 45 }))
        cards.push(el(StatCard, { label: '首次使用', value: dispDay(aggAll.first), sub: aggAll.first }))
        cards.push(el(StatCard, { label: '最近使用', value: dispDay(aggAll.last), sub: aggAll.last }))
        children.push(el('div', { className: 'ts-grid' }, cards))

        children.push(statPop !== null
          ? el('div', { className: 'ts-pop', style: tipPos(statPop.mx, statPop.my, 280, 60) }, statPop.content)
          : null)

        children.push(scoped !== null
          ? el('div', { className: 'ts-card' },
            el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' } },
              el('span', { className: 'ts-muted' }, '当前范围（' + rangeText(range) + '）'),
              el('span', { style: { fontVariantNumeric: 'tabular-nums' } },
                fmt(scoped.total) + ' tokens · 输入 ' + fmt(scoped.i) + ' · 输出 ' + fmt(scoped.o) + ' · ' + fmtFull(scoped.n) + ' 次调用')))
          : null)

        // ── 趋势（近24小时按小时 / 近7天按天 / 近30天按天 + 模型筛选 + 平滑曲线）──
        // 独立于顶部时间范围：横轴点数恒等于窗口（24 / 7 / 30），按天档为原始单日值
        //（不再做滚动日均）；悬浮标题用完整日期，跨天小时桶标注“昨日”。
        const sc = scoped !== null ? scoped : aggAll
        let trendLabels, trendTitles, trendEmpty
        const trendSeries = []
        if (trendRange === '24h') {
          // 近24小时：24 个整点小时桶（[now-23h .. now] 向整点取整），跨天部分即昨日同时段
          const endH = new Date()
          endH.setMinutes(0, 0, 0)
          const slots = []
          for (let k = 23; k >= 0; k--) {
            const t = endH.getTime() - k * 3600000
            slots.push({ d: keyOf(t), h: new Date(t).getHours() })
          }
          trendLabels = slots.map((s) => s.d === todayK ? s.h + ':00' : '昨日' + s.h + ':00')
          trendTitles = slots.map((s) => cnDate(s.d) + ' ' + s.h + ':00–' + (s.h + 1) + ':00')
          trendEmpty = '该小时无消耗'
          const slotIdx = new Map()
          for (let i = 0; i < slots.length; i++) slotIdx.set(slots[i].d + '|' + slots[i].h, i)
          const hourVals = new Map()
          for (const r of data.records) {
            const idx = slotIdx.get(r.d + '|' + r.h)
            if (idx === undefined) continue
            let arr = hourVals.get(r.m)
            if (arr === undefined) { arr = new Array(24).fill(0); hourVals.set(r.m, arr) }
            arr[idx] += tok(r)
          }
          const hourTotal = new Array(24).fill(0)
          for (const arr of hourVals.values()) { for (let i = 0; i < 24; i++) hourTotal[i] += arr[i] }
          for (const mk of Array.from(hourVals.keys()).sort()) {
            trendSeries.push({
              name: mk, shortName: (data.models[mk] || {}).model || mk, color: modelColor(mk), isTotal: false,
              values: hourVals.get(mk), visible: !modelOff[mk]
            })
          }
          trendSeries.push({
            name: '__total__', shortName: '总 Token', color: '#8a94a6', isTotal: true,
            values: hourTotal, visible: showTotal
          })
        } else {
          // 近7天 / 近30天：按天原始值（所见即该日消耗）
          const N = trendRange === '7d' ? 7 : 30
          const dayList = buildDayList(keyOf(fromKey(todayK) - (N - 1) * 86400000), todayK)
          trendLabels = dayList.map(dispDay)
          trendTitles = dayList.map(cnDate)
          trendEmpty = '当日无消耗'
          for (const mk of Array.from(aggAll.byModel.keys()).sort()) {
            trendSeries.push({
              name: mk, shortName: (data.models[mk] || {}).model || mk, color: modelColor(mk), isTotal: false,
              values: dayList.map((k) => { const d = aggAll.byDay.get(k); return (d !== undefined && d.byModel[mk] !== undefined) ? d.byModel[mk] : 0 }),
              visible: !modelOff[mk]
            })
          }
          trendSeries.push({
            name: '__total__', shortName: '总 Token', color: '#8a94a6', isTotal: true,
            values: dayList.map((k) => { const d = aggAll.byDay.get(k); return d === undefined ? 0 : d.t }),
            visible: showTotal
          })
        }
        const anyVisible = trendSeries.some((s) => s.visible)
        children.push(el('div', { className: 'ts-card' },
          el('div', { className: 'ts-chart-title' },
            'Token 使用趋势（' + (trendRange === '24h' ? '近24小时按小时' : (trendRange === '7d' ? '近7天按天' : '近30天按天')) + ' · 悬浮查看明细）',
            el('span', { style: { display: 'inline-flex', gap: 6 } },
              el(Seg, { options: [{ v: '24h', t: '近24小时' }, { v: '7d', t: '近7天' }, { v: '30d', t: '近30天' }], current: trendRange, onPick: setTrendRange }))),
          el('div', { className: 'ts-legend', style: { marginBottom: 8, marginTop: 0 } },
            trendSeries.map((s) =>
              el('button', {
                key: s.name, className: 'ts-modelchip', 'data-off': s.visible ? '0' : '1',
                'aria-pressed': s.visible ? 'true' : 'false',
                onClick: () => { if (s.name === '__total__') setShowTotal(!showTotal); else setModelOff({ ...modelOff, [s.name]: !modelOff[s.name] }) }
              },
                el('span', { className: 'ts-dot', style: { background: s.color } }),
                el('span', { className: 'ts-mc-name' }, s.shortName))),
            el('span', { className: 'ts-hint', style: { marginLeft: 6 } }, '默认隐藏总曲线')),
          anyVisible
            ? el(TrendChart, { key: trendRange, series: trendSeries, labels: trendLabels, titles: trendTitles, emptyText: trendEmpty })
            : el('div', { className: 'ts-empty' }, '全部曲线已隐藏 —— 点击上方标签恢复')))

        // ── 热力图（1/3/6/12 月 + 当日明细悬浮）───────────────
        const HEAT_OPS = [0.16, 0.3, 0.5, 0.72, 0.95]
        children.push(el('div', { className: 'ts-card' },
          el('div', { className: 'ts-chart-title' }, 'Token 活动热力图（悬浮查看当日明细）',
            el(Seg, { options: [{ v: '1', t: '1个月' }, { v: '3', t: '3个月' }, { v: '6', t: '6个月' }, { v: '12', t: '12个月' }], current: heatSpan, onPick: setHeatSpan })),
          el(Heatmap, { key: heatSpan, byDay: aggAll.byDay, daySessions: data.daySessions || {}, models: data.models, months: Number(heatSpan) }),
          el('div', { className: 'ts-legend' },
            el('span', { className: 'ts-muted' }, '少'),
            HEAT_OPS.map((o, i) => el('span', { key: i, className: 'ts-cell', style: { background: BP, opacity: o } })),
            el('span', { className: 'ts-muted' }, '多'))))

        // ── 模型分布（悬浮构成；颜色与趋势图一致）─────────────
        const arr = Array.from(sc.byModel.values()).sort((a, b) => b.t - a.t)
        if (arr.length === 0) {
          children.push(el('div', { className: 'ts-card ts-empty' }, '该范围内暂无模型用量'))
        } else {
          const donutEntries = arr.slice(0, 7).map((m) => ({ name: m.m, t: m.t, color: modelColor(m.m) }))
          const rest = arr.slice(7)
          if (rest.length > 0) {
            donutEntries.push({ name: '其他', t: rest.reduce((s, m) => s + m.t, 0), color: '#8a94a6' })
          }
          const modelRows = arr.map((m, i) => {
            const info = (data.models && data.models[m.m]) || null
            const name = info ? info.model : m.m
            const color = modelColor(m.m)
            const pct = sc.total > 0 ? (m.t / sc.total * 100) : 0
            const hoverContent = () => breakdown(m.m + ' 用量构成', [
              ['输入', m.i, 1, m.t], ['输出', m.o, 1, m.t], ['缓存读', m.cr, 1, m.t], ['缓存写', m.cw, 1, m.t]
            ])
            return el('div', { key: m.m, className: 'ts-model',
              onMouseEnter: (e) => setStatPop({ mx: e.clientX, my: e.clientY, content: hoverContent() }),
              onMouseMove: (e) => setStatPop({ mx: e.clientX, my: e.clientY, content: hoverContent() }),
              onMouseLeave: leaveStat },
              el('span', { className: 'ts-dot', style: { background: color } }),
              el('div', { style: { minWidth: 0, flex: '1' } },
                el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 8, minWidth: 0 } },
                  el('span', { className: 'ts-modelname' }, name),
                  el('span', { className: 'ts-modelval' }, fmt(m.t) + ' · ' + pct.toFixed(1) + '%')),
                el('div', { className: 'ts-bartrack' },
                  el('span', { className: 'ts-barfill', style: { width: (m.t / arr[0].t * 100).toFixed(1) + '%', background: color, animationDelay: (i * 40 + 120) + 'ms' } })),
                el('div', { className: 'ts-muted', style: { fontSize: 11, marginTop: 2 } },
                  (info && info.provider ? info.provider + ' · ' : '') + '输入 ' + fmt(m.i) + ' · 输出 ' + fmt(m.o) + ' · 缓存 ' + fmt(m.cr + m.cw) + ' · ' + fmtFull(m.n) + ' 次')))
          })
          children.push(el('div', { className: 'ts-card' },
            el('div', { className: 'ts-chart-title' }, '模型用量分布（' + rangeText(range) + ' · 悬浮查看构成）'),
            el('div', { className: 'ts-flexrow' },
              el(Donut, { entries: donutEntries, total: sc.total }),
              el('div', { className: 'ts-models' }, modelRows))))
        }

        children.push(el('div', { className: 'ts-muted', style: { margin: '4px 2px 0' } },
          '统计口径：总 Token = 输入 + 缓存读 + 缓存写 + 输出（reasoning 已含在输出内）；同一请求的采样 usage 被终值覆盖，不重复累计；fork/resume 种子事件已去重。'))

        return el('div', { className: 'ts-page' }, children)
      }
    }

    //#region today-float ── 今日卡弹出/拖拽/收回（开关与坐标经 localStorage 持久化）──
    // 注意：侧栏与浮窗同一时刻只挂载一个 TodayCard 实例（弹出后侧栏返回 null），
    // 因此不会双倍轮询 /ext/dshp-inx-token-stats/data。
    const TS_FLOAT_LS_OPEN = 'ts-today.float.open'
    const TS_FLOAT_LS_POS = 'ts-today.float.pos'
    function tsFloatLoadOpen() {
      try { return window.localStorage.getItem(TS_FLOAT_LS_OPEN) === '1' } catch { return false }
    }
    function tsFloatLoadPos() {
      try {
        const v = JSON.parse(window.localStorage.getItem(TS_FLOAT_LS_POS) || 'null')
        if (v && isFinite(v.x) && isFinite(v.y)) return { x: Number(v.x), y: Number(v.y) }
      } catch {}
      return null
    }
    function tsFloatSave(open, pos) {
      try {
        window.localStorage.setItem(TS_FLOAT_LS_OPEN, open ? '1' : '0')
        if (pos) window.localStorage.setItem(TS_FLOAT_LS_POS, JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y) }))
      } catch {}
    }
    function tsFloatDefaultPos() {
      try {
        const vw = window.innerWidth || 1024, vh = window.innerHeight || 768
        return { x: Math.max(8, vw - 332), y: Math.max(8, Math.min(120, vh - 340)) }
      } catch { return { x: 100, y: 100 } }
    }
    function tsFloatClamp(p) {
      try {
        const vw = window.innerWidth || 1024, vh = window.innerHeight || 768
        return { x: Math.max(8, Math.min(p.x, vw - 316)), y: Math.max(8, Math.min(p.y, vh - 140)) }
      } catch { return p }
    }
    const tsFloat = { open: tsFloatLoadOpen(), pos: tsFloatLoadPos() }
    const tsFloatListeners = new Set()
    const tsFloatEmit = () => { for (const fn of tsFloatListeners) fn({ open: tsFloat.open, pos: tsFloat.pos }) }
    function tsFloatSet(open) {
      tsFloat.open = open
      if (open) tsFloat.pos = tsFloatClamp(tsFloat.pos || tsFloatLoadPos() || tsFloatDefaultPos())
      tsFloatSave(tsFloat.open, tsFloat.pos)
      tsFloatEmit()
    }
    function useTsFloat() {
      const [, force] = React.useReducer((x) => x + 1, 0)
      React.useEffect(() => {
        const fn = () => force()
        tsFloatListeners.add(fn)
        return () => { tsFloatListeners.delete(fn) }
      }, [])
      return tsFloat
    }
    // 侧栏抓手：点按=弹出浮窗；按住拖动超 8px=直接拖出为浮窗并跟随鼠标
    function tsGripDragOut(e) {
      if (e.button !== undefined && e.button !== 0) return
      if (e.preventDefault) e.preventDefault()
      if (e.stopPropagation) e.stopPropagation()
      const sx = e.clientX, sy = e.clientY
      let out = false
      function mv(ev) {
        if (!out && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return
        out = true
        tsFloat.open = true
        tsFloat.pos = tsFloatClamp({ x: ev.clientX - 60, y: ev.clientY - 20 })
        tsFloatEmit()
      }
      function up() {
        try { window.removeEventListener('pointermove', mv) } catch {}
        try { window.removeEventListener('pointerup', up) } catch {}
        if (out) tsFloatSave(true, tsFloat.pos)
        else tsFloatSet(true)
      }
      try { window.addEventListener('pointermove', mv) } catch {}
      try { window.addEventListener('pointerup', up) } catch {}
    }
    // 浮窗标题栏拖动：按住到屏幕任意位置，松手即停靠（按钮上按下不触发）
    function tsFloatDrag(e) {
      if (e.button !== undefined && e.button !== 0) return
      if (e.target && e.target.closest && e.target.closest('button')) return
      if (e.preventDefault) e.preventDefault()
      const p0 = tsFloatClamp(tsFloat.pos || tsFloatLoadPos() || tsFloatDefaultPos())
      const ox = e.clientX - p0.x, oy = e.clientY - p0.y
      function mv(ev) { tsFloat.pos = tsFloatClamp({ x: ev.clientX - ox, y: ev.clientY - oy }); tsFloatEmit() }
      function up() {
        try { window.removeEventListener('pointermove', mv) } catch {}
        try { window.removeEventListener('pointerup', up) } catch {}
        tsFloatSave(tsFloat.open, tsFloat.pos)
      }
      try { window.addEventListener('pointermove', mv) } catch {}
      try { window.addEventListener('pointerup', up) } catch {}
    }
    //#endregion
    /** 侧栏今日用量小卡片（开关开启时渲染）。 */
    function createTodayCard(bridge) {
      return function TodaySidebarCard(props) {
        const wide = !(props && props.wide === false)
        const [data, setData] = React.useState(null)
        const [tip, setTip] = React.useState(null)
        const refresh = React.useCallback(() => {
          bridge.getData().then((v) => {
            if (v && v.ready === true) setData(v)
          }).catch(() => {})
        }, [])
        React.useEffect(() => {
          refresh()
          const id = window.setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 60000)
          return () => { window.clearInterval(id) }
        }, [refresh])

        const isFloat = !!(props && props.float === true)
        const floatPos = (props && props.floatPos) || null
        const floatXY = isFloat ? tsFloatClamp(floatPos || tsFloatLoadPos() || tsFloatDefaultPos()) : null

        if (data === null) {
          if (isFloat) {
            return el('div', { className: 'ts-float', style: { left: floatXY.x + 'px', top: floatXY.y + 'px' } },
              el('div', { className: 'ts-todayhead ts-floathead', title: '按住拖到任意位置 · 双击收回侧边栏', onPointerDown: tsFloatDrag, onDoubleClick: () => tsFloatSet(false) },
                el('span', { className: 'ts-todaylabel' }, '今日用量'),
                el('span', { className: 'ts-todayval', style: { opacity: .5 } }, '…'),
                el('button', { className: 'ts-minibtn', title: '收回侧边栏', onClick: (e) => { if (e.stopPropagation) e.stopPropagation(); tsFloatSet(false) } }, '📌')))
          }
          return el('div', { className: 'ts-today' + (wide ? '' : ' ts-todayRail') },
            el('div', { className: 'ts-todaylabel' }, '今日用量'),
            el('div', { className: 'ts-todayval', style: { opacity: .5 } }, '…'))
        }

        buildModelColors(data.models)
        const todayK = keyOf(Date.now())
        const yK = keyOf(fromKey(todayK) - 86400000)
        // 单日精确聚合：aggregate 的第二参是起始日过滤（r.d < cutoff 跳过），
        // 直接传昨日会把 昨日+今日 全算进去 → delta 恒为负。改为先算范围聚合再按天取。
        const both = aggregate(data.records, yK)
        const dayTotal = (k) => { const d = both.byDay.get(k); return d === undefined ? 0 : d.t }
        const todayTotal = dayTotal(todayK)
        const yTotal = dayTotal(yK)
        const delta = yTotal > 0 ? (todayTotal - yTotal) / yTotal * 100 : null

        // 完全折叠（rail 模式）：今日总量可读数字 + 今日/昨日双条对比
        if (!wide) {
          // rail（折叠侧栏）：footerActions 已垂直化，徽章在上、本卡在下（流内、无溢出）；
          // 悬浮用绘制版明细（禁用原生 title，避免与绘制悬浮叠加出现双悬浮）
          const showTip = (e) => setTip({ mx: e.clientX, my: e.clientY })
          const hideTip = () => setTip(null)
          const dTxt = delta === null ? (todayTotal > 0 ? '昨日无消耗' : '—') : ((delta >= 0 ? '+' : '') + delta.toFixed(0) + '% vs 昨日')
          return el('div', { className: 'ts-today ts-todayRail',
            onMouseEnter: showTip, onMouseMove: showTip, onMouseLeave: hideTip },
            el('div', { className: 'ts-todaylabel' }, '今日'),
            el(AnimatedNumber, { className: 'ts-todayval', value: todayTotal, format: fmtRail }),
            el(DualBars, { className: 'ts-dualbars', a: todayTotal, b: yTotal }),
            tip === null ? null : (() => {
              const pos = tipPos(tip.mx, tip.my, 190, 82)
              return el('div', { className: 'ts-tipfixed', style: pos },
                el('div', { className: 'ts-tiprow', style: { fontWeight: 600, marginBottom: 2 } }, '今日用量'),
                el('div', { className: 'ts-tiprow' },
                  el('span', { className: 'ts-tip-k' }, '今日'),
                  el('span', { className: 'ts-tip-v' }, fmt(todayTotal))),
                el('div', { className: 'ts-tiprow' },
                  el('span', { className: 'ts-tip-k' }, '昨日'),
                  el('span', { className: 'ts-tip-v' }, fmt(yTotal))),
                el('div', { className: 'ts-tiprow' },
                  el('span', { className: 'ts-tip-k' }, '对比'),
                  el('span', { className: 'ts-tip-v' }, dTxt)))
            })())
        }

        // 各模型今日逐小时序列（0..当前小时），配色与统计页一致
        const todayRecords = data.records.filter((r) => r.d === todayK)
        const nowHour = new Date().getHours()
        const modelHourSeries = []
        // 今日模型列表从今日记录取（both.byModel 含昨日，会把昨天的模型也画进来）
        const todayModels = new Set(todayRecords.map((r) => r.m))
        for (const mk of Array.from(todayModels).sort()) {
          const vals = []
          for (let h = 0; h <= nowHour; h++) {
            let s = 0
            for (const r of todayRecords) { if (r.h === h && r.m === mk) s += tok(r) }
            vals.push(s)
          }
          modelHourSeries.push({ name: mk, shortName: (data.models[mk] || {}).model || mk, color: modelColor(mk), values: vals })
        }

        return el('div', isFloat
          ? { className: 'ts-float', style: { left: floatXY.x + 'px', top: floatXY.y + 'px' } }
          : { className: 'ts-today' },
          el('div', isFloat
            ? { className: 'ts-todayhead ts-floathead', title: '按住拖到任意位置 · 双击收回侧边栏', onPointerDown: tsFloatDrag, onDoubleClick: () => tsFloatSet(false) }
            : { className: 'ts-todayhead' },
            isFloat ? null : el('span', { className: 'ts-grip', title: '按住拖出为浮窗，点按直接弹出', onPointerDown: tsGripDragOut }, '⠿'),
            el('span', { className: 'ts-todaylabel' }, '今日 Token'),
            el(AnimatedNumber, { className: 'ts-todayval', value: todayTotal, format: fmt }),
            el('button', {
              className: 'ts-minibtn',
              title: isFloat ? '收回侧边栏' : '弹出为浮窗（可拖到屏幕任意位置）',
              onClick: (e) => { if (e.stopPropagation) e.stopPropagation(); tsFloatSet(!isFloat) }
            }, isFloat ? '📌' : '⧉')),
          el(TodayChart, { series: modelHourSeries, n: nowHour + 1, floatTip: isFloat }),
          modelHourSeries.length > 0
            ? el('div', { className: 'ts-todaymodels' },
                modelHourSeries.map((s, si) =>
                  el('span', { key: s.name, className: 'ts-todaymchip ts-fadein', style: { animationDelay: (si * 60) + 'ms' } },
                    el('span', { className: 'ts-dot', style: { background: s.color } }),
                    el('span', null, s.shortName))))
            : null,
          delta !== null
            ? el('div', { className: 'ts-statgrow ts-fadein', style: { marginTop: 4, color: delta >= 0 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)', fontSize: 10.5 } },
                el('span', { className: 'ts-arrow ' + (delta >= 0 ? 'ts-arrow-up' : 'ts-arrow-down') }),
                el('span', null, (delta >= 0 ? '+' : '') + delta.toFixed(0) + '% vs 昨日'))
            : el('div', { className: 'ts-muted', style: { fontSize: 10, marginTop: 4 } }, todayTotal > 0 ? '昨日无消耗' : '开始使用后统计'))
      }
    }

    exports.inject = ['slots']
    exports.apply = function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return

      const bridge = {
        getData: async () => {
          const response = await fetch('/ext/dshp-inx-token-stats/data', { cache: 'no-store' })
          return response.json()
        },
        getPrefs: async () => {
          try {
            const response = await fetch('/ext/dshp-inx-token-stats/state', { cache: 'no-store' })
            const value = await response.json()
            return (value && value.ok && value.config) || null
          } catch { return null }
        },
        savePrefs: async (patchValue) => {
          const response = await fetch('/ext/dshp-inx-token-stats/config', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(patchValue || {}),
            cache: 'no-store'
          })
          return response.json()
        }
      }

      const sectionStyle = document.createElement('style')
      sectionStyle.setAttribute('data-plugin-css', 'dshp-inx-token-stats/settings.css')
      sectionStyle.textContent = CSS
      document.head.appendChild(sectionStyle)
      ctx.effect(() => () => sectionStyle.remove(), 'dshp-inx-token-stats: section styles')

      // 旧 localStorage 开关一次性上收至标准 settings（仅当用户曾显式打开过；
      // storages 文件迁移由部署者手动完成，插件代码不做）。
      try {
        if (window.localStorage.getItem('token-stats.sidebar-today') === '1') {
          window.localStorage.removeItem('token-stats.sidebar-today')
          bridge.savePrefs({ showToday: true }).catch(() => {})
        }
      } catch {}

      // 开关 → 侧栏卡片 跨组件同步（自定义事件；真值在标准 settings 里）
      const todayPrefListeners = new Set()
      window.addEventListener('dshp-inx-token-stats:today-toggle', (ev) => {
        for (const fn of todayPrefListeners) fn(!!(ev.detail && ev.detail.on))
      })

      const Section = createSection(bridge, {
        getPrefs: bridge.getPrefs,
        setToday: (on) => {
          bridge.savePrefs({ showToday: on === true }).catch(() => {})
          window.dispatchEvent(new CustomEvent('dshp-inx-token-stats:today-toggle', { detail: { on } }))
        }
      })
      slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'dshp-inx-token-stats', order: 27, label: 'Token 用量统计' },
        Section
      ))

      const TodayCard = createTodayCard(bridge)
      function useTodayPref() {
        const [on, setOn] = React.useState(null)
        React.useEffect(() => {
          let alive = true
          bridge.getPrefs().then((p) => { if (alive && p) setOn(p.showToday === true) }).catch(() => {})
          const fn = (v) => setOn(v)
          todayPrefListeners.add(fn)
          return () => { todayPrefListeners.delete(fn); alive = false }
        }, [])
        return on
      }
      function TodaySidebarEntry(props) {
        const on = useTodayPref()
        const fl = useTsFloat()
        // 已弹出为浮窗时侧边栏完全不占位（收回入口：浮窗📌 / 设置页浮窗行）
        if (fl.open) return null
        return on === true ? el(TodayCard, props) : null
      }
      function TodayFloatEntry() {
        const on = useTodayPref()
        const fl = useTsFloat()
        if (on !== true || !fl.open) return null
        const pos = tsFloatClamp(fl.pos || tsFloatLoadPos() || tsFloatDefaultPos())
        return el(TodayCard, { wide: true, float: true, floatPos: pos })
      }
      slots.inject('sidebar.footer.action', () => slots.register(
        { name: 'sidebar.footer.action', id: 'dshp-inx-token-stats-today' },
        TodaySidebarEntry
      ))
      slots.inject('shell.overlay', () => slots.register(
        { name: 'shell.overlay', id: 'dshp-inx-token-stats-float' },
        TodayFloatEntry
      ))
    }

    //#endregion

    return module.exports
  }
})
