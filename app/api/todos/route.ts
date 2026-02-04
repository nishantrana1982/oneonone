import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { TodoPriority, TodoStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    let todos

    if (user.role === 'EMPLOYEE') {
      todos = await prisma.todo.findMany({
        where: { assignedToId: user.id },
        include: {
          createdBy: { select: { name: true } },
          assignedTo: { select: { name: true, email: true } },
          meeting: { select: { id: true, meetingDate: true } },
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { priority: 'desc' }],
      })
    } else {
      todos = await prisma.todo.findMany({
        include: {
          createdBy: { select: { name: true } },
          assignedTo: { select: { name: true, email: true } },
          meeting: { select: { id: true, meetingDate: true } },
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { priority: 'desc' }],
      })
    }

    return NextResponse.json(todos)
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { title, description, assignedToId, meetingId, dueDate, priority } = body

    const todo = await prisma.todo.create({
      data: {
        title,
        description: description || null,
        assignedToId: assignedToId || user.id,
        createdById: user.id,
        meetingId: meetingId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: (priority as TodoPriority) || 'MEDIUM',
        status: 'NOT_STARTED',
      },
      include: {
        assignedTo: { select: { name: true, email: true } },
        createdBy: { select: { name: true } },
        meeting: { select: { id: true, meetingDate: true } },
      },
    })

    // Send email notification if assigned to someone else
    if (todo.assignedToId !== user.id && todo.assignedTo?.email) {
      try {
        const { sendTodoAssignedEmail } = await import('@/lib/email')
        await sendTodoAssignedEmail(
          todo.assignedTo.email,
          todo.assignedTo.name,
          todo.title,
          todo.description,
          todo.dueDate,
          todo.createdBy!.name,
          todo.id
        )
      } catch (error) {
        console.error('Failed to send email notification:', error)
        // Continue even if email fails
      }
    }

    return NextResponse.json(todo)
  } catch (error) {
    console.error('Error creating todo:', error)
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 })
  }
}
