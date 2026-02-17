import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { TodoStatus, TodoPriority } from '@prisma/client'
import { logTodoUpdated, logTodoDeleted } from '@/lib/audit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { status, priority, dueDate } = body

    const todo = await prisma.todo.findUnique({
      where: { id: params.id },
    })

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    // Only assigned user or admin can update
    if (todo.assignedToId !== user.id && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updateData: { status?: TodoStatus; priority?: TodoPriority; dueDate?: Date; completedAt?: Date | null } = {}
    if (status) updateData.status = status as TodoStatus
    if (priority) updateData.priority = priority as TodoPriority
    if (dueDate) updateData.dueDate = new Date(dueDate)
    if (status === 'DONE') {
      updateData.completedAt = new Date()
    } else if (status !== 'DONE' && todo.status === 'DONE') {
      updateData.completedAt = null
    }

    const updatedTodo = await prisma.todo.update({
      where: { id: params.id },
      data: updateData,
      include: {
        assignedTo: { select: { name: true, email: true } },
        createdBy: { select: { name: true } },
        meeting: { select: { id: true, meetingDate: true } },
      },
    })

    // Audit log
    await logTodoUpdated(user.id, params.id, {
      title: todo.title,
      changes: updateData,
    })

    return NextResponse.json(updatedTodo)
  } catch (error) {
    console.error('Error updating todo:', error)
    return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()

    const todo = await prisma.todo.findUnique({
      where: { id: params.id },
    })

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    // Only creator or admin can delete
    if (todo.createdById !== user.id && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.todo.delete({
      where: { id: params.id },
    })

    // Audit log
    await logTodoDeleted(user.id, params.id, {
      title: todo.title,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting todo:', error)
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 })
  }
}
