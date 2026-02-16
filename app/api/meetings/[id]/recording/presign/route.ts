import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { generateSessionKey, isS3Configured } from '@/lib/s3'
import { UserRole } from '@prisma/client'

// POST — Start a recording session (creates DB record + returns session key)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { employee: true },
    })
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (
      !canAccessEmployeeData(user.role, user.id, meeting.employeeId, meeting.employee.reportsToId)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // S3 must be configured
    const s3Ok = await isS3Configured()
    if (!s3Ok) {
      return NextResponse.json(
        {
          error: 'S3 is not configured',
          detail: 'Configure AWS S3 in Admin → Settings → Recording Storage before recording.',
        },
        { status: 503 }
      )
    }

    // Check if there's already a completed recording
    const existing = await prisma.meetingRecording.findUnique({
      where: { meetingId: params.id },
    })
    if (existing && existing.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'A completed recording already exists for this meeting.' },
        { status: 400 }
      )
    }

    // Generate session key (S3 prefix for this recording's chunks)
    const sessionKey = generateSessionKey(params.id)

    // Create or update the recording record
    await prisma.meetingRecording.upsert({
      where: { meetingId: params.id },
      create: {
        meetingId: params.id,
        audioKey: sessionKey,
        duration: 0,
        fileSize: 0,
        status: 'UPLOADING',
        recordedAt: new Date(),
      },
      update: {
        audioKey: sessionKey,
        duration: 0,
        fileSize: 0,
        status: 'UPLOADING',
        recordedAt: new Date(),
        errorMessage: null,
      },
    })

    console.log(`[Recording] Session started: meeting=${params.id}, sessionKey=${sessionKey}`)

    return NextResponse.json({ sessionKey })
  } catch (error) {
    console.error('[Recording] Start session error:', error)
    return NextResponse.json({ error: 'Failed to start recording session' }, { status: 500 })
  }
}
