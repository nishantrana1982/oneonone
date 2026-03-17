'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const errorMessages: Record<string, string> = {
  Configuration: 'Server auth is misconfigured. Ask your administrator to set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and NEXTAUTH_URL in .env.',
  AccessDenied: 'Access denied. Please use your company email address to sign in.',
  Verification: 'Sign-in link expired or was already used. Please try again.',
  Default: 'There was an error signing you in. Please try again.',
}

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'Default'
  const message = errorMessages[error] || errorMessages.Default

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-charcoal px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-semibold text-dark-gray dark:text-white mb-2">
            Authentication Error
          </h1>
          <p className="text-medium-gray mb-6">
            {message}
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

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-charcoal">
        <p className="text-medium-gray">Loading...</p>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
