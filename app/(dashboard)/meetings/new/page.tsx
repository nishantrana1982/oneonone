import { requireRole, getCurrentUser } from '@/lib/auth-helpers'
import { UserRole } from '@prisma/client'
import { NewMeetingForm } from './new-meeting-form'
import { prisma } from '@/lib/prisma'

export default async function NewMeetingPage() {
  const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

  // Get employees that can be scheduled
  // For REPORTER: get their direct reports
  // For SUPER_ADMIN: get all active users except themselves
  let employees

  if (user.role === UserRole.SUPER_ADMIN) {
    employees = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: user.id },
      },
      orderBy: { name: 'asc' },
    })
  } else {
    // REPORTER - get direct reports
    employees = await prisma.user.findMany({
      where: {
        isActive: true,
        reportsToId: user.id,
      },
      orderBy: { name: 'asc' },
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-2">
          Schedule Meeting
        </h1>
        <p className="text-medium-gray">Set up a new one-on-one with your team</p>
      </div>

      <NewMeetingForm employees={employees} currentUserId={user.id} />
    </div>
  )
}
