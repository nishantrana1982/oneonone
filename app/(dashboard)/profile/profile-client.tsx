'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mail, Phone, Briefcase, Building2, Calendar, Save, Loader2, Camera } from 'lucide-react'
import { UserRole } from '@prisma/client'

interface ProfileUser {
  id: string
  name: string
  email: string
  avatar: string | null
  phone: string | null
  title: string | null
  bio: string | null
  role: UserRole
  department: { id: string; name: string } | null
  reportsTo: { id: string; name: string; email: string } | null
  createdAt: string
}

interface ProfileClientProps {
  user: ProfileUser
  departments: { id: string; name: string }[]
}

export function ProfileClient({ user, departments }: ProfileClientProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [formData, setFormData] = useState({
    name: user.name,
    phone: user.phone || '',
    title: user.title || '',
    bio: user.bio || '',
  })

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' })
    } finally {
      setSaving(false)
    }
  }

  const roleLabels: Record<UserRole, string> = {
    EMPLOYEE: 'Employee',
    REPORTER: 'Team Lead / Reporter',
    SUPER_ADMIN: 'Super Admin',
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-2">My Profile</h1>
        <p className="text-medium-gray">Manage your personal information</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-xl p-4 ${
          message.type === 'success' 
            ? 'bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400' 
            : 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Card */}
      <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
        {/* Header with avatar */}
        <div className="relative h-32 bg-gradient-to-r from-charcoal to-dark-gray">
          <div className="absolute -bottom-12 left-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-charcoal to-medium-gray dark:from-medium-gray dark:to-charcoal border-4 border-white dark:border-dark-gray flex items-center justify-center text-white text-3xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-white dark:bg-charcoal rounded-full shadow-lg flex items-center justify-center hover:bg-off-white dark:hover:bg-charcoal transition-colors">
                <Camera className="w-4 h-4 text-medium-gray" />
              </button>
            </div>
          </div>
        </div>

        <div className="pt-16 p-6">
          {/* Read-only info */}
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-off-white dark:bg-charcoal p-4">
              <div className="flex items-center gap-2 text-medium-gray mb-1">
                <Mail className="w-4 h-4" />
                <span className="text-xs font-medium">Email</span>
              </div>
              <p className="text-dark-gray dark:text-white font-medium">{user.email}</p>
            </div>

            <div className="rounded-xl bg-off-white dark:bg-charcoal p-4">
              <div className="flex items-center gap-2 text-medium-gray mb-1">
                <User className="w-4 h-4" />
                <span className="text-xs font-medium">Role</span>
              </div>
              <p className="text-dark-gray dark:text-white font-medium">{roleLabels[user.role]}</p>
            </div>

            {user.department && (
              <div className="rounded-xl bg-off-white dark:bg-charcoal p-4">
                <div className="flex items-center gap-2 text-medium-gray mb-1">
                  <Building2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Department</span>
                </div>
                <p className="text-dark-gray dark:text-white font-medium">{user.department.name}</p>
              </div>
            )}

            {user.reportsTo && (
              <div className="rounded-xl bg-off-white dark:bg-charcoal p-4">
                <div className="flex items-center gap-2 text-medium-gray mb-1">
                  <User className="w-4 h-4" />
                  <span className="text-xs font-medium">Reports To</span>
                </div>
                <p className="text-dark-gray dark:text-white font-medium">{user.reportsTo.name || user.reportsTo.email}</p>
              </div>
            )}

            <div className="rounded-xl bg-off-white dark:bg-charcoal p-4">
              <div className="flex items-center gap-2 text-medium-gray mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Member Since</span>
              </div>
              <p className="text-dark-gray dark:text-white font-medium">
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
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20"
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
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-3 rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20"
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
                className="w-full px-4 py-3 rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell us about yourself..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal text-dark-gray dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-gray/20 dark:focus:ring-white/20 resize-none"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white disabled:opacity-50 transition-colors"
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
          </div>
        </div>
      </div>
    </div>
  )
}
