import { Skeleton, CardSkeleton, PageHeaderSkeleton } from '@/components/ui/skeleton'

export default function InsightsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-4 sm:p-6">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}
