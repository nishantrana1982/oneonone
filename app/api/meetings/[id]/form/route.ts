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

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { employee: true },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (meeting.employeeId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updatedMeeting = await prisma.meeting.update({
      where: { id: params.id },
      data: {
        checkInPersonal: body.checkInPersonal || null,
        checkInProfessional: body.checkInProfessional || null,
        priorityGoalProfessional: body.priorityGoalProfessional || null,
        priorityGoalAgency: body.priorityGoalAgency || null,
        progressReport: body.progressReport || null,
        goodNews: body.goodNews || null,
        supportNeeded: body.supportNeeded || null,
        priorityDiscussions: body.priorityDiscussions || null,
        headsUp: body.headsUp || null,
        anythingElse: body.anythingElse || null,
        status: 'COMPLETED',
      },
      include: {
        employee: { select: { name: true, email: true } },
        reporter: { select: { name: true, email: true } },
      },
    })

    // Send email notification to reporter
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
      // Continue even if email fails
    }

    return NextResponse.json(updatedMeeting)
  } catch (error) {
    console.error('Error updating meeting form:', error)
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 })
  }
}
