/**
 * Keka HR API integration for leave and public holidays.
 * Used to skip unavailable days (employee leave, US/India office holidays) when finding next available slot.
 *
 * Env: KEKA_COMPANY, KEKA_ENVIRONMENT (optional, default keka), KEKA_CLIENT_ID, KEKA_CLIENT_SECRET, KEKA_API_KEY,
 *      KEKA_HOLIDAY_CALENDAR_ID_US (optional), KEKA_HOLIDAY_CALENDAR_ID_IN (optional)
 */

import { toZonedTime } from 'date-fns-tz'
import { prisma } from './prisma'

const KEKA_ENV = process.env.KEKA_ENVIRONMENT || 'keka'
const KEKA_COMPANY = process.env.KEKA_COMPANY
const KEKA_CLIENT_ID = process.env.KEKA_CLIENT_ID
const KEKA_CLIENT_SECRET = process.env.KEKA_CLIENT_SECRET
const KEKA_API_KEY = process.env.KEKA_API_KEY
const KEKA_HOLIDAY_CALENDAR_US = process.env.KEKA_HOLIDAY_CALENDAR_ID_US
const KEKA_HOLIDAY_CALENDAR_IN = process.env.KEKA_HOLIDAY_CALENDAR_ID_IN

const TOKEN_URL =
  KEKA_ENV === 'kekademo'
    ? 'https://login.kekademo.com/connect/token'
    : 'https://login.keka.com/connect/token'

function getBaseUrl(): string {
  if (!KEKA_COMPANY) return ''
  const env = KEKA_ENV === 'kekademo' ? 'kekademo' : 'keka'
  return `https://${KEKA_COMPANY}.${env}.com/api/v1`
}

let cachedToken: { access_token: string; expires_at: number } | null = null

/** Get OAuth token for Keka API (grant_type=kekaapi). */
export async function getKekaAccessToken(): Promise<string | null> {
  if (!KEKA_CLIENT_ID || !KEKA_CLIENT_SECRET || !KEKA_API_KEY) return null

  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) {
    return cachedToken.access_token
  }

  const body = new URLSearchParams({
    grant_type: 'kekaapi',
    scope: 'kekaapi',
    client_id: KEKA_CLIENT_ID,
    client_secret: KEKA_CLIENT_SECRET,
    api_key: KEKA_API_KEY,
  })

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) {
      console.error('Keka token error', res.status, await res.text())
      return null
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    const token = data.access_token
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600
    if (token) {
      cachedToken = { access_token: token, expires_at: Date.now() + expiresIn * 1000 }
      return token
    }
  } catch (e) {
    console.error('Keka token request failed', e)
  }
  return null
}

export function isKekaConfigured(): boolean {
  return !!(KEKA_COMPANY && KEKA_CLIENT_ID && KEKA_CLIENT_SECRET && KEKA_API_KEY)
}

/** Holiday from Keka API. */
export interface KekaHoliday {
  id: string
  name: string | null
  date: string
  isFloater: boolean
}

/** Fetch holidays for a calendar for a given year. */
export async function getKekaHolidays(
  calendarId: string,
  calendarYear: number
): Promise<KekaHoliday[]> {
  const token = await getKekaAccessToken()
  const base = getBaseUrl()
  if (!token || !base) return []

  const url = `${base}/time/holidayscalendar/${calendarId}/holidays?calendarYear=${calendarYear}&pageSize=200`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: KekaHoliday[] }
    return Array.isArray(json.data) ? json.data : []
  } catch {
    return []
  }
}

/** Leave request from Keka API. Status: 1 = Approved (commonly). */
export interface KekaLeaveRequest {
  id: string | null
  employeeIdentifier: string | null
  fromDate: string
  toDate: string
  status: number
}

/** Fetch leave requests for given employee IDs in date range (max 90 days). */
export async function getKekaLeaveRequests(
  employeeIds: string[],
  from: Date,
  to: Date
): Promise<KekaLeaveRequest[]> {
  if (employeeIds.length === 0) return []
  const token = await getKekaAccessToken()
  const base = getBaseUrl()
  if (!token || !base) return []

  const fromStr = from.toISOString()
  const toStr = to.toISOString()
  const ids = employeeIds.join(',')
  const url = `${base}/time/leaverequests?employeeIds=${encodeURIComponent(ids)}&from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&pageSize=200`
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: KekaLeaveRequest[] }
    const list = Array.isArray(json.data) ? json.data : []
    return list.filter((l) => l.status === 1)
  } catch {
    return []
  }
}

const HOLIDAY_CACHE = new Map<string, Set<string>>()
const CACHE_TTL_MS = 10 * 60 * 1000
let holidayCacheExpiry = 0

function holidayCacheKey(calendarId: string, year: number): string {
  return `${calendarId}:${year}`
}

function getHolidayDatesForCalendar(calendarId: string, year: number): Set<string> {
  const key = holidayCacheKey(calendarId, year)
  if (Date.now() < holidayCacheExpiry && HOLIDAY_CACHE.has(key)) {
    return HOLIDAY_CACHE.get(key)!
  }
  return new Set<string>()
}

function setHolidayDatesForCalendar(calendarId: string, year: number, dates: Set<string>): void {
  HOLIDAY_CACHE.set(holidayCacheKey(calendarId, year), dates)
  if (holidayCacheExpiry === 0) holidayCacheExpiry = Date.now() + CACHE_TTL_MS
}

const COUNTRY_TZ: Record<string, string> = {
  US: 'America/New_York',
  IN: 'Asia/Kolkata',
}

/** Check if a calendar date (in the country's timezone) is a holiday for the given country. */
async function isHolidayForCountry(date: Date, country: string | null): Promise<boolean> {
  const calendarId =
    country === 'US' ? KEKA_HOLIDAY_CALENDAR_US : country === 'IN' ? KEKA_HOLIDAY_CALENDAR_IN : null
  if (!calendarId) return false

  const tz = country ? COUNTRY_TZ[country] ?? 'UTC' : 'UTC'
  const zoned = toZonedTime(date, tz)
  const year = zoned.getFullYear()

  let set = getHolidayDatesForCalendar(calendarId, year)
  if (set.size === 0) {
    const holidays = await getKekaHolidays(calendarId, year)
    const dateStrings = new Set(holidays.map((h) => h.date.slice(0, 10)))
    setHolidayDatesForCalendar(calendarId, year, dateStrings)
    set = dateStrings
  }
  const y = zoned.getFullYear()
  const m = String(zoned.getMonth() + 1).padStart(2, '0')
  const d = String(zoned.getDate()).padStart(2, '0')
  const dateStr = `${y}-${m}-${d}`
  return set.has(dateStr)
}

/** Check if the user has approved leave that overlaps the given date (any part of the day). */
async function isOnLeave(userId: string, date: Date): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kekaEmployeeId: true },
  })
  if (!user?.kekaEmployeeId) return false

  const dayStart = new Date(date)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  const leaves = await getKekaLeaveRequests([user.kekaEmployeeId], dayStart, dayEnd)
  for (const leave of leaves) {
    const from = new Date(leave.fromDate).getTime()
    const to = new Date(leave.toDate).getTime()
    if (from < dayEnd.getTime() && to > dayStart.getTime()) return true
  }
  return false
}

/**
 * Returns true if the given date should be treated as unavailable for this user:
 * - Public holiday for the user's office (US/IN from user.country), or
 * - Approved leave in Keka for this user (when kekaEmployeeId is set).
 */
export async function isDateUnavailableForUser(userId: string, date: Date): Promise<boolean> {
  if (!isKekaConfigured()) return false

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true, kekaEmployeeId: true },
  })
  if (!user) return false

  const [holiday, leave] = await Promise.all([
    isHolidayForCountry(date, user.country),
    isOnLeave(userId, date),
  ])
  return holiday || leave
}

/**
 * For availability: treat a date as free only if neither reporter nor employee
 * has that day as holiday or leave.
 */
export async function isDateUnavailableForEitherUser(
  reporterId: string,
  employeeId: string,
  date: Date
): Promise<boolean> {
  if (!isKekaConfigured()) return false
  const [repUnavail, empUnavail] = await Promise.all([
    isDateUnavailableForUser(reporterId, date),
    isDateUnavailableForUser(employeeId, date),
  ])
  return repUnavail || empUnavail
}
