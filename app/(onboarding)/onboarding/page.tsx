import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { OnboardingClient } from './onboarding-client'

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  // Super admins don't need to select a reporting manager
  if (user.role === UserRole.SUPER_ADMIN) {
    redirect('/dashboard')
  }

  // If user already has a reporting manager, redirect to dashboard
  if (user.reportsToId) {
    redirect('/dashboard')
  }

  // Get all potential managers (Reporters and Super Admins)
  const managers = await prisma.user.findMany({
    where: {
      isActive: true,
      role: {
        in: [UserRole.REPORTER, UserRole.SUPER_ADMIN],
      },
      id: {
        not: user.id, // Exclude self
      },
    },
    include: {
      department: true,
    },
    orderBy: { name: 'asc' },
  })

  // Get all departments
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
  })

  return (
    <div className="min-h-screen bg-off-white dark:bg-dark-gray flex items-center justify-center p-4">
      <OnboardingClient 
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          departmentId: user.departmentId || null,
        }}
        managers={managers.map(m => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
          departmentId: m.departmentId || null,
          department: m.department?.name || null,
        }))}
        departments={departments}
      />
    </div>
  )
}
