'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, Square, Loader2, CheckCircle2, AlertCircle, Play, Pause, RefreshCw, Globe } from 'lucide-react'

interface MeetingRecorderProps {
  meetingId: string
  hasExistingRecording: boolean
  recordingStatus?: string
  errorMessage?: string | null
}

const PROCESSING_STAGES = [
  { status: 'UPLOADING', label: 'Uploading audio...', progress: 10 },
  { status: 'UPLOADED', label: 'Preparing for transcription...', progress: 25 },
  { status: 'TRANSCRIBING', label: 'Transcribing audio...', progress: 50 },
  { status: 'ANALYZING', label: 'Analyzing transcript...', progress: 80 },
  { status: 'COMPLETED', label: 'Complete!', progress: 100 },
]

// Language options for transcription (ISO-639-1 codes)
// Note: Some languages are not explicitly supported by OpenAI's API and will use auto-detection
// Supported by API: en, hi, mr, ta, te, kn, ml, bn, pa, ur
// Auto-detect fallback: gu (Gujarati)
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

export function MeetingRecorder({ meetingId, hasExistingRecording, recordingStatus: initialStatus, errorMessage: initialError }: MeetingRecorderProps) {
  const router = useRouter()
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState('auto') // ISO-639-1 code
  
  // Processing status state
  const [currentStatus, setCurrentStatus] = useState(initialStatus)
  const [currentError, setCurrentError] = useState(initialError)
  const [isPolling, setIsPolling] = useState(false)
  
  // Track if we've started uploading this session (fixes UI not updating after submit)
  const [hasStartedUpload, setHasStartedUpload] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const MAX_DURATION = 25 * 60 // 25 minutes in seconds

  // Get current progress info
  const getCurrentProgress = useCallback(() => {
    const stage = PROCESSING_STAGES.find(s => s.status === currentStatus)
    return stage || { status: currentStatus, label: 'Processing...', progress: 0 }
  }, [currentStatus])

  // Poll for status updates
  const pollStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/recording`)
      if (response.ok) {
        const data = await response.json()
        if (data.recording) {
          setCurrentStatus(data.recording.status)
          setCurrentError(data.recording.errorMessage)
          
          // Stop polling if completed or failed
          if (data.recording.status === 'COMPLETED' || data.recording.status === 'FAILED') {
            setIsPolling(false)
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
            // Refresh the page to show results
            if (data.recording.status === 'COMPLETED') {
              router.refresh()
            }
          }
        }
      }
    } catch (err) {
      console.error('Error polling status:', err)
    }
  }, [meetingId, router])

  // Start polling when processing starts
  useEffect(() => {
    const isProcessingStatus = ['UPLOADING', 'UPLOADED', 'TRANSCRIBING', 'ANALYZING'].includes(currentStatus || '')
    
    if (isProcessingStatus && !pollingRef.current) {
      setIsPolling(true)
      pollingRef.current = setInterval(pollStatus, 2000) // Poll every 2 seconds
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [currentStatus, pollStatus])

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) clearInterval(timerRef.current)
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    // Auto-stop at 25 minutes
    if (recordingTime >= MAX_DURATION && isRecording) {
      stopRecording()
    }
  }, [recordingTime, isRecording])

  const startRecording = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      })
      
      streamRef.current = stream
      chunksRef.current = []

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // Collect data every second

      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error starting recording:', err)
      setError('Could not access microphone. Please grant permission.')
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)
      } else {
        mediaRecorderRef.current.pause()
        if (timerRef.current) clearInterval(timerRef.current)
      }
      setIsPaused(!isPaused)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      setIsRecording(false)
      setIsPaused(false)
    }
  }

  const uploadRecording = async () => {
    if (!audioBlob) return

    setIsUploading(true)
    setError(null)
    setCurrentStatus('UPLOADING')
    setHasStartedUpload(true) // Track that we've started uploading this session

    try {
      // Get presigned URL or check if using local storage
      const presignResponse = await fetch(`/api/meetings/${meetingId}/recording/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'audio/webm',
          duration: recordingTime,
          fileSize: audioBlob.size,
        }),
      })

      if (!presignResponse.ok) {
        const errorData = await presignResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get upload URL')
      }
      
      const { uploadUrl, key, useLocalUpload } = await presignResponse.json()

      if (useLocalUpload) {
        // Upload directly to server (local storage) with timeout so we don't hang forever
        console.log('Using local storage upload')
        const formData = new FormData()
        formData.append('file', audioBlob, 'recording.webm')
        formData.append('duration', recordingTime.toString())

        const uploadTimeoutMs = 25 * 60 * 1000 // 25 minutes for long recordings
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), uploadTimeoutMs)

        let localUploadResponse: Response
        try {
          localUploadResponse = await fetch(`/api/meetings/${meetingId}/recording/upload`, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          })
        } catch (uploadErr: unknown) {
          clearTimeout(timeoutId)
          if (uploadErr instanceof Error && uploadErr.name === 'AbortError') {
            throw new Error('Upload timed out. The recording may be too large or the connection is slow. Try a shorter recording.')
          }
          throw uploadErr
        }
        clearTimeout(timeoutId)
        
        if (!localUploadResponse.ok) {
          const errorData = await localUploadResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to upload file')
        }
        
        const localData = await localUploadResponse.json()
        setCurrentStatus('UPLOADED')
        
        // Start processing with language hint
        setIsProcessing(true)
        const processResponse = await fetch(`/api/meetings/${meetingId}/recording/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            key: localData.key, 
            duration: recordingTime,
            language: selectedLanguage !== 'auto' ? selectedLanguage : undefined,
          }),
        })

        if (!processResponse.ok) {
          const errorData = await processResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to start processing')
        }
      } else {
        // Upload to S3 using XMLHttpRequest
        console.log('Using S3 upload')
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', uploadUrl, true)
          xhr.setRequestHeader('Content-Type', 'audio/webm')
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              reject(new Error(`Upload failed (${xhr.status}). Check S3 bucket CORS and permissions.`))
            }
          }
          xhr.onerror = () => reject(new Error('Network error during upload. Try again.'))
          xhr.send(audioBlob)
        })

        setCurrentStatus('UPLOADED')

        // Confirm upload and start processing with language hint
        setIsProcessing(true)
        const processResponse = await fetch(`/api/meetings/${meetingId}/recording/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            key, 
            duration: recordingTime,
            language: selectedLanguage !== 'auto' ? selectedLanguage : undefined,
          }),
        })

        if (!processResponse.ok) {
          const errorData = await processResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to start processing')
        }
      }

      // Clear audio blob and start polling for status
      setAudioBlob(null)
      setRecordingTime(0)
      setCurrentStatus('TRANSCRIBING')
      
      // Polling will be started by useEffect watching currentStatus

    } catch (err) {
      console.error('Error uploading recording:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload recording')
      setCurrentStatus('FAILED')
      setCurrentError(err instanceof Error ? err.message : 'Failed to upload recording')
    } finally {
      setIsUploading(false)
      setIsProcessing(false)
    }
  }

  const discardRecording = () => {
    setAudioBlob(null)
    setRecordingTime(0)
    chunksRef.current = []
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const remainingTime = MAX_DURATION - recordingTime

  // If already has a recording and it's being processed
  // Also check hasStartedUpload to show processing UI after upload starts (before page refresh)
  const isProcessingStatus = ['UPLOADING', 'UPLOADED', 'TRANSCRIBING', 'ANALYZING'].includes(currentStatus || '')
  
  if ((hasExistingRecording || hasStartedUpload) && isProcessingStatus) {
    const progress = getCurrentProgress()
    
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
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-500">{progress.progress}%</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-3 bg-blue-500/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          
          {/* Stage Indicators */}
          <div className="flex justify-between text-xs">
            {PROCESSING_STAGES.slice(0, 4).map((stage, i) => {
              const isActive = currentStatus === stage.status
              const isPast = PROCESSING_STAGES.findIndex(s => s.status === currentStatus) > i
              return (
                <div 
                  key={stage.status}
                  className={`flex items-center gap-1 ${
                    isActive ? 'text-blue-500 font-medium' : 
                    isPast ? 'text-green-500' : 'text-medium-gray'
                  }`}
                >
                  {isPast ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : isActive ? (
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
        </div>
        
        <p className="text-xs text-medium-gray text-center">
          This may take 1-3 minutes depending on the recording length
        </p>
      </div>
    )
  }

  // If has a completed recording
  if ((hasExistingRecording || hasStartedUpload) && currentStatus === 'COMPLETED') {
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

  // If has a failed recording
  if ((hasExistingRecording || hasStartedUpload) && currentStatus === 'FAILED') {
    const handleRetry = async () => {
      // Delete the failed recording and allow re-recording
      try {
        await fetch(`/api/meetings/${meetingId}/recording`, { method: 'DELETE' })
        router.refresh()
      } catch (err) {
        console.error('Error deleting failed recording:', err)
      }
    }
    
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
                {currentError || 'There was an error processing the recording'}
              </p>
              {currentError?.includes('API key') && (
                <p className="text-xs text-red-400 mt-1">
                  Please configure the OpenAI API key in Admin → Settings
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

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Recording in progress */}
      {isRecording && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
              <p className="text-3xl font-mono font-bold text-dark-gray dark:text-white">
                {formatTime(recordingTime)}
              </p>
              <p className="text-xs text-medium-gray mt-1">
                {formatTime(remainingTime)} remaining
              </p>
            </div>
          </div>

          {/* Recording progress bar */}
          <div className="w-full h-2 bg-off-white dark:bg-charcoal rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-500 to-orange transition-all duration-1000"
              style={{ width: `${(recordingTime / MAX_DURATION) * 100}%` }}
            />
          </div>

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

      {/* Recording preview */}
      {!isRecording && audioBlob && (
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-lg font-medium text-dark-gray dark:text-white">Recording Complete</p>
              <p className="text-sm text-medium-gray">Duration: {formatTime(recordingTime)}</p>
            </div>
          </div>

          <audio 
            controls 
            src={URL.createObjectURL(audioBlob)} 
            className="w-full"
          />

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={discardRecording}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-medium-gray hover:text-red-500 transition-colors disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={uploadRecording}
              disabled={isUploading || isProcessing}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-orange text-white rounded-xl hover:bg-orange/90 disabled:opacity-50 transition-colors"
            >
              {isUploading || isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isUploading ? 'Uploading...' : 'Processing...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save & Transcribe
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Start recording button */}
      {!isRecording && !audioBlob && (
        <div className="text-center space-y-4">
          {/* Language selector */}
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
              : `Recording will be transcribed in ${LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.label}`
            }
          </p>
        </div>
      )}
    </div>
  )
}
