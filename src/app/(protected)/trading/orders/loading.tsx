export default function OrdersLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-2 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-slate-200" />
          <div className="h-7 w-36 rounded bg-slate-200" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-slate-200" />
      </div>

      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="h-8 w-24 rounded-lg bg-slate-200" />
        </div>
        <div className="mt-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
