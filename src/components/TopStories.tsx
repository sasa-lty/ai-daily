import type { NewsItem } from '../lib/types'
import { CATEGORY_COLOR, CONFIDENCE_LABEL } from '../lib/ui'
import SectionTitle from './SectionTitle'

export default function TopStories({ stories }: { stories: NewsItem[] }) {
  if (stories.length === 0) return null
  return (
    <section>
      <SectionTitle index="02" title="今日三件事" extra="按影响分排序，最重要的 3 条" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {stories.map((item, idx) => (
          <article
            key={item.id}
            className="flex flex-col rounded-lg border border-zinc-800 bg-[#10141b] p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-semibold text-zinc-700">
                0{idx + 1}
              </span>
              <div className="flex items-center gap-2">
                {item.isSample && (
                  <span className="rounded border border-amber-400/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                    sample
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-300"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLOR[item.category] }}
                  />
                  {item.category}
                </span>
                <span className="font-mono text-sm text-amber-300">{item.impactScore}</span>
              </div>
            </div>

            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 text-sm font-medium leading-6 text-zinc-100 hover:text-amber-300"
            >
              {item.title}
            </a>

            <p className="mt-2 text-[13px] leading-6 text-zinc-400">{item.summary}</p>

            <div className="mt-3 border-l-2 border-amber-400/60 pl-2.5">
              <p className="text-[11px] text-zinc-500">为什么重要</p>
              <p className="mt-0.5 text-[13px] leading-5 text-zinc-300">{item.whyItMatters}</p>
            </div>

            <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-zinc-500">
              <span>{item.sourceName}</span>
              <span>{CONFIDENCE_LABEL[item.confidence]}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
