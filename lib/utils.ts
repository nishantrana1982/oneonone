import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, timeZone = 'Asia/Kolkata'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(d)
}

export function formatDateTime(date: Date | string, timeZone = 'Asia/Kolkata'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(d)
}

/** Fallback timezone used for displaying meeting date/times when user TZ is unknown */
export const MEETING_DISPLAY_TIMEZONE = 'Asia/Kolkata'

/** Short date for notifications (server-side safe) */
export function formatDateForNotification(date: Date, timeZone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date)
}

/** Format meeting date for list view (short: Wed, Feb 18, 11:30 AM) */
export function formatMeetingDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: MEETING_DISPLAY_TIMEZONE,
  }).format(d)
}

/** Format meeting date for detail view (long: Wednesday, February 18, 2026 at 11:30 AM) */
export function formatMeetingDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: MEETING_DISPLAY_TIMEZONE,
  }).format(d)
}
