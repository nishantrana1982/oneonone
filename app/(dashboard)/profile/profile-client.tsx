'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mail, Phone, Briefcase, Building2, Calendar, Save, Loader2, Users, ChevronDown } from 'lucide-react'
import { UserRole } from '@prisma/client'
import { useToast } from '@/components/ui/toast'

interface ProfileUser {
  id: string
  name: string
  email: string
  avatar: string | null
  phone: string | null
  title: string | null
  role: UserRole
  departmentId: string | null
  reportsToId: string | null
  department: { id: string; name: string } | null
  reportsTo: { id: string; name: string; email: string } | null
  createdAt: string
}

interface ProfileClientProps {
  user: ProfileUser
  departments: { id: string; name: string }[]
  managers: { id: string; name: string; email: string }[]
}

export function ProfileClient({ user, departments, managers }: ProfileClientProps) {
  const router = useRouter()
  const { toastSuccess, toastError } = useToast()
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: user.name,
    phone: user.phone || '',
    title: user.title || '',
    departmentId: user.departmentId || '',
    reportsToId: user.reportsToId || '',
  })

  const handleSave = async () => {
    if (!formData.name || formData.name.trim().length < 2) {
      toastError('Name must be at least 2 characters')
      return
    }

    setSaving(true)
    
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        toastSuccess('Profile updated successfully!')
        router.refresh()
      } else {
        toastError(data.error || 'Failed to update profile')
      }
    } catch {
      toastError('Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const roleLabels: Record<UserRole, string> = {
    EMPLOYEE: 'Employee',
    REPORTER: 'Team Lead / Reporter',
    SUPER_ADMIN: 'Super Admin',
  }

  const hasChanges =
    formData.name !== user.name ||
    formData.phone !== (user.phone || '') ||
    formData.title !== (user.title || '') ||
    formData.departmentId !== (user.departmentId || '') ||
    formData.reportsToId !== (user.reportsToId || '')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-dark-gray dark:text-white mb-1">My Profile</h1>
        <p className="text-sm sm:text-base text-medium-gray">Manage your personal information</p>
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
        {/* Header with avatar */}
        <div className="relative h-28 sm:h-32 bg-gradient-to-r from-charcoal to-dark-gray">
          <div className="absolute -bottom-10 sm:-bottom-12 left-4 sm:left-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-charcoal to-medium-gray dark:from-medium-gray dark:to-charcoal border-4 border-white dark:border-dark-gray flex items-center justify-center text-white text-2xl sm:text-3xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="pt-14 sm:pt-16 p-4 sm:p-6">
          {/* Read-only info */}
          <div className="mb-6 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="rounded-xl bg-off-white dark:bg-dark-gray p-3 sm:p-4">
              <div className="flex items-center gap-2 text-medium-gray mb-1">
                <Mail className="w-4 h-4" />
                <span className="text-xs font-medium">Email</span>
              </div>
              <p className="text-dark-gray dark:text-white font-medium text-sm sm:text-base truncate">{user.email}</p>
            </div>

            <div className="rounded-xl bg-off-white dark:bg-dark-gray p-3 sm:p-4">
              <div className="flex items-center gap-2 text-medium-gray mb-1">
                <User className="w-4 h-4" />
                <span className="text-xs font-medium">Role</span>
              </div>
              <p className="text-dark-gray dark:text-white font-medium text-sm sm:text-base">{roleLabels[user.role]}</p>
            </div>

            <div className="rounded-xl bg-off-white dark:bg-dark-gray p-3 sm:p-4">
              <div className="flex items-center gap-2 text-medium-gray mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Member Since</span>
              </div>
              <p className="text-dark-gray dark:text-white font-medium text-sm sm:text-base">
                {new Date(user.createdAt).toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </p>
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            <h3 className="font-semibold text-dark-gray dark:text-white">Edit Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-dark-gray text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-orange/50 transition-shadow"
                aria-label="Full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-medium-gray" />
                  Phone Number
                </div>
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-3 rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-dark-gray text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-orange/50 transition-shadow"
                aria-label="Phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-medium-gray" />
                  Job Title
                </div>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Senior Developer"
                className="w-full px-4 py-3 rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-dark-gray text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-orange/50 transition-shadow"
                aria-label="Job title"
              />
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-medium-gray" />
                    Department
                  </div>
                </label>
                <div className="relative">
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-dark-gray text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-orange/50 transition-shadow appearance-none pr-10"
                    aria-label="Department"
                  >
                    <option value="">No department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-medium-gray" />
                    Reporting Manager
                  </div>
                </label>
                <div className="relative">
                  <select
                    value={formData.reportsToId}
                    onChange={(e) => setFormData({ ...formData, reportsToId: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-dark-gray text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-orange/50 transition-shadow appearance-none pr-10"
                    aria-label="Reporting manager"
                  >
                    <option value="">No reporting manager</option>
                    {managers.map((mgr) => (
                      <option key={mgr.id} value={mgr.id}>
                        {mgr.name} ({mgr.email})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center gap-2 px-6 py-3 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-40 transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-orange/50 focus-visible:outline-none"
                aria-label="Save profile changes"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>
              {hasChanges && (
                <span className="text-xs text-medium-gray">You have unsaved changes</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
