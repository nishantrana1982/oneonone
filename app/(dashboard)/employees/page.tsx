import { requireRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import Link from 'next/link'
import { Users, Calendar, Mic, ChevronRight, Building2, CheckCircle2, XCircle } from 'lucide-react'

export default async function EmployeesPage() {
  const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

  // Reporters see their direct reports; Super Admin sees ALL users (employees + reporters)
  const whereClause =
    user.role === UserRole.REPORTER
      ? { reportsToId: user.id, isActive: true }
      : { isActive: true, role: { in: [UserRole.EMPLOYEE, UserRole.REPORTER] as UserRole[] } }

  const people = await prisma.user.findMany({
    where: whereClause,
    include: {
      department: true,
      reportsTo: { select: { name: true } },
      meetingsAsEmployee: {
        select: {
          id: true,
          status: true,
          meetingDate: true,
          checkInPersonal: true,
          recording: { select: { id: true, status: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const now = new Date()

  // Compute stats per person
  const peopleWithStats = people.map((p) => {
    const totalMeetings = p.meetingsAsEmployee.length
    const completed = p.meetingsAsEmployee.filter((m) => m.status === 'COMPLETED').length
    const missed = p.meetingsAsEmployee.filter(
      (m) =>
        new Date(m.meetingDate) < now &&
        m.status !== 'COMPLETED'
    ).length
    const recordings = p.meetingsAsEmployee.filter(
      (m) => m.recording && m.recording.status === 'COMPLETED'
    ).length

    return { ...p, totalMeetings, completed, missed, recordings }
  })

  const totalRecordings = peopleWithStats.reduce((s, p) => s + p.recordings, 0)
  const totalCompleted = peopleWithStats.reduce((s, p) => s + p.completed, 0)
  const totalMissed = peopleWithStats.reduce((s, p) => s + p.missed, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-dark-gray dark:text-white mb-1">
          Team Members
        </h1>
        <p className="text-sm sm:text-base text-medium-gray">
          {user.role === UserRole.SUPER_ADMIN
            ? 'All employees and reporters in the organization'
            : 'Your direct reports and their progress'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-dark-gray dark:text-white">{peopleWithStats.length}</p>
              <p className="text-xs sm:text-sm text-medium-gray">Members</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-dark-gray dark:text-white">{totalCompleted}</p>
              <p className="text-xs sm:text-sm text-medium-gray">Attended</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-dark-gray dark:text-white">{totalMissed}</p>
              <p className="text-xs sm:text-sm text-medium-gray">Missed</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-dark-gray dark:text-white">{totalRecordings}</p>
              <p className="text-xs sm:text-sm text-medium-gray">Recordings</p>
            </div>
          </div>
        </div>
      </div>

      {/* People List */}
      {peopleWithStats.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-12 text-center">
          <Users className="w-16 h-16 text-light-gray mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-dark-gray dark:text-white mb-2">No team members</h3>
          <p className="text-medium-gray">No direct reports assigned yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
          <div className="divide-y divide-off-white dark:divide-medium-gray/20">
            {peopleWithStats.map((person) => (
              <Link
                key={person.id}
                href={`/employees/${person.id}`}
                className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 hover:bg-off-white/50 dark:hover:bg-charcoal/50 active:bg-off-white dark:active:bg-charcoal active:scale-[0.98] transition-colors"
              >
                {/* Avatar */}
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-off-white dark:bg-dark-gray flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {person.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                </div>

                {/* Name + Role */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-dark-gray dark:text-white text-sm sm:text-base truncate">
                      {person.name}
                    </p>
                    {person.role === UserRole.REPORTER && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full flex-shrink-0">
                        Reporter
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-medium-gray truncate">
                    {person.department?.name || 'No department'}
                    {person.reportsTo && ` · ${person.reportsTo.name}`}
                  </p>
                </div>

                {/* Stats badges */}
                <div className="hidden sm:flex items-center gap-3 text-xs text-medium-gray flex-shrink-0">
                  <div className="flex items-center gap-1" title="Attended">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <span>{person.completed}</span>
                  </div>
                  <div className="flex items-center gap-1" title="Missed">
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                    <span>{person.missed}</span>
                  </div>
                  <div className="flex items-center gap-1" title="Recordings">
                    <Mic className="w-3.5 h-3.5 text-purple-500" />
                    <span>{person.recordings}</span>
                  </div>
                </div>

                {/* Mobile compact stats */}
                <div className="flex sm:hidden items-center gap-2 text-xs text-medium-gray flex-shrink-0">
                  <span className="text-green-500 font-medium">{person.completed}</span>
                  <span>/</span>
                  <span className="text-red-500 font-medium">{person.missed}</span>
                  <Mic className="w-3 h-3 text-purple-500 ml-1" />
                  <span>{person.recordings}</span>
                </div>

                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-light-gray flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
