export function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-4xl animate-slideUp">
      {/* Outer glow */}
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-[#7ECAC3]/20 via-[#5BA8A0]/10 to-transparent blur-3xl" />

      {/* Browser frame */}
      <div className="overflow-hidden rounded-2xl border border-[#1E2D3D]/15 bg-[#0d1b2a] shadow-2xl shadow-[#5BA8A0]/15 dark:border-white/10">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/8 bg-[#0a1520] px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-amber-500/80" />
            <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="mx-auto flex items-center gap-1.5 rounded-md bg-white/8 px-4 py-0.5 text-[10px] text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5BA8A0]/70" />
            app.cortex.app/dashboard
          </div>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className="hidden w-44 shrink-0 border-r border-white/8 bg-[#071018] p-3 sm:block">
            {/* Logo area */}
            <div className="mb-5 flex items-center gap-2 px-1">
              <div className="h-5 w-5 rounded bg-gradient-to-br from-[#7ECAC3] to-[#3D8E87]" />
              <div className="h-2.5 w-14 rounded bg-white/20" />
            </div>
            {/* Nav items */}
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className={`mb-1.5 flex h-7 items-center gap-2 rounded-lg px-2 ${
                  i === 1
                    ? 'bg-gradient-to-r from-[#5BA8A0]/30 to-[#3D8E87]/20 border border-[#5BA8A0]/30'
                    : 'bg-white/4'
                }`}
              >
                <div
                  className={`h-3 w-3 rounded-sm ${
                    i === 1 ? 'bg-[#7ECAC3]/70' : 'bg-white/20'
                  }`}
                />
                <div
                  className={`h-1.5 rounded ${
                    i === 1 ? 'w-16 bg-white/50' : 'w-12 bg-white/20'
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-4">
            {/* Top bar */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="mb-1 h-3 w-28 rounded bg-white/30" />
                <div className="h-2 w-20 rounded bg-white/15" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-20 rounded-lg border border-[#5BA8A0]/30 bg-[#5BA8A0]/10" />
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#7ECAC3] to-[#3D8E87]" />
              </div>
            </div>

            {/* KPI cards */}
            <div className="mb-4 grid grid-cols-4 gap-2">
              {[
                { val: '$2.4M', label: 'Revenue', color: '#5BA8A0' },
                { val: '847', label: 'Orders', color: '#7ECAC3' },
                { val: '94%', label: 'Accuracy', color: '#3D8E87' },
                { val: '12', label: 'Agents', color: '#5BA8A0' },
              ].map((kpi, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/8 bg-white/5 p-2.5"
                >
                  <div className="mb-1 flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ background: kpi.color }} />
                    <div className="h-1.5 w-10 rounded bg-white/25" />
                  </div>
                  <div className="text-xs font-bold text-white">{kpi.val}</div>
                  <div className="mt-0.5 h-1 w-8 rounded bg-white/15" />
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {/* Bar chart */}
              <div className="col-span-2 rounded-xl border border-white/8 bg-white/4 p-3">
                <div className="mb-1 h-2 w-20 rounded bg-white/25" />
                <div className="mb-3 h-1 w-14 rounded bg-white/12" />
                <div className="flex h-20 items-end gap-0.5">
                  {[35, 55, 40, 70, 50, 85, 65, 80, 55, 90, 72, 88].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{
                        height: `${h}%`,
                        background:
                          i % 3 === 0
                            ? 'linear-gradient(to top, #3D8E87, #7ECAC3)'
                            : i % 3 === 1
                            ? 'rgba(91,168,160,0.5)'
                            : 'rgba(91,168,160,0.3)',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* List */}
              <div className="rounded-xl border border-white/8 bg-white/4 p-3">
                <div className="mb-1 h-2 w-14 rounded bg-white/25" />
                <div className="mb-3 h-1 w-10 rounded bg-white/12" />
                {[85, 70, 55, 42].map((pct, i) => (
                  <div key={i} className="mb-2 flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{
                        background: `linear-gradient(135deg, #7ECAC3${Math.round(
                          (pct / 100) * 255
                        )
                          .toString(16)
                          .padStart(2, '0')}, #3D8E87)`,
                        opacity: 0.4 + pct / 200,
                      }}
                    />
                    <div className="flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, #5BA8A0, #7ECAC3)',
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-white/40">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/8 bg-white/4 p-3">
              <div className="mb-2 h-2 w-24 rounded bg-white/25" />
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-2 w-1/4 rounded bg-white/20" />
                    <div className="h-2 w-1/3 rounded bg-white/15" />
                    <div className="h-2 w-1/6 rounded bg-white/10" />
                    <div
                      className="ml-auto h-2 w-1/6 rounded"
                      style={{ background: 'rgba(91,168,160,0.35)' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
