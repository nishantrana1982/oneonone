import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getSignedDownloadUrl, isS3Configured } from '@/lib/s3'
import { UserRole } from '@prisma/client'

// GET — redirect to S3 signed URL for audio playback
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

    if (!meeting || !meeting.recording?.audioKey) {
      return new NextResponse('Not Found', { status: 404 })
    }

    if (
      !canAccessEmployeeData(user.role, user.id, meeting.employeeId, meeting.employee.reportsToId)
    ) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const s3Ok = await isS3Configured()
    if (!s3Ok) {
      return new NextResponse('S3 not configured', { status: 503 })
    }

    const url = await getSignedDownloadUrl(meeting.recording.audioKey)
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('[Recording] Stream error:', error)
    return new NextResponse('Failed to stream recording', { status: 500 })
  }
}
