import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { UserRole } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const date = searchParams.get('date')

    if (!employeeId || !date) {
      return NextResponse.json(
        { error: 'employeeId and date query params are required' },
        { status: 400 }
      )
    }

    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const { getMutualFreeSlots, isCalendarEnabled } = await import('@/lib/google-calendar')

    const [reporterCalendar, employeeCalendar] = await Promise.all([
      isCalendarEnabled(user.id),
      isCalendarEnabled(employeeId),
    ])

    if (!reporterCalendar || !employeeCalendar) {
      return NextResponse.json({
        slots: [],
        calendarUnavailable: true,
        message: !reporterCalendar
          ? 'Your Google Calendar is not connected. Please sign out and sign in again to grant calendar access.'
          : 'The selected employee has not connected their Google Calendar.',
      })
    }

    const slots = await getMutualFreeSlots(user.id, employeeId, parsedDate)

    return NextResponse.json({ slots, calendarUnavailable: false })
  } catch (error) {
    console.error('Error fetching availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}
