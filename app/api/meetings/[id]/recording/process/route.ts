import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getSignedDownloadUrl, isS3Configured, readFromLocalStorage } from '@/lib/s3'
import { transcribeAudio, analyzeTranscript } from '@/lib/openai'
import { UserRole } from '@prisma/client'
import { getSettings } from '@/lib/settings'

// Set max duration for this route (15 minutes for long audio transcription + analysis)
export const maxDuration = 900

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])
    const body = await request.json()
    const { key, duration, language } = body // language is ISO-639-1 code: en, hi, gu, mr, etc.

    // Check if OpenAI is configured first
    const settings = await getSettings()
    if (!settings.openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please configure it in Admin > Settings.' },
        { status: 400 }
      )
    }

    // Get the meeting with employee details
    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { 
        employee: true,
        reporter: true,
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Check access
    const canAccess = canAccessEmployeeData(
      user.role,
      user.id,
      meeting.employeeId,
      meeting.employee.reportsToId
    )

    if (!canAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get current recording (upload route already set audioKey and status)
    const recording = await prisma.meetingRecording.findUnique({
      where: { meetingId: params.id },
    })

    if (!recording) {
      return NextResponse.json(
        { error: 'No recording found. Please upload the recording first.' },
        { status: 400 }
      )
    }

    if (!recording.audioKey) {
      return NextResponse.json(
        { error: 'Recording has no audio file. Please upload again.' },
        { status: 400 }
      )
    }

    // Use the key stored in DB (set by upload route) so we never rely on client sending the wrong key
    const audioKey = recording.audioKey

    // Update status to UPLOADED if not already
    await prisma.meetingRecording.update({
      where: { meetingId: params.id },
      data: { status: 'UPLOADED' },
    })

    // Start processing in background
    setImmediate(() => {
      processRecording(params.id, audioKey, meeting.employee.name, meeting.reporter.name, user.id, language)
        .catch(err => console.error('Background processing error:', err))
    })

    return NextResponse.json({ 
      message: 'Processing started',
      recordingId: recording.id,
    })
  } catch (error) {
    console.error('Error processing recording:', error)
    return NextResponse.json(
      { error: 'Failed to process recording' },
      { status: 500 }
    )
  }
}

async function processRecording(
  meetingId: string,
  key: string,
  employeeName: string,
  reporterName: string,
  userId: string,
  language?: string // ISO-639-1 code: en, hi, gu, mr, etc.
) {
  try {
    console.log(`[Recording] Starting transcription for meeting ${meetingId}`)
    
    // Update status to TRANSCRIBING
    await prisma.meetingRecording.update({
      where: { meetingId },
      data: { status: 'TRANSCRIBING' },
    })

    // Try to get audio from S3 or local storage
    let audioBuffer: Buffer
    const s3Configured = await isS3Configured()
    
    if (s3Configured) {
      // Download from S3 (with fallback to local storage on 404)
      console.log(`[Recording] Getting download URL for key: ${key}`)
      let downloadUrl: string
      try {
        downloadUrl = await getSignedDownloadUrl(key)
      } catch (s3Error) {
        throw new Error(`S3 not configured or audio file not found. Please check AWS settings.`)
      }

      console.log(`[Recording] Downloading audio file from S3...`)
      try {
        const audioResponse = await fetch(downloadUrl, {
          headers: { 'Accept': 'audio/*' }
        })
        if (audioResponse.ok) {
          audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
          console.log(`[Recording] Downloaded ${audioBuffer.length} bytes from S3`)
        } else if (audioResponse.status === 404) {
          // S3 object missing (e.g. upload failed or used local upload) – try local storage
          console.log(`[Recording] S3 returned 404, trying local storage for key: ${key}`)
          try {
            audioBuffer = await readFromLocalStorage(key)
            console.log(`[Recording] Read ${audioBuffer.length} bytes from local storage`)
          } catch (localErr: any) {
            throw new Error(`Audio not found in S3 (404) and not in local storage. The upload may have failed – try recording again.`)
          }
        } else {
          throw new Error(`HTTP ${audioResponse.status}: ${audioResponse.statusText}`)
        }
      } catch (downloadError: any) {
        if (downloadError.message?.includes('local storage')) throw downloadError
        throw new Error(`Failed to download audio from S3: ${downloadError.message}`)
      }
    } else {
      // Read from local storage
      console.log(`[Recording] Reading audio from local storage: ${key}`)
      try {
        audioBuffer = await readFromLocalStorage(key)
        console.log(`[Recording] Read ${audioBuffer.length} bytes from local storage`)
      } catch (localError: any) {
        throw new Error(`Failed to read audio from local storage: ${localError.message}`)
      }
    }

    if (audioBuffer.length < 1000) {
      throw new Error('Audio file is too small or empty')
    }

    // Transcribe with Whisper
    console.log(`[Recording] Starting Whisper transcription with language: ${language || 'auto-detect'}...`)
    const transcription = await transcribeAudio(audioBuffer, 'recording.webm', language)
    console.log(`[Recording] Transcription complete. Language: ${transcription.language}, Duration: ${transcription.duration}s`)

    // Update with transcription
    await prisma.meetingRecording.update({
      where: { meetingId },
      data: {
        transcript: transcription.text,
        language: transcription.language,
        duration: Math.round(transcription.duration),
        status: 'ANALYZING',
      },
    })

    // Analyze transcript
    console.log(`[Recording] Starting GPT analysis...`)
    const analysis = await analyzeTranscript(transcription.text, employeeName, reporterName)
    console.log(`[Recording] Analysis complete. Quality score: ${analysis.qualityScore}`)

    // Update with analysis
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

    // Note: Suggested todos are now shown in the UI with "Add to To-Do" buttons
    // Users can manually add the ones they want instead of auto-creating all of them

    console.log(`[Recording] Processing complete for meeting ${meetingId}`)

  } catch (error) {
    console.error('[Recording] Processing error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await prisma.meetingRecording.update({
      where: { meetingId },
      data: {
        status: 'FAILED',
        errorMessage: errorMessage,
      },
    })
  }
}
