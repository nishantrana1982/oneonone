import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE])

    let meetings

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
    } else {
      meetings = await prisma.meeting.findMany({
        include: {
          employee: { select: { name: true, email: true } },
          reporter: { select: { name: true, email: true } },
        },
        orderBy: { meetingDate: 'desc' },
      })
    }

    return NextResponse.json(meetings)
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth-helpers')
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])
    const body = await request.json()
    const { employeeId, meetingDate } = body

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const reporterId =
      user.role === UserRole.SUPER_ADMIN && employee.reportsToId
        ? employee.reportsToId
        : user.id

    const meeting = await prisma.meeting.create({
      data: {
        employeeId,
        reporterId,
        meetingDate: new Date(meetingDate),
        status: 'SCHEDULED',
      },
      include: {
        employee: { select: { name: true, email: true } },
        reporter: { select: { name: true, email: true } },
      },
    })

    // Create Google Calendar event
    try {
      const { createCalendarEvent, isCalendarEnabled } = await import('@/lib/google-calendar')
      const calendarEnabled = await isCalendarEnabled(reporterId)

      if (calendarEnabled) {
        const calendarResult = await createCalendarEvent(
          meeting.id,
          meeting.employee.email,
          meeting.reporter.email,
          reporterId,
          new Date(meetingDate),
          meeting.employee.name,
          meeting.reporter.name
        )
        console.log('Calendar event created:', calendarResult)
      }
    } catch (error: any) {
      console.error('Failed to create calendar event:', error)
    }

    // Send email notification
    try {
      const { sendMeetingScheduledEmail } = await import('@/lib/email')
      await sendMeetingScheduledEmail(
        meeting.employee.email,
        meeting.employee.name,
        meeting.reporter.email,
        meeting.reporter.name,
        new Date(meetingDate),
        meeting.id
      )
    } catch (error: any) {
      console.error('Failed to send email notification:', error)
    }

    // Create in-app notification for the employee
    try {
      const { notifyMeetingScheduled } = await import('@/lib/notifications')
      await notifyMeetingScheduled(
        employeeId,
        meeting.reporter.name,
        new Date(meetingDate),
        meeting.id
      )
    } catch (error) {
      console.error('Failed to create notification:', error)
    }

    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }
}
