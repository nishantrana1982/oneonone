import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole, Prisma } from '@prisma/client'
import { logMeetingCreated } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE])

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    // Optional date-range filter
    const dateFilter: Prisma.MeetingWhereInput = {}
    if (start || end) {
      dateFilter.meetingDate = {}
      if (start) dateFilter.meetingDate.gte = new Date(start)
      if (end) dateFilter.meetingDate.lte = new Date(end)
    }

    const include = {
      employee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true, email: true } },
    }

    let meetings

    if (user.role === UserRole.EMPLOYEE) {
      meetings = await prisma.meeting.findMany({
        where: { employeeId: user.id, ...dateFilter },
        include,
        orderBy: { meetingDate: 'desc' },
      })
    } else if (user.role === UserRole.REPORTER) {
      meetings = await prisma.meeting.findMany({
        where: {
          OR: [{ employeeId: user.id }, { reporterId: user.id }],
          ...dateFilter,
        },
        include,
        orderBy: { meetingDate: 'desc' },
      })
    } else {
      meetings = await prisma.meeting.findMany({
        where: dateFilter,
        include,
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
        status: 'PROPOSED',
        proposedById: user.id,
      },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
      },
    })

    // Audit log
    await logMeetingCreated(user.id, meeting.id, {
      employeeId,
      employeeName: meeting.employee.name,
      reporterName: meeting.reporter.name,
      meetingDate,
    })

    // No calendar event at proposal stage – created only when accepted.

    // Send proposal email to the employee
    try {
      const { sendMeetingProposalEmail } = await import('@/lib/email')
      await sendMeetingProposalEmail(
        meeting.employee.email,
        meeting.employee.name,
        meeting.reporter.name,
        new Date(meetingDate),
        meeting.id
      )
    } catch (error: unknown) {
      console.error('Failed to send proposal email:', error)
    }

    // Create in-app notification for the employee
    try {
      const { notifyMeetingProposed } = await import('@/lib/notifications')
      await notifyMeetingProposed(
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
