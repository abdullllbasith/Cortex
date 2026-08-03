import { Skeleton, SkeletonTable } from '@/components/ui'
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
