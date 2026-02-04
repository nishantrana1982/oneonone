import { google } from 'googleapis'
import { prisma } from './prisma'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  process.env.GOOGLE_CALENDAR_REDIRECT_URI || process.env.NEXTAUTH_URL + '/api/auth/callback/google'
)

export async function createCalendarEvent(
  meetingId: string,
  employeeEmail: string,
  reporterEmail: string,
  meetingDate: Date,
  employeeName: string,
  reporterName: string
) {
  try {
    // Get access token from the reporter's account (they schedule the meeting)
    // In a real implementation, you'd store and refresh tokens per user
    // For now, we'll use service account or stored tokens
    
    // This is a simplified version - in production, you'd need to:
    // 1. Store OAuth tokens for each user
    // 2. Refresh tokens when they expire
    // 3. Use the appropriate user's token to create events

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const event = {
      summary: `One-on-One: ${employeeName} & ${reporterName}`,
      description: 'AMI One-on-One Meeting',
      start: {
        dateTime: meetingDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: new Date(meetingDate.getTime() + 30 * 60 * 1000).toISOString(), // 30 minutes default
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
  } catch (error) {
    console.error('Error creating calendar event:', error)
    throw error
  }
}

export async function updateCalendarEvent(
  googleEventId: string,
  meetingDate: Date,
  employeeName: string,
  reporterName: string
) {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const event = {
      summary: `One-on-One: ${employeeName} & ${reporterName}`,
      start: {
        dateTime: meetingDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: new Date(meetingDate.getTime() + 30 * 60 * 1000).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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

export async function deleteCalendarEvent(googleEventId: string) {
  try {
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
