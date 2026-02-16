import { Skeleton, CardSkeleton } from '@/components/ui/skeleton'

export default function FormLoading() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Skeleton className="h-4 w-28" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-28 rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
    </div>
  )
}
