import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import {
  chunkKey,
  finalRecordingKey,
  downloadFromS3,
  uploadToS3,
  deleteFromS3,
} from '@/lib/s3'
import { transcribeAudio, analyzeTranscript } from '@/lib/openai'
import { UserRole } from '@prisma/client'
import { getSettings } from '@/lib/settings'
import { logRecordingProcessed } from '@/lib/audit'

export const maxDuration = 900

// POST — Finalize recording: combine chunks, transcribe, analyze
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])
    const body = await request.json()
    const { totalChunks, duration, language } = body

    if (!totalChunks || totalChunks < 1) {
      return NextResponse.json({ error: 'No chunks to process' }, { status: 400 })
    }

    // Check OpenAI key
    const settings = await getSettings()
    if (!settings.openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Set it in Admin → Settings.' },
        { status: 400 }
      )
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { employee: true, reporter: true },
    })
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (
      !canAccessEmployeeData(user.role, user.id, meeting.employeeId, meeting.employee.reportsToId)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const recording = await prisma.meetingRecording.findUnique({
      where: { meetingId: params.id },
    })
    if (!recording || !recording.audioKey) {
      return NextResponse.json(
        { error: 'No recording session found. Start a recording first.' },
        { status: 400 }
      )
    }

    // Update duration
    await prisma.meetingRecording.update({
      where: { meetingId: params.id },
      data: { duration: duration || 0, status: 'UPLOADED' },
    })

    // Kick off background processing
    processRecording(
      params.id,
      recording.audioKey,
      totalChunks,
      meeting.employee.name,
      meeting.reporter.name,
      language
    ).catch((err) => console.error('[Recording] Background processing error:', err))

    // Audit log
    await logRecordingProcessed(user.id, params.id, {
      recordingId: recording.id,
      language,
      totalChunks,
    })

    return NextResponse.json({ message: 'Processing started', recordingId: recording.id })
  } catch (error) {
    console.error('[Recording] Process route error:', error)
    return NextResponse.json({ error: 'Failed to start processing' }, { status: 500 })
  }
}

async function processRecording(
  meetingId: string,
  sessionKey: string,
  totalChunks: number,
  employeeName: string,
  reporterName: string,
  language?: string
) {
  try {
    console.log(
      `[Recording] Finalizing meeting=${meetingId}, session=${sessionKey}, chunks=${totalChunks}, lang=${language || 'auto'}`
    )

    // Step 1: Download all chunks from S3 and combine
    await prisma.meetingRecording.update({
      where: { meetingId },
      data: { status: 'TRANSCRIBING' },
    })

    const buffers: Buffer[] = []
    for (let i = 0; i < totalChunks; i++) {
      const key = chunkKey(sessionKey, i)
      console.log(`[Recording] Downloading chunk ${i}/${totalChunks}: ${key}`)
      const buf = await downloadFromS3(key)
      buffers.push(buf)
    }

    const combined = Buffer.concat(buffers)
    console.log(
      `[Recording] Combined ${totalChunks} chunks → ${(combined.length / 1024 / 1024).toFixed(2)} MB`
    )

    if (combined.length < 1000) {
      throw new Error('Combined audio is too small or empty')
    }

    // Step 2: Upload final combined file to S3
    const finalKey = finalRecordingKey(sessionKey)
    await uploadToS3(combined, finalKey, 'audio/webm')
    console.log(`[Recording] Final file uploaded: ${finalKey}`)

    // Update audioKey to point to the final file
    await prisma.meetingRecording.update({
      where: { meetingId },
      data: { audioKey: finalKey, fileSize: combined.length },
    })

    // Step 3: Clean up individual chunks (non-blocking)
    cleanupChunks(sessionKey, totalChunks).catch((err) =>
      console.warn('[Recording] Chunk cleanup failed:', err)
    )

    // Step 4: Transcribe with Whisper
    console.log(`[Recording] Starting Whisper transcription...`)
    const transcription = await transcribeAudio(combined, 'recording.webm', language)
    console.log(
      `[Recording] Transcription done. Lang=${transcription.language}, dur=${transcription.duration}s`
    )

    await prisma.meetingRecording.update({
      where: { meetingId },
      data: {
        transcript: transcription.text,
        language: transcription.language,
        duration: Math.round(transcription.duration),
        status: 'ANALYZING',
      },
    })

    // Step 5: Analyze with GPT
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

    // Notify both employee and reporter that recording is ready
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { employeeId: true, reporterId: true },
      })
      if (meeting) {
        const { notifyRecordingReady } = await import('@/lib/notifications')
        await notifyRecordingReady(
          [meeting.employeeId, meeting.reporterId],
          meetingId
        )
      }
    } catch (notifError) {
      console.error('[Recording] Failed to create notification:', notifError)
    }

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

async function cleanupChunks(sessionKey: string, totalChunks: number) {
  for (let i = 0; i < totalChunks; i++) {
    try {
      await deleteFromS3(chunkKey(sessionKey, i))
    } catch {
      // ignore individual chunk delete failures
    }
  }
  console.log(`[Recording] Cleaned up ${totalChunks} chunks`)
}
