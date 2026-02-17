import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const date = searchParams.get('date')

    if (!employeeId) {
      return NextResponse.json(
        { error: 'employeeId query param is required' },
        { status: 400 }
      )
    }

    const { getMutualFreeSlots, isCalendarEnabled } = await import('@/lib/google-calendar')

    const [yourCalendarConnected, employeeCalendarConnected] = await Promise.all([
      isCalendarEnabled(user.id),
      isCalendarEnabled(employeeId),
    ])

    // Calendar status only (no date): when adding/selecting an employee, show if their calendar is connected
    if (!date) {
      const employee = await prisma.user.findUnique({
        where: { id: employeeId },
        select: { name: true },
      })
      return NextResponse.json({
        yourCalendarConnected,
        employeeCalendarConnected,
        employeeName: employee?.name ?? null,
        message:
          !yourCalendarConnected
            ? 'Your Google Calendar is not connected. Sign out and sign in again with Google to see mutual availability.'
            : !employeeCalendarConnected
              ? `${employee?.name ?? 'This person'}'s Google Calendar is not connected. You can still propose a time; they can accept or suggest another.`
              : `Both calendars connected. Pick a date to see free slots.`,
      })
    }

    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (!yourCalendarConnected || !employeeCalendarConnected) {
      return NextResponse.json({
        slots: [],
        calendarUnavailable: true,
        message: !yourCalendarConnected
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
