'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Mic,
  Square,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  Globe,
  CloudUpload,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

interface MeetingRecorderProps {
  meetingId: string
  hasExistingRecording: boolean
  recordingStatus?: string
  errorMessage?: string | null
}

const PROCESSING_STAGES = [
  { status: 'UPLOADING', label: 'Uploading audio to S3...', progress: 10 },
  { status: 'UPLOADED', label: 'Preparing for transcription...', progress: 25 },
  { status: 'TRANSCRIBING', label: 'Transcribing audio...', progress: 50 },
  { status: 'ANALYZING', label: 'Analyzing transcript...', progress: 80 },
  { status: 'COMPLETED', label: 'Complete!', progress: 100 },
]

const LANGUAGE_OPTIONS = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી) - Auto-detect' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'ur', label: 'Urdu (اردو)' },
]

const MAX_DURATION = 25 * 60 // 25 minutes
const CHUNK_UPLOAD_INTERVAL = 30_000 // Upload chunks every 30 seconds

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MeetingRecorder({
  meetingId,
  hasExistingRecording,
  recordingStatus: initialStatus,
  errorMessage: initialError,
}: MeetingRecorderProps) {
  const router = useRouter()

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState('auto')

  // Chunk upload state
  const [chunksUploaded, setChunksUploaded] = useState(0)
  const [isUploadingChunk, setIsUploadingChunk] = useState(false)
  const [chunkError, setChunkError] = useState<string | null>(null)

  // Finalize / processing state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [currentStatus, setCurrentStatus] = useState(initialStatus)
  const [currentError, setCurrentError] = useState(initialError)
  const [didStartUpload, setDidStartUpload] = useState(false)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunkUploadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Chunk tracking refs (avoid stale closures)
  const sessionKeyRef = useRef<string | null>(null)
  const chunkSequenceRef = useRef(0)
  const lastUploadedIndexRef = useRef(0)
  const isUploadingChunkRef = useRef(false)

  // --- helpers ---
  const fmt = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const getProgress = useCallback(
    () =>
      PROCESSING_STAGES.find((s) => s.status === currentStatus) ?? {
        status: currentStatus,
        label: 'Processing...',
        progress: 0,
      },
    [currentStatus]
  )

  // --- polling for processing status ---
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/recording`)
      if (!res.ok) return
      const data = await res.json()
      const rec = data.recording
      if (!rec) return
      setCurrentStatus(rec.status)
      setCurrentError(rec.errorMessage)
      if (rec.status === 'COMPLETED' || rec.status === 'FAILED') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        if (rec.status === 'COMPLETED') router.refresh()
      }
    } catch {
      // ignore
    }
  }, [meetingId, router])

  useEffect(() => {
    const shouldPoll = ['UPLOADING', 'UPLOADED', 'TRANSCRIBING', 'ANALYZING'].includes(
      currentStatus ?? ''
    )
    if (shouldPoll && !pollingRef.current) {
      pollingRef.current = setInterval(pollStatus, 3000)
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [currentStatus, pollStatus])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (chunkUploadIntervalRef.current) clearInterval(chunkUploadIntervalRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // auto-stop at max duration
  useEffect(() => {
    if (recordingTime >= MAX_DURATION && isRecording) stopRecording()
  }, [recordingTime, isRecording])

  // --- chunk upload logic ---
  const uploadPendingChunks = useCallback(async (): Promise<boolean> => {
    if (isUploadingChunkRef.current) return false
    if (!sessionKeyRef.current) return false

    const allChunks = chunksRef.current
    const newChunks = allChunks.slice(lastUploadedIndexRef.current)
    if (newChunks.length === 0) return true // nothing to upload

    isUploadingChunkRef.current = true
    setIsUploadingChunk(true)
    setChunkError(null)

    try {
      const blob = new Blob(newChunks, { type: 'audio/webm' })
      const form = new FormData()
      form.append('file', blob, `chunk_${chunkSequenceRef.current}.webm`)
      form.append('sequence', chunkSequenceRef.current.toString())

      const res = await fetch(`/api/meetings/${meetingId}/recording/upload`, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || body.error || `Chunk upload failed (${res.status})`)
      }

      lastUploadedIndexRef.current = allChunks.length
      chunkSequenceRef.current++
      setChunksUploaded((n) => n + 1)
      return true
    } catch (err) {
      console.error('[Recorder] Chunk upload error:', err)
      setChunkError(err instanceof Error ? err.message : 'Chunk upload failed')
      return false
    } finally {
      isUploadingChunkRef.current = false
      setIsUploadingChunk(false)
    }
  }, [meetingId])

  // --- recording controls ---
  const startRecording = async () => {
    try {
      setSubmitError(null)
      setChunkError(null)

      // 1. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      })
      streamRef.current = stream

      // 2. Start server session (creates DB record, returns S3 prefix)
      const sessionRes = await fetch(`/api/meetings/${meetingId}/recording/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'audio/webm' }),
      })
      if (!sessionRes.ok) {
        const body = await sessionRes.json().catch(() => ({}))
        stream.getTracks().forEach((t) => t.stop())
        throw new Error(body.detail || body.error || 'Failed to start recording session')
      }
      const { sessionKey } = await sessionRes.json()
      sessionKeyRef.current = sessionKey
      chunkSequenceRef.current = 0
      lastUploadedIndexRef.current = 0
      setChunksUploaded(0)

      // 3. Start MediaRecorder
      chunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
      }
      mediaRecorderRef.current = recorder
      recorder.start(5000) // fire ondataavailable every 5 seconds

      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000)

      // 4. Start periodic chunk upload (every 30 s)
      chunkUploadIntervalRef.current = setInterval(() => {
        uploadPendingChunks()
      }, CHUNK_UPLOAD_INTERVAL)
    } catch (err) {
      console.error('[Recorder] Start error:', err)
      setSubmitError(
        err instanceof Error ? err.message : 'Could not start recording. Check microphone access.'
      )
    }
  }

  const pauseRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return
    if (isPaused) {
      mediaRecorderRef.current.resume()
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000)
    } else {
      mediaRecorderRef.current.pause()
      if (timerRef.current) clearInterval(timerRef.current)
    }
    setIsPaused(!isPaused)
  }

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return

    // Stop recorder & mic
    mediaRecorderRef.current.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    if (chunkUploadIntervalRef.current) clearInterval(chunkUploadIntervalRef.current)
    setIsRecording(false)
    setIsPaused(false)

    // Upload any remaining chunks
    // Small delay to let final ondataavailable fire
    await new Promise((r) => setTimeout(r, 500))
    await uploadPendingChunks()
  }

  const discardRecording = async () => {
    setAudioBlob(null)
    setRecordingTime(0)
    chunksRef.current = []
    sessionKeyRef.current = null
    chunkSequenceRef.current = 0
    lastUploadedIndexRef.current = 0
    setChunksUploaded(0)
    setChunkError(null)

    // Delete the session from server (cleans up S3 chunks)
    try {
      await fetch(`/api/meetings/${meetingId}/recording`, { method: 'DELETE' })
    } catch {
      // ignore
    }
  }

  // --- finalize: tell server to combine chunks + transcribe ---
  const submitRecording = async () => {
    setIsSubmitting(true)
    setSubmitError(null)
    setCurrentStatus('UPLOADING')
    setDidStartUpload(true)

    try {
      // Upload any remaining chunks first
      const ok = await uploadPendingChunks()
      if (!ok && chunkSequenceRef.current === 0) {
        throw new Error('No audio chunks were uploaded. Please try recording again.')
      }

      // Call finalize
      const res = await fetch(`/api/meetings/${meetingId}/recording/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalChunks: chunkSequenceRef.current,
          duration: recordingTime,
          language: selectedLanguage !== 'auto' ? selectedLanguage : undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to start processing')
      }

      // Clear client state, start polling
      setAudioBlob(null)
      setRecordingTime(0)
      setCurrentStatus('TRANSCRIBING')
    } catch (err) {
      console.error('[Recorder] Submit error:', err)
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setSubmitError(msg)
      setCurrentStatus('FAILED')
      setCurrentError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- retry ---
  const handleRetry = async () => {
    try {
      await fetch(`/api/meetings/${meetingId}/recording`, { method: 'DELETE' })
    } catch {
      // ignore
    }
    setCurrentStatus(undefined)
    setCurrentError(null)
    setSubmitError(null)
    setDidStartUpload(false)
    sessionKeyRef.current = null
    chunkSequenceRef.current = 0
    lastUploadedIndexRef.current = 0
    setChunksUploaded(0)
    router.refresh()
  }

  // ---------------------------------------------------------------------------
  // Render: processing
  // ---------------------------------------------------------------------------
  const isProcessing = ['UPLOADING', 'UPLOADED', 'TRANSCRIBING', 'ANALYZING'].includes(
    currentStatus ?? ''
  )

  if ((hasExistingRecording || didStartUpload) && isProcessing) {
    const progress = getProgress()
    return (
      <div className="rounded-2xl bg-blue-500/5 border border-blue-500/20 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-dark-gray dark:text-white">Processing Recording</p>
            <p className="text-sm text-medium-gray">{progress.label}</p>
          </div>
          <p className="text-2xl font-bold text-blue-500">{progress.progress}%</p>
        </div>
        <div className="w-full h-3 bg-blue-500/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          {PROCESSING_STAGES.slice(0, 4).map((stage, i) => {
            const active = currentStatus === stage.status
            const past = PROCESSING_STAGES.findIndex((s) => s.status === currentStatus) > i
            return (
              <div
                key={stage.status}
                className={`flex items-center gap-1 ${
                  active
                    ? 'text-blue-500 font-medium'
                    : past
                      ? 'text-green-500'
                      : 'text-medium-gray'
                }`}
              >
                {past ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : active ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-current" />
                )}
                <span className="hidden sm:inline">
                  {stage.status === 'UPLOADING' && 'Upload'}
                  {stage.status === 'UPLOADED' && 'Prepare'}
                  {stage.status === 'TRANSCRIBING' && 'Transcribe'}
                  {stage.status === 'ANALYZING' && 'Analyze'}
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-medium-gray text-center">
          This may take 1–3 minutes depending on the recording length
        </p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: completed
  // ---------------------------------------------------------------------------
  if ((hasExistingRecording || didStartUpload) && currentStatus === 'COMPLETED') {
    return (
      <div className="rounded-2xl bg-green-500/5 border border-green-500/20 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="font-medium text-dark-gray dark:text-white">Recording Complete</p>
            <p className="text-sm text-medium-gray">Transcript and analysis available below</p>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: failed
  // ---------------------------------------------------------------------------
  if ((hasExistingRecording || didStartUpload) && currentStatus === 'FAILED') {
    return (
      <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="font-medium text-dark-gray dark:text-white">Recording Failed</p>
              <p className="text-sm text-medium-gray">
                {currentError || 'An error occurred while processing'}
              </p>
              {currentError?.includes('API key') && (
                <p className="text-xs text-red-400 mt-1">
                  Configure the OpenAI API key in Admin → Settings
                </p>
              )}
              {currentError?.includes('S3') && (
                <p className="text-xs text-red-400 mt-1">
                  Configure AWS S3 in Admin → Settings → Recording Storage
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange hover:bg-orange/10 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: default (record / preview / submit)
  // ---------------------------------------------------------------------------
  return (
    <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-dark-gray dark:text-white flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Meeting Recording
        </h3>
        {!isRecording && !audioBlob && (
          <span className="text-xs text-medium-gray">Max 25 minutes</span>
        )}
      </div>

      {submitError && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-500">{submitError}</p>
        </div>
      )}

      {/* ---- Recording in progress ---- */}
      {isRecording && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div
                className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                  isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'
                }`}
              />
              <p className="text-3xl font-mono font-bold text-dark-gray dark:text-white">
                {fmt(recordingTime)}
              </p>
              <p className="text-xs text-medium-gray mt-1">
                {fmt(MAX_DURATION - recordingTime)} remaining
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-off-white dark:bg-charcoal rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-orange transition-all duration-1000"
              style={{ width: `${(recordingTime / MAX_DURATION) * 100}%` }}
            />
          </div>

          {/* Chunk backup indicator */}
          <div className="flex items-center justify-center gap-2 text-xs text-medium-gray">
            {isUploadingChunk ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                <span className="text-blue-500">Backing up to server...</span>
              </>
            ) : chunksUploaded > 0 ? (
              <>
                <CloudUpload className="w-3 h-3 text-green-500" />
                <span className="text-green-500">
                  {chunksUploaded} backup{chunksUploaded !== 1 ? 's' : ''} saved to S3
                </span>
              </>
            ) : (
              <>
                <CloudUpload className="w-3 h-3" />
                <span>Audio will back up to S3 every 30s</span>
              </>
            )}
          </div>

          {chunkError && (
            <div className="text-center">
              <p className="text-xs text-yellow-600">
                Backup warning: {chunkError} (will retry)
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={pauseRecording}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-yellow-500/10 text-yellow-600 rounded-xl hover:bg-yellow-500/20 transition-colors"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop Recording
            </button>
          </div>
        </div>
      )}

      {/* ---- Preview recorded audio ---- */}
      {!isRecording && audioBlob && (
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-lg font-medium text-dark-gray dark:text-white">
                Recording Complete
              </p>
              <p className="text-sm text-medium-gray">
                Duration: {fmt(recordingTime)} &middot;{' '}
                {(audioBlob.size / 1024 / 1024).toFixed(1)} MB
                {chunksUploaded > 0 && (
                  <span className="text-green-500">
                    {' '}
                    &middot; {chunksUploaded} chunk{chunksUploaded !== 1 ? 's' : ''} already on S3
                  </span>
                )}
              </p>
            </div>
          </div>

          <audio controls src={URL.createObjectURL(audioBlob)} className="w-full" />

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={discardRecording}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-medium-gray hover:text-red-500 transition-colors disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={submitRecording}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-orange text-white rounded-xl hover:bg-orange/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finalizing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save &amp; Transcribe
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ---- Start recording ---- */}
      {!isRecording && !audioBlob && (
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Globe className="w-4 h-4 text-medium-gray" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="px-3 py-2 rounded-xl border border-off-white dark:border-medium-gray/20 bg-white dark:bg-charcoal text-dark-gray dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange/50"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={startRecording}
            className="inline-flex items-center gap-3 px-8 py-4 text-lg font-medium bg-gradient-to-r from-red-500 to-orange text-white rounded-2xl hover:opacity-90 transition-opacity shadow-lg"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            Start Recording
          </button>
          <p className="text-xs text-medium-gray">
            {selectedLanguage === 'auto'
              ? 'Language will be auto-detected. Select a specific language for better accuracy.'
              : `Recording will be transcribed in ${LANGUAGE_OPTIONS.find((l) => l.code === selectedLanguage)?.label}`}
          </p>
        </div>
      )}
    </div>
  )
}
