import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { getSignedUploadUrl, deleteFromS3 } from '@/lib/s3'

// Get attachments for a meeting
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        employeeId: true,
        reporterId: true,
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Authorization
    const isParticipant = meeting.employeeId === user.id || meeting.reporterId === user.id
    const isAdmin = user.role === UserRole.SUPER_ADMIN
    if (!isParticipant && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json(meeting.attachments)
  } catch (error) {
    console.error('Error fetching attachments:', error)
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 })
  }
}

// Request a presigned URL for upload
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fileName, fileType, fileSize } = body

    if (!fileName || !fileType || !fileSize) {
      return NextResponse.json({ error: 'Missing file information' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (fileSize > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 })
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        employeeId: true,
        reporterId: true,
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Authorization - only participants can upload
    const isParticipant = meeting.employeeId === user.id || meeting.reporterId === user.id
    const isAdmin = user.role === UserRole.SUPER_ADMIN
    if (!isParticipant && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Generate S3 key
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const s3Key = `attachments/${params.id}/${timestamp}-${sanitizedFileName}`

    let uploadUrl = ''
    let key = s3Key

    // Try to get presigned URL (may fail if S3 not configured)
    try {
      const result = await getSignedUploadUrl(s3Key, fileType)
      uploadUrl = result.uploadUrl
      key = result.key
    } catch (error) {
      console.warn('S3 not configured, skipping presigned URL generation:', error)
      // Continue without S3 - just save metadata
    }

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        meetingId: params.id,
        fileName,
        fileType,
        fileSize,
        s3Key: key,
        uploadedBy: user.id,
      },
    })

    return NextResponse.json({
      uploadUrl,
      attachmentId: attachment.id,
      skipUpload: !uploadUrl, // Tell client to skip S3 upload
    })
  } catch (error) {
    console.error('Error creating attachment:', error)
    return NextResponse.json({ error: 'Failed to create attachment' }, { status: 500 })
  }
}

// Delete an attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID required' }, { status: 400 })
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        meeting: {
          select: { employeeId: true, reporterId: true },
        },
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Authorization - only uploader, reporter, or admin can delete
    const isUploader = attachment.uploadedBy === user.id
    const isReporter = attachment.meeting.reporterId === user.id
    const isAdmin = user.role === UserRole.SUPER_ADMIN
    if (!isUploader && !isReporter && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete from S3
    try {
      await deleteFromS3(attachment.s3Key)
    } catch (error) {
      console.error('Failed to delete from S3:', error)
    }

    // Delete record
    await prisma.attachment.delete({
      where: { id: attachmentId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 })
  }
}
