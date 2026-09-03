/**
 * fsindex.js 单元测试 —— 文件索引 / 指纹 / skip 语义（仅 node 内置，无依赖）。
 *
 * 用法：node test/fsindex.test.mjs
 */
import { buildFileIndex, fileFingerprint, skipOf } from '../lib/fsindex.js'
import assert from 'node:assert'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const root = mkdtempSync(join(tmpdir(), 'ts-fsindex-'))
const sessions = join(root, 'sessions')
const mk = (cwd, sess, withLog) => {
  const dir = join(sessions, cwd, sess)
  mkdirSync(dir, { recursive: true })
  if (withLog) writeFileSync(join(dir, 'session.jsonl.zstd'), 'x'.repeat(100))
  return dir
}

// ── 1. 索引结构：目录名即键，条目携带 size/mtime ──────────────────────────
{
  mk('proj-a', 'session-aaa', true)
  mk('proj-a', 'session-bbb', false)          // 无日志文件 → 跳过
  mk('proj-a', 'not-a-session', true)         // 前缀不符 → 跳过（目录名无 session- 前缀）
  mk('proj-b', 'session-ccc', true)
  writeFileSync(join(sessions, 'stray.txt'), 'x')  // 顶层文件 → 跳过
  const idx = buildFileIndex(sessions)
  assert.strictEqual(idx.size, 2, '只索引带日志的 session- 目录')
  const e = idx.get('session-aaa')
  assert.ok(e.file.endsWith(join('proj-a', 'session-aaa', 'session.jsonl.zstd')))
  assert.strictEqual(e.size, 100)
  assert.ok(typeof e.mtimeMs === 'number' && e.mtimeMs > 0)
  console.log('✓ 1. 索引结构与过滤')
}

// ── 2. 指纹稳定；文件变化后失配 ──────────────────────────────────────────
{
  const idx = buildFileIndex(sessions)
  const fp1 = fileFingerprint(idx, 'session-aaa')
  assert.ok(typeof fp1 === 'string' && fp1.includes(':'), '指纹形如 size:mtime')
  // 同一索引重复取 → 稳定（且全程无额外 stat，纯内存读）
  assert.strictEqual(fileFingerprint(idx, 'session-aaa'), fp1)
  // 缺失 id → null（调用方退化为重扫）
  assert.strictEqual(fileFingerprint(idx, 'session-nope'), null)
  assert.strictEqual(fileFingerprint(new Map(), 'session-aaa'), null)
  // 文件追加后重建索引 → 指纹变化
  const dir = join(sessions, 'proj-a', 'session-aaa')
  writeFileSync(join(dir, 'session.jsonl.zstd'), 'x'.repeat(200))
  const idx2 = buildFileIndex(sessions)
  assert.notStrictEqual(fileFingerprint(idx2, 'session-aaa'), fp1, '内容变化指纹必须变')
  // 仅 mtime 变化（touch）→ 指纹也变
  const f = join(dir, 'session.jsonl.zstd')
  utimesSync(f, new Date(946684800000), new Date(946684800000))
  const idx3 = buildFileIndex(sessions)
  assert.notStrictEqual(fileFingerprint(idx3, 'session-aaa'), fileFingerprint(idx2, 'session-aaa'), 'mtime 变化指纹必须变')
  console.log('✓ 2. 指纹稳定与失配')
}

// ── 3. 空目录/缺失目录 → 空索引（退化全读不断言） ─────────────────────────
{
  assert.strictEqual(buildFileIndex(join(root, 'no-such-dir')).size, 0)
  assert.strictEqual(buildFileIndex(root).size, 0, '无匹配会话时为空')
  console.log('✓ 3. 缺失目录退化为空索引')
}

// ── 4. skipOf：fork/resume 种子跳过数 ─────────────────────────────────────
{
  assert.strictEqual(skipOf({ parentSession: 'session-x', seedLength: 12 }), 12)
  assert.strictEqual(skipOf({ parentSession: 'session-x', seedLength: 0 }), 0)
  assert.strictEqual(skipOf({ seedLength: 5 }), 0, '无 parentSession 不跳')
  assert.strictEqual(skipOf({ parentSession: 'session-x' }), 0, '无 seedLength 不跳')
  assert.strictEqual(skipOf(null), 0)
  assert.strictEqual(skipOf(undefined), 0)
  assert.strictEqual(skipOf('x'), 0)
  console.log('✓ 4. skipOf 种子跳过语义')
}

console.log('\n=== fsindex.js 全部 4 项测试通过 ===')
