import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { logBulkImport } from '@/lib/audit'

interface ImportUser {
  name: string
  email: string
  role?: string
  department?: string
  reportsTo?: string // email of manager
  title?: string
  phone?: string
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { users } = body as { users: ImportUser[] }

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'No users provided' }, { status: 400 })
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Get all departments for lookup
    const departments = await prisma.department.findMany()
    const departmentMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]))

    // Get all existing users for manager lookup
    const existingUsers = await prisma.user.findMany({
      select: { id: true, email: true },
    })
    const userMap = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u.id]))

    // Process users in order (managers should be imported before their reports)
    for (const userData of users) {
      try {
        // Validate required fields
        if (!userData.name || !userData.email) {
          results.failed++
          results.errors.push(`Missing name or email for user: ${JSON.stringify(userData)}`)
          continue
        }

        // Check for existing user
        if (userMap.has(userData.email.toLowerCase())) {
          results.failed++
          results.errors.push(`User already exists: ${userData.email}`)
          continue
        }

        // Parse role
        let role: UserRole = 'EMPLOYEE'
        if (userData.role) {
          const roleUpper = userData.role.toUpperCase()
          if (roleUpper === 'REPORTER' || roleUpper === 'TEAM_LEAD' || roleUpper === 'MANAGER') {
            role = 'REPORTER'
          } else if (roleUpper === 'SUPER_ADMIN' || roleUpper === 'ADMIN') {
            role = 'SUPER_ADMIN'
          }
        }

        // Find department
        let departmentId: string | null = null
        if (userData.department) {
          departmentId = departmentMap.get(userData.department.toLowerCase()) || null
          
          // Create department if it doesn't exist
          if (!departmentId) {
            const newDept = await prisma.department.create({
              data: { name: userData.department },
            })
            departmentId = newDept.id
            departmentMap.set(userData.department.toLowerCase(), newDept.id)
          }
        }

        // Find manager
        let reportsToId: string | null = null
        if (userData.reportsTo) {
          reportsToId = userMap.get(userData.reportsTo.toLowerCase()) || null
        }

        // Create user
        const newUser = await prisma.user.create({
          data: {
            name: userData.name.trim(),
            email: userData.email.toLowerCase().trim(),
            role,
            departmentId,
            reportsToId,
            title: userData.title?.trim() || null,
            phone: userData.phone?.trim() || null,
          },
        })

        // Add to map for subsequent lookups
        userMap.set(userData.email.toLowerCase(), newUser.id)
        results.success++
      } catch (error: unknown) {
        results.failed++
        results.errors.push(`Failed to import ${userData.email}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Log the import
    await logBulkImport(user.id, 'User', results.success, {
      failed: results.failed,
      errors: results.errors.slice(0, 10), // Keep first 10 errors
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error importing users:', error)
    return NextResponse.json({ error: 'Failed to import users' }, { status: 500 })
  }
}
