'use client'

import { useRouter } from 'next/navigation'
import { Bot, GitBranch, Bell } from 'lucide-react'
import { Button } from '@/components/ui'

export function WelcomeRow() {
  const router = useRouter()

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
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
  )
}
