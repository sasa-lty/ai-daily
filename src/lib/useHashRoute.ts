import { useEffect, useState } from 'react'

export type Route = 'news' | 'models'

function currentRoute(): Route {
  return window.location.hash.replace(/^#\/?/, '').startsWith('models') ? 'models' : 'news'
}

/** 轻量 hash 路由：支持刷新、前进后退与收藏，无需引入 React Router */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(currentRoute)

  useEffect(() => {
    // 首次访问补一个明确的 hash，方便收藏与定位
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/news')
    }
    const onChange = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}
