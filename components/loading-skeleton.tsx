import { cn } from "@/lib/utils"

/**
 * Branded loading skeleton. Uses the brand lime to give a subtle
 * "shimmer" effect without resorting to a third-party animation lib.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.6s_infinite] after:bg-gradient-to-r after:from-transparent after:via-accent/30 after:to-transparent",
        className,
      )}
    />
  )
}

export function PageLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary py-20">
        <div className="mx-auto max-w-[1320px] px-5 lg:px-10">
          <Skeleton className="h-4 w-32 bg-primary-foreground/15" />
          <Skeleton className="mt-8 h-12 w-2/3 bg-primary-foreground/15" />
          <Skeleton className="mt-6 h-6 w-1/2 bg-primary-foreground/15" />
        </div>
      </div>
      <div className="mx-auto max-w-[1320px] space-y-6 px-5 py-20 lg:px-10">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid gap-4 pt-8 md:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  )
}