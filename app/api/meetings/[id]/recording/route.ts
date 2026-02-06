import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getSignedDownloadUrl, deleteFromS3, isS3Configured, deleteFromLocalStorage } from '@/lib/s3'
import { UserRole } from '@prisma/client'

// GET - Fetch recording details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: {
        employee: true,
        recording: true,
      },
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

    if (!meeting.recording) {
      return NextResponse.json({ recording: null })
    }

    // Generate playback URL: S3 signed URL if configured, else local stream URL
    let audioPlaybackUrl: string | null = null
    if (meeting.recording.audioKey) {
      const s3Configured = await isS3Configured()
      if (s3Configured) {
        try {
          audioPlaybackUrl = await getSignedDownloadUrl(meeting.recording.audioKey)
        } catch {
          // Fall back to local stream if S3 fails
          audioPlaybackUrl = `/api/meetings/${params.id}/recording/stream`
        }
      } else {
        audioPlaybackUrl = `/api/meetings/${params.id}/recording/stream`
      }
    }

    return NextResponse.json({
      recording: {
        ...meeting.recording,
        audioPlaybackUrl,
      },
    })
  } catch (error) {
    console.error('Error fetching recording:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recording' },
      { status: 500 }
    )
  }
}

// DELETE - Delete recording
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: {
        employee: true,
        recording: true,
      },
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

    if (!meeting.recording) {
      return NextResponse.json({ error: 'No recording found' }, { status: 404 })
    }

    // Delete from storage (S3 or local)
    if (meeting.recording.audioKey) {
      const s3Configured = await isS3Configured()
      if (s3Configured) {
        try {
          await deleteFromS3(meeting.recording.audioKey)
        } catch (err) {
          console.warn('Failed to delete from S3:', err)
        }
      } else {
        try {
          await deleteFromLocalStorage(meeting.recording.audioKey)
        } catch (err) {
          console.warn('Failed to delete from local storage:', err)
        }
      }
    }

    // Delete from database
    await prisma.meetingRecording.delete({
      where: { id: meeting.recording.id },
    })

    return NextResponse.json({ message: 'Recording deleted' })
  } catch (error) {
    console.error('Error deleting recording:', error)
    return NextResponse.json(
      { error: 'Failed to delete recording' },
      { status: 500 }
    )
  }
}
