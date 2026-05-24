import { z } from 'zod'
import { getBullmqConnection } from '@/lib/cache/redis'
import type { NodeHandler } from '../../types'
import { validateConfig } from '../utils'

const schema = z.object({
  duration: z.number().positive(),
  unit: z.enum(['minutes', 'hours', 'days']).default('minutes'),
})

function toMs(duration: number, unit: string): number {
  switch (unit) {
    case 'hours': return duration * 3600_000
    case 'days': return duration * 86400_000
    default: return duration * 60_000
  }
}

export const delayHandler: NodeHandler = async ({ inputData, config }) => {
  const cfg = validateConfig(schema, config, 'control.delay')
  const delayMs = toMs(cfg.duration, cfg.unit)
  const useQueue = delayMs > 60_000 && getBullmqConnection()

  if (useQueue) {
    return {
      outputData: { ...inputData, delayed: true, delayMs },
      delayMs,
      pauseExecution: true,
    }
  }

  await new Promise((r) => setTimeout(r, Math.min(delayMs, 60_000)))
  return {
    outputData: {
      ...inputData,
      delayed: true,
      delayMs,
      resumedAt: new Date().toISOString(),
    },
  }
}
