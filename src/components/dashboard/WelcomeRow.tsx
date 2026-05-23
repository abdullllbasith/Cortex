'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, GitBranch, Bell } from 'lucide-react'
import { Button } from '@/components/ui'

function useGreeting() {
  const [greeting, setGreeting] = useState('Good morning')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    const update = () => {
      const hour = new Date().getHours()
      setGreeting(
        hour < 12 ? 'Good morning'
        : hour < 17 ? 'Good afternoon'
        : 'Good evening',
      )
      setDateStr(
        new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year:    'numeric',
          month:   'long',
          day:     'numeric',
        }),
      )
    }
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [])

  return { greeting, dateStr }
}

export function WelcomeRow() {
  const router = useRouter()
  const { greeting, dateStr } = useGreeting()

  // TODO: replace with real session user name (Module 01)
  const userName = 'Abdul'

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {greeting}, {userName} 👋
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{dateStr}</p>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Bot className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => router.push('/assistant')}
        >
          Ask AI
        </Button>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<GitBranch className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => router.push('/workflows')}
        >
          New Workflow
        </Button>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Bell className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => router.push('/alerts')}
        >
          View Alerts
        </Button>
      </div>
    </div>
  )
}
