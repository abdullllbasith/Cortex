import { WorkflowExecutionStatus, WorkflowNodeExecutionStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { NodeRegistry } from './NodeRegistry'
import { WorkflowContext } from './WorkflowContext'
import type { WorkflowEdgeDef, WorkflowNodeDef } from '../types'
import { NODE_TIMEOUT_MS, TRIGGER_NODE_TYPES, WORKFLOW_TIMEOUT_MS } from '../types'
import { scheduleWorkflowResume } from '../queue/workflowQueue'

export interface ExecuteOptions {
  triggeredBy?: string
  resumeFromNodeId?: string
  existingExecutionId?: string
}

export interface ExecuteResult {
  executionId: string
  status: WorkflowExecutionStatus
  outputData: Record<string, unknown>
  errorMessage?: string
}

function parseNodes(raw: unknown): WorkflowNodeDef[] {
  return Array.isArray(raw) ? (raw as WorkflowNodeDef[]) : []
}

function parseEdges(raw: unknown): WorkflowEdgeDef[] {
  return Array.isArray(raw) ? (raw as WorkflowEdgeDef[]) : []
}

function buildLayers(
  nodes: WorkflowNodeDef[],
  edges: WorkflowEdgeDef[],
  skipped: Set<string>,
  branchByNode: Map<string, 'true' | 'false'>,
): WorkflowNodeDef[][] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, WorkflowEdgeDef[]>()
  for (const e of edges) {
    const list = incoming.get(e.target) ?? []
    list.push(e)
    incoming.set(e.target, list)
  }

  function isReady(nodeId: string, completed: Set<string>): boolean {
    if (skipped.has(nodeId) || completed.has(nodeId)) return false
    const inc = incoming.get(nodeId) ?? []
    if (!inc.length) return true
    return inc.every((e) => {
      if (skipped.has(e.source)) return true
      if (!completed.has(e.source)) return false
      const branch = branchByNode.get(e.source)
      if (branch && e.sourceHandle) {
        return e.sourceHandle === branch
      }
      return true
    })
  }

  const completed = new Set<string>()
  const layers: WorkflowNodeDef[][] = []
  const total = nodes.filter((n) => !skipped.has(n.id)).length

  while (completed.size < total) {
    const layer = nodes.filter((n) => isReady(n.id, completed) && !completed.has(n.id))
    if (!layer.length) break
    layers.push(layer)
    for (const n of layer) completed.add(n.id)
  }

  return layers.filter((l) => l.some((n) => nodeMap.has(n.id)))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

export class WorkflowEngine {
  async execute(
    workflowDefinitionId: string,
    inputData: Record<string, unknown> = {},
    options: ExecuteOptions = {},
  ): Promise<ExecuteResult> {
    const definition = await prisma.workflowDefinition.findUnique({
      where: { id: workflowDefinitionId },
    })
    if (!definition) throw new Error('Workflow definition not found')

    const nodes = parseNodes(definition.nodes)
    const edges = parseEdges(definition.edges)
    if (!nodes.length) throw new Error('Workflow has no nodes')

    const triggeredBy = options.triggeredBy ?? 'system'
    const workflowDeadline = Date.now() + WORKFLOW_TIMEOUT_MS

    let execution = options.existingExecutionId
      ? await prisma.workflowExecution.findUnique({ where: { id: options.existingExecutionId } })
      : null

    if (!execution) {
      execution = await prisma.workflowExecution.create({
        data: {
          workflowDefinitionId,
          tenantId: definition.tenantId,
          status: WorkflowExecutionStatus.RUNNING,
          triggeredBy,
          startedAt: new Date(),
          inputData: inputData as never,
        },
      })
    } else {
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { status: WorkflowExecutionStatus.RUNNING },
      })
    }

    const ctx = new WorkflowContext({
      tenantId: definition.tenantId,
      workflowDefinitionId,
      executionId: execution.id,
      triggeredBy,
      variables: { ...inputData, input: inputData },
      logs: [],
    })

    const skipped = new Set<string>()
    const branchByNode = new Map<string, 'true' | 'false'>()
    const nodeOutputs = new Map<string, Record<string, unknown>>()

    try {
      const layers = buildLayers(nodes, edges, skipped, branchByNode)
      let resumeHit = !options.resumeFromNodeId

      for (const layer of layers) {
        if (Date.now() > workflowDeadline) {
          throw new Error('Workflow exceeded maximum duration of 10 minutes')
        }

        const runnable = layer.filter((n) => {
          if (options.resumeFromNodeId && !resumeHit) {
            if (n.id === options.resumeFromNodeId) resumeHit = true
            return resumeHit
          }
          return true
        })

        await Promise.all(
          runnable.map((node) =>
            this.runNode(node, ctx, edges, skipped, branchByNode, nodeOutputs),
          ),
        )
      }

      const outputData = {
        variables: ctx.variables,
        logs: ctx.logs,
        nodeOutputs: Object.fromEntries(nodeOutputs),
      }

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: WorkflowExecutionStatus.COMPLETED,
          completedAt: new Date(),
          outputData: outputData as never,
        },
      })

      return { executionId: execution.id, status: WorkflowExecutionStatus.COMPLETED, outputData }
    } catch (err) {
      if (err instanceof Error && err.message === '__WORKFLOW_PAUSED__') {
        return {
          executionId: execution.id,
          status: WorkflowExecutionStatus.PENDING,
          outputData: { variables: ctx.variables, logs: ctx.logs, paused: true },
        }
      }
      const message = err instanceof Error ? err.message : 'Workflow execution failed'
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: WorkflowExecutionStatus.FAILED,
          completedAt: new Date(),
          errorMessage: message,
        },
      })

      const stepMatch = message.match(/Node [^ ]+ \(([^)]+)\)/)
      const { notificationService } = await import('@/lib/notifications/notificationService')
      const { renderNotificationTemplate } = await import('@/lib/notifications/notificationTemplates')
      const rendered = renderNotificationTemplate('WORKFLOW_FAILED', {
        workflowName: definition.name,
        stepName: stepMatch?.[1] ?? 'unknown',
        workflowId: workflowDefinitionId,
      })
      await notificationService.send({
        tenantId: definition.tenantId,
        roleTarget: ['OWNER', 'MANAGER'],
        title: rendered.title,
        body: `${rendered.body}: ${message}`,
        type: rendered.type,
        severity: rendered.severity,
        actionUrl: rendered.actionUrl,
        actionLabel: rendered.actionLabel,
        entityId: execution.id,
      }).catch(() => {})

      return {
        executionId: execution.id,
        status: WorkflowExecutionStatus.FAILED,
        outputData: { variables: ctx.variables, logs: ctx.logs },
        errorMessage: message,
      }
    }
  }

  private async runNode(
    node: WorkflowNodeDef,
    ctx: WorkflowContext,
    edges: WorkflowEdgeDef[],
    skipped: Set<string>,
    branchByNode: Map<string, 'true' | 'false'>,
    nodeOutputs: Map<string, Record<string, unknown>>,
  ): Promise<void> {
    const config = (node.data?.config ?? {}) as Record<string, unknown>
    const incomingEdges = edges.filter((e) => e.target === node.id)
    const inputData: Record<string, unknown> = {}
    for (const e of incomingEdges) {
      const srcOut = nodeOutputs.get(e.source)
      if (srcOut) Object.assign(inputData, srcOut)
    }

    const nodeExec = await prisma.workflowNodeExecution.create({
      data: {
        workflowExecutionId: ctx.executionId,
        nodeId: node.id,
        nodeType: node.type,
        status: WorkflowNodeExecutionStatus.RUNNING,
        startedAt: new Date(),
        inputData: inputData as never,
      },
    })

    ctx.appendLog(`Executing node ${node.id} (${node.type})`)

    try {
      if (node.type === 'control.loop') {
        await this.runLoopNode(node, config, ctx, edges, skipped, branchByNode, nodeOutputs, inputData, nodeExec.id)
        return
      }

      const result = await withTimeout(
        NodeRegistry.execute(
          node.type,
          { inputData, config },
          ctx.toEngineContext(),
        ),
        NODE_TIMEOUT_MS,
        `Node ${node.type}`,
      )

      if (result.delayMs && result.delayMs > 0) {
        if (result.pauseExecution) {
          const nextNodes = edges.filter((e) => e.source === node.id).map((e) => e.target)
          await prisma.workflowExecution.update({
            where: { id: ctx.executionId },
            data: { resumeFromNodeId: nextNodes[0] ?? null, status: WorkflowExecutionStatus.PENDING },
          })
          await prisma.workflowNodeExecution.update({
            where: { id: nodeExec.id },
            data: {
              status: WorkflowNodeExecutionStatus.COMPLETED,
              completedAt: new Date(),
              outputData: result.outputData as never,
            },
          })
          await scheduleWorkflowResume({
            executionId: ctx.executionId,
            workflowDefinitionId: ctx.workflowDefinitionId,
            resumeFromNodeId: nextNodes[0]!,
            delayMs: result.delayMs,
            variables: ctx.variables,
          })
          throw new Error('__WORKFLOW_PAUSED__')
        }
        await new Promise((r) => setTimeout(r, Math.min(result.delayMs!, NODE_TIMEOUT_MS)))
      }

      if (node.type === 'control.condition' && result.branch) {
        branchByNode.set(node.id, result.branch === 'true' ? 'true' : 'false')
        const inactive = result.branch === 'true' ? 'false' : 'true'
        this.markBranchSkipped(node.id, inactive, edges, skipped)
      } else if (result.branch === 'true' || result.branch === 'false') {
        branchByNode.set(node.id, result.branch)
        const inactive = result.branch === 'true' ? 'false' : 'true'
        this.markBranchSkipped(node.id, inactive, edges, skipped)
      }

      nodeOutputs.set(node.id, result.outputData)
      ctx.variables[`nodes.${node.id}`] = result.outputData

      await prisma.workflowNodeExecution.update({
        where: { id: nodeExec.id },
        data: {
          status: WorkflowNodeExecutionStatus.COMPLETED,
          completedAt: new Date(),
          outputData: result.outputData as never,
        },
      })

      if (TRIGGER_NODE_TYPES.has(node.type)) {
        ctx.appendLog(`Trigger node ${node.type} activated`)
      }
    } catch (err) {
      if (err instanceof Error && err.message === '__WORKFLOW_PAUSED__') throw err
      const message = err instanceof Error ? err.message : 'Node execution failed'
      await prisma.workflowNodeExecution.update({
        where: { id: nodeExec.id },
        data: {
          status: WorkflowNodeExecutionStatus.FAILED,
          completedAt: new Date(),
          errorMessage: message,
        },
      })
      throw new Error(`Node ${node.id} (${node.type}): ${message}`)
    }
  }

  private markBranchSkipped(
    sourceId: string,
    handle: string,
    edges: WorkflowEdgeDef[],
    skipped: Set<string>,
  ): void {
    const queue = edges.filter((e) => e.source === sourceId && e.sourceHandle === handle).map((e) => e.target)
    while (queue.length) {
      const id = queue.shift()!
      if (skipped.has(id)) continue
      skipped.add(id)
      for (const e of edges.filter((x) => x.source === id)) {
        queue.push(e.target)
      }
    }
  }

  private async runLoopNode(
    node: WorkflowNodeDef,
    config: Record<string, unknown>,
    ctx: WorkflowContext,
    edges: WorkflowEdgeDef[],
    skipped: Set<string>,
    branchByNode: Map<string, 'true' | 'false'>,
    nodeOutputs: Map<string, Record<string, unknown>>,
    inputData: Record<string, unknown>,
    nodeExecId: string,
  ): Promise<void> {
    const arrayPath = String(config.arrayPath ?? 'items')
    const items = (ctx.getVariable(arrayPath) ?? inputData.items ?? []) as unknown[]
    if (!Array.isArray(items)) throw new Error(`Loop arrayPath "${arrayPath}" is not an array`)

    const bodyEdges = edges.filter((e) => e.source === node.id && (e.sourceHandle === 'body' || !e.sourceHandle))
    const bodyNodeIds = bodyEdges.map((e) => e.target)
    const allNodes = await prisma.workflowDefinition.findUnique({
      where: { id: ctx.workflowDefinitionId },
      select: { nodes: true },
    })
    const nodeList = parseNodes(allNodes?.nodes)

    const outputs: unknown[] = []
    for (let i = 0; i < items.length; i++) {
      ctx.setVariable('loop.item', items[i])
      ctx.setVariable('loop.index', i)
      for (const bodyId of bodyNodeIds) {
        const bodyNode = nodeList.find((n) => n.id === bodyId)
        if (bodyNode) {
          await this.runNode(bodyNode, ctx, edges, skipped, branchByNode, nodeOutputs)
        }
      }
      outputs.push(ctx.getVariable('loop.item'))
    }

    const outputData = { iterations: items.length, results: outputs }
    nodeOutputs.set(node.id, outputData)
    await prisma.workflowNodeExecution.update({
      where: { id: nodeExecId },
      data: {
        status: WorkflowNodeExecutionStatus.COMPLETED,
        completedAt: new Date(),
        outputData: outputData as never,
      },
    })
  }

  async retryNode(executionId: string, nodeId: string): Promise<ExecuteResult> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { definition: true },
    })
    if (!execution) throw new Error('Execution not found')

    await prisma.workflowNodeExecution.updateMany({
      where: { workflowExecutionId: executionId, nodeId },
      data: { status: WorkflowNodeExecutionStatus.PENDING, errorMessage: null, retryCount: { increment: 1 } },
    })

    return this.execute(execution.workflowDefinitionId, execution.inputData as Record<string, unknown>, {
      triggeredBy: execution.triggeredBy ?? 'retry',
      resumeFromNodeId: nodeId,
      existingExecutionId: executionId,
    })
  }
}

export const workflowEngine = new WorkflowEngine()
