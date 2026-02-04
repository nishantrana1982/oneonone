import { getCurrentUser } from '@/lib/auth-helpers'
import { notFound } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { InsightsClient } from './insights-client'
import { prisma } from '@/lib/prisma'

export default async function InsightsPage() {
  const user = await getCurrentUser()
  if (!user) return notFound()

  // Only reporters and super admins can access insights
  if (user.role !== UserRole.REPORTER && user.role !== UserRole.SUPER_ADMIN) {
    return notFound()
  }

  // Get departments for filter
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-2">
          Organization Insights
        </h1>
        <p className="text-medium-gray">
          Analytics and insights from meeting recordings across the organization
        </p>
      </div>

      <InsightsClient
        departments={departments}
        isSuperAdmin={user.role === UserRole.SUPER_ADMIN}
      />
    </div>
  )
}
