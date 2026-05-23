'use client'

import { forwardRef } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'
export type TooltipAlign = 'start' | 'center' | 'end'

export interface TooltipProps {
  /** Tooltip label text or node */
  content: React.ReactNode
  children: React.ReactNode
  side?: TooltipSide
  align?: TooltipAlign
  /** Delay before showing (ms) */
  delayDuration?: number
  /** Prevent closing on content click */
  disableHoverableContent?: boolean
  className?: string
}

/** Wrap your app with this once (already done in layout via TooltipProvider). */
export const TooltipProvider = TooltipPrimitive.Provider

export const TooltipRoot     = TooltipPrimitive.Root
export const TooltipTrigger  = TooltipPrimitive.Trigger

export const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-w-[200px] rounded-md px-2.5 py-1.5',
        'text-xs font-medium leading-snug',
        'bg-slate-900 text-white',
        'dark:bg-white dark:text-slate-900',
        'shadow-md',
        'animate-fadeIn',
        'select-none',
        className,
      )}
      {...props}
    >
      {props.children}
      <TooltipPrimitive.Arrow className="fill-slate-900 dark:fill-white" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = 'TooltipContent'

/** Convenience wrapper — covers 90% of use-cases with a single component. */
export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 400,
  disableHoverableContent = false,
  className,
}: TooltipProps) {
  return (
    <TooltipProvider
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
    >
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} align={align} className={className}>
          {content}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  )
}
