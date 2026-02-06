import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getSettings } from './settings'
import fs from 'fs/promises'
import path from 'path'

// Local storage directory for recordings when S3 is not configured
const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'uploads', 'recordings')

// Check if S3 is fully configured (all required fields)
export async function isS3Configured(): Promise<boolean> {
  const settings = await getSettings()
  const accessKeyId = settings.awsAccessKeyId || process.env.AWS_ACCESS_KEY_ID || ''
  const secretAccessKey = settings.awsSecretKey || process.env.AWS_SECRET_ACCESS_KEY || ''
  const bucket = settings.awsS3Bucket || process.env.AWS_S3_BUCKET || ''
  const region = settings.awsRegion || process.env.AWS_REGION || ''
  
  // All fields must be present and have meaningful values
  const isConfigured = !!(
    accessKeyId && 
    accessKeyId.length > 10 && 
    secretAccessKey && 
    secretAccessKey.length > 10 && 
    bucket && 
    bucket.length > 3 &&
    region
  )
  
  console.log(`[S3] Configuration check: ${isConfigured ? 'Configured' : 'Not configured'}`)
  return isConfigured
}

// Create S3 client with settings from database
async function getS3Client(): Promise<{ client: S3Client; bucket: string; region: string }> {
  const settings = await getSettings()
  
  const region = settings.awsRegion || process.env.AWS_REGION || 'us-east-1'
  const accessKeyId = settings.awsAccessKeyId || process.env.AWS_ACCESS_KEY_ID || ''
  const secretAccessKey = settings.awsSecretKey || process.env.AWS_SECRET_ACCESS_KEY || ''
  const bucket = settings.awsS3Bucket || process.env.AWS_S3_BUCKET || 'ami-one-on-one-recordings'
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured')
  }
  
  const client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
  
  return { client, bucket, region }
}

// Ensure local storage directory exists
async function ensureLocalStorageDir(): Promise<void> {
  try {
    await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

// Save file to local storage
export async function saveToLocalStorage(buffer: Buffer, key: string): Promise<string> {
  await ensureLocalStorageDir()
  const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, '_'))
  await fs.writeFile(filePath, buffer)
  return filePath
}

// Read file from local storage
export async function readFromLocalStorage(key: string): Promise<Buffer> {
  const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, '_'))
  return fs.readFile(filePath)
}

// Delete file from local storage
export async function deleteFromLocalStorage(key: string): Promise<void> {
  try {
    const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, '_'))
    await fs.unlink(filePath)
  } catch (error) {
    // File might not exist
  }
}

/** Path to recordings on disk (e.g. for admin display). */
export function getLocalStorageDir(): string {
  return LOCAL_STORAGE_DIR
}

/** Get storage used by local recordings: file count and total bytes. */
export async function getLocalStorageStats(): Promise<{ fileCount: number; totalBytes: number }> {
  try {
    await ensureLocalStorageDir()
    const names = await fs.readdir(LOCAL_STORAGE_DIR)
    let totalBytes = 0
    for (const name of names) {
      const filePath = path.join(LOCAL_STORAGE_DIR, name)
      const stat = await fs.stat(filePath)
      if (stat.isFile()) totalBytes += stat.size
    }
    return { fileCount: names.length, totalBytes }
  } catch (err) {
    return { fileCount: 0, totalBytes: 0 }
  }
}

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  const { client, bucket, region } = await getS3Client()
  
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  })

  await client.send(command)

  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
  
  return { url, key }
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<{ uploadUrl: string; key: string }> {
  const { client, bucket } = await getS3Client()
  
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn })
  return { uploadUrl, key }
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const { client, bucket } = await getS3Client()
  
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  return getSignedUrl(client, command, { expiresIn })
}

export async function deleteFromS3(key: string): Promise<void> {
  const { client, bucket } = await getS3Client()
  
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  await client.send(command)
}

export function generateRecordingKey(meetingId: string): string {
  const timestamp = Date.now()
  return `recordings/${meetingId}/${timestamp}.webm`
}
