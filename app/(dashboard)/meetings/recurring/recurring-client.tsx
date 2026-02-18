'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Plus, 
  Clock, 
  User, 
  Repeat, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Loader2,
  Check,
  Pencil,
  X,
  ChevronDown,
} from 'lucide-react'
import { RecurringFrequency } from '@prisma/client'
import { useToast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-modal'

interface Employee {
  id: string
  name: string
  email: string
}

interface Schedule {
  id: string
  employeeId: string
  employee: Employee | null
  frequency: RecurringFrequency
  dayOfWeek: number
  timeOfDay: string
  isActive: boolean
  nextMeetingDate: string | null
  createdAt: string
  upcomingMeetingCount?: number
}

interface Props {
  employees: Employee[]
  initialSchedules: Schedule[]
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const frequencyLabels: Record<RecurringFrequency, string> = {
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 Weeks',
  MONTHLY: 'Monthly',
}

const timeOptions = Array.from({ length: 20 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2)
  const minute = i % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${minute}`
})

function formatTime(time: string) {
  return new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function RecurringSchedulesClient({ employees, initialSchedules }: Props) {
  const router = useRouter()
  const { toastSuccess, toastError } = useToast()
  const confirm = useConfirm()
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{
    frequency: RecurringFrequency
    dayOfWeek: number
    timeOfDay: string
  } | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [formData, setFormData] = useState({
    employeeId: '',
    frequency: 'BIWEEKLY' as RecurringFrequency,
    dayOfWeek: 1,
    timeOfDay: '10:00',
  })

  const availableEmployees = employees.filter(
    (emp) => !schedules.some((s) => s.employeeId === emp.id && s.isActive)
  )

  const handleCreate = async () => {
    if (!formData.employeeId) return
    setLoading(true)

    try {
      const response = await fetch('/api/recurring-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        const employee = employees.find((e) => e.id === formData.employeeId)
        setSchedules([
          { ...data.schedule, employee },
          ...schedules,
        ])
        setShowForm(false)
        setFormData({
          employeeId: '',
          frequency: 'BIWEEKLY',
          dayOfWeek: 1,
          timeOfDay: '10:00',
        })
        toastSuccess('Schedule created')
        router.refresh()
      } else {
        const error = await response.json()
        toastError(error.error || 'Failed to create schedule')
      }
    } catch {
      toastError('Failed to create schedule')
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (schedule: Schedule) => {
    setEditingId(schedule.id)
    setEditData({
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek,
      timeOfDay: schedule.timeOfDay,
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditData(null)
  }

  const handleUpdate = async (scheduleId: string) => {
    if (!editData) return
    setEditLoading(true)

    try {
      const response = await fetch(`/api/recurring-schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })

      if (response.ok) {
        setSchedules(
          schedules.map((s) =>
            s.id === scheduleId ? { ...s, ...editData } : s
          )
        )
        setEditingId(null)
        setEditData(null)
        toastSuccess('Schedule updated')
        router.refresh()
      } else {
        const error = await response.json()
        toastError(error.error || 'Failed to update schedule')
      }
    } catch {
      toastError('Failed to update schedule')
    } finally {
      setEditLoading(false)
    }
  }

  const handleToggle = async (schedule: Schedule, isActive: boolean) => {
    if (isActive) {
      const ok = await confirm(
        'Pausing this schedule will stop future meetings from being auto-created.',
        { title: 'Pause schedule?', confirmText: 'Pause' }
      )
      if (!ok) return

      const upcoming = schedule.upcomingMeetingCount ?? 0
      let cancelFutureMeetings = false
      if (upcoming > 0) {
        cancelFutureMeetings = await confirm(
          `Do you also want to cancel ${upcoming} already-scheduled upcoming meeting(s)?`,
          {
            title: 'Cancel upcoming meetings?',
            confirmText: 'Yes, cancel them',
            cancelText: 'No, keep them',
          }
        )
      }

      try {
        const response = await fetch(`/api/recurring-schedules/${schedule.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false, cancelFutureMeetings }),
        })

        if (response.ok) {
          const data = await response.json()
          setSchedules(
            schedules.map((s) =>
              s.id === schedule.id ? { ...s, isActive: false } : s
            )
          )
          const cancelled = (data as { cancelledMeetingCount?: number }).cancelledMeetingCount ?? 0
          if (cancelled > 0) {
            toastSuccess(`Schedule paused and ${cancelled} meeting(s) cancelled`)
          } else {
            toastSuccess('Schedule paused')
          }
          router.refresh()
        } else {
          const err = await response.json()
          toastError(err.error || 'Failed to update schedule')
        }
      } catch {
        toastError('Failed to update schedule')
      }
      return
    }

    try {
      const response = await fetch(`/api/recurring-schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })

      if (response.ok) {
        setSchedules(
          schedules.map((s) =>
            s.id === schedule.id ? { ...s, isActive: true } : s
          )
        )
        toastSuccess('Schedule resumed')
        router.refresh()
      }
    } catch {
      toastError('Failed to update schedule')
    }
  }

  const handleDelete = async (schedule: Schedule) => {
    const upcoming = schedule.upcomingMeetingCount ?? 0
    const message =
      upcoming > 0
        ? `This will delete the recurring schedule and cancel ${upcoming} upcoming meeting(s). Past and completed meetings will be kept. Continue?`
        : 'Are you sure you want to delete this recurring schedule?'
    if (!(await confirm(message, { variant: 'danger', confirmText: 'Delete', title: 'Delete schedule?' }))) return

    try {
      const response = await fetch(`/api/recurring-schedules/${schedule.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const err = await response.json()
        toastError(err.error || 'Failed to delete schedule')
        return
      }

      const data = await response.json()
      const cancelled = (data as { cancelledMeetingCount?: number }).cancelledMeetingCount ?? 0
      setSchedules(schedules.filter((s) => s.id !== schedule.id))
      if (cancelled > 0) {
        toastSuccess(`Schedule deleted. ${cancelled} meeting(s) cancelled.`)
      } else {
        toastSuccess('Schedule deleted')
      }
      router.refresh()
    } catch {
      toastError('Failed to delete schedule')
    }
  }

  const selectClass = "w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-off-white dark:bg-dark-gray px-4 py-3 text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-orange/50 appearance-none pr-10 text-sm"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/meetings"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-off-white dark:hover:bg-dark-gray transition-colors"
            aria-label="Back to meetings"
          >
            <ArrowLeft className="w-5 h-5 text-medium-gray" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-dark-gray dark:text-white">
              Recurring Meetings
            </h1>
            <p className="text-sm text-medium-gray mt-0.5">
              Auto-schedule one-on-ones with your team
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={availableEmployees.length === 0}
          className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 transition-all text-sm sm:text-base min-h-[44px]"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New Schedule</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-4 sm:p-6">
          <h3 className="font-semibold text-dark-gray dark:text-white mb-4">
            Create Recurring Schedule
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Team Member
              </label>
              <div className="relative">
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Select...</option>
                  {availableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Frequency
              </label>
              <div className="relative">
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as RecurringFrequency })}
                  className={selectClass}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Every 2 Weeks</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Day
              </label>
              <div className="relative">
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                  className={selectClass}
                >
                  {dayNames.map((day, index) => (
                    <option key={day} value={index}>{day}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Time
              </label>
              <div className="relative">
                <select
                  value={formData.timeOfDay}
                  onChange={(e) => setFormData({ ...formData, timeOfDay: e.target.value })}
                  className={selectClass}
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>{formatTime(time)}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !formData.employeeId}
              className="flex items-center gap-2 px-5 py-2.5 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 transition-all min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Schedule
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-12 text-center">
          <Repeat className="w-16 h-16 text-light-gray mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-dark-gray dark:text-white mb-2">
            No Recurring Schedules
          </h3>
          <p className="text-medium-gray max-w-md mx-auto">
            Set up recurring one-on-one meetings with your team members to stay connected regularly.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
          <div className="divide-y divide-off-white dark:divide-medium-gray/20">
            {schedules.map((schedule) => {
              const isEditing = editingId === schedule.id

              return (
                <div key={schedule.id} className={!schedule.isActive && !isEditing ? 'opacity-50' : ''}>
                  {/* View mode */}
                  {!isEditing ? (
                    <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-dark-gray dark:text-white truncate">
                          {schedule.employee?.name || 'Unknown'}
                        </p>
                        <p className="text-sm text-medium-gray">
                          {frequencyLabels[schedule.frequency]} · {dayNames[schedule.dayOfWeek]}s · {formatTime(schedule.timeOfDay)}
                        </p>
                        {schedule.nextMeetingDate && schedule.isActive && (
                          <p className="text-xs text-medium-gray mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Next: {new Date(schedule.nextMeetingDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditing(schedule)}
                          className="p-2.5 hover:bg-off-white dark:hover:bg-dark-gray rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="Edit schedule"
                          aria-label="Edit schedule"
                        >
                          <Pencil className="w-4 h-4 text-medium-gray" />
                        </button>
                        <button
                          onClick={() => handleToggle(schedule, schedule.isActive)}
                          className="p-2.5 hover:bg-off-white dark:hover:bg-dark-gray rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title={schedule.isActive ? 'Pause schedule' : 'Resume schedule'}
                          aria-label={schedule.isActive ? 'Pause schedule' : 'Resume schedule'}
                        >
                          {schedule.isActive ? (
                            <ToggleRight className="w-6 h-6 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-medium-gray" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(schedule)}
                          className="p-2.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="Delete schedule"
                          aria-label="Delete schedule"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Edit mode */
                    <div className="p-4 sm:p-6 bg-off-white/50 dark:bg-dark-gray/30">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-dark-gray dark:text-white">
                            {schedule.employee?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-medium-gray">Editing schedule</p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-xs font-medium text-medium-gray mb-1.5">Frequency</label>
                          <div className="relative">
                            <select
                              value={editData?.frequency}
                              onChange={(e) => setEditData({ ...editData!, frequency: e.target.value as RecurringFrequency })}
                              className={selectClass}
                            >
                              <option value="WEEKLY">Weekly</option>
                              <option value="BIWEEKLY">Every 2 Weeks</option>
                              <option value="MONTHLY">Monthly</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-medium-gray mb-1.5">Day</label>
                          <div className="relative">
                            <select
                              value={editData?.dayOfWeek}
                              onChange={(e) => setEditData({ ...editData!, dayOfWeek: parseInt(e.target.value) })}
                              className={selectClass}
                            >
                              {dayNames.map((day, index) => (
                                <option key={day} value={index}>{day}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-medium-gray mb-1.5">Time</label>
                          <div className="relative">
                            <select
                              value={editData?.timeOfDay}
                              onChange={(e) => setEditData({ ...editData!, timeOfDay: e.target.value })}
                              className={selectClass}
                            >
                              {timeOptions.map((time) => (
                                <option key={time} value={time}>{formatTime(time)}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          onClick={cancelEditing}
                          disabled={editLoading}
                          className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors min-h-[44px] rounded-xl"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdate(schedule.id)}
                          disabled={editLoading}
                          className="flex items-center gap-1.5 px-5 py-2.5 text-sm bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 transition-all min-h-[44px]"
                        >
                          {editLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Save Changes
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
