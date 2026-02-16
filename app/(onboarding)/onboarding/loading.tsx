export default function OnboardingLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white dark:bg-dark-gray">
      <div className="w-full max-w-md mx-auto px-4 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-charcoal animate-pulse mx-auto" />
          <div className="h-7 w-48 bg-white dark:bg-charcoal rounded-xl animate-pulse mx-auto" />
          <div className="h-4 w-64 bg-white dark:bg-charcoal rounded-lg animate-pulse mx-auto" />
        </div>
        <div className="rounded-2xl bg-white dark:bg-charcoal p-6 space-y-4">
          <div className="h-10 w-full bg-off-white dark:bg-dark-gray rounded-xl animate-pulse" />
          <div className="h-10 w-full bg-off-white dark:bg-dark-gray rounded-xl animate-pulse" />
          <div className="h-10 w-full bg-off-white dark:bg-dark-gray rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  )
}
