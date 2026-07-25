/**
 * Arena 数据加工：名称归一、维度得分（σ 标定）、本站综合指数。
 *
 * 重要约束：
 * - 不同榜单量纲不同（Elo 千分制 / 0-1 分），绝不直接平均原始分数。
 * - 也不用「名次百分位」：Top 10 里名次百分位会把第 10 名强行压到 0，
 *   而各榜单的真实分差相差数倍（文本榜 Top10 只差 4.9σ，WebDev 榜差 13.6σ），
 *   名次百分位会把这两种情况画成同一个样子。
 * - 改用榜内 σ 标定：σ = 该榜单各模型 95% 置信区间半宽的中位数，
 *   维度得分 = max(FLOOR, 100 − K × 与榜首的差距/σ)，即「落后榜首几个标准差」。
 * - 「本站综合指数」是本站的计算结果，不是 Arena 官方总分。
 */
import type { ArenaDim, ArenaFile } from './types'
import { ARENA_DIMS } from './types'

/* ---------------- 标定参数（公开，页面上有说明） ---------------- */

/** 每落后榜首 1σ 扣的分数 */
export const SIGMA_DECAY_K = 5
/** 维度得分下限，避免长尾被压到 0 让雷达图塌陷 */
export const SCORE_FLOOR = 25
/** 收缩强度：相当于额外加入 1.5 个「典型水平」维度，惩罚覆盖过少的模型 */
export const PRIOR_WEIGHT = 1.5
/** 进入综合排名所需的最少覆盖维度数 */
export const MIN_COVERED_DIMS = 2

export interface DimStat {
  rank: number
  score: number
  ciLower: number
  ciUpper: number
  /** 与榜首的差距，单位 σ */
  gapSigma: number
  /** 榜内 σ 标定得分 0-100（榜首 = 100） */
  dimScore: number
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

/** 单榜标定结果 */
export interface BoardCalibration {
  dim: ArenaDim
  /** 置信区间半宽中位数 */
  sigma: number
  /** 榜首原始分 */
  top: number
  /** 榜尾原始分 */
  bottom: number
  /** 榜首到榜尾的差距（σ） */
  spreadSigma: number
  modelCount: number
}

/** 缺失维度的补齐先验：池内该维度得分中位数；全局中位数用于综合指数收缩 */
export interface ArenaPriors {
  global: number
  byDim: Partial<Record<ArenaDim, number>>
}

export interface ArenaModel {
  profiles: ModelProfile[]
  calibration: Partial<Record<ArenaDim, BoardCalibration>>
  priors: ArenaPriors
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

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const round1 = (v: number) => Math.round(v * 10) / 10

/** σ 线性衰减：落后榜首 gapSigma 个标准差对应的维度得分 */
export function decayScore(gapSigma: number): number {
  return round1(Math.max(SCORE_FLOOR, 100 - SIGMA_DECAY_K * Math.max(0, gapSigma)))
}

/** 榜内标定：σ 取置信区间半宽中位数（无有效区间时退化为 1，只保留名次差异） */
function calibrateBoard(file: ArenaFile): Partial<Record<ArenaDim, BoardCalibration>> {
  const out: Partial<Record<ArenaDim, BoardCalibration>> = {}
  for (const board of file.boards) {
    if (board.models.length === 0) continue
    const halfWidths = board.models
      .map((m) => (m.ciUpper - m.ciLower) / 2)
      .filter((v) => Number.isFinite(v) && v > 0)
    const sigma = median(halfWidths) || 1
    const scores = board.models.map((m) => m.score)
    const top = Math.max(...scores)
    const bottom = Math.min(...scores)
    out[board.dim] = {
      dim: board.dim,
      sigma,
      top,
      bottom,
      spreadSigma: (top - bottom) / sigma,
      modelCount: board.models.length,
    }
  }
  return out
}

/** 把六张榜单聚合成模型画像（跨榜匹配同一模型），并给出榜单标定与缺失维度先验 */
export function buildArenaModel(file: ArenaFile): ArenaModel {
  const calibration = calibrateBoard(file)
  const map = new Map<string, ModelProfile>()

  for (const board of file.boards) {
    const cal = calibration[board.dim]
    if (!cal) continue
    for (const m of board.models) {
      const gapSigma = Math.max(0, (cal.top - m.score) / cal.sigma)
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
          gapSigma: Math.round(gapSigma * 100) / 100,
          dimScore: decayScore(gapSigma),
          publishDate: board.publishDate,
        }
        profile.dimCount += 1
      }
      profile.totalVotes += m.voteCount
      map.set(key, profile)
    }
  }

  const profiles = [...map.values()]
  return { profiles, calibration, priors: computePriors(profiles) }
}

/**
 * 先验 = 「一个上榜模型的典型水平」。
 * global：池内所有维度得分的中位数，用于综合指数向下收缩；
 * byDim：各维度得分的中位数，用于雷达图虚线补齐缺失维度。
 */
export function computePriors(profiles: ModelProfile[]): ArenaPriors {
  const all: number[] = []
  const byDim: Partial<Record<ArenaDim, number>> = {}
  for (const dim of ARENA_DIMS) {
    const vals: number[] = []
    for (const p of profiles) {
      const stat = p.dims[dim]
      if (stat) {
        vals.push(stat.dimScore)
        all.push(stat.dimScore)
      }
    }
    if (vals.length > 0) byDim[dim] = round1(median(vals))
  }
  return { global: round1(median(all)) || SCORE_FLOOR, byDim }
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

export interface CompositeResult {
  /** 已覆盖维度的加权平均（未收缩） */
  raw: number
  /** 向先验收缩后的本站综合指数 */
  index: number
  /** 预设内实际用到的维度数 */
  usedDims: number
}

/**
 * 本站综合指数：对权重>0 且有数据的维度做加权平均，再向池内先验收缩：
 *   index = (Σ w·s + w0·prior) / (Σ w + w0)
 * 只测了两三个维度的模型不会凭少数强项冲到榜首，也不会因为缺维度被判 0。
 * 预设内覆盖不足 MIN_COVERED_DIMS 个维度时返回 null，不进入排名。
 */
export function computeComposite(
  profile: ModelProfile,
  weights: Record<ArenaDim, number>,
  priors: ArenaPriors
): CompositeResult | null {
  let numerator = 0
  let denominator = 0
  let usedDims = 0
  for (const dim of ARENA_DIMS) {
    const w = weights[dim]
    const stat = profile.dims[dim]
    if (w > 0 && stat) {
      numerator += w * stat.dimScore
      denominator += w
      usedDims += 1
    }
  }
  if (usedDims < MIN_COVERED_DIMS || denominator === 0) return null
  return {
    raw: round1(numerator / denominator),
    index: round1((numerator + PRIOR_WEIGHT * priors.global) / (denominator + PRIOR_WEIGHT)),
    usedDims,
  }
}

/** 只要综合指数数值时的便捷入口 */
export function compositeIndex(
  profile: ModelProfile,
  weights: Record<ArenaDim, number>,
  priors: ArenaPriors
): number | null {
  return computeComposite(profile, weights, priors)?.index ?? null
}

export interface RankedModel {
  profile: ModelProfile
  index: number
  raw: number
  usedDims: number
}

export function rankByPreset(
  profiles: ModelProfile[],
  preset: WeightPreset,
  priors: ArenaPriors
): RankedModel[] {
  return profiles
    .map((profile) => ({ profile, result: computeComposite(profile, preset.weights, priors) }))
    .filter((r): r is { profile: ModelProfile; result: CompositeResult } => r.result !== null)
    .map(({ profile, result }) => ({ profile, ...result }))
    .sort((a, b) => b.index - a.index)
}
