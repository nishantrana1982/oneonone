import { NextRequest, NextResponse } from 'next/server'
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { searchTranscripts } from '@/lib/openai'
import { UserRole, Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    let user
    try {
      user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])
    } catch (authError) {
      if (authError instanceof UnauthorizedError) {
        return NextResponse.json({ error: 'Please sign in to continue' }, { status: 401 })
      }
      if (authError instanceof ForbiddenError) {
        return NextResponse.json({ error: 'You do not have permission to access this feature' }, { status: 403 })
      }
      throw authError
    }
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const departmentId = searchParams.get('departmentId')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query) {
      return NextResponse.json({ error: 'Search query required' }, { status: 400 })
    }

    // Build where clause based on role
    const whereClause: Prisma.MeetingWhereInput = {
      recording: {
        is: {
          status: 'COMPLETED',
          transcript: { not: null },
        },
      },
    }

    // Reporters can only search their direct reports
    if (user.role === UserRole.REPORTER) {
      whereClause.reporterId = user.id
    }

    // Filter by department if specified
    if (departmentId) {
      whereClause.employee = {
        departmentId,
      }
    }

    // Get meetings with recordings
    const meetings = await prisma.meeting.findMany({
      where: whereClause,
      include: {
        employee: {
          include: { department: true },
        },
        reporter: true,
        recording: true,
      },
      orderBy: { meetingDate: 'desc' },
      take: 100, // Get more for better search results
    })

    // Prepare transcripts for search
    const transcripts = meetings
      .filter(m => m.recording?.transcript)
      .map(m => ({
        id: m.recording!.id,
        meetingId: m.id,
        text: m.recording!.transcript!,
      }))

    if (transcripts.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // Use AI to search transcripts
    const searchResults = await searchTranscripts(transcripts, query)

    // Enrich results with meeting details
    const enrichedResults = searchResults.slice(0, limit).map(result => {
      const meeting = meetings.find(m => m.id === result.meetingId)
      return {
        ...result,
        meeting: meeting ? {
          id: meeting.id,
          date: meeting.meetingDate,
          employee: {
            id: meeting.employee.id,
            name: meeting.employee.name,
            department: meeting.employee.department?.name,
          },
          reporter: {
            id: meeting.reporter.id,
            name: meeting.reporter.name,
          },
        } : null,
      }
    })

    return NextResponse.json({ results: enrichedResults })
  } catch (error) {
    console.error('Error searching recordings:', error)
    return NextResponse.json(
      { error: 'Failed to search recordings' },
      { status: 500 }
    )
  }
}
