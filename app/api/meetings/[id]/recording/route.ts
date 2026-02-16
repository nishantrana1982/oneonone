import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getSignedDownloadUrl, deleteFromS3, isS3Configured } from '@/lib/s3'
import { UserRole } from '@prisma/client'

// GET — fetch recording status and playback URL
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { employee: true, recording: true },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (
      !canAccessEmployeeData(user.role, user.id, meeting.employeeId, meeting.employee.reportsToId)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!meeting.recording) {
      return NextResponse.json({ recording: null })
    }

    // Build playback URL
    let audioPlaybackUrl: string | null = null
    if (meeting.recording.audioKey) {
      try {
        const s3Ok = await isS3Configured()
        if (s3Ok) {
          audioPlaybackUrl = await getSignedDownloadUrl(meeting.recording.audioKey)
        }
      } catch {
        // S3 unavailable — no playback URL
      }
    }

    return NextResponse.json({
      recording: { ...meeting.recording, audioPlaybackUrl },
    })
  } catch (error) {
    console.error('[Recording] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 500 })
  }
}

// DELETE — delete recording from S3 + database
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { employee: true, recording: true },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (
      !canAccessEmployeeData(user.role, user.id, meeting.employeeId, meeting.employee.reportsToId)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!meeting.recording) {
      return NextResponse.json({ error: 'No recording found' }, { status: 404 })
    }

    // Delete from S3
    if (meeting.recording.audioKey) {
      try {
        const s3Ok = await isS3Configured()
        if (s3Ok) {
          await deleteFromS3(meeting.recording.audioKey)
        }
      } catch (err) {
        console.warn('[Recording] Failed to delete from S3:', err)
      }
    }

    // Delete from database
    await prisma.meetingRecording.delete({
      where: { id: meeting.recording.id },
    })

    return NextResponse.json({ message: 'Recording deleted' })
  } catch (error) {
    console.error('[Recording] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete recording' }, { status: 500 })
  }
}
