import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { addDays, addWeeks, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns'
import { RecurringFrequency } from '@prisma/client'

const FALLBACK_TZ = 'Asia/Kolkata'

/**
 * Calculate the first upcoming occurrence of a recurring meeting from now.
 */
export function calculateFirstOccurrence(
  dayOfWeek: number,
  timeOfDay: string,
  frequency: RecurringFrequency,
  timeZone = FALLBACK_TZ
): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const now = new Date()
  const zoned = toZonedTime(now, timeZone)
  const currentDay = zoned.getDay()
  let daysUntil = dayOfWeek - currentDay
  if (daysUntil < 0) daysUntil += 7
  else if (daysUntil === 0) {
    if (zoned.getHours() > hours || (zoned.getHours() === hours && zoned.getMinutes() >= minutes)) {
      daysUntil += 7
    }
  }
  let nextLocal = addDays(zoned, daysUntil)
  nextLocal = setHours(nextLocal, hours)
  nextLocal = setMinutes(nextLocal, minutes)
  nextLocal = setSeconds(nextLocal, 0)
  nextLocal = setMilliseconds(nextLocal, 0)
  if (frequency === 'BIWEEKLY' && daysUntil < 7) {
    nextLocal = addWeeks(nextLocal, 1)
  }
  return fromZonedTime(nextLocal, timeZone)
}

/**
 * Return the next N occurrence dates for a recurring slot (e.g. next 4 Mondays at 3pm).
 * Used to find the first free occurrence when the immediate next one may be blocked (holiday, leave).
 */
export function getNextOccurrenceDates(
  dayOfWeek: number,
  timeOfDay: string,
  frequency: RecurringFrequency,
  timeZone = FALLBACK_TZ,
  count: number
): Date[] {
  const dates: Date[] = []
  let current = calculateFirstOccurrence(dayOfWeek, timeOfDay, frequency, timeZone)
  for (let i = 0; i < count; i++) {
    dates.push(current)
    current = advanceToNextOccurrence(dayOfWeek, timeOfDay, frequency, current, timeZone)
  }
  return dates
}

/**
 * Given an already-generated meeting date, advance to the next occurrence.
 */
export function advanceToNextOccurrence(
  dayOfWeek: number,
  timeOfDay: string,
  frequency: RecurringFrequency,
  lastDate: Date,
  timeZone = FALLBACK_TZ
): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  let zoned = toZonedTime(lastDate, timeZone)

  switch (frequency) {
    case 'WEEKLY':
      zoned = addDays(zoned, 7)
      break
    case 'BIWEEKLY':
      zoned = addDays(zoned, 14)
      break
    case 'MONTHLY': {
      zoned = new Date(zoned)
      zoned.setMonth(zoned.getMonth() + 1)
      const currentDay = zoned.getDay()
      let daysUntil = dayOfWeek - currentDay
      if (daysUntil < 0) daysUntil += 7
      zoned = addDays(zoned, daysUntil)
      break
    }
  }

  zoned = setHours(zoned, hours)
  zoned = setMinutes(zoned, minutes)
  zoned = setSeconds(zoned, 0)
  zoned = setMilliseconds(zoned, 0)

  return fromZonedTime(zoned, timeZone)
}
