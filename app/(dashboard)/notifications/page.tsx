import { getCurrentUser } from '@/lib/auth-helpers'
import { notFound } from 'next/navigation'
import { NotificationsClient } from './notifications-client'

export default async function NotificationsPage() {
  const user = await getCurrentUser()
  if (!user) return notFound()

  return <NotificationsClient />
}
