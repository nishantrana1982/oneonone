'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, User, ArrowLeft, Check, Search } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'

const formSchema = z.object({
  employeeId: z.string().min(1, 'Please select a team member'),
  meetingDate: z.string().min(1, 'Please select a date'),
  meetingTime: z.string().min(1, 'Please select a time'),
})

type FormData = z.infer<typeof formSchema>

interface NewMeetingFormProps {
  employees: Array<{ id: string; name: string; email: string }>
  currentUserId: string
}

export function NewMeetingForm({ employees, currentUserId }: NewMeetingFormProps) {
  const router = useRouter()
  const { toastError } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [employeeSearch, setEmployeeSearch] = useState('')
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

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
    )
  }, [employees, employeeSearch])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      // Fix: Use explicit Date constructor to ensure local time interpretation
      // String parsing like new Date("2026-02-17T15:30") can inconsistently treat time as UTC
      const [year, month, day] = data.meetingDate.split('-').map(Number)
      const [hours, minutes] = data.meetingTime.split(':').map(Number)
      const meetingDateTime = new Date(year, month - 1, day, hours, minutes)

      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: data.employeeId,
          meetingDate: meetingDateTime.toISOString(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create meeting')
      }

      const meeting = await response.json()
      router.push(`/meetings/${meeting.id}`)
    } catch (error) {
      console.error('Error creating meeting:', error)
      toastError(error instanceof Error ? error.message : 'Failed to create meeting. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Allow today onward for scheduling
  const today = new Date()
  const minDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')

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
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden flex flex-col max-h-[420px]">
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

          {/* Right: Date, Time, Submit - always visible */}
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-visible flex flex-col">
            <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h2 className="font-semibold text-dark-gray dark:text-white">Date & time</h2>
                <p className="text-sm text-medium-gray">Pick when to meet</p>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
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
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-dark-gray dark:text-white mb-2">
                  <Clock className="w-4 h-4 text-medium-gray" />
                  Time
                </label>
                <div className="relative">
                  <select
                    {...register('meetingTime')}
                    className="w-full appearance-none rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20 transition-all"
                  >
                    <option value="">Select time</option>
                    {Array.from({ length: 24 }, (_, hour) =>
                      ['00', '30'].map((min) => {
                        const time = `${String(hour).padStart(2, '0')}:${min}`
                        const displayTime = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })
                        return (
                          <option key={time} value={time}>
                            {displayTime}
                          </option>
                        )
                      })
                    )}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Clock className="w-4 h-4 text-medium-gray" />
                  </div>
                </div>
                {errors.meetingTime && (
                  <p className="mt-2 text-sm text-red-500">{errors.meetingTime.message}</p>
                )}
              </div>
            </div>
            <div className="p-6 pt-0 flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 rounded-xl text-medium-gray hover:text-dark-gray dark:hover:text-white hover:bg-off-white dark:hover:bg-charcoal transition-all order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || employees.length === 0}
                className="px-6 py-3 rounded-xl bg-dark-gray dark:bg-white text-white dark:text-dark-gray font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 dark:border-dark-gray/30 border-t-white dark:border-t-dark-gray rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Schedule Meeting
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
