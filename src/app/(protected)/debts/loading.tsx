export default function DebtsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-2 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-4 sm:px-6">
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="h-7 w-40 rounded bg-slate-200" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="h-5 w-24 rounded bg-slate-200" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="h-5 w-24 rounded bg-slate-200" />
          <div className="h-10 rounded-xl bg-slate-100" />
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="h-8 w-24 rounded bg-slate-200" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
