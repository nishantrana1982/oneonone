import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE])

    let meetings

    if (user.role === UserRole.EMPLOYEE) {
      meetings = await prisma.meeting.findMany({
        where: { employeeId: user.id },
        include: {
          reporter: { select: { name: true, email: true } },
        },
        orderBy: { meetingDate: 'desc' },
      })
    } else if (user.role === UserRole.REPORTER) {
      meetings = await prisma.meeting.findMany({
        where: {
          OR: [{ employeeId: user.id }, { reporterId: user.id }],
        },
        include: {
          employee: { select: { name: true, email: true } },
          reporter: { select: { name: true, email: true } },
        },
        orderBy: { meetingDate: 'desc' },
      })
    } else {
      meetings = await prisma.meeting.findMany({
        include: {
          employee: { select: { name: true, email: true } },
          reporter: { select: { name: true, email: true } },
        },
        orderBy: { meetingDate: 'desc' },
      })
    }

    return NextResponse.json(meetings)
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])
    const body = await request.json()
    const { employeeId, meetingDate } = body

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Determine reporter - if user is SUPER_ADMIN, use employee's reportsTo, otherwise use current user
    const reporterId =
      user.role === UserRole.SUPER_ADMIN && employee.reportsToId
        ? employee.reportsToId
        : user.id

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'meetings/route.ts:67',message:'Creating meeting',data:{employeeId,reporterId,meetingDate,userRole:user.role},timestamp:Date.now(),hypothesisId:'A,E'})}).catch(()=>{});
    // #endregion

    const meeting = await prisma.meeting.create({
      data: {
        employeeId,
        reporterId,
        meetingDate: new Date(meetingDate),
        status: 'SCHEDULED',
      },
      include: {
        employee: { select: { name: true, email: true } },
        reporter: { select: { name: true, email: true } },
      },
    })

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'meetings/route.ts:83',message:'Meeting created, attempting calendar',data:{meetingId:meeting.id,employeeEmail:meeting.employee.email,reporterEmail:meeting.reporter.email,reporterId},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Create Google Calendar event
    try {
      const { createCalendarEvent, isCalendarEnabled } = await import('@/lib/google-calendar')
      
      // Check if calendar is enabled for the reporter
      const calendarEnabled = await isCalendarEnabled(reporterId)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'meetings/route.ts:93',message:'Calendar enabled check',data:{calendarEnabled,reporterId},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      if (calendarEnabled) {
        const calendarResult = await createCalendarEvent(
          meeting.id,
          meeting.employee.email,
          meeting.reporter.email,
          reporterId,
          new Date(meetingDate),
          meeting.employee.name,
          meeting.reporter.name
        )
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'meetings/route.ts:106',message:'Calendar event created OK',data:{calendarResult},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.log('Calendar event created:', calendarResult)
      } else {
        console.log('Calendar not enabled for reporter - skipping calendar event')
      }
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'meetings/route.ts:115',message:'Calendar event FAILED',data:{error:error.message,code:error.code,status:error.status},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.error('Failed to create calendar event:', error)
      // Continue even if calendar creation fails
    }

    // Send email notifications
    try {
      const { sendMeetingScheduledEmail } = await import('@/lib/email')
      await sendMeetingScheduledEmail(
        meeting.employee.email,
        meeting.employee.name,
        meeting.reporter.email,
        meeting.reporter.name,
        new Date(meetingDate),
        meeting.id
      )
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'meetings/route.ts:133',message:'Email sent OK',timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'meetings/route.ts:139',message:'Email FAILED',data:{error:error.message},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error('Failed to send email notification:', error)
      // Continue even if email fails
    }

    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }
}
