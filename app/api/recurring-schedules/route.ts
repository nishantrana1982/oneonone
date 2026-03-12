import { NextRequest, NextResponse } from 'next/server'
import { requireRole, getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { createAuditLog } from '@/lib/audit'
import { DEFAULT_WORK_END, DEFAULT_WORK_START } from '@/lib/timezones'
import { calculateFirstOccurrence, advanceToNextOccurrence, getNextOccurrenceDates } from '@/lib/recurring-dates'

const FALLBACK_TZ = 'Asia/Kolkata'
/** When creating a recurring schedule, check this many future occurrences; use the first free one (one-off holiday/leave shouldn't block). */
const MAX_OCCURRENCES_TO_CHECK = 6

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
    const { employeeId, frequency, dayOfWeek, timeOfDay, meetingType, meetingLink } = body

    // Validate
    if (!employeeId || dayOfWeek === undefined || !timeOfDay) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (meetingType === 'ZOOM' && (!meetingLink || typeof meetingLink !== 'string' || !meetingLink.trim())) {
      return NextResponse.json(
        { error: 'Zoom meeting invite link is required when the meeting type is Over Zoom.' },
        { status: 400 }
      )
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

    // Find the first free occurrence among the next few (one-off holiday/leave shouldn't block the whole recurring slot)
    const upcomingDates = getNextOccurrenceDates(
      dayOfWeek,
      timeOfDay,
      frequency || 'BIWEEKLY',
      reporterTz,
      MAX_OCCURRENCES_TO_CHECK
    )
    let nextMeetingDate = upcomingDates[0]!

    try {
      const { isCalendarEnabled, isDateTimeFreeForBoth } = await import('@/lib/google-calendar')
      const [reporterConnected, employeeConnected] = await Promise.all([
        isCalendarEnabled(user.id),
        isCalendarEnabled(employeeId),
      ])
      if (reporterConnected && employeeConnected) {
        const { isDateUnavailableForEitherUser } = await import('@/lib/keka')
        const availabilityOptions = {
          reporterTimeZone: reporterTz,
          reporterWorkStart: reporterProfile?.workDayStart ?? DEFAULT_WORK_START,
          reporterWorkEnd: reporterProfile?.workDayEnd ?? DEFAULT_WORK_END,
          employeeTimeZone: employeeProfile?.timeZone ?? FALLBACK_TZ,
          employeeWorkStart: employeeProfile?.workDayStart ?? DEFAULT_WORK_START,
          employeeWorkEnd: employeeProfile?.workDayEnd ?? DEFAULT_WORK_END,
        }
        let foundFree = false
        for (const date of upcomingDates) {
          const kekaUnavailable = await isDateUnavailableForEitherUser(user.id, employeeId, date)
          if (kekaUnavailable) continue
          const free = await isDateTimeFreeForBoth(user.id, employeeId, date, 30, availabilityOptions)
          if (free) {
            nextMeetingDate = date
            foundFree = true
            break
          }
        }
        if (!foundFree) {
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
            { error: `Each of the next ${MAX_OCCURRENCES_TO_CHECK} occurrences has a calendar conflict (e.g. first: ${formatted}). Please choose a different day or time.` },
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
        meetingType: meetingType === 'ZOOM' ? 'ZOOM' : 'IN_PERSON',
        meetingLink: meetingType === 'ZOOM' && meetingLink ? String(meetingLink).trim() || null : null,
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
        meetingType: schedule.meetingType,
        meetingLink: schedule.meetingLink,
      },
    })

    // Advance nextMeetingDate so the cron doesn't duplicate the first meeting
    const secondOccurrence = advanceToNextOccurrence(
      dayOfWeek,
      timeOfDay,
      frequency || 'BIWEEKLY',
      nextMeetingDate,
      reporterTz
    )
    await prisma.recurringSchedule.update({
      where: { id: schedule.id },
      data: { nextMeetingDate: secondOccurrence },
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

