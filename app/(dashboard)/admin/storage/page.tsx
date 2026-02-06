import { requireAdmin } from '@/lib/auth-helpers'
import { StorageClient } from './storage-client'

export default async function StoragePage() {
  await requireAdmin()
  return <StorageClient />
}
