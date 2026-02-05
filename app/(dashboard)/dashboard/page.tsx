import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { formatMeetingDateShort } from '@/lib/utils'
import Link from 'next/link'
import { Calendar, CheckSquare, Users, TrendingUp, Clock, AlertCircle, ChevronRight } from 'lucide-react'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) return null

  let stats = {
    upcomingMeetings: 0,
    pendingTodos: 0,
    overdueTodos: 0,
    directReports: 0,
    completedMeetings: 0,
  }

  const now = new Date()

  if (user.role === UserRole.EMPLOYEE) {
    const [meetings, todos, completedMeetings] = await Promise.all([
      prisma.meeting.count({
        where: {
          employeeId: user.id,
          status: 'SCHEDULED',
          meetingDate: { gte: now },
        },
      }),
      prisma.todo.findMany({
        where: {
          assignedToId: user.id,
          status: { not: 'DONE' },
        },
      }),
      prisma.meeting.count({
        where: {
          employeeId: user.id,
          status: 'COMPLETED',
        },
      }),
    ])
    stats.upcomingMeetings = meetings
    stats.pendingTodos = todos.length
    stats.overdueTodos = todos.filter(t => t.dueDate && new Date(t.dueDate) < now).length
    stats.completedMeetings = completedMeetings
  } else {
    const directReports = user.role === UserRole.SUPER_ADMIN
      ? await prisma.user.count({ where: { isActive: true } })
      : await prisma.user.count({ where: { reportsToId: user.id, isActive: true } })

    const [meetings, todos, completedMeetings] = await Promise.all([
      prisma.meeting.count({
        where: {
          OR: [
            { employeeId: user.id, status: 'SCHEDULED', meetingDate: { gte: now } },
            user.role === UserRole.SUPER_ADMIN
              ? { status: 'SCHEDULED', meetingDate: { gte: now } }
              : { reporterId: user.id, status: 'SCHEDULED', meetingDate: { gte: now } },
          ],
        },
      }),
      prisma.todo.findMany({
        where: {
          assignedToId: user.id,
          status: { not: 'DONE' },
        },
      }),
      prisma.meeting.count({
        where: user.role === UserRole.SUPER_ADMIN
          ? { status: 'COMPLETED' }
          : { reporterId: user.id, status: 'COMPLETED' },
      }),
    ])
    stats.upcomingMeetings = meetings
    stats.pendingTodos = todos.length
    stats.overdueTodos = todos.filter(t => t.dueDate && new Date(t.dueDate) < now).length
    stats.directReports = directReports
    stats.completedMeetings = completedMeetings
  }

  // Get recent meetings
  const recentMeetings = await prisma.meeting.findMany({
    where: user.role === UserRole.EMPLOYEE
      ? { employeeId: user.id }
      : user.role === UserRole.REPORTER
        ? { OR: [{ employeeId: user.id }, { reporterId: user.id }] }
        : {},
    include: {
      employee: { select: { name: true } },
      reporter: { select: { name: true } },
    },
    orderBy: { meetingDate: 'desc' },
    take: 5,
  })

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-2">
          {greeting()}, {user.name?.split(' ')[0]}
        </h1>
        <p className="text-medium-gray">Here&apos;s what&apos;s happening with your one-on-ones</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/meetings">
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5 hover:border-blue-500/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-gray dark:text-white">{stats.upcomingMeetings}</p>
                <p className="text-sm text-medium-gray">Upcoming</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/todos">
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <CheckSquare className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-gray dark:text-white">{stats.pendingTodos}</p>
                <p className="text-sm text-medium-gray">Pending Tasks</p>
              </div>
            </div>
          </div>
        </Link>

        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-gray dark:text-white">{stats.completedMeetings}</p>
              <p className="text-sm text-medium-gray">Completed</p>
            </div>
          </div>
        </div>

        {(user.role === UserRole.REPORTER || user.role === UserRole.SUPER_ADMIN) && (
          <Link href="/employees">
            <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5 hover:border-medium-gray/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-off-white dark:bg-dark-gray flex items-center justify-center">
                  <Users className="w-6 h-6 text-dark-gray dark:text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dark-gray dark:text-white">{stats.directReports}</p>
                  <p className="text-sm text-medium-gray">Team Members</p>
                </div>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Recent Meetings & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Meetings */}
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center justify-between">
            <h2 className="font-semibold text-dark-gray dark:text-white">Recent Meetings</h2>
            <Link href="/meetings" className="text-sm text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors">
              View all
            </Link>
          </div>
          {recentMeetings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Calendar className="w-12 h-12 text-light-gray mx-auto mb-3" />
              <p className="font-medium text-dark-gray dark:text-white mb-1">No meetings yet</p>
              <p className="text-sm text-medium-gray">
                {(user.role === UserRole.REPORTER || user.role === UserRole.SUPER_ADMIN)
                  ? 'Schedule your first one-on-one meeting.'
                  : 'Your manager will schedule meetings with you.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-off-white dark:divide-medium-gray/20">
              {recentMeetings.map((meeting) => (
                <Link 
                  key={meeting.id} 
                  href={`/meetings/${meeting.id}`} 
                  className="flex items-center gap-4 px-6 py-4 hover:bg-off-white/50 dark:hover:bg-charcoal/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-dark-gray dark:text-white truncate">
                      {user.role === UserRole.EMPLOYEE ? meeting.reporter.name : meeting.employee.name}
                    </p>
                    <p className="text-sm text-medium-gray">
                      {formatMeetingDateShort(meeting.meetingDate)}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    meeting.status === 'COMPLETED' 
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  }`}>
                    {meeting.status === 'COMPLETED' ? 'Completed' : 'Scheduled'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20">
            <h2 className="font-semibold text-dark-gray dark:text-white">Quick Actions</h2>
          </div>
          <div className="p-4 space-y-2">
            {(user.role === UserRole.REPORTER || user.role === UserRole.SUPER_ADMIN) && (
              <Link 
                href="/meetings/new" 
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-off-white/50 dark:hover:bg-charcoal/50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-dark-gray dark:text-white">Schedule Meeting</p>
                  <p className="text-sm text-medium-gray">Set up a new one-on-one</p>
                </div>
                <ChevronRight className="w-5 h-5 text-light-gray group-hover:text-medium-gray transition-colors" />
              </Link>
            )}

            <Link 
              href="/todos" 
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-off-white/50 dark:hover:bg-charcoal/50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-dark-gray dark:text-white">View Tasks</p>
                <p className="text-sm text-medium-gray">Check your pending to-dos</p>
              </div>
              <ChevronRight className="w-5 h-5 text-light-gray group-hover:text-medium-gray transition-colors" />
            </Link>

            {(user.role === UserRole.REPORTER || user.role === UserRole.SUPER_ADMIN) && (
              <Link 
                href="/reports" 
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-off-white/50 dark:hover:bg-charcoal/50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-off-white dark:bg-dark-gray flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-dark-gray dark:text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-dark-gray dark:text-white">View Reports</p>
                  <p className="text-sm text-medium-gray">Team insights and analytics</p>
                </div>
                <ChevronRight className="w-5 h-5 text-light-gray group-hover:text-medium-gray transition-colors" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
