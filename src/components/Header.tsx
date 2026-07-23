import type { DailyData } from '../lib/types'
import { DATA_STATUS_LABEL } from '../lib/types'
import { STATUS_STYLE, formatTime } from '../lib/ui'

export default function Header({ data }: { data: DailyData }) {
  const status = STATUS_STYLE[data.status] ?? STATUS_STYLE.rule
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-[#0b0e13]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
          </span>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
              AI Daily Radar
              <span className="ml-2 font-normal text-zinc-500">个人 AI 情报台</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="hidden sm:inline">
            {data.date} · {formatTime(data.generatedAt)} 更新
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium ${status.badge}`}
            title={data.statusNote}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {DATA_STATUS_LABEL[data.status]}
          </span>
        </div>
      </div>
      <div className="border-t border-zinc-800/60 bg-[#10141b]">
        <p className="mx-auto max-w-6xl px-4 py-1.5 text-[11px] leading-5 text-zinc-500">
          每日北京时间 08:30 自动更新。若未更新：GitHub 仓库 → Actions → Daily Update → Run workflow。
          {data.statusNote ? ` 当前说明：${data.statusNote}` : ''}
        </p>
      </div>
    </header>
  )
}
