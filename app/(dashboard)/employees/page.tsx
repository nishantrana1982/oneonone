import { requireRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import Link from 'next/link'
import { Users, Calendar, CheckSquare, ChevronRight, Building2 } from 'lucide-react'

export default async function EmployeesPage() {
  const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

  let employees

  if (user.role === UserRole.REPORTER) {
    employees = await prisma.user.findMany({
      where: {
        reportsToId: user.id,
        isActive: true,
      },
      include: {
        department: true,
        _count: {
          select: {
            meetingsAsEmployee: true,
            todosAssigned: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  } else {
    employees = await prisma.user.findMany({
      where: {
        isActive: true,
        role: UserRole.EMPLOYEE,
      },
      include: {
        department: true,
        reportsTo: { select: { name: true, email: true } },
        _count: {
          select: {
            meetingsAsEmployee: true,
            todosAssigned: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-2">Employees</h1>
        <p className="text-medium-gray">View your direct reports and their progress</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-gray dark:text-white">{employees.length}</p>
              <p className="text-sm text-medium-gray">Team Members</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-gray dark:text-white">
                {employees.reduce((sum, e) => sum + e._count.meetingsAsEmployee, 0)}
              </p>
              <p className="text-sm text-medium-gray">Total Meetings</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <CheckSquare className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-gray dark:text-white">
                {employees.reduce((sum, e) => sum + e._count.todosAssigned, 0)}
              </p>
              <p className="text-sm text-medium-gray">Total Tasks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Employee List */}
      {employees.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-12 text-center">
          <Users className="w-16 h-16 text-light-gray mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-dark-gray dark:text-white mb-2">No team members</h3>
          <p className="text-medium-gray">
            You don&apos;t have any direct reports assigned yet.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
          <div className="divide-y divide-off-white dark:divide-medium-gray/20">
            {employees.map((employee) => (
              <Link
                key={employee.id}
                href={`/employees/${employee.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-off-white/50 dark:hover:bg-charcoal/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-off-white dark:bg-dark-gray flex items-center justify-center">
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {(employee.name || employee.email).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-dark-gray dark:text-white">{employee.name || employee.email}</p>
                  <p className="text-sm text-medium-gray">{employee.email}</p>
                </div>
                {employee.department && (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-off-white dark:bg-charcoal">
                    <Building2 className="w-3.5 h-3.5 text-medium-gray" />
                    <span className="text-xs text-medium-gray">{employee.department.name}</span>
                  </div>
                )}
                <div className="hidden md:flex items-center gap-4 text-sm text-medium-gray">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>{employee._count.meetingsAsEmployee}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4" />
                    <span>{employee._count.todosAssigned}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-light-gray" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
