'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Plus, Clock, CheckCircle2, AlertCircle, Repeat, Trash2, Play, Pause, ChevronRight } from 'lucide-react'
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

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function MeetingsClient({ meetings, recurringSchedules, currentUserId, userRole }: MeetingsClientProps) {
  const [activeTab, setActiveTab] = useState<'meetings' | 'recurring'>('meetings')
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isToggling, setIsToggling] = useState<string | null>(null)

  const now = new Date()
  const canSchedule = userRole === UserRole.REPORTER || userRole === UserRole.SUPER_ADMIN

  const upcomingMeetings = meetings.filter(m => new Date(m.meetingDate) >= now && m.status === 'SCHEDULED')
  const completedMeetings = meetings.filter(m => m.status === 'COMPLETED')
  const pendingFormMeetings = meetings.filter(m => 
    m.status === 'SCHEDULED' && 
    new Date(m.meetingDate) < now &&
    !m.checkInPersonal
  )

  const handleDeleteRecurring = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recurring schedule?')) return
    
    setIsDeleting(id)
    try {
      const res = await fetch(`/api/recurring-schedules/${id}`, { method: 'DELETE' })
      if (res.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to delete recurring schedule:', error)
    } finally {
      setIsDeleting(null)
    }
  }

  const handleToggleRecurring = async (id: string, isActive: boolean) => {
    setIsToggling(id)
    try {
      const res = await fetch(`/api/recurring-schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      if (res.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to toggle recurring schedule:', error)
    } finally {
      setIsToggling(null)
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${minutes} ${ampm}`
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-2">Meetings</h1>
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

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-gray dark:text-white">{upcomingMeetings.length}</p>
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
              <p className="text-2xl font-bold text-dark-gray dark:text-white">{completedMeetings.length}</p>
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
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingFormMeetings.length}</p>
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
                <p className="text-2xl font-bold text-dark-gray dark:text-white">{recurringSchedules.length}</p>
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
            onClick={() => setActiveTab('meetings')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'meetings'
                ? 'bg-white dark:bg-charcoal text-dark-gray dark:text-white shadow-sm'
                : 'text-medium-gray hover:text-dark-gray dark:hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            All Meetings
          </button>
          <button
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

      {/* Content */}
      {activeTab === 'meetings' ? (
        <>
          {meetings.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-12 text-center">
              <Calendar className="w-16 h-16 text-light-gray mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-dark-gray dark:text-white mb-2">No meetings yet</h3>
              <p className="text-medium-gray max-w-md mx-auto mb-6">
                {canSchedule 
                  ? 'Get started by scheduling your first one-on-one meeting.'
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
          ) : (
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
              <div className="divide-y divide-off-white dark:divide-medium-gray/20">
                {meetings.map((meeting) => {
                  const meetingDate = new Date(meeting.meetingDate)
                  const isPast = meetingDate < now
                  const needsForm = isPast && meeting.status === 'SCHEDULED' && !meeting.checkInPersonal
                  const isEmployee = meeting.employeeId === currentUserId
                  const otherPerson = isEmployee ? meeting.reporter : meeting.employee

                  return (
                    <Link
                      key={meeting.id}
                      href={`/meetings/${meeting.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-off-white/50 dark:hover:bg-charcoal/50 transition-colors"
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        meeting.status === 'COMPLETED'
                          ? 'bg-green-500/10'
                          : needsForm
                          ? 'bg-amber-500/10'
                          : 'bg-blue-500/10'
                      }`}>
                        <Calendar className={`w-6 h-6 ${
                          meeting.status === 'COMPLETED'
                            ? 'text-green-500'
                            : needsForm
                            ? 'text-amber-500'
                            : 'text-blue-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-dark-gray dark:text-white">
                            {otherPerson?.name || 'Unknown'}
                          </p>
                          {needsForm && isEmployee && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full">
                              Form needed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-medium-gray">
                          {meetingDate.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        meeting.status === 'COMPLETED'
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      }`}>
                        {meeting.status === 'COMPLETED' ? 'Completed' : isPast ? 'Pending' : 'Scheduled'}
                      </span>
                      <ChevronRight className="w-5 h-5 text-light-gray" />
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Recurring Schedules Tab */}
          <div className="flex justify-end mb-4">
            <Link
              href="/meetings/recurring"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl hover:bg-charcoal dark:hover:bg-off-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              Manage Schedules
            </Link>
          </div>

          {recurringSchedules.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-12 text-center">
              <Repeat className="w-16 h-16 text-light-gray mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-dark-gray dark:text-white mb-2">No recurring schedules</h3>
              <p className="text-medium-gray max-w-md mx-auto mb-6">
                Set up recurring schedules to automatically create bi-weekly one-on-one meetings.
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
              <div className="divide-y divide-off-white dark:divide-medium-gray/20">
                {recurringSchedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center gap-4 px-6 py-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      schedule.isActive ? 'bg-green-500/10' : 'bg-gray-500/10'
                    }`}>
                      <Repeat className={`w-6 h-6 ${schedule.isActive ? 'text-green-500' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark-gray dark:text-white">
                        {schedule.employee.name}
                      </p>
                      <p className="text-sm text-medium-gray">
                        {schedule.frequency === 'BIWEEKLY' ? 'Bi-weekly' : schedule.frequency.toLowerCase()} • {dayNames[schedule.dayOfWeek]} at {formatTime(schedule.timeOfDay)}
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      schedule.isActive
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                    }`}>
                      {schedule.isActive ? 'Active' : 'Paused'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleRecurring(schedule.id, schedule.isActive)}
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
            </div>
          )}
        </>
      )}
    </div>
  )
}
