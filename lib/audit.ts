import { prisma } from './prisma'
import { AuditAction, Prisma } from '@prisma/client'

interface AuditLogParams {
  userId: string
  action: AuditAction
  entityType: string
  entityId?: string
  details?: Prisma.InputJsonValue
  ipAddress?: string
  userAgent?: string
}

export async function createAuditLog(params: AuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw - audit logging should not break functionality
  }
}

export async function getAuditLogs(options: {
  userId?: string
  action?: AuditAction
  entityType?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const where: {
    userId?: string
    action?: AuditAction
    entityType?: string
    createdAt?: { gte?: Date; lte?: Date }
  } = {}
  
  if (options.userId) where.userId = options.userId
  if (options.action) where.action = options.action
  if (options.entityType) where.entityType = options.entityType
  if (options.startDate || options.endDate) {
    where.createdAt = {}
    if (options.startDate) where.createdAt.gte = options.startDate
    if (options.endDate) where.createdAt.lte = options.endDate
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    }),
    prisma.auditLog.count({ where }),
  ])

  return { logs, total }
}

// Helper functions for common audit actions
export async function logUserCreated(adminId: string, newUserId: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId: adminId,
    action: 'CREATE',
    entityType: 'User',
    entityId: newUserId,
    details,
  })
}

export async function logUserUpdated(adminId: string, targetUserId: string, changes: Prisma.InputJsonValue) {
  return createAuditLog({
    userId: adminId,
    action: 'UPDATE',
    entityType: 'User',
    entityId: targetUserId,
    details: { changes },
  })
}

export async function logUserDeleted(adminId: string, deletedUserId: string, userEmail: string) {
  return createAuditLog({
    userId: adminId,
    action: 'DELETE',
    entityType: 'User',
    entityId: deletedUserId,
    details: { email: userEmail },
  })
}

export async function logSettingsChanged(adminId: string, changes: Prisma.InputJsonValue) {
  return createAuditLog({
    userId: adminId,
    action: 'SETTINGS_CHANGE',
    entityType: 'SystemSettings',
    details: { changes },
  })
}

export async function logDataCleared(adminId: string, clearType: string, counts: Record<string, number>) {
  return createAuditLog({
    userId: adminId,
    action: 'CLEAR_DATA',
    entityType: 'System',
    details: { clearType, deleted: counts },
  })
}

export async function logDataExport(userId: string, exportType: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId,
    action: 'EXPORT',
    entityType: exportType,
    details,
  })
}

export async function logBulkImport(adminId: string, entityType: string, count: number, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId: adminId,
    action: 'IMPORT',
    entityType,
    details: { count, ...(typeof details === 'object' && details !== null && !Array.isArray(details) ? details : {}) },
  })
}

export async function logLogin(userId: string, ipAddress?: string, userAgent?: string) {
  return createAuditLog({
    userId,
    action: 'LOGIN',
    entityType: 'Session',
    ipAddress,
    userAgent,
  })
}

// Meeting audit helpers
export async function logMeetingCreated(userId: string, meetingId: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId,
    action: 'CREATE',
    entityType: 'Meeting',
    entityId: meetingId,
    details,
  })
}

export async function logMeetingUpdated(userId: string, meetingId: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId,
    action: 'UPDATE',
    entityType: 'Meeting',
    entityId: meetingId,
    details,
  })
}

export async function logMeetingDeleted(userId: string, meetingId: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId,
    action: 'DELETE',
    entityType: 'Meeting',
    entityId: meetingId,
    details,
  })
}

// Todo audit helpers
export async function logTodoCreated(userId: string, todoId: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId,
    action: 'CREATE',
    entityType: 'Todo',
    entityId: todoId,
    details,
  })
}

export async function logTodoUpdated(userId: string, todoId: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId,
    action: 'UPDATE',
    entityType: 'Todo',
    entityId: todoId,
    details,
  })
}

export async function logTodoDeleted(userId: string, todoId: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId,
    action: 'DELETE',
    entityType: 'Todo',
    entityId: todoId,
    details,
  })
}

// Department audit helpers
export async function logDepartmentCreated(userId: string, deptId: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId,
    action: 'CREATE',
    entityType: 'Department',
    entityId: deptId,
    details,
  })
}

export async function logDepartmentUpdated(userId: string, deptId: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId,
    action: 'UPDATE',
    entityType: 'Department',
    entityId: deptId,
    details,
  })
}

export async function logDepartmentDeleted(userId: string, deptId: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId,
    action: 'DELETE',
    entityType: 'Department',
    entityId: deptId,
    details,
  })
}

// Recording audit helpers
export async function logRecordingProcessed(userId: string, meetingId: string, details?: Prisma.InputJsonValue) {
  return createAuditLog({
    userId,
    action: 'UPDATE',
    entityType: 'Recording',
    entityId: meetingId,
    details,
  })
}
