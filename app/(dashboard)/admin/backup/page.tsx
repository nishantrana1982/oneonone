import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { BackupClient } from './backup-client'

export default async function BackupPage() {
  await requireAdmin()

  const backups = await prisma.backupHistory.findMany({
    orderBy: { startedAt: 'desc' },
    take: 20,
  })

  return <BackupClient initialBackups={backups} />
}
