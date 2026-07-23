import type { DailyData } from './lib/types'
import Header from './components/Header'
import DailySummary from './components/DailySummary'
import TopStories from './components/TopStories'
import NewsList from './components/NewsList'
import ModelRadar from './components/ModelRadar'
import SignalHeatmap from './components/SignalHeatmap'
import Footer from './components/Footer'
import dailyJson from './data/daily.json'

const daily = dailyJson as unknown as DailyData

export default function App() {
  const topIdSet = new Set(daily.topStoryIds)
  const topStories = daily.topStoryIds
    .map((id) => daily.items.find((it) => it.id === id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it))
  const listItems = daily.items.filter((it) => !topIdSet.has(it.id))

  return (
    <div className="min-h-screen">
      <Header data={daily} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <DailySummary overview={daily.overview} />
        <TopStories stories={topStories} />
        <NewsList items={listItems} />
        <ModelRadar />
        <SignalHeatmap items={daily.items} />
        <Footer data={daily} />
      </main>
    </div>
  )
}
