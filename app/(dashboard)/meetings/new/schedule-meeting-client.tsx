'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Repeat, ArrowLeft, Loader2, Check, AlertCircle } from 'lucide-react'
import { RecurringFrequency } from '@prisma/client'
import { NewMeetingForm } from './new-meeting-form'
import { useToast } from '@/components/ui/toast'

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const frequencyOptions: { value: RecurringFrequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Every 2 weeks' },
  { value: 'MONTHLY', label: 'Monthly' },
]

interface ScheduleMeetingClientProps {
  employees: Array<{ id: string; name: string; email: string }>
  currentUserId: string
}

type ScheduleType = 'one-time' | 'recurring'

export function ScheduleMeetingClient({ employees, currentUserId }: ScheduleMeetingClientProps) {
  const router = useRouter()
  const { toastError } = useToast()
  const [scheduleType, setScheduleType] = useState<ScheduleType | null>(null)
  const [recurringLoading, setRecurringLoading] = useState(false)
  const [recurringForm, setRecurringForm] = useState({
    employeeId: '',
    frequency: 'BIWEEKLY' as RecurringFrequency,
    dayOfWeek: 1,
    timeOfDay: '10:00',
  })
  const [recurringAvailabilityLoading, setRecurringAvailabilityLoading] = useState(false)
  const [recurringAvailability, setRecurringAvailability] = useState<{
    available: boolean | null
    message: string | null
    calendarUnavailable: boolean
  } | null>(null)

  const fetchRecurringAvailability = useCallback(async () => {
    if (!recurringForm.employeeId || recurringForm.timeOfDay === '') return
    setRecurringAvailabilityLoading(true)
    setRecurringAvailability(null)
    try {
      const params = new URLSearchParams({
        employeeId: recurringForm.employeeId,
        dayOfWeek: String(recurringForm.dayOfWeek),
        timeOfDay: recurringForm.timeOfDay,
        frequency: recurringForm.frequency,
      })
      const res = await fetch(`/api/meetings/availability/recurring?${params}`)
      const data = await res.json()
      if (res.ok) {
        setRecurringAvailability({
          available: data.available ?? null,
          message: data.message ?? null,
          calendarUnavailable: data.calendarUnavailable ?? true,
        })
      }
    } catch {
      setRecurringAvailability(null)
    } finally {
      setRecurringAvailabilityLoading(false)
    }
  }, [recurringForm.employeeId, recurringForm.dayOfWeek, recurringForm.timeOfDay, recurringForm.frequency])

  useEffect(() => {
    if (recurringForm.employeeId && recurringForm.timeOfDay) {
      fetchRecurringAvailability()
    } else {
      setRecurringAvailability(null)
    }
  }, [recurringForm.employeeId, recurringForm.dayOfWeek, recurringForm.timeOfDay, recurringForm.frequency, fetchRecurringAvailability])

  const timeOptions = Array.from({ length: 20 }, (_, i) => {
    const hour = 9 + Math.floor(i / 2)
    const minute = i % 2 === 0 ? '00' : '30'
    return `${String(hour).padStart(2, '0')}:${minute}`
  })

  const handleRecurringSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recurringForm.employeeId) return
    setRecurringLoading(true)
    try {
      const res = await fetch('/api/recurring-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recurringForm),
      })
      if (res.ok) {
        router.push('/meetings')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toastError(data.error || 'Failed to create recurring schedule')
      }
    } catch {
      toastError('Failed to create recurring schedule')
    } finally {
      setRecurringLoading(false)
    }
  }

  // Step 1: Choose type
  if (scheduleType === null) {
    return (
      <div className="max-w-2xl space-y-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-medium-gray hover:text-dark-gray dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to meetings</span>
        </button>

        <p className="text-medium-gray">Choose how you want to schedule:</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setScheduleType('one-time')}
            className="flex flex-col items-start gap-3 p-6 rounded-2xl border-2 border-off-white dark:border-medium-gray/20 hover:border-dark-gray dark:hover:border-white hover:bg-off-white/50 dark:hover:bg-charcoal/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-dark-gray dark:text-white">One-time meeting</h3>
              <p className="text-sm text-medium-gray mt-1">Schedule a single one-on-one for a specific date and time.</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setScheduleType('recurring')}
            className="flex flex-col items-start gap-3 p-6 rounded-2xl border-2 border-off-white dark:border-medium-gray/20 hover:border-dark-gray dark:hover:border-white hover:bg-off-white/50 dark:hover:bg-charcoal/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Repeat className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-dark-gray dark:text-white">Recurring schedule</h3>
              <p className="text-sm text-medium-gray mt-1">Set up weekly or bi-weekly one-on-ones that repeat automatically.</p>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // Step 2a: One-time form
  if (scheduleType === 'one-time') {
    return (
      <div className="max-w-2xl">
        <button
          type="button"
          onClick={() => setScheduleType(null)}
          className="flex items-center gap-2 text-medium-gray hover:text-dark-gray dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <NewMeetingForm employees={employees} currentUserId={currentUserId} />
      </div>
    )
  }

  // Step 2b: Recurring form
  return (
    <div className="max-w-2xl space-y-8">
      <button
        type="button"
        onClick={() => setScheduleType(null)}
        className="flex items-center gap-2 text-medium-gray hover:text-dark-gray dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <Repeat className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h2 className="font-semibold text-dark-gray dark:text-white">Recurring schedule</h2>
            <p className="text-sm text-medium-gray">Meetings will be created automatically</p>
          </div>
        </div>

        <form onSubmit={handleRecurringSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Team member
            </label>
            <select
              value={recurringForm.employeeId}
              onChange={(e) => setRecurringForm({ ...recurringForm, employeeId: e.target.value })}
              className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20"
              required
            >
              <option value="">Select team member...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Frequency
              </label>
              <select
                value={recurringForm.frequency}
                onChange={(e) =>
                  setRecurringForm({ ...recurringForm, frequency: e.target.value as RecurringFrequency })
                }
                className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20"
              >
                {frequencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Day of week
              </label>
              <select
                value={recurringForm.dayOfWeek}
                onChange={(e) =>
                  setRecurringForm({ ...recurringForm, dayOfWeek: parseInt(e.target.value, 10) })
                }
                className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20"
              >
                {dayNames.map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Time
              </label>
              <select
                value={recurringForm.timeOfDay}
                onChange={(e) => setRecurringForm({ ...recurringForm, timeOfDay: e.target.value })}
                className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20"
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

          {recurringForm.employeeId && recurringForm.timeOfDay && (
            <div className="rounded-xl border border-off-white dark:border-medium-gray/20 p-3 sm:p-4 bg-off-white/30 dark:bg-dark-gray/30">
              {recurringAvailabilityLoading ? (
                <p className="text-sm text-medium-gray flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking both calendars...
                </p>
              ) : recurringAvailability?.message ? (
                <p className={`text-sm flex items-center gap-2 ${
                  recurringAvailability.calendarUnavailable
                    ? 'text-medium-gray'
                    : recurringAvailability.available
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {!recurringAvailability.calendarUnavailable && recurringAvailability.available === false && (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  {recurringAvailability.message}
                </p>
              ) : null}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setScheduleType(null)}
              className="px-6 py-3 rounded-xl text-medium-gray hover:text-dark-gray dark:hover:text-white hover:bg-off-white dark:hover:bg-charcoal transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recurringLoading || !recurringForm.employeeId}
              className="px-6 py-3 rounded-xl bg-dark-gray dark:bg-white text-white dark:text-dark-gray font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {recurringLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create recurring schedule
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
