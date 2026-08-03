import { Skeleton } from '@/components/ui'
export default function Loading() {
  return <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 space-y-6"><div className="flex gap-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} height="28px" className="flex-1 rounded-full" />)}</div><Skeleton height="28px" width="w-2/3" className="rounded" /><div className="space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} height="36px" className="rounded-md" />)}</div></div>
}
