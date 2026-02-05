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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])
    const body = await request.json()
    const { employeeId, meetingDate } = body

    // #region agent log
    const parsedDate = new Date(meetingDate);
    console.log('[DEBUG] API received meetingDate:', { raw: meetingDate, parsed: parsedDate.toString(), isoBack: parsedDate.toISOString() });
    // #endregion

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Determine reporter - if user is SUPER_ADMIN, use employee's reportsTo, otherwise use current user
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
      
      // Check if calendar is enabled for the reporter
      const calendarEnabled = await isCalendarEnabled(reporterId)
      
      // #region agent log
      console.log('[DEBUG] Calendar check:', { reporterId, calendarEnabled });
      // #endregion
      
      if (calendarEnabled) {
        // #region agent log
        console.log('[DEBUG] Attempting to create calendar event for meeting:', meeting.id);
        // #endregion
        const calendarResult = await createCalendarEvent(
          meeting.id,
          meeting.employee.email,
          meeting.reporter.email,
          reporterId,
          new Date(meetingDate),
          meeting.employee.name,
          meeting.reporter.name
        )
        // #region agent log
        console.log('[DEBUG] Calendar event created successfully:', calendarResult);
        // #endregion
        console.log('Calendar event created:', calendarResult)
      } else {
        // #region agent log
        console.log('[DEBUG] Calendar NOT enabled - skipping calendar event creation');
        // #endregion
      }
    } catch (error) {
      // #region agent log
      console.error('[DEBUG] Calendar event creation FAILED with error:', error);
      // #endregion
      console.error('Failed to create calendar event:', error)
      // Continue even if calendar creation fails
    }

    // Send email notifications
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
    } catch (error) {
      console.error('Failed to send email notification:', error)
      // Continue even if email fails
    }

    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }
}
