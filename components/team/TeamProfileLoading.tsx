export default function TeamProfileLoading() {
  return (
    <div className="flex h-[calc(100vh-3rem)] min-h-0 animate-pulse flex-col overflow-hidden bg-bg" aria-label="Loading team profile">
      <div className="h-[122px] shrink-0 border-b-2 border-border bg-black/[0.07] dark:bg-white/[0.07]">
        <div className="flex h-full items-center gap-5 px-7">
          <div className="h-16 w-16 rounded-full bg-black/10 dark:bg-white/10" />
          <div className="flex-1">
            <div className="h-2.5 w-36 bg-black/10 dark:bg-white/10" />
            <div className="mt-3 h-8 w-72 bg-black/10 dark:bg-white/10" />
            <div className="mt-3 h-2.5 w-56 bg-black/10 dark:bg-white/10" />
          </div>
          <div className="h-14 w-64 bg-black/10 dark:bg-white/10" />
        </div>
      </div>
      <div className="flex h-11 shrink-0 items-center gap-4 border-b-2 border-border bg-surface px-7">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-2.5 w-20 bg-black/10 dark:bg-white/10" />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-[4.5rem_minmax(0,1fr)] gap-3 p-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="border border-border bg-surface p-3">
            <div className="h-2 w-20 bg-black/10 dark:bg-white/10" />
            <div className="mt-3 h-6 w-24 bg-black/10 dark:bg-white/10" />
          </div>
        ))}
        <div className="col-span-3 border border-border bg-surface" />
        <div className="border border-border bg-surface" />
      </div>
    </div>
  );
}
