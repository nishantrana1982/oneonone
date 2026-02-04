import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { requireAuth } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()
  
  // Check if user needs onboarding (no reporting manager and not a super admin)
  if (user.role !== UserRole.SUPER_ADMIN && !user.reportsToId) {
    redirect('/onboarding')
  }
  
  return <DashboardLayout>{children}</DashboardLayout>
}
