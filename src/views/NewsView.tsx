import type { DailyData } from '../lib/types'
import DailySummary from '../components/DailySummary'
import TopStories from '../components/TopStories'
import NewsList from '../components/NewsList'
import SourcesPanel from '../components/SourcesPanel'

/** 今日热点视图：今日总览 / 今日三件事 / 热点列表 / 新闻来源 */
export default function NewsView({ data }: { data: DailyData }) {
  const topIdSet = new Set(data.topStoryIds)
  const topStories = data.topStoryIds
    .map((id) => data.items.find((it) => it.id === id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it))
  const listItems = data.items.filter((it) => !topIdSet.has(it.id))

  return (
    <div className="space-y-4">
      {/* 第一屏：今日三件事（主区） + 今日总览（侧栏） */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <aside className="lg:order-2">
          <DailySummary overview={data.overview} />
        </aside>
        <div className="lg:order-1 lg:col-span-2">
          <TopStories stories={topStories} />
        </div>
      </div>

      {/* 第二屏：热点列表（主区） + 新闻来源（侧栏） */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NewsList items={listItems} />
        </div>
        <aside>
          <SourcesPanel data={data} />
        </aside>
      </div>
    </div>
  )
}
