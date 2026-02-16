'use client'

import { OneOnOneForm } from '@/components/forms/one-on-one-form'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface MeetingFormClientProps {
  meetingId: string
  initialData: any
  isReadOnly?: boolean
  isSubmitted?: boolean
}

export function MeetingFormClient({
  meetingId,
  initialData,
  isReadOnly = false,
  isSubmitted = false,
}: MeetingFormClientProps) {
  const router = useRouter()
  const { toastError } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)

  const save = async (data: any, draft: boolean) => {
    setIsLoading(true)
    setDraftSaved(false)
    try {
      const response = await fetch(`/api/meetings/${meetingId}/form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, draft }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save form')
      }

      if (draft) {
        setDraftSaved(true)
        router.refresh()
      } else {
        router.push(`/meetings/${meetingId}`)
        router.refresh()
      }
    } catch (error) {
      console.error('Error saving form:', error)
      toastError(error instanceof Error ? error.message : 'Failed to save. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/meetings/${meetingId}`}
          className="inline-flex items-center gap-2 text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to meeting
        </Link>
        <h1 className="text-3xl font-semibold text-dark-gray dark:text-white mb-2">
          One-on-One Form
        </h1>
        <p className="text-medium-gray">
          {isReadOnly
            ? 'This form was submitted. It can no longer be edited after the meeting time.'
            : isSubmitted
              ? 'You can update your responses until the meeting time.'
              : 'Please fill out this form before your meeting. You can save a draft and finish later.'}
        </p>
      </div>

      <OneOnOneForm
        initialData={initialData}
        isLoading={isLoading}
        isReadOnly={isReadOnly}
        onSaveDraft={(data) => save(data, true)}
        onSubmit={(data) => save(data, false)}
        draftSaved={draftSaved}
      />
    </div>
  )
}
