import { useMemo } from 'react'
import type * as echarts from 'echarts'
import type { ArenaPriors, ModelProfile, RadarBounds } from '../lib/arena'
import { computeRadarBounds, SCORE_FLOOR } from '../lib/arena'
import { ARENA_DIMS, ARENA_DIM_LABEL } from '../lib/types'
import { orgColor } from '../lib/ui'
import EChart from './EChart'

interface ModelProfileCardProps {
  profile: ModelProfile
  priors: ArenaPriors
  /** 全量模型列表，用于计算雷达轴边界（p75 自动超界设计）。可选：不传时退回固定轴 */
  profiles?: ModelProfile[]
  /** 预计算的轴边界，优先级高于 profiles */
  radarBounds?: RadarBounds
}

/**
 * 模型画像：每个模型一张迷你雷达图，两条线区分实测与估算。
 * - 实线 + 实心点：该维度上榜，值为 σ 标定得分；未上榜的轴用估算值占位以保持多边形闭合。
 * - 虚线 + 极淡填充：缺失维度用该维度池内中位数补齐，说明「不知道」而不是「等于 0」。
 */
export default function ModelProfileCard({ profile, priors, profiles, radarBounds: radarBoundsProp }: ModelProfileCardProps) {
  const missingCount = 6 - profile.dimCount

  // 优先用外部传入的边界；否则从 profiles 计算；最后退回固定轴 [SCORE_FLOOR, 90]
  const bounds: RadarBounds = useMemo(() => {
    if (radarBoundsProp) return radarBoundsProp
    if (profiles && profiles.length > 0) return computeRadarBounds(profiles)
    return { byDim: Object.fromEntries(ARENA_DIMS.map((d) => [d, { min: SCORE_FLOOR, max: 90 }])) as RadarBounds['byDim'] }
  }, [radarBoundsProp, profiles])

  const option = useMemo<echarts.EChartsOption>(() => {
    const color = orgColor(profile.organization)
    // 估算系列：六轴全填，缺失维度取该维度先验
    const estimated = ARENA_DIMS.map(
      (d) => profile.dims[d]?.dimScore ?? priors.byDim[d] ?? 0
    )
    return {
      backgroundColor: 'transparent',
      radar: {
        // max = p75 全量模型得分：顶级模型在强项上自然超界，均衡模型各轴比例仍均衡
        // min = SCORE_FLOOR：避免弱模型缩成一个点（坐标轴从得分下限起算）
        indicator: ARENA_DIMS.map((d) => ({
          name: ARENA_DIM_LABEL[d],
          max: bounds.byDim[d]?.max ?? 90,
          min: bounds.byDim[d]?.min ?? SCORE_FLOOR,
        })),
        radius: '62%',
        center: ['50%', '54%'],
        axisName: { color: '#71717a', fontSize: 9 },
        splitLine: { lineStyle: { color: '#232b3a' } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: '#232b3a' } },
      },
      tooltip: {
        trigger: 'item',
        formatter: () =>
          [
            `<b>${profile.name}</b>`,
            ...ARENA_DIMS.map((d) => {
              const stat = profile.dims[d]
              return stat
                ? `${ARENA_DIM_LABEL[d]}：${stat.dimScore}（#${stat.rank}，落后榜首 ${stat.gapSigma}σ）`
                : `${ARENA_DIM_LABEL[d]}：${priors.byDim[d] ?? '—'} <span style="color:#a1a1aa">估算（未上榜）</span>`
            }),
          ].join('<br/>'),
      },
      series: [
        {
          type: 'radar',
          silent: true,
          symbol: 'none',
          data: [
            {
              value: estimated,
              name: '含估算',
              lineStyle: { color, width: 1, type: 'dashed', opacity: 0.65 },
              areaStyle: { color, opacity: 0.06 },
            },
          ],
        },
        {
          type: 'radar',
          data: [
            {
              // 实测系列：缺失维度置 null，ECharts 会断开该点，只保留实测形状
              value: ARENA_DIMS.map((d) => profile.dims[d]?.dimScore ?? null),
              name: '实测',
              lineStyle: { color, width: 1.5 },
              itemStyle: { color },
              areaStyle: { color, opacity: 0.2 },
              symbol: 'circle',
              symbolSize: 4,
            },
          ],
        },
      ],
    }
  }, [profile, priors, bounds])

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
      <div className="flex items-center gap-2 px-1 text-[10px] leading-4 text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-0 w-3 border-t border-solid border-zinc-400" />
          实测
        </span>
        {missingCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="h-0 w-3 border-t border-dashed border-zinc-500" />
            估算 {missingCount} 维
          </span>
        )}
      </div>
      <p className="px-1 text-[10px] leading-4 text-zinc-500">
        覆盖 {profile.dimCount}/6 维 · {rankText.slice(0, 3).join(' · ')}
        {rankText.length > 3 ? ' 等' : ''}
      </p>
    </div>
  )
}
