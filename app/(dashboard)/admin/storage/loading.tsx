import { Skeleton, StatCardSkeleton, CardSkeleton, PageHeaderSkeleton } from '@/components/ui/skeleton'

export default function StorageLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <CardSkeleton />
    </div>
  )
}
