import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { logMeetingUpdated } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { meetingDate } = body

    if (!meetingDate) {
      return NextResponse.json({ error: 'meetingDate is required' }, { status: 400 })
    }

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

    // Only the receiver (not the proposer) can suggest a new time.
    const isReceiver =
      (meeting.proposedById === meeting.reporterId && user.id === meeting.employeeId) ||
      (meeting.proposedById === meeting.employeeId && user.id === meeting.reporterId)

    if (!isReceiver && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only the meeting receiver can suggest a new time' },
        { status: 403 }
      )
    }

    // Update meeting date and flip proposedById to the current user
    // so the *other* side now becomes the receiver who can accept.
    const updated = await prisma.meeting.update({
      where: { id: params.id },
      data: {
        meetingDate: new Date(meetingDate),
        proposedById: user.id,
      },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
      },
    })

    // Determine the other party (original proposer) to notify
    const otherParty = user.id === meeting.employeeId ? meeting.reporter : meeting.employee
    const suggestor = user.id === meeting.employeeId ? meeting.employee : meeting.reporter

    try {
      const { sendMeetingSuggestionEmail } = await import('@/lib/email')
      await sendMeetingSuggestionEmail(
        otherParty.email,
        otherParty.name,
        suggestor.name,
        new Date(meetingDate),
        meeting.id
      )
    } catch (error) {
      console.error('Failed to send suggestion email:', error)
    }

    try {
      const { notifyMeetingSuggested } = await import('@/lib/notifications')
      await notifyMeetingSuggested(
        otherParty.id,
        suggestor.name,
        new Date(meetingDate),
        meeting.id
      )
    } catch (error) {
      console.error('Failed to create suggestion notification:', error)
    }

    await logMeetingUpdated(user.id, params.id, { action: 'suggested_new_time', newMeetingDate: meetingDate, suggestedBy: suggestor.name })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error suggesting new time:', error)
    return NextResponse.json({ error: 'Failed to suggest new time' }, { status: 500 })
  }
}
