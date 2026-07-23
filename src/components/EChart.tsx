import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface EChartProps {
  option: echarts.EChartsOption
  /** 固定高度（px），保证加载时图表区域不跳动 */
  height: number
  className?: string
}

export default function EChart({ option, height, className }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true })
  }, [option])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: '100%' }}
      aria-hidden="true"
    />
  )
}
