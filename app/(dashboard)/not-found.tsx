import { FileQuestion, Home, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-16 h-16 rounded-2xl bg-orange/10 flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="w-8 h-8 text-orange" />
        </div>
        <h1 className="text-4xl font-bold text-dark-gray dark:text-white mb-2">404</h1>
        <h2 className="text-lg font-semibold text-dark-gray dark:text-white mb-2">
          Page not found
        </h2>
        <p className="text-medium-gray mb-6">
          This page doesn&apos;t exist or you don&apos;t have permission to view it.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-orange text-white rounded-xl hover:bg-orange/90 transition-colors"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
