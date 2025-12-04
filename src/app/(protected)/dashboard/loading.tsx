export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-2 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-4 sm:px-6">
      <div className="space-y-2">
        <div className="h-4 w-28 rounded-lg bg-slate-200" />
        <div className="h-7 w-40 rounded-lg bg-slate-200" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-5 w-28 rounded bg-slate-200" />
            <div className="h-8 w-20 rounded-lg bg-slate-200" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-100 p-4">
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="mt-2 h-6 w-24 rounded bg-slate-200" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 rounded bg-slate-200" />
            <div className="h-8 w-20 rounded-lg bg-slate-200" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="h-5 w-24 rounded bg-slate-200" />
          <div className="h-8 w-28 rounded-lg bg-slate-200" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
