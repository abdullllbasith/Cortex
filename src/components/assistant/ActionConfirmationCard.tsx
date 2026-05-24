'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Clock, Undo2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import type { ActionTaken } from '@/lib/assistant/types'

interface ActionConfirmationCardProps {
  actions: ActionTaken[]
  onUndo?: (action: ActionTaken) => Promise<boolean>
}

const STATUS_CONFIG = {
  completed: {
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
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
}

export function ActionConfirmationCard({ actions, onUndo }: ActionConfirmationCardProps) {
  const [undoingId, setUndoingId] = useState<string | null>(null)
  const [undoneIds, setUndoneIds] = useState<Set<string>>(new Set())

  if (!actions.length) return null

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
    <div className="mt-3 space-y-2">
      {actions.map((action) => {
        const config = STATUS_CONFIG[action.status]
        const Icon = config.icon
        const isUndone = undoneIds.has(action.id)

        return (
          <div
            key={action.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border text-sm',
              config.bg,
              isUndone && 'opacity-50',
            )}
          >
            <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', config.color)} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {isUndone ? 'Action undone' : action.description}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
                {action.type.replace(/\./g, ' · ')} · {action.status}
              </p>
            </div>
            {action.reversible && !isUndone && onUndo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUndo(action)}
                disabled={undoingId === action.id}
                className="shrink-0 h-7 px-2 text-xs"
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
            )}
          </div>
        )
      })}
    </div>
  )
}
