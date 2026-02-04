import { getCurrentUser, requireRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { RecurringSchedulesClient } from './recurring-client'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'

export default async function RecurringSchedulesPage() {
  const user = await getCurrentUser()
  if (!user || user.role === UserRole.EMPLOYEE) {
    redirect('/meetings')
  }

  // Get team members
  const employees = user.role === UserRole.SUPER_ADMIN
    ? await prisma.user.findMany({
        where: { isActive: true, role: 'EMPLOYEE' },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      })
    : await prisma.user.findMany({
        where: { reportsToId: user.id, isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      })

  // Get existing schedules
  const schedules = await prisma.recurringSchedule.findMany({
    where: { reporterId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  // Add employee info to schedules and serialize dates
  const schedulesWithEmployees = await Promise.all(
    schedules.map(async (schedule) => {
      const employee = await prisma.user.findUnique({
        where: { id: schedule.employeeId },
        select: { id: true, name: true, email: true },
      })
      return { 
        ...schedule, 
        employee,
        nextMeetingDate: schedule.nextMeetingDate?.toISOString() || null,
        createdAt: schedule.createdAt.toISOString(),
      }
    })
  )

  return (
    <RecurringSchedulesClient
      employees={employees}
      initialSchedules={schedulesWithEmployees}
    />
  )
}
