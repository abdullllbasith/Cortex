'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Undo2,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { apiClient } from '@/lib/api/apiClient'
import type { ActionTaken } from '@/lib/assistant/types'

interface ActionConfirmCardProps {
  actions: ActionTaken[]
  onActionUpdate?: (actionId: string, updated: ActionTaken) => void
  onUndo?: (action: ActionTaken) => Promise<boolean>
}

const STATUS_CONFIG = {
  completed: {
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  },
  awaiting_confirmation: {
    icon: Clock,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800',
  },
  pending: {
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700',
  },
}

export function ActionConfirmCard({
  actions,
  onActionUpdate,
  onUndo,
}: ActionConfirmCardProps) {
  const [localActions, setLocalActions] = useState<ActionTaken[]>(actions)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [undoingId, setUndoingId] = useState<string | null>(null)
  const [undoneIds, setUndoneIds] = useState<Set<string>>(new Set())

  if (!localActions.length) return null

  const updateLocal = (id: string, patch: ActionTaken) => {
    setLocalActions((prev) => prev.map((a) => (a.id === id ? patch : a)))
    onActionUpdate?.(id, patch)
  }

  const handleConfirm = async (action: ActionTaken) => {
    setBusyId(action.id)
    try {
      const res = await apiClient.post<{ action: ActionTaken }>('/assistant/actions/confirm', {
        action,
      })
      if (res.action) updateLocal(action.id, res.action)
    } catch {
      updateLocal(action.id, {
        ...action,
        status: 'failed',
        requiresConfirmation: false,
        resultMessage: 'Failed to execute action. Please try again.',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = (action: ActionTaken) => {
    updateLocal(action.id, {
      ...action,
      status: 'cancelled',
      requiresConfirmation: false,
      resultMessage: 'Action cancelled',
    })
  }

  const handleUndo = async (action: ActionTaken) => {
    if (!onUndo || !action.reversible) return
    setUndoingId(action.id)
    try {
      const success = await onUndo(action)
      if (success) setUndoneIds((prev) => new Set(prev).add(action.id))
    } finally {
      setUndoingId(null)
    }
  }

  return (
    <div className="mt-3 space-y-2 w-full max-w-md">
      {localActions.map((action) => {
        const statusKey =
          action.status in STATUS_CONFIG
            ? (action.status as keyof typeof STATUS_CONFIG)
            : 'pending'
        const config = STATUS_CONFIG[statusKey]
        const Icon = config.icon
        const isUndone = undoneIds.has(action.id)
        const awaiting = action.status === 'awaiting_confirmation'

        return (
          <div
            key={action.id}
            className={cn(
              'rounded-lg border text-sm overflow-hidden',
              config.bg,
              isUndone && 'opacity-50',
            )}
          >
            <div className="flex items-start gap-3 p-3">
              <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', config.color)} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {isUndone
                    ? 'Action undone'
                    : action.displayTitle ?? action.description.split('\n')[0]}
                </p>
                {!awaiting && action.description.includes('\n') && (
                  <pre className="mt-1 text-xs whitespace-pre-wrap font-sans text-slate-600 dark:text-slate-300">
                    {action.description}
                  </pre>
                )}
                {action.parameters && action.parameters.length > 0 && (
                  <dl className="mt-2 space-y-1">
                    {action.parameters.map((p) => (
                      <div key={p.label} className="flex gap-2 text-xs">
                        <dt className="text-slate-500 shrink-0">{p.label}:</dt>
                        <dd className="text-slate-800 dark:text-slate-200 font-medium">{p.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {action.resultMessage && !awaiting && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {action.resultMessage}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 capitalize">
                  {action.type.replace(/\./g, ' · ')} · {action.status.replace(/_/g, ' ')}
                </p>
                {action.status === 'completed' && action.recordLink && (
                  <Link
                    href={action.recordLink}
                    className="inline-flex items-center gap-1 text-xs mt-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View record
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>

            {awaiting && (
              <div className="flex gap-2 px-3 pb-3 border-t border-indigo-100 dark:border-indigo-900/50 pt-2">
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={busyId === action.id}
                  onClick={() => handleConfirm(action)}
                >
                  {busyId === action.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Confirm'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                  disabled={busyId === action.id}
                  onClick={() => handleCancel(action)}
                >
                  Cancel
                </Button>
              </div>
            )}

            {action.reversible && action.status === 'completed' && !isUndone && onUndo && (
              <div className="px-3 pb-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUndo(action)}
                  disabled={undoingId === action.id}
                  className="h-7 px-2 text-xs"
                >
                  {undoingId === action.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Undo2 className="w-3 h-3 mr-1" />
                      Undo
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
