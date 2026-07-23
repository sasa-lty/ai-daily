import type { NewsItem } from '../lib/types'
import { CATEGORY_COLOR, CONFIDENCE_LABEL, formatDateTime } from '../lib/ui'
import SectionTitle from './SectionTitle'

export default function TopStories({ stories }: { stories: NewsItem[] }) {
  if (stories.length === 0) return null
  return (
    <section>
      <SectionTitle
        index="02"
        title="今日三件事"
        extra={stories.length < 3 ? '今日可靠的重要新闻不足三条' : '综合影响、新鲜度与可靠性选出'}
      />
      <div className="rounded-lg border border-zinc-800 bg-[#10141b]">
        {stories.map((item, idx) => (
          <article
            key={item.id}
            className={`p-4 ${idx > 0 ? 'border-t border-zinc-800/70' : ''}`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 font-mono text-xl font-semibold leading-6 text-zinc-700">
                0{idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-300"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLOR[item.category] }}
                    />
                    {item.category}
                  </span>
                  {item.isSample && (
                    <span className="rounded border border-amber-400/40 px-1.5 py-0.5 text-[10px] uppercase text-amber-300">
                      sample
                    </span>
                  )}
                  <span className="ml-auto font-mono text-xs text-amber-300">
                    影响 {item.impactScore}
                  </span>
                </div>

                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 block text-[15px] font-medium leading-6 text-zinc-100 hover:text-amber-300"
                >
                  {item.title}
                </a>

                {/* 发生了什么（规则模式下摘要可能与标题相同，避免重复展示） */}
                {item.summary !== item.title && (
                  <p className="mt-1.5 text-[13px] leading-6 text-zinc-300">{item.summary}</p>
                )}

                {/* 关键事实 */}
                {item.keyFacts && item.keyFacts.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {item.keyFacts.map((fact, i) => (
                      <li key={i} className="flex gap-1.5 text-[12px] leading-5 text-zinc-400">
                        <span className="text-amber-400/80">▸</span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* 为什么重要 */}
                <div className="mt-2.5 border-l-2 border-amber-400/60 pl-2.5">
                  <p className="text-[11px] text-zinc-500">为什么重要</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-zinc-300">{item.whyItMatters}</p>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                  <span>{item.sourceDisplayName ?? item.sourceName}</span>
                  <span>{formatDateTime(item.publishedAt)}</span>
                  <span>{item.confidenceReason ?? CONFIDENCE_LABEL[item.confidence]}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
