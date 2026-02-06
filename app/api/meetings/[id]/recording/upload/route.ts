import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { saveToLocalStorage, generateRecordingKey, isS3Configured, uploadToS3 } from '@/lib/s3'
import { UserRole } from '@prisma/client'

// Allow up to 5 minutes for large uploads
export const maxDuration = 300

// This route handles direct file uploads when S3 is not configured
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    // Get the meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { employee: true },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Check access
    const canAccess = canAccessEmployeeData(
      user.role,
      user.id,
      meeting.employeeId,
      meeting.employee.reportsToId
    )

    if (!canAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get the file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const duration = formData.get('duration') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const key = generateRecordingKey(params.id)
    const buffer = Buffer.from(await file.arrayBuffer())

    // Store in S3 when configured (saves server disk); otherwise fallback to local
    const useS3 = await isS3Configured()
    if (useS3) {
      await uploadToS3(buffer, key, 'audio/webm')
    } else {
      await saveToLocalStorage(buffer, key)
    }

    const recording = await prisma.meetingRecording.upsert({
      where: { meetingId: params.id },
      create: {
        meetingId: params.id,
        audioKey: key,
        duration: parseInt(duration) || 0,
        fileSize: buffer.length,
        status: 'UPLOADED',
        recordedAt: new Date(),
      },
      update: {
        audioKey: key,
        duration: parseInt(duration) || 0,
        fileSize: buffer.length,
        status: 'UPLOADED',
        recordedAt: new Date(),
        errorMessage: null,
      },
    })

    return NextResponse.json({
      key,
      recordingId: recording.id,
      message: useS3 ? 'File uploaded to S3' : 'File uploaded to local storage',
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
