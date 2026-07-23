import { useMemo } from 'react'
import type * as echarts from 'echarts'
import type { ArenaBoardData } from '../lib/types'
import { formatVotes, shortenName } from '../lib/ui'
import EChart from './EChart'

/**
 * 单维度横向排名图：展示该榜单前 10 名。
 * 每条显示排名、模型、机构、原始分数；tooltip 含置信区间与票数。
 */
export default function BoardRankChart({ board }: { board: ArenaBoardData }) {
  const option = useMemo<echarts.EChartsOption>(() => {
    const models = board.models
    const isDecimal = models.some((m) => m.score < 10)
    const fmt = (v: number) => (isDecimal ? v.toFixed(3) : String(Math.round(v)))

    return {
      backgroundColor: 'transparent',
      grid: { left: 4, right: 52, top: 6, bottom: 6, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { show: false },
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        // 最小值贴近数据，让差距可见（Elo 榜单分差小）
        min: (v) => (isDecimal ? 0 : Math.floor(v.min * 0.96)),
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: models.map((m) => `${m.rank}. ${shortenName(m.name, 26)}`),
        axisLabel: { color: '#d4d4d8', fontSize: 11, margin: 8 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: models.map((m) => ({
            value: m.score,
            itemStyle: {
              color: m.rank <= 3 ? '#fbbf24' : '#3b4658',
              borderRadius: [0, 3, 3, 0],
            },
          })),
          barWidth: 12,
          label: {
            show: true,
            position: 'right',
            color: '#a1a1aa',
            fontSize: 10,
            fontFamily: 'ui-monospace, monospace',
            formatter: (p) => fmt(p.value as number),
          },
        },
      ],
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const m = models[(p as unknown as { dataIndex: number }).dataIndex]
          return [
            `<b>${m.name}</b>`,
            `机构：${m.organization}`,
            `排名：#${m.rank}　分数：${fmt(m.score)}`,
            `95% 置信区间：[${fmt(m.ciLower)}, ${fmt(m.ciUpper)}]`,
            `票数：${formatVotes(m.voteCount)}`,
            `数据日期：${board.publishDate}`,
          ].join('<br/>')
        },
      },
    }
  }, [board])

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#10141b] p-3">
      <div className="mb-1 flex items-baseline justify-between px-1">
        <h3 className="text-[13px] font-medium text-zinc-200">{board.label}</h3>
        <span className="text-[11px] text-zinc-500">数据日期 {board.publishDate}</span>
      </div>
      <EChart option={option} height={282} />
    </div>
  )
}
