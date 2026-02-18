'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock, Calendar, Loader2, AlertCircle, X } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'

interface FreeSlot {
  start: string
  end: string
}

interface ProposalActionsProps {
  meetingId: string
  meetingDate: string
  proposedByName: string
  isReceiver: boolean
  isProposer: boolean
  otherPartyName: string
}

export function ProposalActions({
  meetingId,
  meetingDate,
  proposedByName,
  isReceiver,
  isProposer,
  otherPartyName,
}: ProposalActionsProps) {
  const router = useRouter()
  const { toastSuccess, toastError } = useToast()
  const [accepting, setAccepting] = useState(false)
  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestDate, setSuggestDate] = useState('')
  const [suggestTime, setSuggestTime] = useState('')
  const [submittingSuggest, setSubmittingSuggest] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Availability slots for suggest flow
  const [slots, setSlots] = useState<FreeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [calendarUnavailable, setCalendarUnavailable] = useState(false)

  const formattedDate = new Date(meetingDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const today = new Date()
  const minDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
  const isSuggestDateToday = suggestDate === minDate

  const handleAccept = async () => {
    setAccepting(true)
    try {
      const res = await fetch(`/api/meetings/${meetingId}/accept`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to accept')
      }
      toastSuccess('Meeting confirmed! Calendar event created.')
      router.refresh()
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to accept meeting')
    } finally {
      setAccepting(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this meeting proposal? This cannot be undone.')) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel')
      }
      toastSuccess('Meeting proposal cancelled.')
      router.refresh()
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to cancel proposal')
    } finally {
      setCancelling(false)
    }
  }

  // Fetch availability when date changes in suggest flow
  const fetchSlots = useCallback(async (date: string) => {
    setSlotsLoading(true)
    setSlots([])
    setCalendarUnavailable(false)
    setSuggestTime('')

    try {
      // We don't have the employeeId here directly, but the availability API uses
      // the current user's perspective. We'll pass the meeting endpoint instead.
      // Actually the availability API needs employeeId + date. We'll use a different
      // approach: pass the meeting ID to a dedicated endpoint, or just let the user
      // pick any time and the backend validates. For now, show all business-hour slots.
      setCalendarUnavailable(true)
    } catch {
      setCalendarUnavailable(true)
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (suggestDate) {
      fetchSlots(suggestDate)
    }
  }, [suggestDate, fetchSlots])

  const handleSuggest = async () => {
    if (!suggestTime) {
      toastError('Please select a time slot')
      return
    }
    setSubmittingSuggest(true)
    try {
      const res = await fetch(`/api/meetings/${meetingId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingDate: suggestTime }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to suggest new time')
      }
      toastSuccess(isProposer ? 'Proposed time updated!' : 'New time suggested! Waiting for response.')
      setShowSuggest(false)
      router.refresh()
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to suggest new time')
    } finally {
      setSubmittingSuggest(false)
    }
  }

  // Receiver view: can accept or suggest
  if (isReceiver) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-dark-gray dark:text-white text-lg">Meeting Request</p>
              <p className="text-medium-gray mt-1">
                <strong>{proposedByName}</strong> has proposed a one-on-one meeting for{' '}
                <strong>{formattedDate}</strong>.
              </p>
              <p className="text-sm text-medium-gray mt-2">
                Accept the proposed time or suggest an alternative.
              </p>

              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-all min-h-[44px]"
                >
                  {accepting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Accept
                </button>
                <button
                  onClick={() => setShowSuggest(!showSuggest)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-off-white dark:bg-dark-gray text-dark-gray dark:text-white rounded-xl font-medium hover:bg-dark-gray/10 dark:hover:bg-white/10 transition-all min-h-[44px]"
                >
                  <Clock className="w-4 h-4" />
                  Suggest New Time
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Suggest time panel */}
        {showSuggest && (
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5 sm:p-6">
            <h3 className="font-semibold text-dark-gray dark:text-white mb-4">Suggest a different time</h3>
            <div className="space-y-4">
              <DatePicker
                label="Date"
                value={suggestDate}
                onChange={setSuggestDate}
                min={minDate}
                placeholder="Pick a date"
              />

              {suggestDate && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-dark-gray dark:text-white mb-2">
                    <Clock className="w-4 h-4 text-medium-gray" />
                    Select a time
                  </label>
                  {slotsLoading ? (
                    <div className="flex items-center gap-2 py-4 text-medium-gray">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading slots...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {Array.from({ length: 20 }, (_, i) => {
                        const hour = 9 + Math.floor(i / 2)
                        const min = i % 2 === 0 ? '00' : '30'
                        const [year, month, day] = suggestDate.split('-').map(Number)
                        const dt = new Date(year, month - 1, day, hour, parseInt(min))
                        const iso = dt.toISOString()
                        const display = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                        const past = isSuggestDateToday && dt.getTime() <= Date.now()
                        return (
                          <button
                            key={iso}
                            type="button"
                            disabled={past}
                            onClick={() => setSuggestTime(iso)}
                            className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              past
                                ? 'bg-off-white dark:bg-dark-gray text-light-gray dark:text-medium-gray/40 cursor-not-allowed line-through'
                                : suggestTime === iso
                                  ? 'bg-dark-gray dark:bg-white text-white dark:text-dark-gray'
                                  : 'bg-off-white dark:bg-dark-gray text-dark-gray dark:text-white hover:bg-dark-gray/10 dark:hover:bg-white/10'
                            }`}
                          >
                            {display}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowSuggest(false)}
                  className="px-4 py-2.5 text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuggest}
                  disabled={submittingSuggest || !suggestTime}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 transition-all min-h-[44px]"
                >
                  {submittingSuggest ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  Suggest This Time
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Proposer view: waiting for response — can change time or cancel
  if (isProposer) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-blue-500/10 border-2 border-blue-500/30 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-dark-gray dark:text-white text-lg">Awaiting Response</p>
              <p className="text-medium-gray mt-1">
                You proposed this meeting for <strong>{formattedDate}</strong>. Waiting for{' '}
                <strong>{otherPartyName}</strong> to accept or suggest a new time.
              </p>

              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  onClick={() => setShowSuggest(!showSuggest)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-off-white dark:bg-dark-gray text-dark-gray dark:text-white rounded-xl font-medium hover:bg-dark-gray/10 dark:hover:bg-white/10 transition-all min-h-[44px]"
                >
                  <Clock className="w-4 h-4" />
                  Change Time
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-red-500 bg-red-500/10 rounded-xl font-medium hover:bg-red-500/20 disabled:opacity-50 transition-all min-h-[44px]"
                >
                  {cancelling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  Cancel Proposal
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Change time panel */}
        {showSuggest && (
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5 sm:p-6">
            <h3 className="font-semibold text-dark-gray dark:text-white mb-4">Change proposed time</h3>
            <div className="space-y-4">
              <DatePicker
                label="Date"
                value={suggestDate}
                onChange={setSuggestDate}
                min={minDate}
                placeholder="Pick a date"
              />

              {suggestDate && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-dark-gray dark:text-white mb-2">
                    <Clock className="w-4 h-4 text-medium-gray" />
                    Select a time
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {Array.from({ length: 20 }, (_, i) => {
                      const hour = 9 + Math.floor(i / 2)
                      const min = i % 2 === 0 ? '00' : '30'
                      const [year, month, day] = suggestDate.split('-').map(Number)
                      const dt = new Date(year, month - 1, day, hour, parseInt(min))
                      const iso = dt.toISOString()
                      const display = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                      const past = isSuggestDateToday && dt.getTime() <= Date.now()
                      return (
                        <button
                          key={iso}
                          type="button"
                          disabled={past}
                          onClick={() => setSuggestTime(iso)}
                          className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            past
                              ? 'bg-off-white dark:bg-dark-gray text-light-gray dark:text-medium-gray/40 cursor-not-allowed line-through'
                              : suggestTime === iso
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
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowSuggest(false)}
                  className="px-4 py-2.5 text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuggest}
                  disabled={submittingSuggest || !suggestTime}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 transition-all min-h-[44px]"
                >
                  {submittingSuggest ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  Update Proposed Time
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
