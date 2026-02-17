import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

// Simple sentiment keywords
const positiveWords = ['great', 'excellent', 'good', 'amazing', 'fantastic', 'happy', 'success', 'achieved', 'completed', 'progress', 'improved', 'better', 'love', 'excited', 'proud', 'wonderful', 'awesome']
const negativeWords = ['bad', 'poor', 'issue', 'problem', 'difficult', 'struggle', 'challenge', 'frustrated', 'concerned', 'worried', 'stuck', 'blocked', 'delay', 'missed', 'failed', 'stress', 'overwhelmed']

function analyzeSentiment(text: string): { score: number; label: string } {
  if (!text) return { score: 0, label: 'neutral' }
  
  const words = text.toLowerCase().split(/\s+/)
  let positiveCount = 0
  let negativeCount = 0
  
  words.forEach(word => {
    if (positiveWords.some(pw => word.includes(pw))) positiveCount++
    if (negativeWords.some(nw => word.includes(nw))) negativeCount++
  })
  
  const total = positiveCount + negativeCount
  if (total === 0) return { score: 0, label: 'neutral' }
  
  const score = (positiveCount - negativeCount) / total
  const label = score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral'
  
  return { score: Math.round(score * 100) / 100, label }
}

function extractCommonIssues(meetings: Array<{ supportNeeded: string | null; priorityDiscussions: string | null; headsUp: string | null }>): Array<{ text: string; count: number; category: string }> {
  const issueKeywords: Record<string, string[]> = {
    'Workload': ['workload', 'too much', 'overwhelmed', 'capacity', 'bandwidth', 'busy'],
    'Communication': ['communication', 'unclear', 'miscommunication', 'feedback', 'response'],
    'Resources': ['resources', 'tools', 'equipment', 'access', 'software', 'hardware'],
    'Training': ['training', 'learning', 'skills', 'development', 'knowledge'],
    'Process': ['process', 'workflow', 'efficiency', 'bottleneck', 'approval'],
    'Timeline': ['deadline', 'timeline', 'delay', 'schedule', 'time'],
    'Support': ['support', 'help', 'guidance', 'assistance', 'mentor'],
    'Client': ['client', 'customer', 'stakeholder', 'expectation'],
  }
  
  const issueCounts: Record<string, number> = {}
  
  meetings.forEach(meeting => {
    const textFields = [
      meeting.supportNeeded,
      meeting.priorityDiscussions,
      meeting.headsUp,
    ].filter(Boolean).join(' ').toLowerCase()
    
    Object.entries(issueKeywords).forEach(([category, keywords]) => {
      if (keywords.some(kw => textFields.includes(kw))) {
        issueCounts[category] = (issueCounts[category] || 0) + 1
      }
    })
  })
  
  return Object.entries(issueCounts)
    .map(([category, count]) => ({ text: category, count, category }))
    .filter(issue => issue.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

function calculateTrends(meetings: Array<{ status: string }>, todos: Array<{ status: string; priority: string }>): Record<string, string> {
  const trends: Record<string, string> = {}
  
  // Meeting completion rate
  const completedMeetings = meetings.filter(m => m.status === 'COMPLETED').length
  const totalMeetings = meetings.length
  trends['Meeting Completion Rate'] = totalMeetings > 0 
    ? `${Math.round((completedMeetings / totalMeetings) * 100)}%` 
    : 'N/A'
  
  // Task completion rate
  const completedTasks = todos.filter(t => t.status === 'DONE').length
  const totalTasks = todos.length
  trends['Task Completion Rate'] = totalTasks > 0 
    ? `${Math.round((completedTasks / totalTasks) * 100)}%` 
    : 'N/A'
  
  // Average tasks per meeting
  trends['Avg Tasks per Meeting'] = totalMeetings > 0 
    ? `${(totalTasks / totalMeetings).toFixed(1)}` 
    : 'N/A'
  
  // High priority tasks
  const highPriorityTasks = todos.filter(t => t.priority === 'HIGH').length
  trends['High Priority Tasks'] = `${highPriorityTasks}`
  
  return trends
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const format = searchParams.get('format') // 'json' or 'csv'

    // Build filters
    const meetingWhere: { meetingDate?: { gte?: Date; lte?: Date }; employeeId?: { in: string[] } } = {}
    const todoWhere: { assignedToId?: { in: string[] } } = {}
    const userWhere: { isActive: boolean; departmentId?: string } = { isActive: true }

    if (departmentId) {
      userWhere.departmentId = departmentId
    }

    if (startDate || endDate) {
      meetingWhere.meetingDate = {}
      if (startDate) meetingWhere.meetingDate.gte = new Date(startDate)
      if (endDate) meetingWhere.meetingDate.lte = new Date(endDate)
    }

    // Get users in scope
    const usersInScope = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, email: true, department: { select: { name: true } } },
    })

    const userIds = usersInScope.map(u => u.id)
    meetingWhere.employeeId = { in: userIds }
    todoWhere.assignedToId = { in: userIds }

    // Get meetings with form data
    const meetings = await prisma.meeting.findMany({
      where: meetingWhere,
      include: {
        employee: { select: { name: true, department: { select: { name: true } } } },
        reporter: { select: { name: true } },
      },
      orderBy: { meetingDate: 'desc' },
    })

    // Get todos
    const todos = await prisma.todo.findMany({
      where: todoWhere,
      include: {
        assignedTo: { select: { name: true } },
      },
    })

    // Calculate summary
    const completedMeetings = meetings.filter(m => m.status === 'COMPLETED').length
    const scheduledMeetings = meetings.filter(m => m.status === 'SCHEDULED').length
    const completedTasks = todos.filter(t => t.status === 'DONE').length
    const pendingTasks = todos.filter(t => t.status !== 'DONE').length
    const overdueTasks = todos.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE'
    ).length

    // Analyze sentiment from meeting responses
    const sentimentData = meetings
      .filter(m => m.checkInProfessional || m.goodNews || m.supportNeeded)
      .map(m => {
        const text = [m.checkInProfessional, m.goodNews, m.supportNeeded].filter(Boolean).join(' ')
        return analyzeSentiment(text)
      })

    const overallSentiment = sentimentData.length > 0
      ? {
          positive: sentimentData.filter(s => s.label === 'positive').length,
          neutral: sentimentData.filter(s => s.label === 'neutral').length,
          negative: sentimentData.filter(s => s.label === 'negative').length,
          averageScore: Math.round(sentimentData.reduce((sum, s) => sum + s.score, 0) / sentimentData.length * 100) / 100,
        }
      : null

    // Extract common issues
    const commonIssues = extractCommonIssues(meetings)

    // Calculate trends
    const trends = calculateTrends(meetings, todos)

    const reportData = {
      generatedAt: new Date().toISOString(),
      period: {
        start: startDate || 'All time',
        end: endDate || 'Present',
      },
      filters: {
        departmentId: departmentId || 'All departments',
      },
      summary: {
        totalMeetings: meetings.length,
        completedMeetings,
        scheduledMeetings,
        totalTasks: todos.length,
        completedTasks,
        pendingTasks,
        overdueTasks,
        totalEmployees: usersInScope.length,
      },
      sentiment: overallSentiment,
      commonIssues,
      trends,
      meetings: meetings.map(m => ({
        id: m.id,
        date: m.meetingDate,
        employee: m.employee.name,
        department: m.employee.department?.name || 'N/A',
        reporter: m.reporter.name,
        status: m.status,
        hasFormData: !!(m.checkInPersonal || m.checkInProfessional),
      })),
    }

    // Return CSV format if requested
    if (format === 'csv') {
      const csvRows = [
        ['Report Generated', reportData.generatedAt],
        ['Period', `${reportData.period.start} to ${reportData.period.end}`],
        [''],
        ['Summary'],
        ['Total Meetings', reportData.summary.totalMeetings],
        ['Completed Meetings', reportData.summary.completedMeetings],
        ['Total Tasks', reportData.summary.totalTasks],
        ['Completed Tasks', reportData.summary.completedTasks],
        ['Pending Tasks', reportData.summary.pendingTasks],
        ['Overdue Tasks', reportData.summary.overdueTasks],
        [''],
        ['Trends'],
        ...Object.entries(trends).map(([key, value]) => [key, value]),
        [''],
        ['Common Issues'],
        ...commonIssues.map(issue => [issue.text, `${issue.count} mentions`]),
        [''],
        ['Meetings'],
        ['Date', 'Employee', 'Department', 'Reporter', 'Status', 'Form Submitted'],
        ...meetings.map(m => [
          new Date(m.meetingDate).toLocaleDateString(),
          m.employee.name,
          m.employee.department?.name || 'N/A',
          m.reporter.name,
          m.status,
          m.checkInPersonal ? 'Yes' : 'No',
        ]),
      ]

      const csv = csvRows.map(row => row.join(',')).join('\n')
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json(reportData)
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
