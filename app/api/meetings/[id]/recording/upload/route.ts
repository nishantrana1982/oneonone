import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { chunkKey, uploadToS3 } from '@/lib/s3'
import { UserRole } from '@prisma/client'

export const maxDuration = 300

// POST — Upload a single audio chunk during recording
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

    // Recording must already exist (started via /presign)
    const recording = await prisma.meetingRecording.findUnique({
      where: { meetingId: params.id },
    })
    if (!recording || !recording.audioKey) {
      return NextResponse.json(
        { error: 'No active recording session. Call start first.' },
        { status: 400 }
      )
    }

    // Parse form data
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      const tooLarge = /body|size|limit|413/i.test(msg)
      return NextResponse.json(
        { error: tooLarge ? 'Chunk too large' : 'Invalid request' },
        { status: tooLarge ? 413 : 400 }
      )
    }

    const file = formData.get('file') as File | null
    const sequenceStr = formData.get('sequence') as string | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No chunk data provided' }, { status: 400 })
    }

    const sequence = parseInt(sequenceStr || '0', 10)

    // Read bytes
    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload chunk to S3: {sessionKey}/chunk_0000.webm
    const key = chunkKey(recording.audioKey, sequence)
    await uploadToS3(buffer, key, 'audio/webm')

    // Accumulate file size in DB
    await prisma.meetingRecording.update({
      where: { meetingId: params.id },
      data: {
        fileSize: (recording.fileSize || 0) + buffer.length,
      },
    })

    console.log(
      `[Recording] Chunk ${sequence} uploaded: ${(buffer.length / 1024).toFixed(1)} KB, key=${key}`
    )

    return NextResponse.json({ success: true, chunkKey: key, sequence })
  } catch (error) {
    console.error('[Recording] Chunk upload error:', error)
    const detail = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to upload chunk', detail: detail.slice(0, 300) },
      { status: 500 }
    )
  }
}
