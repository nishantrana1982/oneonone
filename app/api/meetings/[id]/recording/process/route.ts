import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getSignedDownloadUrl, isS3Configured } from '@/lib/s3'
import { transcribeAudio, analyzeTranscript } from '@/lib/openai'
import { UserRole } from '@prisma/client'
import { getSettings } from '@/lib/settings'

export const maxDuration = 900

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])
    const body = await request.json()
    const { duration, language } = body

    // Check OpenAI key
    const settings = await getSettings()
    if (!settings.openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please set it in Admin → Settings.' },
        { status: 400 }
      )
    }

    // Get meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { employee: true, reporter: true },
    })
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Access check
    if (
      !canAccessEmployeeData(user.role, user.id, meeting.employeeId, meeting.employee.reportsToId)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get recording (must already be UPLOADED by the upload route)
    const recording = await prisma.meetingRecording.findUnique({
      where: { meetingId: params.id },
    })
    if (!recording || !recording.audioKey) {
      return NextResponse.json(
        { error: 'No uploaded recording found. Please upload the recording first.' },
        { status: 400 }
      )
    }

    // Kick off background processing
    processRecording(
      params.id,
      recording.audioKey,
      meeting.employee.name,
      meeting.reporter.name,
      language
    ).catch((err) => console.error('[Recording] Background processing error:', err))

    return NextResponse.json({ message: 'Processing started', recordingId: recording.id })
  } catch (error) {
    console.error('[Recording] Process route error:', error)
    return NextResponse.json({ error: 'Failed to start processing' }, { status: 500 })
  }
}

async function processRecording(
  meetingId: string,
  audioKey: string,
  employeeName: string,
  reporterName: string,
  language?: string
) {
  try {
    console.log(`[Recording] Processing meeting=${meetingId}, key=${audioKey}, lang=${language || 'auto'}`)

    // Update status
    await prisma.meetingRecording.update({
      where: { meetingId },
      data: { status: 'TRANSCRIBING' },
    })

    // Download audio from S3
    const s3Ok = await isS3Configured()
    if (!s3Ok) throw new Error('S3 is not configured. Cannot download audio for transcription.')

    const downloadUrl = await getSignedDownloadUrl(audioKey)
    console.log(`[Recording] Downloading audio from S3...`)

    const audioResponse = await fetch(downloadUrl, { headers: { Accept: 'audio/*' } })
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio from S3: HTTP ${audioResponse.status}`)
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
    console.log(`[Recording] Downloaded ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    if (audioBuffer.length < 1000) {
      throw new Error('Audio file is too small or empty')
    }

    // Transcribe with Whisper
    console.log(`[Recording] Starting Whisper transcription...`)
    const transcription = await transcribeAudio(audioBuffer, 'recording.webm', language)
    console.log(`[Recording] Transcription done. Lang=${transcription.language}, dur=${transcription.duration}s`)

    await prisma.meetingRecording.update({
      where: { meetingId },
      data: {
        transcript: transcription.text,
        language: transcription.language,
        duration: Math.round(transcription.duration),
        status: 'ANALYZING',
      },
    })

    // Analyze
    console.log(`[Recording] Starting GPT analysis...`)
    const analysis = await analyzeTranscript(transcription.text, employeeName, reporterName)
    console.log(`[Recording] Analysis complete. Quality=${analysis.qualityScore}`)

    await prisma.meetingRecording.update({
      where: { meetingId },
      data: {
        summary: analysis.summary,
        keyPoints: analysis.keyPoints,
        autoTodos: analysis.suggestedTodos,
        sentiment: analysis.sentiment,
        qualityScore: analysis.qualityScore,
        qualityDetails: analysis.qualityDetails,
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    })

    console.log(`[Recording] Processing complete for meeting=${meetingId}`)
  } catch (error) {
    console.error('[Recording] Processing error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
    await prisma.meetingRecording.update({
      where: { meetingId },
      data: { status: 'FAILED', errorMessage },
    })
  }
}
