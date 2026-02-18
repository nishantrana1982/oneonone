import { NextRequest, NextResponse } from 'next/server'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { addDays, addWeeks, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns'
import { requireRole, getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole, RecurringFrequency } from '@prisma/client'
import { createAuditLog } from '@/lib/audit'
import { DEFAULT_WORK_END, DEFAULT_WORK_START } from '@/lib/timezones'

const FALLBACK_TZ = 'Asia/Kolkata'

// Get all recurring schedules for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schedules = await prisma.recurringSchedule.findMany({
      where: {
        reporterId: user.id,
        isActive: true, // Filter out soft-deleted schedules
      },
      include: {
        _count: { select: { meetings: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get employee details for each schedule
    const schedulesWithEmployees = await Promise.all(
      schedules.map(async (schedule) => {
        const employee = await prisma.user.findUnique({
          where: { id: schedule.employeeId },
          select: { id: true, name: true, email: true },
        })
        return { ...schedule, employee }
      })
    )

    return NextResponse.json(schedulesWithEmployees)
  } catch (error) {
    console.error('Error fetching recurring schedules:', error)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }
}

// Create a new recurring schedule
export async function POST(request: NextRequest) {
  try {
    await requireRole(['REPORTER', 'SUPER_ADMIN'])
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { employeeId, frequency, dayOfWeek, timeOfDay } = body

    // Validate
    if (!employeeId || dayOfWeek === undefined || !timeOfDay) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if schedule already exists for this employee
    const existingForEmployee = await prisma.recurringSchedule.findFirst({
      where: {
        reporterId: user.id,
        employeeId,
        isActive: true,
      },
    })

    if (existingForEmployee) {
      return NextResponse.json(
        { error: 'A recurring schedule already exists for this employee' },
        { status: 400 }
      )
    }

    // Check if reporter already has a schedule at the same day and time (with any employee)
    const existingAtSameTime = await prisma.recurringSchedule.findFirst({
      where: {
        reporterId: user.id,
        dayOfWeek,
        timeOfDay,
        isActive: true,
      },
      include: {
        employee: { select: { name: true } },
      },
    })

    if (existingAtSameTime) {
      const empName = existingAtSameTime.employee?.name || 'another employee'
      return NextResponse.json(
        { error: `You already have a recurring schedule at this day and time with ${empName}. Please choose a different time.` },
        { status: 400 }
      )
    }

    // Check if the employee already has a meeting/schedule at the same day and time (with any reporter)
    const employeeBusyAtSameTime = await prisma.recurringSchedule.findFirst({
      where: {
        employeeId,
        dayOfWeek,
        timeOfDay,
        isActive: true,
      },
      include: {
        reporter: { select: { name: true } },
      },
    })

    if (employeeBusyAtSameTime) {
      const employee = await prisma.user.findUnique({ where: { id: employeeId }, select: { name: true } })
      return NextResponse.json(
        { error: `${employee?.name || 'This employee'} already has a recurring schedule at this day and time. Please choose a different time.` },
        { status: 400 }
      )
    }

    // Load reporter and employee timezone / work hours
    const [reporterProfile, employeeProfile] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { timeZone: true, workDayStart: true, workDayEnd: true },
      }),
      prisma.user.findUnique({
        where: { id: employeeId },
        select: { timeZone: true, workDayStart: true, workDayEnd: true },
      }),
    ])

    const reporterTz = reporterProfile?.timeZone ?? FALLBACK_TZ

    // Calculate next meeting date in the reporter's timezone
    const nextMeetingDate = calculateNextMeetingDate(
      dayOfWeek,
      timeOfDay,
      frequency || 'BIWEEKLY',
      reporterTz
    )

    // Check both calendars for the first occurrence (if both connected)
    try {
      const { isCalendarEnabled, isDateTimeFreeForBoth } = await import('@/lib/google-calendar')
      const [reporterConnected, employeeConnected] = await Promise.all([
        isCalendarEnabled(user.id),
        isCalendarEnabled(employeeId),
      ])
      if (reporterConnected && employeeConnected) {
        const availabilityOptions = {
          reporterTimeZone: reporterTz,
          reporterWorkStart: reporterProfile?.workDayStart ?? DEFAULT_WORK_START,
          reporterWorkEnd: reporterProfile?.workDayEnd ?? DEFAULT_WORK_END,
          employeeTimeZone: employeeProfile?.timeZone ?? FALLBACK_TZ,
          employeeWorkStart: employeeProfile?.workDayStart ?? DEFAULT_WORK_START,
          employeeWorkEnd: employeeProfile?.workDayEnd ?? DEFAULT_WORK_END,
        }
        const free = await isDateTimeFreeForBoth(user.id, employeeId, nextMeetingDate, 30, availabilityOptions)
        if (!free) {
          const formatted = nextMeetingDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: reporterTz,
          })
          return NextResponse.json(
            { error: `One or both of you have a calendar conflict on the first occurrence (${formatted}). Please choose a different day or time.` },
            { status: 409 }
          )
        }
      }
    } catch (err) {
      console.error('Recurring schedule calendar check:', err)
    }

    // Create the recurring schedule
    const schedule = await prisma.recurringSchedule.create({
      data: {
        reporterId: user.id,
        employeeId,
        frequency: frequency || 'BIWEEKLY',
        dayOfWeek,
        timeOfDay,
        nextMeetingDate,
      },
    })

    // Create the first meeting as PROPOSED (requires employee acceptance)
    const meeting = await prisma.meeting.create({
      data: {
        employeeId,
        reporterId: user.id,
        meetingDate: nextMeetingDate,
        recurringScheduleId: schedule.id,
        status: 'PROPOSED',
        proposedById: user.id,
      },
    })

    // Send proposal email to the employee
    try {
      const employee = await prisma.user.findUnique({ where: { id: employeeId }, select: { email: true, name: true } })
      if (employee) {
        const { sendMeetingProposalEmail } = await import('@/lib/email')
        await sendMeetingProposalEmail(
          employee.email,
          employee.name,
          user.name,
          nextMeetingDate,
          meeting.id
        )
      }
    } catch (error) {
      console.error('Failed to send proposal email for recurring schedule:', error)
    }

    // In-app notification for the employee
    try {
      const { notifyMeetingProposed } = await import('@/lib/notifications')
      await notifyMeetingProposed(
        employeeId,
        user.name || 'Your manager',
        nextMeetingDate,
        meeting.id
      )
    } catch (error) {
      console.error('Failed to send proposal notification:', error)
    }

    const employee = await prisma.user.findUnique({ where: { id: employeeId }, select: { name: true } })
    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'RecurringSchedule',
      entityId: schedule.id,
      details: { employeeId, employeeName: employee?.name, frequency: schedule.frequency, dayOfWeek, timeOfDay },
    })

    return NextResponse.json({ schedule, meeting })
  } catch (error) {
    console.error('Error creating recurring schedule:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}

function calculateNextMeetingDate(
  dayOfWeek: number,
  timeOfDay: string,
  frequency: RecurringFrequency,
  timeZone = FALLBACK_TZ
): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const now = new Date()
  const zoned = toZonedTime(now, timeZone)
  const currentDay = zoned.getDay()
  let daysUntil = dayOfWeek - currentDay
  if (daysUntil < 0) daysUntil += 7
  else if (daysUntil === 0) {
    if (zoned.getHours() > hours || (zoned.getHours() === hours && zoned.getMinutes() >= minutes)) {
      daysUntil += 7
    }
  }
  let nextLocal = addDays(zoned, daysUntil)
  nextLocal = setHours(nextLocal, hours)
  nextLocal = setMinutes(nextLocal, minutes)
  nextLocal = setSeconds(nextLocal, 0)
  nextLocal = setMilliseconds(nextLocal, 0)
  if (frequency === 'BIWEEKLY' && daysUntil < 7) {
    nextLocal = addWeeks(nextLocal, 1)
  }
  return fromZonedTime(nextLocal, timeZone)
}
