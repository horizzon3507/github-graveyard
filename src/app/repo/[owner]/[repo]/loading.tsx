import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading repository">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-full max-w-xl" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
