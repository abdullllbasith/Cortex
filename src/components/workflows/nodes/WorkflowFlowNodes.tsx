'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Clock, Webhook, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WorkflowNodeData {
  label?: string
  nodeType?: string
  config?: Record<string, unknown>
  summary?: string
}

function TriggerNodeComponent({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData
  return (
    <div className={cn(
      'min-w-[180px] rounded-lg border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm px-3 py-2',
      selected && 'ring-2 ring-indigo-500',
    )}>
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
        <Zap className="h-3.5 w-3.5 text-emerald-500" />
        {d.label ?? 'Trigger'}
      </div>
      <p className="text-[10px] text-slate-500 mt-1 truncate">{d.summary ?? d.nodeType}</p>
      <Handle type="source" position={Position.Right} className="!bg-emerald-500" />
    </div>
  )
}

export const TriggerNode = memo(TriggerNodeComponent)

function DelayNodeComponent({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData
  return (
    <div className={cn(
      'min-w-[160px] rounded-lg border-l-4 border-l-amber-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm px-3 py-2',
      selected && 'ring-2 ring-indigo-500',
    )}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        <Clock className="h-3.5 w-3.5 text-amber-500" />
        {d.label ?? 'Delay'}
      </div>
      <p className="text-[10px] text-slate-500 mt-1">{d.summary}</p>
      <Handle type="target" position={Position.Left} className="!bg-amber-500" />
      <Handle type="source" position={Position.Right} className="!bg-amber-500" />
    </div>
  )
}

export const DelayNode = memo(DelayNodeComponent)

function ActionNodeComponent({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData
  return (
    <div className={cn(
      'min-w-[180px] rounded-lg border-l-4 border-l-indigo-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm px-3 py-2',
      selected && 'ring-2 ring-indigo-500',
    )}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        <Webhook className="h-3.5 w-3.5 text-indigo-500" />
        {d.label ?? 'Action'}
      </div>
      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{d.summary ?? d.nodeType}</p>
      <Handle type="target" position={Position.Left} className="!bg-indigo-500" />
      <Handle type="source" position={Position.Right} className="!bg-indigo-500" />
    </div>
  )
}

export const ActionNode = memo(ActionNodeComponent)

function ConditionNodeComponent({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData
  return (
    <div className={cn(
      'min-w-[140px] min-h-[80px] rotate-0 bg-white dark:bg-slate-900 border-2 border-violet-400 shadow-sm flex flex-col items-center justify-center p-2',
      'rounded-lg',
      selected && 'ring-2 ring-indigo-500',
    )}>
      <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">{d.label ?? 'Condition'}</span>
      <Handle type="target" position={Position.Left} id="in" className="!bg-violet-500" />
      <Handle type="source" position={Position.Right} id="true" style={{ top: '35%' }} className="!bg-emerald-500" />
      <Handle type="source" position={Position.Right} id="false" style={{ top: '65%' }} className="!bg-red-500" />
      <span className="text-[9px] text-slate-400 mt-1">T / F</span>
    </div>
  )
}

export const ConditionNode = memo(ConditionNodeComponent)

export const workflowNodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
  delayNode: DelayNode,
}

export function nodeTypeToFlowType(type: string): keyof typeof workflowNodeTypes {
  if (type.startsWith('trigger.')) return 'triggerNode'
  if (type === 'control.condition') return 'conditionNode'
  if (type === 'control.delay') return 'delayNode'
  return 'actionNode'
}

export function summarizeNode(type: string, config: Record<string, unknown> = {}): string {
  if (type === 'action.send_notification') {
    return `Send ${config.channel ?? 'message'} to ${config.recipient ?? '{{recipient}}'}`
  }
  if (type === 'action.update_record') return `Update ${config.entity} ${config.entityId ?? ''}`
  if (type === 'action.generate_document') return `Generate ${config.documentType ?? 'document'}`
  if (type === 'action.generate_reorder_suggestion') return 'Generate reorder suggestions'
  if (type === 'action.create_draft_po') return 'Create draft purchase order'
  if (type === 'control.delay') return `Wait ${config.duration} ${config.unit ?? 'minutes'}`
  if (type === 'control.condition') return 'If / else branch'
  return type.split('.').pop() ?? type
}
