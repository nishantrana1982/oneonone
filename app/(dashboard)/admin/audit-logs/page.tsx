import { requireAdmin } from '@/lib/auth-helpers'
import { AuditLogsClient } from './audit-logs-client'

export default async function AuditLogsPage() {
  await requireAdmin()
  return <AuditLogsClient />
}
