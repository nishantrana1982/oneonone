import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { MeetingsClient } from './meetings-client'

export default async function MeetingsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  let meetings
  let recurringSchedules: any[] = []

  const canManageRecurring = user.role === UserRole.REPORTER || user.role === UserRole.SUPER_ADMIN

  if (user.role === UserRole.EMPLOYEE) {
    meetings = await prisma.meeting.findMany({
      where: { employeeId: user.id },
      include: {
        reporter: { select: { name: true, email: true } },
      },
      orderBy: { meetingDate: 'desc' },
    })
  } else if (user.role === UserRole.REPORTER) {
    meetings = await prisma.meeting.findMany({
      where: {
        OR: [{ employeeId: user.id }, { reporterId: user.id }],
      },
      include: {
        employee: { select: { name: true, email: true } },
        reporter: { select: { name: true, email: true } },
      },
      orderBy: { meetingDate: 'desc' },
    })

    // Get recurring schedules for this reporter
    recurringSchedules = await prisma.recurringSchedule.findMany({
      where: { reporterId: user.id },
      include: {
        employee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  } else {
    // SUPER_ADMIN sees all
    meetings = await prisma.meeting.findMany({
      include: {
        employee: { select: { name: true, email: true } },
        reporter: { select: { name: true, email: true } },
      },
      orderBy: { meetingDate: 'desc' },
    })

    // Get all recurring schedules
    recurringSchedules = await prisma.recurringSchedule.findMany({
      include: {
        employee: { select: { id: true, name: true, email: true } },
        reporter: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  return (
    <MeetingsClient
      meetings={meetings}
      recurringSchedules={recurringSchedules}
      currentUserId={user.id}
      userRole={user.role}
    />
  )
}
