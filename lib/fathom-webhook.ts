import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verify Fathom webhook signature.
 * @see https://developers.fathom.ai/webhooks#how-to-verify-a-webhook
 */
export function verifyFathomWebhook(
  secret: string,
  headers: { get(name: string): string | null },
  rawBody: string
): boolean {
  const webhookId = headers.get('webhook-id')
  const webhookTimestamp = headers.get('webhook-timestamp')
  const webhookSignature = headers.get('webhook-signature')

  if (!webhookId || !webhookTimestamp || !webhookSignature) return false

  const timestamp = parseInt(webhookTimestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Number.isNaN(timestamp) || Math.abs(now - timestamp) > 300) return false

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`
  const secretBase64 = secret.startsWith('whsec_') ? secret.split('_')[1] : secret
  if (!secretBase64) return false

  let secretBytes: Buffer
  try {
    secretBytes = Buffer.from(secretBase64, 'base64')
  } catch {
    return false
  }

  const expectedSig = createHmac('sha256', secretBytes).update(signedContent).digest('base64')
  const signatures = webhookSignature.split(' ').map((sig) => {
    const parts = sig.split(',')
    return parts.length > 1 ? parts[1]! : parts[0]!
  })

  return signatures.some((sig) => {
    try {
      return sig && timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sig))
    } catch {
      return false
    }
  })
}
