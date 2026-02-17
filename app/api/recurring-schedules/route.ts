import { NextRequest, NextResponse } from 'next/server'
import { requireRole, getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole, RecurringFrequency } from '@prisma/client'

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

    // Calculate next meeting date
    const nextMeetingDate = calculateNextMeetingDate(
      dayOfWeek,
      timeOfDay,
      frequency || 'BIWEEKLY'
    )

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

    return NextResponse.json({ schedule, meeting })
  } catch (error) {
    console.error('Error creating recurring schedule:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}

function calculateNextMeetingDate(
  dayOfWeek: number,
  timeOfDay: string,
  frequency: RecurringFrequency
): Date {
  const now = new Date()
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  
  // Find the next occurrence of the specified day
  let nextDate = new Date(now)
  nextDate.setHours(hours, minutes, 0, 0)
  
  // Calculate days until next occurrence
  const currentDay = now.getDay()
  let daysUntil = dayOfWeek - currentDay
  
  // If it's the same day but time has passed, or if the day has passed this week
  if (daysUntil < 0 || (daysUntil === 0 && now >= nextDate)) {
    daysUntil += 7
  }
  
  nextDate.setDate(now.getDate() + daysUntil)
  
  // For biweekly, if the date is too close, add another week
  if (frequency === 'BIWEEKLY' && daysUntil < 7) {
    nextDate.setDate(nextDate.getDate() + 7)
  }
  
  return nextDate
}
