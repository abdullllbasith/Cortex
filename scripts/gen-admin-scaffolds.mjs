import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const root = 'src/app/(admin)/admin'

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

const pages = {
  'dashboard': {
    title: 'Admin Dashboard', icon: 'LayoutDashboard', import: 'LayoutDashboard',
    subtitle: 'System-wide health, tenant overview, and platform metrics',
    breadcrumbs: `[{ label: 'Admin' }, { label: 'Dashboard' }]`,
    module: '11',
  },
  'tenants': {
    title: 'Tenants', icon: 'Building2', import: 'Building2',
    subtitle: 'All registered tenants and workspace management',
    breadcrumbs: `[{ label: 'Admin' }, { label: 'Tenants' }]`,
    module: '11',
  },
  'tenants/[id]': {
    title: 'Tenant Detail', icon: 'Building2', import: 'Building2',
    subtitle: 'Tenant configuration, usage, and billing status',
    breadcrumbs: `[{ label: 'Admin' }, { label: 'Tenants', href: '/admin/tenants' }, { label: params.id }]`,
    module: '11',
    dynamic: true,
    paramName: 'id',
  },
}

for (const [dir, cfg] of Object.entries(pages)) {
  const dirPath = join(root, dir)
  mkdirSync(dirPath, { recursive: true })

  let page
  if (cfg.dynamic) {
    page = `import type { Metadata } from 'next'
import { ${cfg.import} } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: '${cfg.title}' }
export default async function Page({ params }: { params: Promise<{ ${cfg.paramName}: string }> }) {
  const { ${cfg.paramName} } = await params
  return (
    <div className="flex flex-col h-full">
      <PageHeader title={\`${cfg.title} #\${${cfg.paramName}}\`} subtitle="${cfg.subtitle}" breadcrumbs={${cfg.breadcrumbs}} />
      <div className="flex-1 p-6"><EmptyState icon={<${cfg.import} />} title="${cfg.title} — Module ${cfg.module}" description="Full admin detail view for this entity." /></div>
    </div>
  )
}
`
  } else {
    page = `import type { Metadata } from 'next'
import { ${cfg.import} } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: '${cfg.title}' }
export default function Page() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="${cfg.title}" subtitle="${cfg.subtitle}" breadcrumbs={${cfg.breadcrumbs}} />
      <div className="flex-1 p-6"><EmptyState icon={<${cfg.import} />} title="${cfg.title} — Module ${cfg.module}" description="Admin panel — restricted to system administrators." /></div>
    </div>
  )
}
`
  }

  writeFileSync(join(dirPath, 'page.tsx'), page, 'utf8')
  writeFileSync(join(dirPath, 'loading.tsx'), loading, 'utf8')
  writeFileSync(join(dirPath, 'error.tsx'), error, 'utf8')
  console.log('wrote', dir)
}
console.log('done')
