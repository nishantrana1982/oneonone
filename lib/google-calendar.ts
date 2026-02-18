import { google } from 'googleapis'
import { prisma } from './prisma'

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
 * Business-hours window (9 AM – 7 PM IST).
 * These are used to constrain free-slot generation.
 */
const BUSINESS_START_HOUR = 9
const BUSINESS_END_HOUR = 19

/**
 * Given busy ranges from both users, compute mutually free slots of
 * `slotMinutes` duration within business hours of the given date (IST).
 */
export async function getMutualFreeSlots(
  reporterId: string,
  employeeId: string,
  date: Date,
  slotMinutes = 30
): Promise<FreeSlot[]> {
  // Build day window in IST (UTC+5:30)
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  // Convert IST business hours to UTC for the API
  const windowStart = new Date(dayStart.getTime() + BUSINESS_START_HOUR * 3600000 - IST_OFFSET_MS)
  const windowEnd = new Date(dayStart.getTime() + BUSINESS_END_HOUR * 3600000 - IST_OFFSET_MS)

  // Fetch busy ranges for both users in parallel
  const [reporterBusy, employeeBusy] = await Promise.all([
    getFreeBusy(reporterId, windowStart, windowEnd),
    getFreeBusy(employeeId, windowStart, windowEnd),
  ])

  // Merge all busy ranges into a single sorted list
  const allBusy = [...reporterBusy, ...employeeBusy]
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
    .sort((a, b) => a.start - b.start)

  // Flatten overlapping busy ranges
  const merged: { start: number; end: number }[] = []
  for (const range of allBusy) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }

  // Generate free slots in the gaps
  const slotMs = slotMinutes * 60 * 1000
  const slots: FreeSlot[] = []
  let cursor = windowStart.getTime()

  for (const busy of merged) {
    while (cursor + slotMs <= busy.start) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(cursor + slotMs).toISOString(),
      })
      cursor += slotMs
    }
    cursor = Math.max(cursor, busy.end)
  }

  // After all busy ranges, fill remaining window
  while (cursor + slotMs <= windowEnd.getTime()) {
    slots.push({
      start: new Date(cursor).toISOString(),
      end: new Date(cursor + slotMs).toISOString(),
    })
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
  durationMinutes = SLOT_DURATION_MINUTES
): Promise<boolean> {
  const day = new Date(dateTime)
  day.setHours(0, 0, 0, 0)
  const slots = await getMutualFreeSlots(reporterId, employeeId, day, 30)
  const startMs = dateTime.getTime()
  const endMs = startMs + durationMinutes * 60 * 1000
  return slots.some((slot) => {
    const slotStart = new Date(slot.start).getTime()
    const slotEnd = new Date(slot.end).getTime()
    return startMs >= slotStart && endMs <= slotEnd
  })
}
