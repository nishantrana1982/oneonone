import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { saveToLocalStorage, generateRecordingKey, isS3Configured, uploadToS3 } from '@/lib/s3'
import { UserRole } from '@prisma/client'

// Allow up to 25 minutes for large uploads (22+ min recordings)
export const maxDuration = 1500

function sanitizeErrorDetail(msg: string): string {
  if (!msg || typeof msg !== 'string') return 'Unknown error'
  return msg
    .replace(/\b(AKIA|A3T|ABIA)[A-Z0-9]{14,}/gi, '[REDACTED]')
    .replace(/\b[0-9a-fA-F]{40,}\b/g, '[REDACTED]')
    .slice(0, 200)
}

// This route handles direct file uploads when S3 is not configured
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    // Get the meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { employee: true },
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

    // Get the file from form data (may throw if body too large or malformed)
    let formData: FormData
    let file: File | null
    let duration: string | null
    try {
      formData = await request.formData()
      file = formData.get('file') as File | null
      duration = formData.get('duration') as string | null
    } catch (formErr: unknown) {
      const msg = formErr instanceof Error ? formErr.message : ''
      const isTooLarge = /body|size|limit|413/i.test(msg)
      return NextResponse.json(
        {
          error: isTooLarge ? 'Recording too large' : 'Invalid request',
          detail: isTooLarge
            ? 'The recording file is too large. Try a shorter recording or check server/nginx upload limits.'
            : sanitizeErrorDetail(msg) || 'Could not read upload.',
        },
        { status: isTooLarge ? 413 : 400 }
      )
    }

    // #region agent log
    const hasFile = !!file
    const fileSize = file && typeof file.size === 'number' ? file.size : 0
    try {
      await fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'recording/upload/route.ts:POST',message:'Upload route entry',data:{hasFile,fileSize,meetingId:params.id},timestamp:Date.now(),hypothesisId:'A,C'})}).catch(()=>{});
    } catch (_) {}
    // #endregion

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const key = generateRecordingKey(params.id)
    let buffer: Buffer
    try {
      buffer = Buffer.from(await file.arrayBuffer())
    } catch (bufErr: unknown) {
      const msg = bufErr instanceof Error ? bufErr.message : 'Failed to read file'
      return NextResponse.json(
        { error: 'Failed to read recording', detail: sanitizeErrorDetail(msg) },
        { status: 400 }
      )
    }

    // S3 only: require S3 to be configured for recording uploads
    let useS3: boolean
    try {
      useS3 = await isS3Configured()
    } catch (configErr: unknown) {
      console.error('S3 config check failed:', configErr)
      return NextResponse.json(
        {
          error: 'Storage configuration error',
          detail: 'Could not read S3 settings. Check Admin → Settings and server logs.',
        },
        { status: 503 }
      )
    }
    // #region agent log
    try {
      await fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'recording/upload/route.ts:s3check',message:'S3 check',data:{useS3,bufferLen:buffer.length},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    } catch (_) {}
    // #endregion
    if (!useS3) {
      return NextResponse.json(
        {
          error: 'S3 is not configured',
          detail: 'Configure AWS S3 in Admin → Settings → Recording Storage so recordings can be uploaded.',
        },
        { status: 503 }
      )
    }
    try {
      await uploadToS3(buffer, key, 'audio/webm')
    } catch (s3Err: unknown) {
      try {
        await fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'recording/upload/route.ts:s3upload',message:'uploadToS3 failed',data:{error:s3Err instanceof Error?s3Err.message:'',name:s3Err instanceof Error?s3Err.name:''},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
      } catch (_) {}
      throw s3Err
    }

    const recording = await prisma.meetingRecording.upsert({
      where: { meetingId: params.id },
      create: {
        meetingId: params.id,
        audioKey: key,
        duration: parseInt(duration) || 0,
        fileSize: buffer.length,
        status: 'UPLOADED',
        recordedAt: new Date(),
      },
      update: {
        audioKey: key,
        duration: parseInt(duration) || 0,
        fileSize: buffer.length,
        status: 'UPLOADED',
        recordedAt: new Date(),
        errorMessage: null,
      },
    })

    return NextResponse.json({
      key,
      recordingId: recording.id,
      message: 'File uploaded to S3',
    })
  } catch (error) {
    // #region agent log
    try {
      await fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'recording/upload/route.ts:catch',message:'Upload route error',data:{error:error instanceof Error?error.message:'',name:error instanceof Error?error.name:''},timestamp:Date.now(),hypothesisId:'A,B,C,E'})}).catch(()=>{});
    } catch (_) {}
    // #endregion
    console.error('Error uploading file:', error)
    const detail = error instanceof Error ? error.message : 'Unknown error'
    const sanitized = sanitizeErrorDetail(detail)
    return NextResponse.json(
      { error: 'Failed to upload file', detail: sanitized },
      { status: 500 }
    )
  }
}
