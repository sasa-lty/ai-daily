import { useMemo, useState } from 'react'
import type { Category, NewsItem } from '../lib/types'
import { CATEGORY_COLOR, formatDateTime } from '../lib/ui'
import SectionTitle from './SectionTitle'

type SortMode = 'score' | 'time'

export default function NewsList({ items }: { items: NewsItem[] }) {
  const [activeCategory, setActiveCategory] = useState<Category | '全部'>('全部')
  const [sortMode, setSortMode] = useState<SortMode>('score')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const categories = useMemo(() => {
    const set = new Set<Category>()
    items.forEach((it) => set.add(it.category))
    return Array.from(set)
  }, [items])

  const filtered = useMemo(() => {
    const list =
      activeCategory === '全部' ? items : items.filter((it) => it.category === activeCategory)
    return [...list].sort((a, b) =>
      sortMode === 'score'
        ? b.impactScore - a.impactScore
        : b.publishedAt.localeCompare(a.publishedAt)
    )
  }, [items, activeCategory, sortMode])

  return (
    <section>
      <SectionTitle
        index="03"
        title="热点列表"
        extra={`${filtered.length} 条 · 支持分类筛选与排序`}
      />

      {/* 筛选与排序 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(['全部', ...categories] as const).map((cat) => {
            const active = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as Category | '全部')}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
        <div className="flex gap-1.5 text-xs">
          {(
            [
              ['score', '按重要度'],
              ['time', '按时间'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`rounded-md border px-2.5 py-1 transition-colors ${
                sortMode === mode
                  ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-[#10141b] p-4 text-sm text-zinc-500">
          该分类下暂无条目，切换其他分类看看。
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          {filtered.map((item, idx) => {
            const expanded = expandedId === item.id
            return (
              <article
                key={item.id}
                className={`bg-[#10141b] p-3.5 ${idx > 0 ? 'border-t border-zinc-800/70' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLOR[item.category] }}
                      />
                      <span className="text-[11px] text-zinc-500">{item.category}</span>
                      {item.isSample && (
                        <span className="rounded border border-amber-400/40 px-1 py-px text-[10px] uppercase text-amber-300">
                          sample
                        </span>
                      )}
                      {item.aiEnhanced && (
                        <span className="rounded border border-emerald-400/40 px-1 py-px text-[10px] text-emerald-300">
                          AI 摘要
                        </span>
                      )}
                    </div>
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-sm font-medium leading-6 text-zinc-100 hover:text-amber-300"
                    >
                      {item.title}
                    </a>
                    <p className="mt-1 text-[13px] leading-6 text-zinc-400">{item.summary}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-base text-amber-300">{item.impactScore}</p>
                    <p className="text-[10px] text-zinc-600">影响分</p>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-2.5 rounded-md border border-zinc-800 bg-[#0b0e13] p-3">
                    <p className="text-[11px] text-zinc-500">为什么重要</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-zinc-300">
                      {item.whyItMatters}
                    </p>
                    {item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-amber-300/90 hover:text-amber-300"
                    >
                      阅读原文（{item.sourceName}）→
                    </a>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>
                    {item.sourceName} · {formatDateTime(item.publishedAt)}
                  </span>
                  <button
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    {expanded ? '收起 ↑' : '详情 ↓'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
