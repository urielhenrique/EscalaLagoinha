import { Skeleton } from "./Skeleton";

export function RouteFallback() {
  return (
    <section
      className="animate-fade space-y-4"
      aria-busy="true"
      aria-label="Carregando página"
    >
      {/* Header skeleton */}
      <Skeleton className="h-24 w-full" />
      {/* Cards row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="hidden h-24 sm:block" />
        <Skeleton className="hidden h-24 sm:block" />
      </div>
      {/* Content skeleton */}
      <Skeleton className="h-48" />
      <Skeleton className="h-32" />
    </section>
  );
}
