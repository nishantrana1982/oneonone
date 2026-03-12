import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleApiError } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { logUserUpdated, logUserDeleted } from '@/lib/audit'

const ALLOWED_EMAIL_DOMAIN = '@whitelabeliq.com'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        department: true,
        reportsTo: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()
    const { name, email, role, departmentId, reportsToId, isActive, country, timeZone, workDayStart, workDayEnd, kekaEmployeeId } = body

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check for email conflicts if email is being changed
    if (email && email !== existingUser.email) {
      if (!email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)) {
        return NextResponse.json(
          { error: `Only ${ALLOWED_EMAIL_DOMAIN} email addresses are allowed` },
          { status: 400 }
        )
      }
      const emailExists = await prisma.user.findUnique({
        where: { email },
      })
      if (emailExists) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
    }

    // Prevent circular reporting structure
    if (reportsToId) {
      // Check if the new manager reports to this user (circular dependency)
      const manager = await prisma.user.findUnique({
        where: { id: reportsToId },
      })
      if (manager?.reportsToId === params.id) {
        return NextResponse.json(
          { error: 'Cannot assign manager who reports to this user' },
          { status: 400 }
        )
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        name: name || undefined,
        email: email || undefined,
        role: role as UserRole || undefined,
        departmentId: departmentId === '' ? null : departmentId,
        reportsToId: reportsToId === '' ? null : reportsToId,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
        ...(country !== undefined && { country: country || null }),
        ...(timeZone !== undefined && { timeZone: timeZone || null }),
        ...(workDayStart !== undefined && { workDayStart: workDayStart || null }),
        ...(workDayEnd !== undefined && { workDayEnd: workDayEnd || null }),
        ...(kekaEmployeeId !== undefined && { kekaEmployeeId: kekaEmployeeId ? String(kekaEmployeeId).trim() : null }),
      },
      include: {
        department: true,
        reportsTo: true,
      },
    })

    // Audit log
    await logUserUpdated(admin.id, params.id, {
      changes: { name, email, role, departmentId, reportsToId, isActive },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin()

    if (admin.id === params.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { reportsToId: params.id },
        data: { reportsToId: null },
      })

      await tx.meeting.updateMany({
        where: { proposedById: params.id },
        data: { proposedById: null },
      })

      const userMeetings = await tx.meeting.findMany({
        where: { OR: [{ employeeId: params.id }, { reporterId: params.id }] },
        select: { id: true },
      })
      const meetingIds = userMeetings.map((m) => m.id)

      if (meetingIds.length > 0) {
        await tx.calendarEvent.deleteMany({ where: { meetingId: { in: meetingIds } } })
        await tx.meetingRecording.deleteMany({ where: { meetingId: { in: meetingIds } } })
        await tx.attachment.deleteMany({ where: { meetingId: { in: meetingIds } } })
        await tx.todo.deleteMany({ where: { meetingId: { in: meetingIds } } })
        await tx.meeting.deleteMany({ where: { id: { in: meetingIds } } })
      }

      await tx.todo.deleteMany({
        where: { OR: [{ assignedToId: params.id }, { createdById: params.id }] },
      })

      await tx.recurringSchedule.deleteMany({
        where: { OR: [{ reporterId: params.id }, { employeeId: params.id }] },
      })

      await tx.auditLog.deleteMany({ where: { userId: params.id } })

      await tx.user.delete({ where: { id: params.id } })
    })

    await logUserDeleted(admin.id, params.id, user.email)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
