import type { DailyOverview } from '../lib/types'
import SectionTitle from './SectionTitle'

export default function DailySummary({ overview }: { overview: DailyOverview }) {
  return (
    <section>
      <SectionTitle index="01" title="今日总览" />
      <div className="rounded-lg border border-zinc-800 bg-[#10141b] p-4">
        <p className="text-[13px] leading-6 text-zinc-200">{overview.verdict}</p>

        <div className="mt-3">
          <p className="text-[11px] text-zinc-500">关键词</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {overview.keywords.map((kw) => (
              <span
                key={kw}
                className="rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-300"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] text-zinc-500">今日热度指数</p>
            <p className="font-mono text-sm text-amber-300">{overview.heatIndex}</p>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full bg-amber-400/80"
              style={{ width: `${Math.min(100, Math.max(0, overview.heatIndex))}%` }}
            />
          </div>
        </div>

        <p className="mt-3 border-t border-zinc-800/70 pt-2 text-[11px] text-zinc-500">
          有效来源 {overview.sourceCount} 个
        </p>
      </div>
    </section>
  )
}
