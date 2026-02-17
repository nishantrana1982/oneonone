import { NextRequest, NextResponse } from 'next/server'
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { generateOrganizationInsights } from '@/lib/openai'
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
    const departmentId = searchParams.get('departmentId')
    const period = searchParams.get('period') || '30' // days
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(period))

    // Build where clause
    const whereClause: Prisma.MeetingWhereInput = {
      meetingDate: { gte: startDate },
      recording: {
        is: {
          status: 'COMPLETED',
          sentiment: { not: Prisma.JsonNull },
        },
      },
    }

    // Reporters can only see their direct reports
    if (user.role === UserRole.REPORTER) {
      whereClause.reporterId = user.id
    }

    // Filter by department
    if (departmentId) {
      whereClause.employee = {
        departmentId,
      }
    }

    // Get meetings with completed recordings
    const meetings = await prisma.meeting.findMany({
      where: whereClause,
      include: {
        employee: {
          include: { department: true },
        },
        recording: true,
      },
      orderBy: { meetingDate: 'desc' },
    })

    // Calculate basic stats
    const totalMeetings = meetings.length
    const recordingsWithAnalysis = meetings.filter(m => m.recording?.qualityScore)
    
    const avgQualityScore = recordingsWithAnalysis.length > 0
      ? Math.round(
          recordingsWithAnalysis.reduce((acc, m) => acc + (m.recording?.qualityScore || 0), 0) /
          recordingsWithAnalysis.length
        )
      : 0

    // Aggregate by department
    const departmentStats: Record<string, {
      meetings: number
      avgQuality: number
      sentiments: Array<{ score: number; label: string } | unknown>
      themes: string[]
    }> = {}

    for (const meeting of meetings) {
      const deptName = meeting.employee.department?.name || 'Unassigned'
      
      if (!departmentStats[deptName]) {
        departmentStats[deptName] = {
          meetings: 0,
          avgQuality: 0,
          sentiments: [],
          themes: [],
        }
      }

      departmentStats[deptName].meetings++
      
      if (meeting.recording?.qualityScore) {
        departmentStats[deptName].avgQuality += meeting.recording.qualityScore
      }
      
      if (meeting.recording?.sentiment) {
        departmentStats[deptName].sentiments.push(meeting.recording.sentiment)
      }

      if (meeting.recording?.keyPoints) {
        const keyPoints = meeting.recording.keyPoints as string[]
        departmentStats[deptName].themes.push(...keyPoints)
      }
    }

    // Calculate averages
    for (const dept of Object.keys(departmentStats)) {
      const meetingsWithQuality = meetings.filter(
        m => m.employee.department?.name === dept && m.recording?.qualityScore
      ).length
      
      if (meetingsWithQuality > 0) {
        departmentStats[dept].avgQuality = Math.round(
          departmentStats[dept].avgQuality / meetingsWithQuality
        )
      }
    }

    // Get language distribution
    const languageDistribution: Record<string, number> = {}
    for (const meeting of meetings) {
      if (meeting.recording?.language) {
        const lang = meeting.recording.language
        languageDistribution[lang] = (languageDistribution[lang] || 0) + 1
      }
    }

    // Prepare data for AI insights if we have enough data
    let aiInsights = null
    if (recordingsWithAnalysis.length >= 3) {
      const summariesForAI = recordingsWithAnalysis.map(m => ({
        department: m.employee.department?.name || 'Unassigned',
        sentiment: (m.recording?.sentiment as { score: number; label: string } | null) ?? null,
        keyPoints: (m.recording?.keyPoints as string[]) || [],
        commonThemes: [] as string[],
        qualityScore: m.recording?.qualityScore || 0,
      }))

      try {
        aiInsights = await generateOrganizationInsights(summariesForAI)
      } catch (err) {
        console.error('Failed to generate AI insights:', err)
      }
    }

    // Sentiment distribution
    const sentimentDistribution = {
      positive: 0,
      neutral: 0,
      negative: 0,
    }

    for (const meeting of meetings) {
      if (meeting.recording?.sentiment) {
        const sentiment = meeting.recording.sentiment as { label?: string }
        const label = sentiment.label as 'positive' | 'neutral' | 'negative' | undefined
        if (label && label in sentimentDistribution) {
          sentimentDistribution[label]++
        }
      }
    }

    // Recent meetings for trend
    const recentMeetings = meetings.slice(0, 10).map(m => ({
      id: m.id,
      date: m.meetingDate,
      employee: m.employee.name,
      department: m.employee.department?.name,
      qualityScore: m.recording?.qualityScore,
      sentiment: (m.recording?.sentiment as { label?: string } | null)?.label,
    }))

    return NextResponse.json({
      period: parseInt(period),
      stats: {
        totalMeetings,
        totalRecordings: recordingsWithAnalysis.length,
        avgQualityScore,
      },
      departmentStats,
      languageDistribution,
      sentimentDistribution,
      recentMeetings,
      aiInsights,
    })
  } catch (error) {
    console.error('Error fetching insights:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    )
  }
}
