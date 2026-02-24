import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyMeetingProposed, notifyMeetingReminder, notifyFormReminder } from '@/lib/notifications'
import { sendMeetingProposalEmail, sendMeetingReminderEmail, sendFormReminderEmail } from '@/lib/email'
import { advanceToNextOccurrence } from '@/lib/recurring-dates'

const FALLBACK_TZ = 'Asia/Kolkata'
const LOOK_AHEAD_MS = 7 * 24 * 60 * 60 * 1000 // generate meetings 7 days before they're due

// This endpoint should be called by a cron job (e.g., every hour)
// Set up a cron job to call: POST /api/cron/meetings with header: x-cron-secret: YOUR_SECRET
export async function POST(request: NextRequest) {
  // Verify cron secret — required in production
  const cronSecret = request.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRON_SECRET env var is not set — cron endpoint is disabled in production')
      return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
    }
  } else if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = {
      recurringMeetingsCreated: 0,
      reminders24hSent: 0,
      reminders1hSent: 0,
      formRemindersSent: 0,
      errors: [] as string[],
    }

    // 1. Generate recurring meetings that are due
    await generateRecurringMeetings(results)

    // 2. Send meeting reminders
    await sendMeetingReminders(results)

    // 3. Send form reminders for meetings within 24h where form is not submitted
    await sendFormReminders(results)

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error) {
    console.error('Error in cron job:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}

async function generateRecurringMeetings(results: { recurringMeetingsCreated: number; reminders24hSent: number; reminders1hSent: number; errors: string[] }) {
  const now = new Date()
  
  // Find all active recurring schedules that need a new meeting (look ahead 7 days)
  const lookAhead = new Date(now.getTime() + LOOK_AHEAD_MS)
  const schedules = await prisma.recurringSchedule.findMany({
    where: {
      isActive: true,
      nextMeetingDate: {
        lte: lookAhead,
      },
    },
    include: {
      reporter: { select: { id: true, name: true, email: true, timeZone: true } },
      employee: { select: { id: true, name: true, email: true } },
    },
  })

  for (const schedule of schedules) {
    try {
      const meetingDate = schedule.nextMeetingDate || now

      const reporterTz = schedule.reporter?.timeZone || FALLBACK_TZ

      // Guard: skip if a non-cancelled meeting already exists for this schedule at this date
      const existingMeeting = await prisma.meeting.findFirst({
        where: {
          recurringScheduleId: schedule.id,
          meetingDate,
          status: { not: 'CANCELLED' },
        },
      })
      if (existingMeeting) {
        const nextDate = advanceToNextOccurrence(
          schedule.dayOfWeek,
          schedule.timeOfDay,
          schedule.frequency,
          meetingDate,
          reporterTz
        )
        await prisma.recurringSchedule.update({
          where: { id: schedule.id },
          data: { nextMeetingDate: nextDate, lastGeneratedAt: now },
        })
        continue
      }

      // Check if the recurring schedule has been accepted before (any SCHEDULED or COMPLETED meeting)
      const hasAcceptedMeeting = await prisma.meeting.findFirst({
        where: {
          recurringScheduleId: schedule.id,
          status: { in: ['SCHEDULED', 'COMPLETED'] },
        },
        select: { id: true },
      })
      const autoSchedule = !!hasAcceptedMeeting

      // Create the meeting — auto-schedule if the schedule was already accepted
      const meeting = await prisma.meeting.create({
        data: {
          employeeId: schedule.employeeId,
          reporterId: schedule.reporterId,
          meetingDate,
          recurringScheduleId: schedule.id,
          status: autoSchedule ? 'SCHEDULED' : 'PROPOSED',
          proposedById: schedule.reporterId,
        },
      })

      // Advance the schedule's nextMeetingDate
      const nextDate = advanceToNextOccurrence(
        schedule.dayOfWeek,
        schedule.timeOfDay,
        schedule.frequency,
        meetingDate,
        reporterTz
      )
      await prisma.recurringSchedule.update({
        where: { id: schedule.id },
        data: { nextMeetingDate: nextDate, lastGeneratedAt: now },
      })

      if (autoSchedule) {
        // Book calendar event immediately for auto-scheduled meetings
        try {
          const { createCalendarEvent, isCalendarEnabled } = await import('@/lib/google-calendar')
          const calendarEnabled = await isCalendarEnabled(schedule.reporterId)
          if (calendarEnabled) {
            await createCalendarEvent(
              meeting.id,
              schedule.employee.email,
              schedule.reporter.email,
              schedule.reporterId,
              meetingDate,
              schedule.employee.name,
              schedule.reporter.name
            )
          }
        } catch (calError) {
          console.error('Failed to create calendar event for auto-scheduled recurring meeting:', calError)
        }

        // Notify employee about the scheduled meeting
        try {
          const { sendMeetingAcceptedEmail } = await import('@/lib/email')
          await sendMeetingAcceptedEmail(
            schedule.employee.email,
            schedule.employee.name,
            schedule.reporter.name,
            meetingDate,
            meeting.id
          )
        } catch (emailError) {
          console.error('Failed to send scheduled email for recurring meeting:', emailError)
        }

        try {
          const { notifyMeetingAccepted } = await import('@/lib/notifications')
          await notifyMeetingAccepted(
            schedule.employeeId,
            schedule.reporter.name || 'Your manager',
            meetingDate,
            meeting.id
          )
        } catch (notifError) {
          console.error('Failed to send scheduled notification:', notifError)
        }
      } else {
        // First-time proposal — send proposal email
        try {
          await sendMeetingProposalEmail(
            schedule.employee.email,
            schedule.employee.name,
            schedule.reporter.name,
            meetingDate,
            meeting.id
          )
        } catch (emailError) {
          console.error('Failed to send proposal email for recurring meeting:', emailError)
        }

        try {
          await notifyMeetingProposed(
            schedule.employeeId,
            schedule.reporter.name || 'Your manager',
            meetingDate,
            meeting.id
          )
        } catch (notifError) {
          console.error('Failed to send proposal notification:', notifError)
        }
      }

      results.recurringMeetingsCreated++
    } catch (error) {
      console.error(`Error creating recurring meeting for schedule ${schedule.id}:`, error)
      results.errors.push(`Failed to create meeting for schedule ${schedule.id}`)
    }
  }
}

async function sendMeetingReminders(results: { recurringMeetingsCreated: number; reminders24hSent: number; reminders1hSent: number; errors: string[] }) {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in1h = new Date(now.getTime() + 60 * 60 * 1000)

  // Get system settings for reminder preferences
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'system' },
  })

  if (settings && !settings.enableEmailReminders) {
    return // Reminders disabled
  }

  // 24-hour reminders
  const meetings24h = await prisma.meeting.findMany({
    where: {
      status: 'SCHEDULED',
      reminder24hSent: false,
      meetingDate: {
        gte: now,
        lte: in24h,
      },
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true, email: true } },
    },
  })

  for (const meeting of meetings24h) {
    try {
      // Notify both parties
      await notifyMeetingReminder(
        meeting.employeeId,
        meeting.reporter.name || 'your manager',
        meeting.meetingDate,
        meeting.id,
        24
      )
      await notifyMeetingReminder(
        meeting.reporterId,
        meeting.employee.name || 'your team member',
        meeting.meetingDate,
        meeting.id,
        24
      )

      // Send reminder emails to both parties
      try {
        await sendMeetingReminderEmail(
          meeting.employee.email,
          meeting.employee.name,
          meeting.reporter.name,
          meeting.meetingDate,
          meeting.id
        )
      } catch (emailError) {
        console.error('Failed to send reminder email to employee:', emailError)
      }
      try {
        await sendMeetingReminderEmail(
          meeting.reporter.email,
          meeting.reporter.name,
          meeting.employee.name,
          meeting.meetingDate,
          meeting.id
        )
      } catch (emailError) {
        console.error('Failed to send reminder email to reporter:', emailError)
      }

      // Mark as sent
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { reminder24hSent: true },
      })

      results.reminders24hSent++
    } catch (error) {
      console.error(`Error sending 24h reminder for meeting ${meeting.id}:`, error)
      results.errors.push(`Failed to send 24h reminder for meeting ${meeting.id}`)
    }
  }

  // 1-hour reminders
  const meetings1h = await prisma.meeting.findMany({
    where: {
      status: 'SCHEDULED',
      reminderSent: false,
      meetingDate: {
        gte: now,
        lte: in1h,
      },
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true, email: true } },
    },
  })

  for (const meeting of meetings1h) {
    try {
      // Notify both parties
      await notifyMeetingReminder(
        meeting.employeeId,
        meeting.reporter.name || 'your manager',
        meeting.meetingDate,
        meeting.id,
        1
      )
      await notifyMeetingReminder(
        meeting.reporterId,
        meeting.employee.name || 'your team member',
        meeting.meetingDate,
        meeting.id,
        1
      )

      // Mark as sent
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { reminderSent: true },
      })

      results.reminders1hSent++
    } catch (error) {
      console.error(`Error sending 1h reminder for meeting ${meeting.id}:`, error)
      results.errors.push(`Failed to send 1h reminder for meeting ${meeting.id}`)
    }
  }
}

async function sendFormReminders(results: { formRemindersSent: number; errors: string[] }) {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'system' },
  })

  if (settings && !settings.enableEmailReminders) {
    return
  }

  const meetings = await prisma.meeting.findMany({
    where: {
      status: 'SCHEDULED',
      formSubmittedAt: null,
      formReminderSent: false,
      meetingDate: {
        gte: now,
        lte: in24h,
      },
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true, email: true } },
    },
  })

  for (const meeting of meetings) {
    try {
      // Send form reminder email to the employee
      try {
        await sendFormReminderEmail(
          meeting.employee.email,
          meeting.employee.name,
          meeting.reporter.name,
          meeting.meetingDate,
          meeting.id
        )
      } catch (emailError) {
        console.error('Failed to send form reminder email:', emailError)
      }

      // In-app notification
      try {
        await notifyFormReminder(
          meeting.employeeId,
          meeting.reporter.name || 'your manager',
          meeting.meetingDate,
          meeting.id
        )
      } catch (notifError) {
        console.error('Failed to send form reminder notification:', notifError)
      }

      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { formReminderSent: true },
      })

      results.formRemindersSent++
    } catch (error) {
      console.error(`Error sending form reminder for meeting ${meeting.id}:`, error)
      results.errors.push(`Failed to send form reminder for meeting ${meeting.id}`)
    }
  }
}

