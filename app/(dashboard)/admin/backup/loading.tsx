import { Skeleton, CardSkeleton, PageHeaderSkeleton } from '@/components/ui/skeleton'

export default function BackupLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeaderSkeleton />
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}
