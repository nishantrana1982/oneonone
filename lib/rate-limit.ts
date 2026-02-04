// Simple in-memory rate limiter
// For production, use Redis or a similar distributed store

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

// Default configs for different endpoints
export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  default: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 20 }, // 20 requests per 15 minutes
  api: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 requests per minute
  recordings: { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 uploads per hour
  export: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 exports per hour
}

export function rateLimit(
  identifier: string,
  config: RateLimitConfig = rateLimitConfigs.default
): { success: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier

  let entry = rateLimitStore.get(key)

  // Clean up expired entries
  if (entry && now > entry.resetTime) {
    rateLimitStore.delete(key)
    entry = undefined
  }

  if (!entry) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    }
    rateLimitStore.set(key, entry)
  }

  entry.count++

  const remaining = Math.max(0, config.maxRequests - entry.count)
  const success = entry.count <= config.maxRequests

  return {
    success,
    remaining,
    resetTime: entry.resetTime,
  }
}

export function getRateLimitHeaders(
  remaining: number,
  resetTime: number,
  limit: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
  }
}

// Middleware helper for API routes
export function checkRateLimit(
  request: Request,
  configType: keyof typeof rateLimitConfigs = 'default'
): { allowed: boolean; headers: Record<string, string> } {
  // Get identifier (IP address or user ID from cookie/header)
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  
  // You could also add user ID for authenticated requests
  const identifier = `${ip}:${configType}`
  
  const config = rateLimitConfigs[configType]
  const result = rateLimit(identifier, config)

  return {
    allowed: result.success,
    headers: getRateLimitHeaders(result.remaining, result.resetTime, config.maxRequests),
  }
}

// Clean up old entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}
