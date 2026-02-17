'use client'

import Link from 'next/link'
import { Calendar, Clock } from 'lucide-react'

interface WeekMeeting {
  id: string
  meetingDate: string
  status: string
  employee?: { name: string | null }
  reporter?: { name: string | null }
}

interface WeekCalendarProps {
  meetings: WeekMeeting[]
  weekStart: string
  userRole: string
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDays(weekStartStr: string): Date[] {
  const start = new Date(weekStartStr)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const statusBadge: Record<string, { label: string; classes: string }> = {
  PROPOSED: { label: 'Proposed', classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  SCHEDULED: { label: 'Scheduled', classes: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  COMPLETED: { label: 'Completed', classes: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  CANCELLED: { label: 'Cancelled', classes: 'bg-red-500/10 text-red-600 dark:text-red-400' },
}

export function WeekCalendar({ meetings, weekStart, userRole }: WeekCalendarProps) {
  const days = getWeekDays(weekStart)
  const today = new Date()

  return (
    <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center justify-between">
        <h2 className="font-semibold text-dark-gray dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          This Week
        </h2>
        <Link href="/meetings" className="text-sm text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors">
          View all
        </Link>
      </div>

      {/* Desktop: 7-column grid */}
      <div className="hidden sm:grid sm:grid-cols-7 divide-x divide-off-white dark:divide-medium-gray/20 min-h-[140px]">
        {days.map((day, idx) => {
          const isToday = isSameDay(day, today)
          const dayMeetings = meetings
            .filter((m) => isSameDay(new Date(m.meetingDate), day))
            .sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime())

          return (
            <div
              key={idx}
              className={`flex flex-col ${isToday ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''}`}
            >
              <div className={`px-2 py-2 text-center border-b border-off-white dark:border-medium-gray/20 ${isToday ? 'bg-blue-500/10' : ''}`}>
                <p className="text-xs font-medium text-medium-gray">{dayLabels[idx]}</p>
                <p className={`text-sm font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-dark-gray dark:text-white'}`}>
                  {day.getDate()}
                </p>
              </div>
              <div className="flex-1 p-1.5 space-y-1">
                {dayMeetings.length === 0 && (
                  <p className="text-[10px] text-light-gray text-center pt-2">—</p>
                )}
                {dayMeetings.map((m) => {
                  const time = new Date(m.meetingDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                  const name = userRole === 'EMPLOYEE' ? m.reporter?.name : m.employee?.name
                  const badge = statusBadge[m.status] ?? statusBadge.SCHEDULED

                  return (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className="block px-1.5 py-1.5 rounded-lg hover:bg-off-white/70 dark:hover:bg-dark-gray/50 transition-colors group"
                    >
                      <p className="text-[11px] font-medium text-dark-gray dark:text-white truncate group-hover:underline">
                        {name || 'Meeting'}
                      </p>
                      <p className="text-[10px] text-medium-gray">{time}</p>
                      <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile: stacked list */}
      <div className="sm:hidden divide-y divide-off-white dark:divide-medium-gray/20">
        {days.map((day, idx) => {
          const isToday = isSameDay(day, today)
          const dayMeetings = meetings
            .filter((m) => isSameDay(new Date(m.meetingDate), day))
            .sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime())

          if (dayMeetings.length === 0 && !isToday) return null

          return (
            <div key={idx} className={`px-4 py-3 ${isToday ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <p className={`text-xs font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-dark-gray dark:text-white'}`}>
                  {dayLabels[idx]} {day.getDate()}
                </p>
                {isToday && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">Today</span>
                )}
              </div>
              {dayMeetings.length === 0 ? (
                <p className="text-xs text-light-gray">No meetings</p>
              ) : (
                <div className="space-y-2">
                  {dayMeetings.map((m) => {
                    const time = new Date(m.meetingDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    const name = userRole === 'EMPLOYEE' ? m.reporter?.name : m.employee?.name
                    const badge = statusBadge[m.status] ?? statusBadge.SCHEDULED

                    return (
                      <Link
                        key={m.id}
                        href={`/meetings/${m.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-off-white/70 dark:hover:bg-dark-gray/50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-dark-gray dark:text-white truncate">{name || 'Meeting'}</p>
                          <p className="text-xs text-medium-gray">{time}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
