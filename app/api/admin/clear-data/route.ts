import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { clearType, keepCurrentUser } = body

    // Get counts before deletion for reporting
    const counts = {
      recordings: await prisma.meetingRecording.count(),
      todos: await prisma.todo.count(),
      meetings: await prisma.meeting.count(),
      calendarEvents: await prisma.calendarEvent.count(),
      users: await prisma.user.count(),
      departments: await prisma.department.count(),
    }

    let deleted = {
      recordings: 0,
      todos: 0,
      meetings: 0,
      calendarEvents: 0,
      users: 0,
      departments: 0,
    }

    // Clear data based on type
    if (clearType === 'all' || clearType === 'recordings') {
      const result = await prisma.meetingRecording.deleteMany({})
      deleted.recordings = result.count
    }

    if (clearType === 'all' || clearType === 'todos') {
      const result = await prisma.todo.deleteMany({})
      deleted.todos = result.count
    }

    if (clearType === 'all' || clearType === 'meetings') {
      // Delete calendar events first (foreign key constraint)
      const calResult = await prisma.calendarEvent.deleteMany({})
      deleted.calendarEvents = calResult.count

      // Delete recordings first (foreign key constraint)
      if (clearType !== 'recordings') {
        const recResult = await prisma.meetingRecording.deleteMany({})
        deleted.recordings = recResult.count
      }

      // Delete todos associated with meetings
      if (clearType !== 'todos') {
        const todoResult = await prisma.todo.deleteMany({})
        deleted.todos = todoResult.count
      }

      const result = await prisma.meeting.deleteMany({})
      deleted.meetings = result.count
    }

    if (clearType === 'all' || clearType === 'users') {
      // First clear foreign key references
      if (clearType !== 'meetings') {
        await prisma.calendarEvent.deleteMany({})
        await prisma.meetingRecording.deleteMany({})
        await prisma.todo.deleteMany({})
        await prisma.meeting.deleteMany({})
      }

      // Clear reportsTo relationships
      await prisma.user.updateMany({
        data: { reportsToId: null }
      })

      if (keepCurrentUser) {
        // Delete all users except the current one
        const result = await prisma.user.deleteMany({
          where: { 
            id: { not: currentUser.id }
          }
        })
        deleted.users = result.count
      } else {
        const result = await prisma.user.deleteMany({})
        deleted.users = result.count
      }
    }

    if (clearType === 'all' || clearType === 'departments') {
      // Remove department references from users first
      await prisma.user.updateMany({
        data: { departmentId: null }
      })
      
      const result = await prisma.department.deleteMany({})
      deleted.departments = result.count
    }

    return NextResponse.json({
      success: true,
      message: 'Data cleared successfully',
      deleted,
      previous: counts,
    })
  } catch (error) {
    console.error('Error clearing data:', error)
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    // Get current counts
    const counts = {
      recordings: await prisma.meetingRecording.count(),
      todos: await prisma.todo.count(),
      meetings: await prisma.meeting.count(),
      calendarEvents: await prisma.calendarEvent.count(),
      users: await prisma.user.count(),
      departments: await prisma.department.count(),
    }

    return NextResponse.json(counts)
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
