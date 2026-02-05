import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { meetingDate, status } = body

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: {
        employee: { select: { name: true, email: true } },
        reporter: { select: { name: true, email: true } },
        calendarEvent: true,
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Only reporter or admin can update
    if (meeting.reporterId !== user.id && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updateData: { meetingDate?: Date; status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' } = {}
    if (meetingDate) updateData.meetingDate = new Date(meetingDate)
    if (status === 'COMPLETED' || status === 'SCHEDULED' || status === 'CANCELLED') updateData.status = status

    const updatedMeeting = await prisma.meeting.update({
      where: { id: params.id },
      data: updateData,
      include: {
        employee: { select: { name: true, email: true } },
        reporter: { select: { name: true, email: true } },
      },
    })

    // Update Google Calendar event if it exists
    if (meeting.calendarEvent && meetingDate) {
      try {
        const { updateCalendarEvent } = await import('@/lib/google-calendar')
        await updateCalendarEvent(
          meeting.calendarEvent.googleEventId,
          meeting.reporterId,
          new Date(meetingDate),
          meeting.employee.name,
          meeting.reporter.name
        )
      } catch (error) {
        console.error('Failed to update calendar event:', error)
      }
    }

    return NextResponse.json(updatedMeeting)
  } catch (error) {
    console.error('Error updating meeting:', error)
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: {
        calendarEvent: true,
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Only reporter or admin can delete
    if (meeting.reporterId !== user.id && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete Google Calendar event if it exists
    if (meeting.calendarEvent) {
      try {
        const { deleteCalendarEvent } = await import('@/lib/google-calendar')
        await deleteCalendarEvent(meeting.calendarEvent.googleEventId, meeting.reporterId)
      } catch (error) {
        console.error('Failed to delete calendar event:', error)
      }
    }

    await prisma.meeting.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting meeting:', error)
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 })
  }
}
