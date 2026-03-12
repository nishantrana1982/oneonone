import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyFathomWebhook } from '@/lib/fathom-webhook'
import { notifyRecordingReady } from '@/lib/notifications'

/**
 * Fathom webhook: receive meeting transcript/summary when a Zoom (or other) call
 * recorded by Fathom is ready. Match to our Meeting and create/update MeetingRecording.
 *
 * Configure in Fathom: Settings → API Access → Add Webhook → Destination URL:
 *   https://your-domain.com/api/integrations/fathom/webhook
 * Enable: Transcript, Summary, Action items.
 * Set FATHOM_WEBHOOK_SECRET in env to the webhook secret (whsec_...) from Fathom.
 */

// Fathom webhook payload (flexible; only fields we use are typed)
interface FathomTranscriptSegment {
  speaker?: { display_name?: string; matched_calendar_invitee_email?: string }
  text?: string
  timestamp?: string
}
interface FathomActionItem {
  description?: string
  completed?: boolean
  assignee?: { name?: string; email?: string }
}
interface FathomWebhookPayload {
  id?: string
  zoom_meeting_id?: string
  meeting_id?: string
  start_time?: string
  transcript?: FathomTranscriptSegment[]
  summary?: string | { markdown_formatted?: string; template_name?: string }
  action_items?: FathomActionItem[]
  invitees?: Array<{ email?: string }>
  attendees?: Array<{ email?: string }>
}

function getSummaryText(summary: FathomWebhookPayload['summary']): string {
  if (!summary) return ''
  if (typeof summary === 'string') return summary
  return summary.markdown_formatted ?? ''
}

function getParticipantEmails(payload: FathomWebhookPayload): string[] {
  const emails = new Set<string>()
  const add = (e: string | undefined) => {
    if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) emails.add(e.toLowerCase())
  }
  payload.invitees?.forEach((i) => add(i.email))
  payload.attendees?.forEach((a) => add(a.email))
  payload.transcript?.forEach((t) => add(t.speaker?.matched_calendar_invitee_email))
  return [...emails]
}

function transcriptToText(segments: FathomTranscriptSegment[] | undefined): string {
  if (!Array.isArray(segments)) return ''
  return segments
    .map((s) => (typeof s.text === 'string' ? s.text : '').trim())
    .filter(Boolean)
    .join('\n')
}

function actionItemsToAutoTodos(items: FathomActionItem[] | undefined): unknown[] {
  if (!Array.isArray(items)) return []
  return items.map((a) => ({
    title: a.description ?? 'Action item',
    completed: a.completed ?? false,
    assignee: a.assignee?.name ?? a.assignee?.email ?? null,
  }))
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.FATHOM_WEBHOOK_SECRET
    if (!secret) {
      console.warn('[Fathom] FATHOM_WEBHOOK_SECRET not set; webhook disabled')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }

    const rawBody = await request.text()
    const headers = {
      get: (name: string) => request.headers.get(name) ?? request.headers.get(name.toLowerCase()),
    }
    if (!verifyFathomWebhook(secret, headers, rawBody)) {
      console.warn('[Fathom] Webhook signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let payload: FathomWebhookPayload
    try {
      payload = JSON.parse(rawBody) as FathomWebhookPayload
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const zoomId =
      payload.zoom_meeting_id ??
      (typeof payload.meeting_id === 'string' && /^\d{9,11}$/.test(payload.meeting_id)
        ? payload.meeting_id
        : null)
    const participantEmails = getParticipantEmails(payload)
    const meetingStart = payload.start_time ? new Date(payload.start_time) : null

    let meeting: { id: string; employeeId: string; reporterId: string } | null = null

    if (zoomId) {
      meeting = await prisma.meeting.findFirst({
        where: { zoomMeetingId: zoomId },
        select: { id: true, employeeId: true, reporterId: true },
      })
    }

    if (!meeting && participantEmails.length >= 2 && meetingStart) {
      const dayStart = new Date(meetingStart)
      dayStart.setUTCHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
      const candidates = await prisma.meeting.findMany({
        where: {
          meetingDate: { gte: dayStart, lt: dayEnd },
          meetingType: 'ZOOM',
          status: { in: ['SCHEDULED', 'COMPLETED'] },
        },
        include: {
          employee: { select: { email: true } },
          reporter: { select: { email: true } },
        },
      })
      for (const c of candidates) {
        const reporterEmail = c.reporter?.email?.toLowerCase()
        const employeeEmail = c.employee?.email?.toLowerCase()
        if (
          reporterEmail &&
          employeeEmail &&
          participantEmails.includes(reporterEmail) &&
          participantEmails.includes(employeeEmail)
        ) {
          meeting = { id: c.id, employeeId: c.employeeId, reporterId: c.reporterId }
          break
        }
      }
    }

    if (!meeting) {
      console.warn('[Fathom] No matching meeting found', { zoomId, participantEmails: participantEmails.length, meetingStart })
      return NextResponse.json({ received: true, matched: false })
    }

    const transcriptText = transcriptToText(payload.transcript)
    const summaryText = getSummaryText(payload.summary)
    const autoTodos = actionItemsToAutoTodos(payload.action_items)

    const autoTodosJson: Prisma.InputJsonValue = autoTodos.length > 0 ? (autoTodos as Prisma.InputJsonValue) : []
    await prisma.meetingRecording.upsert({
      where: { meetingId: meeting.id },
      create: {
        meetingId: meeting.id,
        transcript: transcriptText || null,
        summary: summaryText || null,
        autoTodos: autoTodosJson,
        status: 'COMPLETED',
        processedAt: new Date(),
        recordedAt: meetingStart,
      },
      update: {
        transcript: transcriptText || undefined,
        summary: summaryText || undefined,
        autoTodos: autoTodosJson,
        status: 'COMPLETED',
        processedAt: new Date(),
        ...(meetingStart && { recordedAt: meetingStart }),
      },
    })

    try {
      await notifyRecordingReady([meeting.employeeId, meeting.reporterId], meeting.id)
    } catch (e) {
      console.warn('[Fathom] Notify recording ready failed', e)
    }

    return NextResponse.json({ received: true, matched: true, meetingId: meeting.id })
  } catch (error) {
    console.error('[Fathom] Webhook error', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
