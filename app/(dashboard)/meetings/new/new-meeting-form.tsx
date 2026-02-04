'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, User, ArrowLeft, Check } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'

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
  const [isLoading, setIsLoading] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
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

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const meetingDateTime = new Date(`${data.meetingDate}T${data.meetingTime}`)

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
      alert(error instanceof Error ? error.message : 'Failed to create meeting. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Get tomorrow's date as default minimum
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-medium-gray hover:text-dark-gray dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to meetings</span>
      </button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Team Member Selection */}
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-gray dark:text-white">Select Team Member</h2>
              <p className="text-sm text-medium-gray">Choose who you want to meet with</p>
            </div>
          </div>
          <div className="p-6">
            {employees.length === 0 ? (
              <div className="text-center py-8">
                <User className="w-12 h-12 text-light-gray mx-auto mb-3" />
                <p className="text-medium-gray">No team members available</p>
                <p className="text-sm text-light-gray mt-1">Add team members to your team first</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {employees.map((employee) => (
                  <label
                    key={employee.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
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
                    <div className="w-10 h-10 rounded-full bg-off-white dark:bg-dark-gray flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-dark-gray dark:text-white">{employee.name}</p>
                      <p className="text-sm text-medium-gray">{employee.email}</p>
                    </div>
                    {watchedEmployee === employee.id && (
                      <div className="w-6 h-6 rounded-full bg-dark-gray dark:bg-white flex items-center justify-center">
                        <Check className="w-4 h-4 text-white dark:text-dark-gray" />
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

        {/* Date and Time Selection */}
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-gray dark:text-white">Schedule Meeting</h2>
              <p className="text-sm text-medium-gray">Pick a date and time</p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
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
                      ['00', '30'].map(min => {
                        const time = `${String(hour).padStart(2, '0')}:${min}`
                        const displayTime = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })
                        return (
                          <option key={time} value={time}>{displayTime}</option>
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
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 rounded-xl text-medium-gray hover:text-dark-gray dark:hover:text-white hover:bg-off-white dark:hover:bg-charcoal transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || employees.length === 0}
            className="px-6 py-3 rounded-xl bg-dark-gray dark:bg-white text-white dark:text-dark-gray font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
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
      </form>
    </div>
  )
}
