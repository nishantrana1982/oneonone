import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const isDraft = body.draft === true
    const isSubmit = !isDraft

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { employee: true, reporter: { select: { name: true, email: true } } },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (meeting.employeeId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const meetingDate = new Date(meeting.meetingDate)
    const isPastMeeting = meetingDate.getTime() < Date.now()

    // After meeting time, no edits if already submitted
    if (meeting.formSubmittedAt && isPastMeeting) {
      return NextResponse.json(
        { error: 'Form cannot be edited after the meeting time.' },
        { status: 403 }
      )
    }

    const data = {
      checkInPersonal: typeof body.checkInPersonal === 'string' ? body.checkInPersonal || null : null,
      checkInProfessional: typeof body.checkInProfessional === 'string' ? body.checkInProfessional || null : null,
      priorityGoalProfessional: typeof body.priorityGoalProfessional === 'string' ? body.priorityGoalProfessional || null : null,
      priorityGoalAgency: typeof body.priorityGoalAgency === 'string' ? body.priorityGoalAgency || null : null,
      progressReport: typeof body.progressReport === 'string' ? body.progressReport || null : null,
      goodNews: typeof body.goodNews === 'string' ? body.goodNews || null : null,
      supportNeeded: typeof body.supportNeeded === 'string' ? body.supportNeeded || null : null,
      priorityDiscussions: typeof body.priorityDiscussions === 'string' ? body.priorityDiscussions || null : null,
      headsUp: typeof body.headsUp === 'string' ? body.headsUp || null : null,
      anythingElse: typeof body.anythingElse === 'string' ? body.anythingElse || null : null,
    }

    if (isDraft) {
      // Save draft: update fields only, do not set formSubmittedAt or status
      const updatedMeeting = await prisma.meeting.update({
        where: { id: params.id },
        data,
        include: {
          employee: { select: { name: true } },
          reporter: { select: { name: true, email: true } },
        },
      })
      return NextResponse.json(updatedMeeting)
    }

    // Submit: update fields and set formSubmittedAt only. Reporter marks meeting completed after it happens.
    const wasAlreadySubmitted = !!meeting.formSubmittedAt
    const updatedMeeting = await prisma.meeting.update({
      where: { id: params.id },
      data: {
        ...data,
        formSubmittedAt: wasAlreadySubmitted ? meeting.formSubmittedAt : new Date(),
        // Do not set status to COMPLETED; meeting owner marks it complete after the meeting
      },
      include: {
        employee: { select: { name: true } },
        reporter: { select: { name: true, email: true } },
      },
    })

    if (!wasAlreadySubmitted) {
      // Send email notification
      try {
        const { sendFormSubmittedEmail } = await import('@/lib/email')
        await sendFormSubmittedEmail(
          updatedMeeting.reporter.email,
          updatedMeeting.reporter.name,
          updatedMeeting.employee.name,
          updatedMeeting.meetingDate,
          updatedMeeting.id
        )
      } catch (error) {
        console.error('Failed to send email notification:', error)
      }

      // Create in-app notification for the reporter
      try {
        const { notifyFormSubmitted } = await import('@/lib/notifications')
        await notifyFormSubmitted(
          meeting.reporterId,
          updatedMeeting.employee.name,
          updatedMeeting.id
        )
      } catch (error) {
        console.error('Failed to create notification:', error)
      }
    }

    return NextResponse.json(updatedMeeting)
  } catch (error) {
    console.error('Error updating meeting form:', error)
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 })
  }
}
