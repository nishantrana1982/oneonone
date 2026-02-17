import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { getSettings, updateSettings } from '@/lib/settings'
import { maskApiKey } from '@/lib/encryption'
import { UserRole } from '@prisma/client'

// GET - Fetch settings (masked for security)
export async function GET() {
  try {
    await requireRole([UserRole.SUPER_ADMIN])
    
    const settings = await getSettings()

    // Return masked sensitive values
    return NextResponse.json({
      openaiApiKey: maskApiKey(settings.openaiApiKey),
      openaiApiKeySet: !!settings.openaiApiKey,
      openaiModel: settings.openaiModel,
      whisperModel: settings.whisperModel,
      awsRegion: settings.awsRegion,
      awsAccessKeyId: maskApiKey(settings.awsAccessKeyId),
      awsAccessKeyIdSet: !!settings.awsAccessKeyId,
      awsSecretKey: maskApiKey(settings.awsSecretKey),
      awsSecretKeySet: !!settings.awsSecretKey,
      awsS3Bucket: settings.awsS3Bucket,
      maxRecordingMins: settings.maxRecordingMins,
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// PUT - Update settings
export async function PUT(request: NextRequest) {
  try {
    await requireRole([UserRole.SUPER_ADMIN])
    
    const body = await request.json()
    const {
      openaiApiKey,
      openaiModel,
      whisperModel,
      awsRegion,
      awsAccessKeyId,
      awsSecretKey,
      awsS3Bucket,
      maxRecordingMins,
    } = body

    const updates: Record<string, string | number | null> = {}

    // Only update fields that are explicitly provided
    // Empty string means clear, undefined means don't change
    if (openaiApiKey !== undefined) updates.openaiApiKey = openaiApiKey || null
    if (openaiModel !== undefined) updates.openaiModel = openaiModel
    if (whisperModel !== undefined) updates.whisperModel = whisperModel
    if (awsRegion !== undefined) updates.awsRegion = awsRegion || null
    if (awsAccessKeyId !== undefined) updates.awsAccessKeyId = awsAccessKeyId || null
    if (awsSecretKey !== undefined) updates.awsSecretKey = awsSecretKey || null
    if (awsS3Bucket !== undefined) updates.awsS3Bucket = awsS3Bucket || null
    if (maxRecordingMins !== undefined) updates.maxRecordingMins = parseInt(maxRecordingMins) || 25

    await updateSettings(updates)

    // Return updated settings (masked)
    const settings = await getSettings()
    return NextResponse.json({
      openaiApiKey: maskApiKey(settings.openaiApiKey),
      openaiApiKeySet: !!settings.openaiApiKey,
      openaiModel: settings.openaiModel,
      whisperModel: settings.whisperModel,
      awsRegion: settings.awsRegion,
      awsAccessKeyId: maskApiKey(settings.awsAccessKeyId),
      awsAccessKeyIdSet: !!settings.awsAccessKeyId,
      awsSecretKey: maskApiKey(settings.awsSecretKey),
      awsSecretKeySet: !!settings.awsSecretKey,
      awsS3Bucket: settings.awsS3Bucket,
      maxRecordingMins: settings.maxRecordingMins,
      message: 'Settings updated successfully',
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

// POST - Test OpenAI connection
export async function POST(request: NextRequest) {
  try {
    await requireRole([UserRole.SUPER_ADMIN])
    
    const body = await request.json()
    const { action } = body

    if (action === 'test-openai') {
      const settings = await getSettings()
      
      if (!settings.openaiApiKey) {
        return NextResponse.json(
          { error: 'OpenAI API key not configured' },
          { status: 400 }
        )
      }

      // Test the API key with a simple request
      const OpenAI = (await import('openai')).default
      const openai = new OpenAI({ apiKey: settings.openaiApiKey })
      
      try {
        await openai.models.list()
        return NextResponse.json({ success: true, message: 'OpenAI connection successful' })
      } catch (err: unknown) {
        return NextResponse.json(
          { error: `OpenAI connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
          { status: 400 }
        )
      }
    }

    if (action === 'test-s3') {
      const settings = await getSettings()
      
      const region = settings.awsRegion || process.env.AWS_REGION
      const accessKeyId = settings.awsAccessKeyId || process.env.AWS_ACCESS_KEY_ID
      const secretAccessKey = settings.awsSecretKey || process.env.AWS_SECRET_ACCESS_KEY
      const bucket = settings.awsS3Bucket || process.env.AWS_S3_BUCKET

      if (!region || !accessKeyId || !secretAccessKey || !bucket) {
        return NextResponse.json(
          { error: 'AWS S3 not fully configured. Please provide Region, Access Key, Secret Key, and Bucket Name.' },
          { status: 400 }
        )
      }

      try {
        const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3')
        
        const s3Client = new S3Client({
          region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        })

        // Test by checking if bucket exists and is accessible
        await s3Client.send(new HeadBucketCommand({ Bucket: bucket }))
        
        return NextResponse.json({ 
          success: true, 
          message: `S3 connection successful! Bucket "${bucket}" is accessible.` 
        })
      } catch (err: unknown) {
        const s3Error = err as { message?: string; name?: string; Code?: string; $metadata?: { httpStatusCode?: number } }
        let errorMessage = s3Error.message || 'Unknown error'
        
        if (s3Error.name === 'NotFound' || s3Error.$metadata?.httpStatusCode === 404) {
          errorMessage = `Bucket "${bucket}" not found. Please check the bucket name.`
        } else if (s3Error.name === 'InvalidAccessKeyId' || s3Error.Code === 'InvalidAccessKeyId') {
          errorMessage = 'Invalid Access Key ID. Please check your credentials.'
        } else if (s3Error.name === 'SignatureDoesNotMatch') {
          errorMessage = 'Invalid Secret Access Key. Please check your credentials.'
        } else if (s3Error.name === 'AccessDenied' || s3Error.$metadata?.httpStatusCode === 403) {
          errorMessage = `Access denied to bucket "${bucket}". Please check IAM permissions.`
        }
        
        return NextResponse.json(
          { error: `S3 connection failed: ${errorMessage}` },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Error testing settings:', error)
    return NextResponse.json(
      { error: 'Failed to test settings' },
      { status: 500 }
    )
  }
}
