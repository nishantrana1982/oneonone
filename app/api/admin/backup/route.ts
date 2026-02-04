import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

// Get backup history
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const backups = await prisma.backupHistory.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(backups)
  } catch (error) {
    console.error('Error fetching backup history:', error)
    return NextResponse.json({ error: 'Failed to fetch backups' }, { status: 500 })
  }
}

// Create a new backup
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type = 'FULL' } = body

    // Create backup record
    const backup = await prisma.backupHistory.create({
      data: {
        type,
        status: 'IN_PROGRESS',
        createdBy: user.id,
      },
    })

    try {
      // Get counts
      const [
        users,
        departments,
        meetings,
        todos,
        recordings,
        notifications,
        auditLogs,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.department.count(),
        prisma.meeting.count(),
        prisma.todo.count(),
        prisma.meetingRecording.count(),
        prisma.notification.count(),
        prisma.auditLog.count(),
      ])

      const recordCount = {
        users,
        departments,
        meetings,
        todos,
        recordings,
        notifications,
        auditLogs,
      }

      // Export data
      const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        data: {
          users: await prisma.user.findMany({
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              departmentId: true,
              reportsToId: true,
              phone: true,
              title: true,
              bio: true,
              isActive: true,
              createdAt: true,
            },
          }),
          departments: await prisma.department.findMany(),
          meetings: await prisma.meeting.findMany({
            include: {
              todos: true,
              recording: {
                select: {
                  id: true,
                  transcript: true,
                  summary: true,
                  keyPoints: true,
                  sentiment: true,
                  qualityScore: true,
                  status: true,
                },
              },
            },
          }),
        },
      }

      // Convert to JSON string
      const jsonData = JSON.stringify(data, null, 2)
      const fileSize = Buffer.from(jsonData).length

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `ami-backup-${timestamp}.json`

      // Update backup record
      await prisma.backupHistory.update({
        where: { id: backup.id },
        data: {
          status: 'COMPLETED',
          fileName,
          fileSize,
          recordCount,
          tables: ['users', 'departments', 'meetings', 'todos', 'recordings'],
          completedAt: new Date(),
        },
      })

      // Log the action
      await createAuditLog({
        userId: user.id,
        action: 'EXPORT',
        entityType: 'Backup',
        entityId: backup.id,
        details: { type, recordCount },
      })

      return NextResponse.json({
        backup: { ...backup, status: 'COMPLETED', fileName, fileSize, recordCount },
        data: jsonData,
      })
    } catch (error) {
      // Mark backup as failed
      await prisma.backupHistory.update({
        where: { id: backup.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      })
      throw error
    }
  } catch (error) {
    console.error('Error creating backup:', error)
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 })
  }
}
