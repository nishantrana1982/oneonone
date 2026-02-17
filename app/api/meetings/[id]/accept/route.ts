import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (meeting.status !== 'PROPOSED') {
      return NextResponse.json(
        { error: 'This meeting is not in a proposed state' },
        { status: 400 }
      )
    }

    // Only the receiver can accept.
    // If reporter proposed → employee accepts.
    // If employee suggested → reporter accepts.
    const isReceiver =
      (meeting.proposedById === meeting.reporterId && user.id === meeting.employeeId) ||
      (meeting.proposedById === meeting.employeeId && user.id === meeting.reporterId)

    if (!isReceiver && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only the meeting receiver can accept this proposal' },
        { status: 403 }
      )
    }

    // Mark as SCHEDULED
    const updated = await prisma.meeting.update({
      where: { id: params.id },
      data: { status: 'SCHEDULED' },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
      },
    })

    // Create Google Calendar event now that both sides agreed
    try {
      const { createCalendarEvent, isCalendarEnabled } = await import('@/lib/google-calendar')
      const calendarEnabled = await isCalendarEnabled(meeting.reporterId)
      if (calendarEnabled) {
        await createCalendarEvent(
          meeting.id,
          meeting.employee.email,
          meeting.reporter.email,
          meeting.reporterId,
          meeting.meetingDate,
          meeting.employee.name,
          meeting.reporter.name
        )
      }
    } catch (error) {
      console.error('Failed to create calendar event on acceptance:', error)
    }

    // Notify the proposer that the meeting was accepted
    const proposer = meeting.proposedById === meeting.reporterId ? meeting.reporter : meeting.employee
    const acceptor = user.id === meeting.employeeId ? meeting.employee : meeting.reporter

    try {
      const { sendMeetingAcceptedEmail } = await import('@/lib/email')
      await sendMeetingAcceptedEmail(
        proposer.email,
        proposer.name,
        acceptor.name,
        meeting.meetingDate,
        meeting.id
      )
    } catch (error) {
      console.error('Failed to send acceptance email:', error)
    }

    try {
      const { notifyMeetingAccepted } = await import('@/lib/notifications')
      await notifyMeetingAccepted(
        proposer.id,
        acceptor.name,
        meeting.meetingDate,
        meeting.id
      )
    } catch (error) {
      console.error('Failed to create acceptance notification:', error)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error accepting meeting:', error)
    return NextResponse.json({ error: 'Failed to accept meeting' }, { status: 500 })
  }
}
