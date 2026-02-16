'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white dark:bg-dark-gray px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-dark-gray dark:text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-medium-gray mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-orange text-white rounded-xl hover:bg-orange/90 transition-colors mx-auto"
        >
          <RotateCcw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  )
}
