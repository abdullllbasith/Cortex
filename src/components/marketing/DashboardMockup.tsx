export function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-4xl animate-slideUp">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-2xl shadow-indigo-900/20 dark:border-slate-700">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-amber-500/80" />
            <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="mx-auto rounded-md bg-slate-800 px-4 py-0.5 text-[10px] text-slate-500">
            app.saios.ai/dashboard
          </div>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className="hidden w-44 shrink-0 border-r border-slate-800 bg-slate-950 p-3 sm:block">
            <div className="mb-4 h-6 w-20 rounded bg-indigo-600/30" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`mb-2 h-7 rounded-md ${i === 1 ? 'bg-indigo-600/40' : 'bg-slate-800/60'}`} />
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="h-5 w-32 rounded bg-slate-700" />
              <div className="h-8 w-8 rounded-full bg-indigo-600/40" />
            </div>

            <div className="mb-4 grid grid-cols-4 gap-2">
              {['$2.4M', '847', '94%', '12'].map((val, i) => (
                <div key={i} className="rounded-lg border border-slate-800 bg-slate-800/50 p-2.5">
                  <div className="mb-1 h-2 w-12 rounded bg-slate-600" />
                  <div className="text-xs font-bold text-white">{val}</div>
                </div>
              ))}
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                <div className="mb-2 h-2 w-24 rounded bg-slate-600" />
                <div className="flex h-20 items-end gap-1">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-indigo-500/60" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                <div className="mb-2 h-2 w-16 rounded bg-slate-600" />
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="mb-2 flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-emerald-500/30" />
                    <div className="h-2 flex-1 rounded bg-slate-700" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
              <div className="mb-2 h-2 w-28 rounded bg-slate-600" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="mb-1.5 flex gap-2">
                  <div className="h-2 w-1/4 rounded bg-slate-700" />
                  <div className="h-2 w-1/3 rounded bg-slate-700" />
                  <div className="h-2 w-1/6 rounded bg-emerald-600/40" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -inset-4 -z-10 rounded-2xl bg-indigo-600/10 blur-3xl" />
    </div>
  )
}
