import { useMemo, useState } from 'react'
import type { ArenaFile } from '../lib/types'
import { buildProfiles, rankByPreset, WEIGHT_PRESETS } from '../lib/arena'
import { formatDateTime } from '../lib/ui'
import SectionTitle from '../components/SectionTitle'
import BoardRankChart from '../components/BoardRankChart'
import CompositePanel from '../components/CompositePanel'
import ModelProfileCard from '../components/ModelProfileCard'
import arenaJson from '../data/arena-leaderboard.json'

const arena = arenaJson as unknown as ArenaFile

/** 模型洞察视图：最新榜单 / 维度排名 / 综合比较 / 模型画像 / 数据来源 */
export default function ModelsView() {
  const [presetId, setPresetId] = useState('comprehensive')
  const preset = WEIGHT_PRESETS.find((p) => p.id === presetId) ?? WEIGHT_PRESETS[0]

  const profiles = useMemo(() => buildProfiles(arena), [])
  const topByPreset = useMemo(() => rankByPreset(profiles, preset), [profiles, preset])

  const latestPublishDate = useMemo(
    () => arena.boards.map((b) => b.publishDate).sort().at(-1) ?? '未知',
    []
  )
  const hasBoards = arena.boards.length > 0

  return (
    <div className="space-y-6">
      {/* 数据状态条 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-zinc-800 bg-[#10141b] px-4 py-2.5 text-[11px] text-zinc-400">
        <span className="font-medium text-zinc-200">LMArena 官方数据</span>
        <span>榜单发布日期：{latestPublishDate}</span>
        <span>抓取时间：{formatDateTime(arena.updatedAt)}</span>
        {arena.status === 'cache' && (
          <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-amber-300">
            使用缓存数据
          </span>
        )}
        <a
          href={arena.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-amber-300/90 hover:text-amber-300"
        >
          数据源 →
        </a>
      </div>

      {!hasBoards ? (
        <p className="rounded-lg border border-zinc-800 bg-[#10141b] p-6 text-sm text-zinc-500">
          榜单数据暂不可用（首次抓取失败且无缓存）。明天 08:30 自动重试，或手动 Run workflow。
        </p>
      ) : (
        <>
          {/* 维度排名：六张独立横向排名图 */}
          <section>
            <SectionTitle
              index="01"
              title="分维度排名"
              extra="各榜 Top 10 · 原始分数与置信区间见悬浮提示"
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {arena.boards.map((board) => (
                <BoardRankChart key={board.config} board={board} />
              ))}
            </div>
          </section>

          {/* 综合比较：权重预设 + 散点 + 综合指数排名 */}
          <section>
            <SectionTitle
              index="02"
              title="综合比较"
              extra="先转百分位再加权，不平均原始分"
            />
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] text-zinc-500">权重预设</span>
              {WEIGHT_PRESETS.map((p) => {
                const active = p.id === presetId
                return (
                  <button
                    key={p.id}
                    onClick={() => setPresetId(p.id)}
                    title={p.note}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      active
                        ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
              <span className="ml-1 text-[11px] text-zinc-500">{preset.note}</span>
            </div>
            <CompositePanel profiles={profiles} preset={preset} />
          </section>

          {/* 模型画像：每模型一张独立迷你雷达 */}
          <section>
            <SectionTitle
              index="03"
              title="模型画像"
              extra={`当前预设（${preset.label}）下综合指数前 ${Math.min(6, topByPreset.length)} 名 · 单模型多边形`}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topByPreset.slice(0, 6).map((r) => (
                <ModelProfileCard key={r.profile.key} profile={r.profile} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
