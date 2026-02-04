import { NextRequest, NextResponse } from 'next/server'
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import OpenAI from 'openai'
import { UserRole } from '@prisma/client'

export async function POST(request: NextRequest) {
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
    const body = await request.json()
    const { question, departmentId } = body

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Get OpenAI settings
    const settings = await getSettings()
    if (!settings.openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please configure it in Admin > Settings.' },
        { status: 400 }
      )
    }

    // Build where clause
    const whereClause: any = {
      status: 'COMPLETED',
    }

    // Reporters can only see their direct reports
    if (user.role === UserRole.REPORTER) {
      whereClause.meeting = {
        reporterId: user.id,
      }
    }

    // Filter by department if specified
    if (departmentId) {
      whereClause.meeting = {
        ...whereClause.meeting,
        employee: {
          departmentId,
        },
      }
    }

    // Get all completed meetings with their data
    const meetings = await prisma.meeting.findMany({
      where: user.role === UserRole.REPORTER 
        ? { reporterId: user.id }
        : departmentId 
          ? { employee: { departmentId } }
          : {},
      include: {
        employee: {
          include: { department: true },
        },
        reporter: true,
        recording: {
          where: { status: 'COMPLETED' },
        },
      },
      orderBy: { meetingDate: 'desc' },
      take: 100, // Limit to recent 100 meetings
    })

    // Prepare data for analysis
    const meetingData = meetings.map(m => ({
      date: m.meetingDate.toISOString().split('T')[0],
      employee: m.employee.name,
      department: m.employee.department?.name || 'Unassigned',
      // Form responses
      checkInPersonal: m.checkInPersonal,
      checkInProfessional: m.checkInProfessional,
      priorityGoalProfessional: m.priorityGoalProfessional,
      priorityGoalAgency: m.priorityGoalAgency,
      progressReport: m.progressReport,
      goodNews: m.goodNews,
      supportNeeded: m.supportNeeded,
      priorityDiscussions: m.priorityDiscussions,
      headsUp: m.headsUp,
      anythingElse: m.anythingElse,
      // Recording analysis
      transcript: m.recording?.transcript,
      summary: m.recording?.summary,
      keyPoints: m.recording?.keyPoints,
      sentiment: m.recording?.sentiment,
    })).filter(m => 
      // Only include meetings with some data
      m.checkInPersonal || m.checkInProfessional || m.transcript || m.summary
    )

    if (meetingData.length === 0) {
      return NextResponse.json({
        answer: "I don't have enough meeting data to analyze. Please ensure there are completed meetings with form submissions or recordings.",
        sources: [],
        insights: [],
      })
    }

    // Create OpenAI client
    const openai = new OpenAI({ apiKey: settings.openaiApiKey })

    // Prepare the context
    const context = meetingData.map((m, i) => `
Meeting ${i + 1} (${m.date}) - ${m.employee} (${m.department}):
${m.checkInProfessional ? `Professional Check-in: ${m.checkInProfessional}` : ''}
${m.supportNeeded ? `Support Needed: ${m.supportNeeded}` : ''}
${m.priorityDiscussions ? `Priority Discussions: ${m.priorityDiscussions}` : ''}
${m.headsUp ? `Heads Up: ${m.headsUp}` : ''}
${m.anythingElse ? `Other Notes: ${m.anythingElse}` : ''}
${m.summary ? `Meeting Summary: ${m.summary}` : ''}
${m.keyPoints ? `Key Points: ${JSON.stringify(m.keyPoints)}` : ''}
${m.sentiment ? `Sentiment: ${JSON.stringify(m.sentiment)}` : ''}
`.trim()).join('\n\n---\n\n')

    const systemPrompt = `You are an HR analytics expert analyzing one-on-one meeting data from an organization. 
Your job is to answer questions about patterns, trends, and common themes across all meetings.

You have access to data from ${meetingData.length} meetings across the organization.
${departmentId ? 'This data is filtered to a specific department.' : 'This data includes all departments.'}

When answering:
1. Be specific and cite examples where relevant
2. Identify common patterns and themes
3. Quantify when possible (e.g., "3 out of 10 employees mentioned...")
4. Organize findings by priority or frequency
5. Suggest actionable recommendations

The data may be in English, Hindi, or Gujarati. Analyze all languages and respond in English.`

    const userPrompt = `Based on the following one-on-one meeting data, please answer this question:

"${question}"

Meeting Data:
${context}

Please provide:
1. A clear, detailed answer to the question
2. A list of the top findings/patterns (ranked by frequency or importance)
3. Specific examples from the data
4. Recommendations based on the findings

Format your response as JSON:
{
  "answer": "Your detailed answer here",
  "topFindings": [
    { "finding": "Description", "frequency": "How many mentioned", "severity": "high/medium/low" }
  ],
  "examples": [
    { "employee": "Name", "department": "Dept", "quote": "Relevant quote or summary" }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "summary": "One-sentence executive summary"
}`

    const response = await openai.chat.completions.create({
      model: settings.openaiModel || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const analysis = JSON.parse(content)

    return NextResponse.json({
      question,
      meetingsAnalyzed: meetingData.length,
      ...analysis,
    })
  } catch (error: any) {
    console.error('Error analyzing recordings:', error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to analyze data. Please try again.'
    
    if (error?.status === 401 || error?.message?.includes('API key')) {
      errorMessage = 'OpenAI API key is invalid. Please check your API key in Admin > Settings.'
    } else if (error?.status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again in a few minutes.'
    } else if (error?.status === 400) {
      errorMessage = 'Invalid request. The data may be too large to process.'
    } else if (error?.message) {
      errorMessage = `Error: ${error.message}`
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
