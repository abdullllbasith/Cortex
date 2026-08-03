import { Skeleton, SkeletonCard } from '@/components/ui'

export default function RoutePageLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 space-y-1">
        <Skeleton height="20px" width="w-32" className="rounded" />
        <Skeleton height="14px" width="w-64" className="rounded" />
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <Skeleton height="280px" className="rounded-xl" />
      </div>
    </div>
  )
}
