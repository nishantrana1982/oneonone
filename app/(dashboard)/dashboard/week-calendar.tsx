'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Calendar, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface WeekMeeting {
  id: string
  meetingDate: string
  status: string
  employee?: { name: string | null }
  reporter?: { name: string | null }
}

interface WeekCalendarProps {
  initialMeetings: WeekMeeting[]
  initialWeekStart: string
  userRole: string
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isSameWeek(a: Date, b: Date) {
  const mondayA = getMonday(a)
  const mondayB = getMonday(b)
  return isSameDay(mondayA, mondayB)
}

function weekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const startMonth = monthNames[weekStart.getMonth()]
  const endMonth = monthNames[weekEnd.getMonth()]
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${startMonth} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
  }
  if (weekStart.getFullYear() === weekEnd.getFullYear()) {
    return `${startMonth} ${weekStart.getDate()} – ${endMonth} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
  }
  return `${startMonth} ${weekStart.getDate()}, ${weekStart.getFullYear()} – ${endMonth} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
}

const statusBadge: Record<string, { label: string; classes: string }> = {
  PROPOSED: { label: 'Proposed', classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  SCHEDULED: { label: 'Scheduled', classes: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  COMPLETED: { label: 'Completed', classes: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  CANCELLED: { label: 'Cancelled', classes: 'bg-red-500/10 text-red-600 dark:text-red-400' },
}

export function WeekCalendar({ initialMeetings, initialWeekStart, userRole }: WeekCalendarProps) {
  const todayMonday = getMonday(new Date())
  const [weekStart, setWeekStart] = useState<Date>(new Date(initialWeekStart))
  const [meetings, setMeetings] = useState<WeekMeeting[]>(initialMeetings)
  const [loading, setLoading] = useState(false)

  const isCurrentWeek = isSameWeek(weekStart, todayMonday)
  const days = getWeekDays(weekStart)
  const today = new Date()

  const fetchWeek = useCallback(async (start: Date) => {
    setLoading(true)
    try {
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      const res = await fetch(`/api/meetings?start=${start.toISOString()}&end=${end.toISOString()}`)
      if (res.ok) {
        const data = await res.json()
        setMeetings(
          (data as WeekMeeting[]).filter((m) => m.status !== 'CANCELLED')
        )
      }
    } catch {
      // keep old meetings on error
    } finally {
      setLoading(false)
    }
  }, [])

  const goToPreviousWeek = () => {
    const prev = new Date(weekStart)
    prev.setDate(prev.getDate() - 7)
    setWeekStart(prev)
  }

  const goToNextWeek = () => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + 7)
    setWeekStart(next)
  }

  const goToToday = () => {
    setWeekStart(todayMonday)
  }

  // Fetch meetings when week changes (skip initial load since we have server data)
  useEffect(() => {
    if (!isSameWeek(weekStart, new Date(initialWeekStart))) {
      fetchWeek(weekStart)
    } else {
      setMeetings(initialMeetings)
    }
  }, [weekStart, initialWeekStart, initialMeetings, fetchWeek])

  return (
    <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
      {/* Header with navigation */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Calendar className="w-5 h-5 text-dark-gray dark:text-white flex-shrink-0" />
          <h2 className="font-semibold text-dark-gray dark:text-white text-sm sm:text-base truncate">
            {weekLabel(weekStart)}
          </h2>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-medium-gray flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isCurrentWeek && (
            <button
              onClick={goToToday}
              className="px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors min-h-[36px]"
            >
              Today
            </button>
          )}
          <button
            onClick={goToPreviousWeek}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-off-white dark:hover:bg-dark-gray transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5 text-medium-gray" />
          </button>
          <button
            onClick={goToNextWeek}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-off-white dark:hover:bg-dark-gray transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5 text-medium-gray" />
          </button>
        </div>
      </div>

      {/* Desktop: 7-column grid (scroll horizontally on narrow viewports) */}
      <div className="hidden sm:block overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[56rem] w-full divide-x divide-off-white dark:divide-medium-gray/20 min-h-[140px]">
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
        {days.every((day) => {
          const dayMeetings = meetings.filter((m) => isSameDay(new Date(m.meetingDate), day))
          return dayMeetings.length === 0 && !isSameDay(day, today)
        }) && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-medium-gray">No meetings this week</p>
          </div>
        )}
      </div>
    </div>
  )
}
