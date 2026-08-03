'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Brain, Zap, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentTaskStep, AgentTypeKey } from '@/lib/agents/core/types'

const AGENT_COLORS: Record<AgentTypeKey, string> = {
  finance: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20',
  sales: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
  inventory: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
  operations: 'border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20',
  executive: 'border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20',
}

const STEP_ICONS = {
  thought: Brain,
  action: Zap,
  observation: Eye,
  response: Brain,
}

interface AgentThoughtStreamProps {
  steps: AgentTaskStep[]
  className?: string
}

export function AgentThoughtStream({ steps, className }: AgentThoughtStreamProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([steps.length - 1]))

  if (!steps.length) {
    return (
      <div className={cn('text-sm text-slate-400 text-center py-8', className)}>
        No agent activity yet. Run a task to see reasoning steps.
      </div>
    )
  }

  const toggle = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className={cn('space-y-2', className)}>
      {steps.map((step, idx) => {
        const Icon = STEP_ICONS[step.type] ?? Brain
        const isOpen = expanded.has(idx)

        return (
          <div
            key={`${step.timestamp}-${idx}`}
            className={cn(
              'border-l-4 rounded-r-lg overflow-hidden',
              AGENT_COLORS[step.agentType],
            )}
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <Icon className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-xs font-semibold uppercase text-slate-500 w-20 shrink-0">
                {step.type}
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 capitalize shrink-0">
                {step.agentType}
              </span>
              <span className="text-sm text-slate-800 dark:text-slate-200 truncate flex-1">
                {step.content.slice(0, 100)}
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">
                {new Date(step.timestamp).toLocaleTimeString()}
              </span>
            </button>

            {isOpen && (
              <div className="px-4 pb-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {step.content}
                {step.data && (
                  <pre className="mt-2 text-xs bg-slate-900/5 dark:bg-black/20 rounded p-2 overflow-x-auto">
                    {JSON.stringify(step.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
