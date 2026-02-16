'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'

interface AddTodoFormProps {
  meetingId: string
  employeeId: string
  employeeName: string
  reporterId: string
  reporterName: string
}

export function AddTodoForm({ meetingId, employeeId, employeeName, reporterId, reporterName }: AddTodoFormProps) {
  const router = useRouter()
  const { toastError } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedToId: employeeId,
    priority: 'MEDIUM',
    dueDate: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          meetingId,
          dueDate: formData.dueDate || null,
        }),
      })

      if (!response.ok) throw new Error('Failed to create todo')

      setFormData({
        title: '',
        description: '',
        assignedToId: employeeId,
        priority: 'MEDIUM',
        dueDate: '',
      })
      setIsOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error creating todo:', error)
      toastError('Failed to create task. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-dark-gray dark:text-white hover:bg-off-white dark:hover:bg-charcoal rounded-xl transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Task
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-off-white dark:border-medium-gray/20 bg-off-white/50 dark:bg-charcoal/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-dark-gray dark:text-white">New Task</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-white dark:hover:bg-dark-gray rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-medium-gray" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-dark-gray dark:text-white mb-1">
            Task Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="What needs to be done?"
            className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-gray dark:text-white mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Add more details..."
            rows={2}
            className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Assign To
            </label>
            <div className="relative">
              <select
                value={formData.assignedToId}
                onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                className="w-full appearance-none rounded-xl border border-light-gray/30 dark:border-medium-gray/30 bg-white dark:bg-charcoal px-4 py-3.5 pr-10 text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20 cursor-pointer shadow-sm"
              >
                <option value={employeeId}>{employeeName}</option>
                <option value={reporterId}>{reporterName}</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-medium-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Priority
            </label>
            <div className="relative">
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full appearance-none rounded-xl border border-light-gray/30 dark:border-medium-gray/30 bg-white dark:bg-charcoal px-4 py-3.5 pr-10 text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20 cursor-pointer shadow-sm"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-medium-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Due Date
            </label>
            <DatePicker
              value={formData.dueDate}
              onChange={(value) => setFormData({ ...formData, dueDate: value })}
              placeholder="Select date"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-sm font-medium text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !formData.title.trim()}
            className="px-4 py-2 text-sm font-medium bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  )
}
