import { Queue, Worker, QueueEvents, type JobsOptions } from 'bullmq'
import { prisma } from '@/lib/db/prisma'
import { getBullmqConnection } from '@/lib/cache/redis'
import { getOrchestrator, appendTaskStep } from '@/lib/agents/core/AgentOrchestrator'
import type { AgentTaskStep, AgentTypeKey } from '@/lib/agents/core/types'
import { AGENT_TYPE_MAP, PRISMA_TO_AGENT_KEY } from '@/lib/agents/core/types'
import type { AgentTaskPriority, AgentType } from '@prisma/client'

const QUEUE_NAME = 'saios-agent-tasks'
const DLQ_NAME = 'saios-agent-tasks-dlq'

let agentQueue: Queue | null = null
let queueEvents: QueueEvents | null = null

function getConnection() {
  return getBullmqConnection()
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

export async function processAgentTaskInline(data: AgentJobData): Promise<void> {
  await runAgentJob(data)
}

async function runAgentJob(data: AgentJobData): Promise<void> {
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

    await prisma.agentTask.update({
      where: { id: data.taskId },
      data: {
        status: 'COMPLETED',
        result: result.response as never,
        agentType: data.preferredAgent
          ? AGENT_TYPE_MAP[data.preferredAgent]
          : AGENT_TYPE_MAP[result.primaryAgent],
        completedAt: new Date(),
      },
    })
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
    } else {
      await prisma.agentTask.update({
        where: { id: data.taskId },
        data: {
          status: 'FAILED',
          error: message,
          retryCount: { increment: 1 },
        },
      })
    }
    throw err
  }
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
      await runAgentJob(job.data)
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
