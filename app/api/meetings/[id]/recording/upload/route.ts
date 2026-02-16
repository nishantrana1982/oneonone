import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { generateRecordingKey, isS3Configured, uploadToS3 } from '@/lib/s3'
import { UserRole } from '@prisma/client'

export const maxDuration = 1500

function sanitizeError(msg: string): string {
  if (!msg || typeof msg !== 'string') return 'Unknown error'
  return msg
    .replace(/\b(AKIA|A3T|ABIA)[A-Z0-9]{14,}/gi, '[REDACTED]')
    .replace(/\b[0-9a-fA-F]{40,}\b/g, '[REDACTED]')
    .slice(0, 300)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    // Meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { employee: true },
    })
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Access check
    if (
      !canAccessEmployeeData(user.role, user.id, meeting.employeeId, meeting.employee.reportsToId)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Parse form data
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      const tooLarge = /body|size|limit|413/i.test(msg)
      return NextResponse.json(
        {
          error: tooLarge ? 'Recording too large' : 'Invalid request',
          detail: tooLarge
            ? 'The recording file is too large. Try a shorter recording or increase the server upload limit.'
            : 'Could not read upload data.',
        },
        { status: tooLarge ? 413 : 400 }
      )
    }

    const file = formData.get('file') as File | null
    const duration = formData.get('duration') as string | null

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: 'No file provided', detail: 'The recording file was empty or missing.' },
        { status: 400 }
      )
    }

    console.log(`[Recording] Upload received: ${(file.size / 1024 / 1024).toFixed(2)} MB, meeting=${params.id}`)

    // Read file bytes
    let buffer: Buffer
    try {
      buffer = Buffer.from(await file.arrayBuffer())
    } catch (err: unknown) {
      return NextResponse.json(
        { error: 'Failed to read recording', detail: 'Could not read the uploaded file bytes.' },
        { status: 400 }
      )
    }

    // S3 check — S3 must be configured
    let s3Ready: boolean
    try {
      s3Ready = await isS3Configured()
    } catch {
      return NextResponse.json(
        {
          error: 'Storage configuration error',
          detail: 'Could not read S3 settings. Check Admin → Settings and server logs.',
        },
        { status: 503 }
      )
    }

    if (!s3Ready) {
      return NextResponse.json(
        {
          error: 'S3 is not configured',
          detail: 'Configure AWS S3 in Admin → Settings → Recording Storage before uploading recordings.',
        },
        { status: 503 }
      )
    }

    // Upload to S3
    const key = generateRecordingKey(params.id)
    console.log(`[Recording] Uploading to S3 key=${key} size=${buffer.length}`)

    try {
      await uploadToS3(buffer, key, file.type || 'audio/webm')
    } catch (s3Err: unknown) {
      const detail = s3Err instanceof Error ? s3Err.message : 'Unknown S3 error'
      console.error('[Recording] S3 upload failed:', detail)
      return NextResponse.json(
        {
          error: 'S3 upload failed',
          detail: sanitizeError(detail),
        },
        { status: 502 }
      )
    }

    console.log(`[Recording] S3 upload success, saving DB record`)

    // Save to database
    const recording = await prisma.meetingRecording.upsert({
      where: { meetingId: params.id },
      create: {
        meetingId: params.id,
        audioKey: key,
        duration: parseInt(duration || '0') || 0,
        fileSize: buffer.length,
        status: 'UPLOADED',
        recordedAt: new Date(),
      },
      update: {
        audioKey: key,
        duration: parseInt(duration || '0') || 0,
        fileSize: buffer.length,
        status: 'UPLOADED',
        recordedAt: new Date(),
        errorMessage: null,
      },
    })

    return NextResponse.json({
      key,
      recordingId: recording.id,
      message: 'File uploaded to S3 successfully',
    })
  } catch (error) {
    console.error('[Recording] Upload route error:', error)
    const detail = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to upload recording', detail: sanitizeError(detail) },
      { status: 500 }
    )
  }
}
