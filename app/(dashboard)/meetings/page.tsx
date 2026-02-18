import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole, RecurringFrequency } from '@prisma/client'
import { MeetingsClient } from './meetings-client'

export default async function MeetingsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  let meetings
  let recurringSchedules: Array<{
    id: string
    frequency: RecurringFrequency
    dayOfWeek: number
    timeOfDay: string
    isActive: boolean
    nextMeetingDate: Date | null
    createdAt: Date
    employee: { id: string; name: string | null; email?: string | null }
    reporter?: { name: string | null } | null
  }> = []

  const canManageRecurring = user.role === UserRole.REPORTER || user.role === UserRole.SUPER_ADMIN

  const meetingSelect = {
    employee: { select: { name: true, email: true } },
    reporter: { select: { name: true, email: true } },
  }

  if (user.role === UserRole.EMPLOYEE) {
    meetings = await prisma.meeting.findMany({
      where: { employeeId: user.id },
      include: meetingSelect,
      orderBy: { meetingDate: 'desc' },
    })

    recurringSchedules = await prisma.recurringSchedule.findMany({
      where: { employeeId: user.id, isActive: true },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        reporter: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  } else if (user.role === UserRole.REPORTER) {
    meetings = await prisma.meeting.findMany({
      where: { OR: [{ employeeId: user.id }, { reporterId: user.id }] },
      include: meetingSelect,
      orderBy: { meetingDate: 'desc' },
    })

    recurringSchedules = await prisma.recurringSchedule.findMany({
      where: { reporterId: user.id, isActive: true },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        reporter: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  } else {
    meetings = await prisma.meeting.findMany({
      include: meetingSelect,
      orderBy: { meetingDate: 'desc' },
    })

    recurringSchedules = await prisma.recurringSchedule.findMany({
      where: { isActive: true },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        reporter: { select: { name: true } },
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
