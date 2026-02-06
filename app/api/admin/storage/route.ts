import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getLocalStorageStats, getLocalStorageDir, isS3Configured } from '@/lib/s3'

// GET - Storage usage (admin only)
export async function GET() {
  try {
    await requireAdmin()

    const s3Configured = await isS3Configured()
    const { fileCount, totalBytes } = await getLocalStorageStats()
    const storageDir = getLocalStorageDir()

    return NextResponse.json({
      storageType: s3Configured ? 's3' : 'local',
      localStorage: {
        path: storageDir,
        fileCount,
        totalBytes,
        totalMB: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
      },
    })
  } catch (error) {
    console.error('Error fetching storage stats:', error)
    return NextResponse.json({ error: 'Failed to fetch storage stats' }, { status: 500 })
  }
}
