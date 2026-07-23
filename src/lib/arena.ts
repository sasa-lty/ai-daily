/**
 * Arena 数据加工：名称归一、维度百分位、本站综合指数。
 *
 * 重要约束：
 * - 不同榜单量纲不同（Elo 千分制 / 0-1 分），绝不直接平均原始分数；
 *   先在各榜单内部按名次转为百分位，再按公开权重加权。
 * - “本站综合指数”是本站的计算结果，不是 Arena 官方总分。
 * - 覆盖不足三个维度的模型不进入综合排名。
 */
import type { ArenaDim, ArenaFile } from './types'
import { ARENA_DIMS } from './types'

export interface DimStat {
  rank: number
  score: number
  ciLower: number
  ciUpper: number
  /** 榜内百分位 0-100（rank 1 = 100） */
  percentile: number
  publishDate: string
}

export interface ModelProfile {
  /** 归一化名称（跨榜匹配键） */
  key: string
  /** 展示名（首个出现的原始写法） */
  name: string
  organization: string
  dims: Partial<Record<ArenaDim, DimStat>>
  dimCount: number
  totalVotes: number
}

/**
 * 归一化：跨榜匹配同一模型家族。
 * 括号内容并入连字符段；thinking / high / xhigh / max / medium 等“配置词”折叠，
 * 使 “Claude Opus 4.7 (Thinking)” 与 “claude-opus-4-7-thinking” 归为同一模型家族。
 * search / grounding / preview 等功能变体保留区分。
 */
const CONFIG_TOKENS = new Set([
  'thinking',
  'high',
  'xhigh',
  'medium',
  'low',
  'max',
  'codex',
  'harness',
  'beta',
  'beta1',
  'beta2',
])

export function normalizeModelName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\(([^)]*)\)/g, '-$1')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base
    .split('-')
    .filter((seg) => !CONFIG_TOKENS.has(seg))
    .join('-')
}

/** 把六张榜单聚合成模型画像（跨榜匹配同一模型） */
export function buildProfiles(file: ArenaFile): ModelProfile[] {
  const map = new Map<string, ModelProfile>()
  for (const board of file.boards) {
    const n = board.models.length
    for (const m of board.models) {
      const percentile = n > 1 ? Math.round(((n - m.rank) / (n - 1)) * 1000) / 10 : 100
      const key = normalizeModelName(m.name)
      const profile =
        map.get(key) ??
        ({ key, name: m.name, organization: m.organization, dims: {}, dimCount: 0, totalVotes: 0 } as ModelProfile)
      // 家族合并时优先用更短的展示名（如 claude-opus-4-7 优于 claude-opus-4-7-thinking）
      if (m.name.length < profile.name.length) profile.name = m.name
      if (!profile.dims[board.dim]) {
        profile.dims[board.dim] = {
          rank: m.rank,
          score: m.score,
          ciLower: m.ciLower,
          ciUpper: m.ciUpper,
          percentile,
          publishDate: board.publishDate,
        }
        profile.dimCount += 1
      }
      profile.totalVotes += m.voteCount
      map.set(key, profile)
    }
  }
  return [...map.values()]
}

/* ---------------- 权重预设（公开） ---------------- */

export interface WeightPreset {
  id: string
  label: string
  weights: Record<ArenaDim, number>
  /** 权重的可读说明，直接展示在页面上 */
  note: string
}

export const WEIGHT_PRESETS: WeightPreset[] = [
  {
    id: 'comprehensive',
    label: '综合',
    weights: { text: 1, agent: 1, webdev: 1, vision: 1, document: 1, search: 1 },
    note: '六维等权',
  },
  {
    id: 'coding',
    label: '编程 Agent',
    weights: { text: 1, agent: 3, webdev: 3, vision: 0, document: 1, search: 0 },
    note: 'Agent×3 · WebDev×3 · 文本×1 · 文档×1',
  },
  {
    id: 'research',
    label: '搜索研究',
    weights: { text: 2, agent: 0, webdev: 0, vision: 0, document: 2, search: 3 },
    note: '搜索×3 · 文本×2 · 文档×2',
  },
  {
    id: 'multimodal',
    label: '多模态',
    weights: { text: 1, agent: 0, webdev: 0, vision: 3, document: 2, search: 1 },
    note: '视觉×3 · 文档×2 · 文本×1 · 搜索×1',
  },
]

/**
 * 本站综合指数：对权重>0 且有数据的维度做百分位加权平均。
 * 覆盖维度不足三个（整体或预设内）时返回 null，不进入排名。
 */
export function compositeIndex(
  profile: ModelProfile,
  weights: Record<ArenaDim, number>
): number | null {
  let numerator = 0
  let denominator = 0
  let usedDims = 0
  for (const dim of ARENA_DIMS) {
    const w = weights[dim]
    const stat = profile.dims[dim]
    if (w > 0 && stat) {
      numerator += w * stat.percentile
      denominator += w
      usedDims += 1
    }
  }
  if (profile.dimCount < 3 || usedDims < 3 || denominator === 0) return null
  return Math.round((numerator / denominator) * 10) / 10
}

export interface RankedModel {
  profile: ModelProfile
  index: number
}

export function rankByPreset(profiles: ModelProfile[], preset: WeightPreset): RankedModel[] {
  return profiles
    .map((profile) => ({ profile, index: compositeIndex(profile, preset.weights) }))
    .filter((r): r is RankedModel => r.index !== null)
    .sort((a, b) => b.index - a.index)
}
