import { useMemo } from 'react'
import type * as echarts from 'echarts'
import type { ModelProfile } from '../lib/arena'
import { ARENA_DIMS, ARENA_DIM_LABEL } from '../lib/types'
import { orgColor } from '../lib/ui'
import EChart from './EChart'

/**
 * 模型画像：每个模型一张独立迷你雷达图（单多边形，六个维度百分位）。
 * 缺失维度按 0 处理并在下方注明覆盖维度数。
 */
export default function ModelProfileCard({ profile }: { profile: ModelProfile }) {
  const option = useMemo<echarts.EChartsOption>(() => {
    const values = ARENA_DIMS.map((d) => profile.dims[d]?.percentile ?? 0)
    const color = orgColor(profile.organization)
    return {
      backgroundColor: 'transparent',
      radar: {
        indicator: ARENA_DIMS.map((d) => ({ name: ARENA_DIM_LABEL[d], max: 100 })),
        radius: '62%',
        center: ['50%', '54%'],
        axisName: { color: '#71717a', fontSize: 9 },
        splitLine: { lineStyle: { color: '#232b3a' } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: '#232b3a' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: values,
              name: profile.name,
              lineStyle: { color, width: 1.5 },
              itemStyle: { color },
              areaStyle: { color, opacity: 0.18 },
              symbolSize: 2,
            },
          ],
        },
      ],
    }
  }, [profile])

  const rankText = ARENA_DIMS.map((d) => {
    const stat = profile.dims[d]
    return stat ? `${ARENA_DIM_LABEL[d]} #${stat.rank}` : null
  }).filter(Boolean) as string[]

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#10141b] p-3">
      <div className="flex items-center gap-2 px-1">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: orgColor(profile.organization) }}
        />
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-100" title={profile.name}>
          {profile.name}
        </h3>
        <span className="shrink-0 text-[11px] text-zinc-500">{profile.organization}</span>
      </div>
      <EChart option={option} height={190} />
      <p className="px-1 text-[10px] leading-4 text-zinc-500">
        覆盖 {profile.dimCount}/6 维 · {rankText.slice(0, 3).join(' · ')}
        {rankText.length > 3 ? ' 等' : ''}
      </p>
    </div>
  )
}
