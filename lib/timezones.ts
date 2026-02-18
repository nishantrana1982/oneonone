/**
 * Country and timezone options for profile and availability.
 * Used to show only slots when both users are within their working hours.
 */

export const COUNTRY_OPTIONS = [
  { value: 'IN', label: 'India' },
  { value: 'US', label: 'United States' },
  { value: 'SG', label: 'Singapore' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'OTHER', label: 'Other' },
] as const

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'India (IST, UTC+5:30)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT, UTC+8)' },
  { value: 'America/Denver', label: 'US Mountain (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (PST/PDT)' },
  { value: 'America/Phoenix', label: 'US Arizona (MST, no DST)' },
  { value: 'America/Chicago', label: 'US Central (CST/CDT)' },
  { value: 'America/New_York', label: 'US Eastern (EST/EDT)' },
  { value: 'Europe/London', label: 'UK (GMT/BST)' },
  { value: 'Australia/Sydney', label: 'Australia Sydney (AEST/AEDT)' },
  { value: 'UTC', label: 'UTC' },
] as const

export const DEFAULT_WORK_START = '09:00'
export const DEFAULT_WORK_END = '19:00'

/** India standard working hours (11 AM - 9 PM) */
export const INDIA_WORK = { start: '11:00', end: '21:00' }
/** US typical (e.g. 4:30 AM - 4 PM MST) */
export const US_WORK = { start: '04:30', end: '16:00' }
/** Singapore typical */
export const SINGAPORE_WORK = { start: '09:00', end: '18:00' }

export function getDefaultWorkHoursForCountry(country: string | null): { start: string; end: string } {
  if (country === 'IN') return INDIA_WORK
  if (country === 'US') return US_WORK
  if (country === 'SG') return SINGAPORE_WORK
  return { start: DEFAULT_WORK_START, end: DEFAULT_WORK_END }
}

export function getDefaultTimeZoneForCountry(country: string | null): string {
  if (country === 'IN') return 'Asia/Kolkata'
  if (country === 'US') return 'America/Denver'
  if (country === 'SG') return 'Asia/Singapore'
  if (country === 'GB') return 'Europe/London'
  if (country === 'AU') return 'Australia/Sydney'
  return 'Asia/Kolkata'
}

/** Short TZ label for display (e.g. "IST", "MST") */
const TZ_SHORT: Record<string, string> = {
  'Asia/Kolkata': 'IST',
  'Asia/Singapore': 'SGT',
  'America/Denver': 'MST',
  'America/Los_Angeles': 'PST',
  'America/Phoenix': 'MST',
  'America/Chicago': 'CST',
  'America/New_York': 'EST',
  'Europe/London': 'GMT',
  'Australia/Sydney': 'AEST',
  UTC: 'UTC',
}

export function formatWorkHoursLabel(
  reporterWork: { start: string; end: string },
  reporterTz: string,
  employeeWork: { start: string; end: string },
  employeeTz: string
): string {
  const fmt = (h: string) => {
    const [hr = 0, min = 0] = h.split(':').map(Number)
    const h12 = hr % 12 || 12
    const ampm = hr >= 12 ? 'PM' : 'AM'
    if (min === 0) return `${h12} ${ampm}`
    return `${h12}:${String(min).padStart(2, '0')} ${ampm}`
  }
  const rTz = TZ_SHORT[reporterTz] ?? reporterTz.split('/').pop() ?? reporterTz
  const eTz = TZ_SHORT[employeeTz] ?? employeeTz.split('/').pop() ?? employeeTz
  return `Within both working hours (${fmt(reporterWork.start)} – ${fmt(reporterWork.end)} ${rTz} / ${fmt(employeeWork.start)} – ${fmt(employeeWork.end)} ${eTz})`
}
