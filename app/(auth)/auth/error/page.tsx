'use client'

import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-charcoal px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-semibold text-dark-gray dark:text-white mb-2">
            Authentication Error
          </h1>
          <p className="text-medium-gray mb-6">
            There was an error signing you in. Please try again.
          </p>
          <Link
            href="/auth/signin"
            className="inline-block rounded-xl bg-orange text-white px-6 py-3 font-medium hover:bg-orange-hover transition-colors duration-200"
          >
            Try Again
          </Link>
        </div>
      </div>
    </div>
  )
}
