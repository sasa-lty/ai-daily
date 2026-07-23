import type { DailyData } from './lib/types'
import { useHashRoute } from './lib/useHashRoute'
import Header from './components/Header'
import Footer from './components/Footer'
import NewsView from './views/NewsView'
import ModelsView from './views/ModelsView'
import dailyJson from './data/daily.json'

const daily = dailyJson as unknown as DailyData

export default function App() {
  const route = useHashRoute()

  return (
    <div className="flex min-h-screen flex-col">
      <Header data={daily} route={route} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
        {route === 'models' ? <ModelsView /> : <NewsView data={daily} />}
      </main>
      <Footer data={daily} />
    </div>
  )
}
