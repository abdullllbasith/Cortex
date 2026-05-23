'use client'
import { useEffect } from 'react'; import { AlertTriangle } from 'lucide-react'; import { Button } from '@/components/ui'
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return <div className="flex flex-col items-center gap-4 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-8 text-center"><AlertTriangle className="h-8 w-8 text-red-500" /><div><h2 className="text-sm font-semibold">Setup failed</h2><p className="mt-1 text-xs text-slate-500">{process.env.NODE_ENV === 'development' ? error.message : 'Unable to load setup.'}</p></div><Button variant="secondary" size="sm" onClick={reset}>Retry</Button></div>
}
