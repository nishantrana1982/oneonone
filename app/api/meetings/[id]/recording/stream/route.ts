import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { readFromLocalStorage } from '@/lib/s3'
import { UserRole } from '@prisma/client'

// GET - Stream audio file from local storage (used when S3 is not configured)
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

    const canAccess = canAccessEmployeeData(
      user.role,
      user.id,
      meeting.employeeId,
      meeting.employee.reportsToId
    )
    if (!canAccess) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const buffer = await readFromLocalStorage(meeting.recording.audioKey)
    const body = new Uint8Array(buffer)

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'audio/webm',
        'Content-Length': String(buffer.length),
      },
    })
  } catch (error) {
    console.error('Error streaming recording:', error)
    return new NextResponse('Failed to stream recording', { status: 500 })
  }
}
