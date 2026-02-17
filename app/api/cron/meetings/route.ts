import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { RecurringFrequency } from '@prisma/client'
import { notifyMeetingScheduled, notifyMeetingReminder } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'

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
      errors: [] as string[],
    }

    // 1. Generate recurring meetings that are due
    await generateRecurringMeetings(results)

    // 2. Send meeting reminders
    await sendMeetingReminders(results)

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
  
  // Find all active recurring schedules that need a new meeting
  const schedules = await prisma.recurringSchedule.findMany({
    where: {
      isActive: true,
      nextMeetingDate: {
        lte: now,
      },
    },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
    },
  })

  for (const schedule of schedules) {
    try {
      // Create the meeting
      const meeting = await prisma.meeting.create({
        data: {
          employeeId: schedule.employeeId,
          reporterId: schedule.reporterId,
          meetingDate: schedule.nextMeetingDate || now,
          recurringScheduleId: schedule.id,
        },
      })

      // Calculate next meeting date
      const nextDate = calculateNextMeetingDate(
        schedule.dayOfWeek,
        schedule.timeOfDay,
        schedule.frequency,
        schedule.nextMeetingDate || now
      )

      // Update the schedule
      await prisma.recurringSchedule.update({
        where: { id: schedule.id },
        data: {
          nextMeetingDate: nextDate,
          lastGeneratedAt: now,
        },
      })

      // Notify the employee
      await notifyMeetingScheduled(
        schedule.employeeId,
        schedule.reporter.name || 'Your manager',
        schedule.nextMeetingDate || now,
        meeting.id
      )

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

      // Send emails
      try {
        await sendEmail({
          to: meeting.employee.email,
          subject: 'Meeting Reminder: One-on-One Tomorrow',
          text: `Hi ${meeting.employee.name},\n\nThis is a reminder that you have a one-on-one meeting scheduled with ${meeting.reporter.name} tomorrow at ${meeting.meetingDate.toLocaleTimeString()}.\n\nPlease prepare any topics you'd like to discuss.\n\nBest,\nAMI One-on-One System`,
          html: `<p>Hi ${meeting.employee.name},</p><p>This is a reminder that you have a one-on-one meeting scheduled with <strong>${meeting.reporter.name}</strong> tomorrow at <strong>${meeting.meetingDate.toLocaleTimeString()}</strong>.</p><p>Please prepare any topics you'd like to discuss.</p><p>Best,<br/>AMI One-on-One System</p>`,
        })
      } catch (emailError) {
        console.error('Failed to send reminder email:', emailError)
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

function calculateNextMeetingDate(
  dayOfWeek: number,
  timeOfDay: string,
  frequency: RecurringFrequency,
  lastDate: Date
): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  
  let nextDate = new Date(lastDate)
  
  // Add the appropriate interval
  switch (frequency) {
    case 'WEEKLY':
      nextDate.setDate(nextDate.getDate() + 7)
      break
    case 'BIWEEKLY':
      nextDate.setDate(nextDate.getDate() + 14)
      break
    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + 1)
      // Adjust for day of week
      const currentDay = nextDate.getDay()
      let daysUntil = dayOfWeek - currentDay
      if (daysUntil < 0) daysUntil += 7
      nextDate.setDate(nextDate.getDate() + daysUntil)
      break
  }
  
  nextDate.setHours(hours, minutes, 0, 0)
  
  return nextDate
}
