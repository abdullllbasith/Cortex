import { Skeleton, SkeletonAvatar } from '@/components/ui'
export default function Loading() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 space-y-1"><Skeleton height="20px" width="w-40" className="rounded" /><Skeleton height="14px" width="w-72" className="rounded" /></div>
      <div className="flex-1 p-6 space-y-4">{Array.from({length:3}).map((_,i)=><div key={i} className="flex gap-3 items-start"><SkeletonAvatar size="sm" /><div className="flex-1 space-y-2"><Skeleton height="14px" width="w-3/4" className="rounded" /><Skeleton height="14px" width="w-1/2" className="rounded" /></div></div>)}</div>
    </div>
  )
}
