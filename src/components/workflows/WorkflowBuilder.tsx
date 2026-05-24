'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Play, Save, Zap, History, ZoomIn } from 'lucide-react'
import { Button, Badge, toast } from '@/components/ui'
import { apiClient } from '@/lib/api/apiClient'
import { ApiError } from '@/lib/api/types'
import { NodePalette } from './NodePalette'
import { NodeConfigPanel } from './NodeConfigPanel'
import { ExecutionTimeline } from './ExecutionTimeline'
import { ResizableSidebar } from './ResizableSidebar'
import {
  nodeTypeToFlowType,
  summarizeNode,
  workflowNodeTypes,
  type WorkflowNodeData,
} from './nodes/WorkflowFlowNodes'
import { defaultNodeConfig, defaultNodeLabel } from '@/lib/workflows/defaultNodeConfig'
import { DEFAULT_WORKFLOW_TEST_INPUT, workflowUsesCustomerVariables } from '@/lib/workflows/testInput'
import { WorkflowRunTestModal } from './WorkflowRunTestModal'

interface WorkflowBuilderProps {
  workflowId: string
}

function toFlowNodes(raw: unknown[]): Node[] {
  return (raw as Array<{ id: string; type: string; position?: { x: number; y: number }; data?: WorkflowNodeData }>).map((n) => ({
    id: n.id,
    type: nodeTypeToFlowType(n.type),
    position: n.position ?? { x: 0, y: 0 },
    data: {
      label: n.data?.label ?? n.type,
      nodeType: n.type,
      config: n.data?.config ?? {},
      summary: summarizeNode(n.type, n.data?.config),
    } satisfies WorkflowNodeData,
  }))
}

function fromFlowNodes(nodes: Node[]): unknown[] {
  return nodes.map((n) => {
    const d = n.data as WorkflowNodeData
    return {
      id: n.id,
      type: d.nodeType ?? 'action.manual',
      position: n.position,
      data: { label: d.label, config: d.config },
    }
  })
}

export function WorkflowBuilder({ workflowId }: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [executions, setExecutions] = useState<Array<{ id: string; status: string; startedAt: string | null; completedAt: string | null; errorMessage: string | null; nodeExecutions: [] }>>([])
  const [saving, setSaving] = useState(false)
  const [runTestOpen, setRunTestOpen] = useState(false)

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const loadWorkflow = useCallback(async () => {
    try {
      const wf = await apiClient.get<{ nodes: unknown[]; edges: unknown[]; isActive: boolean }>(`/workflows/${workflowId}`)
      setNodes(toFlowNodes(wf.nodes ?? []))
      setEdges((wf.edges ?? []) as Edge[])
      setIsActive(wf.isActive)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load workflow'
      toast.error(message)
    }
  }, [workflowId, setNodes, setEdges])

  const loadExecutions = useCallback(async () => {
    try {
      const execs = await apiClient.get<typeof executions>(`/workflows/${workflowId}/executions`)
      setExecutions(execs as typeof executions)
    } catch {
      /* execution history is optional — don't block the builder */
    }
  }, [workflowId])

  useEffect(() => {
    void loadWorkflow()
  }, [loadWorkflow])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  )

  function addNode(type: string) {
    const id = `${type.replace(/\./g, '-')}-${Date.now()}`
    const config = defaultNodeConfig(type)
    const newNode: Node = {
      id,
      type: nodeTypeToFlowType(type),
      position: { x: 100 + nodes.length * 30, y: 100 + nodes.length * 20 },
      data: {
        label: defaultNodeLabel(type),
        nodeType: type,
        config,
        summary: summarizeNode(type, config),
      },
    }
    setNodes((nds) => [...nds, newNode])
    setSelectedNodeId(id)
    setShowHistory(false)
  }

  async function saveWorkflow() {
    setSaving(true)
    try {
      await apiClient.put(`/workflows/${workflowId}`, {
        nodes: fromFlowNodes(nodes),
        edges,
      })
      toast.success('Workflow saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save workflow')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive() {
    const next = !isActive
    try {
      await apiClient.post(`/workflows/${workflowId}/activate`, { isActive: next })
      setIsActive(next)
      toast.success(next ? 'Workflow activated' : 'Workflow deactivated')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update workflow status')
    }
  }

  async function executeWorkflow(inputData: Record<string, unknown>) {
    setSaving(true)
    try {
      await apiClient.put(`/workflows/${workflowId}`, {
        nodes: fromFlowNodes(nodes),
        edges,
      })
      await apiClient.post(`/workflows/${workflowId}/execute`, { inputData })
      toast.success('Workflow saved and execution started')
      setRunTestOpen(false)
      void loadExecutions()
      setShowHistory(true)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to run workflow')
    } finally {
      setSaving(false)
    }
  }

  async function runNow() {
    if (!nodes.length) {
      toast.error('Add at least one node before running this workflow')
      return
    }
    const invalid = nodes.find((n) => {
      const d = n.data as WorkflowNodeData
      if (d.nodeType !== 'action.send_notification') return false
      const cfg = d.config ?? {}
      return !cfg.channel || !String(cfg.recipient ?? '').trim()
    })
    if (invalid) {
      setSelectedNodeId(invalid.id)
      setShowHistory(false)
      toast.error('Configure Send Notification: pick a Channel and set Recipient (e.g. {{customer.email}})')
      return
    }
    if (workflowUsesCustomerVariables(nodes)) {
      await executeWorkflow(DEFAULT_WORKFLOW_TEST_INPUT as Record<string, unknown>)
      toast.info('Test run used sample customer data. For live runs: Activate workflow, then add a customer in Knowledge Base.')
      return
    }
    await executeWorkflow({})
  }

  function updateNodeData(nodeId: string, data: WorkflowNodeData) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...data,
                summary: summarizeNode(data.nodeType ?? '', data.config),
              },
            }
          : n,
      ),
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-950">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        <Button variant="secondary" size="sm" onClick={saveWorkflow} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1" /> Save
        </Button>
        <Button variant="secondary" size="sm" onClick={toggleActive}>
          <Zap className="h-3.5 w-3.5 mr-1" /> {isActive ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="secondary" size="sm" onClick={runNow} disabled={saving}>
          <Play className="h-3.5 w-3.5 mr-1" /> Run Now
        </Button>
        {workflowUsesCustomerVariables(nodes) && (
          <Button variant="secondary" size="sm" onClick={() => setRunTestOpen(true)} disabled={saving}>
            Test data…
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => { setShowHistory(!showHistory); void loadExecutions() }}>
          <History className="h-3.5 w-3.5 mr-1" /> History
        </Button>
        <Badge variant={isActive ? 'success' : 'default'} size="sm" className="ml-auto">
          {isActive ? 'Active' : 'Draft'}
        </Badge>
        <ZoomIn className="h-4 w-4 text-slate-400" aria-hidden />
      </div>

      <div className="flex flex-1 min-h-0">
        <NodePalette onAdd={addNode} />

        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={workflowNodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            onDrop={(e) => {
              e.preventDefault()
              const type = e.dataTransfer.getData('application/reactflow')
              if (type) addNode(type)
            }}
            onDragOver={(e) => e.preventDefault()}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {showHistory ? (
          <ResizableSidebar
            storageKey="saios:workflow-history-width"
            defaultWidth={320}
            minWidth={240}
            maxWidth={560}
            className="overflow-y-auto p-3"
          >
            <h3 className="text-sm font-semibold mb-3">Execution History</h3>
            <ExecutionTimeline executions={executions} onRefresh={loadExecutions} />
          </ResizableSidebar>
        ) : (
          <NodeConfigPanel
            nodeId={selectedNodeId}
            nodeType={(selectedNode?.data as WorkflowNodeData)?.nodeType ?? null}
            data={(selectedNode?.data as WorkflowNodeData) ?? null}
            onChange={updateNodeData}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>

      <WorkflowRunTestModal
        open={runTestOpen}
        onOpenChange={setRunTestOpen}
        onRun={executeWorkflow}
        running={saving}
      />
    </div>
  )
}
