'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

/** Collapse markdown into a one-line preview for the stream header. */
function plainPreview(text: string, max = 96): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max).trimEnd()}…`
}

function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)\s{0,3}#{1,6}\s|(^|\n)\s*[-*+]\s|(^|\n)\|.+\||\*\*[^*]+\*\*|```|^\s*>\s/m.test(
    text,
  )
}

function StepMarkdown({ content }: { content: string }) {
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none break-words [overflow-wrap:anywhere]',
        'prose-headings:scroll-mt-2 prose-headings:font-semibold',
        'prose-h2:text-base prose-h2:mt-3 prose-h2:mb-2',
        'prose-h3:text-sm prose-h3:mt-3 prose-h3:mb-1.5',
        'prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5',
        'prose-table:my-3 prose-th:px-2 prose-th:py-1.5 prose-td:px-2 prose-td:py-1.5',
        'prose-table:text-xs prose-thead:border-b prose-tr:border-b prose-tr:border-slate-200 dark:prose-tr:border-slate-700',
        'prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:bg-slate-900 prose-pre:text-slate-100',
        'prose-code:before:content-none prose-code:after:content-none',
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ' '}</ReactMarkdown>
    </div>
  )
}

function StructuredData({ data }: { data: Record<string, unknown> }) {
  const rest = { ...data }
  delete rest.answer
  delete rest.formattedBriefing
  delete rest.content

  if (Object.keys(rest).length === 0) return null

  return (
    <details className="mt-3 rounded-lg border border-slate-200/80 bg-slate-900/[0.03] dark:border-slate-700/80 dark:bg-black/20">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-500">
        Structured payload
      </summary>
      <pre className="max-h-56 overflow-auto border-t border-slate-200/80 px-3 py-2 text-[11px] leading-relaxed text-slate-600 dark:border-slate-700/80 dark:text-slate-400">
        {JSON.stringify(rest, null, 2)}
      </pre>
    </details>
  )
}

interface AgentThoughtStreamProps {
  steps: AgentTaskStep[]
  className?: string
}

export function AgentThoughtStream({ steps, className }: AgentThoughtStreamProps) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([steps.length - 1]))

  useEffect(() => {
    if (steps.length === 0) return
    setExpanded((prev) => {
      const last = steps.length - 1
      if (prev.has(last)) return prev
      const next = new Set(prev)
      next.add(last)
      return next
    })
  }, [steps.length])

  if (!steps.length) {
    return (
      <div className={cn('py-8 text-center text-sm text-slate-400', className)}>
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
        const previewSource =
          typeof step.data?.answer === 'string' ? step.data.answer : step.content
        const renderAsMarkdown =
          step.type === 'response' ||
          step.type === 'thought' ||
          looksLikeMarkdown(step.content)

        return (
          <div
            key={`${step.timestamp}-${idx}`}
            className={cn(
              'overflow-hidden rounded-r-lg border-l-4',
              AGENT_COLORS[step.agentType],
            )}
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              )}
              <Icon className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {step.type}
              </span>
              <span className="shrink-0 text-xs font-medium capitalize text-slate-600 dark:text-slate-400">
                {step.agentType}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">
                {plainPreview(String(previewSource ?? ''))}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                {new Date(step.timestamp).toLocaleTimeString()}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-slate-200/60 px-4 py-3 dark:border-slate-700/60">
                {renderAsMarkdown ? (
                  <StepMarkdown content={step.content} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {step.content}
                  </p>
                )}
                {step.data && <StructuredData data={step.data} />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
