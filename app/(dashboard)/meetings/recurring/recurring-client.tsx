'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  Repeat, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Loader2,
  Check
} from 'lucide-react'
import { RecurringFrequency } from '@prisma/client'

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

export function RecurringSchedulesClient({ employees, initialSchedules }: Props) {
  const router = useRouter()
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    employeeId: '',
    frequency: 'BIWEEKLY' as RecurringFrequency,
    dayOfWeek: 1, // Monday
    timeOfDay: '10:00',
  })

  // Filter out employees who already have a schedule
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
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create schedule')
      }
    } catch (error) {
      alert('Failed to create schedule')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (scheduleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/recurring-schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (response.ok) {
        setSchedules(
          schedules.map((s) =>
            s.id === scheduleId ? { ...s, isActive: !isActive } : s
          )
        )
      }
    } catch (error) {
      console.error('Failed to toggle schedule:', error)
    }
  }

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this recurring schedule?')) return

    try {
      const response = await fetch(`/api/recurring-schedules/${scheduleId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSchedules(schedules.filter((s) => s.id !== scheduleId))
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error)
    }
  }

  const timeOptions = Array.from({ length: 24 * 2 }, (_, i) => {
    const hour = Math.floor(i / 2)
    const minute = i % 2 === 0 ? '00' : '30'
    return `${String(hour).padStart(2, '0')}:${minute}`
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/meetings"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-off-white dark:hover:bg-dark-gray transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-medium-gray" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-2">
              Recurring Meetings
            </h1>
            <p className="text-medium-gray">
              Auto-schedule one-on-ones with your team
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={availableEmployees.length === 0}
          className="flex items-center gap-2 px-5 py-3 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 transition-all"
        >
          <Plus className="w-5 h-5" />
          New Schedule
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-6">
          <h3 className="font-semibold text-dark-gray dark:text-white mb-4">
            Create Recurring Schedule
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Team Member
              </label>
              <select
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-off-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white"
              >
                <option value="">Select...</option>
                {availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name || emp.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Frequency
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as RecurringFrequency })}
                className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-off-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Every 2 Weeks</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Day
              </label>
              <select
                value={formData.dayOfWeek}
                onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-off-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white"
              >
                {dayNames.map((day, index) => (
                  <option key={day} value={index}>{day}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Time
              </label>
              <select
                value={formData.timeOfDay}
                onChange={(e) => setFormData({ ...formData, timeOfDay: e.target.value })}
                className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-off-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white"
              >
                {timeOptions.map((time) => (
                  <option key={time} value={time}>
                    {new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !formData.employeeId}
              className="flex items-center gap-2 px-5 py-2 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 transition-all"
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
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`flex items-center gap-4 p-6 ${
                  !schedule.isActive ? 'opacity-50' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-dark-gray dark:text-white">
                    {schedule.employee?.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-medium-gray">
                    {frequencyLabels[schedule.frequency]} on {dayNames[schedule.dayOfWeek]}s at{' '}
                    {new Date(`2000-01-01T${schedule.timeOfDay}:00`).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </p>
                </div>

                {schedule.nextMeetingDate && schedule.isActive && (
                  <div className="text-right">
                    <p className="text-xs text-medium-gray">Next meeting</p>
                    <p className="text-sm font-medium text-dark-gray dark:text-white">
                      {new Date(schedule.nextMeetingDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(schedule.id, schedule.isActive)}
                    className="p-2 hover:bg-off-white dark:hover:bg-charcoal rounded-lg transition-colors"
                    title={schedule.isActive ? 'Pause' : 'Resume'}
                  >
                    {schedule.isActive ? (
                      <ToggleRight className="w-6 h-6 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-medium-gray" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
