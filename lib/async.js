/**
 * 异步小工具 —— 纯逻辑，无依赖，可独立单测。
 *
 * @module @dshp-inx/token-stats/async
 */

/**
 * 给 Promise 加超时：超时后 reject，调用方走已有失败重试路径。
 * 定时器 unref，避免拖住宿主进程退出；内层 Promise  settled 后清定时器。
 */
export function withTimeout(promise, ms, label) {
  let timer = 0
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('timeout after ' + ms + 'ms' + (label ? ' (' + label + ')' : '')))
    }, ms)
    if (timer !== null && typeof timer === 'object' && typeof timer.unref === 'function') timer.unref()
  })
  return Promise.race([
    Promise.resolve(promise).finally(() => { clearTimeout(timer) }),
    timeout
  ])
}
