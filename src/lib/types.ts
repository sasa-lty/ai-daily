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
  /** 关键事实（2-3 条短句，AI 增强时生成） */
  keyFacts?: string[]
  /** 展示用来源名：原始发布方；无法可靠识别时为“综合来源” */
  sourceDisplayName?: string
  /** 置信依据，如“官方发布 / 多来源验证 / 单一来源” */
  confidenceReason?: string
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

/* ---------- Arena 官方榜单 ---------- */

/** 六个能力维度（对应 Arena 榜单 config） */
export type ArenaDim = 'text' | 'agent' | 'webdev' | 'vision' | 'document' | 'search'

export const ARENA_DIMS: ArenaDim[] = ['text', 'agent', 'webdev', 'vision', 'document', 'search']

export const ARENA_DIM_LABEL: Record<ArenaDim, string> = {
  text: '综合文本',
  agent: 'Agent 执行',
  webdev: 'WebDev/编码',
  vision: '视觉理解',
  document: '文档理解',
  search: '搜索研究',
}

/** Arena config -> 本站维度 */
export const ARENA_CONFIG_TO_DIM: Record<string, ArenaDim> = {
  text_style_control: 'text',
  agent: 'agent',
  webdev: 'webdev',
  vision_style_control: 'vision',
  document_style_control: 'document',
  search_style_control: 'search',
}

export interface ArenaModelEntry {
  /** 模型名（Arena 官方数据中的 model_name） */
  name: string
  organization: string
  rank: number
  /** Arena 原始评分（Elo 体系，不同榜单量纲不同，不可跨榜平均） */
  score: number
  /** 95% 置信区间下/上限 */
  ciLower: number
  ciUpper: number
  voteCount: number
}

export interface ArenaBoardData {
  /** Arena config 名，如 text_style_control */
  config: string
  dim: ArenaDim
  label: string
  /** Arena 官方榜单发布日期 */
  publishDate: string
  models: ArenaModelEntry[]
}

export interface ArenaFile {
  /** 本文件生成/抓取时间 ISO */
  updatedAt: string
  /** ok=本次抓取成功；cache=抓取失败，使用缓存数据 */
  status: 'ok' | 'cache'
  statusNote?: string
  sourceUrl: string
  boards: ArenaBoardData[]
}
