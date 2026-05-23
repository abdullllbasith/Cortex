import { writeFileSync } from 'fs'
import { join } from 'path'

const root = 'src/app/(dashboard)'

const loading = `import { Skeleton, SkeletonTable } from '@/components/ui'
export default function Loading() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 space-y-1">
        <Skeleton height="20px" width="w-48" className="rounded" />
        <Skeleton height="14px" width="w-64" className="rounded" />
      </div>
      <div className="p-6"><SkeletonTable rows={5} /></div>
    </div>
  )
}
`

const error = `'use client'
import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Something went wrong</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={reset}>Try again</Button>
    </div>
  )
}
`

const dirs = [
  'knowledge', 'knowledge/customers', 'knowledge/products',
  'knowledge/suppliers', 'knowledge/documents', 'knowledge/[entityType]/[id]',
  'agents', 'agents/[agentType]',
  'analytics', 'analytics/sales', 'analytics/customers',
  'analytics/inventory', 'analytics/suppliers',
  'predictions',
  'workflows', 'workflows/[id]/builder', 'workflows/[id]/executions',
  'alerts',
  'settings', 'settings/general', 'settings/team', 'settings/roles',
  'settings/billing', 'settings/channels', 'settings/api-keys', 'settings/audit',
]

for (const dir of dirs) {
  const base = join(root, dir)
  writeFileSync(join(base, 'loading.tsx'), loading, 'utf8')
  writeFileSync(join(base, 'error.tsx'), error, 'utf8')
  console.log('wrote', dir)
}
console.log('done — wrote', dirs.length * 2, 'files')
