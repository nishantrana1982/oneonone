'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, User, ArrowLeft, Check, Search, Loader2, AlertCircle } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'

const formSchema = z.object({
  employeeId: z.string().min(1, 'Please select a team member'),
  meetingDate: z.string().min(1, 'Please select a date'),
  meetingTime: z.string().min(1, 'Please select a time slot'),
})

type FormData = z.infer<typeof formSchema>

interface FreeSlot {
  start: string
  end: string
}

interface NewMeetingFormProps {
  employees: Array<{ id: string; name: string; email: string }>
  currentUserId: string
}

export function NewMeetingForm({ employees, currentUserId }: NewMeetingFormProps) {
  const router = useRouter()
  const { toastError, toastSuccess } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [employeeSearch, setEmployeeSearch] = useState('')

  // Availability state
  const [slots, setSlots] = useState<FreeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [calendarUnavailable, setCalendarUnavailable] = useState(false)
  const [calendarMessage, setCalendarMessage] = useState('')
  const [slotsFetched, setSlotsFetched] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const watchedEmployee = watch('employeeId')
  const watchedDate = watch('meetingDate')
  const watchedTime = watch('meetingTime')

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
    )
  }, [employees, employeeSearch])

  // Fetch availability when both employee and date are selected
  const fetchAvailability = useCallback(async (employeeId: string, date: string) => {
    setSlotsLoading(true)
    setSlots([])
    setSlotsFetched(false)
    setCalendarUnavailable(false)
    setCalendarMessage('')
    setValue('meetingTime', '')

    try {
      const res = await fetch(`/api/meetings/availability?employeeId=${employeeId}&date=${date}`)
      const data = await res.json()

      if (data.calendarUnavailable) {
        setCalendarUnavailable(true)
        setCalendarMessage(data.message || 'Calendar not connected.')
      } else {
        setSlots(data.slots ?? [])
      }
      setSlotsFetched(true)
    } catch {
      toastError('Failed to load availability')
    } finally {
      setSlotsLoading(false)
    }
  }, [setValue, toastError])

  useEffect(() => {
    if (watchedEmployee && watchedDate) {
      fetchAvailability(watchedEmployee, watchedDate)
    } else {
      setSlots([])
      setSlotsFetched(false)
      setCalendarUnavailable(false)
    }
  }, [watchedEmployee, watchedDate, fetchAvailability])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: data.employeeId,
          meetingDate: data.meetingTime,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to propose meeting')
      }

      const meeting = await response.json()
      toastSuccess('Meeting proposal sent')
      router.push(`/meetings/${meeting.id}`)
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to propose meeting. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const today = new Date()
  const minDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')

  function formatSlotTime(isoString: string) {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="max-w-4xl">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 text-medium-gray hover:text-dark-gray dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to meetings</span>
      </button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr,1fr] items-start">
          {/* Left: Team Member with search + scrollable list */}
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden flex flex-col max-h-[520px]">
            <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-dark-gray dark:text-white">Select Team Member</h2>
                <p className="text-sm text-medium-gray truncate">Search by name or email</p>
              </div>
            </div>
            <div className="p-4 border-b border-off-white dark:border-medium-gray/20 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-off-white dark:border-medium-gray/20 bg-off-white dark:bg-charcoal text-dark-gray dark:text-white placeholder:text-medium-gray focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20 text-sm"
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto min-h-0 flex-1">
              {employees.length === 0 ? (
                <div className="text-center py-6">
                  <User className="w-10 h-10 text-light-gray mx-auto mb-2" />
                  <p className="text-sm text-medium-gray">No team members available</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-sm text-medium-gray text-center py-4">No matches for &quot;{employeeSearch}&quot;</p>
              ) : (
                <div className="grid gap-2">
                  {filteredEmployees.map((employee) => (
                    <label
                      key={employee.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        watchedEmployee === employee.id
                          ? 'border-dark-gray dark:border-white bg-dark-gray/5 dark:bg-white/5'
                          : 'border-off-white dark:border-medium-gray/20 hover:border-medium-gray dark:hover:border-medium-gray/40'
                      }`}
                    >
                      <input
                        type="radio"
                        {...register('employeeId')}
                        value={employee.id}
                        className="sr-only"
                      />
                      <div className="w-9 h-9 rounded-full bg-off-white dark:bg-dark-gray flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          {employee.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-dark-gray dark:text-white text-sm truncate">{employee.name}</p>
                        <p className="text-xs text-medium-gray truncate">{employee.email}</p>
                      </div>
                      {watchedEmployee === employee.id && (
                        <div className="w-5 h-5 rounded-full bg-dark-gray dark:bg-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-white dark:text-dark-gray" />
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              )}
              {errors.employeeId && (
                <p className="mt-3 text-sm text-red-500">{errors.employeeId.message}</p>
              )}
            </div>
          </div>

          {/* Right: Date, Available Slots, Submit */}
          <div className="space-y-6">
            {/* Date picker card */}
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-visible flex flex-col">
              <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-dark-gray dark:text-white">Pick a date</h2>
                  <p className="text-sm text-medium-gray">Available time slots will appear below</p>
                </div>
              </div>
              <div className="p-6">
                <DatePicker
                  label="Date"
                  value={watchedDate || ''}
                  onChange={(value) => setValue('meetingDate', value, { shouldValidate: true })}
                  min={minDate}
                  placeholder="Select meeting date"
                />
                {errors.meetingDate && (
                  <p className="mt-2 text-sm text-red-500">{errors.meetingDate.message}</p>
                )}
              </div>
            </div>

            {/* Time slots card (visible after date + employee selected) */}
            {watchedEmployee && watchedDate && (
              <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
                <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-dark-gray dark:text-white">Available time slots</h2>
                    <p className="text-sm text-medium-gray">Free on both calendars (9 AM – 7 PM)</p>
                  </div>
                </div>
                <div className="p-4">
                  {slotsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-medium-gray">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Checking calendars...</span>
                    </div>
                  ) : calendarUnavailable ? (
                    <div className="flex items-start gap-3 py-4 px-2">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-dark-gray dark:text-white mb-1">Calendar not connected</p>
                        <p className="text-sm text-medium-gray">{calendarMessage}</p>
                        <p className="text-sm text-medium-gray mt-2">You can still propose any time. The employee will be able to accept or suggest a different time.</p>
                        {/* Fallback: show all 30-min slots */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
                          {Array.from({ length: 20 }, (_, i) => {
                            const hour = 9 + Math.floor(i / 2)
                            const min = i % 2 === 0 ? '00' : '30'
                            const time = `${String(hour).padStart(2, '0')}:${min}`
                            const [year, month, day] = watchedDate.split('-').map(Number)
                            const dt = new Date(year, month - 1, day, hour, parseInt(min))
                            const iso = dt.toISOString()
                            const display = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                            return (
                              <button
                                key={time}
                                type="button"
                                onClick={() => setValue('meetingTime', iso, { shouldValidate: true })}
                                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                  watchedTime === iso
                                    ? 'bg-dark-gray dark:bg-white text-white dark:text-dark-gray'
                                    : 'bg-off-white dark:bg-dark-gray text-dark-gray dark:text-white hover:bg-dark-gray/10 dark:hover:bg-white/10'
                                }`}
                              >
                                {display}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : slotsFetched && slots.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="w-10 h-10 text-light-gray mx-auto mb-2" />
                      <p className="text-sm font-medium text-dark-gray dark:text-white mb-1">No available slots</p>
                      <p className="text-sm text-medium-gray">Both calendars are fully booked on this date. Try another day.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map((slot) => (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setValue('meetingTime', slot.start, { shouldValidate: true })}
                          className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            watchedTime === slot.start
                              ? 'bg-dark-gray dark:bg-white text-white dark:text-dark-gray'
                              : 'bg-off-white dark:bg-dark-gray text-dark-gray dark:text-white hover:bg-dark-gray/10 dark:hover:bg-white/10'
                          }`}
                        >
                          {formatSlotTime(slot.start)}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Hidden input for react-hook-form */}
                  <input type="hidden" {...register('meetingTime')} />
                  {errors.meetingTime && (
                    <p className="mt-3 text-sm text-red-500">{errors.meetingTime.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 rounded-xl text-medium-gray hover:text-dark-gray dark:hover:text-white hover:bg-off-white dark:hover:bg-charcoal transition-all order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || employees.length === 0 || !watchedTime}
                className="px-6 py-3 rounded-xl bg-dark-gray dark:bg-white text-white dark:text-dark-gray font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 order-1 sm:order-2 min-h-[44px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending proposal...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Propose Time
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
