import type { DailyData } from '../lib/types'
import { DATA_STATUS_LABEL } from '../lib/types'
import type { Route } from '../lib/useHashRoute'
import { STATUS_STYLE, formatTime } from '../lib/ui'

const NAV_ITEMS: Array<{ route: Route; hash: string; label: string }> = [
  { route: 'news', hash: '#/news', label: '今日热点' },
  { route: 'models', hash: '#/models', label: '模型洞察' },
]

export default function Header({ data, route }: { data: DailyData; route: Route }) {
  const status = STATUS_STYLE[data.status] ?? STATUS_STYLE.rule
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-[#0b0e13]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <a href="#/news" className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
            </span>
            <span className="text-sm font-semibold tracking-wide text-zinc-100">
              AI Daily Radar
            </span>
          </a>

          {/* 一级视图导航（hash 路由） */}
          <nav className="flex items-center gap-1 rounded-md border border-zinc-800 bg-[#10141b] p-0.5">
            {NAV_ITEMS.map((item) => {
              const active = route === item.route
              return (
                <a
                  key={item.route}
                  href={item.hash}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? 'bg-amber-400/15 font-medium text-amber-300'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {item.label}
                </a>
              )
            })}
          </nav>
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
    </header>
  )
}
