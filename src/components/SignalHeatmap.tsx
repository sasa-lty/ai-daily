import { useMemo } from 'react'
import type * as echarts from 'echarts'
import type { NewsItem } from '../lib/types'
import { ALL_CATEGORIES, SIGNAL_LEVELS, signalLevelOf } from '../lib/types'
import EChart from './EChart'
import SectionTitle from './SectionTitle'

interface Cell {
  count: number
  maxImpact: number
}

export default function SignalHeatmap({ items }: { items: NewsItem[] }) {
  const { option, hasData } = useMemo(() => {
    // 矩阵：主题方向（分类） x 信号等级
    const matrix: Cell[][] = ALL_CATEGORIES.map(() =>
      SIGNAL_LEVELS.map(() => ({ count: 0, maxImpact: 0 }))
    )
    for (const item of items) {
      const x = ALL_CATEGORIES.indexOf(item.category)
      const y = SIGNAL_LEVELS.indexOf(signalLevelOf(item.impactScore))
      if (x < 0 || y < 0) continue
      matrix[x][y].count += 1
      matrix[x][y].maxImpact = Math.max(matrix[x][y].maxImpact, item.impactScore)
    }

    const data: Array<[number, number, number, number]> = []
    let maxCount = 0
    matrix.forEach((row, x) =>
      row.forEach((cell, y) => {
        data.push([x, y, cell.count, cell.maxImpact])
        maxCount = Math.max(maxCount, cell.count)
      })
    )

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { left: 8, right: 16, top: 8, bottom: 52, containLabel: true },
      xAxis: {
        type: 'category',
        data: ALL_CATEGORIES,
        axisLabel: { color: '#a1a1aa', fontSize: 11, interval: 0 },
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: SIGNAL_LEVELS,
        axisLabel: { color: '#a1a1aa', fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      visualMap: {
        min: 0,
        max: Math.max(maxCount, 1),
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 12,
        itemHeight: 80,
        textStyle: { color: '#71717a', fontSize: 10 },
        inRange: { color: ['#1c2330', '#6b5318', '#fbbf24'] },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: true,
            color: '#d4d4d8',
            fontSize: 10,
            formatter: (p) => {
              const v = p.value as [number, number, number, number]
              return v[2] > 0 ? `${v[2]}条 · 最高${v[3]}分` : ''
            },
          },
          itemStyle: { borderColor: '#0b0e13', borderWidth: 3, borderRadius: 4 },
          emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(251,191,36,0.4)' } },
        },
      ],
      tooltip: {
        formatter: (p) => {
          const v = (p as unknown as { value: [number, number, number, number] }).value
          return `${ALL_CATEGORIES[v[0]]} · ${SIGNAL_LEVELS[v[1]]}<br/>条目数量：${v[2]}<br/>最高影响分：${v[3] || '-'}`
        },
      },
    }
    return { option, hasData: items.length > 0 }
  }, [items])

  return (
    <section>
      <SectionTitle
        index="05"
        title="热点梯度图"
        extra="主题方向 × 信号等级 · 格子为条目数与最高影响分"
      />
      <div className="rounded-lg border border-zinc-800 bg-[#10141b] p-2">
        {hasData ? (
          <EChart option={option} height={280} />
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-zinc-500">
            今日暂无数据
          </div>
        )}
      </div>
    </section>
  )
}
