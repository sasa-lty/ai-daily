/**
 * Arena 官方榜单更新脚本。
 *
 * 数据源：Hugging Face 官方数据集 lmarena-ai/leaderboard-dataset
 * 通过 Dataset Viewer REST API 拉取（不抓取 Arena 网页 HTML）：
 *   https://datasets-server.huggingface.co/rows?dataset=...&config=<config>&split=latest
 *
 * 运行方式：npm run update:arena
 * 输出：src/data/arena-leaderboard.json
 *
 * 失败处理：
 * - 单个榜单失败：该榜单保留上次缓存数据。
 * - 全部失败：整份文件保持上次缓存，仅更新状态标记。
 * - 脚本永远以退出码 0 结束，保证 GitHub Actions 不中断。
 */
import fs from 'node:fs'
import path from 'node:path'
import type {
  ArenaBoardData,
  ArenaFile,
  ArenaModelEntry,
} from '../src/lib/types.js'
import { ARENA_CONFIG_TO_DIM, ARENA_DIM_LABEL } from '../src/lib/types.js'

const ROOT = process.cwd()
const ARENA_PATH = path.join(ROOT, 'src', 'data', 'arena-leaderboard.json')

const DATASET = 'lmarena-ai/leaderboard-dataset'
const API_BASE = 'https://datasets-server.huggingface.co/rows'
const SOURCE_URL = `https://huggingface.co/datasets/${DATASET}`
const FETCH_TIMEOUT_MS = 20_000
/** 抓取深度：更深的池子让 σ 标定与缺失维度先验更稳；图表只显示前 10 */
const TOP_N = 25

interface ArenaRow {
  model_name?: string
  organization?: string
  // 多数榜单使用 rating 系列字段
  rating?: number
  rating_lower?: number
  rating_upper?: number
  vote_count?: number
  // agent 等榜单使用 score 系列字段（0-1 量纲）与 observation_count
  score?: number
  score_ci_lower?: number
  score_ci_upper?: number
  observation_count?: number
  session_count?: number
  rank?: number
  leaderboard_publish_date?: string
}

/** 大数取整、小数（0-1 量纲）保留三位，避免 0.097 被显示成 0 */
function smartRound(v: number): number {
  return v >= 10 ? Math.round(v) : Math.round(v * 1000) / 1000
}

async function fetchBoard(config: string): Promise<ArenaBoardData> {
  const url =
    `${API_BASE}?dataset=${encodeURIComponent(DATASET)}` +
    `&config=${encodeURIComponent(config)}&split=latest&offset=0&length=${TOP_N + 5}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ai-daily-radar/2.0 leaderboard reader' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const payload = (await res.json()) as { rows?: Array<{ row: ArenaRow }> }
    const rows = payload.rows ?? []
    if (rows.length === 0) throw new Error('返回 0 行')

    const seen = new Set<string>()
    const models: ArenaModelEntry[] = []
    let publishDate = ''
    for (const { row } of rows) {
      // 兼容两种 schema：rating 系列（多数榜）与 score 系列（agent 等榜）
      const rating = row.rating ?? row.score
      if (!row.model_name || typeof row.rank !== 'number' || typeof rating !== 'number') continue
      if (seen.has(row.model_name)) continue
      seen.add(row.model_name)
      if (row.leaderboard_publish_date && !publishDate) publishDate = row.leaderboard_publish_date
      models.push({
        name: row.model_name,
        organization: row.organization ?? '未知机构',
        rank: row.rank,
        score: smartRound(rating),
        ciLower: smartRound(row.rating_lower ?? row.score_ci_lower ?? rating),
        ciUpper: smartRound(row.rating_upper ?? row.score_ci_upper ?? rating),
        voteCount: Math.round(row.vote_count ?? row.observation_count ?? row.session_count ?? 0),
      })
      if (models.length >= TOP_N) break
    }
    if (models.length === 0) throw new Error('有效行数为 0')

    const dim = ARENA_CONFIG_TO_DIM[config]
    return {
      config,
      dim,
      label: ARENA_DIM_LABEL[dim],
      publishDate: publishDate || '未知',
      models: models.sort((a, b) => a.rank - b.rank),
    }
  } finally {
    clearTimeout(timer)
  }
}

function loadCache(): ArenaFile | null {
  if (!fs.existsSync(ARENA_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(ARENA_PATH, 'utf-8')) as ArenaFile
  } catch {
    return null
  }
}

async function main() {
  const configs = Object.keys(ARENA_CONFIG_TO_DIM)
  const updatedAt = new Date().toISOString()
  console.log(`[arena] 开始拉取 ${configs.length} 个榜单（split=latest）`)

  const cache = loadCache()
  const cacheBoards = new Map((cache?.boards ?? []).map((b) => [b.config, b]))

  const results = await Promise.allSettled(configs.map(fetchBoard))

  const boards: ArenaBoardData[] = []
  let okCount = 0
  let cacheCount = 0

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i]
    const result = results[i]
    if (result.status === 'fulfilled') {
      boards.push(result.value)
      okCount += 1
      console.log(`  - OK   ${config}：${result.value.models.length} 个模型，发布日期 ${result.value.publishDate}`)
    } else {
      const cached = cacheBoards.get(config)
      if (cached) {
        boards.push(cached)
        cacheCount += 1
        console.warn(`  - CACHE ${config}：抓取失败（${result.reason?.message ?? result.reason}），使用缓存（${cached.publishDate}）`)
      } else {
        console.warn(`  - FAIL ${config}：抓取失败且无缓存（${result.reason?.message ?? result.reason}）`)
      }
    }
  }

  if (boards.length === 0) {
    // 全部失败且无任何缓存：保留旧文件；连旧文件都没有则不写文件，页面显示空态
    if (cache) {
      const kept: ArenaFile = {
        ...cache,
        updatedAt,
        status: 'cache',
        statusNote: '本次抓取全部失败，展示上一次缓存数据。',
      }
      fs.writeFileSync(ARENA_PATH, JSON.stringify(kept, null, 2) + '\n', 'utf-8')
      console.log('[arena] 全部失败，保留旧缓存文件')
    } else {
      console.warn('[arena] 全部失败且无缓存，未生成 arena-leaderboard.json（页面显示空态）')
    }
    return
  }

  const file: ArenaFile = {
    updatedAt,
    status: cacheCount > 0 ? 'cache' : 'ok',
    statusNote:
      cacheCount > 0 ? `部分榜单（${cacheCount} 个）抓取失败，使用缓存数据。` : undefined,
    sourceUrl: SOURCE_URL,
    boards,
  }
  fs.mkdirSync(path.dirname(ARENA_PATH), { recursive: true })
  fs.writeFileSync(ARENA_PATH, JSON.stringify(file, null, 2) + '\n', 'utf-8')
  console.log(`[arena] 完成：${okCount} 个榜单更新，${cacheCount} 个使用缓存，已写入 src/data/arena-leaderboard.json`)
}

main().catch((err) => {
  console.error('[arena] 未预期错误：', err)
  process.exit(0)
})
