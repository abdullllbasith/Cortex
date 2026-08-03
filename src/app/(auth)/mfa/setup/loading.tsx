import { Skeleton } from '@/components/ui'
export default function Loading() {
  return <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"><Skeleton height="24px" width="w-2/3" className="rounded" /><Skeleton height="14px" width="w-3/4" className="rounded" /><Skeleton height="160px" className="rounded-lg" /></div>
}
