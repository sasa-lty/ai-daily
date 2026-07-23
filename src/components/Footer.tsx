import type { DailyData } from '../lib/types'
import { formatDateTime } from '../lib/ui'

export default function Footer({ data }: { data: DailyData }) {
  return (
    <footer className="border-t border-zinc-800/70">
      <div className="mx-auto max-w-6xl space-y-1.5 px-4 py-5 text-[11px] leading-5 text-zinc-500">
        <p>
          新闻数据生成于 {formatDateTime(data.generatedAt)}（北京时间）。每日 08:30 由 GitHub Actions
          自动更新新闻与 Arena 榜单；更新失败时保留上一次成功的数据，页面不会空白。
        </p>
        <p>
          手动更新：GitHub 仓库 → Actions → Daily Update → Run workflow。AI 增强为可选项，配置
          KIMI_API_KEY 或 OPENAI_API_KEY 后自动启用。
        </p>
        <p>
          榜单数据：LMArena 官方数据集 lmarena-ai/leaderboard-dataset（Hugging Face）。
          「本站综合指数」为本站按公开权重对各维度百分位加权的结果，并非 Arena 官方总分。
        </p>
        <p className="pt-1 text-zinc-600">
          AI Daily Radar · 个人情报台 · 静态页面，无服务器、无登录、无追踪
        </p>
      </div>
    </footer>
  )
}
