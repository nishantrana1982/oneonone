import { getCurrentUser } from '@/lib/auth-helpers'
import { notFound } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) return notFound()

  // Only Super Admin can access settings
  if (user.role !== UserRole.SUPER_ADMIN) {
    return notFound()
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-2">
          System Settings
        </h1>
        <p className="text-medium-gray">
          Configure API keys and system settings for the application
        </p>
      </div>

      <SettingsClient />
    </div>
  )
}
