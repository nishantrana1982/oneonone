'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Repeat,
  Trash2,
  Play,
  Pause,
  ChevronRight,
  X,
} from 'lucide-react'
import { formatMeetingDateShort } from '@/lib/utils'
import { UserRole, RecurringFrequency } from '@prisma/client'

interface Meeting {
  id: string
  meetingDate: Date
  status: string
  checkInPersonal: string | null
  employeeId: string
  reporter?: { name: string; email: string }
  employee?: { name: string; email: string }
}

interface RecurringSchedule {
  id: string
  frequency: RecurringFrequency
  dayOfWeek: number
  timeOfDay: string
  isActive: boolean
  nextMeetingDate: Date | null
  employee: { id: string; name: string; email: string }
}

interface MeetingsClientProps {
  meetings: Meeting[]
  recurringSchedules: RecurringSchedule[]
  currentUserId: string
  userRole: UserRole
}

const dayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export function MeetingsClient({
  meetings,
  recurringSchedules,
  currentUserId,
  userRole,
}: MeetingsClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'all' | 'recurring'>('all')
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isToggling, setIsToggling] = useState<string | null>(null)
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    if (type === 'error') {
      alert(text)
    }
    setTimeout(() => setMessage(null), 5000)
  }, [])

  const now = new Date()
  const canSchedule =
    userRole === UserRole.REPORTER || userRole === UserRole.SUPER_ADMIN

  const visibleRecurring = recurringSchedules.filter(
    (s) => !deletedScheduleIds.has(s.id)
  )

  const upcomingMeetings = meetings.filter(
    (m) => new Date(m.meetingDate) >= now && m.status === 'SCHEDULED'
  )
  const completedMeetings = meetings.filter((m) => m.status === 'COMPLETED')
  const pendingFormMeetings = meetings.filter(
    (m) =>
      m.status === 'SCHEDULED' &&
      new Date(m.meetingDate) < now &&
      !m.checkInPersonal
  )

  const handleDeleteRecurring = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recurring schedule?')) {
      return
    }

    setIsDeleting(id)
    setMessage(null)

    try {
      const res = await fetch(`/api/recurring-schedules/${id}`, {
        method: 'DELETE',
      })

      const body = await res.json().catch(() => ({ error: 'Invalid response' }))
      const errorText =
        typeof body?.error === 'string' ? body.error : 'Failed to delete schedule'

      if (!res.ok) {
        showMessage('error', errorText)
        return
      }

      setDeletedScheduleIds((prev) => new Set(prev).add(id))
      showMessage('success', 'Recurring schedule deleted.')
      router.refresh()
    } catch (err) {
      const text =
        err instanceof Error ? err.message : 'Network or server error'
      showMessage('error', `Delete failed: ${text}`)
    } finally {
      setIsDeleting(null)
    }
  }

  const handleToggleRecurring = async (id: string, isActive: boolean) => {
    setIsToggling(id)
    setMessage(null)
    try {
      const res = await fetch(`/api/recurring-schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const body = await res.json().catch(() => ({}))
        const errorText =
          typeof body?.error === 'string'
            ? body.error
            : 'Failed to update schedule'
        showMessage('error', errorText)
      }
    } catch (err) {
      const text =
        err instanceof Error ? err.message : 'Network or server error'
      showMessage('error', `Update failed: ${text}`)
    } finally {
      setIsToggling(null)
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours, 10)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${minutes} ${ampm}`
  }

  const renderRecurringList = (schedules: RecurringSchedule[]) => (
    <div className="divide-y divide-off-white dark:divide-medium-gray/20">
      {schedules.map((schedule) => (
        <div
          key={schedule.id}
          className="flex items-center gap-4 px-6 py-4"
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              schedule.isActive ? 'bg-green-500/10' : 'bg-gray-500/10'
            }`}
          >
            <Repeat
              className={`w-6 h-6 ${
                schedule.isActive ? 'text-green-500' : 'text-gray-400'
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-dark-gray dark:text-white">
              {schedule.employee.name}
            </p>
            <p className="text-sm text-medium-gray">
              {schedule.frequency === 'BIWEEKLY'
                ? 'Bi-weekly'
                : schedule.frequency.toLowerCase()}{' '}
              • {dayNames[schedule.dayOfWeek]} at{' '}
              {formatTime(schedule.timeOfDay)}
            </p>
          </div>
          <span
            className={`px-3 py-1 text-xs font-medium rounded-full ${
              schedule.isActive
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
            }`}
          >
            {schedule.isActive ? 'Active' : 'Paused'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                handleToggleRecurring(schedule.id, schedule.isActive)
              }
              disabled={isToggling === schedule.id}
              className="p-2 rounded-lg hover:bg-off-white dark:hover:bg-charcoal transition-colors"
              title={schedule.isActive ? 'Pause' : 'Resume'}
            >
              {isToggling === schedule.id ? (
                <div className="w-4 h-4 border-2 border-medium-gray border-t-transparent rounded-full animate-spin" />
              ) : schedule.isActive ? (
                <Pause className="w-4 h-4 text-medium-gray" />
              ) : (
                <Play className="w-4 h-4 text-medium-gray" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteRecurring(schedule.id)}
              disabled={isDeleting === schedule.id}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              {isDeleting === schedule.id ? (
                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 text-red-500" />
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Message banner */}
      {message && (
        <div
          className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3 ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'
          }`}
        >
          <p className="text-sm font-medium">{message.text}</p>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-2">
            Meetings
          </h1>
          <p className="text-medium-gray">Manage your one-on-one sessions</p>
        </div>
        {canSchedule && (
          <Link
            href="/meetings/new"
            className="flex items-center gap-2 px-5 py-3 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white transition-colors"
          >
            <Plus className="w-5 h-5" />
            Schedule Meeting
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-gray dark:text-white">
                {upcomingMeetings.length}
              </p>
              <p className="text-sm text-medium-gray">Upcoming</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-gray dark:text-white">
                {completedMeetings.length}
              </p>
              <p className="text-sm text-medium-gray">Completed</p>
            </div>
          </div>
        </div>
        {pendingFormMeetings.length > 0 ? (
          <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {pendingFormMeetings.length}
                </p>
                <p className="text-sm text-medium-gray">Pending Form</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-off-white dark:bg-dark-gray flex items-center justify-center">
                <Repeat className="w-6 h-6 text-dark-gray dark:text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-gray dark:text-white">
                  {recurringSchedules.length}
                </p>
                <p className="text-sm text-medium-gray">Recurring</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      {canSchedule && (
        <div className="flex gap-1 p-1 bg-off-white dark:bg-charcoal rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-white dark:bg-charcoal text-dark-gray dark:text-white shadow-sm'
                : 'text-medium-gray hover:text-dark-gray dark:hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            All Meetings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recurring')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'recurring'
                ? 'bg-white dark:bg-charcoal text-dark-gray dark:text-white shadow-sm'
                : 'text-medium-gray hover:text-dark-gray dark:hover:text-white'
            }`}
          >
            <Repeat className="w-4 h-4" />
            Recurring
          </button>
        </div>
      )}

      {/* Content: All (default) */}
      {activeTab === 'all' && (
        <>
          {visibleRecurring.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden mb-6">
              <div className="px-6 py-3 border-b border-off-white dark:border-medium-gray/20 flex items-center justify-between">
                <h3 className="font-semibold text-dark-gray dark:text-white">
                  Recurring schedules
                </h3>
                <Link
                  href="/meetings/recurring"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-medium-gray hover:text-dark-gray dark:hover:text-white rounded-lg hover:bg-off-white dark:hover:bg-charcoal transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Manage Schedules
                </Link>
              </div>
              {renderRecurringList(visibleRecurring)}
            </div>
          )}

          {meetings.length === 0 && visibleRecurring.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-12 text-center">
              <Calendar className="w-16 h-16 text-light-gray mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-dark-gray dark:text-white mb-2">
                No meetings yet
              </h3>
              <p className="text-medium-gray max-w-md mx-auto mb-6">
                {canSchedule
                  ? 'Get started by scheduling your first one-on-one meeting or a recurring schedule.'
                  : 'Your manager will schedule one-on-one meetings with you.'}
              </p>
              {canSchedule && (
                <Link
                  href="/meetings/new"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Schedule Meeting
                </Link>
              )}
            </div>
          ) : meetings.length > 0 ? (
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
              {visibleRecurring.length > 0 && (
                <div className="px-6 py-3 border-b border-off-white dark:border-medium-gray/20">
                  <h3 className="font-semibold text-dark-gray dark:text-white">
                    One-on-one meetings
                  </h3>
                </div>
              )}
              <div className="divide-y divide-off-white dark:divide-medium-gray/20">
                {meetings.map((meeting) => {
                  const meetingDate = new Date(meeting.meetingDate)
                  const isPast = meetingDate < now
                  const needsForm =
                    isPast &&
                    meeting.status === 'SCHEDULED' &&
                    !meeting.checkInPersonal
                  const isEmployee = meeting.employeeId === currentUserId
                  const otherPerson = isEmployee
                    ? meeting.reporter
                    : meeting.employee

                  return (
                    <Link
                      key={meeting.id}
                      href={`/meetings/${meeting.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-off-white/50 dark:hover:bg-charcoal/50 transition-colors"
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          meeting.status === 'COMPLETED'
                            ? 'bg-green-500/10'
                            : needsForm
                              ? 'bg-amber-500/10'
                              : 'bg-blue-500/10'
                        }`}
                      >
                        <Calendar
                          className={`w-6 h-6 ${
                            meeting.status === 'COMPLETED'
                              ? 'text-green-500'
                              : needsForm
                                ? 'text-amber-500'
                                : 'text-blue-500'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-dark-gray dark:text-white">
                            {otherPerson?.name ?? 'Unknown'}
                          </p>
                          {needsForm && isEmployee && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full">
                              Form needed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-medium-gray">
                          {formatMeetingDateShort(meetingDate)}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          meeting.status === 'COMPLETED'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {meeting.status === 'COMPLETED'
                          ? 'Completed'
                          : isPast
                            ? 'Pending'
                            : 'Scheduled'}
                      </span>
                      <ChevronRight className="w-5 h-5 text-light-gray" />
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Content: Recurring only */}
      {activeTab === 'recurring' && (
        <>
          <div className="flex justify-end mb-4">
            <Link
              href="/meetings/recurring"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl hover:bg-charcoal dark:hover:bg-off-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              Manage Schedules
            </Link>
          </div>

          {visibleRecurring.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-12 text-center">
              <Repeat className="w-16 h-16 text-light-gray mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-dark-gray dark:text-white mb-2">
                No recurring schedules
              </h3>
              <p className="text-medium-gray max-w-md mx-auto mb-6">
                Set up recurring schedules to automatically create bi-weekly
                one-on-one meetings.
              </p>
              <Link
                href="/meetings/recurring"
                className="inline-flex items-center gap-2 px-5 py-3 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Schedule
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
              {renderRecurringList(visibleRecurring)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
