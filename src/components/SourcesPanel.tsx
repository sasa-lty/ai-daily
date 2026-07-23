import type { DailyData } from '../lib/types'
import SectionTitle from './SectionTitle'

export default function SourcesPanel({ data }: { data: DailyData }) {
  const hasSample = data.items.some((it) => it.isSample)
  return (
    <section>
      <SectionTitle index="04" title="新闻来源" extra={`${data.sources.length} 个`} />
      <div className="rounded-lg border border-zinc-800 bg-[#10141b] p-4">
        <ul className="space-y-2.5">
          {data.sources.map((s) => (
            <li key={s.name} className="flex items-start justify-between gap-2 text-[13px]">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-2 text-zinc-300 hover:text-amber-300"
              >
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${s.ok ? 'bg-emerald-400' : 'bg-red-400'}`}
                />
                <span className="truncate">{s.name}</span>
              </a>
              <span className="shrink-0 text-right text-[11px] leading-5 text-zinc-500">
                {s.ok ? `${s.itemCount} 条` : '失败'}
                {s.note ? <span className="block text-zinc-600">{s.note}</span> : null}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1.5 border-t border-zinc-800/70 pt-3 text-[11px] leading-5 text-zinc-500">
          <p>
            日报型来源会被拆解为单条新闻，仅作编辑参考；所有条目均链接到原始发布方，
            无法可靠识别原始出处时标注「综合来源」。
          </p>
          {hasSample && (
            <p className="text-amber-300/80">
              当前包含标注为 sample 的示例条目，成功抓取后会自动替换为真实新闻。
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
