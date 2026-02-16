import { Skeleton, CardSkeleton, PageHeaderSkeleton } from '@/components/ui/skeleton'

export default function NewMeetingLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Skeleton className="h-4 w-28" />
      <PageHeaderSkeleton />
      <CardSkeleton />
    </div>
  )
}
