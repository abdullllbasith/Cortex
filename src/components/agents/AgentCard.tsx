'use client'

import Link from 'next/link'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { DollarSign, TrendingUp, Package, Settings2, Crown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge, Button, Input } from '@/components/ui'
import type { AgentStatusInfo, AgentTypeKey } from '@/lib/agents/core/types'
import { useState } from 'react'

const AGENT_META: Record<
  AgentTypeKey,
  { label: string; icon: typeof DollarSign; color: string; border: string }
> = {
  finance: {
    label: 'Finance',
    icon: DollarSign,
    color: 'text-emerald-600',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  sales: {
    label: 'Sales',
    icon: TrendingUp,
    color: 'text-blue-600',
    border: 'border-blue-200 dark:border-blue-800',
  },
  inventory: {
    label: 'Inventory',
    icon: Package,
    color: 'text-amber-600',
    border: 'border-amber-200 dark:border-amber-800',
  },
  operations: {
    label: 'Operations',
    icon: Settings2,
    color: 'text-purple-600',
    border: 'border-purple-200 dark:border-purple-800',
  },
  executive: {
    label: 'Executive',
    icon: Crown,
    color: 'text-indigo-600',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
}

const STATUS_VARIANT = {
  active: 'success',
  idle: 'default',
  processing: 'info',
  error: 'danger',
} as const

interface AgentCardProps {
  agent: AgentStatusInfo
  activitySparkline: Array<{ hour: number; count: number }>
  onInvoke: (agentType: AgentTypeKey, task: string) => Promise<void>
  isInvoking?: boolean
}

export function AgentCard({ agent, activitySparkline, onInvoke, isInvoking }: AgentCardProps) {
  const meta = AGENT_META[agent.agentType]
  const Icon = meta.icon
  const [quickTask, setQuickTask] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickTask.trim()) return
    await onInvoke(agent.agentType, quickTask.trim())
    setQuickTask('')
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-white dark:bg-slate-900 p-5 flex flex-col gap-4 transition-shadow hover:shadow-md',
        meta.border,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800', meta.color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <Link href={`/agents/${agent.agentType}`} className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600">
              {meta.label} Agent
            </Link>
            <p className="text-xs text-slate-400 font-mono">{agent.agentId}</p>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[agent.status]} dot>
          {agent.status === 'processing' ? (
            <span className="flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              Processing
            </span>
          ) : (
            agent.status.charAt(0).toUpperCase() + agent.status.slice(1)
          )}
        </Badge>
      </div>

      <div className="h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={activitySparkline}>
            <Line
              type="monotone"
              dataKey="count"
              stroke="currentColor"
              strokeWidth={2}
              dot={false}
              className={meta.color}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-400 text-xs">Tasks today</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{agent.tasksCompletedToday}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Last activity</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate">
            {agent.lastActivityAt
              ? new Date(agent.lastActivityAt).toLocaleTimeString()
              : '—'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mt-auto">
        <Input
          value={quickTask}
          onChange={(e) => setQuickTask(e.target.value)}
          placeholder={`Ask ${meta.label} agent…`}
          className="text-sm"
        />
        <Button type="submit" size="sm" disabled={isInvoking || !quickTask.trim()}>
          {isInvoking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Run'}
        </Button>
      </form>
    </div>
  )
}
