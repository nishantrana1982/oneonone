'use client'

import { OneOnOneForm } from '@/components/forms/one-on-one-form'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface MeetingFormClientProps {
  meetingId: string
  initialData: any
}

export function MeetingFormClient({ meetingId, initialData }: MeetingFormClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: any) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/meetings/${meetingId}/form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to submit form')
      }

      router.push(`/meetings/${meetingId}`)
      router.refresh()
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('Failed to submit form. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-dark-gray dark:text-white mb-2">
          One-on-One Form
        </h1>
        <p className="text-medium-gray">Please fill out this form before your meeting</p>
      </div>

      <OneOnOneForm onSubmit={handleSubmit} initialData={initialData} isLoading={isLoading} />
    </div>
  )
}
