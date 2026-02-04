import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { data, options = {} } = body

    if (!data || !data.version || !data.data) {
      return NextResponse.json({ error: 'Invalid backup data format' }, { status: 400 })
    }

    const { clearExisting = false, restoreUsers = true, restoreMeetings = true } = options

    const results = {
      departments: 0,
      users: 0,
      meetings: 0,
      todos: 0,
      errors: [] as string[],
    }

    // Start transaction
    await prisma.$transaction(async (tx) => {
      // Optionally clear existing data
      if (clearExisting) {
        await tx.todo.deleteMany()
        await tx.meetingRecording.deleteMany()
        await tx.calendarEvent.deleteMany()
        await tx.meeting.deleteMany()
        await tx.notification.deleteMany()
        // Don't delete users or departments if there are still relations
      }

      // Restore departments first
      if (data.data.departments) {
        for (const dept of data.data.departments) {
          try {
            await tx.department.upsert({
              where: { id: dept.id },
              update: { name: dept.name },
              create: { id: dept.id, name: dept.name },
            })
            results.departments++
          } catch (error: any) {
            results.errors.push(`Department ${dept.name}: ${error.message}`)
          }
        }
      }

      // Restore users
      if (restoreUsers && data.data.users) {
        for (const userData of data.data.users) {
          try {
            await tx.user.upsert({
              where: { id: userData.id },
              update: {
                name: userData.name,
                role: userData.role,
                departmentId: userData.departmentId,
                reportsToId: userData.reportsToId,
                phone: userData.phone,
                title: userData.title,
                bio: userData.bio,
                isActive: userData.isActive,
              },
              create: {
                id: userData.id,
                email: userData.email,
                name: userData.name,
                role: userData.role,
                departmentId: userData.departmentId,
                reportsToId: userData.reportsToId,
                phone: userData.phone,
                title: userData.title,
                bio: userData.bio,
                isActive: userData.isActive ?? true,
              },
            })
            results.users++
          } catch (error: any) {
            results.errors.push(`User ${userData.email}: ${error.message}`)
          }
        }
      }

      // Restore meetings
      if (restoreMeetings && data.data.meetings) {
        for (const meeting of data.data.meetings) {
          try {
            await tx.meeting.upsert({
              where: { id: meeting.id },
              update: {
                meetingDate: new Date(meeting.meetingDate),
                status: meeting.status,
                notes: meeting.notes,
                checkInPersonal: meeting.checkInPersonal,
                checkInProfessional: meeting.checkInProfessional,
                priorityGoalProfessional: meeting.priorityGoalProfessional,
                priorityGoalAgency: meeting.priorityGoalAgency,
                progressReport: meeting.progressReport,
                goodNews: meeting.goodNews,
                supportNeeded: meeting.supportNeeded,
                priorityDiscussions: meeting.priorityDiscussions,
                headsUp: meeting.headsUp,
                anythingElse: meeting.anythingElse,
              },
              create: {
                id: meeting.id,
                employeeId: meeting.employeeId,
                reporterId: meeting.reporterId,
                meetingDate: new Date(meeting.meetingDate),
                status: meeting.status,
                notes: meeting.notes,
                checkInPersonal: meeting.checkInPersonal,
                checkInProfessional: meeting.checkInProfessional,
                priorityGoalProfessional: meeting.priorityGoalProfessional,
                priorityGoalAgency: meeting.priorityGoalAgency,
                progressReport: meeting.progressReport,
                goodNews: meeting.goodNews,
                supportNeeded: meeting.supportNeeded,
                priorityDiscussions: meeting.priorityDiscussions,
                headsUp: meeting.headsUp,
                anythingElse: meeting.anythingElse,
              },
            })
            results.meetings++

            // Restore todos for this meeting
            if (meeting.todos) {
              for (const todo of meeting.todos) {
                try {
                  await tx.todo.upsert({
                    where: { id: todo.id },
                    update: {
                      title: todo.title,
                      description: todo.description,
                      status: todo.status,
                      priority: todo.priority,
                      dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
                    },
                    create: {
                      id: todo.id,
                      meetingId: meeting.id,
                      assignedToId: todo.assignedToId,
                      createdById: todo.createdById,
                      title: todo.title,
                      description: todo.description,
                      status: todo.status,
                      priority: todo.priority,
                      dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
                    },
                  })
                  results.todos++
                } catch (error: any) {
                  results.errors.push(`Todo ${todo.title}: ${error.message}`)
                }
              }
            }
          } catch (error: any) {
            results.errors.push(`Meeting ${meeting.id}: ${error.message}`)
          }
        }
      }
    })

    // Log the action
    await createAuditLog({
      userId: user.id,
      action: 'IMPORT',
      entityType: 'Restore',
      details: {
        ...results,
        errors: results.errors.slice(0, 10),
        options,
      },
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error restoring data:', error)
    return NextResponse.json({ error: 'Failed to restore data' }, { status: 500 })
  }
}
