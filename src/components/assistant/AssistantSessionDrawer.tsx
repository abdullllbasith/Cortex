'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SessionSidebar } from './SessionSidebar'

interface AssistantSessionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onNewSession: () => void
}

export function AssistantSessionDrawer({
  open,
  onOpenChange,
  activeSessionId,
  onSelectSession,
  onNewSession,
}: AssistantSessionDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden',
            'data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut',
          )}
        />
        <DialogPrimitive.Content
          aria-label="Conversations"
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,20rem)] flex-col md:hidden',
            'border-r border-slate-200 bg-slate-50 shadow-xl dark:border-slate-700 dark:bg-slate-900',
            'data-[state=open]:animate-slideInLeft data-[state=closed]:animate-fadeOut',
            'focus:outline-none',
          )}
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Conversations
            </span>
            <DialogPrimitive.Close
              aria-label="Close conversations"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md',
                'text-slate-500 hover:bg-slate-200 hover:text-slate-900',
                'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              )}
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <SessionSidebar
            className="min-h-0 w-full flex-1 border-0 bg-transparent dark:bg-transparent"
            activeSessionId={activeSessionId}
            onSelectSession={(id) => {
              onSelectSession(id)
              onOpenChange(false)
            }}
            onNewSession={() => {
              onNewSession()
              onOpenChange(false)
            }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
