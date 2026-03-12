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

    if (new Date(meeting.meetingDate).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'The proposed meeting time has already passed. Please suggest a new time instead.' },
        { status: 400 }
      )
    }

    // Only the receiver can accept.
    // If reporter proposed → employee accepts.
    // If employee suggested → reporter accepts.
    // If a Super Admin (third party) proposed → employee accepts.
    const proposerIsThirdParty = !!meeting.proposedById && meeting.proposedById !== meeting.reporterId && meeting.proposedById !== meeting.employeeId
    const isReceiver =
      (meeting.proposedById === meeting.reporterId && user.id === meeting.employeeId) ||
      (meeting.proposedById === meeting.employeeId && user.id === meeting.reporterId) ||
      (proposerIsThirdParty && user.id === meeting.employeeId)

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

    // Create Google Calendar event(s) now that both sides agreed
    try {
      const { createCalendarEvent, createRecurringCalendarEvent, isCalendarEnabled } = await import('@/lib/google-calendar')
      const calendarEnabled = await isCalendarEnabled(meeting.reporterId)
      if (calendarEnabled) {
        if (meeting.recurringScheduleId) {
          const schedule = await prisma.recurringSchedule.findUnique({
            where: { id: meeting.recurringScheduleId },
            select: { googleRecurringEventId: true, frequency: true, reporter: { select: { timeZone: true } } },
          })
          if (schedule && !schedule.googleRecurringEventId) {
            await createRecurringCalendarEvent(
              meeting.recurringScheduleId,
              meeting.id,
              meeting.reporterId,
              meeting.employee.email,
              meeting.reporter.email,
              meeting.meetingDate,
              meeting.employee.name,
              meeting.reporter.name,
              schedule.frequency,
              schedule.reporter?.timeZone ?? 'Asia/Kolkata'
            )
          }
        } else {
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

    await logMeetingUpdated(user.id, params.id, { action: 'accepted', acceptedBy: acceptor.name, status: 'SCHEDULED' })

    // Auto-generate the next occurrence for recurring meetings
    if (meeting.recurringScheduleId) {
      try {
        const { advanceToNextOccurrence } = await import('@/lib/recurring-dates')
        const schedule = await prisma.recurringSchedule.findUnique({
          where: { id: meeting.recurringScheduleId },
          include: {
            reporter: { select: { id: true, name: true, email: true, timeZone: true } },
            employee: { select: { id: true, name: true, email: true } },
          },
        })

        if (schedule && schedule.isActive && schedule.nextMeetingDate) {
          const reporterTz = schedule.reporter?.timeZone || 'Asia/Kolkata'
          const nextDate = schedule.nextMeetingDate

          // Only auto-generate if no meeting exists for this date yet
          const alreadyExists = await prisma.meeting.findFirst({
            where: {
              recurringScheduleId: schedule.id,
              meetingDate: nextDate,
              status: { not: 'CANCELLED' },
            },
          })

          if (!alreadyExists) {
            await prisma.meeting.create({
              data: {
                employeeId: schedule.employeeId,
                reporterId: schedule.reporterId,
                meetingDate: nextDate,
                recurringScheduleId: schedule.id,
                status: 'SCHEDULED',
                proposedById: schedule.reporterId,
              },
            })

            // Advance the schedule's nextMeetingDate
            const futureDate = advanceToNextOccurrence(
              schedule.dayOfWeek,
              schedule.timeOfDay,
              schedule.frequency,
              nextDate,
              reporterTz
            )
            await prisma.recurringSchedule.update({
              where: { id: schedule.id },
              data: { nextMeetingDate: futureDate, lastGeneratedAt: new Date() },
            })

            // No calendar event: 1-year recurring series is already on both calendars
          }
        }
      } catch (recurError) {
        console.error('Failed to auto-generate next recurring meeting:', recurError)
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error accepting meeting:', error)
    return NextResponse.json({ error: 'Failed to accept meeting' }, { status: 500 })
  }
}
