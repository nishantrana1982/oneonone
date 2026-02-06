import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// GET - List all recordings (admin only), for storage management
export async function GET() {
  try {
    await requireAdmin()

    const recordings = await prisma.meetingRecording.findMany({
      orderBy: { recordedAt: 'desc' },
      include: {
        meeting: {
          include: {
            employee: { select: { name: true, email: true } },
            reporter: { select: { name: true } },
          },
        },
      },
    })

    const list = recordings.map((r) => ({
      id: r.id,
      meetingId: r.meetingId,
      meetingDate: r.meeting?.meetingDate ? r.meeting.meetingDate.toISOString() : null,
      employeeName: r.meeting?.employee?.name ?? null,
      reporterName: r.meeting?.reporter?.name ?? null,
      status: r.status,
      duration: r.duration,
      fileSize: r.fileSize,
      recordedAt: r.recordedAt ? r.recordedAt.toISOString() : null,
    }))

    return NextResponse.json(list)
  } catch (error) {
    console.error('Error listing recordings:', error)
    return NextResponse.json({ error: 'Failed to list recordings' }, { status: 500 })
  }
}
