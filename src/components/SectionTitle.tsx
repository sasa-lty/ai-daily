import type { ReactNode } from 'react'

export default function SectionTitle({
  index,
  title,
  extra,
}: {
  index: string
  title: string
  extra?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <span className="font-mono text-xs font-normal text-amber-400/80">{index}</span>
        <span className="h-3.5 w-0.5 bg-amber-400/70" aria-hidden="true" />
        {title}
      </h2>
      {extra ? <div className="text-xs text-zinc-500">{extra}</div> : null}
    </div>
  )
}
