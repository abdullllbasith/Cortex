import { Queue, Worker, QueueEvents, type JobsOptions } from 'bullmq'
import { prisma } from '@/lib/db/prisma'
import { getBullmqConnection } from '@/lib/cache/redis'
import { getOrchestrator, appendTaskStep } from '@/lib/agents/core/AgentOrchestrator'
import type { AgentTaskStep, AgentTypeKey } from '@/lib/agents/core/types'
import { AGENT_TYPE_MAP, PRISMA_TO_AGENT_KEY } from '@/lib/agents/core/types'
import type { AgentTaskPriority, AgentType } from '@prisma/client'

const QUEUE_NAME = 'saios-agent-tasks'
const DLQ_NAME = 'saios-agent-tasks-dlq'

/** Stuck PENDING/PROCESSING older than this are auto-failed (serverless has no durable worker). */
const STUCK_TASK_MS = 5 * 60 * 1000

let agentQueue: Queue | null = null
let queueEvents: QueueEvents | null = null

function getConnection() {
  return getBullmqConnection()
}

/**
 * Async BullMQ is opt-in. On Vercel there is usually no long-lived worker, so
 * enqueue-without-worker leaves tasks stuck forever. Default: process inline.
 */
export function shouldUseAsyncAgentQueue(): boolean {
  if (process.env.AGENT_QUEUE_ASYNC !== 'true') return false
  return Boolean(getConnection())
}

export function getAgentQueue(): Queue | null {
  const conn = getConnection()
  if (!conn) return null

  if (!agentQueue) {
    agentQueue = new Queue(QUEUE_NAME, {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    })
  }
  return agentQueue
}

export function getDeadLetterQueue(): Queue | null {
  const conn = getConnection()
  if (!conn) return null
  return new Queue(DLQ_NAME, { connection: conn })
}

export interface AgentJobData {
  taskId: string
  tenantId: string
  userId: string
  task: string
  preferredAgent?: AgentTypeKey
  permissions?: string[]
  priority: AgentTaskPriority
}

export interface AgentJobResult {
  taskId: string
  status: 'COMPLETED' | 'FAILED' | 'DEAD_LETTER'
  result?: unknown
  error?: string
  primaryAgent?: AgentTypeKey
  involvedAgents?: AgentTypeKey[]
}

const PRIORITY_MAP: Record<AgentTaskPriority, number> = {
  HIGH: 1,
  MEDIUM: 5,
  LOW: 10,
}

export async function enqueueAgentTask(
  data: AgentJobData,
  options?: JobsOptions,
): Promise<string | null> {
  const queue = getAgentQueue()
  if (!queue) return null

  const job = await queue.add('process-agent-task', data, {
    priority: PRIORITY_MAP[data.priority],
    jobId: data.taskId,
    ...options,
  })

  await prisma.agentTask.update({
    where: { id: data.taskId },
    data: { bullJobId: job.id, status: 'PENDING' },
  })

  return job.id ?? data.taskId
}

export async function processAgentTaskInline(data: AgentJobData): Promise<AgentJobResult> {
  return runAgentJob(data)
}

async function runAgentJob(data: AgentJobData): Promise<AgentJobResult> {
  const onStep = async (step: AgentTaskStep) => {
    await appendTaskStep(data.taskId, step)
  }

  await prisma.agentTask.update({
    where: { id: data.taskId },
    data: { status: 'PROCESSING', startedAt: new Date() },
  })

  try {
    const orchestrator = getOrchestrator(data.tenantId)
    const result = await orchestrator.executeTask(
      {
        task: data.task,
        userId: data.userId,
        taskId: data.taskId,
        permissions: data.permissions ?? ['*'],
      },
      data.preferredAgent,
      onStep,
    )

    const primaryAgent = data.preferredAgent ?? result.primaryAgent

    await prisma.agentTask.update({
      where: { id: data.taskId },
      data: {
        status: 'COMPLETED',
        result: result.response as never,
        agentType: AGENT_TYPE_MAP[primaryAgent],
        completedAt: new Date(),
      },
    })

    return {
      taskId: data.taskId,
      status: 'COMPLETED',
      result: result.response,
      primaryAgent,
      involvedAgents: result.involvedAgents,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Task failed'
    const task = await prisma.agentTask.findUnique({ where: { id: data.taskId } })

    if (task && task.retryCount >= 2) {
      await prisma.agentTask.update({
        where: { id: data.taskId },
        data: { status: 'DEAD_LETTER', error: message, completedAt: new Date() },
      })
      const dlq = getDeadLetterQueue()
      if (dlq) await dlq.add('dead-letter', { ...data, error: message })
      return { taskId: data.taskId, status: 'DEAD_LETTER', error: message }
    }

    await prisma.agentTask.update({
      where: { id: data.taskId },
      data: {
        status: 'FAILED',
        error: message,
        retryCount: { increment: 1 },
        completedAt: new Date(),
      },
    })

    return { taskId: data.taskId, status: 'FAILED', error: message }
  }
}

/** Mark abandoned PENDING/PROCESSING tasks as FAILED so the UI does not show eternal "queued". */
export async function reclaimStuckAgentTasks(tenantId?: string): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_TASK_MS)
  const result = await prisma.agentTask.updateMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      status: { in: ['PENDING', 'PROCESSING'] },
      createdAt: { lt: cutoff },
    },
    data: {
      status: 'FAILED',
      error: 'Timed out waiting for an agent worker. Retried inline processing is required on this environment.',
      completedAt: new Date(),
    },
  })
  return result.count
}

export function startAgentWorker(): Worker | null {
  const conn = getConnection()
  if (!conn) {
    console.warn('[agentWorker] REDIS_URL not set — worker not started')
    return null
  }

  const worker = new Worker<AgentJobData>(
    QUEUE_NAME,
    async (job) => {
      const outcome = await runAgentJob(job.data)
      if (outcome.status !== 'COMPLETED') {
        throw new Error(outcome.error ?? `Agent task ${outcome.status}`)
      }
    },
    {
      connection: conn,
      concurrency: 3,
      limiter: { max: 10, duration: 1000 },
    },
  )

  worker.on('failed', (job, err) => {
    console.error(`[agentWorker] Job ${job?.id} failed:`, err.message)
  })

  worker.on('completed', (job) => {
    console.log(`[agentWorker] Job ${job.id} completed`)
  })

  queueEvents = new QueueEvents(QUEUE_NAME, { connection: conn })

  return worker
}

export async function getQueueStats() {
  const queue = getAgentQueue()
  if (!queue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, available: false }
  }

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])

    return { waiting, active, completed, failed, delayed, available: true }
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, available: false }
  }
}

export function prismaAgentTypeToKey(type: AgentType | null): AgentTypeKey | null {
  if (!type) return null
  return PRISMA_TO_AGENT_KEY[type]
}
