import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'

// Custom error classes for API routes
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user || null
}

// For page routes - redirects on failure
export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/auth/signin')
  }
  return user
}

// For page routes - redirects on failure
export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Not authenticated')
  }
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError('Insufficient permissions')
  }
  return user
}

// For page routes - redirects on failure
export async function requireAdmin() {
  return requireRole([UserRole.SUPER_ADMIN])
}

export function canAccessEmployeeData(
  currentUserRole: UserRole,
  currentUserId: string,
  employeeId: string,
  employeeReportsToId?: string | null
): boolean {
  // Super admin can access all
  if (currentUserRole === UserRole.SUPER_ADMIN) {
    return true
  }

  // Users can access their own data
  if (currentUserId === employeeId) {
    return true
  }

  // Reporters can access their direct reports' data
  if (currentUserRole === UserRole.REPORTER && employeeReportsToId === currentUserId) {
    return true
  }

  return false
}
