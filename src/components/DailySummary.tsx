import type { DailyOverview } from '../lib/types'
import SectionTitle from './SectionTitle'

export default function DailySummary({ overview }: { overview: DailyOverview }) {
  return (
    <section>
      <SectionTitle index="01" title="今日总览" />
      <div className="rounded-lg border border-zinc-800 bg-[#10141b] p-4">
        <p className="text-sm leading-6 text-zinc-200">{overview.verdict}</p>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-zinc-800/70 pt-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-zinc-500">今日关键词</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {overview.keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-xs text-zinc-300"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500">今日热度指数</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-amber-400 transition-[width] duration-500"
                  style={{ width: `${overview.heatIndex}%` }}
                />
              </div>
              <span className="font-mono text-sm text-amber-300">{overview.heatIndex}</span>
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500">数据来源</p>
            <p className="mt-1.5 text-sm text-zinc-300">
              <span className="font-mono text-amber-300">{overview.sourceCount}</span> 个来源可用
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
