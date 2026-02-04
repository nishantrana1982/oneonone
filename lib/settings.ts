import { prisma } from './prisma'
import { encrypt, decrypt } from './encryption'

export interface SystemSettings {
  openaiApiKey: string | null
  openaiModel: string
  whisperModel: string
  awsRegion: string | null
  awsAccessKeyId: string | null
  awsSecretKey: string | null
  awsS3Bucket: string | null
  maxRecordingMins: number
}

// Cache settings for 5 minutes to avoid frequent DB calls
let cachedSettings: SystemSettings | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getSettings(): Promise<SystemSettings> {
  // Check cache
  if (cachedSettings && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedSettings
  }

  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'system' },
  })

  if (!settings) {
    // Return defaults from environment variables
    return {
      openaiApiKey: process.env.OPENAI_API_KEY || null,
      openaiModel: 'gpt-4o',
      whisperModel: 'whisper-1',
      awsRegion: process.env.AWS_REGION || null,
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || null,
      awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY || null,
      awsS3Bucket: process.env.AWS_S3_BUCKET || null,
      maxRecordingMins: 25,
    }
  }

  // Decrypt sensitive fields
  const decryptedSettings: SystemSettings = {
    openaiApiKey: settings.openaiApiKey ? decrypt(settings.openaiApiKey) : process.env.OPENAI_API_KEY || null,
    openaiModel: settings.openaiModel,
    whisperModel: settings.whisperModel,
    awsRegion: settings.awsRegion || process.env.AWS_REGION || null,
    awsAccessKeyId: settings.awsAccessKeyId || process.env.AWS_ACCESS_KEY_ID || null,
    awsSecretKey: settings.awsSecretKey ? decrypt(settings.awsSecretKey) : process.env.AWS_SECRET_ACCESS_KEY || null,
    awsS3Bucket: settings.awsS3Bucket || process.env.AWS_S3_BUCKET || null,
    maxRecordingMins: settings.maxRecordingMins,
  }

  // Update cache
  cachedSettings = decryptedSettings
  cacheTimestamp = Date.now()

  return decryptedSettings
}

export async function updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
  // Encrypt sensitive fields if provided
  const dataToUpdate: any = {}

  if (updates.openaiApiKey !== undefined) {
    dataToUpdate.openaiApiKey = updates.openaiApiKey ? encrypt(updates.openaiApiKey) : null
  }
  if (updates.openaiModel !== undefined) {
    dataToUpdate.openaiModel = updates.openaiModel
  }
  if (updates.whisperModel !== undefined) {
    dataToUpdate.whisperModel = updates.whisperModel
  }
  if (updates.awsRegion !== undefined) {
    dataToUpdate.awsRegion = updates.awsRegion
  }
  if (updates.awsAccessKeyId !== undefined) {
    dataToUpdate.awsAccessKeyId = updates.awsAccessKeyId
  }
  if (updates.awsSecretKey !== undefined) {
    dataToUpdate.awsSecretKey = updates.awsSecretKey ? encrypt(updates.awsSecretKey) : null
  }
  if (updates.awsS3Bucket !== undefined) {
    dataToUpdate.awsS3Bucket = updates.awsS3Bucket
  }
  if (updates.maxRecordingMins !== undefined) {
    dataToUpdate.maxRecordingMins = updates.maxRecordingMins
  }

  await prisma.systemSettings.upsert({
    where: { id: 'system' },
    create: {
      id: 'system',
      ...dataToUpdate,
    },
    update: dataToUpdate,
  })

  // Clear cache
  cachedSettings = null
  cacheTimestamp = 0

  return getSettings()
}

export function clearSettingsCache(): void {
  cachedSettings = null
  cacheTimestamp = 0
}
