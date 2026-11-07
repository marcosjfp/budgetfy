import { Skeleton } from './ui';

/** Generic page placeholder: heading, KPI tiles and a list. */
export function PageSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-4 w-28 mb-3" />
      <Skeleton className="h-9 w-64 max-w-full mb-8" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-card border border-line bg-surface p-4 sm:p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-card border border-line bg-surface p-4 sm:p-5 space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="size-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
