/**
 * Parse Zoom meeting ID from a Zoom URL.
 * Supports: https://zoom.us/j/12345678901, https://us04web.zoom.us/j/12345678901?pwd=...
 */
export function parseZoomMeetingId(meetingLink: string | null | undefined): string | null {
  if (!meetingLink || typeof meetingLink !== 'string') return null
  const trimmed = meetingLink.trim()
  if (!trimmed) return null
  // Match /j/NUMBERS (Zoom meeting ID is 9–11 digits)
  const match = trimmed.match(/zoom\.us\/j\/(\d{9,11})/i) ?? trimmed.match(/\/j\/(\d{9,11})/)
  return match ? match[1]! : null
}
