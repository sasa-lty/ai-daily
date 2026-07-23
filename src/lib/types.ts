/**
 * 数据类型定义：页面与更新脚本共用。
 */

/** 数据状态：AI 增强 / 规则整理 / 使用缓存 / 更新失败 */
export type DataStatus = 'ai' | 'rule' | 'cache' | 'error'

export const DATA_STATUS_LABEL: Record<DataStatus, string> = {
  ai: 'AI 增强',
  rule: '规则整理',
  cache: '使用缓存',
  error: '更新失败',
}

/** 新闻分类（每条新闻只有一个主分类） */
export type Category =
  | '模型'
  | 'Agent'
  | '产品'
  | '开源'
  | '研究'
  | '算力'
  | '商业'
  | '安全'

export const ALL_CATEGORIES: Category[] = [
  '模型',
  'Agent',
  '产品',
  '开源',
  '研究',
  '算力',
  '商业',
  '安全',
]

export type Confidence = 'high' | 'medium' | 'low'

export interface NewsItem {
  id: string
  title: string
  category: Category
  /** 短摘要（40-60 字左右） */
  summary: string
  /** 为什么值得看 */
  whyItMatters: string
  sourceName: string
  /** 原文链接，所有真实新闻必须有 */
  sourceUrl: string
  publishedAt: string
  /** 影响分 0-100 */
  impactScore: number
  confidence: Confidence
  tags: string[]
  /** 摘要是否经过 LLM 增强 */
  aiEnhanced: boolean
  /** 示例数据标记，页面上会显示 sample 角标 */
  isSample?: boolean
}

export interface SourceStat {
  name: string
  url: string
  ok: boolean
  itemCount: number
  note?: string
}

export interface DailyOverview {
  /** 今日一句话判断 */
  verdict: string
  /** 3 个关键词 */
  keywords: string[]
  /** 今日热度指数 0-100 */
  heatIndex: number
  sourceCount: number
}

export interface DailyData {
  /** 数据所属日期 YYYY-MM-DD */
  date: string
  /** 生成时间 ISO 字符串 */
  generatedAt: string
  status: DataStatus
  statusNote?: string
  overview: DailyOverview
  /** 今日三件事：最重要的 3 条新闻 id */
  topStoryIds: string[]
  items: NewsItem[]
  sources: SourceStat[]
}

/** 信号等级（热点梯度图纵轴） */
export type SignalLevel = '必看' | '跟踪' | '扫过'

export const SIGNAL_LEVELS: SignalLevel[] = ['必看', '跟踪', '扫过']

export function signalLevelOf(score: number): SignalLevel {
  if (score >= 80) return '必看'
  if (score >= 60) return '跟踪'
  return '扫过'
}

/* ---------- 模型评分 ---------- */

export interface ModelScore {
  name: string
  vendor: string
  /** 各维度得分 0-100，顺序与 dimensions 一致 */
  scores: number[]
  /** 一句话诊断：长板短板 */
  diagnosis: string
  /** 评分来源；人工评分必须为 "manual" */
  source: string
  /** 补充说明（如数据口径） */
  note?: string
}

export interface ModelScoresFile {
  updatedAt: string
  /** 能力维度，例如 编码能力 / 网页生成 / 多模态 ... */
  dimensions: string[]
  /** 总评一句话诊断 */
  overallDiagnosis: string
  models: ModelScore[]
}
