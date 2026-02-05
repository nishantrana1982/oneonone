'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'

export function MarkCompletedButton({ meetingId }: { meetingId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleMarkCompleted = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      })
      if (!res.ok) throw new Error('Failed to update')
      router.refresh()
    } catch (e) {
      console.error(e)
      alert('Failed to mark meeting as completed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleMarkCompleted}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors disabled:opacity-60"
    >
      <CheckCircle className="w-5 h-5" />
      {loading ? 'Updating...' : 'Mark meeting as completed'}
    </button>
  )
}
