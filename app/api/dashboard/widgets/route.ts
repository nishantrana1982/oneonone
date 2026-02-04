import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { WidgetType } from '@prisma/client'

// Default widgets for each role
const defaultWidgets: Record<string, WidgetType[]> = {
  EMPLOYEE: ['UPCOMING_MEETINGS', 'PENDING_TODOS', 'RECENT_ACTIVITY', 'QUICK_ACTIONS'],
  REPORTER: ['UPCOMING_MEETINGS', 'PENDING_TODOS', 'TEAM_OVERVIEW', 'MEETING_STATS', 'QUICK_ACTIONS'],
  SUPER_ADMIN: ['MEETING_STATS', 'TODO_STATS', 'TEAM_OVERVIEW', 'DEPARTMENT_SUMMARY', 'RECENT_ACTIVITY'],
}

// Get user's dashboard widgets
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's widget configuration
    let widgets = await prisma.dashboardWidget.findMany({
      where: { userId: user.id },
      orderBy: { position: 'asc' },
    })

    // If no widgets configured, create defaults
    if (widgets.length === 0) {
      const defaultForRole = defaultWidgets[user.role] || defaultWidgets['EMPLOYEE']
      
      widgets = await Promise.all(
        defaultForRole.map((widgetType, index) =>
          prisma.dashboardWidget.create({
            data: {
              userId: user.id,
              widgetType,
              position: index,
              isVisible: true,
            },
          })
        )
      )
    }

    return NextResponse.json(widgets)
  } catch (error) {
    console.error('Error fetching widgets:', error)
    return NextResponse.json({ error: 'Failed to fetch widgets' }, { status: 500 })
  }
}

// Update widget configuration
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { widgets } = body as { widgets: Array<{ widgetType: WidgetType; position: number; isVisible: boolean }> }

    if (!widgets || !Array.isArray(widgets)) {
      return NextResponse.json({ error: 'Invalid widgets data' }, { status: 400 })
    }

    // Update or create widgets
    const updatedWidgets = await Promise.all(
      widgets.map((widget) =>
        prisma.dashboardWidget.upsert({
          where: {
            userId_widgetType: {
              userId: user.id,
              widgetType: widget.widgetType,
            },
          },
          update: {
            position: widget.position,
            isVisible: widget.isVisible,
          },
          create: {
            userId: user.id,
            widgetType: widget.widgetType,
            position: widget.position,
            isVisible: widget.isVisible,
          },
        })
      )
    )

    return NextResponse.json(updatedWidgets)
  } catch (error) {
    console.error('Error updating widgets:', error)
    return NextResponse.json({ error: 'Failed to update widgets' }, { status: 500 })
  }
}

// Reset to default widgets
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete all user's widgets
    await prisma.dashboardWidget.deleteMany({
      where: { userId: user.id },
    })

    // Create defaults
    const defaultForRole = defaultWidgets[user.role] || defaultWidgets['EMPLOYEE']
    
    const widgets = await Promise.all(
      defaultForRole.map((widgetType, index) =>
        prisma.dashboardWidget.create({
          data: {
            userId: user.id,
            widgetType,
            position: index,
            isVisible: true,
          },
        })
      )
    )

    return NextResponse.json(widgets)
  } catch (error) {
    console.error('Error resetting widgets:', error)
    return NextResponse.json({ error: 'Failed to reset widgets' }, { status: 500 })
  }
}
