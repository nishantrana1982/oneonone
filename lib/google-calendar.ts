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
  } catch (error: any) {
    console.error('Error creating calendar event:', error)
    
    // Check if it's an auth error
    if (error.message?.includes('No Google account') || error.code === 401) {
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'google-calendar.ts:isCalendarEnabled',message:'Token check',data:{userId,hasAccount:!!account,hasAccessToken:!!account?.access_token,hasRefreshToken:!!account?.refresh_token,expiresAt:account?.expires_at},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    return !!(account?.access_token && account?.refresh_token)
  } catch (e) {
    console.error('Error checking calendar status:', e)
    return false
  }
}
