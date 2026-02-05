import { NextRequest, NextResponse } from 'next/server'
import { requireRole, canAccessEmployeeData } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { saveToLocalStorage, generateRecordingKey } from '@/lib/s3'
import { UserRole } from '@prisma/client'

// Allow up to 5 minutes for large uploads
export const maxDuration = 300

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

    // Get the file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const duration = formData.get('duration') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Generate key and save to local storage
    const key = generateRecordingKey(params.id)
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload/route.ts:50',message:'Upload received - file details',data:{fileName:file.name,fileType:file.type,fileSize:file.size,bufferSize:buffer.length,firstBytes:buffer.slice(0,16).toString('hex'),duration},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    await saveToLocalStorage(buffer, key)

    // Create or update recording record
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
      message: 'File uploaded to local storage'
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
