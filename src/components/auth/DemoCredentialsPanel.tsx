'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui'
import { getDemoCredentials } from '@/lib/auth/demoCredentials'
import { cn } from '@/lib/utils'

interface DemoCredentialsPanelProps {
  variant: 'login' | 'register'
  onUseCredentials?: (email: string, password: string) => void
  className?: string
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }, [value])

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/60 px-3 py-2 dark:bg-white/5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className="truncate font-mono text-sm text-slate-800 dark:text-slate-100">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${label}`}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors',
          'border-slate-200 text-slate-500 hover:border-[#5BA8A0]/40 hover:text-[#5BA8A0]',
          'dark:border-white/10 dark:text-slate-400 dark:hover:border-[#7ECAC3]/30 dark:hover:text-[#7ECAC3]',
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
    </div>
  )
}

export function DemoCredentialsPanel({ variant, onUseCredentials, className }: DemoCredentialsPanelProps) {
  const demo = getDemoCredentials()
  if (!demo) return null

  return (
    <div
      className={cn(
        'rounded-xl border border-[#5BA8A0]/25 bg-gradient-to-br from-[#5BA8A0]/8 to-[#3D8E87]/5 px-4 py-4',
        'dark:border-[#7ECAC3]/20 dark:from-[#7ECAC3]/10 dark:to-[#5BA8A0]/5',
        className,
      )}
    >
      <div className="mb-3 flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#5BA8A0]/15 dark:bg-[#7ECAC3]/15">
          <Sparkles className="h-3.5 w-3.5 text-[#3D8E87] dark:text-[#7ECAC3]" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{demo.label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {variant === 'login'
              ? 'Use these credentials to explore a pre-loaded Cortex workspace.'
              : 'Prefer an instant preview? Sign in with the demo account instead of creating a new workspace.'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <CredentialRow label="Email" value={demo.email} />
        <CredentialRow label="Password" value={demo.password} />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {variant === 'login' && onUseCredentials ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full sm:flex-1"
            onClick={() => onUseCredentials(demo.email, demo.password)}
          >
            Use demo account
          </Button>
        ) : (
          <Link href="/login" style={{ textDecoration: 'none' }} className="w-full sm:flex-1">
            <Button type="button" variant="secondary" size="sm" className="w-full">
              Sign in with demo
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
