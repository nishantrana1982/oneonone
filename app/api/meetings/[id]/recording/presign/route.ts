import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData, getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getSignedUploadUrl, generateRecordingKey, isS3Configured } from '@/lib/s3'
import { UserRole } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])
    const body = await request.json()
    const { contentType, duration, fileSize } = body

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

    // Check if recording already exists
    const existingRecording = await prisma.meetingRecording.findUnique({
      where: { meetingId: params.id },
    })

    if (existingRecording && existingRecording.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Recording already exists for this meeting' },
        { status: 400 }
      )
    }

    // Check if S3 is configured
    const s3Configured = await isS3Configured()
    const key = generateRecordingKey(params.id)
    
    if (!s3Configured) {
      // Return flag to use local upload instead
      console.log('[Recording] S3 not configured, using local storage')
      return NextResponse.json({ 
        useLocalUpload: true, 
        key,
        message: 'S3 not configured, using local storage'
      })
    }

    // Generate S3 presigned URL
    let uploadUrl: string
    try {
      const result = await getSignedUploadUrl(key, contentType)
      uploadUrl = result.uploadUrl
    } catch (s3Error) {
      console.error('S3 presign error:', s3Error)
      // Fallback to local storage
      return NextResponse.json({ 
        useLocalUpload: true, 
        key,
        message: 'S3 error, using local storage'
      })
    }

    // Create or update recording record
    await prisma.meetingRecording.upsert({
      where: { meetingId: params.id },
      create: {
        meetingId: params.id,
        audioKey: key,
        duration,
        fileSize,
        status: 'UPLOADING',
        recordedAt: new Date(),
      },
      update: {
        audioKey: key,
        duration,
        fileSize,
        status: 'UPLOADING',
        recordedAt: new Date(),
        errorMessage: null,
      },
    })

    return NextResponse.json({ uploadUrl, key, useLocalUpload: false })
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}
