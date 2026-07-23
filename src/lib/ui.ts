import type { Category, Confidence, DataStatus } from './types'

/** 分类配色（实心小圆点/标签，不使用渐变） */
export const CATEGORY_COLOR: Record<Category, string> = {
  模型: '#38bdf8',
  Agent: '#34d399',
  产品: '#fbbf24',
  开源: '#a3e635',
  研究: '#f472b6',
  算力: '#fb923c',
  商业: '#e879f9',
  安全: '#f87171',
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: '可信度 高',
  medium: '可信度 中',
  low: '可信度 低',
}

export const STATUS_STYLE: Record<DataStatus, { badge: string; dot: string }> = {
  ai: { badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', dot: 'bg-emerald-400' },
  rule: { badge: 'border-sky-400/30 bg-sky-400/10 text-sky-300', dot: 'bg-sky-400' },
  cache: { badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300', dot: 'bg-amber-400' },
  error: { badge: 'border-red-400/30 bg-red-400/10 text-red-300', dot: 'bg-red-400' },
}

/** 格式化为北京时间 HH:mm */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** 格式化为北京时间 MM-DD HH:mm */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const date = d.toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
  })
  return `${date} ${formatTime(iso)}`
}
