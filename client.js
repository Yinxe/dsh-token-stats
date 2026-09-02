/* @dshp-inx/token-stats client half — hand-authored __ModuleLoader__ bundle.
 * 设置页：Token 用量统计 —— 单页展示（指标卡/趋势/时段/热力图/模型分布）。
 * 数据源：GET /ext/token-stats/data（Host 半聚合本机全部会话日志）。
 * 时效性：挂载即拉取 + 60s 自动刷新（页面可见时）+ 切回页面即刷 + 手动刷新。
 * 交互：指标卡悬浮明细；趋势图平滑曲线 + 模型筛选 + 十字悬浮；热力图自适应
 * 宽度 + 当日明细悬浮（日期/总量/会话数/各模型占比）；模型行悬浮构成。 */
window.__ModuleLoader__.load({
  id: '@dshp-inx/token-stats',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    /* 全部颜色走 DSH 主题 token（跟随主题切换，与产品 UI 一致）。 */
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
.ts-pop-bar{height:4px;border-radius:2px;background:var(--dsw-alias-interactive-bg-hover);flex:1;min-width:50px;overflow:hidden}
.ts-pop-fill{height:100%;border-radius:2px;display:block}
.ts-muted{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.ts-compose{display:flex;height:8px;border-radius:4px;overflow:hidden;margin-top:6px;background:var(--dsw-alias-interactive-bg-hover)}
.ts-compose span{display:block;height:100%}
.ts-compose-legend{display:flex;gap:8px;margin-top:5px;font-size:10px;color:var(--dsw-alias-label-caption);flex-wrap:wrap;line-height:14px}
.ts-compose-legend i{display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:3px;vertical-align:-1px}
.ts-spark{display:block;width:100%;height:34px;margin-top:6px}
.ts-statgrow{margin-top:6px;font-size:11px;line-height:14px;display:flex;align-items:center;gap:4px}
.ts-arrow{display:inline-block;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;vertical-align:middle}
.ts-arrow-up{border-bottom:5px solid var(--dsw-alias-state-success-primary)}
.ts-arrow-down{border-top:5px solid var(--dsw-alias-state-error-primary)}
.ts-arrow-flat{border-bottom:5px solid var(--dsw-alias-label-tertiary)}
.ts-streakbar{height:8px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover);margin-top:7px;overflow:hidden}
.ts-streakfill{height:100%;border-radius:4px;display:block}
.ts-dayscroll{display:flex;gap:1.5px;margin-top:7px;height:12px}
.ts-dayscroll span{flex:1 1 0;min-width:0;border-radius:1.5px;display:block}
.ts-today{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:10px 12px;margin:8px 0;width:100%;flex:none;cursor:default;box-sizing:border-box;overflow:hidden}
.ts-today:hover{border-color:var(--dsw-alias-state-business-primary)}
.ts-todaylabel{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}
.ts-todayval{color:var(--dsw-alias-label-primary);font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;line-height:24px}
.ts-todayhead{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.ts-todayhead .ts-todayval{font-size:15px;flex:none}
.ts-todaymodels{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}
.ts-todaymchip{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--dsw-alias-label-secondary);max-width:45%;line-height:14px}
.ts-todaymchip .ts-dot{width:7px;height:7px;margin-top:0}
.ts-todaymchip span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ts-todayRail{padding:6px 4px;width:100%}
.ts-todayRail .ts-todayval{font-size:11px;line-height:14px}
.ts-todayRail .ts-todaymodels,.ts-todayRail .ts-spark,.ts-todayRail .ts-statgrow{display:none}
.ts-todayRail .ts-todayhead{display:block}
.ts-swrow{display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 14px;margin:0 0 12px}
.ts-swlabel{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}
.ts-swhint{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.ts-switch{position:relative;width:38px;height:22px;border-radius:11px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;padding:0;flex:none;transition:background .18s}
.ts-switch[aria-checked="true"]{background:var(--dsw-alias-state-business-primary);border-color:transparent}
.ts-switch .ts-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground);transition:left .18s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.ts-switch[aria-checked="true"] .ts-knob{left:19px}
.ts-chart-title{font-weight:600;font-size:12.5px;color:var(--dsw-alias-label-secondary);margin:0 0 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.ts-seg{display:inline-flex;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:2px;flex-wrap:wrap}
.ts-seg-btn{border:none;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:12px;font-family:inherit;padding:2px 8px;border-radius:6px;cursor:pointer;line-height:18px}
.ts-seg-btn:hover{color:var(--dsw-alias-label-primary)}
.ts-seg-on{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.ts-legend{display:flex;align-items:center;gap:4px;margin-top:8px;flex-wrap:wrap}
.ts-modelchip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 9px;font-size:11.5px;cursor:pointer;color:var(--dsw-alias-label-secondary);background:transparent;font-family:inherit;line-height:18px;max-width:180px}
.ts-modelchip:hover{border-color:var(--dsw-alias-state-business-primary)}
.ts-modelchip[data-off="1"]{opacity:.38}
.ts-modelchip .ts-dot{width:8px;height:8px;border-radius:3px;flex:none}
.ts-modelchip .ts-mc-name{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ts-heatwrap{position:relative}
.ts-heatrow{display:flex;gap:2.5px;flex:1 1 auto;min-width:0}
.ts-hcell{border-radius:2.5px;flex:1 1 0;min-width:0;aspect-ratio:1;cursor:default}
.ts-hcell[data-lv="0"]{background:var(--dsw-alias-interactive-bg-hover);opacity:.45}
.ts-cell{width:9px;height:9px;border-radius:2.5px;display:inline-block;margin:0 2px;flex:none}
.ts-models{display:flex;flex-direction:column;flex:1;min-width:300px}
.ts-model{display:flex;align-items:flex-start;gap:10px;padding:8px 4px;border-bottom:1px solid var(--dsw-alias-border-l1);cursor:default;border-radius:6px}
.ts-model:hover{background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 4%, transparent)}
.ts-model:last-child{border-bottom:none}
.ts-dot{width:10px;height:10px;border-radius:3px;flex:none;margin-top:5px}
.ts-bartrack{height:6px;border-radius:3px;background:var(--dsw-alias-interactive-bg-hover);flex:1;overflow:hidden;min-width:60px}
.ts-barfill{height:100%;border-radius:3px;transition:width .3s ease}
.ts-modelname{color:var(--dsw-alias-label-primary);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ts-modelval{color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums;flex:none}
.ts-flexrow{display:flex;gap:20px;align-items:center;justify-content:center;flex-wrap:wrap}
.ts-empty{color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center;padding:28px 0}
.ts-svgwrap{position:relative}
.ts-tip{position:absolute;transform:translate(-50%,0);top:2px;background:var(--dsw-specific-menu);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;box-shadow:var(--dsw-shadow-lv3);padding:6px 10px;font-size:11.5px;line-height:1.5;pointer-events:none;color:var(--dsw-alias-label-primary);z-index:5;white-space:nowrap}
.ts-tipfixed{position:fixed;background:var(--dsw-specific-menu);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;box-shadow:var(--dsw-shadow-lv3);padding:7px 10px;font-size:11.5px;line-height:1.5;pointer-events:none;color:var(--dsw-alias-label-primary);z-index:60;max-width:280px}
.ts-tip-k{color:var(--dsw-alias-label-secondary);margin-right:8px}
.ts-tip-v{font-variant-numeric:tabular-nums;font-weight:500}
.ts-tiprow{display:flex;align-items:center;gap:6px;white-space:nowrap}
.ts-axislbl{fill:var(--dsw-alias-label-caption);font-size:10.5px}
.ts-gridln{stroke:var(--dsw-alias-border-l1);stroke-width:1}
`

    const BP = 'var(--dsw-alias-state-business-primary)'
    const PALETTE = ['#4c7ef3', '#2fb261', '#f5a623', '#e05e4e', '#9a6ef1', '#25b8c4', '#d557a8', '#8a94a6', '#6b7280', '#34d399', '#f472b6', '#a3e635']

    // ── 纯工具 ────────────────────────────────────────────────────────
    const keyOf = (t) => { const d = new Date(t); const M = String(d.getMonth() + 1); const D = String(d.getDate()); return d.getFullYear() + '-' + (M.length < 2 ? '0' + M : M) + '-' + (D.length < 2 ? '0' + D : D) }
    const fromKey = (k) => { const p = k.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12).getTime() }
    const tr = (x) => { let s = x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s }
    /** 可读大数字：千分位；≥万 用紧凑单位（1位小数），≥亿 同理。 */
    const fmt = (n) => {
      n = Math.round(n || 0)
      if (n >= 1e8) return tr(n / 1e8) + '亿'
      if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万'
      return n.toLocaleString('en-US')
    }
    const fmtFull = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const dispDay = (k) => k ? k.slice(5).replace('-', '/') : ''
    const cnDate = (k) => { const p = k.split('-'); return Number(p[0]) + '年' + Number(p[1]) + '月' + Number(p[2]) + '日' }
    const hhmm = (t) => { const d = new Date(t); const H = String(d.getHours()); const Mi = String(d.getMinutes()); return (H.length < 2 ? '0' + H : H) + ':' + (Mi.length < 2 ? '0' + Mi : Mi) }
    const niceMax = (m) => { if (m <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log(m) / Math.LN10)); const c = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]; for (let i = 0; i < c.length; i++) { if (c[i] * p >= m) return c[i] * p } return 10 * p }
    const median = (arr) => { if (arr.length === 0) return 0; const s = [...arr].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2 }

    /** 记录聚合（客户端可按范围二次聚合；byDay 含 byModel 明细供热力图/悬浮）。 */
    function aggregate(records, cutoff) {
      const byDay = new Map(); const byModel = new Map(); const byHour = []
      for (let i = 0; i < 24; i++) byHour.push(0)
      let si = 0, so = 0, scr = 0, scw = 0, sn = 0, first = null, last = null
      for (let idx = 0; idx < records.length; idx++) {
        const r = records[idx]
        if (cutoff !== null && r.d < cutoff) continue
        const ri = r.i || 0, ro = r.o || 0, rcr = r.cr || 0, rcw = r.cw || 0, rn = r.n || 0
        const t = ri + ro + rcr + rcw
        si += ri; so += ro; scr += rcr; scw += rcw; sn += rn
        byHour[r.h] += t
        let day = byDay.get(r.d)
        if (day === undefined) { day = { d: r.d, i: 0, o: 0, cr: 0, cw: 0, n: 0, t: 0, byModel: {} }; byDay.set(r.d, day) }
        day.i += ri; day.o += ro; day.cr += rcr; day.cw += rcw; day.n += rn; day.t += t
        day.byModel[r.m] = (day.byModel[r.m] || 0) + t
        let mo = byModel.get(r.m)
        if (mo === undefined) { mo = { m: r.m, i: 0, o: 0, cr: 0, cw: 0, n: 0, t: 0 }; byModel.set(r.m, mo) }
        mo.i += ri; mo.o += ro; mo.cr += rcr; mo.cw += rcw; mo.n += rn; mo.t += t
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
      for (let ki = 0; ki < keys.length; ki++) {
        const k = keys[ki]
        if (prev !== null && keyOf(fromKey(prev) + 86400000) === k) run++
        else run = 1
        if (run > longest) longest = run
        prev = k
      }
      return { current: cur, longest }
    }

    const el = React.createElement

    /** fixed 定位 tooltip 坐标：跟随鼠标 + 视口边缘翻转（不受祖先 overflow 裁剪）。 */
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

    // ── 模型 → 稳定颜色（全部模型排序后取调色板，多处渲染一致）────
    let MODEL_COLORS = new Map()
    function buildModelColors(models) {
      const keys = Object.keys(models).sort()
      const map = new Map()
      keys.forEach((k, i) => map.set(k, PALETTE[i % PALETTE.length]))
      MODEL_COLORS = map
    }
    const modelColor = (mk) => MODEL_COLORS.get(mk) || '#8a94a6'

    // ── 指标卡 ──────────────────────────────────────────────────────
    function StatCard(props) {
      return el('div', {
        className: 'ts-stat',
        onMouseEnter: props.onHover || undefined,
        onMouseMove: props.onHover || undefined,
        onMouseLeave: props.onLeave || undefined
      },
        el('div', { className: 'ts-stat-label' }, props.label),
        el('div', { className: 'ts-stat-value' }, props.value),
        props.sub ? el('div', { className: 'ts-stat-sub' }, props.sub) : null,
        ...(props.visual || []))
    }

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
    /** Sparkline 迷你面积图：values=[v..]，画在卡片内（无轴，纯走势）。 */
    function Sparkline(props) {
      const vals = props.values || []
      const W = 150, H = 34, PAD = 2
      if (vals.length < 2) return null
      const min = Math.min(...vals), max = Math.max(...vals)
      const span = max - min || 1
      const xs = (i) => PAD + (W - PAD * 2) * i / (vals.length - 1)
      const ys = (v) => H - PAD - ((v - min) / span) * (H - PAD * 2)
      const pts = vals.map((v, i) => [xs(i), ys(v)])
      const line = smoothPath(pts)
      const area = line + ' L ' + xs(vals.length - 1).toFixed(1) + ' ' + (H - PAD) + ' L ' + xs(0).toFixed(1) + ' ' + (H - PAD) + ' Z'
      return el('svg', { className: 'ts-spark', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' },
        el('path', { d: area, style: { fill: props.color || BP, fillOpacity: 0.13 } }),
        el('path', { d: line, fill: 'none', style: { stroke: props.color || BP, strokeWidth: 1.5, strokeLinecap: 'round' } }),
        el('circle', { cx: xs(vals.length - 1), cy: ys(vals[vals.length - 1]), r: 1.8, style: { fill: props.color || BP } }))
    }

    /** 堆叠构成条：parts=[[标签, 量, 颜色]..]；悬浮卡里已有明细，条本身自带 title。 */
    function ComposeBar(props) {
      const parts = props.parts || []
      const total = parts.reduce((s, p) => s + p[1], 0)
      if (total <= 0) return null
      const segs = []
      let acc = 0
      for (const p of parts) {
        const w = p[1] / total * 100
        if (w <= 0) continue
        segs.push(el('span', { key: p[0], style: { width: w.toFixed(2) + '%', background: p[2], opacity: p[4] === false ? 0 : 1 }, title: p[0] + ' ' + fmtFull(p[1]) + ' · ' + w.toFixed(1) + '%' }))
        acc += w
      }
      return el('div', null,
        el('div', { className: 'ts-compose' }, segs),
        el('div', { className: 'ts-compose-legend' },
          parts.map((p) => el('span', { key: p[0], title: fmtFull(p[1]) },
            el('i', { style: { background: p[2] } }), p[0]))))
    }

    /** 涨跌指示：对比近段（默认近7天 vs 之前7天）。返回带箭头的一行。 */
    function TrendDelta(props) {
      const recent = props.recent, before = props.before
      if (before === 0 && recent === 0) return null
      const delta = before === 0 ? null : (recent - before) / before * 100
      let arrow = 'flat', color = 'var(--dsw-alias-label-tertiary)', text = '持平'
      if (delta === null) { arrow = 'up'; text = '新增' }
      else if (delta > 2) { arrow = 'up'; color = 'var(--dsw-alias-state-success-primary)'; text = '+' + delta.toFixed(0) + '%' }
      else if (delta < -2) { arrow = 'down'; color = 'var(--dsw-alias-state-error-primary)'; text = delta.toFixed(0) + '%' }
      return el('div', { className: 'ts-statgrow', style: { color } },
        el('span', { className: 'ts-arrow ts-arrow-' + arrow }),
        el('span', null, text + '（对比前 7 天）'))
    }

    /** 连击进度条：当前连击相对历史最长。 */
    function StreakBar(props) {
      const cur = props.current, best = props.best
      const pct = best > 0 ? Math.min(100, cur / best * 100) : 0
      return el('div', { className: 'ts-streakbar' },
        el('span', { className: 'ts-streakfill', style: { width: pct.toFixed(1) + '%', background: 'linear-gradient(90deg, var(--dsw-alias-state-business-primary), color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, transparent))' } }))
    }

    /** 活跃日微条：全量首日→今天按月分桶的活跃比例。 */
    function DaysRibbon(props) {
      const byDay = props.byDay
      if (byDay === undefined || byDay.size === 0) return null
      const keys = Array.from(byDay.keys()).sort()
      const firstT = fromKey(keys[0]), lastT = fromKey(keys[keys.length - 1])
      const monthCount = Math.max(1, Math.round((lastT - firstT) / (30.44 * 86400000)) + 1)
      const NB = Math.min(monthCount, 24)
      const buckets = []
      for (let i = 0; i < NB; i++) buckets.push({ active: 0, total: 0 })
      for (let m = firstT; m <= lastT; m += 86400000) {
        const rel = (m - firstT) / (lastT - firstT || 1)
        const b = Math.min(NB - 1, Math.floor(rel * NB))
        const k = keyOf(m)
        buckets[b].total++
        if (byDay.has(k)) buckets[b].active++
      }
      return el('div', { className: 'ts-dayscroll', title: '活跃日分布（按月分桶）' },
        buckets.map((b, i) => {
          const ratio = b.total > 0 ? b.active / b.total : 0
          return el('span', { key: i, style: { background: BP, opacity: ratio === 0 ? 0.08 : (0.15 + ratio * 0.8) } })
        }))
    }

    function Seg(props) {
      return el('div', { className: 'ts-seg' }, props.options.map((o) =>
        el('button', {
          key: o.v, className: 'ts-seg-btn' + (props.current === o.v ? ' ts-seg-on' : ''),
          onClick: () => props.onPick(o.v)
        }, o.t)))
    }

    /** 构成明细悬浮内容：[[标签, 量, 1, 总量]..]。 */
    function breakdown(title, parts) {
      return el('div', null,
        el('div', { className: 'ts-pop-title' }, title),
        parts.map((p) => el('div', { key: p[0], className: 'ts-pop-row' },
          el('span', { className: 'ts-pop-k' }, p[0]),
          el('span', { className: 'ts-pop-v' }, fmtFull(p[1]) + ' · ' + (p[3] > 0 ? (p[1] / p[3] * 100).toFixed(1) : '0.0') + '%'))))
    }

    // ── 平滑曲线多系列趋势图（Catmull-Rom → 三次 Bezier）────────────

    /** 多系列平滑趋势图：十字竖线 + 悬浮明细 + 各系列点位标记。 */
    function TrendChart(props) {
      const seriesList = props.series
      const labels = props.labels
      const W = 780, H = 250, pl = 54, pr = 14, pt = 14, pb = 28
      const n = labels.length
      const vis = seriesList.filter((s) => s.visible)
      const maxVal = vis.length > 0 ? Math.max(1, ...vis.flatMap((s) => s.values)) : 1
      const top = niceMax(maxVal)
      const xs = (i) => n <= 1 ? pl + (W - pl - pr) / 2 : pl + (W - pl - pr) * i / (n - 1)
      const ys = (v) => (H - pb) - (v / top) * (H - pb - pt)

      const [hover, setHover] = React.useState(null)
      const svgRef = React.useRef(null)
      const onMove = (e) => {
        const node = svgRef.current
        if (node === null) return
        const rect = node.getBoundingClientRect()
        const relX = (e.clientX - rect.left) / rect.width * W
        let i = n <= 1 ? 0 : Math.round((relX - pl) / (W - pl - pr) * (n - 1))
        if (i < 0) i = 0
        if (i > n - 1) i = n - 1
        setHover({ i, x: xs(i), mx: e.clientX, my: e.clientY })
      }

      const kids = []
      const fr = [0, 0.25, 0.5, 0.75, 1]
      for (let fi = 0; fi < fr.length; fi++) {
        const yy = ys(top * fr[fi])
        kids.push(el('line', { key: 'g' + fi, x1: pl, x2: W - pr, y1: yy, y2: yy, className: 'ts-gridln' }))
        kids.push(el('text', { key: 'gt' + fi, x: pl - 8, y: yy + 4, textAnchor: 'end', className: 'ts-axislbl' }, fmt(top * fr[fi])))
      }
      const stepI = Math.max(1, Math.ceil((n - 1) / 8))
      const xt = []
      for (let i = 0; i < n; i += stepI) xt.push(i)
      if (n > 0 && (xt.length === 0 || xt[xt.length - 1] !== n - 1)) xt.push(n - 1)
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
      for (const s of seriesList) {
        if (!s.visible) continue
        const pts = s.values.map((v, i) => [xs(i), ys(v)])
        kids.push(el('path', {
          key: 'ln' + s.name, d: smoothPath(pts), fill: 'none',
          style: { stroke: s.color, strokeWidth: s.isTotal ? 2.6 : 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: s.isTotal ? 1 : .92 }
        }))
      }
      kids.push(el('rect', { key: 'cap', x: 0, y: 0, width: W, height: H, fill: 'transparent', style: { cursor: 'crosshair' }, onMouseMove: onMove, onMouseLeave: () => setHover(null) }))

      const tip = hover !== null
        ? (() => {
            // 当日无消耗的模型不进悬浮（与热力图悬浮一致的过滤体验）
            const activeVis = vis.filter((s) => (s.values[hover.i] || 0) > 0)
            const rows = activeVis.slice().sort((a, b) => (b.values[hover.i] || 0) - (a.values[hover.i] || 0))
            // fixed 定位 + 鼠标坐标：不受祖先 overflow 裁剪，边缘自动翻转
            const pos = tipPos(hover.mx, hover.my, 270, 40 + rows.length * 18)
            return el('div', { className: 'ts-tipfixed', style: pos },
              el('div', { className: 'ts-tiprow', style: { fontWeight: 600, marginBottom: 2 } }, labels[hover.i]),
              rows.length > 0
                ? rows.map((s) =>
                    el('div', { key: s.name, className: 'ts-tiprow' },
                      el('span', { className: 'ts-dot', style: { background: s.color, width: 8, height: 8, marginTop: 4 } }),
                      el('span', { className: 'ts-tip-k', style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.shortName),
                      el('span', { className: 'ts-tip-v' }, fmt(s.values[hover.i] || 0))))
                : el('div', { className: 'ts-tiprow', style: { color: 'var(--dsw-alias-label-tertiary)' } }, '当日无消耗'))
          })()
        : null

      return el('div', { className: 'ts-svgwrap' },
        el('svg', { viewBox: '0 0 ' + W + ' ' + H, style: { width: '100%', height: 'auto', display: 'block' }, ref: svgRef }, kids),
        tip)
    }

    // ── 时段直方图 ──────────────────────────────────────────────────
    function HourHist(props) {
      const byHour = props.byHour
      const W = 640, H = 160, pl = 42, pr = 12, pt = 14, pb = 22
      const top = niceMax(Math.max.apply(null, byHour.concat([1])))
      const totalSum = byHour.reduce((s, v) => s + v, 0) || 1
      const bw = (W - pl - pr) / 24
      const ys = (v) => (H - pb) - (v / top) * (H - pb - pt)
      const [hover, setHover] = React.useState(null)
      const kids = []
      const fr = [0, 0.5, 1]
      for (let fi = 0; fi < fr.length; fi++) {
        const yy = ys(top * fr[fi])
        kids.push(el('line', { key: 'g' + fi, x1: pl, x2: W - pr, y1: yy, y2: yy, className: 'ts-gridln' }))
        kids.push(el('text', { key: 'gt' + fi, x: pl - 8, y: yy + 4, textAnchor: 'end', className: 'ts-axislbl' }, fmt(top * fr[fi])))
      }
      for (let hIdx = 0; hIdx < 24; hIdx++) {
        const v = byHour[hIdx]
        const hgt = (v / top) * (H - pb - pt)
        kids.push(el('rect', {
          key: 'b' + hIdx, x: pl + hIdx * bw + bw * 0.15, y: (H - pb) - hgt, width: bw * 0.7,
          height: Math.max(hgt, v > 0 ? 2 : 0), rx: 2,
          style: { fill: BP, fillOpacity: hover !== null && hover.h === hIdx ? 1 : 0.72 },
          onMouseEnter: (e) => setHover({ h: hIdx, mx: e.clientX, my: e.clientY }),
          onMouseMove: (e) => setHover({ h: hIdx, mx: e.clientX, my: e.clientY }),
          onMouseLeave: () => setHover(null)
        }))
        if (hIdx % 3 === 0) kids.push(el('text', { key: 't' + hIdx, x: pl + hIdx * bw + bw / 2, y: H - 7, textAnchor: 'middle', className: 'ts-axislbl' }, String(hIdx)))
      }
      // 悬浮：迷你柱对比 + 占比条（fixed 定位跟随鼠标，不裁剪）
      const tip = hover !== null
        ? (() => {
            const hIdx = hover.h
            const v = byHour[hIdx]
            const pct = v / totalSum * 100
            const maxHour = Math.max(...byHour)
            const relMax = maxHour > 0 ? v / maxHour * 100 : 0   // 相对全天峰值
            const pos = tipPos(hover.mx, hover.my, 200, 86)
            return el('div', { className: 'ts-tipfixed', style: pos },
              el('div', { className: 'ts-tiprow', style: { fontWeight: 600 } },
                el('span', { className: 'ts-tip-k' }, hIdx + ':00–' + (hIdx + 1) + ':00'),
                el('span', { className: 'ts-tip-v' }, v > 0 ? fmtFull(v) : '无用量')),
              // 迷你柱：该小时 vs 全天峰值（同色系即时高度对比）
              el('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 5, marginTop: 4, height: 26 } },
                el('span', { title: '本小时', style: { width: 14, borderRadius: '2px 2px 0 0', background: BP, display: 'block', height: Math.max(2, relMax * 0.22).toFixed(1) + 'px' } }),
                el('span', { title: '全天峰值', style: { width: 14, borderRadius: '2px 2px 0 0', background: BP, opacity: .25, display: 'block', height: 22 } })),
              // 占比条 + 百分比
              el('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 } },
                el('span', { className: 'ts-pop-bar', style: { height: 5, width: 84 } },
                  el('span', { className: 'ts-pop-fill', style: { width: pct.toFixed(1) + '%', background: BP } })),
                el('span', { className: 'ts-tip-k', style: { fontSize: 10.5 } }, '占全天 ' + pct.toFixed(1) + '%')))
          })()
        : null
      return el('div', { className: 'ts-svgwrap' },
        el('svg', { viewBox: '0 0 ' + W + ' ' + H, style: { width: '100%', height: 'auto', display: 'block' } }, kids),
        tip)
    }

    // ── 热力图（flex 自适应占满宽度 + 当日明细悬浮）──────────────────
    function Heatmap(props) {
      const byDay = props.byDay
      const daySessions = props.daySessions || {}
      const months = props.months || 6
      const today = keyOf(Date.now())
      const todayT = fromKey(today)
      const spanMs = Math.max(1, months) * 31 * 86400000
      let startW = todayT - spanMs
      const dow0 = new Date(startW).getDay()
      startW = startW - ((dow0 + 6) % 7) * 86400000
      const weeks = Math.max(1, Math.ceil((todayT - startW) / 604800000))
      const cols = []
      let max = 1
      for (let w = 0; w < weeks; w++) {
        const col = []
        for (let r = 0; r < 7; r++) {
          const t = startW + w * 604800000 + r * 86400000
          const k = keyOf(t)
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

      const [hover, setHover] = React.useState(null)
      const onCell = (cell, e) => {
        if (cell === null || cell.day === undefined) { setHover(null); return }
        setHover({ k: cell.k, day: cell.day, sess: cell.sess, x: e.clientX, y: e.clientY })
      }

      const WL = ['一', '二', '三', '四', '五', '六', '日']
      // 格子间距：1/3/6 月加大呼吸感，12 月保持紧凑
      const cellGap = months >= 12 ? 2.5 : (months >= 6 ? 3 : 4)
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
              : (cell.v > 0 ? { background: BP, opacity: OPS[levelOf(cell.v)] } : undefined),
            onMouseEnter: cell ? (e) => onCell(cell, e) : undefined,
            onMouseMove: cell ? (e) => onCell(cell, e) : undefined,
            onMouseLeave: () => setHover(null)
          }))
        }
        rows.push(el('div', { key: r, style: { display: 'flex', gap: 4, alignItems: 'center' } },
          el('span', { style: { width: 14, fontSize: 9, color: 'var(--dsw-alias-label-caption)', flex: 'none', textAlign: 'center', lineHeight: '14px' } }, r % 2 === 0 ? WL[r] : ''),
          el('div', { className: 'ts-heatrow', style: { gap: cellGap + 'px' } }, cells)))
      }
      // 月份标签行：与星期列同栅格（首个星期列所在月）
      const monthLabels = []
      let prevM = null
      for (let w = 0; w < weeks; w++) {
        const k0 = keyOf(startW + w * 604800000)
        const mo = Number(k0.slice(5, 7))
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
        const flipX = hover.x + 320 > window.innerWidth
        const flipY = hover.y + 240 > window.innerHeight
        const style = flipX
          ? { right: (window.innerWidth - hover.x + 12) + 'px', top: (hover.y + 14) + 'px' }
          : { left: (hover.x + 14) + 'px', top: (hover.y + 14) + 'px' }
        if (flipY) style.top = 'auto'; if (flipY) style.bottom = (window.innerHeight - hover.y + 14) + 'px'
        pop = el('div', { className: 'ts-pop', style },
          el('div', { className: 'ts-pop-title' }, cnDate(hover.k)),
          el('div', { className: 'ts-pop-row', style: { marginBottom: 4 } },
            el('span', { className: 'ts-pop-k' }, '总消耗'),
            el('span', { className: 'ts-pop-v' }, fmtFull(tot)),
            el('span', { className: 'ts-pop-k', style: { paddingLeft: 12 } }, '会话'),
            el('span', { className: 'ts-pop-v' }, String(hover.sess))),
          tot > 0
            ? entries.slice(0, 8).map(([mk, v]) => {
                const info = (props.models || {})[mk]
                const name = info ? info.model : mk
                const color = modelColor(mk)
                return el('div', { key: mk, className: 'ts-pop-row' },
                  el('span', { className: 'ts-dot', style: { background: color } }),
                  el('span', { style: { maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, name),
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
          key: 's' + i, cx, cy, r, fill: 'none',
          strokeDasharray: len.toFixed(2) + ' ' + (C - len).toFixed(2),
          strokeDashoffset: (-acc).toFixed(2),
          style: { stroke: it.color, strokeWidth: 18 },
          transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
        }, el('title', null, it.name + ' · ' + fmtFull(it.t))))
        acc += len
      }
      kids.push(el('text', { key: 'c1', x: cx, y: cy - 2, textAnchor: 'middle', style: { fill: 'var(--dsw-alias-label-primary)', fontSize: 16, fontWeight: 600 } }, fmt(total)))
      kids.push(el('text', { key: 'c2', x: cx, y: cy + 16, textAnchor: 'middle', style: { fill: 'var(--dsw-alias-label-caption)', fontSize: 11 } }, '累计 Token'))
      return el('svg', { viewBox: '0 0 ' + size + ' ' + size, style: { width: size, height: size, flex: 'none' } }, kids)
    }

    // ── 设置页主体（单页，无 tab）────────────────────────────────────
    const RANGES = [{ v: '7', t: '近7天' }, { v: '30', t: '近30天' }, { v: '90', t: '近90天' }, { v: 'all', t: '全部' }]
    const rangeText = (rv) => { for (let i = 0; i < RANGES.length; i++) { if (RANGES[i].v === rv) return RANGES[i].t } return '' }

    function buildDayList(startKey, endKey) {
      const out = []
      let c = startKey
      let guard = 0
      while (c <= endKey && guard < 3000) { out.push(c); c = keyOf(fromKey(c) + 86400000); guard++ }
      return out
    }

    function createSection(bridge, prefs) {
      return function TokenStatsSection() {
        const [data, setData] = React.useState(null)
        const [err, setErr] = React.useState(null)
        const [loading, setLoading] = React.useState(false)
        const [range, setRange] = React.useState('30')
        const [win, setWin] = React.useState('day')
        const [heatSpan, setHeatSpan] = React.useState('6')
        const [modelOff, setModelOff] = React.useState({})
        const [showTotal, setShowTotal] = React.useState(false)
        const [statPop, setStatPop] = React.useState(null)
        const [todayOn, setTodayOn] = React.useState(prefs ? prefs.isTodayOn() : false)

        const refresh = React.useCallback(() => {
          setLoading(true)
          bridge.getData().then((value) => {
            if (value && value.ready === true) { setData(value); setErr(null) }
            else setErr((value && value.error) || '统计服务不可用')
            setLoading(false)
          }).catch((error) => { setErr(String((error && error.message) || error)); setLoading(false) })
        }, [])
        React.useEffect(() => { refresh() }, [refresh])

        React.useEffect(() => {
          const tick = () => { if (document.visibilityState === 'visible') refresh() }
          const id = window.setInterval(tick, 60000)
          const onVis = () => { if (document.visibilityState === 'visible') refresh() }
          document.addEventListener('visibilitychange', onVis)
          return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
        }, [refresh])

        React.useEffect(() => {
          if (data === null || data.partial !== true) return undefined
          const id = window.setInterval(() => {
            if (document.visibilityState === 'visible') refresh()
          }, 2000)
          return () => { window.clearInterval(id) }
        }, [data, refresh])

        const children = []
        children.push(el('h3', { className: 'ts-title' }, 'Token 用量统计（token-stats）'))
        children.push(el('p', { className: 'ts-desc' },
          '聚合本机全部会话日志（含子代理会话；fork/resume 种子事件已去重）。数据每 60 秒自动刷新；时间范围作用于趋势 / 时段分布 / 模型分布，总览与热力图为全量数据。'))

        // 顶部功能开关：侧栏「今日用量」小卡片
        children.push(el('div', { className: 'ts-swrow' },
          el('div', null,
            el('div', { className: 'ts-swlabel' }, '在侧边栏显示今日用量'),
            el('div', { className: 'ts-swhint' }, '开启后左侧边栏底部显示今日 Token 消耗小卡片（含迷你走势图与昨日对比）')),
          el('button', {
            className: 'ts-switch', role: 'switch', 'aria-checked': todayOn ? 'true' : 'false',
            onClick: () => { const next = !todayOn; setTodayOn(next); if (prefs) prefs.setToday(next) }
          },
            el('span', { className: 'ts-knob' }))))

        if (err) {
          children.push(el('div', { className: 'ts-notice ts-notice-err' }, '读取失败：' + err))
          children.push(el('button', { className: 'ts-btn', onClick: refresh }, '重试'))
          return el('div', { className: 'ts-page' }, children)
        }
        if (data === null) {
          children.push(el('div', { className: 'ts-notice ts-notice-empty' }, loading ? '正在统计会话日志…' : '暂无数据'))
          return el('div', { className: 'ts-page' }, children)
        }

        buildModelColors(data.models)
        const todayK = keyOf(Date.now())
        const cut = range === 'all' ? null : keyOf(fromKey(todayK) - (Number(range) - 1) * 86400000)
        const scoped = cut === null ? null : aggregate(data.records, cut)
        const aggAll = aggregate(data.records, null)
        const hasData = aggAll.first !== null

        children.push(el('div', { className: 'ts-toolbar' },
          el('label', { className: 'ts-hint' }, '时间范围'),
          el('select', { className: 'ts-select', value: range, onChange: (e) => setRange(e.target.value) },
            RANGES.map((o) => el('option', { key: o.v, value: o.v }, o.t))),
          el('span', { className: 'ts-hint', style: { marginLeft: 'auto' } },
            '更新于 ' + hhmm(data.generatedAt) + (loading ? ' · 刷新中…' : '')),
          el('button', { className: 'ts-btn', onClick: refresh, disabled: loading }, '↻ 刷新')))

        if (data.partial === true) {
          const pct = data.total > 0 ? Math.round((data.scanned / data.total) * 100) : 0
          children.push(el('div', { className: 'ts-notice ts-notice-empty', style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
            el('span', null, '后台统计中 ' + pct + '%（' + data.scanned + '/' + data.total + ' 个会话）—— 已扫描部分先展示，完成后自动补全。'),
            data.errors > 0 ? el('span', { className: 'ts-muted' }, data.errors + ' 个会话读取失败已跳过') : null))
        }

        if (!hasData) {
          children.push(el('div', { className: 'ts-empty' },
            '暂无 Token 用量数据 — 发起一次对话后会自动统计（已扫描 ' + data.sessions + ' 个会话）'))
          return el('div', { className: 'ts-page' }, children)
        }

        // ── 1. 指标卡（全量；每卡配可视化）───────────────────────
        const st = streaks(aggAll.byDay)
        let peakDay = null
        for (const day of aggAll.byDay.values()) { if (peakDay === null || day.t > peakDay.t) peakDay = day }
        const dayVals = Array.from(aggAll.byDay.values()).map((d) => d.t)
        const avgDay = dayVals.length > 0 ? aggAll.total / dayVals.length : 0
        const medDay = median(dayVals)
        const leaveStat = () => setStatPop(null)

        // 可视化数据准备
        const allDays = buildDayList(aggAll.first, todayK)
        const dayVal = (k) => { const d = aggAll.byDay.get(k); return d === undefined ? 0 : d.t }
        const sparkVals = allDays.slice(-30).map(dayVal)                    // 近30天 sparkline
        const last7 = allDays.slice(-7).reduce((s, k) => s + dayVal(k), 0)
        const prev7 = allDays.slice(-14, -7).reduce((s, k) => s + dayVal(k), 0)
        const CI = '#4c7ef3', CO = '#2fb261', CC = '#f5a623'                // 输入/输出/缓存三色
        const statVisual = (v) => ({ visual: v })

        const cards = []
        cards.push(el(StatCard, {
          label: '累计 Token', value: fmt(aggAll.total), sub: '输入 ' + fmt(aggAll.i) + ' · 输出 ' + fmt(aggAll.o),
          onHover: (e) => setStatPop({ x: e.clientX, y: e.clientY, content: breakdown('累计构成', [
            ['输入', aggAll.i, 1, aggAll.total], ['输出', aggAll.o, 1, aggAll.total],
            ['缓存读', aggAll.cr, 1, aggAll.total], ['缓存写', aggAll.cw, 1, aggAll.total]
          ]) }), onLeave: leaveStat,
          visual: [el(ComposeBar, { parts: [
            ['输入', aggAll.i, CI], ['输出', aggAll.o, CO],
            ['缓存读', aggAll.cr, CC], ['缓存写', aggAll.cw, '#9a6ef1']
          ] })]
        }))
        cards.push(el(StatCard, {
          label: '近 30 天走势', value: fmt(sparkVals.reduce((s, v) => s + v, 0)), sub: '每日用量迷你图',
          visual: [el(Sparkline, { values: sparkVals }),
            el(TrendDelta, { recent: last7, before: prev7 })]
        }))
        cards.push(el(StatCard, {
          label: '缓存 Token', value: fmt(aggAll.cr + aggAll.cw), sub: '命中 ' + fmt(aggAll.cr) + ' · 写入 ' + fmt(aggAll.cw),
          onHover: (e) => setStatPop({ x: e.clientX, y: e.clientY, content: breakdown('缓存构成 · 命中率 ' + (aggAll.total > 0 ? (aggAll.cr / aggAll.total * 100).toFixed(1) : '0.0') + '%', [
            ['缓存读（命中）', aggAll.cr, 1, aggAll.total], ['缓存写', aggAll.cw, 1, aggAll.total]
          ]) }), onLeave: leaveStat,
          visual: [el(ComposeBar, { parts: [['缓存读', aggAll.cr, CC], ['缓存写', aggAll.cw, '#9a6ef1']] })]
        }))
        if (data.peakStep) cards.push(el(StatCard, {
          label: '峰值单次请求', value: fmt(data.peakStep.tokens), sub: data.peakStep.model + ' · ' + dispDay(data.peakStep.d)
        }))
        if (peakDay) cards.push(el(StatCard, {
          label: '峰值单日', value: fmt(peakDay.t), sub: dispDay(peakDay.d),
          onHover: (e) => setStatPop({ x: e.clientX, y: e.clientY, content: breakdown(peakDay.d + ' 各模型', Object.entries(peakDay.byModel || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([mk, v]) => {
            const info = data.models[mk]
            return [info ? info.model : mk, v, 1, peakDay.t]
          })) }), onLeave: leaveStat,
          visual: [el(ComposeBar, { parts: Object.entries(peakDay.byModel || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([mk, v]) => {
            const info = data.models[mk]
            return [info ? info.model : mk, v, modelColor(mk)]
          }) })]
        }))
        cards.push(el(StatCard, { label: '日均消耗', value: fmt(avgDay), sub: '按活跃日平均',
          visual: [el(Sparkline, { values: sparkVals, color: CO })] }))
        cards.push(el(StatCard, { label: '日消耗中位数', value: fmt(medDay), sub: '按活跃日取中位' }))
        cards.push(el(StatCard, { label: '当前连续使用', value: st.current + ' 天', sub: '按自然日统计',
          visual: [el(StreakBar, { current: st.current, best: st.longest })] }))
        cards.push(el(StatCard, { label: '最长连续使用', value: st.longest + ' 天', sub: '历史最佳纪录',
          visual: [el(StreakBar, { current: st.current, best: st.longest })] }))
        cards.push(el(StatCard, { label: '活跃天数', value: aggAll.byDay.size + ' 天', sub: '共 ' + data.sessions + ' 个会话',
          visual: [el(DaysRibbon, { byDay: aggAll.byDay })] }))
        cards.push(el(StatCard, { label: '模型调用次数', value: fmtFull(aggAll.n), sub: data.active + ' 个会话有用量' }))
        cards.push(el(StatCard, { label: '首次使用', value: dispDay(aggAll.first), sub: aggAll.first }))
        cards.push(el(StatCard, { label: '最近使用', value: dispDay(aggAll.last), sub: aggAll.last }))
        children.push(el('div', { className: 'ts-grid' }, cards))

        // 悬浮明细层（fixed 定位，跟随鼠标）
        if (statPop !== null) {
          const flipX = statPop.x + 320 > window.innerWidth
          const flipY = statPop.y + 200 > window.innerHeight
          const style = flipX ? { right: (window.innerWidth - statPop.x + 12) + 'px' } : { left: (statPop.x + 14) + 'px' }
          style.top = flipY ? 'auto' : (statPop.y + 14) + 'px'
          if (flipY) style.bottom = (window.innerHeight - statPop.y + 14) + 'px'
          children.push(el('div', { className: 'ts-pop', style }, statPop.content))
        }

        if (scoped !== null) {
          children.push(el('div', { className: 'ts-card' },
            el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' } },
              el('span', { className: 'ts-muted' }, '当前范围（' + rangeText(range) + '）'),
              el('span', { style: { fontVariantNumeric: 'tabular-nums' } },
                fmt(scoped.total) + ' tokens · 输入 ' + fmt(scoped.i) + ' · 输出 ' + fmt(scoped.o) + ' · ' + fmtFull(scoped.n) + ' 次调用'))))
        }

        // ── 2. 趋势（单日/7日/30日窗口 + 模型筛选 + 平滑曲线）────
        const sc = scoped !== null ? scoped : aggAll
        let startK = aggAll.first
        if (cut !== null && cut > startK) startK = cut
        const dayList = buildDayList(startK, todayK)
        const winN = win === 'day' ? 1 : Number(win)
        // 滚动窗口「日均值」：总量/实际覆盖天数（含窗口起点前没有的天不计入分母），
        // 7日/30日都呈现日均水平，曲线有起伏而非单调递增
        const winSeries = (getV) => dayList.map((_, i) => {
          let s = 0, cnt = 0
          for (let j = Math.max(0, i - winN + 1); j <= i; j++) { s += getV(dayList[j]); cnt++ }
          return cnt > 0 ? s / cnt : 0
        })
        const labels = dayList.map((k) => dispDay(k))
        const trendSeries = []
        const modelKeys = Array.from(sc.byModel.keys()).sort()
        for (const mk of modelKeys) {
          const info = data.models[mk]
          trendSeries.push({
            name: mk, shortName: info ? info.model : mk, color: modelColor(mk), isTotal: false,
            values: winSeries((k) => { const d = sc.byDay.get(k); return (d !== undefined && d.byModel[mk] !== undefined) ? d.byModel[mk] : 0 }),
            visible: !modelOff[mk]
          })
        }
        trendSeries.push({
          name: '__total__', shortName: '总 Token', color: '#8a94a6', isTotal: true,
          values: winSeries((k) => { const d = sc.byDay.get(k); return d === undefined ? 0 : d.t }),
          visible: showTotal
        })
        const anyVisible = trendSeries.some((s) => s.visible)
        children.push(el('div', { className: 'ts-card' },
          el('div', { className: 'ts-chart-title' },
            'Token 使用趋势（' + (win === 'day' ? '单日' : win + ' 日日均') + ' · 悬浮查看明细）',
            el('span', { style: { display: 'inline-flex', gap: 6 } },
              el(Seg, { options: [{ v: 'day', t: '单日' }, { v: '7', t: '7日' }, { v: '30', t: '30日' }], current: win, onPick: setWin }))),
          el('div', { className: 'ts-legend', style: { marginBottom: 8, marginTop: 0 } },
            trendSeries.map((s) =>
              el('button', {
                key: s.name, className: 'ts-modelchip', 'data-off': s.visible ? '0' : '1',
                onClick: () => { if (s.name === '__total__') setShowTotal(!showTotal); else setModelOff({ ...modelOff, [s.name]: !modelOff[s.name] }) },
                title: '点击切换显示/隐藏'
              },
                el('span', { className: 'ts-dot', style: { background: s.color } }),
                el('span', { className: 'ts-mc-name' }, s.shortName))),
            el('span', { className: 'ts-hint', style: { marginLeft: 6 } }, '默认隐藏总曲线')),
          anyVisible
            ? el(TrendChart, { series: trendSeries, labels })
            : el('div', { className: 'ts-empty' }, '全部曲线已隐藏 —— 点击上方标签恢复')))

        // ── 3. 时段分布 ────────────────────────────────────────────
        children.push(el('div', { className: 'ts-card' },
          el('div', { className: 'ts-chart-title' }, '时段分布（' + rangeText(range) + '，按小时 · 悬浮查看具体量）'),
          el(HourHist, { byHour: sc.byHour })))

        // ── 4. 热力图（1/3/6/12 月；自适应宽度；悬浮当日明细）────
        const HEAT_OPS = [0.16, 0.3, 0.5, 0.72, 0.95]
        children.push(el('div', { className: 'ts-card' },
          el('div', { className: 'ts-chart-title' }, 'Token 活动热力图（悬浮查看当日明细）',
            el(Seg, { options: [{ v: '1', t: '1个月' }, { v: '3', t: '3个月' }, { v: '6', t: '6个月' }, { v: '12', t: '12个月' }], current: heatSpan, onPick: setHeatSpan })),
          el(Heatmap, { byDay: aggAll.byDay, daySessions: data.daySessions || {}, models: data.models, months: Number(heatSpan) }),
          el('div', { className: 'ts-legend' },
            el('span', { className: 'ts-muted' }, '少'),
            HEAT_OPS.map((o, i) => el('span', { key: i, className: 'ts-cell', style: { background: BP, opacity: o } })),
            el('span', { className: 'ts-muted' }, '多'))))

        // ── 5. 模型分布（悬浮构成；颜色与趋势图一致）──────────────
        const arr = Array.from(sc.byModel.values()).sort((a, b) => b.t - a.t)
        if (arr.length === 0) {
          children.push(el('div', { className: 'ts-card ts-empty' }, '该范围内暂无模型用量'))
        } else {
          const donutEntries = arr.slice(0, 7).map((m) => ({ name: m.m, t: m.t, color: modelColor(m.m) }))
          const rest = arr.slice(7)
          if (rest.length > 0) {
            let s = 0
            for (let i = 0; i < rest.length; i++) s += rest[i].t
            donutEntries.push({ name: '其他', t: s, color: '#8a94a6' })
          }
          const modelRows = arr.map((m) => {
            const info = (data.models && data.models[m.m]) || null
            const name = info ? info.model : m.m
            const prov = info ? info.provider : ''
            const color = modelColor(m.m)
            const pct = sc.total > 0 ? (m.t / sc.total * 100) : 0
            const hoverContent = () => breakdown(name + ' 用量构成', [
              ['输入', m.i, 1, m.t], ['输出', m.o, 1, m.t], ['缓存读', m.cr, 1, m.t], ['缓存写', m.cw, 1, m.t]
            ])
            return el('div', { key: m.m, className: 'ts-model',
              onMouseEnter: (e) => setStatPop({ x: e.clientX, y: e.clientY, content: hoverContent() }),
              onMouseMove: (e) => setStatPop({ x: e.clientX, y: e.clientY, content: hoverContent() }),
              onMouseLeave: leaveStat },
              el('span', { className: 'ts-dot', style: { background: color }, title: m.m }),
              el('div', { style: { minWidth: 0, flex: '1' } },
                el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 8, minWidth: 0 } },
                  el('span', { className: 'ts-modelname', title: m.m }, name),
                  el('span', { className: 'ts-modelval' }, fmt(m.t) + ' · ' + pct.toFixed(1) + '%')),
                el('div', { className: 'ts-bartrack' },
                  el('div', { className: 'ts-barfill', style: { width: (m.t / arr[0].t * 100).toFixed(1) + '%', background: color } })),
                el('div', { className: 'ts-muted', style: { fontSize: 11, marginTop: 2 } },
                  (prov ? prov + ' · ' : '') + '输入 ' + fmt(m.i) + ' · 输出 ' + fmt(m.o) + ' · 缓存 ' + fmt(m.cr + m.cw) + ' · ' + fmtFull(m.n) + ' 次')))
          })
          children.push(el('div', { className: 'ts-card' },
            el('div', { className: 'ts-chart-title' }, '模型用量分布（' + rangeText(range) + ' · 悬浮查看构成）'),
            el('div', { className: 'ts-flexrow' },
              el(Donut, { entries: donutEntries, total: sc.total }),
              el('div', { className: 'ts-models' }, modelRows))))
        }

        // ── 页脚口径说明 ────────────────────────────────────────────
        children.push(el('div', { className: 'ts-muted', style: { margin: '4px 2px 0' } },
          '统计口径：总 Token = 输入 + 缓存读 + 缓存写 + 输出（reasoning 已含在输出内）；同一请求的采样 usage 被终值覆盖，不重复累计；fork/resume 种子事件已去重。'))

        return el('div', { className: 'ts-page' }, children)
      }
    }

    exports.inject = ['slots']
    exports.apply = function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return

      const bridge = {
        getData: async () => {
          const response = await fetch('/ext/token-stats/data', { cache: 'no-store' })
          return response.json()
        }
      }

      const sectionStyle = document.createElement('style')
      sectionStyle.setAttribute('data-plugin-css', 'token-stats/settings.css')
      sectionStyle.textContent = CSS
      document.head.appendChild(sectionStyle)
      ctx.effect(() => () => sectionStyle.remove(), 'token-stats: section styles')

      // 「今日用量」侧栏开关（localStorage 持久化——插件运行时偏好，非会话数据）
      const TODATY_KEY = 'token-stats.sidebar-today'
      const readTodayPref = () => {
        try { return window.localStorage.getItem(TODATY_KEY) === '1' } catch { return false }
      }
      const writeTodayPref = (on) => {
        try { on ? window.localStorage.setItem(TODATY_KEY, '1') : window.localStorage.removeItem(TODATY_KEY) } catch {}
      }

      const Section = createSection(bridge, {
        isTodayOn: readTodayPref,
        setToday: (on) => { writeTodayPref(on); window.dispatchEvent(new CustomEvent('token-stats:today-toggle', { detail: { on } })) }
      })
      slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'token-stats', order: 27, label: 'Token 用量统计' },
        Section
      ))

      // ── 侧边栏今日用量小卡片（开关开启时渲染）────────────────────
      // 曲线：今日按小时分布，每个模型一条分色平滑曲线（与统计页配色一致）
      function TodaySidebarCard(props) {
        const wide = !(props && props.wide === false)
        const [data, setData] = React.useState(null)
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

        if (data === null) {
          return el('div', { className: 'ts-today' + (wide ? '' : ' ts-todayRail') },
            el('div', { className: 'ts-todaylabel' }, '今日用量'),
            el('div', { className: 'ts-todayval', style: { opacity: .5 } }, '…'))
        }

        buildModelColors(data.models)
        const todayK = keyOf(Date.now())
        const agg = aggregate(data.records, todayK)
        const yK = keyOf(fromKey(todayK) - 86400000)
        const aggY = aggregate(data.records, yK)
        const delta = aggY.total > 0 ? (agg.total - aggY.total) / aggY.total * 100 : null

        // 完全折叠（rail 模式）：只渲染今日总量 —— 可读数字 + 今日/昨日双条对比
        if (!wide) {
          const barMax = Math.max(agg.total, aggY.total) || 1
          return el('div', { className: 'ts-today ts-todayRail', title: '今日 ' + fmtFull(agg.total) + ' tokens · 昨日 ' + fmtFull(aggY.total) },
            el('div', { className: 'ts-todaylabel', style: { textAlign: 'center' } }, '今日'),
            el('div', { className: 'ts-todayval', style: { textAlign: 'center', fontSize: 12 } }, fmt(agg.total)),
            // 今日 vs 昨日双条（可视化对比，替代箭头文字）
            el('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 16, marginTop: 3 } },
              el('span', { title: '今日', style: { width: 9, borderRadius: '2px 2px 0 0', background: BP, display: 'block', height: Math.max(2, agg.total / barMax * 14).toFixed(1) + 'px' } }),
              el('span', { title: '昨日', style: { width: 9, borderRadius: '2px 2px 0 0', background: BP, opacity: .28, display: 'block', height: Math.max(2, aggY.total / barMax * 14).toFixed(1) + 'px' } })))
        }

        // 各模型今日逐小时序列（0..当前小时），与统计页 modelColor 一致
        const todayRecords = data.records.filter((r) => r.d === todayK)
        const nowHour = new Date().getHours()
        const modelHourSeries = []
        const mkKeys = Array.from(agg.byModel.keys()).sort()
        for (const mk of mkKeys) {
          const vals = []
          for (let h = 0; h <= nowHour; h++) {
            let s = 0
            for (const r of todayRecords) { if (r.h === h && r.m === mk) s += (r.i || 0) + (r.o || 0) + (r.cr || 0) + (r.cw || 0) }
            vals.push(s)
          }
          modelHourSeries.push({ name: mk, shortName: (data.models[mk] || {}).model || mk, color: modelColor(mk), values: vals })
        }

        // 迷你多模型曲线：分色曲线 + 十字悬浮提示（小时 + 各模型当小时用量）
        const TodayChart = () => {
          const W = 160, H = 44, PAD = 3
          const n = nowHour + 1
          const [hover, setHover] = React.useState(null)
          const svgRef = React.useRef(null)
          if (n < 2 || modelHourSeries.length === 0) return null
          const maxV = Math.max(1, ...modelHourSeries.flatMap((s) => s.values))
          const xs = (i) => PAD + (W - PAD * 2) * i / (n - 1)
          const ys = (v) => H - PAD - (v / maxV) * (H - PAD * 2)
          const onMove = (e) => {
            const node = svgRef.current
            if (node === null) return
            const rect = node.getBoundingClientRect()
            const relX = (e.clientX - rect.left) / rect.width * W
            let i = n <= 1 ? 0 : Math.round((relX - PAD) / (W - PAD * 2) * (n - 1))
            if (i < 0) i = 0
            if (i > n - 1) i = n - 1
            setHover({ i, mx: e.clientX, my: e.clientY })
          }
          const kids = []
          if (hover !== null) {
            kids.push(el('line', { key: 'ch', x1: xs(hover.i), x2: xs(hover.i), y1: PAD, y2: H - PAD, style: { stroke: BP, strokeWidth: 1, strokeDasharray: '2 2', opacity: .7 } }))
          }
          for (const s of modelHourSeries) {
            const pts = s.values.map((v, i) => [xs(i), ys(v)])
            kids.push(el('path', { key: 'l' + s.name, d: smoothPath(pts), fill: 'none',
              style: { stroke: s.color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: .9 } }))
            kids.push(el('circle', { key: 'e' + s.name, cx: xs(n - 1), cy: ys(s.values[n - 1] || 0), r: 1.8, style: { fill: s.color } }))
            if (hover !== null) {
              kids.push(el('circle', { key: 'h' + s.name, cx: xs(hover.i), cy: ys(s.values[hover.i] || 0), r: 2.2, style: { fill: s.color, stroke: 'var(--dsw-alias-bg-layer-1)', strokeWidth: 1 } }))
            }
          }
          kids.push(el('rect', { key: 'cap', x: 0, y: 0, width: W, height: H, fill: 'transparent', style: { cursor: 'crosshair' }, onMouseMove: onMove, onMouseLeave: () => setHover(null) }))
          // 悬浮提示（fixed 定位跟随鼠标——侧栏卡片 overflow:hidden 不再裁剪）
          const tip = hover !== null
            ? (() => {
                const active = modelHourSeries.filter((s) => (s.values[hover.i] || 0) > 0)
                const pos = tipPos(hover.mx, hover.my, 170, 30 + active.length * 16)
                return el('div', { className: 'ts-tipfixed', style: { ...pos, fontSize: 10.5 } },
                  el('div', { style: { fontWeight: 600 } },
                    hover.i + ':00'),
                  active.length > 0
                    ? active.sort((a, b) => (b.values[hover.i] || 0) - (a.values[hover.i] || 0)).map((s) =>
                        el('div', { key: s.name, className: 'ts-tiprow' },
                          el('span', { className: 'ts-dot', style: { background: s.color, width: 6, height: 6 } }),
                          el('span', { className: 'ts-tip-k', style: { overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 } }, s.shortName),
                          el('span', { className: 'ts-tip-v' }, fmt(s.values[hover.i] || 0))))
                    : el('div', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, '该小时无消耗'))
              })()
            : null
          return el('div', { className: 'ts-svgwrap' },
            el('svg', { className: 'ts-spark', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', ref: svgRef }, kids),
            tip)
        }

        return el('div', { className: 'ts-today', title: '今日 Token 用量 · ' + modelHourSeries.length + ' 个模型' },
          el('div', { className: 'ts-todayhead' },
            el('span', { className: 'ts-todaylabel' }, '今日 Token'),
            el('span', { className: 'ts-todayval' }, fmt(agg.total))),
          modelHourSeries.length > 0 ? el(TodayChart) : null,
          // 模型色标（紧凑 chips）
          modelHourSeries.length > 0
            ? el('div', { className: 'ts-todaymodels' },
                modelHourSeries.map((s) =>
                  el('span', { key: s.name, className: 'ts-todaymchip', title: s.shortName + ' · ' + fmtFull(s.values.reduce((a, b) => a + b, 0)) },
                    el('span', { className: 'ts-dot', style: { background: s.color } }),
                    el('span', null, s.shortName))))
            : null,
          delta !== null
            ? el('div', { className: 'ts-statgrow', style: { marginTop: 4, color: delta >= 0 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)', fontSize: 10.5 } },
                el('span', { className: 'ts-arrow ' + (delta >= 0 ? 'ts-arrow-up' : 'ts-arrow-down') }),
                el('span', null, (delta >= 0 ? '+' : '') + delta.toFixed(0) + '% vs 昨日'))
            : el('div', { className: 'ts-muted', style: { fontSize: 10, marginTop: 4 } }, agg.total > 0 ? '昨日无消耗' : '开始使用后统计'))
      }

      // 侧栏渲染开关：自定义事件 + 每帧校验偏好变化（避免跨组件 state 同步复杂化）
      const todayPrefListeners = new Set()
      window.addEventListener('token-stats:today-toggle', (ev) => {
        for (const fn of todayPrefListeners) fn(!!(ev.detail && ev.detail.on))
      })

      function TodaySidebarEntry() {
        const [on, setOn] = React.useState(readTodayPref())
        React.useEffect(() => {
          const fn = (v) => setOn(v)
          todayPrefListeners.add(fn)
          return () => { todayPrefListeners.delete(fn) }
        }, [])
        return on === true ? el(TodaySidebarCard, {}) : null
      }

      slots.inject('sidebar.footer.action', () => slots.register(
        { name: 'sidebar.footer.action', id: 'token-stats-today' },
        TodaySidebarEntry
      ))
    }

    return module.exports
  }
})
