import { z } from 'zod'
import { ExecutiveAgent } from '@/lib/agents/ExecutiveAgent'
import { WorkflowContext } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { validateConfig } from '../utils'

const schema = z.object({
  mode: z.enum(['daily', 'monthly']).default('monthly'),
})

export const generateExecutiveDigestHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.generate_executive_digest')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const agent = new ExecutiveAgent(engineCtx.tenantId)

  const briefing =
    cfg.mode === 'daily'
      ? await agent.getDailyBriefing()
      : await agent.getDailyBriefing()

  const digest = briefing as Record<string, unknown>
  const formatted =
    typeof digest.formattedBriefing === 'string'
      ? digest.formattedBriefing
      : String(digest.executiveSummary ?? 'Executive digest')

  ctx.appendLog(`Generated ${cfg.mode} executive digest`)
  return {
    outputData: {
      ...inputData,
      executiveDigest: digest,
      digestFormatted: formatted,
      kpis: digest.kpis ?? {},
    },
  }
}
