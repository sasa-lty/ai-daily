import type { DailyData } from '../lib/types'
import { formatDateTime } from '../lib/ui'
import SectionTitle from './SectionTitle'

export default function Footer({ data }: { data: DailyData }) {
  const hasSample = data.items.some((it) => it.isSample)
  return (
    <section>
      <SectionTitle index="06" title="数据来源与说明" />
      <div className="rounded-lg border border-zinc-800 bg-[#10141b] p-4">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.sources.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-2 text-[13px]">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-2 text-zinc-300 hover:text-amber-300"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.ok ? 'bg-emerald-400' : 'bg-red-400'}`}
                />
                <span className="truncate">{s.name}</span>
              </a>
              <span className="shrink-0 text-[11px] text-zinc-500">
                {s.ok ? `${s.itemCount} 条` : `失败${s.note ? `：${s.note}` : ''}`}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-1.5 border-t border-zinc-800/70 pt-3 text-[11px] leading-5 text-zinc-500">
          <p>
            数据生成于 {formatDateTime(data.generatedAt)}（北京时间）。每日 08:30 由 GitHub Actions
            自动更新；更新失败时页面保留上一次成功的数据，不会空白。
          </p>
          {hasSample && (
            <p className="text-amber-300/80">
              当前包含标注为 sample 的示例条目，仅用于占位展示，成功抓取后会自动替换为真实新闻。
            </p>
          )}
          <p>
            真实新闻均附原文链接。文字风格学习自橘鸦 Juya（信息密度高、出处清晰），未复制其原文；
            雷达图表达方式参考图灵坐标/浪浪妈（结论先行、指出长短板），评分数据未取自其视频。
          </p>
          <p>
            手动更新：GitHub 仓库 → Actions → Daily Update → Run workflow。AI
            增强为可选项，配置 KIMI_API_KEY 或 OPENAI_API_KEY 后自动启用。
          </p>
        </div>
      </div>

      <p className="py-6 text-center text-[11px] text-zinc-600">
        AI Daily Radar · 个人情报台 · 静态页面，无服务器、无登录、无追踪
      </p>
    </section>
  )
}
