import { getCurrentUser } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  return <>{children}</>
}
