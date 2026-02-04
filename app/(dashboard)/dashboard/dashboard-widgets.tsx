'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Calendar, 
  CheckSquare, 
  Users, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  GripVertical,
  Settings2,
  X,
  Eye,
  EyeOff,
  RotateCcw
} from 'lucide-react'
import { WidgetType } from '@prisma/client'

interface Widget {
  id: string
  widgetType: WidgetType
  position: number
  isVisible: boolean
}

interface DashboardStats {
  upcomingMeetings: number
  pendingTodos: number
  overdueTodos: number
  directReports: number
  completedMeetings: number
  completedTodos: number
}

interface DashboardWidgetsProps {
  stats: DashboardStats
  userRole: string
  userName: string
  recentMeetings: any[]
  initialWidgets: Widget[]
}

const widgetConfig: Record<WidgetType, {
  title: string
  icon: any
  color: string
  bgColor: string
}> = {
  UPCOMING_MEETINGS: { title: 'Upcoming Meetings', icon: Calendar, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  PENDING_TODOS: { title: 'Pending Tasks', icon: CheckSquare, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  RECENT_ACTIVITY: { title: 'Recent Activity', icon: Clock, color: 'text-dark-gray dark:text-white', bgColor: 'bg-off-white dark:bg-dark-gray' },
  TEAM_OVERVIEW: { title: 'Team Overview', icon: Users, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  QUICK_ACTIONS: { title: 'Quick Actions', icon: TrendingUp, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
  MEETING_STATS: { title: 'Meeting Stats', icon: Calendar, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  TODO_STATS: { title: 'Task Stats', icon: CheckSquare, color: 'text-teal-500', bgColor: 'bg-teal-500/10' },
  DEPARTMENT_SUMMARY: { title: 'Department Summary', icon: Users, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
}

export function DashboardWidgets({ 
  stats, 
  userRole, 
  userName, 
  recentMeetings,
  initialWidgets 
}: DashboardWidgetsProps) {
  const router = useRouter()
  const [widgets, setWidgets] = useState<Widget[]>(initialWidgets)
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [saving, setSaving] = useState(false)

  const visibleWidgets = widgets.filter(w => w.isVisible).sort((a, b) => a.position - b.position)

  const toggleWidget = (widgetType: WidgetType) => {
    setWidgets(widgets.map(w => 
      w.widgetType === widgetType ? { ...w, isVisible: !w.isVisible } : w
    ))
  }

  const saveWidgets = async () => {
    setSaving(true)
    try {
      await fetch('/api/dashboard/widgets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets }),
      })
      setIsCustomizing(false)
      router.refresh()
    } catch (error) {
      console.error('Error saving widgets:', error)
    } finally {
      setSaving(false)
    }
  }

  const resetWidgets = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/dashboard/widgets', { method: 'DELETE' })
      if (response.ok) {
        const newWidgets = await response.json()
        setWidgets(newWidgets)
        setIsCustomizing(false)
        router.refresh()
      }
    } catch (error) {
      console.error('Error resetting widgets:', error)
    } finally {
      setSaving(false)
    }
  }

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const renderWidget = (widget: Widget) => {
    const config = widgetConfig[widget.widgetType]
    const Icon = config.icon

    switch (widget.widgetType) {
      case 'UPCOMING_MEETINGS':
        return (
          <Link href="/meetings" className="group block">
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-6 transition-all duration-300 hover:shadow-card hover:border-blue-500/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-medium-gray mb-1">Upcoming</p>
                  <p className="text-3xl font-bold text-dark-gray dark:text-white">{stats.upcomingMeetings}</p>
                  <p className="text-sm text-medium-gray mt-1">meetings</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl ${config.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${config.color}`} />
                </div>
              </div>
            </div>
          </Link>
        )

      case 'PENDING_TODOS':
        return (
          <Link href="/todos" className="group block">
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-6 transition-all duration-300 hover:shadow-card hover:border-amber-500/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-medium-gray mb-1">Pending</p>
                  <p className="text-3xl font-bold text-dark-gray dark:text-white">{stats.pendingTodos}</p>
                  <p className="text-sm text-medium-gray mt-1">tasks</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl ${config.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${config.color}`} />
                </div>
              </div>
              {stats.overdueTodos > 0 && (
                <div className="mt-3 flex items-center gap-1 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {stats.overdueTodos} overdue
                </div>
              )}
            </div>
          </Link>
        )

      case 'TEAM_OVERVIEW':
        return (
          <Link href="/employees" className="group block">
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-6 transition-all duration-300 hover:shadow-card hover:border-green-500/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-medium-gray mb-1">Team</p>
                  <p className="text-3xl font-bold text-dark-gray dark:text-white">{stats.directReports}</p>
                  <p className="text-sm text-medium-gray mt-1">members</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl ${config.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${config.color}`} />
                </div>
              </div>
            </div>
          </Link>
        )

      case 'MEETING_STATS':
        return (
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-medium-gray mb-1">Completed</p>
                <p className="text-3xl font-bold text-dark-gray dark:text-white">{stats.completedMeetings}</p>
                <p className="text-sm text-medium-gray mt-1">meetings</p>
              </div>
              <div className={`w-12 h-12 rounded-2xl ${config.bgColor} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${config.color}`} />
              </div>
            </div>
          </div>
        )

      case 'TODO_STATS':
        return (
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-medium-gray mb-1">Completed</p>
                <p className="text-3xl font-bold text-dark-gray dark:text-white">{stats.completedTodos}</p>
                <p className="text-sm text-medium-gray mt-1">tasks</p>
              </div>
              <div className={`w-12 h-12 rounded-2xl ${config.bgColor} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${config.color}`} />
              </div>
            </div>
          </div>
        )

      case 'RECENT_ACTIVITY':
        return (
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden col-span-2">
            <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center justify-between">
              <h2 className="font-semibold text-dark-gray dark:text-white">Recent Meetings</h2>
              <Link href="/meetings" className="text-sm text-blue-500 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-off-white dark:divide-medium-gray/20">
              {recentMeetings.length === 0 ? (
                <div className="px-6 py-8 text-center text-medium-gray">
                  No meetings yet
                </div>
              ) : (
                recentMeetings.slice(0, 5).map((meeting: any) => (
                  <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="block px-6 py-4 hover:bg-off-white dark:hover:bg-charcoal transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-dark-gray dark:text-white">
                          {meeting.employee?.name || meeting.reporter?.name}
                        </p>
                        <p className="text-xs text-medium-gray">
                          {new Date(meeting.meetingDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        meeting.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {meeting.status.toLowerCase()}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )

      case 'QUICK_ACTIONS':
        return (
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-6">
            <h3 className="font-semibold text-dark-gray dark:text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {(userRole === 'REPORTER' || userRole === 'SUPER_ADMIN') && (
                <Link
                  href="/meetings/new"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-off-white dark:hover:bg-charcoal transition-colors"
                >
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-dark-gray dark:text-white">Schedule Meeting</span>
                </Link>
              )}
              <Link
                href="/todos"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-off-white dark:hover:bg-charcoal transition-colors"
              >
                <CheckSquare className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-medium text-dark-gray dark:text-white">View Tasks</span>
              </Link>
              {(userRole === 'REPORTER' || userRole === 'SUPER_ADMIN') && (
                <Link
                  href="/reports"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-off-white dark:hover:bg-charcoal transition-colors"
                >
                  <TrendingUp className="w-5 h-5 text-dark-gray dark:text-white" />
                  <span className="text-sm font-medium text-dark-gray dark:text-white">View Reports</span>
                </Link>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-charcoal to-dark-gray p-8 text-white flex-1">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <p className="text-light-gray font-medium mb-1">{greeting()}</p>
            <h1 className="text-3xl font-bold mb-2">{userName}</h1>
            <p className="text-light-gray">Here&apos;s what&apos;s happening with your one-on-ones</p>
          </div>
        </div>
        <button
          onClick={() => setIsCustomizing(!isCustomizing)}
          className="ml-4 p-3 rounded-xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 hover:border-dark-gray/30 transition-colors"
          title="Customize Dashboard"
        >
          <Settings2 className="w-5 h-5 text-medium-gray" />
        </button>
      </div>

      {/* Customization Panel */}
      {isCustomizing && (
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-dark-gray dark:text-white">Customize Dashboard</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={resetWidgets}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={saveWidgets}
                disabled={saving}
                className="px-4 py-1.5 text-sm bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-lg font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setIsCustomizing(false)}
                className="p-1.5 text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {widgets.map((widget) => {
              const config = widgetConfig[widget.widgetType]
              return (
                <button
                  key={widget.id}
                  onClick={() => toggleWidget(widget.widgetType)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    widget.isVisible
                      ? 'border-dark-gray dark:border-white bg-off-white dark:bg-charcoal'
                      : 'border-off-white dark:border-medium-gray/20 opacity-50'
                  }`}
                >
                  {widget.isVisible ? (
                    <Eye className="w-4 h-4 text-green-500" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-medium-gray" />
                  )}
                  <span className="text-sm font-medium text-dark-gray dark:text-white">
                    {config.title}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Widgets Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {visibleWidgets.map((widget) => (
          <div key={widget.id} className={widget.widgetType === 'RECENT_ACTIVITY' ? 'lg:col-span-2' : ''}>
            {renderWidget(widget)}
          </div>
        ))}
      </div>
    </div>
  )
}
