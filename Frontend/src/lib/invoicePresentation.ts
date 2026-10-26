import type { Invoice } from '../types/index.ts'
import { number } from './format.ts'

export const rial = (value: number) => (Number.isFinite(value) ? `${number(value)} ریال` : '—')
export function invoiceInRials(invoice: Invoice): Invoice {
  const factor = invoice.currency === 'IRR' ? 1 : 10
  return {
    ...invoice,
    currency: 'IRR',
    subtotal: (invoice.subtotal ?? invoice.total) * factor,
    total: invoice.total * factor,
    discount: (invoice.discount ?? 0) * factor,
    paidAmount: (invoice.paidAmount ?? 0) * factor,
    items: invoice.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice * factor,
      total: item.total * factor,
    })),
  }
}
const ones = [
  '',
  'یک',
  'دو',
  'سه',
  'چهار',
  'پنج',
  'شش',
  'هفت',
  'هشت',
  'نه',
  'ده',
  'یازده',
  'دوازده',
  'سیزده',
  'چهارده',
  'پانزده',
  'شانزده',
  'هفده',
  'هجده',
  'نوزده',
]
const tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود']
const hundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد']
export function amountInWords(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) return '—'
  if (!value) return 'صفر ریال'
  const groups: string[] = []
  const scales = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون', 'هزار تریلیون']
  let remaining = value
  let scale = 0
  while (remaining) {
    const group = remaining % 1000
    if (group) {
      const words: string[] = []
      if (group >= 100) words.push(hundreds[Math.floor(group / 100)]!)
      const rest = group % 100
      if (rest < 20) {
        if (rest) words.push(ones[rest]!)
      } else {
        words.push(tens[Math.floor(rest / 10)]!)
        if (rest % 10) words.push(ones[rest % 10]!)
      }
      groups.unshift(`${words.join(' و ')}${scales[scale] ? ' ' + scales[scale] : ''}`)
    }
    remaining = Math.floor(remaining / 1000)
    scale++
  }
  return groups.join(' و ') + ' ریال'
}
export function invoicePages<T>(items: T[], perPage = 10) {
  return Array.from({ length: Math.max(1, Math.ceil(items.length / perPage)) }, (_, index) => ({
    items: items.slice(index * perPage, (index + 1) * perPage),
    offset: index * perPage,
  }))
}
