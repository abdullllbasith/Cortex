'use client'

import { useId } from 'react'

export type SparklineTone = 'good' | 'bad' | 'neutral' | 'alert'

export interface MetricSparklineProps {
  data: number[]
  /** @deprecated Prefer `tone` — kept for callers that still pass positive/negative. */
  positive?: boolean
  /** Visual status: good (up), bad (down), neutral (flat), alert (warning). */
  tone?: SparklineTone
}

const TONE_COLORS: Record<
  SparklineTone,
  { stroke: string; fillFrom: string; fillTo: string }
> = {
  good: {
    stroke: 'rgb(16 185 129)', // emerald-500
    fillFrom: 'rgb(16 185 129 / 0.28)',
    fillTo: 'rgb(16 185 129 / 0)',
  },
  bad: {
    stroke: 'rgb(244 63 94)', // rose-500
    fillFrom: 'rgb(244 63 94 / 0.22)',
    fillTo: 'rgb(244 63 94 / 0)',
  },
  alert: {
    stroke: 'rgb(245 158 11)', // amber-500
    fillFrom: 'rgb(245 158 11 / 0.28)',
    fillTo: 'rgb(245 158 11 / 0)',
  },
  neutral: {
    stroke: 'rgb(99 102 241)', // indigo-500
    fillFrom: 'rgb(99 102 241 / 0.22)',
    fillTo: 'rgb(99 102 241 / 0)',
  },
}

function normalizeSeries(data: number[]): number[] {
  if (data.length === 0) return []
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min

  // Flat / zero series — keep a readable mid-band instead of a dead line on the axis.
  if (span < 1e-9) {
    return data.map(() => (max === 0 ? 0.12 : 0.55))
  }

  return data.map((v) => 0.12 + ((v - min) / span) * 0.78)
}

/** Compact SVG sparkline: gradient area, stroke, last-point marker; soft stubs when empty. */
export function MetricSparkline({ data, positive = true, tone }: MetricSparklineProps) {
  const reactId = useId().replace(/:/g, '')
  const width = 120
  const height = 40
  const padX = 2
  const padY = 3
  const series = data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0]
  const allZero = series.every((v) => v === 0)
  const values = normalizeSeries(series)
  const n = values.length
  const innerW = width - padX * 2
  const innerH = height - padY * 2

  const points = values.map((v, i) => {
    const x = padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    const y = padY + innerH * (1 - v)
    return { x, y }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1]!.x.toFixed(2)} ${(height - padY).toFixed(2)} L ${points[0]!.x.toFixed(2)} ${(height - padY).toFixed(2)} Z`
      : ''

  const resolvedTone: SparklineTone = tone ?? (positive ? 'good' : 'bad')
  const palette = allZero
    ? {
        stroke: 'rgb(148 163 184)',
        fillFrom: 'rgb(148 163 184 / 0.18)',
        fillTo: 'rgb(148 163 184 / 0)',
      }
    : TONE_COLORS[resolvedTone]

  const { stroke, fillFrom, fillTo } = palette
  const gradId = `spark-grad-${reactId}`
  const last = points[points.length - 1]

  // Empty / zero: soft vertical stubs read better than a flat hairline.
  if (allZero) {
    const bars = 7
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {Array.from({ length: bars }, (_, i) => {
          const gap = 3
          const barW = (innerW - gap * (bars - 1)) / bars
          const x = padX + i * (barW + gap)
          const h = 6 + ((i * 3) % 5)
          const y = height - padY - h
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={1.5}
              className="fill-slate-200 dark:fill-slate-700"
            />
          )
        })}
      </svg>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillFrom} />
          <stop offset="100%" stopColor={fillTo} />
        </linearGradient>
      </defs>

      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {last && (
        <>
          <circle cx={last.x} cy={last.y} r={3.2} fill={stroke} opacity={0.25} />
          <circle cx={last.x} cy={last.y} r={1.8} fill={stroke} />
        </>
      )}
    </svg>
  )
}
