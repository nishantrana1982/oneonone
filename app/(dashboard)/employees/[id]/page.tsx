import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { canAccessEmployeeData } from '@/lib/auth-helpers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { User, Building2, Users, Calendar, CheckSquare, ArrowLeft, Mail } from 'lucide-react'
import { QuarterlySummary } from './quarterly-summary'

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getCurrentUser()
  if (!user) return notFound()

  const employee = await prisma.user.findUnique({
    where: { id: params.id },
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
  })

  if (!employee) return notFound()

  const canAccess = canAccessEmployeeData(
    user.role,
    user.id,
    employee.id,
    employee.reportsToId
  )

  if (!canAccess) return notFound()

  const meetings = await prisma.meeting.findMany({
    where: { employeeId: employee.id },
    include: {
      reporter: { select: { name: true } },
    },
    orderBy: { meetingDate: 'desc' },
    take: 10,
  })

  const todos = await prisma.todo.findMany({
    where: { assignedToId: employee.id },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    take: 10,
  })

  const completedTodos = todos.filter(t => t.status === 'DONE').length
  const completedMeetings = meetings.filter(m => m.status === 'COMPLETED').length

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Back Button */}
      <Link
        href="/employees"
        className="inline-flex items-center gap-2 text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to employees
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange/20 to-orange/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-orange">
              {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-1">
              {employee.name}
            </h1>
            <p className="text-medium-gray flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {employee.email}
            </p>
          </div>
        </div>
        <QuarterlySummary userId={employee.id} userName={employee.name} />
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-off-white dark:bg-dark-gray flex items-center justify-center">
              <Building2 className="w-5 h-5 text-dark-gray dark:text-white" />
            </div>
            <div>
              <p className="text-sm text-medium-gray">Department</p>
              <p className="font-medium text-dark-gray dark:text-white">
                {employee.department?.name || 'Not assigned'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-medium-gray">Reports To</p>
              <p className="font-medium text-dark-gray dark:text-white">
                {employee.reportsTo?.name || 'No manager'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-medium-gray">Meetings</p>
              <p className="font-medium text-dark-gray dark:text-white">
                {completedMeetings}/{employee._count.meetingsAsEmployee}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange/10 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-orange" />
            </div>
            <div>
              <p className="text-sm text-medium-gray">Tasks Done</p>
              <p className="font-medium text-dark-gray dark:text-white">
                {completedTodos}/{employee._count.todosAssigned}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Meetings */}
      <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20">
          <h2 className="font-semibold text-dark-gray dark:text-white">Recent Meetings</h2>
        </div>
        {meetings.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-12 h-12 text-light-gray mx-auto mb-3" />
            <p className="text-medium-gray">No meetings yet</p>
          </div>
        ) : (
          <div className="divide-y divide-off-white dark:divide-medium-gray/20">
            {meetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/meetings/${meeting.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-off-white dark:hover:bg-charcoal transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  meeting.status === 'COMPLETED' ? 'bg-green-500/10' : 'bg-blue-500/10'
                }`}>
                  <Calendar className={`w-5 h-5 ${
                    meeting.status === 'COMPLETED' ? 'text-green-500' : 'text-blue-500'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-dark-gray dark:text-white">
                    Meeting with {meeting.reporter.name}
                  </p>
                  <p className="text-sm text-medium-gray">
                    {new Date(meeting.meetingDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  meeting.status === 'COMPLETED'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                }`}>
                  {meeting.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent To-Dos */}
      <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20">
          <h2 className="font-semibold text-dark-gray dark:text-white">Recent Tasks</h2>
        </div>
        {todos.length === 0 ? (
          <div className="p-8 text-center">
            <CheckSquare className="w-12 h-12 text-light-gray mx-auto mb-3" />
            <p className="text-medium-gray">No tasks yet</p>
          </div>
        ) : (
          <div className="divide-y divide-off-white dark:divide-medium-gray/20">
            {todos.map((todo) => (
              <div key={todo.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      todo.status === 'DONE' ? 'bg-green-500/10' : 
                      todo.status === 'IN_PROGRESS' ? 'bg-blue-500/10' : 'bg-gray-500/10'
                    }`}>
                      <CheckSquare className={`w-4 h-4 ${
                        todo.status === 'DONE' ? 'text-green-500' : 
                        todo.status === 'IN_PROGRESS' ? 'text-blue-500' : 'text-gray-500'
                      }`} />
                    </div>
                    <div>
                      <p className={`font-medium ${
                        todo.status === 'DONE' 
                          ? 'text-medium-gray line-through' 
                          : 'text-dark-gray dark:text-white'
                      }`}>
                        {todo.title}
                      </p>
                      {todo.dueDate && (
                        <p className="text-xs text-medium-gray">
                          Due: {new Date(todo.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      todo.priority === 'HIGH' ? 'bg-red-500/10 text-red-500' :
                      todo.priority === 'MEDIUM' ? 'bg-orange/10 text-orange' :
                      'bg-gray-500/10 text-gray-500'
                    }`}>
                      {todo.priority}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      todo.status === 'DONE' ? 'bg-green-500/10 text-green-600' :
                      todo.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-600' :
                      'bg-gray-500/10 text-gray-600'
                    }`}>
                      {todo.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
