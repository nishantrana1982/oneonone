import { google } from 'googleapis'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { prisma } from './prisma'
import { DEFAULT_WORK_END, DEFAULT_WORK_START } from './timezones'

// Create OAuth2 client
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + '/api/auth/callback/google'
  )
}

// Get authenticated OAuth2 client for a user
async function getAuthenticatedClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: 'google',
    },
  })

  if (!account || !account.access_token) {
    throw new Error('No Google account linked for this user')
  }

  const oauth2Client = createOAuth2Client()
  
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  })

  // Set up token refresh handler
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.account.updateMany({
        where: {
          userId,
          provider: 'google',
        },
        data: {
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
          ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
        },
      })
    }
  })

  return oauth2Client
}

export async function createCalendarEvent(
  meetingId: string,
  employeeEmail: string,
  reporterEmail: string,
  reporterId: string,
  meetingDate: Date,
  employeeName: string,
  reporterName: string
) {
  try {
    const oauth2Client = await getAuthenticatedClient(reporterId)
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const event = {
      summary: `One-on-One: ${employeeName} & ${reporterName}`,
      description: `AMI One-on-One Meeting\n\nView meeting details: ${process.env.NEXTAUTH_URL}/meetings/${meetingId}`,
      start: {
        dateTime: meetingDate.toISOString(),
        timeZone: 'Asia/Kolkata', // IST timezone
      },
      end: {
        dateTime: new Date(meetingDate.getTime() + 30 * 60 * 1000).toISOString(), // 30 minutes default
        timeZone: 'Asia/Kolkata',
      },
      attendees: [
        { email: employeeEmail },
        { email: reporterEmail },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 15 }, // 15 minutes before
        ],
      },
      conferenceData: {
        createRequest: {
          requestId: meetingId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all', // Send invites to all attendees
    })

    if (response.data.id && response.data.htmlLink) {
      // Store calendar event in database
      await prisma.calendarEvent.create({
        data: {
          meetingId,
          googleEventId: response.data.id,
          googleCalendarLink: response.data.htmlLink,
          scheduledAt: meetingDate,
        },
      })

      return {
        eventId: response.data.id,
        calendarLink: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink,
      }
    }

    throw new Error('Failed to create calendar event')
  } catch (error: unknown) {
    console.error('Error creating calendar event:', error)
    
    // Check if it's an auth error
    const errMsg = error instanceof Error ? error.message : ''
    const errCode = error && typeof error === 'object' && 'code' in error ? (error as { code: unknown }).code : undefined
    if (errMsg.includes('No Google account') || errCode === 401) {
      throw new Error('Calendar access not authorized. Please re-login to grant calendar permissions.')
    }
    
    throw error
  }
}

export async function updateCalendarEvent(
  googleEventId: string,
  userId: string,
  meetingDate: Date,
  employeeName: string,
  reporterName: string
) {
  try {
    const oauth2Client = await getAuthenticatedClient(userId)
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const event = {
      summary: `One-on-One: ${employeeName} & ${reporterName}`,
      start: {
        dateTime: meetingDate.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: new Date(meetingDate.getTime() + 30 * 60 * 1000).toISOString(),
        timeZone: 'Asia/Kolkata',
      },
    }

    await calendar.events.patch({
      calendarId: 'primary',
      eventId: googleEventId,
      requestBody: event,
      sendUpdates: 'all',
    })

    // Update database
    await prisma.calendarEvent.updateMany({
      where: { googleEventId },
      data: { scheduledAt: meetingDate },
    })
  } catch (error) {
    console.error('Error updating calendar event:', error)
    throw error
  }
}

export async function deleteCalendarEvent(googleEventId: string, userId: string) {
  try {
    const oauth2Client = await getAuthenticatedClient(userId)
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
      sendUpdates: 'all',
    })

    // Delete from database
    await prisma.calendarEvent.deleteMany({
      where: { googleEventId },
    })
  } catch (error) {
    console.error('Error deleting calendar event:', error)
    throw error
  }
}

// Check if calendar integration is available for a user
export async function isCalendarEnabled(userId: string): Promise<boolean> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: 'google',
      },
    })

    return !!(account?.access_token && account?.refresh_token)
  } catch (e) {
    console.error('Error checking calendar status:', e)
    return false
  }
}

// ── Availability / FreeBusy ─────────────────────────────────────────

interface BusyRange {
  start: string
  end: string
}

/**
 * Fetch free/busy data for a user's primary calendar over a time window.
 * Returns an array of busy ranges (ISO strings).
 */
export async function getFreeBusy(
  userId: string,
  timeMin: Date,
  timeMax: Date
): Promise<BusyRange[]> {
  const oauth2Client = await getAuthenticatedClient(userId)
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: 'Asia/Kolkata',
      items: [{ id: 'primary' }],
    },
  })

  const busy = response.data.calendars?.primary?.busy ?? []
  return busy
    .filter((b): b is { start: string; end: string } => !!b.start && !!b.end)
    .map((b) => ({ start: b.start!, end: b.end! }))
}

interface FreeSlot {
  start: string
  end: string
}

/**
 * Business-hours window (9 AM – 7 PM IST) when no user prefs are provided.
 */
const BUSINESS_START_HOUR = 9
const BUSINESS_END_HOUR = 19
const FALLBACK_TZ = 'Asia/Kolkata'

function parseHHmm(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(':').map(Number)
  return { hours: h ?? 0, minutes: m ?? 0 }
}

/**
 * Get the UTC range for a calendar date in a timezone with local work start/end (HH:mm).
 */
function getWorkWindowUtc(
  date: Date,
  timeZone: string,
  workStart: string,
  workEnd: string
): { start: Date; end: Date } {
  const zoned = toZonedTime(date, timeZone)
  const y = zoned.getFullYear()
  const mo = zoned.getMonth()
  const d = zoned.getDate()
  const start = parseHHmm(workStart)
  const end = parseHHmm(workEnd)
  const windowStart = fromZonedTime(
    new Date(y, mo, d, start.hours, start.minutes, 0, 0),
    timeZone
  )
  const windowEnd = fromZonedTime(
    new Date(y, mo, d, end.hours, end.minutes, 0, 0),
    timeZone
  )
  return { start: windowStart, end: windowEnd }
}

/**
 * Check if a UTC moment falls within a user's work hours on that day in their timezone.
 */
function isWithinWorkHours(utcDate: Date, timeZone: string, workStart: string, workEnd: string): boolean {
  const zoned = toZonedTime(utcDate, timeZone)
  const y = zoned.getFullYear()
  const mo = zoned.getMonth()
  const day = zoned.getDate()
  const h = zoned.getHours()
  const m = zoned.getMinutes()
  const start = parseHHmm(workStart)
  const end = parseHHmm(workEnd)
  const localMins = h * 60 + m
  const startMins = start.hours * 60 + start.minutes
  const endMins = end.hours * 60 + end.minutes
  return localMins >= startMins && localMins < endMins
}

export interface MutualFreeSlotsOptions {
  reporterTimeZone?: string | null
  reporterWorkStart?: string | null
  reporterWorkEnd?: string | null
  employeeTimeZone?: string | null
  employeeWorkStart?: string | null
  employeeWorkEnd?: string | null
}

/**
 * Given busy ranges from both users, compute mutually free slots of
 * `slotMinutes` duration. Uses reporter's date; when options are provided,
 * only slots where both users are within their working hours (in their TZ) are returned.
 */
export async function getMutualFreeSlots(
  reporterId: string,
  employeeId: string,
  date: Date,
  slotMinutes = 30,
  options?: MutualFreeSlotsOptions
): Promise<FreeSlot[]> {
  const reporterTz = options?.reporterTimeZone ?? FALLBACK_TZ
  const reporterStart = options?.reporterWorkStart ?? DEFAULT_WORK_START
  const reporterEnd = options?.reporterWorkEnd ?? DEFAULT_WORK_END
  const employeeTz = options?.employeeTimeZone ?? FALLBACK_TZ
  const employeeStart = options?.employeeWorkStart ?? DEFAULT_WORK_START
  const employeeEnd = options?.employeeWorkEnd ?? DEFAULT_WORK_END

  let windowStart: Date
  let windowEnd: Date

  if (options && (options.reporterTimeZone ?? options.employeeTimeZone)) {
    const reporterWindow = getWorkWindowUtc(date, reporterTz, reporterStart, reporterEnd)
    windowStart = reporterWindow.start
    windowEnd = reporterWindow.end
  } else {
    // Legacy: IST 9–19
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
    const dayStart = new Date(date)
    dayStart.setUTCHours(0, 0, 0, 0)
    windowStart = new Date(dayStart.getTime() + BUSINESS_START_HOUR * 3600000 - IST_OFFSET_MS)
    windowEnd = new Date(dayStart.getTime() + BUSINESS_END_HOUR * 3600000 - IST_OFFSET_MS)
  }

  const [reporterBusy, employeeBusy] = await Promise.all([
    getFreeBusy(reporterId, windowStart, windowEnd),
    getFreeBusy(employeeId, windowStart, windowEnd),
  ])

  const allBusy = [...reporterBusy, ...employeeBusy]
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
    .sort((a, b) => a.start - b.start)

  const merged: { start: number; end: number }[] = []
  for (const range of allBusy) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }

  const slotMs = slotMinutes * 60 * 1000
  const slots: FreeSlot[] = []
  let cursor = windowStart.getTime()

  const considerSlot = (slotStartMs: number): boolean => {
    const slotStart = new Date(slotStartMs)
    if (!isWithinWorkHours(slotStart, reporterTz, reporterStart, reporterEnd)) return false
    if (!isWithinWorkHours(slotStart, employeeTz, employeeStart, employeeEnd)) return false
    return true
  }

  for (const busy of merged) {
    while (cursor + slotMs <= busy.start) {
      if (considerSlot(cursor)) {
        slots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(cursor + slotMs).toISOString(),
        })
      }
      cursor += slotMs
    }
    cursor = Math.max(cursor, busy.end)
  }

  while (cursor + slotMs <= windowEnd.getTime()) {
    if (considerSlot(cursor)) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(cursor + slotMs).toISOString(),
      })
    }
    cursor += slotMs
  }

  return slots
}

const SLOT_DURATION_MINUTES = 30

/**
 * Check if a specific date/time is free for both reporter and employee
 * (i.e. falls within one of their mutual free slots for that day).
 */
export async function isDateTimeFreeForBoth(
  reporterId: string,
  employeeId: string,
  dateTime: Date,
  durationMinutes = SLOT_DURATION_MINUTES,
  options?: MutualFreeSlotsOptions
): Promise<boolean> {
  const day = new Date(dateTime)
  day.setUTCHours(0, 0, 0, 0)
  const slots = await getMutualFreeSlots(reporterId, employeeId, day, 30, options)
  const startMs = dateTime.getTime()
  const endMs = startMs + durationMinutes * 60 * 1000
  return slots.some((slot) => {
    const slotStart = new Date(slot.start).getTime()
    const slotEnd = new Date(slot.end).getTime()
    return startMs >= slotStart && endMs <= slotEnd
  })
}
