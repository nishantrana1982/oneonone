import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getLocalStorageStats, getLocalStorageDir, isS3Configured } from '@/lib/s3'

// GET - Storage usage (admin only)
export async function GET() {
  try {
    await requireAdmin()

    const s3Configured = await isS3Configured()
    const { fileCount, totalBytes } = await getLocalStorageStats()
    const storageDir = getLocalStorageDir()

    const agg = await prisma.meetingRecording.aggregate({
      _sum: { fileSize: true },
      _count: true,
    })
    const totalRecordingsBytes = agg._sum.fileSize ?? 0
    const recordingsCount = agg._count

    return NextResponse.json({
      storageType: s3Configured ? 's3' : 'local',
      localStorage: {
        path: storageDir,
        fileCount,
        totalBytes,
        totalMB: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
      },
      recordings: {
        count: recordingsCount,
        totalBytes: totalRecordingsBytes,
        totalMB: Math.round((totalRecordingsBytes / (1024 * 1024)) * 100) / 100,
      },
    })
  } catch (error) {
    console.error('Error fetching storage stats:', error)
    return NextResponse.json({ error: 'Failed to fetch storage stats' }, { status: 500 })
  }
}
