import { Queue, Worker } from 'bullmq'
import { getBullmqConnection } from '@/lib/cache/redis'
import { workflowEngine } from '../core/WorkflowEngine'

const QUEUE_NAME = 'saios-workflows'

let workflowQueue: Queue | null = null

function getQueue(): Queue | null {
  const conn = getBullmqConnection()
  if (!conn) return null
  if (!workflowQueue) workflowQueue = new Queue(QUEUE_NAME, { connection: conn })
  return workflowQueue
}

export interface WorkflowResumeJob {
  executionId: string
  workflowDefinitionId: string
  resumeFromNodeId: string
  variables: Record<string, unknown>
}

export async function scheduleWorkflowResume(
  job: WorkflowResumeJob & { delayMs: number },
): Promise<void> {
  const queue = getQueue()
  if (queue) {
    await queue.add(
      'resume',
      {
        executionId: job.executionId,
        workflowDefinitionId: job.workflowDefinitionId,
        resumeFromNodeId: job.resumeFromNodeId,
        variables: job.variables,
      },
      { delay: job.delayMs, jobId: `resume-${job.executionId}-${Date.now()}` },
    )
    return
  }

  await new Promise((r) => setTimeout(r, Math.min(job.delayMs, 60_000)))
  await workflowEngine.execute(job.workflowDefinitionId, job.variables, {
    existingExecutionId: job.executionId,
    resumeFromNodeId: job.resumeFromNodeId,
    triggeredBy: 'delay-resume',
  })
}

export function startWorkflowWorker() {
  const conn = getBullmqConnection()
  if (!conn) return null

  return new Worker<WorkflowResumeJob>(
    QUEUE_NAME,
    async (job) => {
      await workflowEngine.execute(job.data.workflowDefinitionId, job.data.variables, {
        existingExecutionId: job.data.executionId,
        resumeFromNodeId: job.data.resumeFromNodeId,
        triggeredBy: 'delay-resume',
      })
    },
    { connection: conn, concurrency: 5 },
  )
}
