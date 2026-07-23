import { useMemo } from 'react'
import type * as echarts from 'echarts'
import type { ModelScoresFile } from '../lib/types'
import EChart from './EChart'
import SectionTitle from './SectionTitle'
import modelScoresJson from '../data/model-scores.json'

const modelScores = modelScoresJson as unknown as ModelScoresFile

const MODEL_COLORS = ['#fbbf24', '#38bdf8', '#34d399', '#f472b6', '#a3e635']

export default function ModelRadar() {
  const { dimensions, models, overallDiagnosis, updatedAt } = modelScores

  const option = useMemo<echarts.EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      color: MODEL_COLORS,
      legend: {
        bottom: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 14,
        textStyle: { color: '#a1a1aa', fontSize: 11 },
      },
      radar: {
        indicator: dimensions.map((d) => ({ name: d, max: 100 })),
        radius: '62%',
        center: ['50%', '46%'],
        axisName: { color: '#a1a1aa', fontSize: 11 },
        splitLine: { lineStyle: { color: '#27272a' } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: '#3f3f46' } },
      },
      series: [
        {
          type: 'radar',
          symbolSize: 3,
          data: models.map((m) => ({
            name: m.name,
            value: m.scores,
            lineStyle: { width: 2 },
            areaStyle: { opacity: 0.06 },
          })),
        },
      ],
      tooltip: { trigger: 'item' },
    }),
    [dimensions, models]
  )

  return (
    <section>
      <SectionTitle
        index="04"
        title="模型雷达图"
        extra={`评分更新于 ${updatedAt} · 0-100 归一化`}
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* 图表区：固定高度，加载不跳动 */}
        <div className="rounded-lg border border-zinc-800 bg-[#10141b] p-2 lg:col-span-3">
          <EChart option={option} height={340} />
        </div>

        {/* 诊断区：结论先行 */}
        <div className="rounded-lg border border-zinc-800 bg-[#10141b] p-4 lg:col-span-2">
          <p className="text-[11px] text-zinc-500">一句话诊断</p>
          <p className="mt-1 border-l-2 border-amber-400/60 pl-2.5 text-[13px] leading-6 text-zinc-200">
            {overallDiagnosis}
          </p>

          <ul className="mt-4 space-y-3">
            {models.map((m, i) => (
              <li key={m.name} className="text-[13px] leading-5">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }}
                  />
                  <span className="font-medium text-zinc-100">{m.name}</span>
                  <span className="text-[11px] text-zinc-500">{m.vendor}</span>
                  {m.source === 'manual' ? (
                    <span className="rounded border border-amber-400/40 px-1 py-px text-[10px] text-amber-300">
                      人工评分 manual
                    </span>
                  ) : (
                    <span className="rounded border border-zinc-600 px-1 py-px text-[10px] text-zinc-400">
                      来源：{m.source}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 pl-4 text-zinc-400">{m.diagnosis}</p>
              </li>
            ))}
          </ul>

          <p className="mt-4 border-t border-zinc-800/70 pt-3 text-[11px] leading-5 text-zinc-600">
            分数来自 {updatedAt} 的人工整理（source: manual），用于快速对比长短板，不作为实时榜单结论。
            修改 src/data/model-scores.json 即可更新模型名单与分数。
          </p>
        </div>
      </div>
    </section>
  )
}
