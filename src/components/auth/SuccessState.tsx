'use client'

import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SuccessStateProps {
  title: string
  description: string
  className?: string
}

export function SuccessState({ title, description, className }: SuccessStateProps) {
  return (
    <div className={cn('flex flex-col items-center py-6 text-center animate-scaleIn', className)}>
      <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-emerald-100 dark:bg-emerald-950 animate-bounceIn" />
        <CheckCircle2 className="relative h-10 w-10 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  )
}
