import { useMemo } from 'react'
import type * as echarts from 'echarts'
import type { ModelProfile, RankedModel, WeightPreset } from '../lib/arena'
import { compositeIndex, rankByPreset } from '../lib/arena'
import { ARENA_DIM_LABEL } from '../lib/types'
import { formatVotes, orgColor, shortenName } from '../lib/ui'
import EChart from './EChart'

interface CompositePanelProps {
  profiles: ModelProfile[]
  preset: WeightPreset
}

/**
 * 综合比较：二维散点（X=跨维度综合能力，Y=Agent 执行能力）+ 本站综合指数排名。
 * 散点颜色=机构，大小=投票量。
 */
export default function CompositePanel({ profiles, preset }: CompositePanelProps) {
  const ranked = useMemo(() => rankByPreset(profiles, preset), [profiles, preset])

  const scatterOption = useMemo<echarts.EChartsOption>(() => {
    // X 轴固定使用六维等权综合能力（与当前预设无关，保证坐标含义稳定）
    const points: Array<{
      value: [number, number, number]
      name: string
      org: string
      itemStyle: { color: string; opacity: number }
    }> = []
    for (const p of profiles) {
      const x = compositeIndex(p, {
        text: 1,
        agent: 1,
        webdev: 1,
        vision: 1,
        document: 1,
        search: 1,
      })
      const y = p.dims.agent?.percentile
      if (x === null || y === undefined) continue
      const size = Math.max(8, Math.min(38, 6 + (Math.log10(Math.max(p.totalVotes, 10)) - 3) * 9))
      points.push({
        value: [x, y, size],
        name: p.name,
        org: p.organization,
        itemStyle: { color: orgColor(p.organization), opacity: 0.85 },
      })
    }
    return {
      backgroundColor: 'transparent',
      grid: { left: 8, right: 16, top: 26, bottom: 8, containLabel: true },
      xAxis: {
        name: '综合能力（百分位）',
        nameLocation: 'middle',
        nameGap: 26,
        nameTextStyle: { color: '#71717a', fontSize: 11 },
        min: 0,
        max: 100,
        axisLabel: { color: '#71717a', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1f2632' } },
        axisLine: { show: false },
      },
      yAxis: {
        name: 'Agent 执行（百分位）',
        nameLocation: 'middle',
        nameGap: 34,
        nameTextStyle: { color: '#71717a', fontSize: 11 },
        min: 0,
        max: 100,
        axisLabel: { color: '#71717a', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1f2632' } },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'scatter',
          data: points,
          symbolSize: (v: [number, number, number]) => v[2],
          label: {
            show: true,
            position: 'top',
            color: '#a1a1aa',
            fontSize: 9,
            formatter: (p) => shortenName((p as unknown as { name: string }).name, 14),
          },
          emphasis: { scale: 1.3 },
        },
      ],
      tooltip: {
        formatter: (p) => {
          const d = p as unknown as { name: string; org: string; value: [number, number, number] }
          return [
            `<b>${d.name}</b>`,
            `机构：${d.org}`,
            `综合能力：${d.value[0]}`,
            `Agent 执行：${d.value[1]}`,
          ].join('<br/>')
        },
      },
    }
  }, [profiles])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {/* 二维散点 */}
      <div className="rounded-lg border border-zinc-800 bg-[#10141b] p-3 lg:col-span-3">
        <div className="mb-1 flex items-baseline justify-between px-1">
          <h3 className="text-[13px] font-medium text-zinc-200">能力定位散点</h3>
          <span className="text-[11px] text-zinc-500">点大小 = 投票量 · 颜色 = 机构</span>
        </div>
        <EChart option={scatterOption} height={340} />
      </div>

      {/* 本站综合指数排名 */}
      <div className="rounded-lg border border-zinc-800 bg-[#10141b] p-3 lg:col-span-2">
        <div className="mb-2 px-1">
          <h3 className="text-[13px] font-medium text-zinc-200">
            综合排名 <span className="text-zinc-500">（{preset.label}）</span>
          </h3>
          <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
            本站综合指数（非 Arena 官方总分）＝ 各维度百分位加权 · 权重：{preset.note} ·
            覆盖不足 3 个维度的模型不列入
          </p>
        </div>
        <ol className="divide-y divide-zinc-800/70">
          {ranked.slice(0, 10).map((r: RankedModel, i: number) => (
            <li key={r.profile.key} className="flex items-center gap-2 px-1 py-1.5">
              <span className="w-5 shrink-0 font-mono text-[11px] text-zinc-500">{i + 1}.</span>
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: orgColor(r.profile.organization) }}
              />
              <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-200" title={r.profile.name}>
                {r.profile.name}
              </span>
              <span className="shrink-0 text-[10px] text-zinc-500">
                {r.profile.dimCount}维 · {formatVotes(r.profile.totalVotes)}票
              </span>
              <span className="w-10 shrink-0 text-right font-mono text-[12px] text-amber-300">
                {r.index.toFixed(1)}
              </span>
            </li>
          ))}
        </ol>
        {ranked.length === 0 && (
          <p className="px-1 py-4 text-[12px] text-zinc-500">数据不足，暂无综合排名。</p>
        )}
        <p className="mt-2 px-1 text-[10px] leading-4 text-zinc-600">
          维度：{Object.values(ARENA_DIM_LABEL).join(' / ')}
        </p>
      </div>
    </div>
  )
}
