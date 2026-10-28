import { toPersianDigits } from './format.ts'

const DAY = 86_400_000
const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})
export const todayInTehran = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
export function persianParts(iso: string) {
  const parts = formatter.formatToParts(new Date(`${iso.slice(0, 10)}T12:00:00Z`))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}
export function addDays(iso: string, count: number) {
  return new Date(new Date(`${iso.slice(0, 10)}T12:00:00Z`).getTime() + count * DAY)
    .toISOString()
    .slice(0, 10)
}
export function monthStart(iso: string) {
  return addDays(iso, 1 - persianParts(iso).day)
}
export function addPersianMonths(iso: string, count: number): string {
  const parts = persianParts(iso)
  const index = parts.year * 12 + parts.month - 1 + count
  const year = Math.floor(index / 12)
  const month = index - year * 12 + 1
  const nextMonth = month === 12 ? persianToIso(year + 1, 1, 1) : persianToIso(year, month + 1, 1)
  const lastDay = persianParts(addDays(nextMonth, -1)).day
  return persianToIso(year, month, Math.min(parts.day, lastDay))
}
export function persianToIso(year: number, month: number, day: number) {
  let lo = Math.floor(Date.UTC(year + 621, 0, 1) / DAY)
  let hi = Math.floor(Date.UTC(year + 623, 0, 1) / DAY)
  const target = year * 372 + month * 31 + day
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const iso = new Date(mid * DAY).toISOString().slice(0, 10)
    const p = persianParts(iso)
    const value = p.year * 372 + p.month * 31 + p.day
    if (value === target) return iso
    if (value < target) lo = mid + 1
    else hi = mid - 1
  }
  throw new Error('تاریخ شمسی معتبر نیست.')
}
export const persianDateLabel = (iso: string) =>
  new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`))

export function persianNumericDateLabel(iso: string): string {
  const { year, month, day } = persianParts(iso)
  return toPersianDigits(
    `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
  )
}
